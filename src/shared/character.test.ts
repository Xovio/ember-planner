import { describe, expect, it } from 'vitest'
import { attrLevel, attrXp, categoryAttr, characterLevel, coinBalance, guessAttr, reconcileRewards, todoMinutes, todoReward, REWARD } from './character'
import { defaultCharacter, type CalendarEvent, type Category, type Todo } from './types'
import { ANY } from './apptime'

const since = '2026-11-20T00:00:00.000Z'
const now = new Date('2026-11-25T20:00:00.000Z')
const ch = { ...defaultCharacter(), since }

const todo = (p: Partial<Todo>): Todo =>
  ({ id: 't', title: 'Aufgabe', listId: 'inbox', priority: 0, subtasks: [], done: true, doneAt: '2026-11-24T10:00:00Z', createdAt: '', updatedAt: '', ...p }) as Todo

const base = { todos: [] as Todo[], events: [] as CalendarEvent[], goals: [], categories: [] as Category[], character: ch }
const opts = { now, session: null, prep: null }

describe('rewards for ToDos', () => {
  it('scale with difficulty and time', () => {
    expect(todoReward(0, 15)).toEqual({ coins: 3, xp: 8 })
    expect(todoReward(2, 120)).toEqual({ coins: 40, xp: 100 })
    expect(todoReward(3, 1000).coins).toBe(135)
    expect(todoReward(undefined, 30)).toEqual({ coins: 8, xp: 20 })
  })

  it('use the checked-off time block, then the estimate', () => {
    const ev = { id: 'e', start: '2026-11-24T10:00:00Z', end: '2026-11-24T11:30:00Z' } as CalendarEvent
    expect(todoMinutes(todo({ linkedEventId: 'e', estimateMin: 20 }), [ev])).toBe(90)
    expect(todoMinutes(todo({ estimateMin: 20 }), [])).toBe(20)
    expect(todoMinutes(todo({}), [])).toBe(15)
  })

  it('go to the category attribute, Ordnung without one', () => {
    const cats: Category[] = [{ id: 'c', name: 'Sport', color: 'red' }]
    const r = reconcileRewards({ ...base, categories: cats, todos: [todo({ id: 'a', categoryId: 'c' }), todo({ id: 'b' })] }, opts)
    expect(r['todo:a'].attr).toBe('fitness')
    expect(r['todo:b'].attr).toBe('order')
  })

  it('are taken back when re-opened, kept when deleted', () => {
    const r = reconcileRewards({ ...base, todos: [todo({ id: 'a' })] }, opts)
    const kept = reconcileRewards({ ...base, character: { ...ch, rewards: r } }, opts)
    expect(kept).toBe(r)
    expect(reconcileRewards({ ...base, character: { ...ch, rewards: r }, todos: [todo({ id: 'a', done: false })] }, opts)).toEqual({})
  })

  it('ignore what was done before the character existed', () => {
    expect(reconcileRewards({ ...base, todos: [todo({ doneAt: '2026-11-01T10:00:00Z' })] }, opts)).toBe(ch.rewards)
  })
})

describe('prep and attributes', () => {
  it('prep hours grow Kreativität', () => {
    const prep = { version: 1 as const, days: { '2026-11-24': { [ANY]: 3 * 3600 } } }
    const r = reconcileRewards(base, { ...opts, prep })
    expect(r['prep:2026-11-24']).toMatchObject({ coins: 12, xp: 30, attr: 'creativity' })
  })

  it('levels per attribute and overall', () => {
    expect(attrLevel(0).level).toBe(1)
    expect(attrLevel(50).level).toBe(2)
    expect(attrLevel(149).level).toBe(2)
    const rewards = { a: { at: since, coins: 30, xp: 160, attr: 'fitness' as const, label: '' }, b: { at: since, coins: 5, xp: 60, attr: 'mind' as const, label: '' } }
    const c = { ...ch, rewards, spent: 20 }
    expect(attrXp(c).fitness).toBe(160)
    expect(characterLevel(c)).toBe(1 + 2 + 1)
    expect(coinBalance(c)).toBe(15)
    expect(coinBalance({ ...c, spent: 99 })).toBe(0)
  })

  it('guesses attributes from names', () => {
    expect(guessAttr('Haushalt')).toBe('order')
    expect(guessAttr('DnD')).toBe('creativity')
    expect(guessAttr('Projekt')).toBe('mind')
    expect(categoryAttr({ id: 'x', name: 'Sport', color: 'red', attribute: null })).toBeNull()
  })
})

describe('weekly goal rewards', () => {
  it('pays the Completionist set bonus in coins when every goal of the week is done', () => {
    const g = (id: string) => ({ id, title: id, count: 1, calendarId: 'p', durationMin: 60, slots: [], createdAt: '', updatedAt: '' })
    const blk = (goalId: string, day: number): CalendarEvent => ({
      id: goalId, calendarId: 'p', title: goalId, start: `2026-11-${day}T10:00:00Z`, end: `2026-11-${day}T11:00:00Z`, allDay: false,
      reminders: [], createdAt: '', updatedAt: '', goal: { goalId, done: true, doneAt: `2026-11-${day}T11:00:00Z` }
    })
    const r = reconcileRewards({ ...base, goals: [g('gym'), g('lesen')], events: [blk('gym', 23), blk('lesen', 24)] }, opts)
    expect(r['goal-set:2026-W48']).toMatchObject({ ...REWARD.goalSet, attr: 'stamina' })
    expect(r['goal-week:gym:2026-W48'].coins).toBe(REWARD.goalWeek.coins)
  })
})
