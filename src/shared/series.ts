import { addDays } from 'date-fns'
import { expandEvent } from './recurrence'
import type { CalendarEvent, Recurrence } from './types'

/*
 * Changing parts of a recurring series:
 * - "nur dieser": the occurrence becomes an own event with `seriesId`/`originalStart`,
 *   the series hides it via `exdates` (same model the Google sync uses for changed occurrences)
 * - "dieser und folgende": the series ends the day before, a new series starts at the occurrence
 */

const pad = (n: number): string => String(n).padStart(2, '0')
const localDay = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** occurrences of the series that start before `occStart` (cancelled ones count too, like COUNT does) */
function countBefore(master: CalendarEvent, occStart: Date): number {
  if (!master.recurrence) return 0
  const plain: CalendarEvent = { ...master, recurrence: { ...master.recurrence, exdates: [] } }
  return expandEvent(plain, new Date(master.start), occStart).filter((o) => o.start < occStart).length
}

/** RRULE string without UNTIL/COUNT, plus the given parts */
function withRuleEnd(rule: string, end: string | null): string {
  const parts = rule.split(';').filter((p) => p && !/^(UNTIL|COUNT)=/i.test(p))
  if (end) parts.push(end)
  return parts.join(';')
}

/** rule of `master` cut so its last occurrence lies before `occStart`; null when nothing is left */
export function recurrenceEndingBefore(master: CalendarEvent, occStart: Date): Recurrence | null {
  const rec = master.recurrence
  if (!rec) return null
  const before = countBefore(master, occStart)
  if (before === 0) return null
  const exdates = (rec.exdates ?? []).filter((d) => new Date(d) < occStart)
  const lastDay = localDay(addDays(occStart, -1))
  const next: Recurrence = { ...rec, exdates }
  if (rec.count) {
    next.count = before
    next.until = undefined
    if (rec.rrule) next.rrule = withRuleEnd(rec.rrule, `COUNT=${before}`)
  } else {
    next.until = rec.until && rec.until < lastDay ? rec.until : lastDay
    next.count = undefined
    if (rec.rrule) {
      const [y, m, d] = next.until.split('-')
      next.rrule = withRuleEnd(rec.rrule, `UNTIL=${y}${m}${d}T235959Z`)
    }
  }
  if (!next.exdates?.length) delete next.exdates
  return next
}

/** rule for the part of the series from `occStart` on */
function recurrenceFrom(master: CalendarEvent, occStart: Date): Recurrence | null {
  const rec = master.recurrence
  if (!rec) return null
  const next: Recurrence = { ...rec, exdates: (rec.exdates ?? []).filter((d) => new Date(d) >= occStart) }
  if (rec.count) {
    const left = rec.count - countBefore(master, occStart)
    if (left <= 0) return null
    next.count = left
    if (rec.rrule) next.rrule = withRuleEnd(rec.rrule, `COUNT=${left}`)
  }
  if (!next.exdates?.length) delete next.exdates
  return next
}

const durationOf = (ev: CalendarEvent): number => new Date(ev.end).getTime() - new Date(ev.start).getTime()

/**
 * "Nur dieser": turns one occurrence into an own event (with `patch` applied) and hides it in the series.
 * Returns the events unchanged when `masterId` is no series.
 */
export function detachOccurrence(
  events: CalendarEvent[],
  masterId: string,
  occurrenceStart: string,
  newId: string,
  now: string,
  patch: Partial<CalendarEvent> = {}
): CalendarEvent[] {
  const master = events.find((e) => e.id === masterId)
  if (!master?.recurrence) return events
  const start = new Date(occurrenceStart)
  const single: CalendarEvent = {
    ...structuredClone(master),
    id: newId,
    start: start.toISOString(),
    end: new Date(start.getTime() + durationOf(master)).toISOString(),
    recurrence: null,
    seriesId: master.id,
    originalStart: start.toISOString(),
    external: undefined,
    createdAt: now,
    updatedAt: now,
    ...patch
  }
  const exdates = [...new Set([...(master.recurrence.exdates ?? []), start.toISOString()])].sort()
  return [
    ...events.map((e) =>
      e.id === masterId ? { ...e, updatedAt: now, recurrence: { ...master.recurrence!, exdates } } : e
    ),
    single
  ]
}

/**
 * Single changed occurrences of the series at or after `from`. They belong to the part of the
 * series that is cut off, so they are replaced (`keep`) or removed together with it.
 */
function laterOverrides(events: CalendarEvent[], masterId: string, from: Date): CalendarEvent[] {
  return events.filter((e) => e.seriesId === masterId && e.originalStart && new Date(e.originalStart) >= from)
}

/**
 * "Dieser und folgende": the series ends before the occurrence and a new series (id `newId`)
 * starts there. Changed occurrences after the cut become plain events of their own, so a
 * calendar provider that drops them with the old series can't take them along.
 * When the occurrence is the first one, the series itself is kept (returns its id).
 */
export function splitSeries(
  events: CalendarEvent[],
  masterId: string,
  occurrenceStart: string,
  newId: string,
  now: string,
  makeId: () => string
): { events: CalendarEvent[]; id: string } {
  const master = events.find((e) => e.id === masterId)
  if (!master?.recurrence) return { events, id: masterId }
  const occ = new Date(occurrenceStart)
  const head = recurrenceEndingBefore(master, occ)
  if (!head) return { events, id: masterId }
  const tail: CalendarEvent = {
    ...structuredClone(master),
    id: newId,
    start: occ.toISOString(),
    end: new Date(occ.getTime() + durationOf(master)).toISOString(),
    recurrence: recurrenceFrom(master, occ),
    external: undefined,
    todoId: undefined,
    createdAt: now,
    updatedAt: now
  }
  const moved = laterOverrides(events, masterId, occ)
  const movedIds = new Set(moved.map((e) => e.id))
  const standalone = moved.map((e) => ({
    ...e,
    id: makeId(),
    seriesId: undefined,
    originalStart: undefined,
    external: undefined,
    updatedAt: now
  }))
  if (tail.recurrence && moved.length) {
    const ex = new Set([...(tail.recurrence.exdates ?? []), ...moved.map((e) => e.originalStart!)])
    tail.recurrence = { ...tail.recurrence, exdates: [...ex].sort() }
  }
  return {
    id: newId,
    events: [
      ...events
        .filter((e) => !movedIds.has(e.id))
        .map((e) => (e.id === masterId ? { ...e, recurrence: head, updatedAt: now } : e)),
      tail,
      ...standalone
    ]
  }
}

/**
 * "Diesen und folgende löschen": the series ends before the occurrence; changed occurrences
 * after it go too. Starting at the first occurrence removes the whole series.
 */
export function endSeriesBefore(
  events: CalendarEvent[],
  masterId: string,
  occurrenceStart: string,
  now: string
): CalendarEvent[] {
  const master = events.find((e) => e.id === masterId)
  if (!master?.recurrence) return events
  const occ = new Date(occurrenceStart)
  const head = recurrenceEndingBefore(master, occ)
  const drop = new Set(laterOverrides(events, masterId, occ).map((e) => e.id))
  if (!head) {
    drop.add(masterId)
    for (const e of events) if (e.seriesId === masterId) drop.add(e.id)
    return events.filter((e) => !drop.has(e.id))
  }
  return events
    .filter((e) => !drop.has(e.id))
    .map((e) => (e.id === masterId ? { ...e, recurrence: head, updatedAt: now } : e))
}

/** true when `occurrenceStart` is the very first occurrence of the series */
export function isFirstOccurrence(master: CalendarEvent, occurrenceStart: string): boolean {
  return countBefore(master, new Date(occurrenceStart)) === 0
}
