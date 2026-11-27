import { describe, expect, it } from 'vitest'
import { parseRecurrence } from '../ical'
import { expandEvent } from '../recurrence'
import type { CalendarEvent } from '../types'
import { eventFromGoogle, type GEvent } from './mapping'
import { changedFields, googleBody, googleIdFor, recurrenceLines, ALL_FIELDS } from './write'

// TZ=Europe/Berlin
const tz = 'Europe/Berlin'

const base: CalendarEvent = {
  id: 'local-1',
  calendarId: 'g:me@example.com',
  title: 'Session',
  start: new Date(2026, 10, 2, 19).toISOString(),
  end: new Date(2026, 10, 2, 23).toISOString(),
  allDay: false,
  location: 'Taverne',
  reminders: [30, 10],
  recurrence: null,
  createdAt: '',
  updatedAt: ''
}

describe('googleIdFor', () => {
  it('produces valid, stable base32hex ids', () => {
    expect(googleIdFor('abc')).toMatch(/^[0-9a-v]{5,1024}$/)
    expect(googleIdFor('abc')).toBe(googleIdFor('abc'))
    expect(googleIdFor('abc')).not.toBe(googleIdFor('abd'))
  })
})

describe('changedFields', () => {
  it('lists only what changed', () => {
    expect(changedFields(base, { ...base })).toEqual([])
    expect(changedFields(base, { ...base, reminders: [10, 30] })).toEqual([])
    expect(changedFields(base, { ...base, title: 'Neu', end: new Date(2026, 10, 2, 22).toISOString() })).toEqual([
      'summary',
      'time'
    ])
    expect(changedFields(base, { ...base, location: undefined, todoId: 't' })).toEqual(['location', 'todo'])
  })
})

describe('googleBody', () => {
  it('builds a full resource for insert', () => {
    expect(googleBody({ ...base, todoId: 't1' }, ALL_FIELDS, { tz })).toEqual({
      summary: 'Session',
      location: 'Taverne',
      start: { dateTime: '2026-11-02T18:00:00.000Z', timeZone: tz },
      end: { dateTime: '2026-11-02T22:00:00.000Z', timeZone: tz },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
          { method: 'popup', minutes: 30 }
        ]
      },
      extendedProperties: { private: { emberTodoId: 't1' } }
    })
  })

  it('clears fields and switches time kind in a patch', () => {
    const allDay = {
      ...base,
      allDay: true,
      start: new Date(2026, 10, 2).toISOString(),
      end: new Date(2026, 10, 4).toISOString()
    }
    expect(
      googleBody({ ...allDay, location: undefined }, ['location', 'time', 'recurrence'], { tz, patch: true })
    ).toEqual({
      location: null,
      start: { date: '2026-11-02', dateTime: null, timeZone: null },
      end: { date: '2026-11-04', dateTime: null, timeZone: null },
      recurrence: []
    })
  })
})

describe('recurrenceLines', () => {
  it('writes our fields as RRULE', () => {
    expect(recurrenceLines({ freq: 'weekly', interval: 2, byWeekday: [0, 3], count: 5 }, false, tz)).toEqual([
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=5'
    ])
    expect(recurrenceLines({ freq: 'daily', interval: 1, until: '2026-11-30' }, false, tz)).toEqual([
      'RRULE:FREQ=DAILY;UNTIL=20261130T225959Z'
    ])
    expect(recurrenceLines({ freq: 'yearly', interval: 1, until: '2030-01-01' }, true, tz)).toEqual([
      'RRULE:FREQ=YEARLY;UNTIL=20300101'
    ])
  })

  it('keeps raw rules and writes exdates in local time, skipping changed occurrences', () => {
    const ex1 = new Date(2026, 10, 9, 19).toISOString()
    const ex2 = new Date(2026, 10, 16, 19).toISOString()
    expect(
      recurrenceLines(
        { freq: 'monthly', interval: 1, rrule: 'FREQ=MONTHLY;BYDAY=1MO', exdates: [ex1, ex2] },
        false,
        tz,
        new Set([ex2])
      )
    ).toEqual(['RRULE:FREQ=MONTHLY;BYDAY=1MO', 'EXDATE;TZID=Europe/Berlin:20261109T190000'])
  })

  it('round-trips through the Google mapping with the same occurrences', () => {
    const rec = {
      freq: 'weekly' as const,
      interval: 1,
      byWeekday: [0, 2],
      until: '2026-11-30',
      exdates: [new Date(2026, 10, 11, 19).toISOString()]
    }
    const ev: CalendarEvent = { ...base, recurrence: rec }
    const g: GEvent = { id: 'x', ...googleBody(ev, ALL_FIELDS, { tz }) } as GEvent
    const back = eventFromGoogle(
      g,
      { id: 'c', name: 'c', color: 'blue', visible: true, external: { provider: 'google', id: 'c' } },
      []
    )!
    const occ = (e: CalendarEvent): string[] =>
      expandEvent(e, new Date(2026, 10, 1), new Date(2026, 11, 31)).map((o) => o.start.toISOString())
    expect(occ(back)).toEqual(occ(ev))
    expect(occ(ev)).toHaveLength(8) // Mo+Mi im November (9) minus eine Ausnahme
    expect(parseRecurrence(g.recurrence!, new Date(ev.start))?.exdates).toEqual(rec.exdates)
  })
})
