import { describe, expect, it } from 'vitest'
import { applyPatch } from './patch'
import { exportDoc, mergeDocs, newSyncState, toRecords, trackLocal, TOMBSTONE_DAYS, type DeviceDoc, type SyncState } from './sync'
import { createDefaultData, type AppData, type Todo } from './types'

const T0 = Date.parse('2026-11-27T10:00:00.000Z')

function todo(id: string, title = id, extra: Partial<Todo> = {}): Todo {
  return {
    id,
    title,
    listId: 'inbox',
    priority: 0,
    subtasks: [],
    done: false,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    ...extra
  }
}

class Device {
  state: SyncState
  data: AppData
  constructor(
    id: string,
    data: AppData = createDefaultData(),
    public now = T0
  ) {
    this.state = newSyncState(id)
    this.data = data
    trackLocal(this.state, null, this.data, this.now)
  }
  save(fn: (d: AppData) => AppData, at = (this.now += 1000)): void {
    const prev = this.data
    this.data = fn(prev)
    trackLocal(this.state, prev, this.data, at)
  }
  doc(): DeviceDoc {
    return exportDoc(this.state, this.data, this.state.deviceId, this.now)
  }
  pull(...others: Device[]): void {
    const res = mergeDocs(this.state, this.data, others.map((o) => o.doc()))
    this.data = applyPatch(this.data, { records: res })
  }
}

const sync = (a: Device, b: Device): void => {
  a.pull(b)
  b.pull(a)
}
const titles = (d: AppData): string[] => d.todos.map((t) => t.title).sort()

describe('toRecords', () => {
  it('leaves out Google calendars, their events and device settings', () => {
    const d = createDefaultData()
    d.calendars.push({ id: 'g1', name: 'Google', color: 'blue', visible: true, external: { provider: 'google', id: 'x' } })
    d.events.push(
      { id: 'e1', calendarId: 'g1', title: 'G', start: '', end: '', allDay: false, reminders: [], createdAt: '', updatedAt: '' },
      { id: 'e2', calendarId: 'personal', title: 'L', start: '', end: '', allDay: false, reminders: [], createdAt: '', updatedAt: '' }
    )
    const keys = [...toRecords(d).keys()]
    expect(keys).toContain('events/e2')
    expect(keys).toContain('calendars/personal')
    expect(keys).toContain('settings/defaultView')
    expect(keys).toContain('character/look')
    expect(keys).not.toContain('events/e1')
    expect(keys).not.toContain('calendars/g1')
    expect(keys).not.toContain('settings/theme')
    expect(keys).not.toContain('settings/obsidianVaults')
  })
})

describe('trackLocal', () => {
  it('gives untouched defaults stamp 0 and existing changes a real stamp', () => {
    const d = createDefaultData()
    d.lists[0] = { ...d.lists[0], name: 'Posteingang' }
    d.todos.push(todo('a'))
    const s = newSyncState('A')
    trackLocal(s, null, d, T0)
    expect(s.stamps['lists/projects'].t).toBe(0)
    expect(s.stamps['lists/inbox'].t).toBe(1)
    expect(s.stamps['todos/a'].t).toBe(Date.parse('2026-11-20T00:00:00.000Z'))
  })

  it('stamps changes, deletions and re-creations', () => {
    const a = new Device('A')
    a.save((d) => ({ ...d, todos: [todo('x')] }), T0 + 10)
    expect(a.state.stamps['todos/x']).toEqual({ t: T0 + 10, d: 'A' })
    a.save((d) => ({ ...d, todos: [todo('x', 'neu')] }), T0 + 20)
    expect(a.state.stamps['todos/x'].t).toBe(T0 + 20)
    a.save((d) => ({ ...d, todos: [] }), T0 + 30)
    expect(a.state.stamps['todos/x']).toEqual({ t: T0 + 30, d: 'A', del: true })
    a.save((d) => ({ ...d, todos: [todo('x')] }), T0 + 40)
    expect(a.state.stamps['todos/x']).toEqual({ t: T0 + 40, d: 'A' })
  })

  it('does not restamp unchanged records', () => {
    const a = new Device('A')
    const before = JSON.stringify(a.state)
    expect(trackLocal(a.state, a.data, structuredClone(a.data), T0 + 99)).toBe(false)
    expect(JSON.stringify(a.state)).toBe(before)
  })

  it('never stamps earlier than a time it has already seen', () => {
    const a = new Device('A')
    a.state.clock = T0 + 5000
    a.save((d) => ({ ...d, todos: [todo('x')] }), T0 + 10)
    expect(a.state.stamps['todos/x'].t).toBe(T0 + 5001)
  })
})

describe('mergeDocs', () => {
  it('keeps changes from both devices', () => {
    const a = new Device('A')
    const b = new Device('B')
    a.save((d) => ({ ...d, todos: [todo('x', 'vom PC')] }))
    b.save((d) => ({ ...d, lists: d.lists.map((l) => (l.id === 'inbox' ? { ...l, name: 'Handy-Eingang' } : l)) }))
    sync(a, b)
    expect(titles(a.data)).toEqual(['vom PC'])
    expect(titles(b.data)).toEqual(['vom PC'])
    expect(a.data.lists[0].name).toBe('Handy-Eingang')
    expect(b.data.lists[0].name).toBe('Handy-Eingang')
  })

  it('takes the newer edit of the same entry on both devices', () => {
    const a = new Device('A')
    const b = new Device('B')
    a.save((d) => ({ ...d, todos: [todo('x')] }))
    sync(a, b)
    a.save((d) => ({ ...d, todos: [todo('x', 'alt')] }), T0 + 5000)
    b.save((d) => ({ ...d, todos: [todo('x', 'neu')] }), T0 + 6000)
    sync(a, b)
    expect(titles(a.data)).toEqual(['neu'])
    expect(titles(b.data)).toEqual(['neu'])
  })

  it('applies a newer deletion and keeps an edit made after it', () => {
    const a = new Device('A')
    const b = new Device('B')
    a.save((d) => ({ ...d, todos: [todo('x'), todo('y')] }))
    sync(a, b)
    a.save((d) => ({ ...d, todos: d.todos.filter((t) => t.id !== 'x') }), T0 + 5000)
    b.save((d) => ({ ...d, todos: d.todos.map((t) => (t.id === 'x' ? { ...t, title: 'früher' } : t)) }), T0 + 4000)
    b.save((d) => ({ ...d, todos: d.todos.filter((t) => t.id !== 'y') }), T0 + 4500)
    a.save((d) => ({ ...d, todos: d.todos.map((t) => (t.id === 'y' ? { ...t, title: 'später' } : t)) }), T0 + 7000)
    sync(a, b)
    expect(titles(a.data)).toEqual(['später'])
    expect(titles(b.data)).toEqual(['später'])
  })

  it('moves a ToDo to the trash on the other device', () => {
    const a = new Device('A')
    const b = new Device('B')
    a.save((d) => ({ ...d, todos: [todo('x')] }))
    sync(a, b)
    a.save((d) => ({ ...d, todos: [], trash: [{ ...d.todos[0], deletedAt: '2026-11-27T11:00:00.000Z' }] }))
    b.pull(a)
    expect(b.data.todos).toEqual([])
    expect(b.data.trash.map((t) => t.id)).toEqual(['x'])
  })

  it('lets a fresh phone take over the desktop data instead of its own defaults', () => {
    const desktopData = createDefaultData()
    desktopData.lists[0] = { ...desktopData.lists[0], name: 'Posteingang' }
    desktopData.todos.push(todo('a'))
    desktopData.settings.defaultView = 'month'
    const pc = new Device('zzz-pc', desktopData)
    const phone = new Device('aaa-phone')
    phone.pull(pc)
    expect(phone.data.lists[0].name).toBe('Posteingang')
    expect(titles(phone.data)).toEqual(['a'])
    expect(phone.data.settings.defaultView).toBe('month')
    pc.pull(phone)
    expect(pc.data.lists[0].name).toBe('Posteingang')
  })

  it('does not sync device settings', () => {
    const a = new Device('A')
    const b = new Device('B')
    a.save((d) => ({ ...d, settings: { ...d.settings, theme: 'forest', defaultDurationMin: 45 } }))
    b.pull(a)
    expect(b.data.settings.theme).toBe(createDefaultData().settings.theme)
    expect(b.data.settings.defaultDurationMin).toBe(45)
  })

  it('merges points and completions of repeatable ToDos from both devices', () => {
    const a = new Device('A')
    const b = new Device('B')
    const rep = todo('r', 'Wasser', { repeatable: { cooldownMin: 0, completions: [] } })
    a.save((d) => ({ ...d, todos: [rep] }))
    sync(a, b)
    const done = (at: string) => (d: AppData) => ({
      ...d,
      todos: d.todos.map((t) => (t.repeatable ? { ...t, repeatable: { ...t.repeatable, completions: [...t.repeatable.completions, at] } } : t)),
      points: { ...d.points, entries: { ...d.points.entries, [`p-${at}`]: { at, kind: 'todo' as const, points: 5, label: 'Wasser' } } }
    })
    a.save(done('2026-11-27T12:00:00.000Z'), T0 + 5000)
    b.save(done('2026-11-27T13:00:00.000Z'), T0 + 6000)
    sync(a, b)
    a.pull(b)
    for (const dev of [a, b]) {
      expect(dev.data.todos[0].repeatable?.completions).toEqual(['2026-11-27T12:00:00.000Z', '2026-11-27T13:00:00.000Z'])
      expect(Object.keys(dev.data.points.entries).sort()).toEqual(['p-2026-11-27T12:00:00.000Z', 'p-2026-11-27T13:00:00.000Z'])
    }
  })

  it('merges character fields separately and unions owned clothes', () => {
    const a = new Device('A')
    const b = new Device('B')
    a.save((d) => ({ ...d, character: { ...d.character, look: { ...d.character.look, hair: 'long' }, owned: [...d.character.owned, 'hat'] } }), T0 + 5000)
    b.save((d) => ({ ...d, character: { ...d.character, room: { ...d.character.room, wall: 'brick' }, owned: [...d.character.owned, 'scarf'] } }), T0 + 6000)
    sync(a, b)
    a.pull(b)
    for (const dev of [a, b]) {
      expect(dev.data.character.look.hair).toBe('long')
      expect(dev.data.character.room.wall).toBe('brick')
      expect(dev.data.character.owned).toEqual(expect.arrayContaining(['hat', 'scarf']))
    }
  })

  it('ignores its own doc and is stable when pulled twice', () => {
    const a = new Device('A')
    const b = new Device('B')
    a.save((d) => ({ ...d, todos: [todo('x')] }))
    b.pull(a)
    const once = JSON.stringify(b.data)
    b.pull(a)
    expect(JSON.stringify(b.data)).toBe(once)
    expect(mergeDocs(a.state, a.data, [a.doc()])).toEqual({ set: {}, remove: [] })
  })

  it('moves the clock past remote stamps', () => {
    const a = new Device('A')
    const b = new Device('B')
    b.save((d) => ({ ...d, todos: [todo('x', 'Zukunft')] }), T0 + 100000)
    a.pull(b)
    a.save((d) => ({ ...d, todos: [todo('x', 'jetzt')] }), T0 + 10)
    b.pull(a)
    expect(titles(b.data)).toEqual(['jetzt'])
  })
})

describe('exportDoc', () => {
  it('drops tombstones after the retention time', () => {
    const a = new Device('A')
    a.save((d) => ({ ...d, todos: [todo('x')] }))
    a.save((d) => ({ ...d, todos: [] }))
    expect(a.doc().records['todos/x']?.del).toBe(true)
    a.now += (TOMBSTONE_DAYS + 1) * 86400000
    expect(a.doc().records['todos/x']).toBeUndefined()
  })
})
