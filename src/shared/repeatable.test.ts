import { describe, expect, it } from 'vitest'
import { completeRepeatable, cooldownLabel, cooldownLeft, formatLeft, isCoolingDown, makeRepeatable, undoRepeatable } from './repeatable'
import { reconcilePoints, POINTS } from './points'
import { reconcileRewards } from './character'
import { createDefaultData, type Todo } from './types'

const T0 = '2026-11-25T10:00:00.000Z'
const at = (min: number): string => new Date(new Date(T0).getTime() + min * 60_000).toISOString()
const ms = (iso: string): number => new Date(iso).getTime()

const wash = (completions: string[] = [], cooldownMin = 60): Todo => ({
  id: 'wash',
  title: 'Waschmaschine befüllen',
  listId: 'inbox',
  priority: 0,
  subtasks: [],
  done: false,
  repeatable: { cooldownMin, completions },
  createdAt: '',
  updatedAt: ''
})

describe('repeatable ToDos', () => {
  it('adds a completion and then cools down', () => {
    const t = completeRepeatable(wash(), T0)
    expect(t.repeatable!.completions).toEqual([T0])
    expect(t.done).toBe(false)
    expect(cooldownLeft(t, ms(at(15)))).toBe(45 * 60_000)
    expect(isCoolingDown(t, ms(at(60)))).toBe(false)
  })

  it('ignores ticking during the cooldown and allows it right away without one', () => {
    const t = wash([T0])
    expect(completeRepeatable(t, at(30))).toBe(t)
    expect(completeRepeatable(t, at(61)).repeatable!.completions).toHaveLength(2)
    expect(completeRepeatable(wash([T0], 0), T0).repeatable!.completions).toHaveLength(2)
  })

  it('takes back only the newest completion', () => {
    expect(undoRepeatable(wash([T0, at(90)])).repeatable!.completions).toEqual([T0])
    const none = wash()
    expect(undoRepeatable(none)).toBe(none)
  })

  it('keeps the completion of a done ToDo when it becomes repeatable', () => {
    const done = { ...wash(), repeatable: undefined, done: true, doneAt: T0 }
    expect(makeRepeatable(done, 120)).toMatchObject({ done: false, recurrence: null, repeatable: { cooldownMin: 120, completions: [T0] } })
  })

  it('formats cooldowns and remaining time', () => {
    expect(cooldownLabel(0)).toBe('Keine')
    expect(cooldownLabel(30)).toBe('30 min')
    expect(cooldownLabel(120)).toBe('2 Stunden')
    expect(cooldownLabel(1440)).toBe('1 Tag')
    expect(cooldownLabel(10080)).toBe('1 Woche')
    expect(formatLeft(44 * 60_000 + 1)).toBe('45 min')
    expect(formatLeft(80 * 60_000)).toBe('1 h 20 min')
  })
})

describe('points and rewards for repeatable ToDos', () => {
  const since = '2026-11-20T00:00:00.000Z'
  const opts = { now: new Date(at(300)), session: null, prep: null }
  const base = { events: [], goals: [], points: { since, entries: {} } }

  it('counts every completion and drops the one taken back', () => {
    const l1 = reconcilePoints({ ...base, todos: [wash([T0, at(90), '2026-11-01T10:00:00.000Z'])] }, opts)
    expect(Object.keys(l1.entries).sort()).toEqual([`todo:wash@${T0}`, `todo:wash@${at(90)}`])
    expect(l1.entries[`todo:wash@${T0}`].points).toBe(POINTS.todo)
    const l2 = reconcilePoints({ ...base, points: l1, todos: [wash([T0])] }, opts)
    expect(Object.keys(l2.entries)).toEqual([`todo:wash@${T0}`])
    // deleting the ToDo keeps its points
    expect(reconcilePoints({ ...base, points: l2, todos: [] }, opts)).toBe(l2)
  })

  it('does not mix up ToDos whose ids share a prefix', () => {
    const other = { ...wash([at(10)]), id: 'washer' }
    const l = reconcilePoints({ ...base, todos: [wash([T0]), other] }, opts)
    expect(Object.keys(l.entries)).toHaveLength(2)
  })

  it('gives coins and XP per completion', () => {
    const d = createDefaultData()
    const ch = { ...d.character, since }
    const r = reconcileRewards({ ...d, character: ch, todos: [wash([T0, at(90)])] }, opts)
    expect(Object.keys(r)).toHaveLength(2)
    expect(r[`todo:wash@${T0}`].coins).toBeGreaterThan(0)
  })
})
