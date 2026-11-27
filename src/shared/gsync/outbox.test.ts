import { describe, expect, it } from 'vitest'
import { diffEvents } from '../patch'
import { createDefaultData, type AppData, type CalendarEvent } from '../types'
import { Outbox } from './outbox'

const G = 'g:me@example.com'
const synced = (id: string): boolean => id === G

const data = (events: CalendarEvent[], withGoogle = true): AppData => {
  const d = createDefaultData()
  if (withGoogle)
    d.calendars.push({
      id: G,
      name: 'G',
      color: 'blue',
      visible: true,
      external: { provider: 'google', id: 'me@example.com' }
    })
  return { ...d, events }
}

const ev = (id: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  calendarId: G,
  title: id,
  start: '2026-11-24T08:00:00.000Z',
  end: '2026-11-24T09:00:00.000Z',
  allDay: false,
  reminders: [],
  createdAt: '',
  updatedAt: '',
  ...extra
})
const fromGoogle = (id: string, extra: Partial<CalendarEvent> = {}): CalendarEvent =>
  ev(id, { external: { provider: 'google', id: `gid-${id}`, calendarId: 'me@example.com', etag: '"1"' }, ...extra })

/** applies one UI save to the outbox */
function save(box: Outbox, before: CalendarEvent[], after: CalendarEvent[], withGoogle = true): void {
  box.record(diffEvents(before, after), data(after, withGoogle), synced)
}

describe('Outbox', () => {
  it('ignores changes outside Google calendars', () => {
    const box = new Outbox()
    save(box, [], [ev('a', { calendarId: 'personal' })])
    expect(box.size).toBe(0)
  })

  it('collapses several edits into one entry with the uploaded version as base', () => {
    const box = new Outbox()
    const g = fromGoogle('a')
    save(box, [g], [{ ...g, title: 'eins' }])
    save(box, [{ ...g, title: 'eins' }], [{ ...g, title: 'zwei' }])
    expect(box.list()).toEqual([{ localId: 'a', base: g, deleted: false }])
  })

  it('new events have no base; deleting them before upload drops the entry', () => {
    const box = new Outbox()
    save(box, [], [ev('n')])
    expect(box.get('n')).toEqual({ localId: 'n', base: null, deleted: false })
    save(box, [ev('n')], [])
    expect(box.size).toBe(0)
  })

  it('records deletes of uploaded events and revives them on undo', () => {
    const box = new Outbox()
    const g = fromGoogle('a')
    save(box, [g], [])
    expect(box.get('a')).toEqual({ localId: 'a', base: g, deleted: true })
    save(box, [], [g])
    expect(box.get('a')?.deleted).toBe(false)
  })

  it('tracks moves between local and Google calendars', () => {
    const box = new Outbox()
    const local = ev('m', { calendarId: 'personal' })
    save(box, [local], [{ ...local, calendarId: G }])
    expect(box.get('m')?.base).toBeNull() // will be inserted

    const box2 = new Outbox()
    const g = fromGoogle('x')
    save(box2, [g], [{ ...g, calendarId: 'personal' }])
    expect(box2.get('x')?.base).toEqual(g) // will be deleted at Google
  })

  it('never deletes at Google when the whole calendar disappears locally', () => {
    const box = new Outbox()
    const g = fromGoogle('a')
    save(box, [g, fromGoogle('b')], [{ ...g, title: 'x' }, fromGoogle('b')])
    expect(box.size).toBe(1)
    save(box, [{ ...g, title: 'x' }, fromGoogle('b')], [], false)
    expect(box.size).toBe(0)
  })
})
