import { ExternalLink, RefreshCw, RotateCw } from 'lucide-react'
import { RELEASES_URL, updateStatusLabel } from '@shared/update'
import { api } from '../../lib/api'
import { useUpdateInfo } from '../../lib/updateStatus'
import { useStore } from '../../store'

export function UpdateSection({ switchControl }: { switchControl: React.ReactNode }): React.JSX.Element {
  const info = useUpdateInfo()
  const updates = api.updates

  if (!updates) {
    return (
      <section className="settings-section">
        <h2>Updates</h2>
        <p className="settings-note">Nur in der Desktop-App verfügbar.</p>
      </section>
    )
  }

  const status = info?.status
  const busy = status?.state === 'checking' || status?.state === 'downloading'
  const unsupported = status?.state === 'unsupported'

  return (
    <section className="settings-section">
      <h2>Updates</h2>
      <div className="settings-row">
        <div className="settings-label">
          <span>Version {info?.current ?? '…'}</span>
          <small className={status?.state === 'error' ? 'update-error' : undefined}>
            {status ? updateStatusLabel(status) : ' '}
          </small>
        </div>
        <div className="settings-control">
          {status?.state === 'ready' ? (
            <button className="btn btn-primary sm" onClick={() => void updates.install()}>
              <RotateCw size={14} /> Jetzt neu starten
            </button>
          ) : (
            <button className="btn btn-ghost sm" disabled={busy || unsupported} onClick={() => void updates.check()}>
              <RefreshCw size={14} className={busy ? 'spin' : undefined} /> Nach Updates suchen
            </button>
          )}
          <a className="btn btn-ghost sm" href={RELEASES_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Änderungen
          </a>
        </div>
      </div>
      <div className="settings-row">
        <div className="settings-label">
          <span>Automatisch nach Updates suchen</span>
          <small>Beim Start und alle 6 Stunden. Neue Versionen werden im Hintergrund geladen und beim Beenden installiert.</small>
        </div>
        <div className="settings-control">{switchControl}</div>
      </div>
    </section>
  )
}

/** small pill in the title bar once an update is downloaded */
export function UpdateReadyPill(): React.JSX.Element | null {
  const info = useUpdateInfo()
  const setPage = useStore((s) => s.setPage)
  if (info?.status.state !== 'ready') return null
  return (
    <button
      className="update-pill"
      title={`Version ${info.status.version} installieren – zu den Optionen`}
      onClick={() => setPage('settings')}
    >
      <RotateCw size={12} /> Update bereit
    </button>
  )
}
