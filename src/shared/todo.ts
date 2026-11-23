import type { Category, LocalDate, Priority, Todo } from './types'

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
    tags
  }
}
