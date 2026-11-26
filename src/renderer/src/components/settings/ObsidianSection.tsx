import { useEffect, useMemo, useState } from 'react'
import { FolderPlus, Trash2 } from 'lucide-react'
import { mergeVaults, preselectVaults, vaultNameOf, type ObsidianVault, type VaultRef } from '@shared/notes'
import { useStore } from '../../store'
import { api } from '../../lib/api'
import { useNotes } from '../../lib/notes'

/** Optionen → Obsidian: which vaults the app may read. It never writes into them. */
export function ObsidianSection(): React.JSX.Element {
  const obsidian = api.obsidian
  const stored = useStore((s) => s.data!.settings.obsidianVaults)
  const update = useStore((s) => s.updateSettings)
  const entries = useNotes((s) => s.entries)
  const status = useNotes((s) => s.status)
  const [found, setFound] = useState<VaultRef[] | null>(null)

  useEffect(() => {
    if (obsidian) void obsidian.discover().then(setFound)
  }, [obsidian])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of entries) m.set(e.vault, (m.get(e.vault) ?? 0) + 1)
    return m
  }, [entries])

  if (!obsidian) {
    return (
      <section className="settings-section" id="settings-obsidian">
        <h2>Obsidian</h2>
        <p className="settings-note">Nur in der Desktop-App verfügbar.</p>
      </section>
    )
  }

  // first visit: nothing stored yet, so show the suggestion (vaults of the most common folder on)
  const setUp = stored.length > 0
  const vaults: ObsidianVault[] = setUp ? mergeVaults(stored, found ?? []) : preselectVaults(found ?? [])
  const save = (next: ObsidianVault[]): void => update({ obsidianVaults: next })
  const toggle = (v: ObsidianVault, enabled: boolean): void => save(vaults.map((x) => (x.path === v.path ? { ...x, enabled } : x)))
  const known = new Set((found ?? []).map((v) => v.path.toLowerCase()))

  const addFolder = async (): Promise<void> => {
    const path = await obsidian.pickFolder()
    if (!path || vaults.some((v) => v.path.toLowerCase() === path.toLowerCase())) return
    save([...vaults, { name: vaultNameOf(path), path, enabled: true }])
  }

  return (
    <section className="settings-section" id="settings-obsidian">
      <h2>Obsidian</h2>
      <p className="settings-note">
        Verknüpfe Termine, ToDos, Projekte und Termin-Vorlagen mit Notizen aus deinen Vaults. Ein Klick öffnet die Notiz in
        Obsidian. Ember Planner liest die Vaults nur und schreibt nie hinein.
      </p>
      {found === null ? null : vaults.length === 0 ? (
        <p className="settings-note">Keine Vaults gefunden. Ist Obsidian installiert? Du kannst einen Ordner auch selbst hinzufügen.</p>
      ) : (
        <div className="vault-list">
          {!setUp && (
            <div className="settings-row">
              <div className="settings-label">
                <span>{vaults.length} Vaults gefunden</span>
                <small>Vorgeschlagen sind die eingeschalteten. Übernimm sie oder stell die Schalter um.</small>
              </div>
              <div className="settings-control">
                <button className="btn btn-primary sm" onClick={() => save(vaults)}>
                  Übernehmen
                </button>
              </div>
            </div>
          )}
          {vaults.map((v) => {
            const n = counts.get(v.name)
            return (
              <div className="vault-row" key={v.path}>
                <div>
                  <span>{v.name}</span>
                  <small title={v.path}>
                    {v.enabled && status === 'ready' ? `${n ?? 0} Notizen · ` : v.enabled && status === 'loading' ? 'wird gelesen … · ' : ''}
                    {v.path}
                  </small>
                </div>
                {setUp && !known.has(v.path.toLowerCase()) && (
                  <button className="icon-btn sm" title="Aus der Liste entfernen" onClick={() => save(vaults.filter((x) => x.path !== v.path))}>
                    <Trash2 size={14} />
                  </button>
                )}
                <label className="toggle">
                  <input type="checkbox" checked={v.enabled} onChange={(e) => toggle(v, e.target.checked)} aria-label={`${v.name} einlesen`} />
                  <span className="toggle-track" />
                </label>
              </div>
            )
          })}
        </div>
      )}
      <div className="settings-row">
        <div className="settings-label">
          <span>Weiterer Vault</span>
          <small>Für einen Ordner, den Obsidian nicht in seiner Liste hat. Öffnen klappt erst, wenn Obsidian ihn auch als Vault kennt.</small>
        </div>
        <div className="settings-control">
          <button className="btn btn-outline sm" onClick={() => void addFolder()}>
            <FolderPlus size={14} /> Ordner wählen
          </button>
        </div>
      </div>
    </section>
  )
}
