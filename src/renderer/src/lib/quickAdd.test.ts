import { describe, expect, it } from 'vitest'
import type { Category, TodoList } from '@shared/types'
import { looksLikeEvent, parseEventInput, parseQuickAdd, resolveDate } from './quickAdd'

// Monday, 23 Nov 2026, noon
const TODAY = new Date(2026, 10, 23, 12)
const cats: Category[] = [{ id: 'cat-dnd', name: 'DnD', color: 'violet' }]
const lists: TodoList[] = [
  { id: 'inbox', name: 'Eingang', color: 'red' },
  { id: 'campaigns', name: 'Kampagnen-Prep', color: 'violet' }
]
const cals = [
  { id: 'personal', name: 'Persönlich' },
  { id: 'dnd', name: 'DnD & Kampagnen' }
]

describe('resolveDate', () => {
  it.each([
    ['heute', '2026-11-23'],
    ['morgen', '2026-11-24'],
    ['übermorgen', '2026-11-25'],
    ['freitag', '2026-11-27'],
    ['fr', '2026-11-27'],
    ['montag', '2026-11-30'], // same weekday → next week
    ['in 2 wochen', '2026-12-07'],
    ['in 3 tagen', '2026-11-26'],
    ['3.12.', '2026-12-03'],
    ['3.1.', '2027-01-03'], // past day without year → next year
    ['5.6.27', '2027-06-05'],
    ['2026-12-24', '2026-12-24']
  ])('%s → %s', (expr, expected) => {
    expect(resolveDate(expr, TODAY)).toBe(expected)
  })

  it('rejects impossible dates', () => {
    expect(resolveDate('31.2.', TODAY)).toBeUndefined()
    expect(resolveDate('irgendwann', TODAY)).toBeUndefined()
  })
})

describe('parseQuickAdd (ToDos)', () => {
  it('parses the full example', () => {
    const r = parseQuickAdd('Karte zeichnen bis Fr ~Mi #dnd @kampagnen !! 2h', cats, lists, TODAY)
    expect(r).toMatchObject({
      title: 'Karte zeichnen',
      hardDeadline: '2026-11-27',
      softDeadline: '2026-11-25',
      categoryId: 'cat-dnd',
      listId: 'campaigns',
      priority: 2,
      estimateMin: 120
    })
  })

  it('reports unknown categories as new', () => {
    const r = parseQuickAdd('Steuer machen #finanzen', cats, lists, TODAY)
    expect(r.newCategory).toBe('finanzen')
    expect(r.title).toBe('Steuer machen')
  })

  it('keeps unknown @mentions in the title', () => {
    expect(parseQuickAdd('Mail an @peter', cats, lists, TODAY).title).toBe('Mail an @peter')
  })

  it('understands Tasks emojis', () => {
    const r = parseQuickAdd('Bericht 📅 2026-11-30 ⏳ 2026-11-27 ⏫', cats, lists, TODAY)
    expect(r).toMatchObject({ title: 'Bericht', hardDeadline: '2026-11-30', softDeadline: '2026-11-27', priority: 3 })
  })

  it('parses recurrence', () => {
    expect(parseQuickAdd('Wohnung aufräumen jede Woche ~Sa', cats, lists, TODAY)).toMatchObject({
      title: 'Wohnung aufräumen',
      recurrence: { freq: 'weekly', interval: 1 },
      softDeadline: '2026-11-28'
    })
    expect(parseQuickAdd('Pflanzen gießen alle 3 Tage', cats, lists, TODAY).recurrence).toEqual({ freq: 'daily', interval: 3 })
    expect(parseQuickAdd('Miete monatlich bis 1.12.', cats, lists, TODAY)).toMatchObject({
      title: 'Miete',
      recurrence: { freq: 'monthly', interval: 1 },
      hardDeadline: '2026-12-01'
    })
    // "jeden Montag" without a date: next Monday is the wish day
    expect(parseQuickAdd('Wochenplanung jeden Mo', cats, lists, TODAY)).toMatchObject({
      title: 'Wochenplanung',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [0] },
      softDeadline: '2026-11-30'
    })
    expect(parseQuickAdd('Monatsbericht schreiben', cats, lists, TODAY).recurrence).toBeUndefined()
  })

  it('parses estimates', () => {
    expect(parseQuickAdd('Lesen 1,5h', cats, lists, TODAY).estimateMin).toBe(90)
    expect(parseQuickAdd('Lesen 45min', cats, lists, TODAY).estimateMin).toBe(45)
  })
})

describe('events', () => {
  it('detects times', () => {
    expect(looksLikeEvent('Zahnarzt Do 14 Uhr')).toBe(true)
    expect(looksLikeEvent('Urlaub Montag ganztägig')).toBe(true)
    expect(looksLikeEvent('Session 12 vorbereiten')).toBe(false)
  })

  it('parses date, time, duration and calendar', () => {
    expect(parseEventInput('Zahnarzt Do 14 Uhr 1h', cals, TODAY)).toMatchObject({
      title: 'Zahnarzt',
      date: '2026-11-26',
      start: '14:00',
      durationMin: 60,
      allDay: false
    })
    expect(parseEventInput('Session 19-23 Uhr am 28.11. #dnd', cals, TODAY)).toMatchObject({
      title: 'Session',
      date: '2026-11-28',
      start: '19:00',
      end: '23:00',
      calendarId: 'dnd'
    })
  })

  it('parses all-day events', () => {
    expect(parseEventInput('Urlaub morgen ganztägig', cals, TODAY)).toMatchObject({ title: 'Urlaub', allDay: true })
  })
})
