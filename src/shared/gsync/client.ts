import {
  DRIVE_SCOPE,
  GOOGLE_API,
  GOOGLE_REVOKE_URL,
  GOOGLE_SCOPES,
  GOOGLE_TOKEN_URL,
  type GoogleAccessRole,
  type GoogleCalendarEntry,
  type GoogleStatus
} from '../google'
import { GoogleApiError, GoogleAuthError } from './errors'

/**
 * The Google connection without the sign-in: credentials, access tokens, API calls.
 * Uses only fetch, so the desktop and the Android app share it; each adds its own sign-in.
 */

export interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

/** missing calendar scopes in German, or null when everything was granted */
export function missingScopes(granted: string | undefined): string | null {
  if (!granted) return null
  const have = new Set(granted.split(' '))
  const labels: Record<string, string> = {
    [GOOGLE_SCOPES[0]]: 'Kalenderliste',
    [GOOGLE_SCOPES[1]]: 'Termine'
  }
  const missing = GOOGLE_SCOPES.filter((s) => !have.has(s)).map((s) => labels[s])
  return missing.length ? missing.join(' und ') : null
}

/** POST to Google's token endpoint with German errors */
export async function postToken(body: Record<string, string | undefined>): Promise<TokenResponse> {
  const form = new URLSearchParams()
  for (const [k, v] of Object.entries(body)) if (v) form.set(k, v)
  let res: Response
  try {
    res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form
    })
  } catch {
    throw new GoogleAuthError('Google ist nicht erreichbar. Bist du online?')
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, string>
  if (!res.ok) {
    if (json.error === 'invalid_grant')
      throw new GoogleAuthError('Die Anmeldung bei Google ist abgelaufen oder wurde widerrufen. Bitte neu verbinden.', true)
    if (json.error === 'invalid_client')
      throw new GoogleAuthError('Client-ID oder Clientschlüssel stimmen nicht. Bitte in den Optionen prüfen.', true)
    throw new GoogleAuthError(`Google hat die Anmeldung abgelehnt (${json.error_description ?? json.error ?? res.status}).`)
  }
  return json as unknown as TokenResponse
}

export function refreshAccessToken(c: { clientId: string; clientSecret?: string; refreshToken: string }): Promise<TokenResponse> {
  return postToken({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: c.refreshToken,
    grant_type: 'refresh_token'
  })
}

/** what is kept (encrypted) on the device – never part of the data or backups */
export interface GoogleCredentials {
  clientId: string
  clientSecret?: string
  refreshToken?: string
  account?: string
  /** scopes Google granted with the refresh token (missing in files from before device sync) */
  scopes?: string[]
}

/** safe storage for the credentials; `save` throws if they can't be stored safely, `load` if unreadable */
export interface CredentialStore {
  load(): GoogleCredentials | null
  save(creds: GoogleCredentials | null): void
}

type RawCalendar = {
  id: string
  summary: string
  summaryOverride?: string
  backgroundColor?: string
  accessRole: GoogleAccessRole
  primary?: boolean
  deleted?: boolean
  defaultReminders?: { method: string; minutes: number }[]
}

export class GoogleClient {
  protected creds: GoogleCredentials | null
  protected access: { token: string; expiresAt: number } | null = null
  protected error: string | undefined

  constructor(
    protected readonly credStore: CredentialStore,
    protected readonly onStatus?: (status: GoogleStatus) => void
  ) {
    this.creds = this.read()
  }

  /* ── persistence ── */

  private read(): GoogleCredentials | null {
    try {
      return this.credStore.load()
    } catch (err) {
      console.error('Google credentials unreadable', err)
      this.error = 'Die gespeicherte Google-Anmeldung ließ sich nicht lesen. Bitte neu einrichten.'
      return null
    }
  }

  protected write(): void {
    this.credStore.save(this.creds)
  }

  /* ── status ── */

  status(): GoogleStatus {
    const c = this.creds
    return {
      state: !c ? 'unconfigured' : c.refreshToken ? 'connected' : 'disconnected',
      clientId: c?.clientId,
      account: c?.refreshToken ? c.account : undefined,
      error: this.error
    }
  }

  get isConnected(): boolean {
    return !!this.creds?.refreshToken
  }

  /** access to the app's hidden Drive folder was granted (device sync) */
  get hasDrive(): boolean {
    return this.isConnected && !!this.creds?.scopes?.includes(DRIVE_SCOPE)
  }

  /** Drive access turned out to be missing (e.g. revoked in the Google account) */
  dropDrive(): void {
    if (!this.creds?.scopes) return
    this.creds = { ...this.creds, scopes: this.creds.scopes.filter((s) => s !== DRIVE_SCOPE) }
    this.write()
    this.emit()
  }

  protected emit(): GoogleStatus {
    const s = this.status()
    this.onStatus?.(s)
    return s
  }

  /* ── setup ── */

  configure(clientId: string, clientSecret?: string): GoogleStatus {
    const id = clientId.trim()
    if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id)) {
      throw new GoogleAuthError('Das sieht nicht wie eine Client-ID aus (sie endet auf „.apps.googleusercontent.com“).')
    }
    const changed = this.creds?.clientId !== id
    this.creds = {
      ...(changed ? {} : this.creds),
      clientId: id,
      clientSecret: clientSecret?.trim() || undefined
    }
    if (changed) this.access = null
    this.error = undefined
    this.write()
    return this.emit()
  }

  /** revokes the token at Google (best effort) and forgets it locally; the client id stays */
  async disconnect(): Promise<GoogleStatus> {
    const token = this.creds?.refreshToken
    if (token) {
      await fetch(GOOGLE_REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token })
      }).catch(() => undefined)
    }
    if (this.creds) this.creds = { clientId: this.creds.clientId, clientSecret: this.creds.clientSecret }
    this.access = null
    this.error = undefined
    this.write()
    return this.emit()
  }

  /** forgets everything including the client id */
  async reset(): Promise<GoogleStatus> {
    await this.disconnect()
    this.creds = null
    this.write()
    return this.emit()
  }

  /** a sign-in finished: keep the refresh token and the granted scopes */
  protected signedIn(tokens: TokenResponse): void {
    const c = this.creds
    if (!c) throw new GoogleAuthError('Bitte zuerst Client-ID eintragen.')
    const missing = missingScopes(tokens.scope)
    if (missing) throw new GoogleAuthError(`Es fehlt die Berechtigung für ${missing}. Bitte neu verbinden und beide Häkchen setzen.`)
    if (!tokens.refresh_token) throw new GoogleAuthError('Google hat kein dauerhaftes Token geschickt. Bitte noch einmal verbinden.')
    this.creds = { ...c, refreshToken: tokens.refresh_token, scopes: tokens.scope?.split(' ') }
    this.access = { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 }
  }

  /* ── API ── */

  private async accessToken(): Promise<string> {
    if (this.access && this.access.expiresAt - 60_000 > Date.now()) return this.access.token
    const c = this.creds
    if (!c?.refreshToken) throw new GoogleAuthError('Nicht mit Google verbunden.', true)
    try {
      const t = await refreshAccessToken({ clientId: c.clientId, clientSecret: c.clientSecret, refreshToken: c.refreshToken })
      this.access = { token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 }
      if (this.error) {
        this.error = undefined
        this.emit()
      }
      return t.access_token
    } catch (err) {
      if (err instanceof GoogleAuthError && err.needsReconnect) {
        this.creds = { clientId: c.clientId, clientSecret: c.clientSecret }
        this.access = null
        this.error = err.message
        this.write()
        this.emit()
      }
      throw err
    }
  }

  async request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    const token = await this.accessToken()
    let res: Response
    try {
      res = await fetch(path.startsWith('http') ? path : `${GOOGLE_API}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      })
    } catch {
      throw new GoogleApiError('Google ist nicht erreichbar. Bist du online?', 0)
    }
    if (res.status === 401 && !retried) {
      this.access = null
      return this.request<T>(path, init, true)
    }
    if (res.status === 204) return undefined as T
    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; errors?: { reason?: string }[] }
    }
    if (!res.ok) {
      const reason = json.error?.errors?.[0]?.reason
      const drive = path.includes('/drive/')
      const msg =
        reason === 'accessNotConfigured'
          ? drive
            ? 'Die Google Drive API ist im Cloud-Projekt nicht aktiviert (siehe Anleitung, Abschnitt Geräte-Sync).'
            : 'Die Google Calendar API ist im Cloud-Projekt nicht aktiviert (siehe Anleitung, Schritt 2).'
          : reason === 'insufficientPermissions' && drive
            ? 'Der Zugriff auf den App-Ordner in Google Drive fehlt. Bitte unter Geräte-Sync freigeben.'
            : reason === 'insufficientPermissions'
              ? 'Es fehlt eine Berechtigung. Bitte neu verbinden und beide Häkchen setzen.'
              : `Google meldet einen Fehler (${res.status}${json.error?.message ? `: ${json.error.message}` : ''}).`
      throw new GoogleApiError(msg, res.status, reason)
    }
    return json as T
  }

  protected async fetchAccount(): Promise<string | undefined> {
    const list = await this.listCalendars()
    return list.find((c) => c.primary)?.id
  }

  async listCalendars(): Promise<Omit<GoogleCalendarEntry, 'enabled'>[]> {
    const out: Omit<GoogleCalendarEntry, 'enabled'>[] = []
    let pageToken: string | undefined
    do {
      const q = new URLSearchParams({ maxResults: '250', ...(pageToken ? { pageToken } : {}) })
      const page = await this.request<{ items?: RawCalendar[]; nextPageToken?: string }>(`/users/me/calendarList?${q}`)
      for (const c of page.items ?? []) {
        if (c.deleted) continue
        out.push({
          id: c.id,
          name: c.summaryOverride ?? c.summary,
          hex: c.backgroundColor ?? '#4285f4',
          accessRole: c.accessRole,
          primary: !!c.primary,
          defaultReminders: (c.defaultReminders ?? []).filter((r) => r.method === 'popup').map((r) => r.minutes)
        })
      }
      pageToken = page.nextPageToken
    } while (pageToken)
    // primary first, then own calendars, then subscribed ones
    const rank = (c: { primary: boolean; accessRole: GoogleAccessRole }): number =>
      c.primary ? 0 : c.accessRole === 'owner' ? 1 : c.accessRole === 'writer' ? 2 : 3
    return out.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'de'))
  }
}
