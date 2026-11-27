import { ipcMain } from 'electron'
import type { DeviceSyncResult, DeviceSyncStatus } from '@shared/devicesync'
import type { DeviceSync } from '@shared/syncEngine'

/** errors cross IPC as plain messages */
async function wrap(fn: () => DeviceSyncStatus | Promise<DeviceSyncStatus>): Promise<DeviceSyncResult<DeviceSyncStatus>> {
  try {
    return { ok: true, value: await fn() }
  } catch (err) {
    console.error('[device-sync]', err)
    return { ok: false, error: (err as Error).message }
  }
}

export function registerDeviceSyncIpc(sync: DeviceSync): void {
  ipcMain.handle('devicesync:status', () => sync.status())
  ipcMain.handle('devicesync:setEnabled', (_e, on: boolean) => wrap(() => sync.setEnabled(!!on)))
  ipcMain.handle('devicesync:grant', () => wrap(() => sync.grant()))
  ipcMain.handle('devicesync:syncNow', () => wrap(() => sync.syncNow()))
  ipcMain.handle('devicesync:setName', (_e, name: string) => wrap(() => sync.setName(String(name))))
  ipcMain.handle('devicesync:removeDevice', (_e, id: string) => wrap(() => sync.removeDevice(String(id))))
  ipcMain.handle('devicesync:setPassphrase', (_e, p: string | null) =>
    wrap(() => sync.setPassphrase(p === null ? null : String(p)))
  )
  ipcMain.handle('devicesync:unlock', (_e, p: string) => wrap(() => sync.unlock(String(p))))
  ipcMain.handle('devicesync:wipe', () => wrap(() => sync.wipe()))
}
