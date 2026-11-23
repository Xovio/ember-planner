import {
  addDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { de } from 'date-fns/locale'

export const WEEK = { weekStartsOn: 1 as const, locale: de }

export const fmt = (d: Date, pattern: string): string => format(d, pattern, { locale: de })

export const toLocalDate = (d: Date): string => format(d, 'yyyy-MM-dd')
export const toLocalTime = (d: Date): string => format(d, 'HH:mm')

/** combine "yyyy-MM-dd" and "HH:mm" in local time */
export function fromLocal(date: string, time = '00:00'): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0)
}

export function daysOfRange(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i))
}

export function monthGridRange(cursor: Date): { start: Date; end: Date; days: Date[] } {
  const start = startOfWeek(startOfMonth(cursor), WEEK)
  const end = endOfWeek(endOfMonth(cursor), WEEK)
  const days: Date[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d)
  // always 6 rows so the grid height stays stable
  while (days.length < 42) days.push(addDays(days[days.length - 1], 1))
  return { start, end: addDays(days[days.length - 1], 1), days }
}

export function minutesSinceMidnight(d: Date): number {
  return differenceInMinutes(d, startOfDay(d))
}

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function snap(min: number, step = 15): number {
  return Math.round(min / step) * step
}

export function greeting(d = new Date()): string {
  const h = d.getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Guten Tag'
  if (h < 22) return 'Guten Abend'
  return 'Gute Nacht'
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} Min.`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`
}

export function formatCountdown(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  if (min < 1) return 'jetzt'
  if (min < 60) return `in ${min} Min.`
  const h = Math.floor(min / 60)
  if (h < 24) return `in ${h} Std. ${min % 60 ? `${min % 60} Min.` : ''}`.trim()
  const d = Math.round(h / 24)
  return d === 1 ? 'morgen' : `in ${d} Tagen`
}

export function reminderLabel(min: number): string {
  if (min === 0) return 'Zum Beginn'
  if (min < 60) return `${min} Min. vorher`
  if (min < 1440) {
    const h = min / 60
    return h === 1 ? '1 Std. vorher' : `${h} Std. vorher`
  }
  if (min % 10080 === 0) {
    const w = min / 10080
    return w === 1 ? '1 Woche vorher' : `${w} Wochen vorher`
  }
  const d = min / 1440
  return d === 1 ? '1 Tag vorher' : `${d} Tage vorher`
}

export const REMINDER_PRESETS = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080]
