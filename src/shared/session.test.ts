import { describe, expect, it } from 'vitest'
import { findNextSession, guessCampaign, prepTodos, sessionCountdown } from './session'
import type { CalendarEvent, Recurrence, Todo } from './types'

const local = (s: string): Date => new Date(s) // TZ = Europe/Berlin in tests
const TS = '2026-01-01T00:00:00.000Z'

function ev(id: string, title: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    calendarId: 'dnd',
    title,
    start: local(start).toISOString(),
    end: local(end).toISOString(),
    allDay: false,
    recurrence: null,
    reminders: [],
    createdAt: TS,
    updatedAt: TS,
    ...extra
  }
}

function todo(id: string, extra: Partial<Todo> = {}): Todo {
  return { id, title: id, listId: 'inbox', priority: 0, subtasks: [], done: false, createdAt: TS, updatedAt: TS, ...extra }
}

const NOW = local('2026-11-24T18:00')

describe('findNextSession', () => {
  const events = [
    ev('prep', 'Session-Prep: Kapitel 4', '2026-11-25T14:00', '2026-11-25T16:00'),
    ev('s12', 'DnD-Session #12', '2026-11-28T19:00', '2026-11-28T23:00'),
    ev('other', 'Session Zahnarzt', '2026-11-26T10:00', '2026-11-26T11:00', { calendarId: 'personal' }),
    ev('lore', 'Lore-Woche Session', '2026-11-25T00:00', '2026-11-27T00:00', { allDay: true })
  ]

  it('takes the first timed match in the calendar', () => {
    expect(findNextSession(events, { calendarId: 'dnd', keyword: 'session' }, NOW)?.event.id).toBe('s12')
  })

  it('treats empty filters as "any"', () => {
    expect(findNextSession(events, { calendarId: '', keyword: 'zahnarzt' }, NOW)?.event.id).toBe('other')
    expect(findNextSession(events, { calendarId: 'dnd', keyword: '' }, NOW)?.event.id).toBe('s12')
  })

  it('skips prep slots and ToDo time blocks', () => {
    const block = ev('block', 'Session vorbereiten', '2026-11-25T10:00', '2026-11-25T11:00', { todoId: 't1' })
    const plain = ev('plain', 'Session Nachbesprechung', '2026-11-26T10:00', '2026-11-26T11:00', { todoId: 't2' })
    expect(findNextSession([block, plain, ...events], { calendarId: 'dnd', keyword: '' }, NOW)?.event.id).toBe('s12')
  })

  it('keeps a running session and expands recurring ones', () => {
    const running = ev('run', 'Session', '2026-11-24T17:00', '2026-11-24T21:00')
    expect(findNextSession([running], { calendarId: 'dnd', keyword: '' }, NOW)?.event.id).toBe('run')
    const weekly: Recurrence = { freq: 'weekly', interval: 2 }
    const series = ev('series', 'Session', '2026-11-03T19:00', '2026-11-03T23:00', { recurrence: weekly })
    expect(findNextSession([series], { calendarId: 'dnd', keyword: '' }, NOW)?.start).toEqual(local('2026-12-01T19:00'))
  })

  it('returns null when nothing is ahead', () => {
    expect(findNextSession(events, { calendarId: 'nope', keyword: '' }, NOW)).toBeNull()
  })
})

describe('prepTodos', () => {
  const start = local('2026-11-28T19:00')
  const todos = [
    todo('late', { categoryId: 'cat-dnd', hardDeadline: '2026-12-05' }),
    todo('soft-ok', { categoryId: 'cat-dnd', softDeadline: '2026-11-27', hardDeadline: '2026-12-05' }),
    todo('undated', { listId: 'campaigns', priority: 2 }),
    todo('same-day', { categoryId: 'cat-dnd', hardDeadline: '2026-11-28' }),
    todo('done', { categoryId: 'cat-dnd', done: true }),
    todo('elsewhere', { categoryId: 'cat-home' })
  ]

  it('keeps open ToDos of the category or list that are due by the session day', () => {
    const ids = prepTodos(todos, { categoryId: 'cat-dnd', listId: 'campaigns' }, start).map((t) => t.id)
    expect(ids).toEqual(['soft-ok', 'same-day', 'undated'])
  })

  it('matches only what is set, and nothing when both are empty', () => {
    expect(prepTodos(todos, { categoryId: '', listId: 'campaigns' }, start).map((t) => t.id)).toEqual(['undated'])
    expect(prepTodos(todos, { categoryId: '', listId: '' }, start)).toEqual([])
  })
})

describe('sessionCountdown', () => {
  const occ = (s: string, e: string) => ({ event: ev('x', 'S', s, e), start: local(s), end: local(e), key: 'x' })
  it('counts calendar days', () => {
    expect(sessionCountdown(occ('2026-11-28T19:00', '2026-11-28T23:00'), NOW).big).toBe('4')
    expect(sessionCountdown(occ('2026-11-25T09:00', '2026-11-25T10:00'), NOW).big).toBe('Morgen')
    expect(sessionCountdown(occ('2026-11-24T20:00', '2026-11-24T23:00'), NOW).big).toBe('Heute')
    expect(sessionCountdown(occ('2026-11-24T17:00', '2026-11-24T23:00'), NOW).small).toBe('läuft gerade')
  })
})

describe('guessCampaign', () => {
  it('prefers the given id, then a campaign-like name', () => {
    const cals = [
      { id: 'a', name: 'Arbeit', color: 'red' as const, visible: true },
      { id: 'b', name: 'D&D Runde', color: 'red' as const, visible: true }
    ]
    expect(guessCampaign(cals, 'dnd')).toBe('b')
    expect(guessCampaign(cals, 'a')).toBe('a')
    expect(guessCampaign([cals[0]], 'dnd')).toBe('')
  })
})
