import { describe, expect, it } from 'vitest'
import { expandAll } from './recurrence'
import { detachOccurrence, endSeriesBefore, isFirstOccurrence, recurrenceEndingBefore, splitSeries } from './series'
import type { CalendarEvent } from './types'

const NOW = '2026-11-24T12:00:00.000Z'
const at = (d: number, h = 9): string => new Date(2026, 10, d, h).toISOString()

/** weekly on Tuesday 9–10, starting Tue 3 Nov 2026 */
const series = (extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 's',
  calendarId: 'personal',
  title: 'Stand-up',
  start: at(3),
  end: at(3, 10),
  allDay: false,
  reminders: [10],
  recurrence: { freq: 'weekly', interval: 1 },
  createdAt: NOW,
  updatedAt: NOW,
  ...extra
})

const starts = (events: CalendarEvent[]): string[] =>
  expandAll(events, new Date(2026, 10, 1), new Date(2026, 11, 31)).map((o) => `${o.event.id}@${o.start.getDate()}.${o.start.getMonth() + 1}`)

let n = 0
const makeId = (): string => `x${++n}`

describe('nur dieser Termin', () => {
  it('detaches one occurrence with the change applied and hides it in the series', () => {
    const out = detachOccurrence([series()], 's', at(17), 'one', NOW, { start: at(18, 14), end: at(18, 15) })
    const one = out.find((e) => e.id === 'one')!
    expect(one).toMatchObject({ seriesId: 's', originalStart: at(17), recurrence: null, start: at(18, 14), title: 'Stand-up' })
    expect(out.find((e) => e.id === 's')!.recurrence!.exdates).toEqual([at(17)])
    const nov = starts(out).filter((s) => s.endsWith('.11'))
    expect(nov).toEqual(['s@3.11', 's@10.11', 'one@18.11', 's@24.11'])
  })

  it('without a change it keeps the time of the occurrence', () => {
    const out = detachOccurrence([series()], 's', at(10), 'one', NOW)
    expect(out.find((e) => e.id === 'one')).toMatchObject({ start: at(10), end: at(10, 10) })
  })

  it('leaves non-series events alone', () => {
    const ev = series({ recurrence: null })
    expect(detachOccurrence([ev], 's', at(3), 'x', NOW)).toEqual([ev])
  })
})

describe('dieser und folgende', () => {
  it('ends the series the day before and starts a new one at the occurrence', () => {
    const { events, id } = splitSeries([series()], 's', at(17), 'tail', NOW, makeId)
    expect(id).toBe('tail')
    expect(events.find((e) => e.id === 's')!.recurrence).toMatchObject({ until: '2026-11-16' })
    expect(events.find((e) => e.id === 'tail')).toMatchObject({ start: at(17), end: at(17, 10), external: undefined })
    const nov = starts(events).filter((s) => s.endsWith('.11'))
    expect(nov).toEqual(['s@3.11', 's@10.11', 'tail@17.11', 'tail@24.11'])
  })

  it('splits a counted series into both parts', () => {
    const ev = series({ recurrence: { freq: 'weekly', interval: 1, count: 5 } })
    const { events } = splitSeries([ev], 's', at(17), 'tail', NOW, makeId)
    expect(events.find((e) => e.id === 's')!.recurrence!.count).toBe(2)
    expect(events.find((e) => e.id === 'tail')!.recurrence!.count).toBe(3)
    expect(starts(events)).toHaveLength(5)
  })

  it('moves exdates and turns later changed occurrences into own events', () => {
    const ev = series({ recurrence: { freq: 'weekly', interval: 1, exdates: [at(10), at(24)] } })
    const changed: CalendarEvent = { ...series(), id: 'c', recurrence: null, seriesId: 's', originalStart: at(24), start: at(25), end: at(25, 10) }
    const { events } = splitSeries([ev, changed], 's', at(17), 'tail', NOW, makeId)
    expect(events.find((e) => e.id === 's')!.recurrence!.exdates).toEqual([at(10)])
    expect(events.find((e) => e.id === 'tail')!.recurrence!.exdates).toEqual([at(24)])
    expect(events.some((e) => e.id === 'c')).toBe(false)
    const own = events.find((e) => e.start === at(25))!
    expect(own.seriesId).toBeUndefined()
    expect(own.originalStart).toBeUndefined()
  })

  it('at the first occurrence nothing is split', () => {
    const list = [series()]
    expect(splitSeries(list, 's', at(3), 'tail', NOW, makeId)).toEqual({ events: list, id: 's' })
    expect(isFirstOccurrence(series(), at(3))).toBe(true)
    expect(isFirstOccurrence(series(), at(10))).toBe(false)
  })

  it('cuts a raw Google rule with UNTIL', () => {
    const ev = series({ recurrence: { freq: 'monthly', interval: 1, count: 12, rrule: 'FREQ=MONTHLY;BYDAY=1TU;COUNT=12' } })
    const rec = recurrenceEndingBefore(ev, new Date(at(1, 9).replace('-11-', '-12-')))
    expect(rec!.rrule).toBe('FREQ=MONTHLY;BYDAY=1TU;COUNT=1')
  })
})

describe('diesen und folgende löschen', () => {
  it('ends the series and drops later changed occurrences', () => {
    const changed: CalendarEvent = { ...series(), id: 'c', recurrence: null, seriesId: 's', originalStart: at(24), start: at(25), end: at(25, 10) }
    const early: CalendarEvent = { ...changed, id: 'e', originalStart: at(10), start: at(11), end: at(11, 10) }
    const out = endSeriesBefore([series({ recurrence: { freq: 'weekly', interval: 1, exdates: [at(10), at(24)] } }), changed, early], 's', at(17), NOW)
    expect(out.map((e) => e.id)).toEqual(['s', 'e'])
    expect(starts(out)).toEqual(['s@3.11', 'e@11.11'])
  })

  it('from the first occurrence removes the whole series', () => {
    const changed: CalendarEvent = { ...series(), id: 'c', recurrence: null, seriesId: 's', originalStart: at(10) }
    expect(endSeriesBefore([series(), changed], 's', at(3), NOW)).toEqual([])
  })
})
