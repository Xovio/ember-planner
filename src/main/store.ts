import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, copyFileSync } from 'fs'
import { join } from 'path'
import { normalizeData, type AppData } from '@shared/types'

/**
 * Simple JSON file repository. Kept behind this module so it can be
 * swapped for SQLite later without touching the rest of the app.
 */
export class DataStore {
  private data: AppData
  private readonly file: string
  private writeTimer: NodeJS.Timeout | null = null

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

  set(next: AppData): void {
    this.data = normalizeData(next)
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
