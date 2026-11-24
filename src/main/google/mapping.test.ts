import { describe, expect, it } from 'vitest'
import { applyPatch } from '@shared/patch'
import { expandEvent } from '@shared/recurrence'
import { createDefaultData, type CalendarEvent, type CalendarInfo } from '@shared/types'
import { eventFromGoogle, htmlToText, patchFromGoogle, type GEvent } from './mapping'

// TZ=Europe/Berlin in tests

const cal: CalendarInfo = {
  id: 'g:me@example.com',
  name: 'Ich',
  color: 'blue',
  visible: true,
  external: { provider: 'google', id: 'me@example.com' }
}

const timed = (id: string, extra: Partial<GEvent> = {}): GEvent => ({
  id,
  status: 'confirmed',
  etag: '"1"',
  summary: `Termin ${id}`,
  start: { dateTime: '2026-11-24T09:00:00+01:00', timeZone: 'Europe/Berlin' },
  end: { dateTime: '2026-11-24T10:00:00+01:00', timeZone: 'Europe/Berlin' },
  updated: '2026-11-20T10:00:00.000Z',
  ...extra
})

const run = (items: GEvent[], local: CalendarEvent[] = [], full = false) => {
  const patch = patchFromGoogle({ cal, items, defaultReminders: [10], local, full })
  const data = applyPatch({ ...createDefaultData(), events: local }, patch)
  return { patch, events: data.events }
}

describe('eventFromGoogle', () => {
  it('maps a timed event', () => {
    const ev = eventFromGoogle(
      timed('a', {
        location: 'Taverne',
        description: 'Würfel <b>nicht</b> vergessen<br>Snacks',
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 60 }
          ]
        },
        extendedProperties: { private: { emberTodoId: 'todo-1' } }
      }),
      cal,
      [10]
    )!
    expect(ev).toMatchObject({
      id: 'g:me@example.com:a',
      calendarId: 'g:me@example.com',
      title: 'Termin a',
      start: '2026-11-24T08:00:00.000Z',
      end: '2026-11-24T09:00:00.000Z',
      allDay: false,
      location: 'Taverne',
      notes: 'Würfel nicht vergessen\nSnacks',
      reminders: [30],
      todoId: 'todo-1',
      external: { provider: 'google', id: 'a', calendarId: 'me@example.com', etag: '"1"' }
    })
  })

  it('maps all-day events to local midnight with exclusive end', () => {
    const ev = eventFromGoogle(
      {
        id: 'u',
        summary: 'Urlaub',
        start: { date: '2026-12-21' },
        end: { date: '2026-12-24' },
        reminders: { useDefault: true }
      },
      cal,
      [10]
    )!
    expect(ev.allDay).toBe(true)
    expect(ev.start).toBe(new Date(2026, 11, 21).toISOString())
    expect(ev.end).toBe(new Date(2026, 11, 24).toISOString())
    expect(ev.reminders).toEqual([10])
  })
})

describe('patchFromGoogle', () => {
  it('adds, updates and removes events incrementally', () => {
    const { events: first } = run([timed('a'), timed('b')])
    expect(first.map((e) => e.title)).toEqual(['Termin a', 'Termin b'])

    const { events, patch } = run([timed('a', { summary: 'Neu' }), { id: 'b', status: 'cancelled' }], first)
    expect(events.map((e) => e.title)).toEqual(['Neu'])
    expect(patch.events?.remove).toEqual(['g:me@example.com:b'])
  })

  it('sends nothing for unchanged events', () => {
    const { events } = run([timed('a')])
    expect(run([timed('a')], events).patch.events?.upsert).toEqual([])
  })

  it('full sync removes events Google no longer has, but leaves other calendars alone', () => {
    const other: CalendarEvent = { ...run([timed('x')]).events[0], id: 'local-1', calendarId: 'personal' }
    const mine = run([timed('a'), timed('b')]).events
    const { patch } = run([timed('a')], mine, true)
    expect(patch.events?.remove).toEqual(['g:me@example.com:b'])
    expect(patch.events?.remove).not.toContain(other.id)
  })

  it('keeps the link to a Discord event when Google sends a new version', () => {
    const first = run([timed('a')]).events[0]
    const linked = { ...first, discord: { guildId: '1', eventId: '2', own: true, userCount: 4 } }
    const { events } = run([timed('a', { summary: 'Neu', etag: '"2"' })], [linked])
    expect(events[0]).toMatchObject({ title: 'Neu', discord: { eventId: '2', userCount: 4 } })
  })

  describe('recurring events', () => {
    const series = timed('s', {
      summary: 'Session',
      start: { dateTime: '2026-11-02T19:00:00+01:00', timeZone: 'Europe/Berlin' },
      end: { dateTime: '2026-11-02T23:00:00+01:00', timeZone: 'Europe/Berlin' },
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO']
    })
    const moved = timed('s_20261109T180000Z', {
      summary: 'Session (verschoben)',
      recurringEventId: 's',
      originalStartTime: { dateTime: '2026-11-09T19:00:00+01:00', timeZone: 'Europe/Berlin' },
      start: { dateTime: '2026-11-10T19:00:00+01:00' },
      end: { dateTime: '2026-11-10T23:00:00+01:00' }
    })
    const cancelled: GEvent = {
      id: 's_20261116T180000Z',
      status: 'cancelled',
      recurringEventId: 's',
      originalStartTime: { dateTime: '2026-11-16T19:00:00+01:00' }
    }
    const visible = (events: CalendarEvent[]): string[] =>
      events
        .flatMap((e) => expandEvent(e, new Date(2026, 10, 1), new Date(2026, 10, 24)))
        .sort((a, b) => a.start.getTime() - b.start.getTime())
        .map((o) => `${o.start.getDate()}.11. ${o.event.title}`)

    it('hides changed and cancelled occurrences in the series (full sync)', () => {
      const { events } = run([series, moved, cancelled], [], true)
      expect(visible(events)).toEqual(['2.11. Session', '10.11. Session (verschoben)', '23.11. Session'])
    })

    it('handles exceptions arriving later (incremental) and keeps them on series updates', () => {
      let { events } = run([series], [], true)
      ;({ events } = run([cancelled], events))
      ;({ events } = run([moved], events))
      // series renamed at Google: exceptions must survive
      ;({ events } = run([{ ...series, summary: 'DnD' }], events))
      expect(visible(events)).toEqual(['2.11. DnD', '10.11. Session (verschoben)', '23.11. DnD'])
    })

    it('removes changed occurrences together with the deleted series', () => {
      const { events } = run([series, moved], [], true)
      expect(run([{ id: 's', status: 'cancelled' }], events).events).toEqual([])
    })
  })
})

describe('htmlToText', () => {
  it('keeps plain text and converts links and lists', () => {
    expect(htmlToText('a < b')).toBe('a < b')
    expect(htmlToText('<ul><li>Eins</li><li>Zwei</li></ul><a href="https://x.de">Karte</a>')).toBe(
      '• Eins\n• Zwei\nKarte (https://x.de)'
    )
  })
})
