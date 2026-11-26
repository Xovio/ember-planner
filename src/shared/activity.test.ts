import { describe, expect, it } from 'vitest'
import { activityAt, activityOf } from './activity'
import type { CalendarEvent } from './types'

const ev = (title: string, start: Date, mins: number, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: title + start.toISOString(),
  calendarId: 'personal',
  title,
  start: start.toISOString(),
  end: new Date(start.getTime() + mins * 60_000).toISOString(),
  allDay: false,
  reminders: [],
  createdAt: start.toISOString(),
  updatedAt: start.toISOString(),
  ...extra
})

describe('activityOf', () => {
  it('finds activities in German and English titles', () => {
    expect(activityOf('Gym')).toBe('fitness')
    expect(activityOf('Abends Krafttraining')).toBe('fitness')
    expect(activityOf('Team-Meeting')).toBe('work')
    expect(activityOf('Lernen für die Klausur')).toBe('study')
    expect(activityOf('Vorlesung Mathe')).toBe('study')
    expect(activityOf('DnD Session')).toBe('dnd')
    expect(activityOf('D&D-Prep')).toBe('creative')
    expect(activityOf('Geburtstag Anna')).toBe('party')
    expect(activityOf('Yoga')).toBe('relax')
  })

  it('does not match inside other words or random titles', () => {
    expect(activityOf('Unity-Projektplan')).toBe('work') // "projekt", not "uni"
    expect(activityOf('Zahnarzt')).toBeNull()
    expect(activityOf('Einkaufen')).toBeNull()
  })
})

describe('activityAt', () => {
  const at = (h: number, m = 0): Date => new Date(2026, 10, 26, h, m)

  it('mirrors a running event and keeps going a while after it', () => {
    const events = [ev('Gym', at(17), 90)]
    expect(activityAt(events, at(16, 59))).toBeNull()
    expect(activityAt(events, at(17, 30))).toMatchObject({ tag: 'fitness', phase: 'during' })
    expect(activityAt(events, at(19))).toMatchObject({ tag: 'fitness', phase: 'after' })
    expect(activityAt(events, at(19, 31))).toBeNull()
  })

  it('prefers a running event over one that just ended, and ignores all-day ones', () => {
    const events = [ev('Gym', at(16), 60), ev('Lernen', at(17, 15), 60), ev('Party', at(0), 24 * 60, { allDay: true })]
    expect(activityAt(events, at(17, 30))).toMatchObject({ tag: 'study', phase: 'during' })
    expect(activityAt(events, at(17, 5))).toMatchObject({ tag: 'fitness', phase: 'after' })
  })
})
