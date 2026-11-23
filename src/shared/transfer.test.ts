import { describe, expect, it } from 'vitest'
import { createDefaultData, type AppData, type CalendarEvent } from './types'
import { icsFold, parseDataJson, parseTasksMarkdown, toDataJson, toICS, toTasksMarkdown } from './transfer'

const event = (p: Partial<CalendarEvent>): CalendarEvent => ({
  id: 'ev1',
  calendarId: 'dnd',
  title: 'Session',
  start: new Date(2026, 10, 28, 19).toISOString(),
  end: new Date(2026, 10, 28, 23).toISOString(),
  allDay: false,
  reminders: [],
  recurrence: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...p
})

const withEvents = (...events: CalendarEvent[]): AppData => ({ ...createDefaultData(), events })

describe('JSON', () => {
  it('round-trips and rejects foreign files', () => {
    const d = withEvents(event({}))
    expect(parseDataJson(toDataJson(d)).events).toHaveLength(1)
    expect(() => parseDataJson('{"foo":1}')).toThrow(/keine Ember-Planner-Sicherung/)
    expect(() => parseDataJson('kaputt')).toThrow(/kein gültiges JSON/)
  })
})

describe('ICS', () => {
  const NOW = new Date('2026-11-23T10:00:00Z')

  it('writes a timed event in UTC with calendar and alarm', () => {
    const ics = toICS(withEvents(event({ reminders: [30], location: 'Bei Max; Keller', notes: 'Zeile 1\nZeile 2' })), undefined, NOW)
    expect(ics).toContain('BEGIN:VCALENDAR\r\n')
    expect(ics).toContain('DTSTART:20261128T180000Z')
    expect(ics).toContain('DTEND:20261128T220000Z')
    expect(ics).toContain('LOCATION:Bei Max\\; Keller')
    expect(ics).toContain('DESCRIPTION:Zeile 1\\nZeile 2')
    expect(ics).toContain('CATEGORIES:DnD & Kampagnen')
    expect(ics).toContain('TRIGGER:-PT30M')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('writes all-day events as dates', () => {
    const ics = toICS(
      withEvents(event({ allDay: true, start: new Date(2026, 11, 24).toISOString(), end: new Date(2026, 11, 27).toISOString() })),
      undefined,
      NOW
    )
    expect(ics).toContain('DTSTART;VALUE=DATE:20261224')
    expect(ics).toContain('DTEND;VALUE=DATE:20261227')
  })

  it('writes recurrence rules and exceptions', () => {
    const ex = new Date(2026, 11, 2, 18).toISOString()
    const ics = toICS(
      withEvents(
        event({
          start: new Date(2026, 10, 23, 18).toISOString(),
          end: new Date(2026, 10, 23, 19).toISOString(),
          recurrence: { freq: 'weekly', interval: 2, byWeekday: [0, 2], until: '2026-12-31', exdates: [ex] }
        })
      ),
      undefined,
      NOW
    )
    expect(ics).toContain('RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261231T225959Z')
    expect(ics).toContain('EXDATE:20261202T170000Z')
  })

  it('filters by calendar', () => {
    const ics = toICS(withEvents(event({}), event({ id: 'ev2', calendarId: 'work' })), ['work'], NOW)
    expect(ics).toContain('UID:ev2@ember-planner')
    expect(ics).not.toContain('UID:ev1@ember-planner')
  })

  it('folds long lines at 75 octets without splitting characters', () => {
    const line = `SUMMARY:${'ä'.repeat(60)}`
    const folded = icsFold(line).split('\r\n')
    const enc = new TextEncoder()
    expect(folded.length).toBeGreaterThan(1)
    for (const l of folded) expect(enc.encode(l).length).toBeLessThanOrEqual(75)
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(line)
  })
})

describe('Tasks Markdown', () => {
  it('exports by list and re-imports with subtasks and categories', () => {
    const d = createDefaultData()
    d.todos = [
      {
        id: 't1',
        title: 'Karte zeichnen',
        listId: 'campaigns',
        categoryId: 'cat-dnd',
        priority: 3,
        hardDeadline: '2026-11-27',
        subtasks: [{ id: 's1', title: 'Skizze', done: true }],
        done: false,
        createdAt: '',
        updatedAt: ''
      },
    ]
    d.trash = [{ id: 't2', title: 'Gelöscht', listId: 'inbox', priority: 0, subtasks: [], done: false, deletedAt: 'x', createdAt: '', updatedAt: '' }]
    const md = toTasksMarkdown(d, '2026-11-23')
    expect(md).toContain('## Kampagnen-Prep')
    expect(md).toContain('- [ ] Karte zeichnen #dnd ⏫ 📅 2026-11-27')
    expect(md).toContain('    - [x] Skizze')
    expect(md).not.toContain('Gelöscht')

    const back = parseTasksMarkdown(md, d.categories)
    expect(back).toHaveLength(1)
    expect(back[0]).toMatchObject({ title: 'Karte zeichnen', priority: 3, hardDeadline: '2026-11-27', categoryId: 'cat-dnd' })
    expect(back[0].subtasks).toMatchObject([{ title: 'Skizze', done: true }])
  })

  it('ignores non-task lines', () => {
    expect(parseTasksMarkdown('# Titel\nText\n- normaler Punkt\n- [ ] Echt', [])).toHaveLength(1)
  })
})
