import type { Category, LocalDate, Priority, Recurrence, RecurrenceFreq, Todo } from './types'

/* ───────────── Deadlines ───────────── */

export type DeadlineStatus =
  | 'overdue' // hard deadline passed
  | 'soft-missed' // soft deadline passed, hard still ahead (or none)
  | 'today' // earliest deadline is today
  | 'soon' // within the next 3 days
  | 'later'
  | 'none'

const pad = (n: number): string => String(n).padStart(2, '0')
export const localDate = (d: Date): LocalDate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseLocalDate = (s: LocalDate): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const daysBetween = (a: LocalDate, b: LocalDate): number =>
  Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86400000)

/** earliest of soft/hard deadline */
export function effectiveDeadline(t: Todo): LocalDate | undefined {
  const ds = [t.softDeadline, t.hardDeadline].filter(Boolean) as LocalDate[]
  return ds.sort()[0]
}

export function deadlineStatus(t: Todo, today: LocalDate = localDate(new Date())): DeadlineStatus {
  if (t.hardDeadline && t.hardDeadline < today) return 'overdue'
  if (t.softDeadline && t.softDeadline < today) return 'soft-missed'
  const eff = effectiveDeadline(t)
  if (!eff) return 'none'
  if (eff === today) return 'today'
  return daysBetween(today, eff) <= 3 ? 'soon' : 'later'
}

const STATUS_RANK: Record<DeadlineStatus, number> = {
  overdue: 0,
  'soft-missed': 1,
  today: 2,
  soon: 3,
  later: 4,
  none: 5
}

/** open first; then by earliest deadline; hard before soft; priority; creation */
export function compareTodos(a: Todo, b: Todo): number {
  if (a.done !== b.done) return a.done ? 1 : -1
  if (a.done && b.done) return (b.doneAt ?? '').localeCompare(a.doneAt ?? '')
  const ea = effectiveDeadline(a)
  const eb = effectiveDeadline(b)
  if (ea && eb && ea !== eb) return ea < eb ? -1 : 1
  if (ea && !eb) return -1
  if (!ea && eb) return 1
  if (ea && eb) {
    const ha = a.hardDeadline === ea ? 0 : 1
    const hb = b.hardDeadline === eb ? 0 : 1
    if (ha !== hb) return ha - hb
  }
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.createdAt.localeCompare(b.createdAt)
}

export function statusRank(t: Todo): number {
  return STATUS_RANK[deadlineStatus(t)]
}

/* ───────────── Recurring ToDos ───────────── */

const addDaysL = (d: LocalDate, n: number): LocalDate => {
  const x = parseLocalDate(d)
  return localDate(new Date(x.getFullYear(), x.getMonth(), x.getDate() + n))
}
const addMonthsL = (d: LocalDate, n: number): LocalDate => {
  const x = parseLocalDate(d)
  const target = new Date(x.getFullYear(), x.getMonth() + n, 1)
  // clamp to the month's last day (31 Jan + 1 month = 28/29 Feb)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return localDate(new Date(target.getFullYear(), target.getMonth(), Math.min(x.getDate(), last)))
}
/** Mon = 0 … Sun = 6 */
const weekdayOf = (d: LocalDate): number => (parseLocalDate(d).getDay() + 6) % 7

/** the date `steps` repetitions after `d` (simple rules without weekday list) */
function stepBy(d: LocalDate, r: Recurrence, steps: number): LocalDate {
  const n = Math.max(1, r.interval || 1) * steps
  switch (r.freq) {
    case 'daily':
      return addDaysL(d, n)
    case 'weekly':
      return addDaysL(d, 7 * n)
    case 'monthly':
      return addMonthsL(d, n)
    case 'yearly':
      return addMonthsL(d, 12 * n)
  }
}

/** next matching day after `d` for weekly rules with a weekday list, honouring the week interval */
function nextWeekday(d: LocalDate, r: Recurrence, anchor: LocalDate): LocalDate {
  const days = new Set(r.byWeekday)
  const interval = Math.max(1, r.interval || 1)
  const anchorWeek = addDaysL(anchor, -weekdayOf(anchor))
  for (let i = 1; i < 7 * interval * 2 + 7; i++) {
    const c = addDaysL(d, i)
    const week = Math.round(daysBetween(anchorWeek, addDaysL(c, -weekdayOf(c))) / 7)
    if (week % interval === 0 && days.has(weekdayOf(c))) return c
  }
  return addDaysL(d, 7 * interval)
}

/**
 * Deadlines for the next instance of a recurring ToDo that is being completed `today`.
 * The series moves on from its earliest deadline (or from today if it has none) until it lies in the future;
 * both deadlines keep their distance. Returns null when the series has ended.
 */
export function nextRecurrence(
  t: Todo,
  today: LocalDate = localDate(new Date())
): Pick<Todo, 'hardDeadline' | 'softDeadline' | 'recurrence'> | null {
  const r = t.recurrence
  if (!r) return null
  if (r.count !== undefined && r.count <= 1) return null
  const anchor = effectiveDeadline(t) ?? today
  const weekdays = r.freq === 'weekly' && r.byWeekday?.length

  let next = anchor
  let steps = 0
  do {
    steps++
    next = weekdays ? nextWeekday(next, r, anchor) : stepBy(anchor, r, steps)
  } while (next <= today && steps < 5000)
  if (r.until && next > r.until) return null

  const shift = (d?: LocalDate): LocalDate | undefined => {
    if (!d) return undefined
    return weekdays ? addDaysL(d, daysBetween(anchor, next)) : stepBy(d, r, steps)
  }
  const hasDeadline = !!(t.hardDeadline || t.softDeadline)
  return {
    hardDeadline: shift(t.hardDeadline),
    // without deadlines the next instance gets the new date as its wish day
    softDeadline: hasDeadline ? shift(t.softDeadline) : next,
    recurrence: r.count !== undefined ? { ...r, count: r.count - 1 } : r
  }
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const UNIT: Record<RecurrenceFreq, string> = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }

/** Obsidian Tasks wording, e.g. "every 2 weeks on Monday, Thursday" */
export function recurrenceToTasks(r: Recurrence): string {
  const n = Math.max(1, r.interval || 1)
  let s = n === 1 ? `every ${UNIT[r.freq]}` : `every ${n} ${UNIT[r.freq]}s`
  if (r.freq === 'weekly' && r.byWeekday?.length) s += ` on ${r.byWeekday.map((d) => DAY_NAMES[d]).join(', ')}`
  if (r.until) s += ` until ${r.until}`
  return s
}

export function recurrenceFromTasks(text: string): Recurrence | null {
  const m = text.trim().toLowerCase().match(/^every\s+(?:(\d+)\s+)?(day|week|month|year)s?(?:\s+on\s+([a-z, ]+?))?(?:\s+until\s+(\d{4}-\d{2}-\d{2}))?$/)
  if (!m) return null
  const freq = (Object.keys(UNIT) as RecurrenceFreq[]).find((f) => UNIT[f] === m[2])!
  const byWeekday = m[3]
    ? m[3]
        .split(/[\s,]+/)
        .map((d) => DAY_NAMES.findIndex((n) => n.toLowerCase() === d))
        .filter((i) => i >= 0)
    : undefined
  return {
    freq,
    interval: m[1] ? Number(m[1]) : 1,
    ...(freq === 'weekly' && byWeekday?.length ? { byWeekday } : {}),
    ...(m[4] ? { until: m[4] } : {})
  }
}

const DE_UNIT: Record<RecurrenceFreq, [string, string]> = {
  daily: ['Täglich', 'Tage'],
  weekly: ['Wöchentlich', 'Wochen'],
  monthly: ['Monatlich', 'Monate'],
  yearly: ['Jährlich', 'Jahre']
}
const DE_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** "Wöchentlich (Mo, Do)", "Alle 2 Wochen" */
export function recurrenceLabel(r: Recurrence): string {
  const n = Math.max(1, r.interval || 1)
  let s = n === 1 ? DE_UNIT[r.freq][0] : `Alle ${n} ${DE_UNIT[r.freq][1]}`
  if (r.freq === 'weekly' && r.byWeekday?.length) s += ` (${r.byWeekday.map((d) => DE_DAYS[d]).join(', ')})`
  return s
}

/* ───────────── Obsidian Tasks format ───────────── */

const PRIO_EMOJI: Record<Priority, string> = { 0: '', 1: '🔽', 2: '🔼', 3: '⏫' }

const slug = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_/-]/gu, '')

/** `- [ ] Titel #kategorie ⏫ ⏳ 2026-11-27 📅 2026-11-30` */
export function toTasksLine(t: Todo, categories: Category[] = []): string {
  const cat = categories.find((c) => c.id === t.categoryId)
  const parts = [`- [${t.done ? 'x' : ' '}]`, t.title.trim()]
  if (cat) parts.push(`#${slug(cat.name)}`)
  if (PRIO_EMOJI[t.priority]) parts.push(PRIO_EMOJI[t.priority])
  if (t.recurrence) parts.push(`🔁 ${recurrenceToTasks(t.recurrence)}`)
  if (t.softDeadline) parts.push(`⏳ ${t.softDeadline}`)
  if (t.hardDeadline) parts.push(`📅 ${t.hardDeadline}`)
  if (t.done && t.doneAt) parts.push(`✅ ${localDate(new Date(t.doneAt))}`)
  return parts.join(' ')
}

export interface ParsedTasksLine {
  done: boolean
  title: string
  priority: Priority
  softDeadline?: LocalDate
  hardDeadline?: LocalDate
  doneDate?: LocalDate
  recurrence?: Recurrence
  tags: string[]
}

/** Parses a single Obsidian Tasks checkbox line; returns null if it is not one. */
export function parseTasksLine(line: string): ParsedTasksLine | null {
  const m = line.match(/^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/)
  if (!m) return null
  let rest = m[2]
  const take = (re: RegExp): string | undefined => {
    const hit = rest.match(re)
    if (!hit) return undefined
    rest = rest.replace(re, ' ')
    return hit[1]
  }
  const rec = take(/🔁\s*(every[^📅⏳✅🛫➕⏫🔼🔽⏬🔺#]*)/u)
  const hardDeadline = take(/📅\s*(\d{4}-\d{2}-\d{2})/u)
  const softDeadline = take(/⏳\s*(\d{4}-\d{2}-\d{2})/u)
  const doneDate = take(/✅\s*(\d{4}-\d{2}-\d{2})/u)
  take(/🛫\s*(\d{4}-\d{2}-\d{2})/u)
  take(/➕\s*(\d{4}-\d{2}-\d{2})/u)
  let priority: Priority = 0
  if (/[🔺⏫]/u.test(rest)) priority = 3
  else if (/🔼/u.test(rest)) priority = 2
  else if (/🔽|⏬/u.test(rest)) priority = 1
  rest = rest.replace(/[🔺⏫🔼🔽⏬]/gu, ' ')
  const tags: string[] = []
  rest = rest.replace(/(^|\s)#([\p{L}\p{N}_/-]+)/gu, (_s, pre: string, tag: string) => {
    tags.push(tag)
    return pre
  })
  return {
    done: m[1].toLowerCase() === 'x',
    title: rest.replace(/\s+/g, ' ').trim(),
    priority,
    softDeadline,
    hardDeadline,
    doneDate,
    ...(rec && recurrenceFromTasks(rec) ? { recurrence: recurrenceFromTasks(rec)! } : {}),
    tags
  }
}
