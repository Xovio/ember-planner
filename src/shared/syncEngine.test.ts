import { describe, expect, it } from 'vitest'
import { applyPatch, type DataPatch } from './patch'
import { newSyncState, trackLocal, type SyncState } from './sync'
import { createDefaultData, type AppData, type Todo } from './types'
import { DeviceSync, type DeviceSyncConfig, type DeviceSyncStorage, type SyncAccount } from './syncEngine'
import { isSealed } from './syncDrive'

/** in-memory stand-in for the Drive endpoints AppFolder uses */
class FakeDrive {
  files = new Map<string, { name: string; content: unknown }>()
  private next = 1
  requests: string[] = []

  async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const u = new URL(url)
    const method = init.method ?? 'GET'
    this.requests.push(`${method} ${u.pathname}`)
    const id = decodeURIComponent(u.pathname.split('/files/')[1] ?? '')
    if (method === 'GET' && !id) return { files: [...this.files].map(([fid, f]) => ({ id: fid, name: f.name })) } as T
    if (method === 'GET') return this.get(id) as T
    if (method === 'POST') {
      const parts = String(init.body).split(/\r\n--ember[0-9a-f]+(?:--)?/)
      const json = parts.map((p) => p.split('\r\n\r\n')[1]).filter(Boolean)
      const meta = JSON.parse(json[0]) as { name: string }
      const fid = `f${this.next++}`
      this.files.set(fid, { name: meta.name, content: JSON.parse(json[1]) })
      return { id: fid } as T
    }
    if (method === 'PATCH') {
      this.get(id)
      this.files.get(id)!.content = JSON.parse(String(init.body))
      return { id } as T
    }
    if (method === 'DELETE') {
      this.files.delete(id)
      return undefined as T
    }
    throw new Error(`unexpected ${method} ${url}`)
  }

  private get(id: string): unknown {
    const f = this.files.get(id)
    if (!f) throw Object.assign(new Error('not found'), { status: 404 })
    return structuredClone(f.content)
  }

  byName(name: string): unknown {
    return [...this.files.values()].find((f) => f.name === name)?.content
  }
}

/** what a device keeps locally, in memory */
class MemoryStorage implements DeviceSyncStorage {
  cfg: DeviceSyncConfig | null = null
  key: string | null = null
  loadConfig = (): DeviceSyncConfig | null => this.cfg
  saveConfig = (c: DeviceSyncConfig): void => void (this.cfg = structuredClone(c))
  loadKey = (): string | null => this.key
  saveKey = (k: string | null): void => void (this.key = k)
}

class Device {
  data: AppData = createDefaultData()
  state: SyncState
  sync: DeviceSync
  account: SyncAccount & { hasDrive: boolean }
  constructor(
    id: string,
    drive: FakeDrive,
    public clock = { t: Date.parse('2026-11-27T10:00:00Z') }
  ) {
    this.state = newSyncState(id)
    trackLocal(this.state, null, this.data, clock.t)
    this.account = {
      isConnected: true,
      hasDrive: true,
      request: (url, init) => drive.request(url, init),
      connect: async () => undefined,
      dropDrive: () => undefined
    }
    this.sync = new DeviceSync({
      store: {
        get: () => this.data,
        applyRemote: (patch: DataPatch) => {
          this.data = applyPatch(this.data, patch)
          return { seq: 1, patch }
        }
      },
      tracker: { state: this.state, touch: () => undefined },
      account: this.account,
      storage: new MemoryStorage(),
      defaultName: id,
      now: () => clock.t
    })
  }
  save(fn: (d: AppData) => AppData): void {
    const prev = this.data
    this.data = fn(prev)
    this.clock.t += 1000
    trackLocal(this.state, prev, this.data, this.clock.t)
  }
}

const todo = (id: string, title = id): Todo => ({
  id,
  title,
  listId: 'inbox',
  priority: 0,
  subtasks: [],
  done: false,
  createdAt: '2026-11-20T00:00:00.000Z',
  updatedAt: '2026-11-20T00:00:00.000Z'
})
const titles = (d: AppData): string[] => d.todos.map((t) => t.title).sort()

describe('DeviceSync', () => {
  it('does nothing while switched off', async () => {
    const drive = new FakeDrive()
    const pc = new Device('pc', drive)
    await pc.sync.syncNow()
    expect(drive.requests).toEqual([])
  })

  it('asks for the Drive grant instead of failing', async () => {
    const drive = new FakeDrive()
    const pc = new Device('pc', drive)
    pc.account.hasDrive = false
    const s = await pc.sync.setEnabled(true)
    expect(s.needsGrant).toBe(true)
    expect(s.error).toBeUndefined()
    expect(drive.requests).toEqual([])
  })

  it('brings changes from one device to the other through Drive', async () => {
    const drive = new FakeDrive()
    const clock = { t: Date.parse('2026-11-27T10:00:00Z') }
    const pc = new Device('pc', drive, clock)
    const phone = new Device('phone', drive, clock)
    pc.save((d) => ({ ...d, todos: [todo('a', 'vom PC')] }))
    await pc.sync.setEnabled(true)
    expect(drive.byName('ember-sync.json')).toMatchObject({ format: 1 })
    expect(drive.byName('device-pc.json')).toMatchObject({ deviceId: 'pc' })

    await phone.sync.setEnabled(true)
    expect(titles(phone.data)).toEqual(['vom PC'])

    phone.save((d) => ({ ...d, todos: d.todos.map((t) => ({ ...t, done: true })) }))
    await phone.sync.syncNow()
    await pc.sync.syncNow()
    expect(pc.data.todos[0].done).toBe(true)
    const s = pc.sync.status()
    expect(s.devices.map((d) => `${d.name}${d.self ? '*' : ''}`)).toEqual(['pc*', 'phone'])
    expect(s.lastSync).toBeDefined()
  })

  it('does not upload again when nothing changed', async () => {
    const drive = new FakeDrive()
    const pc = new Device('pc', drive)
    await pc.sync.setEnabled(true)
    drive.requests = []
    await pc.sync.syncNow()
    expect(drive.requests.filter((r) => !r.startsWith('GET'))).toEqual([])
  })

  it('encrypts, and the other device needs the passphrase', async () => {
    const drive = new FakeDrive()
    const clock = { t: Date.parse('2026-11-27T10:00:00Z') }
    const pc = new Device('pc', drive, clock)
    const phone = new Device('phone', drive, clock)
    pc.save((d) => ({ ...d, todos: [todo('a', 'geheim')] }))
    await pc.sync.setEnabled(true)
    await phone.sync.setEnabled(true)
    await pc.sync.setPassphrase('korrekt pferd')
    expect(isSealed(drive.byName('device-pc.json'))).toBe(true)
    expect(isSealed(drive.byName('device-phone.json'))).toBe(true)
    expect(JSON.stringify([...drive.files.values()])).not.toContain('geheim')

    pc.save((d) => ({ ...d, todos: [todo('a', 'neu')] }))
    await pc.sync.syncNow()
    const locked = await phone.sync.syncNow()
    expect(locked.needsPassphrase).toBe(true)
    expect(titles(phone.data)).toEqual(['geheim'])

    await expect(phone.sync.unlock('falsch!!!')).rejects.toThrow('Passphrase stimmt nicht')
    const open = await phone.sync.unlock('korrekt pferd')
    expect(open.needsPassphrase).toBe(false)
    expect(open.encrypted).toBe(true)
    expect(titles(phone.data)).toEqual(['neu'])

    await phone.sync.setPassphrase(null)
    expect(isSealed(drive.byName('device-pc.json'))).toBe(false)
    const plain = await pc.sync.syncNow()
    expect(plain.encrypted).toBe(false)
  })

  it('rejects a short passphrase', async () => {
    const pc = new Device('pc', new FakeDrive())
    await pc.sync.setEnabled(true)
    await expect(pc.sync.setPassphrase('kurz')).rejects.toThrow('mindestens')
  })

  it('removes another device and wipes everything', async () => {
    const drive = new FakeDrive()
    const clock = { t: Date.parse('2026-11-27T10:00:00Z') }
    const pc = new Device('pc', drive, clock)
    const phone = new Device('phone', drive, clock)
    await phone.sync.setEnabled(true)
    await pc.sync.setEnabled(true)
    expect(pc.sync.status().devices).toHaveLength(2)
    await pc.sync.removeDevice('phone')
    expect(drive.byName('device-phone.json')).toBeUndefined()
    expect(pc.sync.status().devices).toHaveLength(1)
    await pc.sync.wipe()
    // the wipe is followed by a fresh upload of this device only
    expect([...drive.files.values()].map((f) => f.name).sort()).toEqual(['device-pc.json', 'ember-sync.json'])
  })

  it('re-creates its file if another device wiped the folder', async () => {
    const drive = new FakeDrive()
    const pc = new Device('pc', drive)
    await pc.sync.setEnabled(true)
    drive.files.clear()
    pc.save((d) => ({ ...d, todos: [todo('x')] }))
    await pc.sync.syncNow()
    expect(drive.byName('device-pc.json')).toMatchObject({ deviceId: 'pc' })
  })
})
