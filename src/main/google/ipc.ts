import { ipcMain } from 'electron'
import {
  calendarInfoFromGoogle,
  googleCalendarLocalId,
  type GoogleCalendarEntry,
  type GoogleResult,
  type GoogleStatus
} from '@shared/google'
import type { DataPatch } from '@shared/patch'
import type { AppData, CalendarInfo } from '@shared/types'
import type { DataStore } from '../store'
import type { GoogleAccount } from './account'
import type { GoogleSync } from '@shared/gsync/sync'

const isGoogle = (c: CalendarInfo): boolean => c.external?.provider === 'google'

/** errors cross IPC as plain messages, not as "Error invoking remote method …" */
async function wrap<T>(fn: () => T | Promise<T>): Promise<GoogleResult<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (err) {
    console.error('[google]', err)
    return { ok: false, error: (err as Error).message }
  }
}

/** removes the given local calendars together with their events */
export function removeCalendarsPatch(data: AppData, calendarIds: string[]): DataPatch {
  const ids = new Set(calendarIds)
  return {
    calendars: { remove: calendarIds },
    events: {
      remove: data.events.filter((e) => ids.has(e.calendarId)).map((e) => e.id)
    }
  }
}

/** calendar info that changed at Google (name, access, reminders) for calendars already shown */
export function refreshCalendarsPatch(data: AppData, entries: Omit<GoogleCalendarEntry, 'enabled'>[]): DataPatch {
  const upsert: CalendarInfo[] = []
  for (const entry of entries) {
    const existing = data.calendars.find((c) => c.id === googleCalendarLocalId(entry.id))
    if (!existing) continue
    const next = calendarInfoFromGoogle({ ...entry, enabled: true }, existing)
    if (JSON.stringify(next) !== JSON.stringify(existing)) upsert.push(next)
  }
  return { calendars: { upsert } }
}

export function registerGoogleIpc(
  store: DataStore,
  account: GoogleAccount,
  sync: GoogleSync,
  statusOf: () => GoogleStatus
): void {
  ipcMain.handle('google:status', (): GoogleStatus => statusOf())

  ipcMain.handle('google:configure', (_e, clientId: string, clientSecret?: string) =>
    wrap(() => account.configure(clientId, clientSecret))
  )

  ipcMain.handle('google:connect', () =>
    wrap(async () => {
      await account.connect()
      if (account.isConnected) void sync.syncNow()
      return statusOf()
    })
  )
  ipcMain.handle('google:cancel', () =>
    wrap(() => {
      account.cancelConnect()
      return statusOf()
    })
  )
  ipcMain.handle('google:syncNow', () =>
    wrap(async () => {
      await sync.syncNow()
      return statusOf()
    })
  )

  const dropGoogleCalendars = (): void => {
    const data = store.get()
    const ids = data.calendars.filter(isGoogle).map((c) => c.id)
    if (ids.length) store.applyRemote(removeCalendarsPatch(data, ids))
  }

  ipcMain.handle('google:disconnect', () =>
    wrap(async () => {
      await account.disconnect()
      dropGoogleCalendars()
      sync.reset()
      return statusOf()
    })
  )

  ipcMain.handle('google:reset', () =>
    wrap(async () => {
      await account.reset()
      dropGoogleCalendars()
      sync.reset()
      return statusOf()
    })
  )

  ipcMain.handle('google:calendars', () =>
    wrap(async (): Promise<GoogleCalendarEntry[]> => {
      const entries = await account.listCalendars()
      store.applyRemote(refreshCalendarsPatch(store.get(), entries))
      const shown = new Set(store.get().calendars.map((c) => c.id))
      return entries.map((e) => ({
        ...e,
        enabled: shown.has(googleCalendarLocalId(e.id))
      }))
    })
  )

  ipcMain.handle('google:setEnabled', (_e, entry: GoogleCalendarEntry, enabled: boolean) =>
    wrap(() => {
      const data = store.get()
      const id = googleCalendarLocalId(entry.id)
      if (enabled) {
        const existing = data.calendars.find((c) => c.id === id)
        store.applyRemote({
          calendars: { upsert: [calendarInfoFromGoogle(entry, existing)] }
        })
        // fetch its events from scratch right away
        sync.forget(entry.id)
        void sync.syncNow()
      } else {
        store.applyRemote(removeCalendarsPatch(data, [id]))
        sync.forget(entry.id)
      }
      return true
    })
  )
}
