import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, UserPlus } from 'lucide-react'
import { DISCORD_SETUP_URL, inviteUrl, type DiscordGuildEntry, type DiscordResult } from '@shared/discord'
import { api } from '../../lib/api'
import { lastSyncLabel, useTick } from '../../lib/googleStatus'
import { useDiscordStatus } from '../../lib/discordStatus'

/** Optionen → Discord: own bot token, invite link, which servers show up as calendars. */
export function DiscordSection(): React.JSX.Element {
  const discord = api.discord
  const status = useDiscordStatus()
  useTick()
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [guilds, setGuilds] = useState<DiscordGuildEntry[] | null>(null)

  const run = useCallback(async <T,>(p: Promise<DiscordResult<T>>): Promise<T | undefined> => {
    const r = await p
    if (r.ok) {
      setError(null)
      return r.value
    }
    setError(r.error)
    return undefined
  }, [])

  const loadGuilds = useCallback(async () => {
    if (!discord) return
    const list = await run(discord.guilds())
    if (list) setGuilds(list)
  }, [discord, run])

  const connected = status?.state === 'connected'
  useEffect(() => {
    if (connected) void loadGuilds()
    else setGuilds(null)
  }, [connected, loadGuilds])

  if (!discord) {
    return (
      <section className="settings-section">
        <h2>Discord</h2>
        <p className="settings-note">Nur in der Desktop-App verfügbar.</p>
      </section>
    )
  }
  if (!status) return <section className="settings-section" />

  const connect = async (): Promise<void> => {
    setBusy(true)
    const s = await run(discord.connect(token))
    setBusy(false)
    if (s) setToken('')
  }

  return (
    <section className="settings-section">
      <h2>Discord</h2>
      {!connected ? (
        <>
          <p className="settings-note">
            Zeigt die Events deiner Discord-Server im Kalender und kündigt Termine dort an. Dafür brauchst du einen eigenen
            Bot – das dauert etwa 5 Minuten:{' '}
            <a href={DISCORD_SETUP_URL} target="_blank" rel="noreferrer">
              Anleitung <ExternalLink size={11} />
            </a>
          </p>
          <div className="settings-row">
            <div className="settings-label">
              <span>Bot-Token</span>
              <small>Aus dem Developer Portal unter „Bot → Reset Token“. Wird verschlüsselt auf diesem PC gespeichert.</small>
            </div>
            <div className="settings-control">
              <input
                type="password"
                className="input"
                autoComplete="off"
                spellCheck={false}
                placeholder="Token einfügen"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && token.trim() && void connect()}
              />
              <button className="btn btn-primary sm" disabled={!token.trim() || busy} onClick={() => void connect()}>
                {busy ? 'Prüfe …' : 'Verbinden'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="settings-row">
            <div className="settings-label">
              <span>Verbunden als Bot „{status.bot}“</span>
              <small>
                Zuletzt abgeglichen {lastSyncLabel(status.sync?.lastSync)}
                {status.sync?.pending ? ` · ${status.sync.pending} Absage(n) ausstehend` : ''}
              </small>
            </div>
            <div className="settings-control">
              <button className="btn btn-ghost sm" onClick={() => void discord.syncNow()} disabled={status.sync?.running}>
                <RefreshCw size={13} className={status.sync?.running ? 'spin' : ''} /> Abgleichen
              </button>
              <button className="btn btn-ghost sm danger-text" onClick={() => void run(discord.disconnect())}>
                Trennen
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <span>Server</span>
              <small>
                Angehakte Server erscheinen links unter „Discord“ mit allen Events. Fehlt einer, lade den Bot dorthin ein.
              </small>
            </div>
            <div className="settings-control discord-guilds">
              {guilds === null && <span className="muted">Lade …</span>}
              {guilds?.length === 0 && <span className="muted">Der Bot ist noch auf keinem Server.</span>}
              {guilds?.map((g) => (
                <label key={g.id} className="discord-guild">
                  <input
                    type="checkbox"
                    checked={g.enabled}
                    onChange={async (e) => {
                      const on = e.target.checked
                      if (await run(discord.setEnabled(g, on))) {
                        setGuilds((list) => list?.map((x) => (x.id === g.id ? { ...x, enabled: on } : x)) ?? null)
                      }
                    }}
                  />
                  {g.name}
                </label>
              ))}
              <div className="discord-guild-actions">
                {status.applicationId && (
                  <a className="btn btn-ghost sm" href={inviteUrl(status.applicationId)} target="_blank" rel="noreferrer">
                    <UserPlus size={13} /> Bot zu einem Server einladen
                  </a>
                )}
                <button className="btn btn-ghost sm" onClick={() => void loadGuilds()}>
                  <RefreshCw size={13} /> Neu laden
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {(error ?? status.error) && <p className="field-error">{error ?? status.error}</p>}
    </section>
  )
}
