import { createDemoData } from './demo'
import { normalizeData, type AppData, type LoadResult, type ReminderPayload, type TitleBarTheme } from '@shared/types'
import type { RemoteChange } from '@shared/patch'
import type { GoogleApi } from '@shared/google'
import type { DiscordApi } from '@shared/discord'
import type { UpdateApi } from '@shared/update'
import type { AppTimeApi } from '@shared/apptime'
import type { LauncherApi } from '@shared/launcher'

export interface FileFilter {
  name: string
  extensions: string[]
}

/** file written into the same folder as the main file */
export interface ExtraFile {
  name: string
  content: string
}

export interface BackupInfo {
  file: string
  at: string
  size: number
  auto: boolean
}

export interface PlannerApi {
  kind: 'electron' | 'browser'
  platform: string
  load(): Promise<LoadResult>
  /** `baseSeq`: number of the last remote change already contained in `data` */
  save(data: AppData, baseSeq: number): Promise<boolean>
  /** changes that did not come from the UI, e.g. pulled from Google */
  onRemoteChange(cb: (c: RemoteChange) => void): () => void
  setTitleBarTheme(t: TitleBarTheme): void
  listBackups(): Promise<BackupInfo[]>
  createBackup(): Promise<BackupInfo | null>
  readBackup(file: string): Promise<string>
  openBackupFolder(): Promise<string>
  /** returns the saved path, or null when cancelled */
  saveFile(name: string, content: string, filters: FileFilter[], extras?: ExtraFile[]): Promise<string | null>
  openFile(filters: FileFilter[]): Promise<{ name: string; content: string } | null>
  onReminder(cb: (p: ReminderPayload) => void): () => void
  onOpenEvent(cb: (eventId: string) => void): () => void
  onOpenTodo(cb: (todoId: string) => void): () => void
  onNewEvent(cb: () => void): () => void
  /** only in the desktop app */
  google?: GoogleApi
  /** only in the desktop app */
  discord?: DiscordApi
  /** only in the desktop app */
  updates?: UpdateApi
  /** only in the desktop app */
  appTime?: AppTimeApi
  /** only in the desktop app */
  launcher?: LauncherApi
}

declare global {
  interface Window {
    api?: PlannerApi
  }
}

const KEY = 'ember-planner-data'
const noop = (): (() => void) => () => {}

/** `?demo` in the web build: fictional sample data, nothing is stored */
export const isDemo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

/** Fallback when the UI runs in a plain browser (dev preview, later web/mobile build). */
const browserApi: PlannerApi = {
  kind: 'browser',
  platform: 'web',
  async load() {
    if (isDemo) return { data: normalizeData(createDemoData()), seq: 0 }
    try {
      return { data: normalizeData(JSON.parse(localStorage.getItem(KEY) ?? 'null')), seq: 0 }
    } catch {
      return { data: normalizeData(null), seq: 0 }
    }
  },
  async save(data) {
    if (isDemo) return true
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable */
    }
    return true
  },
  setTitleBarTheme() {},
  // backups need the desktop app
  async listBackups() {
    return []
  },
  async createBackup() {
    return null
  },
  async readBackup() {
    throw new Error('Nur in der Desktop-App')
  },
  async openBackupFolder() {
    return ''
  },
  async saveFile(name, content, _filters, extras = []) {
    for (const f of [{ name, content }, ...extras]) {
      const url = URL.createObjectURL(new Blob([f.content], { type: 'text/plain;charset=utf-8' }))
      const a = Object.assign(document.createElement('a'), { href: url, download: f.name })
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    return name
  },
  openFile(filters) {
    return new Promise((resolve) => {
      const input = Object.assign(document.createElement('input'), {
        type: 'file',
        accept: filters.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(',')
      })
      input.onchange = async () => {
        const file = input.files?.[0]
        resolve(file ? { name: file.name, content: await file.text() } : null)
      }
      input.oncancel = () => resolve(null)
      input.click()
    })
  },
  onReminder: noop,
  onRemoteChange: noop,
  onOpenEvent: noop,
  onOpenTodo: noop,
  onNewEvent: noop
}

export const api: PlannerApi = window.api ?? browserApi
