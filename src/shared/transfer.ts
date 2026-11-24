import type { AppData, CalendarEvent, Category, LocalDate, Priority, Todo } from './types'
import { localDate, parseTasksLine, toTasksLine } from './todo'

/* ───────────── JSON ───────────── */

/** Full data export. Readable by `parseDataJson`. */
export function toDataJson(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

/** Validates a JSON export (or a backup); throws a readable German error otherwise. */
export function parseDataJson(text: string): AppData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  const d = raw as Partial<AppData> | null
  if (!d || typeof d !== 'object' || !Array.isArray(d.events) || !Array.isArray(d.todos)) {
    throw new Error('Die Datei ist keine Ember-Planner-Sicherung.')
  }
  return d as AppData
}

/* ───────────── Markdown (Obsidian Tasks) ───────────── */

/** All ToDos grouped by list, one Tasks line each; subtasks indented. */
export function toTasksMarkdown(data: AppData, today: LocalDate = localDate(new Date())): string {
  const out = [`# Ember Planner – ToDos`, '', `Exportiert am ${today}`, '']
  for (const list of data.lists) {
    const todos = data.todos.filter((t) => t.listId === list.id)
    if (!todos.length) continue
    out.push(`## ${list.name}`, '')
    for (const t of todos) {
      out.push(toTasksLine(t, data.categories))
      for (const s of t.subtasks) out.push(`    - [${s.done ? 'x' : ' '}] ${s.title}`)
    }
    out.push('')
  }
  return out.join('\n')
}

export type ImportedTodo = Pick<Todo, 'title' | 'priority' | 'done' | 'subtasks'> &
  Partial<Pick<Todo, 'hardDeadline' | 'softDeadline' | 'categoryId' | 'doneAt' | 'recurrence'>>

/**
 * Reads every Tasks checkbox line of a Markdown file. Indented lines below a task
 * become its subtasks; the first #tag that matches a category sets the category.
 */
export function parseTasksMarkdown(text: string, categories: Category[]): ImportedTodo[] {
  const norm = (s: string): string => s.toLowerCase().replace(/[\s_-]+/g, '')
  const out: ImportedTodo[] = []
  for (const line of text.split(/\r?\n/)) {
    const p = parseTasksLine(line)
    if (!p || !p.title) continue
    const indented = /^(\s{2,}|\t)/.test(line)
    const parent = out[out.length - 1]
    if (indented && parent) {
      parent.subtasks.push({ id: `${out.length}-${parent.subtasks.length}`, title: p.title, done: p.done })
      continue
    }
    const cat = categories.find((c) => p.tags.some((tag) => norm(tag) === norm(c.name)))
    out.push({
      title: p.title,
      priority: p.priority as Priority,
      done: p.done,
      subtasks: [],
      hardDeadline: p.hardDeadline,
      softDeadline: p.softDeadline,
      categoryId: cat?.id,
      recurrence: p.recurrence,
      doneAt: p.done && p.doneDate ? new Date(`${p.doneDate}T12:00:00`).toISOString() : undefined
    })
  }
  return out
}

/* ───────────── iCalendar (RFC 5545) ───────────── */

const pad = (n: number): string => String(n).padStart(2, '0')
const icsDate = (d: Date): string => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const icsUtc = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

export const icsEscape = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Folds a content line at 75 octets (continuation lines start with a space). */
export function icsFold(line: string): string {
  const enc = new TextEncoder()
  const parts: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + n > limit) {
      parts.push(cur)
      cur = ''
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

function rrule(ev: CalendarEvent): string[] {
  const r = ev.recurrence
  if (!r) return []
  const parts = [`FREQ=${r.freq.toUpperCase()}`]
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.freq === 'weekly' && r.byWeekday?.length) parts.push(`BYDAY=${r.byWeekday.map((d) => BYDAY[d]).join(',')}`)
  if (r.count) parts.push(`COUNT=${r.count}`)
  else if (r.until) {
    const [y, m, d] = r.until.split('-').map(Number)
    parts.push(`UNTIL=${ev.allDay ? r.until.replace(/-/g, '') : icsUtc(new Date(y, m - 1, d, 23, 59, 59))}`)
  }
  const lines = [`RRULE:${parts.join(';')}`]
  for (const ex of r.exdates ?? []) {
    lines.push(ev.allDay ? `EXDATE;VALUE=DATE:${icsDate(new Date(ex))}` : `EXDATE:${icsUtc(new Date(ex))}`)
  }
  return lines
}

/** All events (or those of the given calendars) as an .ics file. */
export function toICS(data: AppData, calendarIds?: string[], now = new Date()): string {
  const cals = new Map(data.calendars.map((c) => [c.id, c]))
  const events = data.events.filter((e) => !calendarIds || calendarIds.includes(e.calendarId))
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ember Planner//DE',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Ember Planner'
  ]
  for (const ev of events) {
    const start = new Date(ev.start)
    const end = new Date(ev.end)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@ember-planner`,
      `DTSTAMP:${icsUtc(now)}`,
      ev.allDay ? `DTSTART;VALUE=DATE:${icsDate(start)}` : `DTSTART:${icsUtc(start)}`,
      ev.allDay ? `DTEND;VALUE=DATE:${icsDate(end)}` : `DTEND:${icsUtc(end)}`,
      `SUMMARY:${icsEscape(ev.title || '(Ohne Titel)')}`
    )
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`)
    if (ev.notes) lines.push(`DESCRIPTION:${icsEscape(ev.notes)}`)
    const cal = cals.get(ev.calendarId)
    if (cal) lines.push(`CATEGORIES:${icsEscape(cal.name)}`)
    if (ev.updatedAt) lines.push(`LAST-MODIFIED:${icsUtc(new Date(ev.updatedAt))}`)
    lines.push(...rrule(ev))
    for (const min of ev.reminders) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(ev.title || 'Erinnerung')}`,
        min === 0 ? 'TRIGGER:PT0M' : `TRIGGER:-PT${min}M`,
        'END:VALARM'
      )
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(icsFold).join('\r\n') + '\r\n'
}
