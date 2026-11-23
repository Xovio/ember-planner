import { describe, expect, it } from 'vitest'
import { parseExdateLine, parseIcalDate, parseRecurrence, zonedToInstant } from './ical'
import { expandEvent } from './recurrence'
import type { CalendarEvent, Recurrence } from './types'

// tests run with TZ=Europe/Berlin

describe('zonedToInstant', () => {
  it('converts wall-clock times in other zones, also around DST', () => {
    expect(zonedToInstant(2026, 11, 24, 9, 0, 0, 'Europe/Berlin').toISOString()).toBe('2026-11-24T08:00:00.000Z')
    expect(zonedToInstant(2026, 7, 1, 9, 0, 0, 'Europe/Berlin').toISOString()).toBe('2026-07-01T07:00:00.000Z')
    expect(zonedToInstant(2026, 11, 24, 9, 0, 0, 'America/New_York').toISOString()).toBe('2026-11-24T14:00:00.000Z')
    expect(zonedToInstant(2026, 3, 29, 3, 30, 0, 'Europe/Berlin').toISOString()).toBe('2026-03-29T01:30:00.000Z')
  })
})

describe('parseIcalDate / EXDATE', () => {
  it('parses date, UTC and zoned values', () => {
    expect(parseIcalDate('20261124')).toEqual({ date: new Date(2026, 10, 24), dateOnly: true })
    expect(parseIcalDate('20261124T090000Z')?.date.toISOString()).toBe('2026-11-24T09:00:00.000Z')
    expect(parseIcalDate('20261124T090000', 'Europe/Berlin')?.date.toISOString()).toBe('2026-11-24T08:00:00.000Z')
    expect(parseIcalDate('quatsch')).toBeNull()
  })

  it('reads lists with TZID and VALUE=DATE', () => {
    expect(parseExdateLine('EXDATE;TZID=Europe/Berlin:20261124T090000,20261201T090000')).toEqual([
      '2026-11-24T08:00:00.000Z',
      '2026-12-01T08:00:00.000Z'
    ])
    expect(parseExdateLine('EXDATE;VALUE=DATE:20261224')).toEqual([new Date(2026, 11, 24).toISOString()])
  })
})

describe('parseRecurrence', () => {
  const mon = new Date(2026, 10, 2, 18, 0) // Monday

  it('maps simple rules to our fields', () => {
    expect(parseRecurrence(['RRULE:FREQ=WEEKLY;BYDAY=MO,TH;INTERVAL=2;COUNT=10'], mon)).toEqual({
      freq: 'weekly',
      interval: 2,
      count: 10,
      byWeekday: [0, 3]
    })
    expect(parseRecurrence(['RRULE:FREQ=WEEKLY;BYDAY=MO'], mon)).toEqual({ freq: 'weekly', interval: 1 })
    expect(parseRecurrence(['RRULE:FREQ=DAILY;UNTIL=20261130T225959Z'], mon)).toEqual({
      freq: 'daily',
      interval: 1,
      until: '2026-11-30'
    })
  })

  it('keeps the raw rule when it needs more than our fields', () => {
    expect(parseRecurrence(['RRULE:FREQ=MONTHLY;BYDAY=1MO'], mon)).toMatchObject({
      freq: 'monthly',
      rrule: 'FREQ=MONTHLY;BYDAY=1MO'
    })
    expect(parseRecurrence(['RRULE:FREQ=MONTHLY;BYMONTHDAY=15'], mon)?.rrule).toBe('FREQ=MONTHLY;BYMONTHDAY=15')
    expect(parseRecurrence(['RRULE:FREQ=MONTHLY;BYMONTHDAY=2'], mon)?.rrule).toBeUndefined()
  })

  it('collects EXDATEs and ignores rules without RRULE', () => {
    const r = parseRecurrence(['EXDATE;TZID=Europe/Berlin:20261109T180000', 'RRULE:FREQ=WEEKLY'], mon)
    expect(r?.exdates).toEqual(['2026-11-09T17:00:00.000Z'])
    expect(parseRecurrence(['RDATE:20261124'], mon)).toBeNull()
  })
})

describe('expandEvent with raw rules', () => {
  const ev = (start: Date, recurrence: Recurrence): CalendarEvent => ({
    id: 'e',
    calendarId: 'c',
    title: 't',
    start: start.toISOString(),
    end: new Date(start.getTime() + 3600_000).toISOString(),
    allDay: false,
    recurrence,
    reminders: [],
    createdAt: '',
    updatedAt: ''
  })
  const days = (e: CalendarEvent, from: Date, to: Date): string[] =>
    expandEvent(e, from, to).map((o) => `${o.start.getDate()}.${o.start.getMonth() + 1}. ${o.start.getHours()}:00`)

  it('expands "first Monday of the month" and keeps wall-clock time over DST', () => {
    const e = ev(new Date(2026, 8, 7, 19), parseRecurrence(['RRULE:FREQ=MONTHLY;BYDAY=1MO'], new Date(2026, 8, 7, 19))!)
    expect(days(e, new Date(2026, 8, 1), new Date(2027, 0, 1))).toEqual([
      '7.9. 19:00',
      '5.10. 19:00',
      '2.11. 19:00',
      '7.12. 19:00'
    ])
  })

  it('respects COUNT and exdates', () => {
    const start = new Date(2026, 10, 10, 20) // 2nd Tuesday
    const rec = parseRecurrence(['RRULE:FREQ=MONTHLY;BYDAY=2TU;COUNT=3'], start)!
    rec.exdates = [new Date(2026, 11, 8, 20).toISOString()]
    expect(days(ev(start, rec), new Date(2026, 0, 1), new Date(2028, 0, 1))).toEqual(['10.11. 20:00', '12.1. 20:00'])
  })

  it('shows only the first occurrence for a rule it cannot read', () => {
    const start = new Date(2026, 10, 10, 20)
    const e = ev(start, { freq: 'daily', interval: 1, rrule: 'FREQ=QUATSCH' })
    expect(days(e, new Date(2026, 0, 1), new Date(2027, 0, 1))).toEqual(['10.11. 20:00'])
  })
})
