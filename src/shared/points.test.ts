import { describe, expect, it } from 'vitest'
import { levelOf, pointsBetween, POINTS, reconcilePoints, totalPoints } from './points'
import { ANY } from './apptime'
import type { CalendarEvent, PointsLedger, Todo, WeeklyGoal } from './types'

const since = '2026-11-20T00:00:00.000Z'
const now = new Date('2026-11-25T20:00:00.000Z')
const empty: PointsLedger = { since, entries: {} }

const todo = (id: string, done: boolean, doneAt?: string, priority: 0 | 1 | 2 | 3 = 0): Todo =>
  ({ id, title: id, listId: 'inbox', priority, subtasks: [], done, doneAt, createdAt: '', updatedAt: '' }) as Todo

const ev = (id: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  calendarId: 'dnd',
  title: 'Session 12',
  start,
  end,
  allDay: false,
  reminders: [],
  createdAt: '',
  updatedAt: '',
  ...extra
})

const base = { todos: [] as Todo[], events: [] as CalendarEvent[], goals: [] as WeeklyGoal[], points: empty }
const opts = { now, session: null, prep: null }

describe('reconcilePoints', () => {
  it('gives points for ToDos done since the start, more for higher priority', () => {
    const l = reconcilePoints(
      { ...base, todos: [todo('a', true, '2026-11-21T10:00:00Z', 2), todo('old', true, '2026-11-01T10:00:00Z'), todo('open', false)] },
      opts
    )
    expect(Object.keys(l.entries)).toEqual(['todo:a'])
    expect(l.entries['todo:a'].points).toBe(POINTS.todo + 2 * POINTS.todoPriority)
  })

  it('keeps points of deleted ToDos, drops them when re-opened', () => {
    const l1 = reconcilePoints({ ...base, todos: [todo('a', true, '2026-11-21T10:00:00Z')] }, opts)
    expect(reconcilePoints({ ...base, points: l1 }, opts)).toBe(l1)
    expect(reconcilePoints({ ...base, points: l1, todos: [todo('a', false)] }, opts).entries).toEqual({})
  })

  it('returns the same ledger when nothing changed', () => {
    expect(reconcilePoints(base, opts)).toBe(empty)
  })

  it('counts goal blocks and the weekly bonus', () => {
    const goal: WeeklyGoal = { id: 'g', title: 'Gym', count: 2, calendarId: 'p', durationMin: 60, slots: [], createdAt: '', updatedAt: '' }
    const done = (id: string, day: number): CalendarEvent =>
      ev(id, `2026-11-${day}T15:00:00Z`, `2026-11-${day}T16:00:00Z`, { title: 'Gym', goal: { goalId: 'g', done: true, doneAt: `2026-11-${day}T16:00:00Z` } })
    const one = reconcilePoints({ ...base, goals: [goal], events: [done('a', 24)] }, opts)
    expect(totalPoints(one)).toBe(POINTS.goal)
    const two = reconcilePoints({ ...base, goals: [goal], events: [done('a', 24), done('b', 25)] }, opts)
    expect(totalPoints(two)).toBe(2 * POINTS.goal + POINTS.goalWeek)
  })

  it('gives the Completionist bonus once every weekly goal of the week is done', () => {
    const g = (id: string, count: number): WeeklyGoal => ({ id, title: id, count, calendarId: 'p', durationMin: 60, slots: [], createdAt: '', updatedAt: '' })
    const block = (id: string, goalId: string, day: number, done = true): CalendarEvent =>
      ev(id, `2026-11-${day}T15:00:00Z`, `2026-11-${day}T16:00:00Z`, { title: goalId, goal: { goalId, done, doneAt: done ? `2026-11-${day}T16:00:00Z` : undefined } })
    const goals = [g('gym', 2), g('lesen', 1)]
    const partial = reconcilePoints({ ...base, goals, events: [block('a', 'gym', 23), block('b', 'gym', 24), block('c', 'lesen', 25, false)] }, opts)
    expect(Object.keys(partial.entries).some((k) => k.startsWith('goal-set:'))).toBe(false)
    const all = reconcilePoints({ ...base, goals, events: [block('a', 'gym', 23), block('b', 'gym', 24), block('c', 'lesen', 25)] }, opts)
    expect(all.entries['goal-set:2026-W48']).toMatchObject({ kind: 'goal-set', points: POINTS.goalSet, at: '2026-11-25T16:00:00Z' })
    expect(totalPoints(all)).toBe(3 * POINTS.goal + 2 * POINTS.goalWeek + POINTS.goalSet)
    // a single goal is no set
    const single = reconcilePoints({ ...base, goals: [g('gym', 2)], events: [block('a', 'gym', 23), block('b', 'gym', 24)] }, opts)
    expect(single.entries['goal-set:2026-W48']).toBeUndefined()
    // un-checking a block in the running week takes it back; in a week that is over it stays
    const undone = [block('a', 'gym', 23), block('b', 'gym', 24), block('c', 'lesen', 25, false)]
    expect(reconcilePoints({ ...base, goals, points: all, events: undone }, opts).entries['goal-set:2026-W48']).toBeUndefined()
    const later = { ...opts, now: new Date('2026-12-02T12:00:00Z') }
    expect(reconcilePoints({ ...base, goals, points: all, events: undone }, later).entries['goal-set:2026-W48']).toBeDefined()
  })

  it('counts sessions that ended, using the session rule', () => {
    const events = [ev('s', '2026-11-24T18:00:00Z', '2026-11-24T22:00:00Z'), ev('future', '2026-11-27T18:00:00Z', '2026-11-27T22:00:00Z')]
    const l = reconcilePoints({ ...base, events }, { ...opts, session: { calendarId: 'dnd', keyword: 'Session' } })
    expect(Object.keys(l.entries)).toEqual(['session:s:2026-11-24T18:00:00.000Z'])
  })

  it('gives points per full prep hour and per day', () => {
    const prep = { version: 1 as const, days: { '2026-11-24': { [ANY]: 2.5 * 3600 }, '2026-11-01': { [ANY]: 9 * 3600 } } }
    const l = reconcilePoints(base, { ...opts, prep })
    expect(l.entries['prep:2026-11-24'].points).toBe(2 * POINTS.prepHour)
    expect(l.entries['prep:2026-11-01']).toBeUndefined()
  })
})

describe('levels and weeks', () => {
  it('levels grow slowly', () => {
    expect(levelOf(0)).toEqual({ level: 1, from: 0, to: 100 })
    expect(levelOf(100).level).toBe(2)
    expect(levelOf(599).level).toBe(3)
    expect(levelOf(600).level).toBe(4)
  })
  it('sums a week', () => {
    const l = reconcilePoints({ ...base, todos: [todo('a', true, '2026-11-21T10:00:00Z'), todo('b', true, '2026-11-24T10:00:00Z')] }, opts)
    expect(pointsBetween(l, new Date('2026-11-23T00:00:00Z'), new Date('2026-11-30T00:00:00Z'))).toBe(POINTS.todo)
  })
})
