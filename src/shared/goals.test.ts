import { describe, expect, it } from 'vitest'
import { goalWeek, markFilled, setBonus, slotsToFill, weekKey } from './goals'
import type { CalendarEvent, WeeklyGoal } from './types'

const gym: WeeklyGoal = {
  id: 'gym',
  title: 'Gym',
  count: 3,
  calendarId: 'personal',
  durationMin: 90,
  slots: [
    { day: 1, time: '15:30', durationMin: 120 },
    { day: 3, time: '15:30', durationMin: 120 }
  ],
  createdAt: '',
  updatedAt: ''
}

const block = (id: string, start: Date, done = false, min = 90): CalendarEvent => ({
  id,
  calendarId: 'personal',
  title: 'Gym',
  start: start.toISOString(),
  end: new Date(start.getTime() + min * 60000).toISOString(),
  allDay: false,
  reminders: [],
  goal: { goalId: 'gym', done, doneAt: done ? start.toISOString() : undefined },
  createdAt: '',
  updatedAt: ''
})

// Mo 23. 11. 2026 … So 29. 11. 2026 (KW 48)
const wed = new Date(2026, 10, 25, 12)

describe('weekKey', () => {
  it('uses ISO weeks', () => {
    expect(weekKey(wed)).toBe('2026-W48')
    expect(weekKey(new Date(2027, 0, 1))).toBe('2026-W53')
  })
})

describe('goalWeek', () => {
  it('splits done, planned and missed; missed count as open again', () => {
    const events = [
      block('tue', new Date(2026, 10, 24, 15, 30), true),
      block('wed', new Date(2026, 10, 25, 8), false),
      block('thu', new Date(2026, 10, 26, 15, 30), false),
      block('next', new Date(2026, 11, 1, 15, 30), false)
    ]
    const w = goalWeek(gym, events, wed, wed)
    expect(w.done.map((e) => e.id)).toEqual(['tue'])
    expect(w.missed.map((e) => e.id)).toEqual(['wed'])
    expect(w.planned.map((e) => e.id)).toEqual(['thu'])
    expect(w.open).toBe(1)
  })
  it('struck blocks lower the target', () => {
    const w = goalWeek({ ...gym, struck: { '2026-W48': 1 } }, [], wed, wed)
    expect(w.target).toBe(2)
    expect(w.open).toBe(2)
  })
})

describe('slotsToFill', () => {
  it('puts in fixed times that are still ahead, once per week', () => {
    const fill = slotsToFill([gym], [wed, new Date(2026, 11, 2)], wed)
    expect(fill).toHaveLength(2)
    // Tuesday is over already, Thursday is ahead
    expect(fill[0].starts.map((s) => s.start.getDate())).toEqual([26])
    expect(fill[0].starts[0].durationMin).toBe(120)
    expect(fill[1].starts.map((s) => s.start.getDate())).toEqual([1, 3])
    const filled = markFilled(gym, '2026-W48')
    expect(slotsToFill([filled], [wed], wed)).toEqual([])
  })
  it('skips one-week goals in other weeks and archived goals', () => {
    expect(slotsToFill([{ ...gym, week: '2026-W50' }], [wed], wed)).toEqual([])
    expect(slotsToFill([{ ...gym, archived: true }], [wed], wed)).toEqual([])
  })
})

describe('setBonus', () => {
  const mk = (id: string, extra: Partial<WeeklyGoal> = {}): WeeklyGoal => ({ id, title: id, count: 1, calendarId: 'p', durationMin: 60, slots: [], createdAt: '2026-11-01T00:00:00Z', updatedAt: '', ...extra })
  const blk = (goalId: string, day: number): CalendarEvent => ({
    id: `${goalId}${day}`, calendarId: 'p', title: goalId, start: `2026-11-${day}T10:00:00Z`, end: `2026-11-${day}T11:00:00Z`, allDay: false,
    reminders: [], createdAt: '', updatedAt: '', goal: { goalId, done: true, doneAt: `2026-11-${day}T11:00:00Z` }
  })
  const day = new Date('2026-11-25T12:00:00Z')

  it('counts goals made later in the week, not ones made afterwards, and ignores struck ones', () => {
    const goals = [mk('a'), mk('b'), mk('later', { createdAt: '2026-12-05T00:00:00Z' }), mk('struck', { struck: { '2026-W48': 1 } })]
    const s = setBonus(goals, [blk('a', 24)], day, day)
    expect(s).toMatchObject({ week: '2026-W48', total: 2, done: 1, complete: false })
    expect(setBonus(goals, [blk('a', 24), blk('b', 25)], day, day)).toMatchObject({ total: 2, done: 2, complete: true, at: '2026-11-25T11:00:00Z' })
  })

  it('keeps archived goals only for weeks they had blocks in', () => {
    const goals = [mk('a'), mk('b'), mk('old', { archived: true })]
    expect(setBonus(goals, [blk('a', 24), blk('b', 25)], day, day).total).toBe(2)
    expect(setBonus(goals, [blk('a', 24), blk('b', 25), blk('old', 23)], day, day)).toMatchObject({ total: 3, complete: true })
  })
})
