import type { AppData, CalendarEvent, CalendarInfo } from './types'

/**
 * A change that did not come from the UI (e.g. pulled from Google).
 * Patches are idempotent: applying the same patch twice gives the same result,
 * so the renderer and the main process can both apply it without coordination.
 */
export interface DataPatch {
  events?: { upsert?: CalendarEvent[]; remove?: string[] }
  calendars?: { upsert?: CalendarInfo[]; remove?: string[] }
}

/** A patch as broadcast by the main process; `seq` increases by one per patch. */
export interface RemoteChange {
  seq: number
  patch: DataPatch
}

function upsertById<T extends { id: string }>(items: T[], upsert: T[] = [], remove: string[] = []): T[] {
  if (upsert.length === 0 && remove.length === 0) return items
  const gone = new Set(remove)
  const replace = new Map(upsert.map((x) => [x.id, x]))
  const out: T[] = []
  for (const item of items) {
    if (gone.has(item.id)) continue
    const next = replace.get(item.id)
    if (next) {
      out.push(next)
      replace.delete(item.id)
    } else out.push(item)
  }
  for (const item of replace.values()) if (!gone.has(item.id)) out.push(item)
  return out
}

export function isEmptyPatch(p: DataPatch): boolean {
  return (
    !p.events?.upsert?.length &&
    !p.events?.remove?.length &&
    !p.calendars?.upsert?.length &&
    !p.calendars?.remove?.length
  )
}

export function applyPatch(data: AppData, patch: DataPatch): AppData {
  if (isEmptyPatch(patch)) return data
  return {
    ...data,
    events: upsertById(data.events, patch.events?.upsert, patch.events?.remove),
    calendars: upsertById(data.calendars, patch.calendars?.upsert, patch.calendars?.remove)
  }
}

export function applyPatches(data: AppData, patches: DataPatch[]): AppData {
  return patches.reduce(applyPatch, data)
}

export interface EventDiff {
  added: CalendarEvent[]
  changed: { before: CalendarEvent; after: CalendarEvent }[]
  removed: CalendarEvent[]
}

function sameEvent(a: CalendarEvent, b: CalendarEvent): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/** What changed between two event lists, matched by id. */
export function diffEvents(prev: CalendarEvent[], next: CalendarEvent[]): EventDiff {
  const before = new Map(prev.map((e) => [e.id, e]))
  const diff: EventDiff = { added: [], changed: [], removed: [] }
  for (const e of next) {
    const old = before.get(e.id)
    if (!old) diff.added.push(e)
    else {
      if (!sameEvent(old, e)) diff.changed.push({ before: old, after: e })
      before.delete(e.id)
    }
  }
  diff.removed = [...before.values()]
  return diff
}

export function isEmptyDiff(d: EventDiff): boolean {
  return d.added.length === 0 && d.changed.length === 0 && d.removed.length === 0
}

/**
 * Remote patches the main process applied, kept until the renderer confirms it has seen them.
 * A save from the renderer carries the last `seq` it knew; patches after that are replayed
 * on top of the save so a stale snapshot never overwrites newer remote data.
 */
export class RemoteLog {
  private entries: RemoteChange[] = []
  private current = 0

  get seq(): number {
    return this.current
  }

  record(patch: DataPatch): RemoteChange {
    const change = { seq: ++this.current, patch }
    this.entries.push(change)
    return change
  }

  /** patches the sender of `baseSeq` has not seen yet */
  since(baseSeq: number): DataPatch[] {
    return this.entries.filter((c) => c.seq > baseSeq).map((c) => c.patch)
  }

  /** the renderer has seen everything up to `baseSeq` */
  ack(baseSeq: number): void {
    this.entries = this.entries.filter((c) => c.seq > baseSeq)
  }

  get pending(): number {
    return this.entries.length
  }
}
