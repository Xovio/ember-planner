import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent } from '@shared/types'

let dir = ''
vi.mock('electron', () => ({ app: { getPath: () => dir } }))

const { DataStore } = await import('./store')

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

describe('DataStore', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ember-store-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('keeps a remote change when the UI saves a stale snapshot', () => {
    const store = new DataStore()
    const base = store.get()
    store.set({ ...base, events: [ev('a')] }, 0)

    const remote = store.applyRemote({ events: { upsert: [ev('g', 'aus Google')] } })
    expect(remote?.seq).toBe(1)

    // UI had not seen seq 1 yet and saves its own edit
    store.set({ ...base, events: [ev('a', 'lokal geändert')] }, 0)
    expect(store.get().events.map((e) => e.title)).toEqual(['lokal geändert', 'aus Google'])

    // after the UI has caught up, its snapshot is taken as is
    store.set({ ...base, events: [ev('a', 'lokal geändert')] }, 1)
    expect(store.get().events.map((e) => e.id)).toEqual(['a'])
  })

  it('reports local changes but not remote ones', () => {
    const store = new DataStore()
    const local = vi.fn()
    const remote = vi.fn()
    store.subscribe({ onLocalChange: local, onRemoteChange: remote })

    const change = store.applyRemote({ events: { upsert: [ev('g')] } })
    expect(remote).toHaveBeenCalledOnce()
    expect(local).not.toHaveBeenCalled()

    // UI echoes the remote event back unchanged plus a new local one
    store.set({ ...store.get(), events: [ev('g'), ev('n')] }, change!.seq)
    expect(local).toHaveBeenCalledOnce()
    expect(local.mock.calls[0][0].added.map((e: CalendarEvent) => e.id)).toEqual(['n'])
  })

  it('writes the data file on flush', () => {
    const store = new DataStore()
    store.applyRemote({ events: { upsert: [ev('g')] } })
    store.flush()
    const saved = JSON.parse(readFileSync(store.path, 'utf8'))
    expect(saved.events[0].id).toBe('g')
  })
})
