import type { GoogleSyncState } from '../google'
import type { DataPatch, EventDiff, RemoteChange } from '../patch'
import type { AppData, CalendarEvent, CalendarInfo } from '../types'
import { GoogleApiError, GoogleAuthError } from './errors'
import { eventFromGoogle, patchFromGoogle, type GEvent } from './mapping'
import { Outbox, type OutboxEntry } from './outbox'
import { ALL_FIELDS, changedFields, googleBody, googleIdFor, instanceId } from './write'

const INTERVAL_MS = 5 * 60_000
/** a focus triggers a sync only if the last one is older than this */
const MIN_GAP_MS = 60_000
/** local changes are uploaded after this quiet period (typing in a title = one upload) */
const PUSH_DELAY_MS = 2_500
/** an upload that Google rejects this often is given up (with a notice) */
const MAX_ATTEMPTS = 3

interface EventsPage {
  items?: GEvent[]
  nextPageToken?: string
  nextSyncToken?: string
  defaultReminders?: { method: string; minutes: number }[]
}

/** what the sync keeps between runs: sync tokens per calendar and unsent changes */
export interface GoogleSyncFile {
  syncTokens?: Record<string, string>
  outbox?: OutboxEntry[]
}

/** where the sync state lives: `google-sync.json` on the desktop, app storage on Android */
export interface GoogleSyncStorage {
  load(): GoogleSyncFile | null
  save(file: GoogleSyncFile): void
}

export interface SyncDeps {
  store: { get(): AppData; applyRemote(patch: DataPatch): RemoteChange | null }
  account: { readonly isConnected: boolean; request<T>(path: string, init?: RequestInit): Promise<T> }
  storage: GoogleSyncStorage
  onState?(state: GoogleSyncState): void
  /** short German message for the user, e.g. after a conflict */
  onNotice?(text: string): void
  /** IANA zone of this machine; injectable for tests */
  timeZone?: string
}

/** Google calendar events can be written to */
const isWritableGoogle = (cal: CalendarInfo | undefined): cal is CalendarInfo =>
  !!cal && cal.external?.provider === 'google' && !cal.readOnly

/** an upload problem that won't go away by retrying immediately (network, auth) */
const isTransient = (err: unknown): boolean =>
  err instanceof GoogleAuthError ||
  (err instanceof GoogleApiError && (err.status === 0 || err.status >= 500 || err.status === 429))

/**
 * Two-way sync with Google Calendar.
 * Push: local changes collected in an outbox are uploaded first (insert/patch/move/delete).
 * Pull: then changes from Google are fetched – the first run per calendar lists everything,
 * later runs only fetch changes via syncToken. Events with unsent changes are not overwritten.
 */
export class GoogleSync {
  private tokens: Record<string, string>
  private readonly outbox: Outbox
  private timer: ReturnType<typeof setInterval> | null = null
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private running: Promise<void> | null = null
  private again = false
  private readonly tz: string
  state: GoogleSyncState = { running: false, pending: 0 }

  constructor(private readonly deps: SyncDeps) {
    const saved = this.read()
    this.tokens = saved.syncTokens ?? {}
    this.outbox = new Outbox(saved.outbox ?? [])
    this.state.pending = this.outbox.size
    this.tz = deps.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  }

  private read(): GoogleSyncFile {
    try {
      return this.deps.storage.load() ?? {}
    } catch {
      return {} // a broken state file costs a full sync (and unsent changes, which stay local)
    }
  }

  private write(): void {
    this.deps.storage.save({ syncTokens: this.tokens, outbox: this.outbox.list() })
  }

  private setState(next: Partial<GoogleSyncState>): void {
    this.state = { ...this.state, ...next, pending: this.outbox.size }
    this.deps.onState?.(this.state)
  }

  start(): void {
    this.stop()
    this.timer = setInterval(() => void this.syncNow(), INTERVAL_MS)
    setTimeout(() => void this.syncNow(), 2000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.timer = null
    this.pushTimer = null
  }

  /** e.g. window focus: sync unless it just happened */
  poke(): void {
    const last = this.state.lastSync ? Date.parse(this.state.lastSync) : 0
    if (Date.now() - last > MIN_GAP_MS) void this.syncNow()
  }

  /** the UI saved changes: queue those in Google calendars and upload soon */
  recordLocal(diff: EventDiff, data: AppData): void {
    const calendars = new Map(data.calendars.map((c) => [c.id, c]))
    const changed = this.outbox.record(diff, data, (id) => isWritableGoogle(calendars.get(id)))
    if (!changed) return
    this.write()
    this.setState({})
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      void this.syncNow()
    }, PUSH_DELAY_MS)
  }

  /** next sync of this calendar fetches everything again */
  forget(googleCalendarId: string): void {
    if (!(googleCalendarId in this.tokens)) return
    delete this.tokens[googleCalendarId]
    this.write()
  }

  /** forget all calendars and unsent changes (account disconnected) */
  reset(): void {
    this.tokens = {}
    this.outbox.clear()
    this.write()
    this.setState({ running: false, lastSync: undefined, error: undefined })
  }

  /** runs a sync; if one is running, another follows right after it */
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

  private googleCalendars(): CalendarInfo[] {
    return this.deps.store.get().calendars.filter((c) => c.external?.provider === 'google')
  }

  private async syncAll(): Promise<void> {
    if (!this.deps.account.isConnected) return
    const cals = this.googleCalendars()
    // calendars switched off since the last run start from scratch next time
    const active = new Set(cals.map((c) => c.external!.id))
    let pruned = false
    for (const id of Object.keys(this.tokens)) {
      if (!active.has(id)) {
        delete this.tokens[id]
        pruned = true
      }
    }
    if (pruned) this.write()

    this.setState({ running: true })
    const errors: string[] = []
    let blocked = false
    try {
      await this.pushAll()
    } catch (err) {
      // offline or signed out: pulling would fail the same way
      console.error('[google push]', err)
      blocked = true
      errors.push((err as Error).message)
    }
    if (!blocked) {
      for (const cal of cals) {
        try {
          await this.pullCalendar(cal)
        } catch (err) {
          console.error('[google sync]', cal.external!.id, err)
          if (err instanceof GoogleAuthError) {
            errors.push(err.message)
            break // no point in trying the other calendars
          }
          errors.push(
            err instanceof GoogleApiError && err.status === 404
              ? `„${cal.name}“ gibt es bei Google nicht mehr oder du hast keinen Zugriff mehr.`
              : (err as Error).message
          )
        }
      }
    }
    this.setState({
      running: false,
      lastSync: errors.length ? this.state.lastSync : new Date().toISOString(),
      error: errors[0]
    })
  }

  /* ───────────── push ───────────── */

  private async pushAll(): Promise<void> {
    for (const entry of this.outbox.list()) {
      try {
        await this.pushEntry(entry)
        this.outbox.remove(entry.localId)
      } catch (err) {
        if (isTransient(err)) throw err // offline or signed out: keep everything for the next run
        console.error('[google push]', entry.localId, err)
        entry.attempts = (entry.attempts ?? 0) + 1
        entry.lastError = (err as Error).message
        if (entry.attempts >= MAX_ATTEMPTS || (err instanceof GoogleApiError && err.status === 403)) {
          this.outbox.remove(entry.localId)
          const title = this.deps.store.get().events.find((e) => e.id === entry.localId)?.title ?? entry.base?.title
          this.deps.onNotice?.(`„${title || 'Termin'}“ konnte nicht zu Google übertragen werden: ${entry.lastError}`)
        }
      } finally {
        this.write()
        this.setState({})
      }
    }
  }

  private calendarPath(googleCalendarId: string): string {
    return `/calendars/${encodeURIComponent(googleCalendarId)}/events`
  }

  private async send(path: string, method: string, body?: unknown, etag?: string): Promise<GEvent> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (etag) headers['If-Match'] = etag
    return this.deps.account.request<GEvent>(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  }

  /** stores Google's id/etag on the newest local version of the event (not an undo step) */
  private remember(localId: string, g: GEvent, googleCalendarId: string): void {
    const cur = this.deps.store.get().events.find((e) => e.id === localId)
    if (!cur) return
    this.deps.store.applyRemote({
      events: {
        upsert: [
          {
            ...cur,
            external: { provider: 'google', id: g.id, calendarId: googleCalendarId, etag: g.etag, updated: g.updated }
          }
        ]
      }
    })
  }

  private async pushEntry(entry: OutboxEntry): Promise<void> {
    const data = this.deps.store.get()
    const cur = data.events.find((e) => e.id === entry.localId)
    const curCal = cur ? data.calendars.find((c) => c.id === cur.calendarId) : undefined
    const base = entry.base?.external?.id ? entry.base : null
    const baseGcal = base?.external?.calendarId

    // removed by a pull or with its calendar in the meantime – nothing left to do
    if (!cur && !entry.deleted) return

    if (entry.deleted || !isWritableGoogle(curCal)) {
      // deleted here, or moved into a local calendar: remove it at Google
      if (base && baseGcal && this.googleCalendars().some((c) => c.external!.id === baseGcal)) {
        try {
          await this.send(`${this.calendarPath(baseGcal)}/${encodeURIComponent(base.external!.id)}`, 'DELETE')
        } catch (err) {
          if (!(err instanceof GoogleApiError && (err.status === 404 || err.status === 410))) throw err
        }
      }
      if (cur?.external) this.deps.store.applyRemote({ events: { upsert: [{ ...cur, external: undefined }] } })
      return
    }

    const gcal = curCal.external!.id
    const ctx = { tz: this.tz, overrideStarts: this.overrideStarts(data.events, cur!) }

    // an occurrence changed here ("nur dieser"): Google already has it as an instance of the series
    const master = !base && !cur!.external && cur!.seriesId && cur!.originalStart
      ? data.events.find((e) => e.id === cur!.seriesId)
      : undefined
    if (master && master.calendarId === cur!.calendarId) {
      const iid = instanceId(master.external?.id ?? googleIdFor(master.id), cur!.originalStart!, master.allDay)
      const g = await this.send(
        `${this.calendarPath(gcal)}/${encodeURIComponent(iid)}`,
        'PATCH',
        // confirmed: brings back an occurrence that was cancelled before (e.g. restored from the trash)
        { ...googleBody(cur!, ALL_FIELDS, { ...ctx, patch: true }), status: 'confirmed' }
      )
      this.remember(cur!.id, g, gcal)
      return
    }

    if (!base) {
      const gid = cur!.external?.id ?? googleIdFor(cur!.id)
      let g: GEvent
      try {
        g = await this.send(this.calendarPath(gcal), 'POST', { id: gid, ...googleBody(cur!, ALL_FIELDS, ctx) })
      } catch (err) {
        // a retry after a lost answer: the event is there already
        if (!(err instanceof GoogleApiError && err.status === 409)) throw err
        g = await this.send(
          `${this.calendarPath(gcal)}/${gid}`,
          'PATCH',
          googleBody(cur!, ALL_FIELDS, { ...ctx, patch: true })
        )
      }
      this.remember(cur!.id, g, gcal)
      return
    }

    let gid = base.external!.id
    let etag = cur!.external?.etag ?? base.external!.etag
    if (baseGcal && baseGcal !== gcal) {
      const moved = await this.send(
        `${this.calendarPath(baseGcal)}/${encodeURIComponent(gid)}/move?destination=${encodeURIComponent(gcal)}`,
        'POST'
      )
      gid = moved.id
      etag = moved.etag
      this.remember(cur!.id, moved, gcal)
    }

    const fields = changedFields(base, cur!)
    if (fields.length === 0) return
    const path = `${this.calendarPath(gcal)}/${encodeURIComponent(gid)}`
    const body = googleBody(cur!, fields, { ...ctx, patch: true })
    let g: GEvent
    try {
      g = await this.send(path, 'PATCH', body, etag)
    } catch (err) {
      if (!(err instanceof GoogleApiError && err.status === 412)) throw err
      // changed at Google too: the newer change wins
      const remote = await this.send(path, 'GET')
      const remoteNewer = Date.parse(remote.updated ?? '') > Date.parse(cur!.updatedAt)
      if (remoteNewer) {
        const mapped = eventFromGoogle(remote, curCal, curCal.defaultReminders ?? [], () => cur!.id)
        if (mapped) {
          if (cur!.discord) mapped.discord = cur!.discord
          if (cur!.templateId) mapped.templateId = cur!.templateId
          if (cur!.goal) mapped.goal = cur!.goal
          this.deps.store.applyRemote({ events: { upsert: [mapped] } })
        }
        this.deps.onNotice?.(
          `„${cur!.title || 'Termin'}“ wurde auch in Google geändert – die neuere Version aus Google gilt.`
        )
        return
      }
      g = await this.send(path, 'PATCH', body)
      this.deps.onNotice?.(`„${cur!.title || 'Termin'}“ wurde auch in Google geändert – deine neuere Änderung gilt.`)
    }
    this.remember(cur!.id, g, gcal)
  }

  /** starts of single occurrences of a series that exist as own changed events */
  private overrideStarts(events: CalendarEvent[], series: CalendarEvent): Set<string> {
    // only occurrences that live at Google as instances of this series (same calendar)
    return new Set(
      events
        .filter((e) => e.seriesId === series.id && e.originalStart && e.calendarId === series.calendarId)
        .map((e) => e.originalStart!)
    )
  }

  /* ───────────── pull ───────────── */

  private async pullCalendar(cal: CalendarInfo): Promise<void> {
    const gid = cal.external!.id
    const path = this.calendarPath(gid)
    let token: string | undefined = this.tokens[gid]
    const items: GEvent[] = []
    let defaultReminders: number[] | undefined
    let nextSyncToken: string | undefined
    let pageToken: string | undefined

    for (;;) {
      const q = new URLSearchParams({ maxResults: '2500', singleEvents: 'false' })
      if (token) q.set('syncToken', token)
      if (pageToken) q.set('pageToken', pageToken)
      let page: EventsPage
      try {
        page = await this.deps.account.request<EventsPage>(`${path}?${q}`)
      } catch (err) {
        if (err instanceof GoogleApiError && err.status === 410 && token) {
          // Google invalidated the sync token: start over with a full sync
          token = undefined
          pageToken = undefined
          items.length = 0
          continue
        }
        throw err
      }
      items.push(...(page.items ?? []))
      if (page.defaultReminders) {
        defaultReminders = page.defaultReminders.filter((r) => r.method === 'popup').map((r) => r.minutes)
      }
      pageToken = page.nextPageToken
      if (!pageToken) {
        nextSyncToken = page.nextSyncToken
        break
      }
    }

    // the calendar may have been switched off while we were fetching
    const current = this.deps.store.get()
    const stillThere = current.calendars.find((c) => c.id === cal.id)
    if (!stillThere) return
    const patch = patchFromGoogle({
      cal: stillThere,
      items,
      defaultReminders: defaultReminders ?? stillThere.defaultReminders ?? [],
      local: current.events.filter((e) => e.calendarId === cal.id),
      full: !token,
      pending: this.outbox.pendingIds()
    })
    this.deps.store.applyRemote(patch)
    if (nextSyncToken) {
      this.tokens[gid] = nextSyncToken
      this.write()
    }
  }
}
