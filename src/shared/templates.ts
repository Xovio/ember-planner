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
