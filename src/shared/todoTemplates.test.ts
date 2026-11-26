import { describe, expect, it } from 'vitest'
import { sortTemplates, templateFromTodo, todoFromTemplate } from './todoTemplates'
import type { Todo, TodoTemplate } from './types'

const now = new Date(2026, 10, 26, 10, 0)
const todo: Todo = {
  id: 't1',
  title: ' Wohnung putzen ',
  listId: 'home',
  categoryId: 'cat-home',
  priority: 2,
  difficulty: 2,
  subtasks: [
    { id: 's1', title: 'Bad', done: true },
    { id: 's2', title: 'Küche', done: false },
    { id: 's3', title: '  ', done: false }
  ],
  estimateMin: 90,
  hardDeadline: '2026-11-29',
  softDeadline: '2026-11-20',
  done: true,
  doneAt: '2026-11-26T09:00:00.000Z',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z'
}

describe('todo templates', () => {
  it('saves a ToDo as template with relative deadlines and its checklist', () => {
    const t = templateFromTodo(todo, 'tpl', now, 'x')
    expect(t).toMatchObject({ name: 'Wohnung putzen', title: 'Wohnung putzen', listId: 'home', categoryId: 'cat-home', priority: 2, difficulty: 2, estimateMin: 90 })
    expect(t.subtasks).toEqual(['Bad', 'Küche'])
    expect(t.hardInDays).toBe(3)
    // a wish day in the past becomes "same day"
    expect(t.softInDays).toBe(0)
  })

  it('makes a fresh ToDo with open subtasks and deadlines from today', () => {
    const t = templateFromTodo(todo, 'tpl', now, 'x')
    let n = 0
    const out = todoFromTemplate(t, () => `n${++n}`, { now: new Date(2026, 11, 30) })
    expect(out.title).toBe('Wohnung putzen')
    expect(out.subtasks).toEqual([
      { id: 'n1', title: 'Bad', done: false },
      { id: 'n2', title: 'Küche', done: false }
    ])
    expect(out.hardDeadline).toBe('2027-01-02')
    expect(out.softDeadline).toBe('2026-12-30')
    expect(out.done).toBeUndefined()
  })

  it('leaves out lists and categories that no longer exist', () => {
    const t = templateFromTodo(todo, 'tpl', now, 'x')
    const out = todoFromTemplate(t, () => 'id', { now, listIds: ['inbox'], categoryIds: [] })
    expect(out.listId).toBeUndefined()
    expect(out.categoryId).toBeUndefined()
  })

  it('sorts by use, then name', () => {
    const mk = (name: string, uses?: number): TodoTemplate => ({ id: name, name, title: name, priority: 0, subtasks: [], uses, createdAt: '', updatedAt: '' })
    expect(sortTemplates([mk('B'), mk('A'), mk('C', 3)]).map((t) => t.name)).toEqual(['C', 'A', 'B'])
  })
})
