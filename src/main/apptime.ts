import { execFile } from 'child_process'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  addTime,
  emptyLog,
  normalizeLog,
  parseTasklist,
  runningApps,
  type AppTimeLog,
  type AppTimeState,
  type PrepConfig
} from '@shared/apptime'
import { localDate } from '@shared/todo'

export interface AppTimeDeps {
  dir: string
  config(): PrepConfig
  /** seconds without mouse/keyboard input; Infinity when the PC is locked */
  idleSeconds(): number
  listProcesses?(): Promise<string[]>
  onUpdate(state: AppTimeState): void
  intervalMs?: number
  now?(): Date
}

/** a tick longer than this (sleep, hibernate, blocked event loop) only counts this much */
const MAX_GAP_FACTOR = 1.5

export function listWindowsProcesses(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, out) =>
      err ? reject(err) : resolve(parseTasklist(out))
    )
  })
}

/** polls the process list and adds up how long the tracked apps were open, saved in apptime.json */
export class AppTimeTracker {
  private log: AppTimeLog
  private running: string[] = []
  private available = process.platform === 'win32'
  private timer: NodeJS.Timeout | null = null
  private writeTimer: NodeJS.Timeout | null = null
  private last: number | null = null
  private busy = false
  private readonly file: string
  private readonly interval: number
  private readonly list: () => Promise<string[]>
  private readonly now: () => Date

  constructor(private readonly deps: AppTimeDeps) {
    this.file = join(deps.dir, 'apptime.json')
    this.interval = deps.intervalMs ?? 60_000
    this.list = deps.listProcesses ?? listWindowsProcesses
    this.now = deps.now ?? (() => new Date())
    if (deps.listProcesses) this.available = true
    this.log = this.read()
  }

  private read(): AppTimeLog {
    try {
      return existsSync(this.file) ? normalizeLog(JSON.parse(readFileSync(this.file, 'utf8'))) : emptyLog()
    } catch {
      return emptyLog()
    }
  }

  get state(): AppTimeState {
    return { log: this.log, running: this.running, available: this.available }
  }

  start(): void {
    if (!this.available || this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), this.interval)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.flush()
  }

  async processes(): Promise<string[]> {
    if (!this.available) return []
    return (await this.list()).sort((a, b) => a.localeCompare(b))
  }

  /** one check: which apps are open, and add the time since the last check */
  async tick(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      const cfg = this.deps.config()
      const at = this.now().getTime()
      const elapsed = this.last === null ? 0 : Math.min(at - this.last, this.interval * MAX_GAP_FACTOR) / 1000
      this.last = at
      if (!cfg.enabled || cfg.apps.length === 0) {
        this.setRunning([])
        return
      }
      const running = runningApps(cfg.apps, await this.list())
      const idle = cfg.pauseWhenIdle && this.deps.idleSeconds() >= cfg.idleMinutes * 60
      if (!idle && elapsed > 0 && running.length > 0) {
        this.log = addTime(this.log, localDate(new Date(at)), running, Math.round(elapsed))
        this.scheduleWrite()
        this.running = running
        this.deps.onUpdate(this.state)
      } else {
        this.setRunning(running)
      }
    } catch (err) {
      console.error('[apptime] could not read the process list', err)
    } finally {
      this.busy = false
    }
  }

  private setRunning(ids: string[]): void {
    if (ids.join() === this.running.join()) return
    this.running = ids
    this.deps.onUpdate(this.state)
  }

  private scheduleWrite(): void {
    if (this.writeTimer) return
    this.writeTimer = setTimeout(() => this.flush(), 5_000)
  }

  flush(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = null
    try {
      const tmp = `${this.file}.tmp`
      writeFileSync(tmp, JSON.stringify(this.log), 'utf8')
      renameSync(tmp, this.file)
    } catch (err) {
      console.error('[apptime] could not save', err)
    }
  }
}
