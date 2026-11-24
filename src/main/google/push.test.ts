import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent, CalendarInfo } from '@shared/types'
import type { GEvent } from './mapping'

let dir = ''
vi.mock('electron', () => ({ app: { getPath: () => dir } }))

const { DataStore } = await import('../store')
const { GoogleSync } = await import('./sync')
const { GoogleApiError } = await import('./account')

// TZ=Europe/Berlin
const cal: CalendarInfo = {
  id: 'g:me@example.com',
  name: 'Ich',
  color: 'blue',
  visible: true,
  external: { provider: 'google', id: 'me@example.com' }
}
const calPath = '/calendars/me%40example.com/events'

interface Call {
  method: string
  path: string
  body?: Record<string, unknown>
  ifMatch?: string
}

/**
 * Fake Google: answers list requests with nothing new (or `listItems`) and
 * write requests via `onWrite`.
 */
function setup(onWrite: (c: Call) => GEvent | Error | undefined, listItems: GEvent[] = []) {
  const store = new DataStore()
  store.applyRemote({ calendars: { upsert: [cal] } })
  const calls: Call[] = []
  let items = listItems
  const account = {
    isConnected: true,
    request: vi.fn(async (path: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      if (method === 'GET' && path.includes('?')) {
        const out = { items, nextSyncToken: 'T' }
        items = []
        return out
      }
      const headers = (init.headers ?? {}) as Record<string, string>
      const call: Call = { method, path, ifMatch: headers['If-Match'] }
      if (init.body) call.body = JSON.parse(String(init.body))
      calls.push(call)
      const r = onWrite(call)
      if (r instanceof Error) throw r
      return r
    })
  }
  const notices: string[] = []
  const sync = new GoogleSync({
    store,
    account: account as never,
    dir,
    timeZone: 'Europe/Berlin',
    onNotice: (t) => notices.push(t)
  })
  // UI saves go through DataStore.set → listener → outbox, like in the app
  store.subscribe({ onLocalChange: (diff, data) => sync.recordLocal(diff, data) })
  const ui = (fn: (events: CalendarEvent[]) => CalendarEvent[]): void => {
    const d = store.get()
    store.set({ ...d, events: fn(d.events) }, store.seq)
  }
  return { store, sync, calls, ui, notices }
}

const local = (id: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  calendarId: cal.id,
  title: 'Neu',
  start: new Date(2026, 10, 24, 9).toISOString(),
  end: new Date(2026, 10, 24, 10).toISOString(),
  allDay: false,
  reminders: [10],
  recurrence: null,
  createdAt: '2026-11-23T10:00:00.000Z',
  updatedAt: '2026-11-23T10:00:00.000Z',
  ...extra
})

const gEvent = (id: string, extra: Partial<GEvent> = {}): GEvent => ({
  id,
  etag: '"e1"',
  summary: 'Von Google',
  start: { dateTime: '2026-11-25T09:00:00+01:00' },
  end: { dateTime: '2026-11-25T10:00:00+01:00' },
  updated: '2026-11-20T10:00:00.000Z',
  ...extra
})

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ember-push-'))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
})
afterEach(() => {
  vi.useRealTimers()
  rmSync(dir, { recursive: true, force: true })
})

describe('upload to Google', () => {
  it('inserts new events with a stable id and remembers Google id + etag', async () => {
    const { store, sync, calls, ui } = setup((c) => ({
      id: String(c.body!.id),
      etag: '"e1"',
      updated: '2026-11-23T10:00:01Z'
    }))
    await sync.syncNow() // initial full sync (the fake doesn't echo inserts in full lists)
    ui((ev) => [...ev, local('n1')])
    expect(sync.state.pending).toBe(1)
    await sync.syncNow()

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ method: 'POST', path: calPath })
    expect(calls[0].body).toMatchObject({
      summary: 'Neu',
      start: { dateTime: '2026-11-24T08:00:00.000Z', timeZone: 'Europe/Berlin' },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] }
    })
    const saved = store.get().events.find((e) => e.id === 'n1')!
    expect(saved.external).toMatchObject({ provider: 'google', id: calls[0].body!.id, etag: '"e1"' })
    expect(sync.state.pending).toBe(0)
  })

  it('uploads automatically shortly after a change', async () => {
    const { sync, calls, ui } = setup((c) => ({ id: String(c.body!.id), etag: '"e"' }))
    const run = vi.spyOn(sync, 'syncNow')
    ui((ev) => [...ev, local('n1')])
    ui((ev) => ev.map((e) => ({ ...e, title: 'Neu!' })))
    await vi.advanceTimersByTimeAsync(3000)
    expect(run).toHaveBeenCalledTimes(1)
    await sync.syncNow()
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('a single occurrence changed here patches its instance at Google, not a new event', async () => {
    const series = gEvent('s1', { recurrence: ['RRULE:FREQ=WEEKLY'] })
    const { store, sync, calls, ui } = setup((c) => ({ id: c.path.split('/').pop()!, etag: '"i1"' }), [series])
    await sync.syncNow()
    const master = store.get().events[0]
    ui((ev) => [
      ...ev.map((e) => (e.id === master.id ? { ...e, recurrence: { ...e.recurrence!, exdates: ['2026-12-02T08:00:00.000Z'] } } : e)),
      local('one', {
        title: 'Verschoben',
        seriesId: master.id,
        originalStart: '2026-12-02T08:00:00.000Z',
        start: '2026-12-03T13:00:00.000Z',
        end: '2026-12-03T14:00:00.000Z'
      })
    ])
    await sync.syncNow()
    const inst = calls.find((c) => c.path === `${calPath}/s1_20261202T080000Z`)!
    expect(inst).toMatchObject({ method: 'PATCH', body: { summary: 'Verschoben' } })
    expect(inst.body!.recurrence).toBeUndefined()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
    // the series must not get an EXDATE for it – that would cancel the changed instance
    const masterPatch = calls.find((c) => c.path === `${calPath}/s1`)
    if (masterPatch?.body?.recurrence) expect(masterPatch.body.recurrence).toEqual(['RRULE:FREQ=WEEKLY'])
    expect(store.get().events.find((e) => e.id === 'one')!.external?.id).toBe('s1_20261202T080000Z')
  })

  it('patches only changed fields with If-Match', async () => {
    const { sync, calls, ui } = setup(() => ({ id: 'g1', etag: '"e2"' }), [gEvent('g1')])
    await sync.syncNow() // pull the event
    ui((ev) => ev.map((e) => ({ ...e, title: 'Umbenannt', updatedAt: '2026-11-23T12:00:00.000Z' })))
    await sync.syncNow()
    expect(calls).toEqual([{ method: 'PATCH', path: `${calPath}/g1`, ifMatch: '"e1"', body: { summary: 'Umbenannt' } }])
  })

  it('on a conflict the newer Google version wins and the user is told', async () => {
    const { store, sync, calls, ui, notices } = setup(
      (c) => {
        if (c.method === 'PATCH') return new GoogleApiError('precondition', 412)
        return gEvent('g1', { summary: 'In Google geändert', etag: '"e3"', updated: '2026-11-23T13:00:00.000Z' })
      },
      [gEvent('g1')]
    )
    await sync.syncNow()
    ui((ev) => ev.map((e) => ({ ...e, title: 'Lokal', updatedAt: '2026-11-23T12:00:00.000Z' })))
    await sync.syncNow()
    expect(calls.map((c) => c.method)).toEqual(['PATCH', 'GET'])
    expect(store.get().events[0].title).toBe('In Google geändert')
    expect(notices[0]).toContain('neuere Version aus Google')
  })

  it('on a conflict a newer local change is sent again without If-Match', async () => {
    const { store, sync, calls, ui } = setup(
      (c) => {
        if (c.method === 'PATCH' && c.ifMatch) return new GoogleApiError('precondition', 412)
        if (c.method === 'GET') return gEvent('g1', { summary: 'Älter in Google', updated: '2026-11-23T11:00:00.000Z' })
        return { id: 'g1', etag: '"e4"' }
      },
      [gEvent('g1')]
    )
    await sync.syncNow()
    ui((ev) => ev.map((e) => ({ ...e, title: 'Lokal neuer', updatedAt: '2026-11-23T12:00:00.000Z' })))
    await sync.syncNow()
    expect(calls.map((c) => `${c.method}${c.ifMatch ? '+if' : ''}`)).toEqual(['PATCH+if', 'GET', 'PATCH'])
    expect(store.get().events[0]).toMatchObject({ title: 'Lokal neuer', external: { etag: '"e4"' } })
  })

  it('deletes at Google, and a local undo before upload cancels it', async () => {
    const { store, sync, calls, ui } = setup(() => undefined, [gEvent('g1'), gEvent('g2')])
    await sync.syncNow()
    const kept = store.get().events.find((e) => e.external?.id === 'g2')!
    ui((ev) => ev.filter((e) => e.external?.id !== 'g1'))
    ui((ev) => ev.filter((e) => e.external?.id !== 'g2'))
    ui((ev) => [...ev, kept]) // undo
    await sync.syncNow()
    expect(calls).toEqual([{ method: 'DELETE', path: `${calPath}/g1` }])
  })

  it('keeps changes while offline and does not let a pull overwrite them', async () => {
    let online = false
    const { store, sync, calls, ui } = setup(
      () => (online ? { id: 'g1', etag: '"e9"' } : new GoogleApiError('offline', 0)),
      [gEvent('g1')]
    )
    await sync.syncNow()
    ui((ev) => ev.map((e) => ({ ...e, title: 'Offline geändert', updatedAt: '2026-11-23T12:00:00.000Z' })))
    await sync.syncNow()
    expect(sync.state.pending).toBe(1)
    expect(sync.state.error).toBe('offline')
    expect(store.get().events[0].title).toBe('Offline geändert')

    online = true
    await sync.syncNow()
    expect(sync.state.pending).toBe(0)
    expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { summary: 'Offline geändert' } })
  })

  it('switching a calendar off never deletes its events at Google', async () => {
    const { store, sync, calls } = setup(() => undefined, [gEvent('g1')])
    await sync.syncNow()
    // like removing the calendar in the UI (local save)
    const d = store.get()
    store.set({ ...d, calendars: d.calendars.filter((c) => c.id !== cal.id), events: [] }, store.seq)
    await sync.syncNow()
    expect(calls).toEqual([])
  })

  it('gives up after repeated rejections and tells the user', async () => {
    const { sync, calls, ui, notices } = setup(() => new GoogleApiError('Ungültig', 400))
    ui((ev) => [...ev, local('n1', { title: 'Kaputt' })])
    await sync.syncNow()
    await sync.syncNow()
    expect(sync.state.pending).toBe(1)
    await sync.syncNow()
    expect(calls).toHaveLength(3)
    expect(sync.state.pending).toBe(0)
    expect(notices[0]).toContain('„Kaputt“ konnte nicht zu Google übertragen werden')
  })
})
