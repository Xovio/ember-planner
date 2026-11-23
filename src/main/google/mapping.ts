import { localMidnightISO, parseRecurrence } from '@shared/ical'
import type { DataPatch } from '@shared/patch'
import type { CalendarEvent, CalendarInfo } from '@shared/types'

/** the parts of a Google Calendar event resource we read */
export interface GEventTime {
  date?: string
  dateTime?: string
  timeZone?: string
}

export interface GEvent {
  id: string
  status?: 'confirmed' | 'tentative' | 'cancelled'
  etag?: string
  summary?: string
  description?: string
  location?: string
  start?: GEventTime
  end?: GEventTime
  recurrence?: string[]
  recurringEventId?: string
  originalStartTime?: GEventTime
  reminders?: { useDefault?: boolean; overrides?: { method: string; minutes: number }[] }
  extendedProperties?: { private?: Record<string, string> }
  created?: string
  updated?: string
}

/** local id of a Google event; stable, so repeated syncs replace instead of duplicating */
export const googleEventLocalId = (calendarGoogleId: string, eventId: string): string =>
  `g:${calendarGoogleId}:${eventId}`

export function timeToISO(t: GEventTime | undefined): string | null {
  if (!t) return null
  if (t.date) return localMidnightISO(t.date)
  if (t.dateTime) return new Date(t.dateTime).toISOString()
  return null
}

/** Google descriptions created in the web UI are HTML; we show plain text */
export function htmlToText(html: string): string {
  if (!/<[a-z][\s\S]*>/i.test(html)) return html
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi, (_m, href: string, text: string) =>
      text && text !== href ? `${text} (${href})` : href
    )
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** mapped event, or null for entries without usable times */
export function eventFromGoogle(g: GEvent, cal: CalendarInfo, defaultReminders: number[]): CalendarEvent | null {
  const calGoogleId = cal.external!.id
  const start = timeToISO(g.start)
  const end = timeToISO(g.end) ?? start
  if (!start || !end) return null
  const allDay = !!g.start?.date
  const reminders = g.reminders?.useDefault
    ? defaultReminders
    : (g.reminders?.overrides ?? []).filter((r) => r.method === 'popup').map((r) => r.minutes)

  const ev: CalendarEvent = {
    id: googleEventLocalId(calGoogleId, g.id),
    calendarId: cal.id,
    title: g.summary ?? '',
    start,
    end,
    allDay,
    recurrence: g.recurrence?.length ? parseRecurrence(g.recurrence, new Date(start)) : null,
    reminders: [...new Set(reminders)].sort((a, b) => a - b),
    external: { provider: 'google', id: g.id, calendarId: calGoogleId, etag: g.etag, updated: g.updated },
    createdAt: g.created ?? g.updated ?? new Date().toISOString(),
    updatedAt: g.updated ?? new Date().toISOString()
  }
  if (g.location) ev.location = g.location
  if (g.description) ev.notes = htmlToText(g.description)
  const todoId = g.extendedProperties?.private?.emberTodoId
  if (todoId) ev.todoId = todoId
  if (g.recurringEventId) {
    ev.seriesId = googleEventLocalId(calGoogleId, g.recurringEventId)
    const orig = timeToISO(g.originalStartTime)
    if (orig) ev.originalStart = orig
  }
  return ev
}

const withExdates = (master: CalendarEvent, add: Iterable<string>): CalendarEvent => {
  if (!master.recurrence) return master
  const all = new Set([...(master.recurrence.exdates ?? []), ...add])
  return { ...master, recurrence: { ...master.recurrence, exdates: [...all].sort() } }
}

export interface ApplyInput {
  cal: CalendarInfo
  items: GEvent[]
  /** default reminders of the calendar as sent with the event list */
  defaultReminders: number[]
  /** events of this calendar currently stored locally */
  local: CalendarEvent[]
  /** full sync: everything not in `items` is gone */
  full: boolean
}

/**
 * Turns a page set from events.list into a patch.
 * Changed or cancelled single occurrences are hidden in their series via `exdates`;
 * changed ones additionally exist as own events with `seriesId`/`originalStart`.
 */
export function patchFromGoogle({ cal, items, defaultReminders, local, full }: ApplyInput): DataPatch {
  const calGoogleId = cal.external!.id
  const localById = new Map(local.map((e) => [e.id, e]))
  const upserts = new Map<string, CalendarEvent>()
  const removed = new Set<string>()
  /** series id → occurrence starts to hide */
  const hidden = new Map<string, Set<string>>()
  const hide = (seriesId: string, start: string | null): void => {
    if (!start) return
    if (!hidden.has(seriesId)) hidden.set(seriesId, new Set())
    hidden.get(seriesId)!.add(start)
  }

  for (const g of items) {
    const id = googleEventLocalId(calGoogleId, g.id)
    if (g.status === 'cancelled') {
      if (g.recurringEventId) {
        hide(googleEventLocalId(calGoogleId, g.recurringEventId), timeToISO(g.originalStartTime))
        // a formerly changed occurrence that is now cancelled
        removed.add(id)
      } else {
        removed.add(id)
        // the whole series is gone, including its changed occurrences
        for (const e of local) if (e.seriesId === id) removed.add(e.id)
      }
      continue
    }
    const ev = eventFromGoogle(g, cal, defaultReminders)
    if (!ev) continue
    upserts.set(ev.id, ev)
    removed.delete(ev.id)
    if (ev.seriesId) hide(ev.seriesId, ev.originalStart ?? null)
  }

  // incremental: keep exdates the series collected earlier from single cancelled/changed occurrences
  if (!full) {
    for (const [id, ev] of upserts) {
      const before = localById.get(id)
      if (ev.recurrence && before?.recurrence?.exdates?.length)
        upserts.set(id, withExdates(ev, before.recurrence.exdates))
    }
  }

  for (const [seriesId, starts] of hidden) {
    if (removed.has(seriesId)) continue
    const master = upserts.get(seriesId) ?? localById.get(seriesId)
    if (master) upserts.set(seriesId, withExdates(master, starts))
  }

  if (full) {
    for (const e of local) if (!upserts.has(e.id)) removed.add(e.id)
  }
  for (const id of removed) upserts.delete(id)

  // only send what actually changed
  const upsert = [...upserts.values()].filter((e) => {
    const before = localById.get(e.id)
    return !before || JSON.stringify(before) !== JSON.stringify(e)
  })
  const remove = [...removed].filter((id) => localById.has(id))
  return { events: { upsert, remove } }
}
