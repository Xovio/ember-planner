import { describe, expect, it } from 'vitest'
import {
  addTime,
  ANY,
  DEFAULT_APPS,
  emptyLog,
  formatDuration,
  milestone,
  parseTasklist,
  periodStart,
  prepConfig,
  runningApps,
  sumLog
} from './apptime'

describe('parseTasklist', () => {
  it('reads the image names from CSV lines', () => {
    const out = '"System Idle Process","0","Services","0","8 K"\r\n"Obsidian.exe","1234","Console","1","300.000 K"\r\n"Obsidian.exe","1240","Console","1","90 K"\r\n'
    expect(parseTasklist(out)).toEqual(['System Idle Process', 'Obsidian.exe'])
  })
})

describe('runningApps', () => {
  it('matches process names without case', () => {
    expect(runningApps(DEFAULT_APPS, ['obsidian.exe', 'Foundry Virtual Tabletop.exe'])).toEqual(['obsidian', 'foundry'])
  })
  it('does not count the OneNote send-to helper', () => {
    expect(runningApps(DEFAULT_APPS, ['ONENOTEM.EXE'])).toEqual([])
    expect(runningApps(DEFAULT_APPS, ['ONENOTE.EXE'])).toEqual(['onenote'])
  })
})

describe('log', () => {
  it('adds per app and once for the total', () => {
    let log = addTime(emptyLog(), '2026-11-24', ['obsidian', 'foundry'], 60)
    log = addTime(log, '2026-11-24', ['obsidian'], 60)
    expect(log.days['2026-11-24']).toEqual({ obsidian: 120, foundry: 60, [ANY]: 120 })
  })
  it('sums a period', () => {
    let log = addTime(emptyLog(), '2026-11-20', ['obsidian'], 100)
    log = addTime(log, '2026-11-24', ['obsidian'], 50)
    const now = new Date(2026, 10, 24, 12)
    expect(periodStart('week', now)).toBe('2026-11-23')
    expect(sumLog(log, periodStart('week', now), now).obsidian).toBe(50)
    expect(sumLog(log, null, now)[ANY]).toBe(150)
  })
})

describe('prepConfig', () => {
  it('falls back to the defaults and repairs numbers', () => {
    const c = prepConfig({ baseHours: 'x', idleMinutes: 0 })
    expect(c.apps).toEqual(DEFAULT_APPS)
    expect(c.baseHours).toBe(0)
    expect(c.idleMinutes).toBe(15)
  })
})

describe('formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(59)).toBe('0 min')
    expect(formatDuration(45 * 60)).toBe('45 min')
    expect(formatDuration(3 * 3600 + 5 * 60)).toBe('3 h 05 min')
    expect(formatDuration(1234 * 3600)).toBe('1.234 h')
  })
  it('finds the next milestone', () => {
    expect(milestone(3)).toEqual({ from: 0, to: 10 })
    expect(milestone(700)).toEqual({ from: 500, to: 1000 })
    expect(milestone(4523)).toEqual({ from: 4500, to: 5000 })
  })
})
