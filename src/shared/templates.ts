import type { CalendarEvent, EventTemplate } from './types'

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')

/** what to type after "/" in the quick entry, e.g. "DnD-Session" → "dndsession" */
export const templateKey = (t: Pick<EventTemplate, 'name'>): string => norm(t.name)

/**
 * Template for a typed "/token": the whole name or one of its words starts with it,
 * so "/session" and "/dnd" both find "DnD-Session". Exact keys win.
 */
export function findTemplate(token: string, templates: EventTemplate[]): EventTemplate | undefined {
  const k = norm(token)
  if (!k) return undefined
  return (
    templates.find((t) => templateKey(t) === k) ??
    templates.find((t) => templateKey(t).startsWith(k)) ??
    templates.find((t) => t.name.split(/[^\p{L}\p{N}]+/u).some((w) => norm(w).startsWith(k)))
  )
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** template from an existing event: its title, calendar, time of day, length, place, notes and reminders */
export function templateFromEvent(ev: CalendarEvent, id: string): EventTemplate {
  const s = new Date(ev.start)
  const minutes = Math.max(15, Math.round((new Date(ev.end).getTime() - s.getTime()) / 60000))
  const t: EventTemplate = {
    id,
    name: ev.title.trim() || 'Vorlage',
    title: ev.title.trim(),
    calendarId: ev.calendarId,
    allDay: ev.allDay,
    durationMin: ev.allDay ? 1440 : minutes,
    reminders: [...ev.reminders]
  }
  if (!ev.allDay) t.startTime = `${pad(s.getHours())}:${pad(s.getMinutes())}`
  if (ev.location) t.location = ev.location
  if (ev.notes) t.notes = ev.notes
  return t
}

/* ── "next session" placeholder ── */

export const PLACEHOLDER_PREFIX = 'ph:'
export const isPlaceholderId = (id: string): boolean => id.startsWith(PLACEHOLDER_PREFIX)
export const placeholderTemplateId = (id: string): string => id.slice(PLACEHOLDER_PREFIX.length)

const dayOnly = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const plusDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const weekdayOf = (d: Date): number => (d.getDay() + 6) % 7
const fromKey = (k: string): Date => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** events that count as sessions of this template (cancelled or deleted ones don't) */
export function templateSessions(t: Pick<EventTemplate, 'id'>, events: CalendarEvent[]): CalendarEvent[] {
  return events.filter((e) => e.templateId === t.id && !e.deletedAt && e.discord?.status !== 4)
}

/**
 * Day and time of the next session of a template with a rhythm: one step after the last real session,
 * never before today or `skipUntil`. Only one placeholder per template, not a whole series.
 */
export function nextPlaceholder(
  t: EventTemplate,
  events: CalendarEvent[],
  now = new Date()
): { start: Date; end: Date } | null {
  const r = t.rhythm
  if (!r) return null
  const every = Math.min(4, Math.max(1, Math.round(r.everyWeeks || 1)))
  const weekday = Math.min(6, Math.max(0, Math.round(r.weekday)))

  let min = dayOnly(now)
  if (t.skipUntil) {
    const skip = fromKey(t.skipUntil)
    if (skip > min) min = skip
  }

  let day: Date
  const last = templateSessions(t, events)
    .map((e) => new Date(e.start))
    .sort((a, b) => b.getTime() - a.getTime())[0]
  if (last) {
    const lastDay = dayOnly(last)
    const afterLast = plusDays(lastDay, 1)
    if (afterLast > min) min = afterLast
    // the rhythm's weekday in the week of the last session, then whole steps from there
    day = plusDays(lastDay, weekday - weekdayOf(lastDay))
    while (day < min) day = plusDays(day, 7 * every)
  } else {
    day = plusDays(min, (weekday - weekdayOf(min) + 7) % 7)
  }

  if (t.allDay) {
    return { start: day, end: plusDays(day, Math.max(1, Math.round(t.durationMin / 1440))) }
  }
  const [h, m] = (t.startTime ?? '19:00').split(':').map(Number)
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 0, m || 0)
  return { start, end: new Date(start.getTime() + t.durationMin * 60000) }
}

/** the placeholder as a display-only event (never stored or synced) */
export function placeholderEvent(t: EventTemplate, events: CalendarEvent[], now = new Date()): CalendarEvent | null {
  const next = nextPlaceholder(t, events, now)
  if (!next) return null
  return {
    id: PLACEHOLDER_PREFIX + t.id,
    calendarId: t.calendarId,
    title: `${t.name} – noch planen`,
    start: next.start.toISOString(),
    end: next.end.toISOString(),
    allDay: t.allDay,
    reminders: [],
    recurrence: null,
    templateId: t.id,
    createdAt: next.start.toISOString(),
    updatedAt: next.start.toISOString()
  }
}

const keyOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** "fällt aus": the placeholder moves on to the step after this one */
export function skipPlaceholder(t: EventTemplate, events: CalendarEvent[], now = new Date()): EventTemplate {
  const next = nextPlaceholder(t, events, now)
  if (!next) return t
  return { ...t, skipUntil: keyOf(plusDays(dayOnly(next.start), 1)) }
}
