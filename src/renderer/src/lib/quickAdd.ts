import { addDays, addWeeks } from 'date-fns'
import type { Category, LocalDate, Priority, TodoList } from '@shared/types'
import { localDate, parseTasksLine } from '@shared/todo'

export interface QuickAddResult {
  title: string
  hardDeadline?: LocalDate
  softDeadline?: LocalDate
  priority: Priority
  categoryId?: string
  /** category name typed with # that does not exist yet */
  newCategory?: string
  listId?: string
  estimateMin?: number
}

const WEEKDAYS: Record<string, number> = {
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
  sonntag: 0
}

const DATE_EXPR =
  '(heute|morgen|übermorgen|(?:nächsten?\\s+)?(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|' +
  'ende\\s+der\\s+woche|wochenende|in\\s+\\d+\\s+(?:tag(?:en)?|woche(?:n)?)|' +
  '\\d{1,2}\\.\\d{1,2}\\.(?:\\d{2,4})?|\\d{4}-\\d{2}-\\d{2})'

/** "bis Freitag" → hard, "~Freitag" / "ca. Freitag" / "etwa Freitag" → soft, plain date → hard */
const DATE_RE = new RegExp(`(^|\\s)(bis\\s+|spätestens\\s+|~\\s*|ca\\.?\\s+|etwa\\s+|weich\\s+)?${DATE_EXPR}(?=$|[\\s,;!])`, 'iu')

const SHORT_DAYS: Record<string, string> = {
  mo: 'montag',
  di: 'dienstag',
  mi: 'mittwoch',
  do: 'donnerstag',
  fr: 'freitag',
  sa: 'samstag',
  so: 'sonntag'
}

export function resolveDate(expr: string, today = new Date()): LocalDate | undefined {
  let e = expr.toLowerCase().replace(/\s+/g, ' ').trim()
  // short weekday names are only accepted in explicit date fields
  const short = e.match(/^(nächsten? )?([a-zä]{2})\.?$/u)
  if (short && SHORT_DAYS[short[2]]) e = `${short[1] ?? ''}${SHORT_DAYS[short[2]]}`
  if (e === 'heute') return localDate(today)
  if (e === 'morgen') return localDate(addDays(today, 1))
  if (e === 'übermorgen') return localDate(addDays(today, 2))
  if (e === 'ende der woche' || e === 'wochenende') {
    const diff = (7 - today.getDay()) % 7 // to Sunday
    return localDate(addDays(today, Math.max(0, e === 'wochenende' ? diff - 1 : diff - 2)))
  }
  const inN = e.match(/^in (\d+) (tag|woche)/)
  if (inN) {
    const n = Number(inN[1])
    return localDate(inN[2] === 'tag' ? addDays(today, n) : addWeeks(today, n))
  }
  const wd = e.match(/^(nächsten? )?(\w+)$/u)
  if (wd && wd[2] in WEEKDAYS) {
    let diff = (WEEKDAYS[wd[2]] - today.getDay() + 7) % 7
    if (diff === 0) diff = 7
    return localDate(addDays(today, diff))
  }
  const dm = e.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$/)
  if (dm) {
    const d = Number(dm[1])
    const m = Number(dm[2]) - 1
    let y = dm[3] ? Number(dm[3]) : today.getFullYear()
    if (y < 100) y += 2000
    let date = new Date(y, m, d)
    // "3.1." typed in December means next year
    if (!dm[3] && date < addDays(today, -1)) date = new Date(y + 1, m, d)
    if (date.getMonth() !== m) return undefined
    return localDate(date)
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(e)) return e
  return undefined
}

/**
 * Parses quick-add input such as
 * "Karte zeichnen bis Freitag ~Mittwoch #dnd @kampagnen !! 2h"
 * Obsidian Tasks syntax (📅 ⏳ ⏫ #tag) is understood too.
 */
export function parseQuickAdd(
  input: string,
  categories: Category[],
  lists: TodoList[],
  today = new Date()
): QuickAddResult {
  const res: QuickAddResult = { title: '', priority: 0 }
  let text = ` ${input} `

  // Obsidian Tasks emojis
  const tasks = parseTasksLine(`- [ ] ${input}`)
  if (tasks && (tasks.hardDeadline || tasks.softDeadline || tasks.priority)) {
    res.hardDeadline = tasks.hardDeadline
    res.softDeadline = tasks.softDeadline
    res.priority = tasks.priority
    text = text
      .replace(/(📅|⏳|🛫|➕)\s*\d{4}-\d{2}-\d{2}/gu, ' ')
      .replace(/[🔺⏫🔼🔽⏬]/gu, ' ')
  }

  // priority: ! / !! / !!!
  text = text.replace(/(^|\s)(!{1,3})(?=\s)/u, (_m, pre: string, bangs: string) => {
    res.priority = bangs.length as Priority
    return pre
  })

  // estimate: 30m, 45min, 2h, 1,5h, 1.5 std
  text = text.replace(/(^|\s)(\d+(?:[.,]\d+)?)\s?(m|min|h|std)(?=\s)/iu, (_m, pre: string, num: string, unit: string) => {
    const n = Number(num.replace(',', '.'))
    res.estimateMin = Math.round(/^(h|std)$/i.test(unit) ? n * 60 : n)
    return pre
  })

  // #category
  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/u, (_m, pre: string, tag: string) => {
    const norm = (s: string): string => s.toLowerCase().replace(/[\s_-]+/g, '')
    const hit = categories.find((c) => norm(c.name) === norm(tag))
    if (hit) res.categoryId = hit.id
    else res.newCategory = tag.replace(/[_-]+/g, ' ')
    return pre
  })

  // @list
  text = text.replace(/(^|\s)@([\p{L}\p{N}_-]+)/u, (m, pre: string, name: string) => {
    const norm = (s: string): string => s.toLowerCase().replace(/[\s_-]+/g, '')
    const hit = lists.find((l) => norm(l.name).startsWith(norm(name)))
    if (!hit) return m
    res.listId = hit.id
    return pre
  })

  // short weekdays are accepted after a deadline prefix: "bis Fr", "~Mi", "ca. Do"
  text = text.replace(
    /(^|\s)(bis\s+|spätestens\s+|~\s*|ca\.?\s+|etwa\s+|weich\s+)(mo|di|mi|do|fr|sa|so)\.?(?=$|[\s,;!])/giu,
    (_m, pre: string, prefix: string, d: string) => `${pre}${prefix}${SHORT_DAYS[d.toLowerCase()]}`
  )

  // up to two dates (one hard, one soft)
  for (let i = 0; i < 2; i++) {
    const m = text.match(DATE_RE)
    if (!m) break
    const prefix = (m[2] ?? '').trim().toLowerCase()
    const date = resolveDate(m[3], today)
    if (!date) break
    const soft = /^(~|ca|etwa|weich)/.test(prefix)
    if (soft && !res.softDeadline) res.softDeadline = date
    else if (!soft && !res.hardDeadline) res.hardDeadline = date
    else break
    text = text.replace(m[0], m[1])
  }

  res.title = text.replace(/\s+/g, ' ').trim()
  return res
}

/* ───────────── Events ───────────── */

export interface EventParse {
  title: string
  date: LocalDate
  /** "HH:mm" */
  start?: string
  end?: string
  durationMin?: number
  allDay: boolean
  calendarId?: string
}

const TIME_RE =
  /(^|\s)(um\s+|ab\s+|von\s+)?(\d{1,2})(?:[:.](\d{2}))?(\s*uhr)?(?:\s*(?:-|–|bis)\s*(\d{1,2})(?:[:.](\d{2}))?(\s*uhr)?)?(?=$|[\s,;])/iu
const DURATION_RE = /(^|\s)(\d+(?:[.,]\d+)?)\s?(h|std\.?|stunden?|min\.?|m)(?=$|[\s,;])/iu
const PLAIN_DATE_RE = new RegExp(`(^|\s)(?:am\s+)?${DATE_EXPR}(?=$|[\s,;!])`, 'iu')

const hhmm = (h: number, m: number): string => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

function findTime(text: string): { start: string; end?: string; match: string; lead: string } | null {
  const m = text.match(TIME_RE)
  if (!m) return null
  const [, lead, prefix, h1, m1, uhr1, h2, m2, uhr2] = m
  // a bare number is not a time ("Session 12"); require um/ab/von, minutes or "Uhr"
  if (!prefix && !m1 && !uhr1 && !uhr2 && !(h2 && (m2 || uhr2))) return null
  const sh = Number(h1)
  const sm = Number(m1 ?? 0)
  if (sh > 23 || sm > 59) return null
  let end: string | undefined
  if (h2) {
    const eh = Number(h2)
    const em = Number(m2 ?? 0)
    if (eh <= 24 && em <= 59) end = hhmm(eh % 24, em)
  }
  return { start: hhmm(sh, sm), end, match: m[0], lead }
}

/** true when the text names a clock time or "ganztägig" → create an event instead of a ToDo */
export function looksLikeEvent(input: string): boolean {
  return !!findTime(` ${input} `) || /(^|\s)ganztägig(?=$|\s)/iu.test(input)
}

/** "Zahnarzt Do 14 Uhr 1h #privat", "Session 19-23 Uhr am 28.11.", "Urlaub Montag ganztägig" */
export function parseEventInput(
  input: string,
  calendars: { id: string; name: string }[],
  today = new Date()
): EventParse {
  let text = ` ${input} `
  const res: EventParse = { title: '', date: localDate(today), allDay: false }

  text = text.replace(/(^|\s)ganztägig(?=$|\s)/iu, (_m, pre: string) => {
    res.allDay = true
    return pre
  })

  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/u, (m, pre: string, tag: string) => {
    const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
    const hit = calendars.find((c) => norm(c.name).startsWith(norm(tag)))
    if (!hit) return m
    res.calendarId = hit.id
    return pre
  })

  const d = text.match(PLAIN_DATE_RE)
  if (d) {
    const date = resolveDate(d[2])
    if (date) {
      res.date = date
      text = text.replace(d[0], d[1])
    }
  } else {
    // short weekday ("Do 14 Uhr") is accepted when followed by a time
    const sd = text.match(/(^|\s)(mo|di|mi|do|fr|sa|so)\.?(?=\s+(?:um\s+)?\d)/iu)
    const date = sd ? resolveDate(sd[2], today) : undefined
    if (sd && date) {
      res.date = date
      text = text.replace(sd[0], sd[1])
    }
  }

  const t = findTime(text)
  if (t && !res.allDay) {
    res.start = t.start
    res.end = t.end
    text = text.replace(t.match, t.lead)
  }

  text = text.replace(DURATION_RE, (_m, pre: string, num: string, unit: string) => {
    const n = Number(num.replace(',', '.'))
    res.durationMin = Math.round(/^(h|std|stunde)/i.test(unit) ? n * 60 : n)
    return pre
  })

  res.title = text.replace(/\s+/g, ' ').trim()
  return res
}
