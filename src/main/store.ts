import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import { normalizeData, type AppData } from '@shared/types'
import {
  applyPatch,
  applyPatches,
  diffEvents,
  isEmptyDiff,
  isEmptyPatch,
  RemoteLog,
  type DataPatch,
  type EventDiff,
  type RemoteChange
} from '@shared/patch'

export interface StoreListener {
  /** the UI saved changes; `diff` lists the events it touched */
  onLocalChange?(diff: EventDiff, data: AppData): void
  /** a remote patch was applied and must reach the UI */
  onRemoteChange?(change: RemoteChange, data: AppData): void
}

/**
 * Simple JSON file repository. Kept behind this module so it can be
 * swapped for SQLite later without touching the rest of the app.
 */
export class DataStore {
  private data: AppData
  private readonly file: string
  private writeTimer: NodeJS.Timeout | null = null
  private readonly log = new RemoteLog()
  private readonly listeners = new Set<StoreListener>()

  constructor() {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'data.json')
    this.data = this.read()
  }

  private read(): AppData {
    if (!existsSync(this.file)) return normalizeData(null)
    try {
      return normalizeData(JSON.parse(readFileSync(this.file, 'utf8')))
    } catch (err) {
      // keep the broken file for manual recovery instead of overwriting it
      const backup = `${this.file}.broken-${Date.now()}`
      try {
        copyFileSync(this.file, backup)
      } catch {
        /* ignore */
      }
      console.error('Could not read data file, starting fresh. Backup:', backup, err)
      return normalizeData(null)
    }
  }

  get(): AppData {
    return this.data
  }

  /** last remote patch number; the UI echoes it back with every save */
  get seq(): number {
    return this.log.seq
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Full snapshot from the UI. `baseSeq` is the last remote patch the UI had applied;
   * newer patches are replayed on top so remote changes are never lost.
   */
  set(next: AppData, baseSeq: number = this.log.seq): void {
    const merged = applyPatches(normalizeData(next), this.log.since(baseSeq))
    this.log.ack(baseSeq)
    const diff = diffEvents(this.data.events, merged.events)
    this.data = merged
    this.scheduleWrite()
    if (!isEmptyDiff(diff)) for (const l of this.listeners) l.onLocalChange?.(diff, merged)
  }

  /** change from outside the UI (sync); broadcast to the UI as a numbered patch */
  applyRemote(patch: DataPatch): RemoteChange | null {
    if (isEmptyPatch(patch)) return null
    this.data = applyPatch(this.data, patch)
    const change = this.log.record(patch)
    this.scheduleWrite()
    for (const l of this.listeners) l.onRemoteChange?.(change, this.data)
    return change
  }

  private scheduleWrite(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer)
    this.writeTimer = setTimeout(() => this.flush(), 300)
  }

  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
    renameSync(tmp, this.file)
  }

  get path(): string {
    return this.file
  }
}
