import { describe, expect, it } from 'vitest'
import { addDays } from 'date-fns'
import type { Occurrence } from '@shared/recurrence'
import type { CalendarEvent } from '@shared/types'
import { isMultiDay, layoutSpans } from './layout'

const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 23 + i))
const occ = (id: string, start: Date, end: Date): Occurrence => ({
  event: { id } as CalendarEvent,
  start,
  end,
  key: `${id}::${start.toISOString()}`
})
const allDay = (id: string, from: number, days: number): Occurrence => occ(id, week[from], addDays(week[from], days))

describe('multi-day bars', () => {
  it('detects multi-day occurrences; an end at midnight belongs to the day before', () => {
    expect(isMultiDay(allDay('a', 0, 1))).toBe(false)
    expect(isMultiDay(allDay('a', 0, 2))).toBe(true)
    expect(isMultiDay(occ('t', new Date(2026, 10, 27, 18), new Date(2026, 10, 28, 2)))).toBe(true)
    expect(isMultiDay(occ('t', new Date(2026, 10, 27, 18), new Date(2026, 10, 28, 0)))).toBe(false)
  })

  it('keeps a bar in one lane and leaves gaps so bars line up', () => {
    const rows = layoutSpans(week, [allDay('long', 0, 4), allDay('b', 2, 3), allDay('c', 5, 2)])
    expect(rows[0].map((p) => p?.occ.event.id)).toEqual(['long'])
    expect(rows[2].map((p) => p?.occ.event.id)).toEqual(['long', 'b'])
    expect(rows[4].map((p) => p?.occ.event.id)).toEqual([undefined, 'b'])
    expect(rows[5].map((p) => p?.occ.event.id)).toEqual(['c'])
    expect(rows[0][0]).toMatchObject({ head: true, contLeft: false, contRight: true })
    expect(rows[3][0]).toMatchObject({ head: false, contLeft: true, contRight: false })
  })

  it('a bar starting before the row shows its title on the first visible day', () => {
    const rows = layoutSpans(week, [occ('x', new Date(2026, 10, 20), new Date(2026, 10, 25))])
    expect(rows[0][0]).toMatchObject({ head: true, contLeft: true, contRight: true })
    expect(rows[1][0]).toMatchObject({ head: false, contLeft: true, contRight: false })
    expect(rows[2]).toEqual([])
  })
})
