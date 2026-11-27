import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Lock, RefreshCw, Smartphone, Monitor, Trash2 } from 'lucide-react'
import { MIN_PASSPHRASE, type DeviceSyncResult, type DeviceSyncStatus } from '@shared/devicesync'
import { api } from '../../lib/api'
import { lastSyncLabel, useTick } from '../../lib/googleStatus'
import { useStore } from '../../store'

export function DeviceSyncSection(): React.JSX.Element {
  const ds = api.deviceSync
  const [status, setStatus] = useDeviceSyncStatusState()
  useTick()
  const askConfirm = useStore((s) => s.askConfirm)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [passMode, setPassMode] = useState<'off' | 'set'>('off')

  useEffect(() => {
    if (status) setName(status.deviceName)
  }, [status?.deviceName]) // eslint-disable-line react-hooks/exhaustive-deps -- only when the saved name changes

  const run = useCallback(
    async (p: Promise<DeviceSyncResult<DeviceSyncStatus>>): Promise<boolean> => {
      setBusy(true)
      const r = await p
      setBusy(false)
      if (r.ok) {
        setError(null)
        setStatus(r.value)
        return true
      }
      setError(r.error)
      return false
    },
    [setStatus]
  )

  if (!ds) {
    return (
      <section className="settings-section">
        <h2>Geräte-Sync</h2>
        <p className="settings-note">Nur in der Desktop-App verfügbar.</p>
      </section>
    )
  }
  if (!status) return <section className="settings-section" />

  const shownError = error ?? status.error
  const others = status.devices.filter((d) => !d.self)

  const resetPass = (): void => {
    setPass('')
    setPass2('')
    setPassMode('off')
  }
  const passOk = pass.length >= MIN_PASSPHRASE && pass === pass2

  return (
    <section className="settings-section device-sync-section">
      <h2>Geräte-Sync</h2>
      <p className="settings-note">
        Gleicht ToDos, Projekte, Punkte, Charakter und eigene Kalender mit deinen anderen Geräten ab, über einen
        versteckten App-Ordner in deinem Google Drive. Google-Kalender laufen weiter direkt über Google. Design, Schrift
        und Fenster-Einstellungen bleiben auf jedem Gerät eigen.
      </p>

      {shownError && (
        <div className="google-error" role="alert">
          <strong>Problem:</strong> {shownError}
        </div>
      )}

      <div className="settings-row">
        <div className="settings-label">
          <span>Über Google-Konto abgleichen</span>
          <small>
            {status.googleConnected
              ? 'Beim Start, alle 5 Minuten, beim Zurückkehren ins Fenster und kurz nach Änderungen.'
              : 'Dafür zuerst oben unter „Google Kalender“ verbinden.'}
          </small>
        </div>
        <div className="settings-control">
          <label className="toggle">
            <input
              type="checkbox"
              checked={status.enabled}
              disabled={busy || (!status.enabled && !status.googleConnected)}
              onChange={(e) => void run(ds.setEnabled(e.target.checked))}
            />
            <span className="toggle-track" />
          </label>
        </div>
      </div>

      {status.enabled && status.googleConnected && status.needsGrant && (
        <div className="settings-row">
          <div className="settings-label">
            <span>Zugriff auf den App-Ordner erlauben</span>
            <small>
              Einmalig: Google fragt im Browser, ob Ember Planner seinen eigenen versteckten Ordner in deinem Drive nutzen
              darf. Auf deine anderen Dateien hat die App keinen Zugriff.
            </small>
          </div>
          <div className="settings-control">
            <button className="btn btn-primary sm" disabled={busy} onClick={() => void run(ds.grant())}>
              Freigeben
            </button>
          </div>
        </div>
      )}

      {status.enabled && status.needsPassphrase && (
        <div className="device-sync-pass">
          <p className="settings-note">
            <Lock size={12} /> Die Sync-Daten sind verschlüsselt. Gib die Passphrase ein, die du auf dem anderen Gerät
            festgelegt hast.
          </p>
          <div className="device-sync-pass-row">
            <input
              className="input"
              type="password"
              value={pass}
              placeholder="Passphrase"
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pass && void run(ds.unlock(pass)).then((ok) => ok && resetPass())}
            />
            <button
              className="btn btn-primary sm"
              disabled={busy || !pass}
              onClick={() => void run(ds.unlock(pass)).then((ok) => ok && resetPass())}
            >
              Entsperren
            </button>
          </div>
          <small className="settings-note">
            Passphrase vergessen? Unten „Sync-Daten in Google löschen“ – danach lädt jedes Gerät seinen Stand neu hoch.
          </small>
        </div>
      )}

      {status.enabled && status.googleConnected && !status.needsGrant && (
        <>
          <div className="settings-row">
            <div className="settings-label">
              <span>{status.running ? 'Gleiche ab …' : `Zuletzt abgeglichen: ${lastSyncLabel(status.lastSync)}`}</span>
              <small>
                {status.encrypted ? 'Verschlüsselt mit deiner Passphrase.' : 'Unverschlüsselt in deinem Google Drive.'}
              </small>
            </div>
            <div className="settings-control">
              <button className="btn btn-outline sm" disabled={status.running || busy} onClick={() => void run(ds.syncNow())}>
                <RefreshCw size={13} className={status.running ? 'spin' : ''} /> Jetzt abgleichen
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-label">
              <span>Name dieses Geräts</span>
              <small>So erscheint es auf deinen anderen Geräten.</small>
            </div>
            <div className="settings-control">
              <input
                className="input device-sync-name"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== status.deviceName && void run(ds.setName(name))}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              />
            </div>
          </div>

          <div className="google-cal-head">
            <span>Geräte</span>
          </div>
          <ul className="device-sync-list">
            {status.devices.map((d) => (
              <li key={d.id}>
                {d.self ? <Monitor size={14} /> : <Smartphone size={14} />}
                <span className="device-sync-dname">
                  {d.name}
                  {d.self && <em> · dieses Gerät</em>}
                </span>
                <span className="device-sync-seen">{d.savedAt ? lastSyncLabel(d.savedAt) : 'noch nicht hochgeladen'}</span>
                {!d.self && (
                  <button
                    className="icon-btn sm"
                    title="Gerät entfernen"
                    aria-label={`${d.name} entfernen`}
                    disabled={busy}
                    onClick={() =>
                      askConfirm({
                        title: `„${d.name}“ entfernen?`,
                        body: 'Der Stand dieses Geräts wird aus Google Drive gelöscht. Was schon hier angekommen ist, bleibt. Gleicht das Gerät sich später wieder ab, taucht es erneut auf.',
                        confirmLabel: 'Entfernen',
                        action: () => void run(ds.removeDevice(d.id))
                      })
                    }
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {others.length === 0 && (
            <p className="settings-note">Noch kein weiteres Gerät. Schalte den Sync auf dem anderen Gerät mit demselben Google-Konto ein.</p>
          )}

          {!status.needsPassphrase && (
            <div className="device-sync-crypt">
              <div className="settings-row">
                <div className="settings-label">
                  <span>
                    <KeyRound size={13} /> Verschlüsselung {status.encrypted ? 'an' : 'aus'}
                  </span>
                  <small>
                    Mit Passphrase kann niemand die Daten in deinem Drive lesen, auch Google nicht. Vergisst du sie, ist
                    nur der Sync-Stand weg – die Daten auf deinen Geräten bleiben.
                  </small>
                </div>
                <div className="settings-control">
                  {passMode === 'off' && (
                    <button className="btn btn-ghost sm" disabled={busy} onClick={() => setPassMode('set')}>
                      {status.encrypted ? 'Passphrase ändern' : 'Verschlüsseln …'}
                    </button>
                  )}
                  {status.encrypted && passMode === 'off' && (
                    <button
                      className="btn btn-ghost sm"
                      disabled={busy}
                      onClick={() =>
                        askConfirm({
                          title: 'Verschlüsselung ausschalten?',
                          body: 'Die Sync-Daten liegen danach unverschlüsselt in deinem Google Drive. Deine anderen Geräte brauchen keine Passphrase mehr.',
                          confirmLabel: 'Ausschalten',
                          action: () => void run(ds.setPassphrase(null))
                        })
                      }
                    >
                      Ausschalten
                    </button>
                  )}
                </div>
              </div>
              {passMode === 'set' && (
                <div className="device-sync-pass">
                  <div className="device-sync-pass-row">
                    <input
                      className="input"
                      type="password"
                      value={pass}
                      placeholder={`Neue Passphrase (mind. ${MIN_PASSPHRASE} Zeichen)`}
                      onChange={(e) => setPass(e.target.value)}
                      autoFocus
                    />
                    <input
                      className="input"
                      type="password"
                      value={pass2}
                      placeholder="Wiederholen"
                      onChange={(e) => setPass2(e.target.value)}
                    />
                  </div>
                  {pass2 && pass !== pass2 && <small className="google-sync-error">Die beiden Eingaben stimmen nicht überein.</small>}
                  <div className="device-sync-pass-row">
                    <button
                      className="btn btn-primary sm"
                      disabled={busy || !passOk}
                      onClick={() => void run(ds.setPassphrase(pass)).then((ok) => ok && resetPass())}
                    >
                      {status.encrypted ? 'Passphrase ändern' : 'Verschlüsseln'}
                    </button>
                    <button className="btn btn-ghost sm" onClick={resetPass}>
                      Abbrechen
                    </button>
                  </div>
                  <small className="settings-note">
                    Deine anderen Geräte fragen danach einmal nach der Passphrase. Schreib sie dir irgendwo auf.
                  </small>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {status.enabled && status.googleConnected && !status.needsGrant && (
        <div className="settings-row">
          <div className="settings-label">
            <span>Sync-Daten in Google löschen</span>
            <small>Entfernt den App-Ordner in Drive. Die Daten auf deinen Geräten bleiben.</small>
          </div>
          <div className="settings-control">
            <button
              className="btn btn-danger-outline sm"
              disabled={busy}
              onClick={() =>
                askConfirm({
                  title: 'Sync-Daten in Google löschen?',
                  body: 'Alle Sync-Dateien im App-Ordner deines Google Drive werden gelöscht, auch die Verschlüsselung. Die Daten auf deinen Geräten bleiben; jedes Gerät lädt seinen Stand beim nächsten Abgleich neu hoch.',
                  confirmLabel: 'Löschen',
                  action: () => void run(ds.wipe())
                })
              }
            >
              Löschen
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** status plus a setter, so action results show without waiting for the broadcast */
function useDeviceSyncStatusState(): [DeviceSyncStatus | null, (s: DeviceSyncStatus) => void] {
  const [status, setStatus] = useState<DeviceSyncStatus | null>(null)
  useEffect(() => {
    const ds = api.deviceSync
    if (!ds) return
    let alive = true
    void ds.status().then((s) => alive && setStatus(s))
    const off = ds.onStatus(setStatus)
    return () => {
      alive = false
      off()
    }
  }, [])
  return [status, setStatus]
}
