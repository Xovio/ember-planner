import { addDays, startOfMonth, startOfWeek } from 'date-fns'
import { localDate } from './todo'

/**
 * Prep tracker: counts how long chosen programs (e.g. Obsidian, OneNote, Foundry) are open.
 * The main process polls the process list once a minute and adds the elapsed time per day and app;
 * the widget only reads the log. Config lives in settings.widgetConfig[PREP_WIDGET_ID].
 */

export const PREP_WIDGET_ID = 'prep-tracker'

/** key for "at least one tracked app was open" – the total without double counting overlaps */
export const ANY = '*'

export interface TrackedApp {
  id: string
  name: string
  /** process names, e.g. "Obsidian.exe"; compared without case */
  exes: string[]
}

export interface PrepConfig extends Record<string, unknown> {
  enabled: boolean
  title: string
  apps: TrackedApp[]
  /** hours spent before tracking started, added to the all-time total */
  baseHours: number
  /** stop counting while nobody touched mouse or keyboard for `idleMinutes` (or the PC is locked) */
  pauseWhenIdle: boolean
  idleMinutes: number
}

export const DEFAULT_APPS: TrackedApp[] = [
  { id: 'obsidian', name: 'Obsidian', exes: ['Obsidian.exe'] },
  // ONENOTEM.EXE is the always-running "Send to OneNote" helper, so it must not count
  { id: 'onenote', name: 'OneNote', exes: ['ONENOTE.EXE', 'OneNoteIm.exe'] },
  { id: 'foundry', name: 'Foundry', exes: ['Foundry Virtual Tabletop.exe', 'FoundryVTT.exe'] }
]

export const PREP_DEFAULTS: PrepConfig = {
  enabled: true,
  title: 'D&D-Prep',
  apps: DEFAULT_APPS,
  baseHours: 0,
  pauseWhenIdle: true,
  idleMinutes: 15
}

/** stored config merged over the defaults, with broken values repaired */
export function prepConfig(stored: Record<string, unknown> | undefined): PrepConfig {
  const c = { ...PREP_DEFAULTS, ...(stored ?? {}) } as PrepConfig
  return {
    ...c,
    enabled: c.enabled !== false,
    apps: Array.isArray(c.apps) ? c.apps.filter((a) => a && typeof a.id === 'string' && Array.isArray(a.exes)) : DEFAULT_APPS,
    baseHours: Number.isFinite(Number(c.baseHours)) ? Math.max(0, Number(c.baseHours)) : 0,
    idleMinutes: Math.max(1, Math.round(Number(c.idleMinutes)) || PREP_DEFAULTS.idleMinutes)
  }
}

/** seconds per local day ("2026-11-24") and app id (plus ANY) */
export interface AppTimeLog {
  version: 1
  days: Record<string, Record<string, number>>
}

export const emptyLog = (): AppTimeLog => ({ version: 1, days: {} })

export function normalizeLog(raw: unknown): AppTimeLog {
  const r = raw as Partial<AppTimeLog> | null
  if (!r || typeof r !== 'object' || !r.days || typeof r.days !== 'object') return emptyLog()
  return { version: 1, days: r.days }
}

/** what the widget gets from the main process */
export interface AppTimeState {
  log: AppTimeLog
  /** ids of tracked apps open at the last check */
  running: string[]
  /** false outside Windows/desktop or when the list could not be read */
  available: boolean
}

export interface AppTimeApi {
  get(): Promise<AppTimeState>
  /** names of the programs running right now, to fill in process names */
  processes(): Promise<string[]>
  onUpdate(cb: (s: AppTimeState) => void): () => void
}

/** process names from `tasklist /fo csv /nh` output */
export function parseTasklist(csv: string): string[] {
  const names = new Set<string>()
  for (const line of csv.split(/\r?\n/)) {
    const m = /^"([^"]+)"/.exec(line.trim())
    if (m) names.add(m[1])
  }
  return [...names]
}

/** ids of the apps that have one of their processes in `processes` */
export function runningApps(apps: TrackedApp[], processes: string[]): string[] {
  const open = new Set(processes.map((p) => p.toLowerCase()))
  return apps.filter((a) => a.exes.some((e) => open.has(e.trim().toLowerCase()))).map((a) => a.id)
}

/** add `seconds` for each running app (and once for ANY) on `day` */
export function addTime(log: AppTimeLog, day: string, ids: string[], seconds: number): AppTimeLog {
  if (ids.length === 0 || seconds <= 0) return log
  const d = { ...(log.days[day] ?? {}) }
  for (const id of ids) d[id] = (d[id] ?? 0) + seconds
  d[ANY] = (d[ANY] ?? 0) + seconds
  return { ...log, days: { ...log.days, [day]: d } }
}

export type Period = 'today' | 'week' | 'month' | 'all'

/** first day (inclusive) of a period, or null for all time */
export function periodStart(period: Period, now: Date): string | null {
  if (period === 'today') return localDate(now)
  if (period === 'week') return localDate(startOfWeek(now, { weekStartsOn: 1 }))
  if (period === 'month') return localDate(startOfMonth(now))
  return null
}

/** seconds per app id (and ANY) from `from` (inclusive) up to today */
export function sumLog(log: AppTimeLog, from: string | null, now: Date = new Date()): Record<string, number> {
  const to = localDate(addDays(now, 1))
  const out: Record<string, number> = {}
  for (const [day, entry] of Object.entries(log.days)) {
    if ((from && day < from) || day >= to) continue
    for (const [id, s] of Object.entries(entry)) out[id] = (out[id] ?? 0) + s
  }
  return out
}

/** "0 min", "45 min", "3 h 05 min", "1.234 h" */
export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h >= 100) return `${h.toLocaleString('de-DE')} h`
  return `${h} h ${String(min % 60).padStart(2, '0')} min`
}

/** the round number of hours to aim for next (10, 25, 50, 100, 250, 500, 1.000, then every 500) and the one before */
export function milestone(hours: number): { from: number; to: number } {
  const steps = [0, 10, 25, 50, 100, 250, 500, 1000]
  for (let i = 1; i < steps.length; i++) if (hours < steps[i]) return { from: steps[i - 1], to: steps[i] }
  const to = Math.floor(hours / 500) * 500 + 500
  return { from: to - 500, to }
}
