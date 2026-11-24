import { describe, expect, it } from 'vitest'
import { nextPlaceholder, placeholderEvent, skipPlaceholder } from './templates'
import type { CalendarEvent, EventTemplate } from './types'

// Tue 24 Nov 2026
const NOW = new Date(2026, 10, 24, 10)
const tpl: EventTemplate = {
  id: 'dnd',
  name: 'DnD-Session',
  title: 'DnD-Session',
  calendarId: 'c',
  allDay: false,
  startTime: '19:00',
  durationMin: 240,
  reminders: [],
  rhythm: { weekday: 4, everyWeeks: 1 } // Friday
}
const session = (day: Date, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: `s${day.getDate()}`,
  calendarId: 'c',
  title: 'Session',
  start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 19).toISOString(),
  end: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23).toISOString(),
  allDay: false,
  reminders: [],
  templateId: 'dnd',
  createdAt: '',
  updatedAt: '',
  ...extra
})

describe('next session placeholder', () => {
  it('needs a rhythm', () => {
    expect(nextPlaceholder({ ...tpl, rhythm: undefined }, [], NOW)).toBeNull()
  })

  it('without sessions: the next matching weekday at the usual time', () => {
    const n = nextPlaceholder(tpl, [], NOW)!
    expect(n.start).toEqual(new Date(2026, 10, 27, 19))
    expect(n.end).toEqual(new Date(2026, 10, 27, 23))
  })

  it('one step after the last real session', () => {
    expect(nextPlaceholder(tpl, [session(new Date(2026, 10, 27))], NOW)!.start).toEqual(new Date(2026, 11, 4, 19))
    const two = { ...tpl, rhythm: { weekday: 4, everyWeeks: 2 } }
    expect(nextPlaceholder(two, [session(new Date(2026, 10, 27))], NOW)!.start).toEqual(new Date(2026, 11, 11, 19))
  })

  it('a session moved to another day keeps the rhythm', () => {
    // Saturday instead of Friday → next is Friday a week later
    expect(nextPlaceholder(tpl, [session(new Date(2026, 10, 28))], NOW)!.start).toEqual(new Date(2026, 11, 4, 19))
  })

  it('old sessions do not put the placeholder in the past', () => {
    const two = { ...tpl, rhythm: { weekday: 4, everyWeeks: 2 } }
    // 30 Oct + 2-week steps: 13 Nov, 27 Nov
    expect(nextPlaceholder(two, [session(new Date(2026, 9, 30))], NOW)!.start).toEqual(new Date(2026, 10, 27, 19))
  })

  it('ignores cancelled, deleted and other templates’ events', () => {
    const evs = [
      session(new Date(2026, 10, 27), { discord: { guildId: 'g', eventId: 'e', own: true, status: 4 } }),
      session(new Date(2026, 11, 4), { id: 'x', deletedAt: 'now' }),
      session(new Date(2026, 11, 11), { id: 'y', templateId: 'other' })
    ]
    expect(nextPlaceholder(tpl, evs, NOW)!.start).toEqual(new Date(2026, 10, 27, 19))
  })

  it('"fällt aus" moves it one step on', () => {
    const skipped = skipPlaceholder(tpl, [], NOW)
    expect(skipped.skipUntil).toBe('2026-11-28')
    expect(nextPlaceholder(skipped, [], NOW)!.start).toEqual(new Date(2026, 11, 4, 19))
  })

  it('builds a display-only event', () => {
    const ev = placeholderEvent(tpl, [], NOW)!
    expect(ev.id).toBe('ph:dnd')
    expect(ev.templateId).toBe('dnd')
    expect(ev.title).toBe('DnD-Session – noch planen')
    expect(ev.reminders).toEqual([])
  })
})
