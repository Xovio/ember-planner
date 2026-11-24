import { addDays, addMonths, addWeeks, addYears, endOfDay, startOfWeek } from 'date-fns'
import { RRule } from 'rrule'
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
  if (rec.rrule) return expandRaw(event, rec.rrule, baseStart, duration, rangeStart, rangeEnd, new Set(rec.exdates ?? []))

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

/*
 * Rules our own loop can't express go through the rrule library. It is used in "floating" mode:
 * local wall-clock times are written into UTC fields, so occurrences keep their wall-clock time across DST.
 */
const floating = (d: Date): Date =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()))
const unfloat = (d: Date): Date =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds())

const ruleCache = new Map<string, RRule | null>()
function compileRule(rule: string, baseStart: Date): RRule | null {
  const key = `${rule}|${baseStart.toISOString()}`
  let r = ruleCache.get(key)
  if (r === undefined) {
    try {
      const opts = RRule.parseString(rule)
      opts.dtstart = floating(baseStart)
      if (opts.until) opts.until = floating(opts.until)
      r = new RRule(opts)
    } catch {
      r = null // unknown rule: show only the first occurrence
    }
    if (ruleCache.size > 2000) ruleCache.clear()
    ruleCache.set(key, r)
  }
  return r
}

function expandRaw(
  event: CalendarEvent,
  rule: string,
  baseStart: Date,
  duration: number,
  rangeStart: Date,
  rangeEnd: Date,
  exdates: Set<string>
): Occurrence[] {
  const r = compileRule(rule, baseStart)
  const from = new Date(rangeStart.getTime() - Math.max(duration, 1))
  const starts = r
    ? r.between(floating(from), floating(rangeEnd), true).map(unfloat)
    : [baseStart].filter((s) => s.getTime() >= from.getTime() && s.getTime() < rangeEnd.getTime())
  return starts
    .filter((s) => s.getTime() < rangeEnd.getTime() && s.getTime() + Math.max(duration, 1) > rangeStart.getTime())
    .filter((s) => !exdates.has(s.toISOString()))
    .map((s) => occurrence(event, s, duration))
}

export function expandAll(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const out: Occurrence[] = []
  for (const e of events) out.push(...expandEvent(e, rangeStart, rangeEnd))
  return out.sort((a, b) => a.start.getTime() - b.start.getTime())
}
