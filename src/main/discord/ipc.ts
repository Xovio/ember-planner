import { ipcMain } from 'electron'
import {
  calendarInfoForGuild,
  discordCalendarLocalId,
  type AnnounceOptions,
  type DiscordGuildEntry,
  type DiscordResult,
  type DiscordStatus
} from '@shared/discord'
import { CALENDAR_COLORS, type AppData } from '@shared/types'
import type { DataPatch } from '@shared/patch'
import type { DataStore } from '../store'
import type { DiscordAccount } from './account'
import type { DiscordSync } from './sync'

async function wrap<T>(fn: () => T | Promise<T>): Promise<DiscordResult<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (err) {
    console.error('[discord]', err)
    return { ok: false, error: (err as Error).message }
  }
}

/** removes server calendars with their events; own announcements stay (with their link) in their calendars */
export function removeGuildCalendarsPatch(data: AppData, calendarIds: string[]): DataPatch {
  const ids = new Set(calendarIds)
  return {
    calendars: { remove: calendarIds },
    events: { remove: data.events.filter((e) => ids.has(e.calendarId)).map((e) => e.id) }
  }
}

export function registerDiscordIpc(
  store: DataStore,
  account: DiscordAccount,
  sync: DiscordSync,
  statusOf: () => DiscordStatus
): void {
  ipcMain.handle('discord:status', (): DiscordStatus => statusOf())

  ipcMain.handle('discord:connect', (_e, token: string) =>
    wrap(async () => {
      await account.connect(token)
      void sync.syncNow()
      return statusOf()
    })
  )

  ipcMain.handle('discord:disconnect', () =>
    wrap(() => {
      account.disconnect()
      const data = store.get()
      const ids = data.calendars.filter((c) => c.external?.provider === 'discord').map((c) => c.id)
      if (ids.length) store.applyRemote(removeGuildCalendarsPatch(data, ids))
      sync.reset()
      return statusOf()
    })
  )

  ipcMain.handle('discord:guilds', () =>
    wrap(async (): Promise<DiscordGuildEntry[]> => {
      const guilds = await account.guilds()
      const shown = new Set(store.get().calendars.map((c) => c.id))
      return guilds.map((g) => ({ id: g.id, name: g.name, enabled: shown.has(discordCalendarLocalId(g.id)) }))
    })
  )

  ipcMain.handle('discord:setEnabled', (_e, guild: DiscordGuildEntry, enabled: boolean) =>
    wrap(() => {
      const data = store.get()
      const id = discordCalendarLocalId(guild.id)
      if (enabled) {
        const existing = data.calendars.find((c) => c.id === id)
        const used = new Set(data.calendars.map((c) => c.color))
        const color = CALENDAR_COLORS.find((c) => !used.has(c)) ?? 'violet'
        store.applyRemote({
          calendars: { upsert: [calendarInfoForGuild(guild, existing, data.settings.defaultReminders, color)] }
        })
        void sync.syncNow()
      } else {
        store.applyRemote(removeGuildCalendarsPatch(data, [id]))
      }
      return true
    })
  )

  ipcMain.handle('discord:channels', (_e, guildId: string) => wrap(() => account.channels(guildId)))

  ipcMain.handle('discord:announce', (_e, eventId: string, opts: AnnounceOptions) =>
    wrap(async () => {
      await sync.announce(eventId, opts)
      return true
    })
  )

  ipcMain.handle('discord:syncNow', () =>
    wrap(async () => {
      await sync.syncNow()
      return statusOf()
    })
  )
}
