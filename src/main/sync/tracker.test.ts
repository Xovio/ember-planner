import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultData } from '@shared/types'
import { SyncTracker } from './tracker'

const dirs: string[] = []
const tempDir = (): string => {
  const d = mkdtempSync(join(tmpdir(), 'ember-sync-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('SyncTracker', () => {
  it('creates a device id once and keeps it across starts', () => {
    const dir = tempDir()
    const first = new SyncTracker(dir, createDefaultData())
    const second = new SyncTracker(dir, createDefaultData())
    expect(first.state.deviceId).toMatch(/[0-9a-f-]{36}/)
    expect(second.state.deviceId).toBe(first.state.deviceId)
  })

  it('stamps saves and writes them on flush', () => {
    const dir = tempDir()
    const data = createDefaultData()
    const t = new SyncTracker(dir, data, 1000)
    const next = { ...data, lists: data.lists.filter((l) => l.id !== 'campaigns') }
    t.observe(data, next, 5000)
    t.flush()
    const saved = JSON.parse(readFileSync(join(dir, 'device-sync.json'), 'utf8'))
    expect(saved.stamps['lists/campaigns']).toEqual({ t: 5000, d: t.state.deviceId, del: true })
  })
})
