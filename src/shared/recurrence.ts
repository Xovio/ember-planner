import { addDays, addMonths, addWeeks, addYears, endOfDay, startOfWeek } from 'date-fns'
import type { CalendarEvent } from './types'

export interface Occurrence {
  event: CalendarEvent
  start: Date
  end: Date
  /** unique per occurrence: eventId::startISO */
  key: string
}

const MAX_ITERATIONS = 20000

function occurrence(event: CalendarEvent, start: Date, durationMs: number): Occurrence {
  return {
    event,
    start,
    end: new Date(start.getTime() + durationMs),
    key: `${event.id}::${start.toISOString()}`
  }
}

/** Mon=0 … Sun=6 */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

/**
 * All occurrences of `event` that overlap [rangeStart, rangeEnd).
 * Works in local time so wall-clock times survive DST changes.
 */
export function expandEvent(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const baseStart = new Date(event.start)
  const baseEnd = new Date(event.end)
  const duration = Math.max(0, baseEnd.getTime() - baseStart.getTime())
  const overlaps = (s: Date): boolean =>
    s.getTime() < rangeEnd.getTime() && s.getTime() + Math.max(duration, 1) > rangeStart.getTime()

  const rec = event.recurrence
  if (!rec) {
    return overlaps(baseStart) ? [occurrence(event, baseStart, duration)] : []
  }

  const interval = Math.max(1, rec.interval || 1)
  const until = rec.until ? endOfDay(new Date(`${rec.until}T00:00:00`)) : null
  const exdates = new Set(rec.exdates ?? [])
  const result: Occurrence[] = []
  let produced = 0

  const accept = (s: Date): boolean => {
    // returns false when iteration should stop
    if (s.getTime() < baseStart.getTime()) return true
    if (until && s.getTime() > until.getTime()) return false
    if (rec.count && produced >= rec.count) return false
    if (s.getTime() >= rangeEnd.getTime()) return false
    produced++
    if (!exdates.has(s.toISOString()) && overlaps(s)) result.push(occurrence(event, s, duration))
    return true
  }

  if (rec.freq === 'weekly' && rec.byWeekday && rec.byWeekday.length > 0) {
    const days = [...new Set(rec.byWeekday)].sort((a, b) => a - b)
    const weekStart = startOfWeek(baseStart, { weekStartsOn: 1 })
    const h = baseStart.getHours()
    const m = baseStart.getMinutes()
    for (let w = 0; w < MAX_ITERATIONS; w++) {
      const ws = addWeeks(weekStart, w * interval)
      if (ws.getTime() >= rangeEnd.getTime()) break
      let stop = false
      for (const d of days) {
        const s = addDays(ws, d)
        s.setHours(h, m, 0, 0)
        if (!accept(s)) {
          stop = true
          break
        }
      }
      if (stop) break
    }
    return result
  }

  const step = (i: number): Date => {
    switch (rec.freq) {
      case 'daily':
        return addDays(baseStart, i * interval)
      case 'weekly':
        return addWeeks(baseStart, i * interval)
      case 'monthly':
        return addMonths(baseStart, i * interval)
      case 'yearly':
        return addYears(baseStart, i * interval)
    }
  }

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (!accept(step(i))) break
  }
  return result
}

export function expandAll(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const out: Occurrence[] = []
  for (const e of events) out.push(...expandEvent(e, rangeStart, rangeEnd))
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}
