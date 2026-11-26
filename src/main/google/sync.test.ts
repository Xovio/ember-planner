import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarInfo } from '@shared/types'
import type { GEvent } from './mapping'

let dir = ''
vi.mock('electron', () => ({ app: { getPath: () => dir } }))

const { DataStore } = await import('../store')
const { GoogleSync } = await import('./sync')
const { GoogleApiError } = await import('./account')

const cal: CalendarInfo = {
  id: 'g:me@example.com',
  name: 'Ich',
  color: 'blue',
  visible: true,
  external: { provider: 'google', id: 'me@example.com' }
}

const ev = (id: string, summary = id): GEvent => ({
  id,
  summary,
  start: { dateTime: '2026-11-24T09:00:00+01:00' },
  end: { dateTime: '2026-11-24T10:00:00+01:00' }
})

type Reply = { items?: GEvent[]; nextPageToken?: string; nextSyncToken?: string } | Error

/** stores of the running test: their delayed write must happen before the temp folder goes */
type Store = InstanceType<typeof import('../store').DataStore>
let stores: Store[] = []

function setup(replies: Reply[]) {
  const store = new DataStore()
  stores.push(store)
  store.applyRemote({ calendars: { upsert: [cal] } })
  const urls: URL[] = []
  const account = {
    isConnected: true,
    request: vi.fn(async (path: string) => {
      urls.push(new URL(`https://x${path}`))
      const r = replies.shift()
      if (!r) throw new Error('unexpected request')
      if (r instanceof Error) throw r
      return r
    })
  }
  const sync = new GoogleSync({ store, account: account as never, dir })
  const titles = (): string[] => store.get().events.map((e) => e.title)
  return { store, sync, urls, titles }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ember-sync-'))
})
afterEach(() => {
  for (const s of stores) s.flush()
  stores = []
  rmSync(dir, { recursive: true, force: true })
})

describe('GoogleSync', () => {
  it('does a paged full sync first, then incremental syncs with the token', async () => {
    const { sync, urls, titles } = setup([
      { items: [ev('a')], nextPageToken: 'p2' },
      { items: [ev('b')], nextSyncToken: 'T1' },
      { items: [ev('a', 'a neu'), { id: 'b', status: 'cancelled' }], nextSyncToken: 'T2' }
    ])
    await sync.syncNow()
    expect(titles()).toEqual(['a', 'b'])
    expect(urls[0].pathname).toBe('/calendars/me%40example.com/events')
    expect(urls[0].searchParams.get('syncToken')).toBeNull()
    expect(urls[1].searchParams.get('pageToken')).toBe('p2')
    expect(sync.state).toMatchObject({ running: false, error: undefined })
    expect(sync.state.lastSync).toBeTruthy()

    await sync.syncNow()
    expect(urls[2].searchParams.get('syncToken')).toBe('T1')
    expect(titles()).toEqual(['a neu'])
    expect(JSON.parse(readFileSync(join(dir, 'google-sync.json'), 'utf8')).syncTokens).toEqual({
      'me@example.com': 'T2'
    })
  })

  it('falls back to a full sync when Google invalidates the token (410)', async () => {
    const { sync, urls, titles } = setup([
      { items: [ev('a'), ev('b')], nextSyncToken: 'T1' },
      new GoogleApiError('gone', 410),
      { items: [ev('b')], nextSyncToken: 'T2' }
    ])
    await sync.syncNow()
    await sync.syncNow()
    expect(urls[2].searchParams.get('syncToken')).toBeNull()
    // full sync: "a" no longer exists at Google
    expect(titles()).toEqual(['b'])
  })

  it('reports errors without losing data and retries next time', async () => {
    const { sync, titles } = setup([
      { items: [ev('a')], nextSyncToken: 'T1' },
      new GoogleApiError('Google ist nicht erreichbar. Bist du online?', 0),
      { items: [ev('b')], nextSyncToken: 'T2' }
    ])
    await sync.syncNow()
    const last = sync.state.lastSync
    await sync.syncNow()
    expect(sync.state.error).toContain('nicht erreichbar')
    expect(sync.state.lastSync).toBe(last)
    expect(titles()).toEqual(['a'])
    await sync.syncNow()
    expect(sync.state.error).toBeUndefined()
    expect(titles()).toEqual(['a', 'b'])
  })

  it('runs a requested sync after the current one instead of in parallel', async () => {
    const { sync, urls } = setup([
      { items: [ev('a')], nextSyncToken: 'T1' },
      { items: [], nextSyncToken: 'T2' }
    ])
    await Promise.all([sync.syncNow(), sync.syncNow(), sync.syncNow()])
    expect(urls).toHaveLength(2)
  })

  it('forgets tokens of calendars that were switched off', async () => {
    const { store, sync } = setup([{ items: [ev('a')], nextSyncToken: 'T1' }])
    await sync.syncNow()
    store.applyRemote({ calendars: { remove: [cal.id] } })
    await sync.syncNow()
    expect(JSON.parse(readFileSync(join(dir, 'google-sync.json'), 'utf8')).syncTokens).toEqual({})
  })
})
