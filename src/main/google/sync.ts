import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { GoogleSyncState } from '@shared/google'
import type { CalendarInfo } from '@shared/types'
import type { DataStore } from '../store'
import { GoogleApiError, type GoogleAccount } from './account'
import { patchFromGoogle, type GEvent } from './mapping'
import { GoogleAuthError } from './oauth'

const INTERVAL_MS = 5 * 60_000
/** a focus or a change triggers a sync only if the last one is older than this */
const MIN_GAP_MS = 60_000

interface EventsPage {
  items?: GEvent[]
  nextPageToken?: string
  nextSyncToken?: string
  defaultReminders?: { method: string; minutes: number }[]
}

export interface SyncDeps {
  store: DataStore
  account: Pick<GoogleAccount, 'isConnected' | 'request'>
  dir: string
  onState?(state: GoogleSyncState): void
}

/**
 * Pulls Google events into the local store.
 * First run per calendar lists everything, later runs only fetch changes via syncToken.
 */
export class GoogleSync {
  private tokens: Record<string, string>
  private timer: NodeJS.Timeout | null = null
  private running: Promise<void> | null = null
  private again = false
  private readonly file: string
  state: GoogleSyncState = { running: false }

  constructor(private readonly deps: SyncDeps) {
    this.file = join(deps.dir, 'google-sync.json')
    this.tokens = this.read()
  }

  private read(): Record<string, string> {
    if (!existsSync(this.file)) return {}
    try {
      return (JSON.parse(readFileSync(this.file, 'utf8')) as { syncTokens?: Record<string, string> }).syncTokens ?? {}
    } catch {
      return {} // a broken state file only costs a full sync
    }
  }

  private write(): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify({ syncTokens: this.tokens }, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  private setState(next: Partial<GoogleSyncState>): void {
    this.state = { ...this.state, ...next }
    this.deps.onState?.(this.state)
  }

  start(): void {
    this.stop()
    this.timer = setInterval(() => void this.syncNow(), INTERVAL_MS)
    setTimeout(() => void this.syncNow(), 2000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** e.g. window focus: sync unless it just happened */
  poke(): void {
    const last = this.state.lastSync ? Date.parse(this.state.lastSync) : 0
    if (Date.now() - last > MIN_GAP_MS) void this.syncNow()
  }

  /** next sync of this calendar fetches everything again */
  forget(googleCalendarId: string): void {
    if (!(googleCalendarId in this.tokens)) return
    delete this.tokens[googleCalendarId]
    this.write()
  }

  /** forget all calendars (account disconnected) */
  reset(): void {
    this.tokens = {}
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
    if (cals.length === 0) {
      this.setState({ lastSync: new Date().toISOString(), error: undefined })
      return
    }

    this.setState({ running: true })
    const errors: string[] = []
    for (const cal of cals) {
      try {
        await this.syncCalendar(cal)
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
    this.setState({
      running: false,
      lastSync: errors.length ? this.state.lastSync : new Date().toISOString(),
      error: errors[0]
    })
  }

  private async syncCalendar(cal: CalendarInfo): Promise<void> {
    const gid = cal.external!.id
    const path = `/calendars/${encodeURIComponent(gid)}/events`
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
      full: !token
    })
    this.deps.store.applyRemote(patch)
    if (nextSyncToken) {
      this.tokens[gid] = nextSyncToken
      this.write()
    }
  }
}
