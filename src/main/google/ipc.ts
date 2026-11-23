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

export function registerGoogleIpc(store: DataStore, account: GoogleAccount): void {
  ipcMain.handle('google:status', (): GoogleStatus => account.status())

  ipcMain.handle('google:configure', (_e, clientId: string, clientSecret?: string) =>
    wrap(() => account.configure(clientId, clientSecret))
  )

  ipcMain.handle('google:connect', () => wrap(() => account.connect()))
  ipcMain.handle('google:cancel', () => wrap(() => account.cancelConnect()))

  const dropGoogleCalendars = (): void => {
    const data = store.get()
    const ids = data.calendars.filter(isGoogle).map((c) => c.id)
    if (ids.length) store.applyRemote(removeCalendarsPatch(data, ids))
  }

  ipcMain.handle('google:disconnect', () =>
    wrap(async () => {
      const status = await account.disconnect()
      dropGoogleCalendars()
      return status
    })
  )

  ipcMain.handle('google:reset', () =>
    wrap(async () => {
      const status = await account.reset()
      dropGoogleCalendars()
      return status
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
      } else {
        store.applyRemote(removeCalendarsPatch(data, [id]))
      }
      return true
    })
  )
}
