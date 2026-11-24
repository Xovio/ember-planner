import { describe, expect, it } from 'vitest'
import { nextRecurrence, parseTasksLine, recurrenceFromTasks, recurrenceLabel, recurrenceToTasks, toTasksLine } from './todo'
import type { Recurrence, Todo } from './types'

const todo = (p: Partial<Todo>): Todo => ({
  id: 't',
  title: 'Wohnung aufräumen',
  listId: 'inbox',
  priority: 0,
  subtasks: [],
  done: false,
  createdAt: '',
  updatedAt: '',
  ...p
})
const weekly: Recurrence = { freq: 'weekly', interval: 1 }

// Monday
const TODAY = '2026-11-23'

describe('nextRecurrence', () => {
  it('returns null for non-recurring ToDos', () => {
    expect(nextRecurrence(todo({}), TODAY)).toBeNull()
  })

  it('moves both deadlines by one step and keeps their distance', () => {
    const next = nextRecurrence(todo({ recurrence: weekly, softDeadline: '2026-11-26', hardDeadline: '2026-11-28' }), TODAY)
    expect(next).toMatchObject({ softDeadline: '2026-12-03', hardDeadline: '2026-12-05' })
  })

  it('skips into the future when completed late', () => {
    // due two weeks ago → next instance after today, not in the past
    const next = nextRecurrence(todo({ recurrence: weekly, hardDeadline: '2026-11-09' }), TODAY)
    expect(next?.hardDeadline).toBe('2026-11-30')
  })

  it('uses the next matching weekday', () => {
    const r: Recurrence = { freq: 'weekly', interval: 1, byWeekday: [0, 3] } // Mo, Do
    expect(nextRecurrence(todo({ recurrence: r, softDeadline: '2026-11-23' }), TODAY)?.softDeadline).toBe('2026-11-26')
    expect(nextRecurrence(todo({ recurrence: r, softDeadline: '2026-11-26' }), '2026-11-26')?.softDeadline).toBe('2026-11-30')
  })

  it('honours the week interval with weekdays', () => {
    const r: Recurrence = { freq: 'weekly', interval: 2, byWeekday: [5] } // every other Saturday
    expect(nextRecurrence(todo({ recurrence: r, softDeadline: '2026-11-28' }), '2026-11-28')?.softDeadline).toBe('2026-12-12')
  })

  it('clamps monthly to the end of the month', () => {
    const r: Recurrence = { freq: 'monthly', interval: 1 }
    expect(nextRecurrence(todo({ recurrence: r, hardDeadline: '2026-01-31' }), '2026-01-31')?.hardDeadline).toBe('2026-02-28')
  })

  it('handles daily and yearly', () => {
    expect(nextRecurrence(todo({ recurrence: { freq: 'daily', interval: 2 }, softDeadline: TODAY }), TODAY)?.softDeadline).toBe('2026-11-25')
    expect(nextRecurrence(todo({ recurrence: { freq: 'yearly', interval: 1 }, hardDeadline: '2026-11-30' }), TODAY)?.hardDeadline).toBe('2027-11-30')
  })

  it('starts from today without deadlines and sets a wish day', () => {
    expect(nextRecurrence(todo({ recurrence: weekly }), TODAY)).toMatchObject({ softDeadline: '2026-11-30', hardDeadline: undefined })
  })

  it('ends with until and count', () => {
    expect(nextRecurrence(todo({ recurrence: { ...weekly, until: '2026-11-29' }, softDeadline: TODAY }), TODAY)).toBeNull()
    expect(nextRecurrence(todo({ recurrence: { ...weekly, count: 1 }, softDeadline: TODAY }), TODAY)).toBeNull()
    expect(nextRecurrence(todo({ recurrence: { ...weekly, count: 3 }, softDeadline: TODAY }), TODAY)?.recurrence?.count).toBe(2)
  })
})

describe('recurrence text', () => {
  it('writes and reads the Tasks wording', () => {
    const r: Recurrence = { freq: 'weekly', interval: 2, byWeekday: [0, 3] }
    expect(recurrenceToTasks(r)).toBe('every 2 weeks on Monday, Thursday')
    expect(recurrenceFromTasks('every 2 weeks on Monday, Thursday')).toEqual(r)
    expect(recurrenceFromTasks('every month')).toEqual({ freq: 'monthly', interval: 1 })
    expect(recurrenceFromTasks('when I feel like it')).toBeNull()
  })

  it('round-trips through a Tasks line', () => {
    const t = todo({ recurrence: { freq: 'weekly', interval: 1, byWeekday: [5] }, softDeadline: '2026-11-28' })
    const line = toTasksLine(t)
    expect(line).toBe('- [ ] Wohnung aufräumen 🔁 every week on Saturday ⏳ 2026-11-28')
    expect(parseTasksLine(line)).toMatchObject({
      title: 'Wohnung aufräumen',
      softDeadline: '2026-11-28',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [5] }
    })
  })

  it('has German labels', () => {
    expect(recurrenceLabel({ freq: 'weekly', interval: 1, byWeekday: [0, 3] })).toBe('Wöchentlich (Mo, Do)')
    expect(recurrenceLabel({ freq: 'monthly', interval: 3 })).toBe('Alle 3 Monate')
  })
})
