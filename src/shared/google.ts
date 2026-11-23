import type { CalendarColor, CalendarInfo } from './types'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.events'
] as const

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
export const GOOGLE_API = 'https://www.googleapis.com/calendar/v3'

export const GOOGLE_SETUP_URL = 'https://github.com/Xovio/ember-planner/blob/master/docs/GOOGLE-SETUP.md'

export type GoogleState = 'unconfigured' | 'disconnected' | 'connecting' | 'connected'

export interface GoogleSyncState {
  running: boolean
  /** last successful sync (ISO) */
  lastSync?: string
  /** last sync problem in plain German */
  error?: string
}

/**
 * Writing back to Google arrives in stage 4. Until then Google events are read-only in the app,
 * so local edits can't silently get lost on the next sync.
 */
export const GOOGLE_WRITE_ENABLED = false

/** events in this calendar can't be changed in the app */
export function isCalendarLocked(cal: { readOnly?: boolean; external?: { provider: string } } | undefined): boolean {
  if (!cal) return false
  return !!cal.readOnly || (cal.external?.provider === 'google' && !GOOGLE_WRITE_ENABLED)
}

export interface GoogleStatus {
  state: GoogleState
  sync?: GoogleSyncState
  /** shown so the user can recognise which client is set up (not secret) */
  clientId?: string
  /** e-mail of the connected account (id of the primary calendar) */
  account?: string
  /** last problem in plain German, e.g. expired sign-in */
  error?: string
}

export type GoogleAccessRole = 'owner' | 'writer' | 'reader' | 'freeBusyReader'

/** one entry of the user's Google calendar list */
export interface GoogleCalendarEntry {
  id: string
  name: string
  /** Google's background colour, e.g. "#9fe1e7" */
  hex: string
  accessRole: GoogleAccessRole
  primary: boolean
  /** default reminders of this calendar in minutes (popup) */
  defaultReminders: number[]
  /** already shown in Ember Planner */
  enabled: boolean
}

/** local calendar id for a Google calendar; stable so re-enabling reuses it */
export const googleCalendarLocalId = (googleId: string): string => `g:${googleId}`

export const isWritableRole = (role: GoogleAccessRole): boolean => role === 'owner' || role === 'writer'

/** hue (0–360) of the palette colours, independent of the theme */
const PALETTE_HUES: [CalendarColor, number][] = [
  ['red', 0],
  ['orange', 25],
  ['yellow', 55],
  ['green', 130],
  ['aqua', 185],
  ['blue', 220],
  ['violet', 270],
  ['magenta', 320]
]

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s, l }
}

/** nearest colour of our colour-blind-checked palette; greys fall back to blue */
export function paletteColorForHex(hex: string): CalendarColor {
  const hsl = hexToHsl(hex)
  if (!hsl || hsl.s < 0.15) return 'blue'
  let best: CalendarColor = 'blue'
  let bestDist = Infinity
  for (const [color, hue] of PALETTE_HUES) {
    const diff = Math.abs(hsl.h - hue)
    const dist = Math.min(diff, 360 - diff)
    if (dist < bestDist) {
      bestDist = dist
      best = color
    }
  }
  return best
}

export function calendarInfoFromGoogle(entry: GoogleCalendarEntry, existing?: CalendarInfo): CalendarInfo {
  return {
    id: googleCalendarLocalId(entry.id),
    // keep local renames and colour choices
    name: existing?.name ?? entry.name,
    color: existing?.color ?? paletteColorForHex(entry.hex),
    visible: existing?.visible ?? true,
    readOnly: !isWritableRole(entry.accessRole),
    defaultReminders: entry.defaultReminders,
    external: { ...existing?.external, provider: 'google', id: entry.id }
  }
}

/** result of a Google action across IPC; errors are plain German messages */
export type GoogleResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** Google functions the UI can call (desktop only) */
export interface GoogleApi {
  status(): Promise<GoogleStatus>
  configure(clientId: string, clientSecret?: string): Promise<GoogleResult<GoogleStatus>>
  connect(): Promise<GoogleResult<GoogleStatus>>
  cancel(): Promise<GoogleResult<GoogleStatus>>
  disconnect(): Promise<GoogleResult<GoogleStatus>>
  reset(): Promise<GoogleResult<GoogleStatus>>
  calendars(): Promise<GoogleResult<GoogleCalendarEntry[]>>
  setEnabled(entry: GoogleCalendarEntry, enabled: boolean): Promise<GoogleResult<boolean>>
  syncNow(): Promise<GoogleResult<GoogleStatus>>
  onStatus(cb: (s: GoogleStatus) => void): () => void
}
