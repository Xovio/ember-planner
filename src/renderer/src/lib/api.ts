import { normalizeData, type AppData, type ReminderPayload, type TitleBarTheme } from '@shared/types'

export interface PlannerApi {
  kind: 'electron' | 'browser'
  platform: string
  load(): Promise<AppData>
  save(data: AppData): Promise<boolean>
  setTitleBarTheme(t: TitleBarTheme): void
  onReminder(cb: (p: ReminderPayload) => void): () => void
  onOpenEvent(cb: (eventId: string) => void): () => void
  onOpenTodo(cb: (todoId: string) => void): () => void
  onNewEvent(cb: () => void): () => void
}

declare global {
  interface Window {
    api?: PlannerApi
  }
}

const KEY = 'ember-planner-data'
const noop = (): (() => void) => () => {}

/** Fallback when the UI runs in a plain browser (dev preview, later web/mobile build). */
const browserApi: PlannerApi = {
  kind: 'browser',
  platform: 'web',
  async load() {
    try {
      return normalizeData(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
    } catch {
      return normalizeData(null)
    }
  },
  async save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable */
    }
    return true
  },
  setTitleBarTheme() {},
  onReminder: noop,
  onOpenEvent: noop,
  onOpenTodo: noop,
  onNewEvent: noop
}

export const api: PlannerApi = window.api ?? browserApi
