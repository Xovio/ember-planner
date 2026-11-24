import type { ISODateTime, LocalDate, Recurrence, RecurrenceFreq } from './types'

/**
 * Small helpers for the iCalendar bits Google uses in `event.recurrence`
 * (RRULE, EXDATE) and for converting wall-clock times in a named time zone.
 */

const pad = (n: number): string => String(n).padStart(2, '0')

export const toLocalDate = (d: Date): LocalDate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** local midnight of a "yyyy-MM-dd" day as ISO instant */
export const localMidnightISO = (day: string): ISODateTime => new Date(`${day}T00:00:00`).toISOString()

/** offset of `tz` from UTC at instant `at`, in minutes (Berlin summer: +120) */
function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(at)
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - at.getTime()) / 60_000)
}

/** instant of a wall-clock time in `tz` (falls back to the machine zone for unknown zones) */
export function zonedToInstant(y: number, mo: number, d: number, h: number, mi: number, s: number, tz?: string): Date {
  if (!tz) return new Date(y, mo - 1, d, h, mi, s)
  try {
    const guess = Date.UTC(y, mo - 1, d, h, mi, s)
    // two passes settle the offset around DST changes
    let t = guess - tzOffsetMinutes(new Date(guess), tz) * 60_000
    t = guess - tzOffsetMinutes(new Date(t), tz) * 60_000
    return new Date(t)
  } catch {
    return new Date(y, mo - 1, d, h, mi, s)
  }
}

/**
 * Parses an iCalendar DATE or DATE-TIME value.
 * "20261124" (date → local midnight), "20261124T090000Z" (UTC), "20261124T090000" (in `tz` or local).
 */
export function parseIcalDate(value: string, tz?: string): { date: Date; dateOnly: boolean } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (h === undefined) return { date: new Date(+y, +mo - 1, +d), dateOnly: true }
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), dateOnly: false }
  return { date: zonedToInstant(+y, +mo, +d, +h, +mi, +s, tz), dateOnly: false }
}

/** "EXDATE;TZID=Europe/Berlin:20261124T090000,20261201T090000" → instants as ISO */
export function parseExdateLine(line: string): ISODateTime[] {
  const colon = line.indexOf(':')
  if (colon < 0) return []
  const params = line.slice(0, colon).split(';').slice(1)
  const tz = params.find((p) => p.toUpperCase().startsWith('TZID='))?.slice(5)
  return line
    .slice(colon + 1)
    .split(',')
    .map((v) => parseIcalDate(v, tz)?.date.toISOString())
    .filter((v): v is string => !!v)
}

const FREQS: Record<string, RecurrenceFreq> = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
}
const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

/** Mon=0 … Sun=6 */
const weekdayOf = (d: Date): number => (d.getDay() + 6) % 7

/**
 * Converts Google's recurrence lines to our model. Rules our editor can express become plain fields;
 * anything else keeps the original RRULE in `rrule` (expanded with the rrule library).
 * Returns null for lines without an RRULE (e.g. RDATE only).
 */
export function parseRecurrence(lines: string[], start: Date): Recurrence | null {
  const ruleLine = lines.find((l) => l.toUpperCase().startsWith('RRULE:'))
  if (!ruleLine) return null
  const rule = ruleLine.slice(6)
  const parts = new Map(
    rule.split(';').map((p) => {
      const [k, v = ''] = p.split('=')
      return [k.toUpperCase(), v] as const
    })
  )
  const freq = FREQS[parts.get('FREQ') ?? '']
  const exdates = lines.filter((l) => l.toUpperCase().startsWith('EXDATE')).flatMap(parseExdateLine)

  const rec: Recurrence = { freq: freq ?? 'daily', interval: Math.max(1, Number(parts.get('INTERVAL') ?? 1) || 1) }
  const count = Number(parts.get('COUNT'))
  if (count > 0) rec.count = count
  const until = parts.get('UNTIL')
  if (until) {
    const u = parseIcalDate(until)
    if (u) rec.until = toLocalDate(u.date)
  }
  if (exdates.length) rec.exdates = exdates

  // what our own expansion understands
  let simple =
    !!freq && !parts.has('BYSETPOS') && !parts.has('BYYEARDAY') && !parts.has('BYWEEKNO') && !parts.has('BYHOUR')
  const byDay = parts.get('BYDAY')
  if (simple && byDay) {
    const days = byDay.split(',')
    if (freq === 'weekly' && days.every((d) => WEEKDAYS.includes(d))) {
      rec.byWeekday = days.map((d) => WEEKDAYS.indexOf(d))
    } else simple = false
  }
  const byMonthDay = parts.get('BYMONTHDAY')
  if (simple && byMonthDay && !(freq !== 'daily' && freq !== 'weekly' && byMonthDay === String(start.getDate())))
    simple = false
  const byMonth = parts.get('BYMONTH')
  if (simple && byMonth && !(freq === 'yearly' && byMonth === String(start.getMonth() + 1))) simple = false
  const wkst = parts.get('WKST')
  if (simple && wkst && wkst !== 'MO' && rec.byWeekday && rec.interval > 1) simple = false
  // a weekly rule without BYDAY repeats on the start weekday – same as ours
  if (simple && rec.byWeekday?.length === 1 && rec.byWeekday[0] === weekdayOf(start)) delete rec.byWeekday

  if (!simple) rec.rrule = rule
  return rec
}
