import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Lock, RefreshCw } from 'lucide-react'
import { GOOGLE_SETUP_URL, paletteColorForHex, type GoogleCalendarEntry, type GoogleResult } from '@shared/google'
import { api } from '../../lib/api'
import { lastSyncLabel, useGoogleStatus, useTick } from '../../lib/googleStatus'
import { calVar } from '../../lib/theme'

const ROLE_LABEL: Record<GoogleCalendarEntry['accessRole'], string> = {
  owner: 'Eigener Kalender',
  writer: 'Bearbeiten erlaubt',
  reader: 'Nur lesen',
  freeBusyReader: 'Nur frei/belegt'
}

export function GoogleSection(): React.JSX.Element {
  const google = api.google
  const status = useGoogleStatus()
  useTick()
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [calendars, setCalendars] = useState<GoogleCalendarEntry[] | null>(null)
  const [loadingCals, setLoadingCals] = useState(false)

  /** runs an action and shows its error message, returns the value on success */
  const run = useCallback(async <T,>(p: Promise<GoogleResult<T>>): Promise<T | undefined> => {
    const r = await p
    if (r.ok) {
      setError(null)
      return r.value
    }
    setError(r.error)
    return undefined
  }, [])

  const loadCalendars = useCallback(async () => {
    if (!google) return
    setLoadingCals(true)
    const list = await run(google.calendars())
    setLoadingCals(false)
    if (list) setCalendars(list)
  }, [google, run])

  const connected = status?.state === 'connected'
  useEffect(() => {
    if (connected) void loadCalendars()
    else setCalendars(null)
  }, [connected, loadCalendars])

  if (!google) {
    return (
      <section className="settings-section">
        <h2>Google Kalender</h2>
        <p className="settings-note">Nur in der Desktop-App verfügbar.</p>
      </section>
    )
  }
  if (!status) return <section className="settings-section" />

  const showForm = status.state === 'unconfigured' || editing

  const saveAndConnect = async (): Promise<void> => {
    const s = await run(google.configure(clientId, secret))
    if (!s) return
    setEditing(false)
    setSecret('')
    await run(google.connect())
  }

  const toggleCalendar = async (entry: GoogleCalendarEntry, enabled: boolean): Promise<void> => {
    setCalendars((list) => list?.map((c) => (c.id === entry.id ? { ...c, enabled } : c)) ?? null)
    const ok = await run(google.setEnabled(entry, enabled))
    if (!ok) setCalendars((list) => list?.map((c) => (c.id === entry.id ? { ...c, enabled: !enabled } : c)) ?? null)
  }

  const shownError = error ?? status.error

  return (
    <section className="settings-section google-section">
      <h2>Google Kalender</h2>

      {shownError && (
        <div className="google-error" role="alert">
          <strong>Problem:</strong> {shownError}
        </div>
      )}

      {showForm ? (
        <div className="google-setup">
          <p className="settings-note">
            Für den Abgleich brauchst du einmalig eine eigene Client-ID aus der Google Cloud Console (ca. 10 Minuten).{' '}
            <a href={GOOGLE_SETUP_URL} target="_blank" rel="noreferrer">
              Zur Anleitung <ExternalLink size={12} />
            </a>
          </p>
          <label className="google-field">
            <span>Client-ID</span>
            <input
              className="input"
              value={clientId}
              placeholder="123456-abc.apps.googleusercontent.com"
              onChange={(e) => setClientId(e.target.value)}
              spellCheck={false}
            />
          </label>
          <label className="google-field">
            <span>Clientschlüssel</span>
            <input
              className="input"
              type="password"
              value={secret}
              placeholder="GOCSPX-…"
              onChange={(e) => setSecret(e.target.value)}
              spellCheck={false}
            />
          </label>
          <div className="google-actions">
            <button className="btn btn-primary sm" disabled={!clientId.trim()} onClick={() => void saveAndConnect()}>
              Speichern und verbinden
            </button>
            {editing && (
              <button className="btn btn-ghost sm" onClick={() => setEditing(false)}>
                Abbrechen
              </button>
            )}
          </div>
        </div>
      ) : status.state === 'connecting' ? (
        <div className="settings-row">
          <div className="settings-label">
            <span>Anmeldung läuft …</span>
            <small>Der Browser wurde geöffnet. Melde dich dort an und erlaube den Zugriff.</small>
          </div>
          <div className="settings-control">
            <button className="btn btn-ghost sm" onClick={() => void run(google.cancel())}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : status.state === 'disconnected' ? (
        <div className="settings-row">
          <div className="settings-label">
            <span>Nicht verbunden</span>
            <small title={status.clientId}>Client-ID ist eingetragen.</small>
          </div>
          <div className="settings-control">
            <button
              className="btn btn-ghost sm"
              onClick={() => {
                setClientId(status.clientId ?? '')
                setEditing(true)
              }}
            >
              Zugangsdaten ändern
            </button>
            <button className="btn btn-primary sm" onClick={() => void run(google.connect())}>
              Mit Google verbinden
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="settings-row">
            <div className="settings-label">
              <span>Verbunden{status.account ? ` als ${status.account}` : ''}</span>
              <small>Wird beim Start, alle 5 Minuten und beim Zurückkehren ins Fenster abgeglichen.</small>
            </div>
            <div className="settings-control">
              <button className="btn btn-ghost sm" onClick={() => void run(google.disconnect())}>
                Trennen
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <span>
                {status.sync?.running ? 'Gleiche ab …' : `Zuletzt abgeglichen: ${lastSyncLabel(status.sync?.lastSync)}`}
              </span>
              {status.sync?.error ? (
                <small className="google-sync-error">{status.sync.error}</small>
              ) : (
                <small>Google-Termine sind vorerst schreibgeschützt; das Hochladen von Änderungen folgt.</small>
              )}
            </div>
            <div className="settings-control">
              <button
                className="btn btn-outline sm"
                disabled={status.sync?.running}
                onClick={() => void run(google.syncNow())}
              >
                <RefreshCw size={13} className={status.sync?.running ? 'spin' : ''} /> Jetzt abgleichen
              </button>
            </div>
          </div>

          <div className="google-cal-head">
            <span>Welche Kalender sollen erscheinen?</span>
            <button
              className="icon-btn sm"
              onClick={() => void loadCalendars()}
              disabled={loadingCals}
              aria-label="Liste aktualisieren"
              title="Liste aktualisieren"
            >
              <RefreshCw size={14} className={loadingCals ? 'spin' : ''} />
            </button>
          </div>
          {calendars === null ? (
            <p className="settings-note">{loadingCals ? 'Lade Kalender …' : 'Keine Kalender geladen.'}</p>
          ) : (
            <ul className="google-cal-list">
              {calendars.map((c) => (
                <li key={c.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) => void toggleCalendar(c, e.target.checked)}
                    />
                    <span className="google-cal-dot" style={{ background: calVar(paletteColorForHex(c.hex)) }} />
                    <span className="google-cal-name">
                      {c.name}
                      {c.primary && <em> · Hauptkalender</em>}
                    </span>
                    <span className="google-cal-role">
                      {c.accessRole !== 'owner' && c.accessRole !== 'writer' && <Lock size={11} />}
                      {ROLE_LABEL[c.accessRole]}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
