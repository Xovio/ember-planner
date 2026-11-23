import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppData, ReminderPayload, TitleBarTheme } from '@shared/types'

function listen<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

const api = {
  kind: 'electron' as const,
  platform: process.platform,
  load: (): Promise<AppData> => ipcRenderer.invoke('data:load'),
  save: (data: AppData): Promise<boolean> => ipcRenderer.invoke('data:save', data),
  setTitleBarTheme: (t: TitleBarTheme): void => ipcRenderer.send('window:theme', t),
  onReminder: (cb: (p: ReminderPayload) => void) => listen('reminder:fired', cb),
  onOpenEvent: (cb: (eventId: string) => void) => listen('event:open', cb),
  onOpenTodo: (cb: (todoId: string) => void) => listen('todo:open', cb),
  onNewEvent: (cb: () => void) => listen('event:new', cb)
}

export type ElectronApi = typeof api

contextBridge.exposeInMainWorld('api', api)
