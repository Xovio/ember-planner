import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AppData, LoadResult, ReminderPayload, TitleBarTheme } from '@shared/types'
import type { RemoteChange } from '@shared/patch'
import type { GoogleApi, GoogleCalendarEntry, GoogleStatus } from '@shared/google'
import type { AnnounceOptions, DiscordApi, DiscordGuildEntry, DiscordStatus } from '@shared/discord'
import type { BackupInfo } from '../main/backup'
import type { UpdateApi, UpdateInfo } from '@shared/update'

interface FileFilter {
  name: string
  extensions: string[]
}

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

const discord: DiscordApi = {
  status: () => ipcRenderer.invoke('discord:status'),
  connect: (token: string) => ipcRenderer.invoke('discord:connect', token),
  disconnect: () => ipcRenderer.invoke('discord:disconnect'),
  guilds: () => ipcRenderer.invoke('discord:guilds'),
  setEnabled: (guild: DiscordGuildEntry, enabled: boolean) => ipcRenderer.invoke('discord:setEnabled', guild, enabled),
  channels: (guildId: string) => ipcRenderer.invoke('discord:channels', guildId),
  announce: (eventId: string, opts: AnnounceOptions) => ipcRenderer.invoke('discord:announce', eventId, opts),
  syncNow: () => ipcRenderer.invoke('discord:syncNow'),
  onStatus: (cb: (s: DiscordStatus) => void) => listen('discord:status', cb),
  onNotice: (cb: (text: string) => void) => listen('discord:notice', cb)
}

const updates: UpdateApi = {
  info: () => ipcRenderer.invoke('update:info'),
  check: () => ipcRenderer.invoke('update:check'),
  install: () => ipcRenderer.invoke('update:install'),
  onStatus: (cb: (s: UpdateInfo) => void) => listen('update:status', cb)
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
  listBackups: (): Promise<BackupInfo[]> => ipcRenderer.invoke('backup:list'),
  createBackup: (): Promise<BackupInfo> => ipcRenderer.invoke('backup:create'),
  readBackup: (file: string): Promise<string> => ipcRenderer.invoke('backup:read', file),
  openBackupFolder: (): Promise<string> => ipcRenderer.invoke('backup:open-folder'),
  saveFile: (
    name: string,
    content: string,
    filters: FileFilter[],
    extras?: { name: string; content: string }[]
  ): Promise<string | null> => ipcRenderer.invoke('file:save', name, content, filters, extras ?? []),
  openFile: (filters: FileFilter[]): Promise<{ name: string; content: string } | null> =>
    ipcRenderer.invoke('file:open', filters),
  onReminder: (cb: (p: ReminderPayload) => void) => listen('reminder:fired', cb),
  onOpenEvent: (cb: (eventId: string) => void) => listen('event:open', cb),
  onOpenTodo: (cb: (todoId: string) => void) => listen('todo:open', cb),
  onNewEvent: (cb: () => void) => listen('event:new', cb),
  google,
  discord,
  updates
}

export type ElectronApi = typeof api

contextBridge.exposeInMainWorld('api', api)
