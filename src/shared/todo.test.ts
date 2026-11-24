import { describe, expect, it } from 'vitest'
import { compareTodos, deadlineStatus, effectiveDeadline, parseTasksLine, toTasksLine } from './todo'
import type { Category, Todo } from './types'

let n = 0
const todo = (p: Partial<Todo> = {}): Todo => ({
  id: `t${n++}`,
  title: 'Test',
  listId: 'inbox',
  priority: 0,
  subtasks: [],
  done: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...p
})

const TODAY = '2026-11-23'

describe('deadlines', () => {
  it('uses the earlier of soft and hard deadline', () => {
    expect(effectiveDeadline(todo({ softDeadline: '2026-11-25', hardDeadline: '2026-11-28' }))).toBe('2026-11-25')
    expect(effectiveDeadline(todo())).toBeUndefined()
  })

  it('classifies status', () => {
    expect(deadlineStatus(todo({ hardDeadline: '2026-11-22' }), TODAY)).toBe('overdue')
    expect(deadlineStatus(todo({ softDeadline: '2026-11-22', hardDeadline: '2026-11-30' }), TODAY)).toBe('soft-missed')
    expect(deadlineStatus(todo({ softDeadline: TODAY }), TODAY)).toBe('today')
    expect(deadlineStatus(todo({ hardDeadline: '2026-11-26' }), TODAY)).toBe('soon')
    expect(deadlineStatus(todo({ hardDeadline: '2026-11-27' }), TODAY)).toBe('later')
    expect(deadlineStatus(todo(), TODAY)).toBe('none')
  })

  it('sorts open before done, by deadline, hard before soft, then priority', () => {
    const a = todo({ title: 'a', softDeadline: '2026-11-25' })
    const b = todo({ title: 'b', hardDeadline: '2026-11-25' })
    const c = todo({ title: 'c', hardDeadline: '2026-11-24' })
    const d = todo({ title: 'd', priority: 3 })
    const e = todo({ title: 'e', priority: 1 })
    const f = todo({ title: 'f', done: true, hardDeadline: '2026-11-20' })
    expect([f, e, d, a, b, c].sort(compareTodos).map((t) => t.title).join('')).toBe('cbadef')
  })
})

describe('Obsidian Tasks format', () => {
  const cats: Category[] = [{ id: 'c1', name: 'DnD Kampagne', color: 'violet' }]

  it('writes a Tasks line', () => {
    const t = todo({
      title: 'Karte zeichnen',
      categoryId: 'c1',
      priority: 3,
      softDeadline: '2026-11-25',
      hardDeadline: '2026-11-27'
    })
    expect(toTasksLine(t, cats)).toBe('- [ ] Karte zeichnen #dnd-kampagne ⏫ ⏳ 2026-11-25 📅 2026-11-27')
  })

  it('adds the done date', () => {
    const t = todo({ title: 'X', done: true, doneAt: new Date(2026, 10, 23, 12).toISOString() })
    expect(toTasksLine(t)).toBe('- [x] X ✅ 2026-11-23')
  })

  it('parses a Tasks line', () => {
    expect(parseTasksLine('- [x] Karte zeichnen #dnd 🔼 📅 2026-11-27 ⏳ 2026-11-25 ✅ 2026-11-24')).toEqual({
      done: true,
      title: 'Karte zeichnen',
      priority: 2,
      hardDeadline: '2026-11-27',
      softDeadline: '2026-11-25',
      doneDate: '2026-11-24',
      tags: ['dnd']
    })
    expect(parseTasksLine('Kein Task')).toBeNull()
  })

  it('round-trips', () => {
    const t = todo({ title: 'Runde', priority: 1, hardDeadline: '2026-12-01' })
    const p = parseTasksLine(toTasksLine(t))!
    expect([p.title, p.priority, p.hardDeadline, p.done]).toEqual(['Runde', 1, '2026-12-01', false])
  })
})
