import { describe, expect, it } from 'vitest'
import { expandEvent } from './recurrence'
import type { CalendarEvent, Recurrence } from './types'

const local = (s: string): Date => new Date(s) // no "Z" → local time (TZ = Europe/Berlin in tests)

function ev(start: string, end: string, recurrence?: Recurrence): CalendarEvent {
  return {
    id: 'e1',
    calendarId: 'personal',
    title: 'Test',
    start: local(start).toISOString(),
    end: local(end).toISOString(),
    allDay: false,
    recurrence: recurrence ?? null,
    reminders: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

const starts = (e: CalendarEvent, from: string, to: string): string[] =>
  expandEvent(e, local(from), local(to)).map((o) => {
    const d = o.start
    const p = (n: number): string => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  })

describe('expandEvent', () => {
  it('returns a single event when it overlaps the range', () => {
    const e = ev('2026-11-23T10:00', '2026-11-23T11:00')
    expect(starts(e, '2026-11-23T00:00', '2026-11-24T00:00')).toEqual(['2026-11-23 10:00'])
    expect(starts(e, '2026-11-24T00:00', '2026-11-25T00:00')).toEqual([])
  })

  it('includes events that started before the range but still run', () => {
    const e = ev('2026-11-22T23:00', '2026-11-23T01:00')
    expect(starts(e, '2026-11-23T00:00', '2026-11-24T00:00')).toEqual(['2026-11-22 23:00'])
  })

  it('expands daily with interval and count', () => {
    const e = ev('2026-11-01T09:00', '2026-11-01T10:00', { freq: 'daily', interval: 2, count: 3 })
    expect(starts(e, '2026-11-01T00:00', '2026-12-01T00:00')).toEqual([
      '2026-11-01 09:00',
      '2026-11-03 09:00',
      '2026-11-05 09:00'
    ])
  })

  it('respects until (inclusive)', () => {
    const e = ev('2026-11-01T09:00', '2026-11-01T10:00', { freq: 'daily', interval: 1, until: '2026-11-03' })
    expect(starts(e, '2026-11-01T00:00', '2026-12-01T00:00')).toHaveLength(3)
  })

  it('expands weekly on selected weekdays (Mon=0)', () => {
    // 2026-11-02 is a Monday
    const e = ev('2026-11-02T18:00', '2026-11-02T19:00', { freq: 'weekly', interval: 1, byWeekday: [0, 3] })
    expect(starts(e, '2026-11-01T00:00', '2026-11-16T00:00')).toEqual([
      '2026-11-02 18:00',
      '2026-11-05 18:00',
      '2026-11-09 18:00',
      '2026-11-12 18:00'
    ])
  })

  it('counts weekday occurrences across weeks', () => {
    const e = ev('2026-11-02T18:00', '2026-11-02T19:00', {
      freq: 'weekly',
      interval: 1,
      byWeekday: [0, 3],
      count: 3
    })
    expect(starts(e, '2026-11-01T00:00', '2026-12-31T00:00')).toHaveLength(3)
  })

  it('skips exdates but still counts them', () => {
    const second = local('2026-11-02T09:00').toISOString()
    const e = ev('2026-11-01T09:00', '2026-11-01T10:00', {
      freq: 'daily',
      interval: 1,
      count: 3,
      exdates: [second]
    })
    expect(starts(e, '2026-11-01T00:00', '2026-12-01T00:00')).toEqual(['2026-11-01 09:00', '2026-11-03 09:00'])
  })

  it('keeps wall-clock time across the DST change', () => {
    // DST ends in Germany on 2026-10-25
    const e = ev('2026-10-24T09:00', '2026-10-24T10:00', { freq: 'daily', interval: 1, count: 3 })
    expect(starts(e, '2026-10-24T00:00', '2026-10-28T00:00')).toEqual([
      '2026-10-24 09:00',
      '2026-10-25 09:00',
      '2026-10-26 09:00'
    ])
  })

  it('expands monthly and yearly', () => {
    const m = ev('2026-01-15T12:00', '2026-01-15T13:00', { freq: 'monthly', interval: 1, count: 3 })
    expect(starts(m, '2026-01-01T00:00', '2027-01-01T00:00')).toEqual([
      '2026-01-15 12:00',
      '2026-02-15 12:00',
      '2026-03-15 12:00'
    ])
    const y = ev('2024-02-29T12:00', '2024-02-29T13:00', { freq: 'yearly', interval: 1 })
    expect(starts(y, '2025-01-01T00:00', '2026-01-01T00:00')).toHaveLength(1)
  })
})
