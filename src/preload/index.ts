import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppData, LoadResult, ReminderPayload, TitleBarTheme } from '@shared/types'
import type { RemoteChange } from '@shared/patch'
import type { GoogleApi, GoogleCalendarEntry, GoogleStatus } from '@shared/google'

const google: GoogleApi = {
  status: () => ipcRenderer.invoke('google:status'),
  configure: (clientId: string, clientSecret?: string) =>
    ipcRenderer.invoke('google:configure', clientId, clientSecret),
  connect: () => ipcRenderer.invoke('google:connect'),
  cancel: () => ipcRenderer.invoke('google:cancel'),
  disconnect: () => ipcRenderer.invoke('google:disconnect'),
  reset: () => ipcRenderer.invoke('google:reset'),
  calendars: () => ipcRenderer.invoke('google:calendars'),
  setEnabled: (entry: GoogleCalendarEntry, enabled: boolean) => ipcRenderer.invoke('google:setEnabled', entry, enabled),
  syncNow: () => ipcRenderer.invoke('google:syncNow'),
  onStatus: (cb: (s: GoogleStatus) => void) => listen('google:status', cb),
  onNotice: (cb: (text: string) => void) => listen('google:notice', cb)
}

function listen<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

const api = {
  kind: 'electron' as const,
  platform: process.platform,
  load: (): Promise<LoadResult> => ipcRenderer.invoke('data:load'),
  save: (data: AppData, baseSeq: number): Promise<boolean> => ipcRenderer.invoke('data:save', data, baseSeq),
  onRemoteChange: (cb: (c: RemoteChange) => void) => listen('data:remote', cb),
  setTitleBarTheme: (t: TitleBarTheme): void => ipcRenderer.send('window:theme', t),
  onReminder: (cb: (p: ReminderPayload) => void) => listen('reminder:fired', cb),
  onOpenEvent: (cb: (eventId: string) => void) => listen('event:open', cb),
  onOpenTodo: (cb: (todoId: string) => void) => listen('todo:open', cb),
  onNewEvent: (cb: () => void) => listen('event:new', cb),
  google
}

export type ElectronApi = typeof api

contextBridge.exposeInMainWorld('api', api)
