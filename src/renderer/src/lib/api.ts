import { createDemoData } from './demo'
import { normalizeData, type AppData, type LoadResult, type ReminderPayload, type TitleBarTheme } from '@shared/types'
import type { RemoteChange } from '@shared/patch'
import type { GoogleApi } from '@shared/google'

export interface PlannerApi {
  kind: 'electron' | 'browser'
  platform: string
  load(): Promise<LoadResult>
  /** `baseSeq`: number of the last remote change already contained in `data` */
  save(data: AppData, baseSeq: number): Promise<boolean>
  /** changes that did not come from the UI, e.g. pulled from Google */
  onRemoteChange(cb: (c: RemoteChange) => void): () => void
  setTitleBarTheme(t: TitleBarTheme): void
  onReminder(cb: (p: ReminderPayload) => void): () => void
  onOpenEvent(cb: (eventId: string) => void): () => void
  onOpenTodo(cb: (todoId: string) => void): () => void
  onNewEvent(cb: () => void): () => void
  /** only in the desktop app */
  google?: GoogleApi
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
  onReminder: noop,
  onRemoteChange: noop,
  onOpenEvent: noop,
  onOpenTodo: noop,
  onNewEvent: noop
}

export const api: PlannerApi = window.api ?? browserApi
