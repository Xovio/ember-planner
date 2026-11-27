import { createDefaultData, type AppData, type Settings } from './types'

/**
 * Device sync model (docs/SYNC.md).
 *
 * The synced part of AppData is flattened into records, one per entry, keyed like
 * `todos/<id>`, `character/look` or `settings/defaultView`. Every record carries a stamp
 * (time + device). Merging picks the newest stamp per record, so two devices that changed
 * different entries both keep their changes. Deletions are tombstones with a stamp of their own.
 */

/** when and where a record was last changed; `del` marks a deletion */
export interface Stamp {
  t: number
  d: string
  del?: true
}

export interface SyncRecord extends Stamp {
  /** the value; absent for tombstones */
  v?: unknown
}

/** what one device uploads; each device only ever writes its own doc */
export interface DeviceDoc {
  format: 1
  deviceId: string
  name: string
  savedAt: string
  records: Record<string, SyncRecord>
}

/** local bookkeeping, kept by the main process next to the data file */
export interface SyncState {
  deviceId: string
  /** highest stamp time seen; new stamps are always later (simple hybrid clock) */
  clock: number
  stamps: Record<string, Stamp>
}

/** tombstones older than this are dropped from uploads */
export const TOMBSTONE_DAYS = 90

/** id-keyed lists in AppData that are synced entry by entry */
export const SYNC_COLLECTIONS = [
  'calendars',
  'events',
  'eventTrash',
  'lists',
  'categories',
  'todos',
  'trash',
  'templates',
  'todoTemplates',
  'boards',
  'goals'
] as const
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number]

/** settings every device shares; everything else (theme, font, autostart, paths …) stays on the device */
export const SHARED_SETTINGS = [
  'defaultView',
  'defaultReminders',
  'defaultDurationMin',
  'dayStartHour',
  'todoCalendarId',
  'deadlineReminders',
  'deadlineReminderHour',
  'showHolidays',
  'holidayRegion'
] as const satisfies readonly (keyof Settings)[]

const COLLECTION_SET = new Set<string>(SYNC_COLLECTIONS)
const SHARED_SETTING_SET = new Set<string>(SHARED_SETTINGS)

export function splitKey(key: string): [string, string] {
  const i = key.indexOf('/')
  return i < 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)]
}

/**
 * Calendars from Google or Discord sync through their own services; only the app's own
 * calendars and their events go through device sync.
 */
function localCalendarIds(data: AppData): Set<string> {
  return new Set(data.calendars.filter((c) => !c.external).map((c) => c.id))
}

/** The synced part of the data as flat records. */
export function toRecords(data: AppData): Map<string, unknown> {
  const out = new Map<string, unknown>()
  const local = localCalendarIds(data)
  for (const coll of SYNC_COLLECTIONS) {
    for (const item of data[coll] as { id: string; calendarId?: string; external?: unknown }[]) {
      if (coll === 'calendars' && item.external) continue
      if ((coll === 'events' || coll === 'eventTrash') && !local.has(item.calendarId ?? '')) continue
      out.set(`${coll}/${item.id}`, item)
    }
  }
  for (const [id, entry] of Object.entries(data.points.entries)) out.set(`points/${id}`, entry)
  out.set('meta/pointsSince', data.points.since)
  const { rewards, ...fields } = data.character
  for (const [field, value] of Object.entries(fields)) if (value !== undefined) out.set(`character/${field}`, value)
  for (const [id, reward] of Object.entries(rewards)) out.set(`rewards/${id}`, reward)
  for (const k of SHARED_SETTINGS) out.set(`settings/${k}`, data.settings[k])
  return out
}

function upsertById<T extends { id: string }>(items: T[], upsert: Map<string, T>, remove: Set<string>): T[] {
  if (upsert.size === 0 && remove.size === 0) return items
  const out: T[] = []
  const left = new Map(upsert)
  for (const item of items) {
    if (remove.has(item.id)) continue
    const next = left.get(item.id)
    if (next) {
      out.push(next)
      left.delete(item.id)
    } else out.push(item)
  }
  for (const [id, item] of left) if (!remove.has(id)) out.push(item)
  return out
}

/**
 * Writes records back into the data. Entries not covered by sync (Google events, theme …)
 * stay as they are; known entries keep their position, new ones are appended.
 */
export function applyRecords(data: AppData, set: Record<string, unknown> = {}, remove: string[] = []): AppData {
  if (Object.keys(set).length === 0 && remove.length === 0) return data
  const upserts = new Map<string, Map<string, { id: string }>>()
  const removals = new Map<string, Set<string>>()
  let points = data.points
  let character = data.character
  let settings = data.settings
  for (const [key, value] of Object.entries(set)) {
    const [kind, id] = splitKey(key)
    if (COLLECTION_SET.has(kind)) {
      if (!upserts.has(kind)) upserts.set(kind, new Map())
      upserts.get(kind)!.set(id, value as { id: string })
    } else if (kind === 'points') points = { ...points, entries: { ...points.entries, [id]: value as never } }
    else if (key === 'meta/pointsSince') points = { ...points, since: value as string }
    else if (kind === 'character') character = { ...character, [id]: value }
    else if (kind === 'rewards') character = { ...character, rewards: { ...character.rewards, [id]: value as never } }
    else if (kind === 'settings' && SHARED_SETTING_SET.has(id)) settings = { ...settings, [id]: value }
  }
  for (const key of remove) {
    const [kind, id] = splitKey(key)
    if (COLLECTION_SET.has(kind)) {
      if (!removals.has(kind)) removals.set(kind, new Set())
      removals.get(kind)!.add(id)
    } else if (kind === 'points' && id in points.entries) {
      const { [id]: _gone, ...rest } = points.entries
      points = { ...points, entries: rest }
    } else if (kind === 'rewards' && id in character.rewards) {
      const { [id]: _gone, ...rest } = character.rewards
      character = { ...character, rewards: rest }
    }
    // character fields and settings always exist, so they are never removed
  }
  const out: AppData = { ...data, points, character, settings }
  for (const coll of SYNC_COLLECTIONS) {
    const up = upserts.get(coll)
    const rm = removals.get(coll)
    if (!up && !rm) continue
    ;(out as unknown as Record<string, { id: string }[]>)[coll] = upsertById(
      data[coll] as { id: string }[],
      up ?? new Map(),
      rm ?? new Set()
    )
  }
  return out
}

// ---------------------------------------------------------------- stamps

const same = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)

let defaults: Map<string, unknown> | null = null
function defaultRecords(): Map<string, unknown> {
  defaults ??= toRecords(createDefaultData())
  return defaults
}

/**
 * Stamp for data that existed before tracking started. Untouched defaults get 0, so any real
 * entry from another device wins over them; everything else uses its own `updatedAt` if it has one.
 */
function initialStamp(key: string, value: unknown, device: string): Stamp {
  if (same(defaultRecords().get(key), value)) return { t: 0, d: device }
  const updated = (value as { updatedAt?: string } | null)?.updatedAt
  const t = updated ? Date.parse(updated) : NaN
  return { t: Number.isFinite(t) && t > 0 ? t : 1, d: device }
}

export function newSyncState(deviceId: string): SyncState {
  return { deviceId, clock: 0, stamps: {} }
}

function tick(state: SyncState, now: number): number {
  state.clock = Math.max(now, state.clock + 1)
  return state.clock
}

/**
 * Records what a local save changed. `prev` is the data before the save, or null on the very
 * first run (then every record gets an initial stamp). Returns true if any stamp changed.
 */
export function trackLocal(state: SyncState, prev: AppData | null, next: AppData, now = Date.now()): boolean {
  const after = toRecords(next)
  const before = prev ? toRecords(prev) : null
  let changed = false
  for (const [key, value] of after) {
    const stamp = state.stamps[key]
    if (!stamp) {
      // never seen: brand-new entry, or data from before tracking started
      state.stamps[key] = before && !before.has(key) ? { t: tick(state, now), d: state.deviceId } : initialStamp(key, value, state.deviceId)
      changed = true
    } else if (stamp.del || (before && before.has(key) && !same(before.get(key), value)) || (before && !before.has(key))) {
      state.stamps[key] = { t: tick(state, now), d: state.deviceId }
      changed = true
    }
  }
  if (before) {
    for (const key of before.keys()) {
      if (after.has(key)) continue
      const stamp = state.stamps[key]
      if (stamp?.del) continue
      state.stamps[key] = { t: tick(state, now), d: state.deviceId, del: true }
      changed = true
    }
  }
  return changed
}

// ---------------------------------------------------------------- docs and merging

/** This device's doc for upload. Old tombstones are left out. */
export function exportDoc(state: SyncState, data: AppData, name: string, now = Date.now()): DeviceDoc {
  const values = toRecords(data)
  const cutoff = now - TOMBSTONE_DAYS * 86400000
  const records: Record<string, SyncRecord> = {}
  for (const [key, stamp] of Object.entries(state.stamps)) {
    if (stamp.del) {
      if (stamp.t >= cutoff) records[key] = { ...stamp }
    } else if (values.has(key)) records[key] = { ...stamp, v: values.get(key) }
  }
  return { format: 1, deviceId: state.deviceId, name, savedAt: new Date(now).toISOString(), records }
}

/** later stamp wins; equal times fall back to the device id so every device picks the same one */
function newer(a: Stamp, b: Stamp): boolean {
  return a.t !== b.t ? a.t > b.t : a.d > b.d
}

/**
 * Some values are sets that only grow, and merging them is safer than picking one side:
 * completions of a repeatable ToDo and the clothes a character owns.
 */
function combine(key: string, winner: unknown, others: unknown[]): unknown {
  const [kind, id] = splitKey(key)
  if ((kind === 'todos' || kind === 'trash') && winner && typeof winner === 'object') {
    const w = winner as { repeatable?: { completions: string[] } | null }
    if (!w.repeatable) return winner
    const all = new Set(w.repeatable.completions)
    for (const o of others) for (const c of (o as typeof w | null)?.repeatable?.completions ?? []) all.add(c)
    if (all.size === w.repeatable.completions.length) return winner
    return { ...w, repeatable: { ...w.repeatable, completions: [...all].sort() } }
  }
  if (kind === 'character' && id === 'owned' && Array.isArray(winner)) {
    const all = new Set<string>(winner as string[])
    for (const o of others) if (Array.isArray(o)) for (const x of o) all.add(x)
    return all.size === winner.length ? winner : [...winner, ...[...all].filter((x) => !(winner as string[]).includes(x))]
  }
  return winner
}

export interface MergeResult {
  /** records to write into the local data */
  set: Record<string, unknown>
  /** records to delete from the local data */
  remove: string[]
}

/**
 * Merges other devices' docs into the local state. Updates `state` (stamps, clock) in place and
 * returns what has to change in the local data. Docs from this device itself are ignored.
 */
export function mergeDocs(state: SyncState, data: AppData, docs: DeviceDoc[]): MergeResult {
  const local = toRecords(data)
  const remote = docs.filter((d) => d.format === 1 && d.deviceId !== state.deviceId)
  const keys = new Set<string>(Object.keys(state.stamps))
  for (const doc of remote) for (const key of Object.keys(doc.records)) keys.add(key)
  const result: MergeResult = { set: {}, remove: [] }
  for (const key of keys) {
    const mine = state.stamps[key]
    let best: SyncRecord | null = mine ? { ...mine, v: mine.del ? undefined : local.get(key) } : null
    const values: unknown[] = mine && !mine.del && local.has(key) ? [local.get(key)] : []
    for (const doc of remote) {
      const rec = doc.records[key]
      if (!rec) continue
      state.clock = Math.max(state.clock, rec.t)
      if (!rec.del) values.push(rec.v)
      if (!best || newer(rec, best)) best = rec
    }
    if (!best) continue
    if (best.del) {
      if (!mine?.del || mine.t !== best.t || mine.d !== best.d) state.stamps[key] = { t: best.t, d: best.d, del: true }
      if (local.has(key)) result.remove.push(key)
      continue
    }
    const value = combine(key, best.v, values)
    state.stamps[key] = { t: best.t, d: best.d }
    if (!local.has(key) || !same(local.get(key), value)) result.set[key] = value
  }
  return result
}

