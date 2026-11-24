import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  DSTATUS,
  discordBody,
  discordEventLocalId,
  eventFromDiscord,
  sameSnapshot,
  snapshotOf,
  snapshotOfLocal,
  type AnnounceOptions,
  type DEvent,
  type DiscordSyncState
} from '@shared/discord'
import { diffEvents, type DataPatch, type EventDiff } from '@shared/patch'
import type { AppData, CalendarEvent, CalendarInfo, DiscordLink } from '@shared/types'
import type { DataStore } from '../store'
import { DiscordApiError, type DiscordAccount } from './account'

const INTERVAL_MS = 5 * 60_000
const MIN_GAP_MS = 60_000
/** local changes go to Discord after this quiet period */
const PUSH_DELAY_MS = 2_500

interface Cancel {
  guildId: string
  eventId: string
  title: string
}

interface SyncFile {
  cancels?: Cancel[]
}

export interface DiscordSyncDeps {
  store: DataStore
  account: Pick<DiscordAccount, 'isConnected' | 'request'> & Partial<Pick<DiscordAccount, 'ownerId'>>
  dir: string
  onState?(state: DiscordSyncState): void
  onNotice?(text: string): void
  /**
   * events changed by the Discord sync (e.g. moved in Discord) – lets other syncs (Google) pick them up,
   * because changes applied in the main process don't pass through the UI's save
   */
  onEventsChanged?(diff: EventDiff, data: AppData): void
  /** injectable for tests */
  now?(): number
}

const isOpen = (status: number | undefined): boolean =>
  status === undefined || status === DSTATUS.scheduled || status === DSTATUS.active

const isTransient = (err: unknown): boolean =>
  err instanceof DiscordApiError && (err.status === 0 || err.status >= 500 || err.status === 429 || err.status === 401)

/**
 * Discord server events ⇄ calendar.
 * - every enabled server is a read-only calendar with the events of all members
 * - events announced from the app stay in their own calendar and carry a `discord` link:
 *   changes go to Discord, changes made in Discord come back, deleting cancels the Discord event
 */
export class DiscordSync {
  private cancels: Cancel[]
  private timer: NodeJS.Timeout | null = null
  private pushTimer: NodeJS.Timeout | null = null
  private running: Promise<void> | null = null
  private again = false
  private readonly file: string
  state: DiscordSyncState = { running: false, pending: 0 }

  constructor(private readonly deps: DiscordSyncDeps) {
    this.file = join(deps.dir, 'discord-sync.json')
    this.cancels = this.read().cancels ?? []
    this.state.pending = this.cancels.length
  }

  private now(): number {
    return this.deps.now?.() ?? Date.now()
  }

  private read(): SyncFile {
    if (!existsSync(this.file)) return {}
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as SyncFile
    } catch {
      return {}
    }
  }

  private write(): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify({ cancels: this.cancels } satisfies SyncFile, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  private setState(next: Partial<DiscordSyncState>): void {
    this.state = { ...this.state, ...next, pending: this.cancels.length }
    this.deps.onState?.(this.state)
  }

  start(): void {
    this.stop()
    this.timer = setInterval(() => void this.syncNow(), INTERVAL_MS)
    setTimeout(() => void this.syncNow(), 3000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.timer = null
    this.pushTimer = null
  }

  poke(): void {
    const last = this.state.lastSync ? Date.parse(this.state.lastSync) : 0
    if (this.now() - last > MIN_GAP_MS) void this.syncNow()
  }

  reset(): void {
    this.cancels = []
    this.write()
    this.setState({ running: false, lastSync: undefined, error: undefined })
  }

  private schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      void this.syncNow()
    }, PUSH_DELAY_MS)
  }

  /** the UI saved changes: deleted announcements are cancelled, changed ones uploaded soon */
  recordLocal(diff: EventDiff): void {
    let touched = false
    for (const ev of diff.removed) {
      const link = ev.discord
      if (!link?.own || !isOpen(link.status)) continue
      if (!this.cancels.some((c) => c.eventId === link.eventId)) {
        this.cancels.push({ guildId: link.guildId, eventId: link.eventId, title: ev.title })
      }
      touched = true
    }
    // undo of a delete before the cancellation went out: keep the Discord event
    for (const ev of diff.added) {
      const link = ev.discord
      if (!link?.own) continue
      const before = this.cancels.length
      this.cancels = this.cancels.filter((c) => c.eventId !== link.eventId)
      if (this.cancels.length !== before) touched = true
    }
    if (touched) {
      this.write()
      this.setState({})
    }
    const changed = diff.changed.some(
      ({ after }) => after.discord?.own && !sameSnapshot(snapshotOfLocal(after, after.discord.kind), after.discord.synced)
    )
    if (touched || changed) this.schedulePush()
  }

  syncNow(): Promise<void> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = (async () => {
      try {
        do {
          this.again = false
          await this.syncAll()
        } while (this.again)
      } finally {
        this.running = null
      }
    })()
    return this.running
  }

  private guildCalendars(): CalendarInfo[] {
    return this.deps.store.get().calendars.filter((c) => c.external?.provider === 'discord')
  }

  private async syncAll(): Promise<void> {
    if (!this.deps.account.isConnected) return
    this.setState({ running: true })
    const errors: string[] = []
    try {
      await this.sendCancels()
      const guilds = new Set<string>(this.guildCalendars().map((c) => c.external!.id))
      for (const ev of this.deps.store.get().events) if (ev.discord?.own) guilds.add(ev.discord.guildId)
      for (const guildId of guilds) {
        try {
          await this.syncGuild(guildId)
        } catch (err) {
          console.error('[discord sync]', guildId, err)
          errors.push((err as Error).message)
          if (isTransient(err)) break
        }
      }
    } catch (err) {
      console.error('[discord cancel]', err)
      errors.push((err as Error).message)
    }
    this.setState({
      running: false,
      lastSync: errors.length ? this.state.lastSync : new Date(this.now()).toISOString(),
      error: errors[0]
    })
  }

  private async sendCancels(): Promise<void> {
    for (const c of [...this.cancels]) {
      try {
        await this.deps.account.request(`/guilds/${c.guildId}/scheduled-events/${c.eventId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: DSTATUS.canceled })
        })
        this.deps.onNotice?.(`„${c.title || 'Event'}“ wurde in Discord abgesagt.`)
      } catch (err) {
        if (isTransient(err)) throw err
        // already over, cancelled or deleted in Discord: nothing left to cancel
        console.error('[discord cancel]', c.eventId, err)
      }
      this.cancels = this.cancels.filter((x) => x.eventId !== c.eventId)
      this.write()
      this.setState({})
    }
  }

  /** applies a patch and lets other syncs know about changed events */
  private apply(patch: DataPatch): void {
    const before = this.deps.store.get()
    if (!this.deps.store.applyRemote(patch)) return
    const after = this.deps.store.get()
    // only real changes (title, time, …), not the interested count or status of the link
    const strip = (e: CalendarEvent): string => JSON.stringify({ ...e, discord: undefined, updatedAt: undefined })
    const diff = diffEvents(before.events, after.events)
    diff.changed = diff.changed.filter(({ before: b, after: a }) => strip(b) !== strip(a))
    if (diff.added.length || diff.changed.length || diff.removed.length) this.deps.onEventsChanged?.(diff, after)
  }

  private async syncGuild(guildId: string): Promise<void> {
    const list = await this.deps.account.request<DEvent[]>(`/guilds/${guildId}/scheduled-events?with_user_count=true`)
    const remote = new Map(list.map((d) => [d.id, d]))
    const data = this.deps.store.get()
    const now = this.now()

    // 1. own announcements: upload local changes, take over changes made in Discord, refresh count/status
    const ownUpserts: CalendarEvent[] = []
    for (const ev of data.events) {
      const link = ev.discord
      if (!link?.own || link.guildId !== guildId) continue
      const next = await this.syncOwn(ev, link, remote.get(link.eventId), now)
      if (next) ownUpserts.push(next)
    }

    // 2. everyone else's events as a read-only calendar
    const calId = `d:${guildId}`
    const cal = data.calendars.find((c) => c.id === calId)
    const ownIds = new Set(data.events.filter((e) => e.discord?.own).map((e) => e.discord!.eventId))
    const upserts: CalendarEvent[] = [...ownUpserts]
    const remove: string[] = []
    if (cal) {
      const mine = cal.discordAll ? null : await this.myEvents(guildId, list, ownIds)
      const channelNames = await this.channelNames(guildId, list)
      const local = new Map(data.events.filter((e) => e.calendarId === calId).map((e) => [e.id, e]))
      const seen = new Set<string>()
      for (const d of list) {
        if (ownIds.has(d.id)) continue
        if (mine && !mine.has(d.id)) continue
        const id = discordEventLocalId(d.id)
        seen.add(id)
        const before = local.get(id)
        const ev = eventFromDiscord(d, cal, (cid) => channelNames.get(cid), before)
        if (!before || JSON.stringify(before) !== JSON.stringify(ev)) {
          upserts.push({ ...ev, updatedAt: before ? new Date(now).toISOString() : ev.updatedAt })
        }
      }
      for (const [id, ev] of local) {
        if (seen.has(id)) continue
        // finished events drop out of Discord's list: keep them as past events
        if (new Date(ev.end).getTime() <= now) {
          if (ev.discord && ev.discord.status !== DSTATUS.completed) {
            upserts.push({ ...ev, discord: { ...ev.discord, status: DSTATUS.completed } })
          }
        } else remove.push(id)
      }
    }
    this.apply({ events: { upsert: upserts, remove } })
  }

  /**
   * events you created or clicked "Interessiert" on. Without a known owner every event counts,
   * so nothing disappears just because Discord didn't say who you are.
   */
  private async myEvents(guildId: string, list: DEvent[], ownIds: Set<string>): Promise<Set<string> | null> {
    const me = await this.deps.account.ownerId?.()
    if (!me) return null
    const mine = new Set<string>()
    for (const d of list) {
      if (ownIds.has(d.id)) continue
      if (d.creator_id === me) {
        mine.add(d.id)
        continue
      }
      let after = '0'
      for (let page = 0; page < 10; page++) {
        const users = await this.deps.account.request<{ user: { id: string } }[]>(
          `/guilds/${guildId}/scheduled-events/${d.id}/users?limit=100&after=${after}`
        )
        if (users.some((u) => u.user.id === me)) {
          mine.add(d.id)
          break
        }
        if (users.length < 100) break
        after = users[users.length - 1].user.id
      }
    }
    return mine
  }

  private async channelNames(guildId: string, list: DEvent[]): Promise<Map<string, string>> {
    if (!list.some((d) => d.channel_id)) return new Map()
    try {
      const channels = await this.deps.account.request<{ id: string; name: string }[]>(`/guilds/${guildId}/channels`)
      return new Map(channels.map((c) => [c.id, c.name]))
    } catch {
      return new Map()
    }
  }

  /** returns the updated local event, or null when nothing changed */
  private async syncOwn(
    ev: CalendarEvent,
    link: DiscordLink,
    remote: DEvent | undefined,
    now: number
  ): Promise<CalendarEvent | null> {
    if (!remote) {
      // not in the list: finished, cancelled or deleted in Discord
      const status = new Date(ev.end).getTime() <= now ? DSTATUS.completed : DSTATUS.canceled
      if (link.status === status) return null
      if (status === DSTATUS.canceled && isOpen(link.status)) {
        this.deps.onNotice?.(`„${ev.title || 'Event'}“ gibt es in Discord nicht mehr – der Termin bleibt im Kalender.`)
      }
      return { ...ev, discord: { ...link, status } }
    }
    const count = remote.user_count ?? link.userCount
    if (!isOpen(remote.status)) {
      return link.status === remote.status && link.userCount === count
        ? null
        : { ...ev, discord: { ...link, status: remote.status, userCount: count } }
    }
    const local = snapshotOfLocal(ev, link.kind)
    const theirs = snapshotOf(remote, ev.end)
    const localChanged = !sameSnapshot(local, link.synced)
    const remoteChanged = !sameSnapshot(theirs, link.synced)

    if (localChanged && !sameSnapshot(local, theirs)) {
      const body = discordBody(local, link.kind ?? 'external', link.channelId)
      delete body.privacy_level
      const updated = await this.deps.account.request<DEvent>(
        `/guilds/${link.guildId}/scheduled-events/${link.eventId}`,
        { method: 'PATCH', body: JSON.stringify(body) }
      )
      if (remoteChanged) {
        this.deps.onNotice?.(`„${ev.title || 'Event'}“ wurde auch in Discord geändert – deine Änderung gilt.`)
      }
      return {
        ...ev,
        discord: {
          ...link,
          status: updated.status,
          userCount: updated.user_count ?? count,
          synced: snapshotOf(updated, ev.end)
        }
      }
    }
    if (remoteChanged && !sameSnapshot(local, theirs)) {
      // changed in Discord only: the newer change wins
      this.deps.onNotice?.(`„${theirs.name}“ wurde in Discord geändert – übernommen.`)
      return {
        ...ev,
        title: theirs.name,
        start: theirs.start,
        end: theirs.end,
        ...(link.kind === 'external' ? { location: theirs.location } : {}),
        notes: theirs.description,
        updatedAt: new Date(now).toISOString(),
        discord: { ...link, status: remote.status, userCount: count, synced: theirs }
      }
    }
    const synced = sameSnapshot(local, theirs) ? theirs : link.synced
    if (link.status === remote.status && link.userCount === count && sameSnapshot(synced, link.synced)) return null
    return { ...ev, discord: { ...link, status: remote.status, userCount: count, synced } }
  }

  /** creates the Discord event for a calendar event and links both */
  async announce(eventId: string, opts: AnnounceOptions): Promise<void> {
    const data = this.deps.store.get()
    const ev = data.events.find((e) => e.id === eventId)
    if (!ev) throw new Error('Diesen Termin gibt es nicht mehr.')
    if (ev.recurrence) throw new Error('Serien lassen sich nicht ankündigen – wähle „Nur diesen Termin bearbeiten“ und kündige ihn dann an.')
    if (ev.discord?.own && isOpen(ev.discord.status)) throw new Error('Dieser Termin ist schon in Discord angekündigt.')
    if (new Date(ev.start).getTime() <= this.now()) throw new Error('Der Termin hat schon begonnen – Discord nimmt nur Events in der Zukunft an.')
    if (opts.kind === 'voice' && !opts.channelId) throw new Error('Bitte einen Sprachkanal wählen.')
    const location = opts.kind === 'external' ? (opts.location ?? ev.location ?? '').trim() : undefined
    if (opts.kind === 'external' && !location) throw new Error('Bitte einen Ort oder Link angeben.')

    const target: CalendarEvent = location !== undefined ? { ...ev, location } : ev
    const snap = snapshotOfLocal(target, opts.kind)
    const created = await this.deps.account.request<DEvent>(`/guilds/${opts.guildId}/scheduled-events`, {
      method: 'POST',
      body: JSON.stringify(discordBody(snap, opts.kind, opts.channelId))
    })
    // the event may have changed while we waited
    const cur = this.deps.store.get().events.find((e) => e.id === eventId) ?? target
    this.apply({
      events: {
        upsert: [
          {
            ...cur,
            ...(location !== undefined ? { location } : {}),
            discord: {
              guildId: opts.guildId,
              eventId: created.id,
              own: true,
              kind: opts.kind,
              ...(opts.channelId ? { channelId: opts.channelId } : {}),
              status: created.status,
              userCount: created.user_count ?? 0,
              synced: snapshotOf(created, cur.end)
            }
          }
        ]
      }
    })
    // the copy in the server calendar must not show up twice
    if (this.deps.store.get().events.some((e) => e.id === discordEventLocalId(created.id))) {
      this.apply({ events: { remove: [discordEventLocalId(created.id)] } })
    }
  }
}
