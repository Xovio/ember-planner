import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DISCORD_API, type DiscordChannel, type DiscordStatus } from '@shared/discord'
import type { SecretBox } from '../google/account'

/** what is kept on disk (encrypted) – never part of data.json or backups */
interface Credentials {
  token: string
  applicationId: string
  bot: string
}

export interface DiscordAccountDeps {
  dir: string
  box: SecretBox
  onStatus?(status: DiscordStatus): void
  /** injectable for tests */
  fetch?: typeof fetch
  /** injectable for tests (rate-limit waits) */
  sleep?(ms: number): Promise<void>
}

export class DiscordApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number
  ) {
    super(message)
  }
}

/** German message for an API error */
function describe(status: number, body: { message?: string; code?: number; errors?: unknown }): string {
  if (status === 0) return 'Discord ist gerade nicht erreichbar. Ich versuche es später noch einmal.'
  if (status === 401) return 'Der Bot-Token ist ungültig oder wurde zurückgesetzt. Bitte unter Optionen → Discord neu eintragen.'
  if (status === 403 || body.code === 50013)
    return 'Dem Bot fehlt auf diesem Server ein Recht (Kanäle ansehen, Verbinden oder Events erstellen).'
  if (status === 404) return 'Das gibt es bei Discord nicht mehr (Server, Kanal oder Event).'
  if (status === 429) return 'Discord bremst gerade zu viele Anfragen. Ich versuche es gleich noch einmal.'
  const detail = body.errors ? ` ${JSON.stringify(body.errors).slice(0, 200)}` : ''
  return `Discord meldet: ${body.message ?? `Fehler ${status}`}${detail}`
}

/**
 * The user's own bot: token storage and authenticated REST calls.
 * No gateway connection – the app only polls while it runs.
 */
export class DiscordAccount {
  private creds: Credentials | null
  private error: string | undefined
  private readonly file: string
  private readonly fetch: typeof fetch
  private readonly sleep: (ms: number) => Promise<void>

  constructor(private readonly deps: DiscordAccountDeps) {
    this.file = join(deps.dir, 'discord-auth.bin')
    this.fetch = deps.fetch ?? fetch
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.creds = this.read()
  }

  private read(): Credentials | null {
    if (!existsSync(this.file)) return null
    try {
      return JSON.parse(this.deps.box.decrypt(readFileSync(this.file))) as Credentials
    } catch (err) {
      console.error('Discord credentials unreadable', err)
      this.error = 'Der gespeicherte Bot-Token ließ sich nicht lesen. Bitte neu eintragen.'
      return null
    }
  }

  private write(): void {
    if (!this.creds) {
      rmSync(this.file, { force: true })
      return
    }
    if (!this.deps.box.available()) {
      throw new Error('Windows stellt keine Verschlüsselung bereit – der Token kann nicht sicher gespeichert werden.')
    }
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, this.deps.box.encrypt(JSON.stringify(this.creds)))
    renameSync(tmp, this.file)
  }

  status(): DiscordStatus {
    return {
      state: this.creds ? 'connected' : 'unconfigured',
      bot: this.creds?.bot,
      applicationId: this.creds?.applicationId,
      error: this.error
    }
  }

  get isConnected(): boolean {
    return !!this.creds
  }

  private emit(): DiscordStatus {
    const s = this.status()
    this.deps.onStatus?.(s)
    return s
  }

  /** checks the token with Discord and stores it */
  async connect(rawToken: string): Promise<DiscordStatus> {
    const token = rawToken.trim().replace(/^Bot\s+/i, '')
    if (token.length < 50 || /\s/.test(token)) {
      throw new Error('Das sieht nicht nach einem Bot-Token aus. Kopiere ihn unter „Bot → Reset Token“ im Developer Portal.')
    }
    const me = await this.call<{ id: string; username: string; bot?: boolean }>(token, '/users/@me')
    if (!me.bot) throw new Error('Das ist kein Bot-Token. Bitte den Token aus dem Reiter „Bot“ verwenden.')
    const appInfo = await this.call<{ id: string }>(token, '/oauth2/applications/@me')
    this.creds = { token, applicationId: appInfo.id, bot: me.username }
    this.error = undefined
    this.write()
    return this.emit()
  }

  disconnect(): DiscordStatus {
    this.creds = null
    this.error = undefined
    this.write()
    return this.emit()
  }

  /** authenticated request; marks the account as broken when Discord rejects the token */
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.creds) throw new DiscordApiError('Nicht mit Discord verbunden.', 401)
    try {
      return await this.call<T>(this.creds.token, path, init)
    } catch (err) {
      if (err instanceof DiscordApiError && err.status === 401) {
        this.error = err.message
        this.emit()
      }
      throw err
    }
  }

  private async call<T>(token: string, path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    let res: Response
    try {
      res = await this.fetch(`${DISCORD_API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bot ${token}`,
          'User-Agent': 'DiscordBot (https://github.com/Xovio/ember-planner, 1)',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers as Record<string, string> | undefined)
        }
      })
    } catch {
      throw new DiscordApiError(describe(0, {}), 0)
    }
    if (res.status === 204) return undefined as T
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.status === 429 && attempt < 2) {
      // Discord says how long to wait (seconds)
      const wait = Math.min(10, Number(body.retry_after ?? 1))
      await this.sleep(wait * 1000)
      return this.call<T>(token, path, init, attempt + 1)
    }
    if (!res.ok) {
      throw new DiscordApiError(describe(res.status, body as { message?: string; code?: number }), res.status, body.code as number | undefined)
    }
    return body as T
  }

  /* ── helpers for the UI ── */

  async guilds(): Promise<{ id: string; name: string }[]> {
    return this.request<{ id: string; name: string }[]>('/users/@me/guilds')
  }

  async channels(guildId: string): Promise<DiscordChannel[]> {
    const list = await this.request<{ id: string; name: string; type: number; position?: number }[]>(
      `/guilds/${guildId}/channels`
    )
    return list
      .filter((c) => c.type === 2 || c.type === 13)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((c) => ({ id: c.id, name: c.name, kind: c.type === 13 ? 'stage' : 'voice' }))
  }
}
