import { useEffect, useState } from 'react'
import type { DiscordStatus } from '@shared/discord'
import type { CalendarEvent } from '@shared/types'
import { api } from './api'

/** live Discord connection + sync state (null in the browser build or while loading) */
export function useDiscordStatus(): DiscordStatus | null {
  const [status, setStatus] = useState<DiscordStatus | null>(null)
  useEffect(() => {
    const discord = api.discord
    if (!discord) return
    let alive = true
    void discord.status().then((s) => alive && setStatus(s))
    const off = discord.onStatus(setStatus)
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}

/** an own announcement that is still planned or running – deleting it cancels the Discord event */
export const isLiveAnnouncement = (ev: CalendarEvent | undefined): boolean =>
  !!ev?.discord?.own && (ev.discord.status === undefined || ev.discord.status <= 2)

export const DISCORD_STATUS_LABEL: Record<number, string> = {
  1: 'geplant',
  2: 'läuft gerade',
  3: 'beendet',
  4: 'abgesagt'
}
