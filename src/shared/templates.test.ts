import { describe, expect, it } from 'vitest'
import { findTemplate, templateFromEvent, templateKey } from './templates'
import type { CalendarEvent, EventTemplate } from './types'

const tpl = (name: string): EventTemplate => ({ id: name, name, title: name, calendarId: 'dnd', allDay: false, durationMin: 60, reminders: [] })
const list = [tpl('DnD-Session'), tpl('Sport'), tpl('Session-Rückblick')]

describe('event templates', () => {
  it('finds templates by key, prefix or a word of the name', () => {
    expect(templateKey(list[0])).toBe('dndsession')
    expect(findTemplate('dnd', list)?.name).toBe('DnD-Session')
    expect(findTemplate('sport', list)?.name).toBe('Sport')
    expect(findTemplate('session', list)?.name).toBe('Session-Rückblick')
    expect(findTemplate('rück', list)?.name).toBe('Session-Rückblick')
    expect(findTemplate('xyz', list)).toBeUndefined()
    expect(findTemplate('', list)).toBeUndefined()
  })

  it('takes time of day, length and details from an event', () => {
    const ev: CalendarEvent = {
      id: 'e',
      calendarId: 'dnd',
      title: 'DnD-Session',
      start: new Date(2026, 10, 27, 19).toISOString(),
      end: new Date(2026, 10, 27, 23).toISOString(),
      allDay: false,
      location: 'Discord',
      reminders: [60],
      createdAt: '',
      updatedAt: ''
    }
    expect(templateFromEvent(ev, 't')).toEqual({
      id: 't',
      name: 'DnD-Session',
      title: 'DnD-Session',
      calendarId: 'dnd',
      allDay: false,
      startTime: '19:00',
      durationMin: 240,
      location: 'Discord',
      reminders: [60]
    })
  })
})
