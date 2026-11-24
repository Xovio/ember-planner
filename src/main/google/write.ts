import { createHash } from 'crypto'
import { toLocalDate } from '@shared/ical'
import type { CalendarEvent, Recurrence } from '@shared/types'

/** parts of an event we send separately, so a PATCH only touches what changed locally */
export type GField = 'summary' | 'location' | 'description' | 'time' | 'recurrence' | 'reminders' | 'todo'
export const ALL_FIELDS: GField[] = ['summary', 'location', 'description', 'time', 'recurrence', 'reminders', 'todo']

/** Google allows at most 5 reminder overrides per event */
const MAX_REMINDERS = 5

/**
 * Google event id for an event created in the app. Google lets clients choose ids
 * (base32hex, 5–1024 chars); a hash of the local id keeps retries idempotent.
 */
export const googleIdFor = (localId: string): string => createHash('sha1').update(localId).digest('hex')

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** which fields differ between the last synced version and the current one */
export function changedFields(base: CalendarEvent, cur: CalendarEvent): GField[] {
  const out: GField[] = []
  if (base.title !== cur.title) out.push('summary')
  if ((base.location ?? '') !== (cur.location ?? '')) out.push('location')
  if ((base.notes ?? '') !== (cur.notes ?? '')) out.push('description')
  if (base.start !== cur.start || base.end !== cur.end || base.allDay !== cur.allDay) out.push('time')
  if (!same(base.recurrence, cur.recurrence)) out.push('recurrence')
  if (!same([...base.reminders].sort(), [...cur.reminders].sort())) out.push('reminders')
  if ((base.todoId ?? '') !== (cur.todoId ?? '')) out.push('todo')
  return out
}

const pad = (n: number): string => String(n).padStart(2, '0')

/**
 * Google id of one occurrence of a series: `<seriesId>_<original start>`, the start in UTC
 * (`20261124T090000Z`) or, for all-day series, as a date (`20261124`).
 */
export function instanceId(seriesGoogleId: string, originalStart: string, allDay: boolean): string {
  const d = new Date(originalStart)
  return `${seriesGoogleId}_${allDay ? icalDate(d) : icalUtc(d)}`
}
/** wall-clock time of an instant in the machine zone, iCalendar style */
const icalLocal = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
const icalUtc = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const icalDate = (d: Date): string => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' } as const

/**
 * RRULE + EXDATE lines for Google.
 * `skip`: occurrence starts that have their own changed event at Google – an EXDATE for them would delete that change.
 */
export function recurrenceLines(rec: Recurrence, allDay: boolean, tz: string, skip: Set<string> = new Set()): string[] {
  let rule: string
  if (rec.rrule) {
    rule = rec.rrule
  } else {
    const parts = [`FREQ=${FREQ[rec.freq]}`]
    if (rec.interval > 1) parts.push(`INTERVAL=${rec.interval}`)
    if (rec.freq === 'weekly' && rec.byWeekday?.length)
      parts.push(`BYDAY=${rec.byWeekday.map((d) => WEEKDAYS[d]).join(',')}`)
    if (rec.count) parts.push(`COUNT=${rec.count}`)
    else if (rec.until) {
      // our "until" is an inclusive local day; Google wants UTC for timed series
      const endOfDay = new Date(`${rec.until}T23:59:59`)
      parts.push(`UNTIL=${allDay ? icalDate(endOfDay) : icalUtc(endOfDay)}`)
    }
    rule = parts.join(';')
  }
  const lines = [`RRULE:${rule}`]
  const ex = (rec.exdates ?? []).filter((d) => !skip.has(d)).map((d) => new Date(d))
  if (ex.length) {
    lines.push(
      allDay ? `EXDATE;VALUE=DATE:${ex.map(icalDate).join(',')}` : `EXDATE;TZID=${tz}:${ex.map(icalLocal).join(',')}`
    )
  }
  return lines
}

export interface BodyContext {
  /** IANA zone of this machine, e.g. Europe/Berlin */
  tz: string
  /** original starts of occurrences changed separately (see recurrenceLines) */
  overrideStarts?: Set<string>
  /** PATCH: clear fields explicitly (null) instead of leaving them out */
  patch?: boolean
}

function timeOf(iso: string, allDay: boolean, ctx: BodyContext): Record<string, unknown> {
  const d = new Date(iso)
  if (allDay) return ctx.patch ? { date: toLocalDate(d), dateTime: null, timeZone: null } : { date: toLocalDate(d) }
  return ctx.patch
    ? { dateTime: d.toISOString(), timeZone: ctx.tz, date: null }
    : { dateTime: d.toISOString(), timeZone: ctx.tz }
}

/** Google event resource (or PATCH body) for the given fields */
export function googleBody(ev: CalendarEvent, fields: GField[], ctx: BodyContext): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  const clear = ctx.patch ? null : undefined
  for (const f of fields) {
    switch (f) {
      case 'summary':
        body.summary = ev.title
        break
      case 'location':
        body.location = ev.location || clear
        break
      case 'description':
        body.description = ev.notes || clear
        break
      case 'time':
        body.start = timeOf(ev.start, ev.allDay, ctx)
        body.end = timeOf(ev.end, ev.allDay, ctx)
        break
      case 'recurrence':
        // single changed occurrences can't carry a rule of their own
        if (ev.seriesId) break
        body.recurrence = ev.recurrence
          ? recurrenceLines(ev.recurrence, ev.allDay, ctx.tz, ctx.overrideStarts)
          : clear === null
            ? []
            : undefined
        break
      case 'reminders':
        body.reminders = {
          useDefault: false,
          overrides: [...new Set(ev.reminders)]
            .sort((a, b) => a - b)
            .slice(0, MAX_REMINDERS)
            .map((minutes) => ({ method: 'popup', minutes }))
        }
        break
      case 'todo':
        if (ev.todoId || ctx.patch) body.extendedProperties = { private: { emberTodoId: ev.todoId ?? null } }
        break
    }
  }
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k]
  return body
}
