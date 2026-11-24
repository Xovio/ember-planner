import { describe, expect, it } from 'vitest'
import { applyPatch, applyPatches, diffEvents, isEmptyDiff, RemoteLog } from './patch'
import { createDefaultData, type AppData, type CalendarEvent } from './types'

function ev(id: string, title = id): CalendarEvent {
  return {
    id,
    calendarId: 'personal',
    title,
    start: '2026-11-23T10:00:00.000Z',
    end: '2026-11-23T11:00:00.000Z',
    allDay: false,
    reminders: [],
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z'
  }
}

const withEvents = (...events: CalendarEvent[]): AppData => ({ ...createDefaultData(), events })
const titles = (d: AppData): string[] => d.events.map((e) => `${e.id}:${e.title}`)

describe('applyPatch', () => {
  it('replaces, adds and removes events by id, keeping order', () => {
    const d = withEvents(ev('a'), ev('b'), ev('c'))
    const next = applyPatch(d, { events: { upsert: [ev('b', 'B2'), ev('d')], remove: ['a'] } })
    expect(titles(next)).toEqual(['b:B2', 'c:c', 'd:d'])
  })

  it('is idempotent', () => {
    const p = { events: { upsert: [ev('b', 'B2'), ev('d')], remove: ['a'] } }
    const once = applyPatch(withEvents(ev('a'), ev('b')), p)
    expect(titles(applyPatch(once, p))).toEqual(titles(once))
  })

  it('remove wins over upsert of the same id', () => {
    const next = applyPatch(withEvents(), { events: { upsert: [ev('x')], remove: ['x'] } })
    expect(next.events).toEqual([])
  })

  it('returns the same object for an empty patch', () => {
    const d = withEvents(ev('a'))
    expect(applyPatch(d, {})).toBe(d)
  })

  it('patches calendars too', () => {
    const d = createDefaultData()
    const google = { id: 'g1', name: 'Google', color: 'blue' as const, visible: true }
    const next = applyPatch(d, { calendars: { upsert: [google], remove: ['work'] } })
    expect(next.calendars.map((c) => c.id)).toEqual(['personal', 'dnd', 'g1'])
  })
})

describe('diffEvents', () => {
  it('finds added, changed and removed events', () => {
    const a = ev('a')
    const diff = diffEvents([a, ev('b'), ev('c')], [a, ev('b', 'neu'), ev('d')])
    expect(diff.added.map((e) => e.id)).toEqual(['d'])
    expect(diff.changed.map((c) => c.after.title)).toEqual(['neu'])
    expect(diff.removed.map((e) => e.id)).toEqual(['c'])
  })

  it('treats structurally equal copies as unchanged', () => {
    expect(isEmptyDiff(diffEvents([ev('a')], [ev('a')]))).toBe(true)
  })
})

describe('RemoteLog', () => {
  it('replays patches the sender has not seen onto a stale save', () => {
    const log = new RemoteLog()
    log.record({ events: { upsert: [ev('a', 'von Google')] } }) // seq 1
    log.record({ events: { upsert: [ev('g')] } }) // seq 2

    // renderer saved a local edit of "b" while it only knew seq 1
    const stale = withEvents(ev('a', 'von Google'), ev('b', 'lokal'))
    const merged = applyPatches(stale, log.since(1))
    expect(titles(merged)).toEqual(['a:von Google', 'b:lokal', 'g:g'])
  })

  it('forgets patches once acknowledged', () => {
    const log = new RemoteLog()
    log.record({ events: { remove: ['a'] } })
    log.record({ events: { remove: ['b'] } })
    expect(log.seq).toBe(2)
    log.ack(1)
    expect(log.pending).toBe(1)
    expect(log.since(0)).toHaveLength(1)
    log.ack(2)
    expect(log.since(0)).toEqual([])
  })
})
