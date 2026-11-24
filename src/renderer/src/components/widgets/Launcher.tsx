import { useEffect, useState } from 'react'
import { AppWindow, ArrowUp, FolderOpen, Gamepad2, Globe, Layers, Plus, Rocket, Trash2, X } from 'lucide-react'
import {
  LAUNCHER_DEFAULTS,
  LAUNCHER_WIDGET_ID,
  nameFromTarget,
  targetKind,
  type LauncherConfig,
  type LaunchItem
} from '@shared/launcher'
import { useStore } from '../../store'
import { api } from '../../lib/api'
import { useWidgetConfig } from '../../plugins/registry'

const newId = (): string => `launch-${Math.random().toString(36).slice(2, 8)}`
const GAME_SCHEMES = /^(steam|com\.epicgames\.launcher|battlenet|uplay|origin2?|goggalaxy|heroic):/i

/** file icons are looked up once per target and kept for the session */
const iconCache = new Map<string, Promise<string | null>>()
function useIcon(target: string | undefined): string | null {
  const [icon, setIcon] = useState<string | null>(null)
  useEffect(() => {
    setIcon(null)
    if (!target || !api.launcher || targetKind(target) !== 'file') return
    let alive = true
    if (!iconCache.has(target)) iconCache.set(target, api.launcher.icon(target))
    void iconCache.get(target)!.then((i) => alive && setIcon(i))
    return () => {
      alive = false
    }
  }, [target])
  return icon
}

function FallbackIcon({ item }: { item: LaunchItem }): React.JSX.Element {
  if (item.targets.length > 1) return <Layers size={22} />
  const t = item.targets[0] ?? ''
  if (GAME_SCHEMES.test(t)) return <Gamepad2 size={22} />
  if (/^https?:/i.test(t)) return <Globe size={22} />
  if (targetKind(t) === 'file' && !/\.[a-z0-9]{2,4}$/i.test(t)) return <FolderOpen size={22} />
  return <AppWindow size={22} />
}

function Tile({ item, onLaunch, onDropFiles }: { item: LaunchItem; onLaunch(): void; onDropFiles(paths: string[]): void }): React.JSX.Element {
  const icon = useIcon(item.targets.find((t) => targetKind(t) === 'file'))
  const [over, setOver] = useState(false)
  const scene = item.targets.length > 1
  return (
    <button
      className={`launch-tile ${over ? 'drop' : ''}`}
      onClick={onLaunch}
      title={scene ? `${item.name}: öffnet ${item.targets.map(nameFromTarget).join(', ')}` : item.targets[0]}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        e.stopPropagation()
        setOver(false)
        onDropFiles(droppedPaths(e))
      }}
    >
      <span className="launch-icon">{icon ? <img src={icon} alt="" /> : <FallbackIcon item={item} />}</span>
      <span className="launch-name">{item.name || 'Ohne Namen'}</span>
      {scene && <span className="launch-badge">{item.targets.length}</span>}
    </button>
  )
}

function droppedPaths(e: React.DragEvent): string[] {
  if (!api.launcher) return []
  return [...e.dataTransfer.files].map((f) => api.launcher!.pathOf(f)).filter(Boolean)
}

/** one click opens a program, game, folder or link; tiles with several targets start a whole scene */
export function Launcher(): React.JSX.Element {
  const [cfg, update] = useWidgetConfig<LauncherConfig>(LAUNCHER_WIDGET_ID, LAUNCHER_DEFAULTS)
  const pushToast = useStore((s) => s.pushToast)
  const [over, setOver] = useState(false)
  const items = cfg.items

  const launch = async (item: LaunchItem): Promise<void> => {
    if (!api.launcher) return
    const res = await api.launcher.open(item.targets)
    if (res.failed.length === 0) {
      pushToast({ kind: 'info', title: `${item.name} gestartet` })
    } else {
      pushToast({
        kind: 'info',
        title: res.opened ? `${item.name}: ${res.failed.length} von ${item.targets.length} nicht geöffnet` : `${item.name} ließ sich nicht öffnen`,
        body: res.failed.map((f) => `${nameFromTarget(f.target)}: ${f.error}`).join(' · ')
      })
    }
  }

  const addTiles = (paths: string[]): void => {
    if (paths.length) update({ items: [...items, ...paths.map((p) => ({ id: newId(), name: nameFromTarget(p), targets: [p] }))] })
  }
  const addToTile = (id: string, paths: string[]): void =>
    update({ items: items.map((i) => (i.id === id ? { ...i, targets: [...i.targets, ...paths] } : i)) })

  const pick = async (): Promise<void> => {
    const path = await api.launcher?.pick()
    if (path) addTiles([path])
  }

  if (!api.launcher) {
    return (
      <section className="card widget launch-card">
        <div className="widget-head">
          <div>
            <h3>Starter</h3>
            <p>Programme, Spiele und Szenen</p>
          </div>
        </div>
        <p className="empty-mini with-icon">
          <Rocket size={16} /> Programme starten geht nur in der Desktop-App.
        </p>
      </section>
    )
  }

  return (
    <section
      className={`card widget launch-card ${over ? 'drop' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        addTiles(droppedPaths(e))
      }}
    >
      <div className="widget-head">
        <div>
          <h3>Starter</h3>
          <p>{items.length ? 'Klick startet · Datei auf eine Kachel ziehen macht sie zur Szene' : 'Programme, Spiele und Szenen'}</p>
        </div>
      </div>
      <div className="launch-grid">
        {items.map((item) => (
          <Tile key={item.id} item={item} onLaunch={() => void launch(item)} onDropFiles={(p) => addToTile(item.id, p)} />
        ))}
        <button className="launch-tile launch-add" onClick={() => void pick()} title="Programm, Spiel oder Verknüpfung hinzufügen">
          <span className="launch-icon">
            <Plus size={22} />
          </span>
          <span className="launch-name">Hinzufügen</span>
        </button>
      </div>
      {items.length === 0 && (
        <p className="widget-settings-hint launch-empty">
          Zieh Programme, Spiele-Verknüpfungen vom Desktop (auch Steam) oder Ordner hierher. Links und Szenen mit mehreren
          Programmen legst du unter Anordnen → ⚙ an.
        </p>
      )}
    </section>
  )
}

/** options: tiles with name and targets; a tile with several targets is a scene */
export function LauncherSettings(): React.JSX.Element {
  const [cfg, update] = useWidgetConfig<LauncherConfig>(LAUNCHER_WIDGET_ID, LAUNCHER_DEFAULTS)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const items = cfg.items

  const setItem = (id: string, patch: Partial<LaunchItem>): void =>
    update({ items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  const addTarget = (item: LaunchItem, target: string): void => {
    const t = target.trim()
    if (targetKind(t) === 'invalid') return
    setItem(item.id, { targets: [...item.targets, t] })
    setDrafts((d) => ({ ...d, [item.id]: '' }))
  }
  const move = (index: number): void => {
    const next = [...items]
    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
    update({ items: next })
  }

  return (
    <div className="widget-settings launch-settings">
      {items.length === 0 && <p className="widget-settings-hint">Noch keine Kacheln.</p>}
      {items.map((item, i) => {
        const draft = drafts[item.id] ?? ''
        const draftKind = targetKind(draft)
        return (
          <div key={item.id} className="launch-edit">
            <div className="launch-edit-head">
              <input className="input sm" value={item.name} aria-label="Name der Kachel" onChange={(e) => setItem(item.id, { name: e.target.value })} />
              <button className="icon-btn sm" title="Nach vorne" aria-label={`${item.name} nach vorne`} disabled={i === 0} onClick={() => move(i)}>
                <ArrowUp size={14} />
              </button>
              <button
                className="icon-btn sm danger"
                title="Kachel entfernen"
                aria-label={`${item.name} entfernen`}
                onClick={() => update({ items: items.filter((x) => x.id !== item.id) })}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <ul className="launch-targets">
              {item.targets.map((t, ti) => (
                <li key={`${t}-${ti}`}>
                  <span title={t}>{t}</span>
                  <button
                    className="icon-btn sm"
                    title="Entfernen"
                    aria-label={`${nameFromTarget(t)} entfernen`}
                    onClick={() => setItem(item.id, { targets: item.targets.filter((_, x) => x !== ti) })}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="launch-add-target"
              onSubmit={(e) => {
                e.preventDefault()
                addTarget(item, draft)
              }}
            >
              <input
                className="input sm"
                value={draft}
                placeholder="Link oder Pfad, z. B. https://… oder steam://rungameid/…"
                aria-label={`Ziel zu ${item.name} hinzufügen`}
                aria-invalid={draft !== '' && draftKind === 'invalid'}
                onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
              />
              <button type="submit" className="btn sm btn-outline" disabled={draftKind === 'invalid'}>
                Dazu
              </button>
              <button
                type="button"
                className="btn sm btn-ghost"
                onClick={async () => {
                  const p = await api.launcher?.pick()
                  if (p) addTarget(item, p)
                }}
              >
                Datei …
              </button>
            </form>
          </div>
        )
      })}
      <button className="link-btn" onClick={() => update({ items: [...items, { id: newId(), name: 'Neue Szene', targets: [] }] })}>
        <Plus size={13} /> Kachel oder Szene anlegen
      </button>
      <p className="widget-settings-hint">
        Eine Kachel mit mehreren Zielen ist eine Szene und öffnet alle nacheinander. Ziele können Programme, Verknüpfungen,
        Ordner, Dokumente oder Links sein, auch <code>steam://</code>, <code>obsidian://</code> oder <code>discord://</code>.
      </p>
    </div>
  )
}
