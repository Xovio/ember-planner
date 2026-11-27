import { randomUUID } from 'crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { newSyncState, trackLocal, type SyncState } from '@shared/sync'
import type { AppData } from '@shared/types'

/**
 * Keeps the change stamps for device sync (docs/SYNC.md) in `device-sync.json`.
 * Runs from the first start on, even with sync switched off, so that turning sync on later
 * knows which entries changed when and which were deleted.
 */
export class SyncTracker {
  readonly state: SyncState
  private readonly file: string
  private timer: NodeJS.Timeout | null = null

  constructor(dir: string, data: AppData, now = Date.now()) {
    this.file = join(dir, 'device-sync.json')
    this.state = this.read() ?? newSyncState(randomUUID())
    // stamps whatever is not stamped yet: everything on the first run, nothing on later ones
    if (trackLocal(this.state, null, data, now) || !existsSync(this.file)) this.write()
  }

  private read(): SyncState | null {
    if (!existsSync(this.file)) return null
    try {
      const raw = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<SyncState>
      if (typeof raw.deviceId !== 'string') return null
      return { deviceId: raw.deviceId, clock: raw.clock ?? 0, stamps: raw.stamps ?? {} }
    } catch {
      return null // a broken file only costs exact stamps; the next sync falls back to initial ones
    }
  }

  /** a save from the UI: stamp what changed */
  observe(prev: AppData, next: AppData, now = Date.now()): void {
    if (trackLocal(this.state, prev, next, now)) this.scheduleWrite()
  }

  /** stamps were changed from outside (merging other devices' docs) */
  touch(): void {
    this.scheduleWrite()
  }

  private scheduleWrite(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 1000)
  }

  flush(): void {
    if (!this.timer) return
    clearTimeout(this.timer)
    this.timer = null
    this.write()
  }

  private write(): void {
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.state), 'utf8')
    renameSync(tmp, this.file)
  }
}
