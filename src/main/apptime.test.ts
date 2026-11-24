import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { AppTimeTracker } from './apptime'
import { ANY, PREP_DEFAULTS, type AppTimeState, type PrepConfig } from '@shared/apptime'

function setup(opts: { processes: string[]; idle?: number; cfg?: Partial<PrepConfig> }) {
  const dir = mkdtempSync(join(tmpdir(), 'apptime-'))
  let now = new Date(2026, 10, 24, 10, 0, 0)
  const updates: AppTimeState[] = []
  const t = new AppTimeTracker({
    dir,
    config: () => ({ ...PREP_DEFAULTS, ...opts.cfg }),
    idleSeconds: () => opts.idle ?? 0,
    listProcesses: async () => opts.processes,
    onUpdate: (s) => updates.push(s),
    intervalMs: 60_000,
    now: () => now
  })
  const advance = (sec: number): void => {
    now = new Date(now.getTime() + sec * 1000)
  }
  return { t, dir, advance, updates }
}

describe('AppTimeTracker', () => {
  it('counts the time between checks for open apps', async () => {
    const { t, advance } = setup({ processes: ['Obsidian.exe', 'explorer.exe'] })
    await t.tick()
    advance(60)
    await t.tick()
    advance(60)
    await t.tick()
    expect(t.state.log.days['2026-11-24']).toEqual({ obsidian: 120, [ANY]: 120 })
    expect(t.state.running).toEqual(['obsidian'])
  })

  it('caps long gaps such as sleep', async () => {
    const { t, advance } = setup({ processes: ['Obsidian.exe'] })
    await t.tick()
    advance(8 * 3600)
    await t.tick()
    expect(t.state.log.days['2026-11-24'].obsidian).toBe(90)
  })

  it('pauses while idle', async () => {
    const { t, advance } = setup({ processes: ['Obsidian.exe'], idle: 20 * 60 })
    await t.tick()
    advance(60)
    await t.tick()
    expect(t.state.log.days).toEqual({})
    expect(t.state.running).toEqual(['obsidian'])
  })

  it('keeps counting while idle when pausing is off', async () => {
    const { t, advance } = setup({ processes: ['Obsidian.exe'], idle: 20 * 60, cfg: { pauseWhenIdle: false } })
    await t.tick()
    advance(60)
    await t.tick()
    expect(t.state.log.days['2026-11-24'].obsidian).toBe(60)
  })

  it('does nothing when switched off', async () => {
    const { t, advance } = setup({ processes: ['Obsidian.exe'], cfg: { enabled: false } })
    await t.tick()
    advance(60)
    await t.tick()
    expect(t.state.log.days).toEqual({})
  })

  it('saves to apptime.json and reads it back', async () => {
    const { t, dir, advance } = setup({ processes: ['Obsidian.exe'] })
    await t.tick()
    advance(60)
    await t.tick()
    t.flush()
    expect(JSON.parse(readFileSync(join(dir, 'apptime.json'), 'utf8')).days['2026-11-24'].obsidian).toBe(60)
  })
})
