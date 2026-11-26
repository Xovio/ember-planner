import { describe, expect, it } from 'vitest'
import { listLabel, listProgress, listScope, parentOptions, sortedLists } from './lists'
import type { Todo, TodoList } from './types'

const L = (id: string, parentId?: string): TodoList => ({ id, name: id, color: 'red', ...(parentId ? { parentId } : {}) })
const lists = [L('inbox'), L('umzug'), L('kueche', 'umzug'), L('dnd'), L('bad', 'umzug'), L('waise', 'weg')]
const T = (listId: string, done = false, extra: Partial<Todo> = {}): Todo =>
  ({ id: Math.random().toString(), title: 'x', listId, priority: 0, subtasks: [], done, createdAt: '', updatedAt: '', ...extra }) as Todo

describe('projects with sub-lists', () => {
  it('orders parents with their sub-lists and keeps orphans on top level', () => {
    expect(sortedLists(lists).map((x) => `${x.depth}${x.list.id}`)).toEqual(['0inbox', '0umzug', '1kueche', '1bad', '0dnd', '0waise'])
  })

  it('scopes a project to itself and its sub-lists', () => {
    expect([...listScope(lists, 'umzug')]).toEqual(['umzug', 'kueche', 'bad'])
    expect([...listScope(lists, 'kueche')]).toEqual(['kueche'])
  })

  it('labels sub-lists with their project', () => {
    expect(listLabel(lists, lists[2])).toBe('umzug › kueche')
    expect(listLabel(lists, lists[3])).toBe('dnd')
  })

  it('offers only top-level lists as parents, and none for a project or the inbox', () => {
    expect(parentOptions(lists, 'dnd').map((l) => l.id)).toEqual(['umzug', 'waise'])
    expect(parentOptions(lists, 'umzug')).toEqual([])
    expect(parentOptions(lists, 'inbox')).toEqual([])
  })

  it('counts progress over the whole project, without repeatable ToDos', () => {
    const todos = [T('umzug', true), T('kueche'), T('bad', true), T('dnd', true), T('bad', false, { repeatable: { cooldownMin: 0, completions: [] } })]
    expect(listProgress(todos, listScope(lists, 'umzug'))).toEqual({ done: 2, total: 3 })
  })
})
