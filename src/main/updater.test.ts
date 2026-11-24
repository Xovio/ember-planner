import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import { friendlyError, Updater, type UpdaterBackend } from './updater'
import type { UpdateInfo } from '@shared/update'

class FakeBackend extends EventEmitter implements UpdaterBackend {
  autoDownload = false
  autoInstallOnAppQuit = false
  checks = 0
  installed: [boolean | undefined, boolean | undefined] | null = null
  checkForUpdates = vi.fn(async () => {
    this.checks++
    this.emit('checking-for-update')
  })
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void {
    this.installed = [isSilent, isForceRunAfter]
  }
}

function setup(enabled = true): { b: FakeBackend; u: Updater; seen: UpdateInfo[]; beforeInstall: ReturnType<typeof vi.fn> } {
  const b = new FakeBackend()
  const seen: UpdateInfo[] = []
  const beforeInstall = vi.fn()
  const u = new Updater({
    backend: b,
    currentVersion: '0.1.0',
    enabled: () => enabled,
    onStatus: (i) => seen.push(i),
    beforeInstall,
    firstDelayMs: 10,
    intervalMs: 1000
  })
  return { b, u, seen, beforeInstall }
}

describe('Updater', () => {
  it('is unsupported without a backend and never installs', () => {
    const beforeInstall = vi.fn()
    const u = new Updater({ backend: null, currentVersion: '0.1.0', enabled: () => true, onStatus: vi.fn(), beforeInstall })
    expect(u.info).toEqual({ current: '0.1.0', status: { state: 'unsupported' } })
    u.install()
    expect(beforeInstall).not.toHaveBeenCalled()
  })

  it('downloads automatically and installs on quit', () => {
    const { b } = setup()
    expect(b.autoDownload).toBe(true)
    expect(b.autoInstallOnAppQuit).toBe(true)
  })

  it('walks through checking → downloading → ready', async () => {
    const { b, u, seen } = setup()
    await u.check()
    expect(u.info.status).toEqual({ state: 'checking' })
    b.emit('update-available', { version: '0.2.0' })
    b.emit('download-progress', { percent: 42.5 })
    expect(u.info.status).toEqual({ state: 'downloading', version: '0.2.0', percent: 42.5 })
    b.emit('update-downloaded', { version: '0.2.0' })
    expect(u.info.status).toEqual({ state: 'ready', version: '0.2.0' })
    expect(seen.map((s) => s.status.state)).toEqual(['checking', 'downloading', 'downloading', 'ready'])
  })

  it('reports "up to date"', async () => {
    const { b, u } = setup()
    await u.check()
    b.emit('update-not-available', {})
    expect(u.info.status.state).toBe('uptodate')
  })

  it('does not check again while an update waits, and keeps it after a later error', async () => {
    const { b, u } = setup()
    b.emit('update-downloaded', { version: '0.2.0' })
    await u.check()
    expect(b.checks).toBe(0)
    b.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'))
    expect(u.info.status).toEqual({ state: 'ready', version: '0.2.0' })
  })

  it('installs only when ready, silently and with restart', () => {
    const { b, u, beforeInstall } = setup()
    u.install()
    expect(b.installed).toBeNull()
    b.emit('update-downloaded', { version: '0.2.0' })
    u.install()
    expect(beforeInstall).toHaveBeenCalledOnce()
    expect(b.installed).toEqual([true, true])
  })

  it('turns a rejected check into an error state', async () => {
    const { b, u } = setup()
    b.checkForUpdates.mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND github.com'))
    await u.check()
    expect(u.info.status).toEqual({ state: 'error', message: 'Keine Verbindung zu GitHub.' })
  })

  it('checks on a timer only when the setting is on', () => {
    vi.useFakeTimers()
    try {
      const on = setup(true)
      const off = setup(false)
      on.u.start()
      off.u.start()
      vi.advanceTimersByTime(10)
      expect(on.b.checks).toBe(1)
      expect(off.b.checks).toBe(0)
      on.b.emit('update-not-available', {})
      vi.advanceTimersByTime(1000)
      expect(on.b.checks).toBe(2)
      on.u.stop()
      vi.advanceTimersByTime(5000)
      expect(on.b.checks).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('treats "no release on GitHub yet" as up to date', async () => {
    const { b, u } = setup()
    await u.check()
    b.emit('error', new Error('HttpError: 404 \n"method: GET url: https://github.com/…/releases.atom"'))
    expect(u.info.status.state).toBe('uptodate')
  })
})

describe('friendlyError', () => {
  it('translates common failures', () => {
    expect(friendlyError(new Error('net::ERR_INTERNET_DISCONNECTED'))).toBe('Keine Verbindung zu GitHub.')
    expect(friendlyError('something odd\nstack')).toBe('something odd')
  })
})
