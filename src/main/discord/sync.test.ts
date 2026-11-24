import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalendarEvent, CalendarInfo } from '@shared/types'
import type { DEvent } from '@shared/discord'

let dir = ''
vi.mock('electron', () => ({ app: { getPath: () => dir } }))

const { DataStore } = await import('../store')
const { DiscordSync } = await import('./sync')
const { DiscordApiError } = await import('./account')

const NOW = Date.parse('2026-11-24T12:00:00Z')
const GUILD = '111'

const local: CalendarInfo = { id: 'personal', name: 'Persönlich', color: 'red', visible: true }
const guildCal: CalendarInfo = {
  id: `d:${GUILD}`,
  name: 'DnD-Runde',
  color: 'violet',
  visible: true,
  readOnly: true,
  defaultReminders: [30],
  external: { provider: 'discord', id: GUILD }
}

interface Call {
  method: string
  path: string
  body?: Record<string, unknown>
}

const dEvent = (id: string, extra: Partial<DEvent> = {}): DEvent => ({
  id,
  guild_id: GUILD,
  channel_id: null,
  name: 'One-Shot',
  description: null,
  scheduled_start_time: '2026-11-28T18:00:00+00:00',
  scheduled_end_time: '2026-11-28T22:00:00+00:00',
  status: 1,
  entity_type: 3,
  entity_metadata: { location: 'Bei Mia' },
  user_count: 3,
  ...extra
})

/** fake Discord: `events` is the server's list, writes go through `onWrite` */
function setup(events: DEvent[] = [], onWrite: (c: Call) => DEvent | Error | undefined = () => undefined) {
  const store = new DataStore()
  store.applyRemote({ calendars: { upsert: [local, guildCal] } })
  const calls: Call[] = []
  const account = {
    isConnected: true,
    request: vi.fn(async (path: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      if (method === 'GET') {
        if (path.includes('/channels')) return [{ id: 'vc1', name: 'Taverne', type: 2 }]
        return events
      }
      const call: Call = { method, path, body: init.body ? JSON.parse(String(init.body)) : undefined }
      calls.push(call)
      const r = onWrite(call)
      if (r instanceof Error) throw r
      return r
    })
  }
  const notices: string[] = []
  const changed: string[] = []
  const sync = new DiscordSync({
    store,
    account: account as never,
    dir,
    now: () => NOW,
    onNotice: (t) => notices.push(t),
    onEventsChanged: (diff) => changed.push(...diff.changed.map((c) => c.after.id))
  })
  store.subscribe({ onLocalChange: (diff) => sync.recordLocal(diff) })
  const ui = (fn: (events: CalendarEvent[]) => CalendarEvent[]): void => {
    const d = store.get()
    store.set({ ...d, events: fn(d.events) }, store.seq)
  }
  return { store, sync, calls, ui, notices, changed, setEvents: (e: DEvent[]) => (events = e) }
}

const session = (extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 's1',
  calendarId: 'personal',
  title: 'Session 12: Die Gruft',
  start: '2026-11-27T18:00:00.000Z',
  end: '2026-11-27T22:00:00.000Z',
  allDay: false,
  reminders: [],
  location: 'Discord',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  ...extra
})

/** Discord's answer to a create/patch: the body echoed as an event */
const echo = (id: string) => (c: Call): DEvent =>
  dEvent(id, {
    name: String(c.body?.name ?? 'x'),
    description: (c.body?.description as string) || null,
    scheduled_start_time: String(c.body?.scheduled_start_time),
    scheduled_end_time: (c.body?.scheduled_end_time as string) ?? null,
    entity_type: Number(c.body?.entity_type ?? 3),
    channel_id: (c.body?.channel_id as string) ?? null,
    entity_metadata: (c.body?.entity_metadata as { location: string }) ?? null,
    user_count: 0
  })

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ember-discord-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('reading server events', () => {
  it('shows everyone’s events read-only in the server calendar', async () => {
    const { store, sync } = setup([dEvent('e1', { channel_id: 'vc1', entity_type: 2, entity_metadata: null, scheduled_end_time: null })])
    await sync.syncNow()
    const ev = store.get().events.find((e) => e.id === 'd:e1')!
    expect(ev).toMatchObject({
      calendarId: `d:${GUILD}`,
      title: 'One-Shot',
      location: '🔊 Taverne',
      reminders: [30],
      discord: { guildId: GUILD, eventId: 'e1', own: false, userCount: 3, status: 1 }
    })
    // no end at Discord: default length
    expect(Date.parse(ev.end) - Date.parse(ev.start)).toBe(60 * 60_000)
  })

  it('removes events gone from Discord, but keeps finished ones', async () => {
    const past = dEvent('old', { scheduled_start_time: '2026-11-20T18:00:00Z', scheduled_end_time: '2026-11-20T20:00:00Z' })
    const { store, sync, setEvents } = setup([dEvent('e1'), past])
    await sync.syncNow()
    setEvents([])
    await sync.syncNow()
    const ids = store.get().events.map((e) => e.id)
    expect(ids).toEqual(['d:old'])
    expect(store.get().events[0].discord?.status).toBe(3)
  })
})

describe('announcing', () => {
  it('creates the Discord event and links it', async () => {
    const { store, sync, calls, ui } = setup([], echo('new1'))
    ui(() => [session()])
    await sync.announce('s1', { guildId: GUILD, kind: 'external', location: 'Discord' })
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: `/guilds/${GUILD}/scheduled-events`,
      body: {
        name: 'Session 12: Die Gruft',
        entity_type: 3,
        channel_id: null,
        entity_metadata: { location: 'Discord' },
        scheduled_start_time: '2026-11-27T18:00:00.000Z',
        privacy_level: 2
      }
    })
    expect(store.get().events.find((e) => e.id === 's1')!.discord).toMatchObject({
      guildId: GUILD,
      eventId: 'new1',
      own: true,
      kind: 'external',
      synced: { name: 'Session 12: Die Gruft', start: '2026-11-27T18:00:00.000Z' }
    })
  })

  it('in a voice channel', async () => {
    const { sync, calls, ui } = setup([], echo('new1'))
    ui(() => [session()])
    await sync.announce('s1', { guildId: GUILD, kind: 'voice', channelId: 'vc1' })
    expect(calls[0].body).toMatchObject({ entity_type: 2, channel_id: 'vc1' })
    expect(calls[0].body!.entity_metadata).toBeUndefined()
  })

  it('refuses past events and series', async () => {
    const { sync, ui } = setup()
    ui(() => [session({ start: '2026-11-20T18:00:00.000Z' }), session({ id: 's2', recurrence: { freq: 'weekly', interval: 1 } })])
    await expect(sync.announce('s1', { guildId: GUILD, kind: 'external', location: 'x' })).rejects.toThrow(/begonnen/)
    await expect(sync.announce('s2', { guildId: GUILD, kind: 'external', location: 'x' })).rejects.toThrow(/Serien/)
  })
})

describe('following an announced event', () => {
  async function announced(list: DEvent[] = []) {
    const ctx = setup(list, echo('a1'))
    ctx.ui(() => [session()])
    await ctx.sync.announce('s1', { guildId: GUILD, kind: 'external', location: 'Discord' })
    ctx.calls.length = 0
    return ctx
  }

  it('uploads local changes and does not show the event twice', async () => {
    const ctx = await announced()
    const linked = ctx.store.get().events.find((e) => e.id === 's1')!
    ctx.setEvents([dEvent('a1', { name: linked.title, scheduled_start_time: linked.start, scheduled_end_time: linked.end, entity_metadata: { location: 'Discord' }, user_count: 5 })])
    ctx.ui((evs) => evs.map((e) => (e.id === 's1' ? { ...e, start: '2026-11-27T19:00:00.000Z', end: '2026-11-27T23:00:00.000Z' } : e)))
    await ctx.sync.syncNow()
    expect(ctx.calls).toHaveLength(1)
    expect(ctx.calls[0]).toMatchObject({ method: 'PATCH', path: `/guilds/${GUILD}/scheduled-events/a1` })
    expect(ctx.calls[0].body).toMatchObject({ scheduled_start_time: '2026-11-27T19:00:00.000Z' })
    expect(ctx.store.get().events.some((e) => e.id === 'd:a1')).toBe(false)
  })

  it('takes over changes made in Discord and tells Google about them', async () => {
    const ctx = await announced()
    const linked = ctx.store.get().events.find((e) => e.id === 's1')!
    ctx.setEvents([dEvent('a1', { name: linked.title, scheduled_start_time: '2026-11-27T20:00:00Z', scheduled_end_time: '2026-11-27T23:00:00Z', entity_metadata: { location: 'Discord' }, user_count: 7 })])
    await ctx.sync.syncNow()
    expect(ctx.calls).toHaveLength(0)
    const ev = ctx.store.get().events.find((e) => e.id === 's1')!
    expect(ev).toMatchObject({ start: '2026-11-27T20:00:00.000Z', end: '2026-11-27T23:00:00.000Z', discord: { userCount: 7 } })
    expect(ctx.notices.at(-1)).toMatch(/in Discord geändert/)
    expect(ctx.changed).toContain('s1')
  })

  it('only the interested count changed: no upload, no change for Google', async () => {
    const ctx = await announced()
    const linked = ctx.store.get().events.find((e) => e.id === 's1')!
    ctx.setEvents([dEvent('a1', { name: linked.title, scheduled_start_time: linked.start, scheduled_end_time: linked.end, entity_metadata: { location: 'Discord' }, user_count: 9 })])
    ctx.changed.length = 0
    await ctx.sync.syncNow()
    expect(ctx.calls).toHaveLength(0)
    expect(ctx.store.get().events.find((e) => e.id === 's1')!.discord?.userCount).toBe(9)
    expect(ctx.changed).toEqual([])
  })

  it('deleting cancels the Discord event; an undo before that keeps it', async () => {
    const ctx = await announced()
    const keep = ctx.store.get().events
    const l = keep[0]
    ctx.setEvents([dEvent('a1', { name: l.title, scheduled_start_time: l.start, scheduled_end_time: l.end, entity_metadata: { location: 'Discord' } })])
    ctx.ui(() => [])
    ctx.ui(() => keep) // undo
    await ctx.sync.syncNow()
    expect(ctx.calls.filter((c) => c.method === 'PATCH' && c.body?.status === 4)).toHaveLength(0)

    ctx.ui(() => [])
    await ctx.sync.syncNow()
    expect(ctx.calls.find((c) => c.body?.status === 4)).toMatchObject({ path: `/guilds/${GUILD}/scheduled-events/a1` })
    expect(ctx.notices.at(-1)).toMatch(/abgesagt/)
  })

  it('keeps a cancellation while offline and sends it later', async () => {
    let offline = true
    const ctx = setup([], (c) => (c.method === 'POST' ? echo('a1')(c) : offline ? new DiscordApiError('offline', 0) : undefined))
    ctx.ui(() => [session()])
    await ctx.sync.announce('s1', { guildId: GUILD, kind: 'external', location: 'Discord' })
    ctx.ui(() => [])
    await ctx.sync.syncNow()
    expect(ctx.sync.state.pending).toBe(1)
    offline = false
    await ctx.sync.syncNow()
    expect(ctx.sync.state.pending).toBe(0)
  })

  it('an event gone from Discord before it starts is marked cancelled', async () => {
    const ctx = await announced()
    ctx.setEvents([])
    await ctx.sync.syncNow()
    expect(ctx.store.get().events.find((e) => e.id === 's1')!.discord?.status).toBe(4)
  })
})
