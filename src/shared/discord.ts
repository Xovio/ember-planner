import type { CalendarEvent, CalendarInfo, DiscordLink, Recurrence } from './types'

export const DISCORD_API = 'https://discord.com/api/v10'
export const DISCORD_SETUP_URL = 'https://github.com/Xovio/ember-planner/blob/master/docs/DISCORD-SETUP.md'

/**
 * Permissions for the invite link: View Channels (1 << 10), Connect (1 << 20), Create Events (1 << 44).
 * As a decimal string because the value is larger than 2^32 (bit operators would cut it).
 */
export const BOT_PERMISSIONS = String(2 ** 10 + 2 ** 20 + 2 ** 44)

export function inviteUrl(applicationId: string, guildId?: string): string {
  const q = new URLSearchParams({ client_id: applicationId, scope: 'bot', permissions: BOT_PERMISSIONS })
  if (guildId) {
    q.set('guild_id', guildId)
    q.set('disable_guild_select', 'true')
  }
  return `https://discord.com/oauth2/authorize?${q}`
}

export const discordEventUrl = (guildId: string, eventId: string): string =>
  `https://discord.com/events/${guildId}/${eventId}`

/** scheduled event status */
export const DSTATUS = { scheduled: 1, active: 2, completed: 3, canceled: 4 } as const
/** scheduled event entity type */
export const DENTITY = { stage: 1, voice: 2, external: 3 } as const

export type DiscordState = 'unconfigured' | 'connected'

export interface DiscordSyncState {
  running: boolean
  lastSync?: string
  error?: string
  /** cancellations not yet sent */
  pending?: number
}

export interface DiscordStatus {
  state: DiscordState
  /** name of the bot, e.g. "Ember Planner#1234" */
  bot?: string
  applicationId?: string
  error?: string
  sync?: DiscordSyncState
}

export interface DiscordGuildEntry {
  id: string
  name: string
  /** already shown as a calendar */
  enabled: boolean
}

export interface DiscordChannel {
  id: string
  name: string
  kind: 'voice' | 'stage'
}

export interface AnnounceOptions {
  guildId: string
  kind: 'voice' | 'external'
  channelId?: string
  /** for 'external': place or link (1–100 characters) */
  location?: string
}

export type DiscordResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** Discord functions the UI can call (desktop only) */
export interface DiscordApi {
  status(): Promise<DiscordStatus>
  connect(token: string): Promise<DiscordResult<DiscordStatus>>
  disconnect(): Promise<DiscordResult<DiscordStatus>>
  guilds(): Promise<DiscordResult<DiscordGuildEntry[]>>
  setEnabled(guild: DiscordGuildEntry, enabled: boolean): Promise<DiscordResult<boolean>>
  channels(guildId: string): Promise<DiscordResult<DiscordChannel[]>>
  announce(eventId: string, opts: AnnounceOptions): Promise<DiscordResult<boolean>>
  syncNow(): Promise<DiscordResult<DiscordStatus>>
  onStatus(cb: (s: DiscordStatus) => void): () => void
  onNotice(cb: (text: string) => void): () => void
}

/* ───────────── calendars ───────────── */

/** local calendar id for a server; stable so re-enabling reuses it */
export const discordCalendarLocalId = (guildId: string): string => `d:${guildId}`
/** local id of an event someone else created on a server */
export const discordEventLocalId = (eventId: string): string => `d:${eventId}`

export const isDiscordCalendar = (c: CalendarInfo | undefined): boolean => c?.external?.provider === 'discord'

export function calendarInfoForGuild(
  guild: { id: string; name: string },
  existing: CalendarInfo | undefined,
  defaultReminders: number[],
  color: CalendarInfo['color']
): CalendarInfo {
  return {
    id: discordCalendarLocalId(guild.id),
    name: existing?.name ?? guild.name,
    color: existing?.color ?? color,
    visible: existing?.visible ?? true,
    // events on a server belong to the people who created them
    readOnly: true,
    defaultReminders: existing?.defaultReminders ?? defaultReminders,
    external: { provider: 'discord', id: guild.id }
  }
}

/* ───────────── events ───────────── */

/** the parts of a Discord scheduled event we read */
export interface DEvent {
  id: string
  guild_id: string
  channel_id: string | null
  creator_id?: string | null
  name: string
  description?: string | null
  scheduled_start_time: string
  scheduled_end_time: string | null
  status: number
  entity_type: number
  entity_metadata?: { location?: string } | null
  user_count?: number
  recurrence_rule?: DRecurrence | null
}

export interface DRecurrence {
  start: string
  frequency: number
  interval: number
  by_weekday?: number[] | null
  by_n_weekday?: { n: number; day: number }[] | null
  by_month?: number[] | null
  by_month_day?: number[] | null
}

/** what a linked event last looked like at Discord; tells local and remote changes apart */
export type DiscordSnapshot = NonNullable<DiscordLink['synced']>

const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
const FREQ = ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY'] as const
const SIMPLE: Record<string, Recurrence['freq']> = { YEARLY: 'yearly', MONTHLY: 'monthly', WEEKLY: 'weekly', DAILY: 'daily' }

/** Discord's recurrence rule as our Recurrence (raw RRULE so every variant expands correctly) */
export function recurrenceFromDiscord(r: DRecurrence | null | undefined): Recurrence | null {
  if (!r) return null
  const freq = FREQ[r.frequency]
  if (!freq) return null
  const parts = [`FREQ=${freq}`]
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.by_weekday?.length) parts.push(`BYDAY=${r.by_weekday.map((d) => DAYS[d]).join(',')}`)
  if (r.by_n_weekday?.length) parts.push(`BYDAY=${r.by_n_weekday.map((x) => `${x.n}${DAYS[x.day]}`).join(',')}`)
  if (r.by_month?.length) parts.push(`BYMONTH=${r.by_month.join(',')}`)
  if (r.by_month_day?.length) parts.push(`BYMONTHDAY=${r.by_month_day.join(',')}`)
  return {
    freq: SIMPLE[freq],
    interval: Math.max(1, r.interval || 1),
    ...(r.by_weekday?.length && freq === 'WEEKLY' ? { byWeekday: r.by_weekday } : {}),
    rrule: parts.join(';')
  }
}

export function snapshotOf(d: DEvent, fallbackEnd: string): DiscordSnapshot {
  return {
    name: d.name,
    start: new Date(d.scheduled_start_time).toISOString(),
    end: d.scheduled_end_time ? new Date(d.scheduled_end_time).toISOString() : fallbackEnd,
    location: d.entity_metadata?.location ?? undefined,
    description: d.description ?? undefined
  }
}

/** the same fields of a local event */
export function snapshotOfLocal(ev: CalendarEvent, kind: 'voice' | 'external' | undefined): DiscordSnapshot {
  return {
    name: clip(ev.title || '(Ohne Titel)', 100),
    start: ev.start,
    end: ev.end,
    location: kind === 'external' ? clip(ev.location || 'Siehe Beschreibung', 100) : undefined,
    description: ev.notes ? clip(ev.notes, 1000) : undefined
  }
}

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export const sameSnapshot = (a: DiscordSnapshot | undefined, b: DiscordSnapshot | undefined): boolean =>
  !!a &&
  !!b &&
  a.name === b.name &&
  a.start === b.start &&
  a.end === b.end &&
  (a.location ?? '') === (b.location ?? '') &&
  (a.description ?? '') === (b.description ?? '')

/** body for POST/PATCH; `fields` = only what changed (PATCH) or everything (POST) */
export function discordBody(snap: DiscordSnapshot, kind: 'voice' | 'external', channelId?: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: snap.name,
    scheduled_start_time: snap.start,
    scheduled_end_time: snap.end,
    description: snap.description ?? '',
    privacy_level: 2
  }
  if (kind === 'external') {
    body.entity_type = DENTITY.external
    body.channel_id = null
    body.entity_metadata = { location: snap.location || 'Siehe Beschreibung' }
  } else {
    body.entity_type = DENTITY.voice
    body.channel_id = channelId
  }
  return body
}

/** read-only calendar event for someone else's Discord event */
export function eventFromDiscord(
  d: DEvent,
  cal: CalendarInfo,
  channelName: (id: string) => string | undefined,
  defaultDurationMin: number,
  before?: CalendarEvent
): CalendarEvent {
  const start = new Date(d.scheduled_start_time)
  const end = d.scheduled_end_time
    ? new Date(d.scheduled_end_time)
    : new Date(start.getTime() + defaultDurationMin * 60_000)
  const channel = d.channel_id ? channelName(d.channel_id) : undefined
  const ev: CalendarEvent = {
    id: discordEventLocalId(d.id),
    calendarId: cal.id,
    title: d.name,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: false,
    recurrence: recurrenceFromDiscord(d.recurrence_rule),
    reminders: [...(cal.defaultReminders ?? [])],
    external: { provider: 'discord', id: d.id, calendarId: d.guild_id },
    discord: {
      guildId: d.guild_id,
      eventId: d.id,
      own: false,
      status: d.status,
      ...(d.user_count !== undefined ? { userCount: d.user_count } : {}),
      ...(d.channel_id ? { channelId: d.channel_id } : {})
    },
    createdAt: before?.createdAt ?? new Date().toISOString(),
    updatedAt: before?.updatedAt ?? new Date().toISOString()
  }
  const location = d.entity_metadata?.location ?? (channel ? `🔊 ${channel}` : undefined)
  if (location) ev.location = location
  if (d.description) ev.notes = d.description
  return ev
}
