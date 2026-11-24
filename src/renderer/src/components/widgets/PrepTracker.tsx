import { useEffect, useMemo, useState } from 'react'
import { Hourglass, Plus, Trash2 } from 'lucide-react'
import {
  ANY,
  formatDuration,
  milestone,
  periodStart,
  PREP_DEFAULTS,
  PREP_WIDGET_ID,
  prepConfig,
  sumLog,
  type AppTimeState,
  type Period,
  type PrepConfig,
  type TrackedApp
} from '@shared/apptime'
import type { CalendarColor } from '@shared/types'
import { api } from '../../lib/api'
import { calVar } from '../../lib/theme'
import { useWidgetConfig } from '../../plugins/registry'
import { useNow } from '../calendar/TimeGrid'

const COLORS: CalendarColor[] = ['violet', 'aqua', 'orange', 'magenta', 'green', 'blue', 'yellow', 'red']
const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Heute' },
  { id: 'week', label: 'Woche' },
  { id: 'month', label: 'Monat' },
  { id: 'all', label: 'Gesamt' }
]

function usePrepConfig(): [PrepConfig, (p: Partial<PrepConfig>) => void] {
  const [raw, update] = useWidgetConfig<PrepConfig>(PREP_WIDGET_ID, PREP_DEFAULTS)
  return [useMemo(() => prepConfig(raw), [raw]), update]
}

/** live state from the main process; null while loading or outside the desktop app */
function useAppTime(): AppTimeState | null {
  const [state, setState] = useState<AppTimeState | null>(null)
  useEffect(() => {
    if (!api.appTime) return
    let alive = true
    void api.appTime.get().then((s) => alive && setState(s))
    const off = api.appTime.onUpdate(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}

const hoursLabel = (h: number): string => `${Math.floor(h).toLocaleString('de-DE')} h`

/** how long the prep programs were open: per app and overall, with a running all-time total */
export function PrepTracker(): React.JSX.Element {
  const [cfg] = usePrepConfig()
  const state = useAppTime()
  const now = useNow(60_000)
  const [period, setPeriod] = useState<Period>('week')

  const sums = useMemo(() => (state ? sumLog(state.log, periodStart(period, now), now) : {}), [state, period, now])
  const allTime = useMemo(() => (state ? sumLog(state.log, null, now)[ANY] ?? 0 : 0), [state, now])
  const totalHours = cfg.baseHours + allTime / 3600
  const { from, to: goal } = milestone(totalHours)
  const progress = Math.min(1, Math.max(0, (totalHours - from) / (goal - from)))
  const max = Math.max(1, ...cfg.apps.map((a) => sums[a.id] ?? 0))
  const running = new Set(state?.running ?? [])

  const head = (
    <div className="widget-head">
      <div>
        <h3>{cfg.title || 'Prep-Zeit'}</h3>
        <p>{cfg.apps.map((a) => a.name).join(' · ') || 'Keine Programme gewählt'}</p>
      </div>
      <div className="widget-figure prep-figure">
        <strong>{hoursLabel(totalHours)}</strong>
        <span>insgesamt</span>
      </div>
    </div>
  )

  if (!api.appTime || (state && !state.available)) {
    return (
      <section className="card widget prep-card">
        {head}
        <p className="empty-mini with-icon">
          <Hourglass size={16} /> Die Zeiterfassung läuft nur in der Desktop-App unter Windows.
        </p>
      </section>
    )
  }

  return (
    <section className="card widget prep-card">
      {head}
      <div className="prep-toolbar">
        <div className="segmented small" role="tablist" aria-label="Zeitraum">
          {PERIODS.map((p) => (
            <button key={p.id} role="tab" aria-selected={period === p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <span className="prep-sum" title="Zeit, in der mindestens eins der Programme offen war">
          {formatDuration(sums[ANY] ?? 0)}
        </span>
      </div>

      {!cfg.enabled && <p className="empty-mini">Pausiert. Unter Anordnen → ⚙ wieder einschalten.</p>}

      <ul className="prep-apps">
        {cfg.apps.map((a, i) => {
          const s = sums[a.id] ?? 0
          return (
            <li key={a.id} style={{ '--c': calVar(COLORS[i % COLORS.length]) } as React.CSSProperties}>
              <span className="prep-name">
                <span className={`prep-dot ${running.has(a.id) ? 'on' : ''}`} title={running.has(a.id) ? 'Läuft gerade' : 'Nicht geöffnet'} />
                {a.name}
              </span>
              <span className="prep-bar">
                <span style={{ width: `${(s / max) * 100}%` }} />
              </span>
              <span className="prep-time">{formatDuration(s)}</span>
            </li>
          )
        })}
      </ul>

      <div className="prep-goal" title={`${hoursLabel(totalHours)} von ${hoursLabel(goal)}`}>
        <span className="prep-goal-bar">
          <span style={{ width: `${progress * 100}%` }} />
        </span>
        <span>
          Noch {hoursLabel(Math.max(0, goal - totalHours))} bis <strong>{hoursLabel(goal)}</strong>
        </span>
      </div>
    </section>
  )
}

const newId = (): string => `app-${Math.random().toString(36).slice(2, 8)}`

/** options: which programs count, the hours from before, and pausing while away */
export function PrepTrackerSettings(): React.JSX.Element {
  const [cfg, update] = usePrepConfig()
  const [processes, setProcesses] = useState<string[]>([])

  useEffect(() => {
    void api.appTime?.processes().then(setProcesses)
  }, [])

  const setApp = (id: string, patch: Partial<TrackedApp>): void =>
    update({ apps: cfg.apps.map((a) => (a.id === id ? { ...a, ...patch } : a)) })

  return (
    <div className="widget-settings">
      <label>
        <span>Zeiterfassung</span>
        <span className="prep-check">
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => update({ enabled: e.target.checked })} /> läuft
        </span>
      </label>
      <label>
        <span>Titel</span>
        <input className="input sm" value={cfg.title} onChange={(e) => update({ title: e.target.value })} />
      </label>
      <label>
        <span>Stunden bisher</span>
        <input
          className="input sm"
          type="number"
          min={0}
          step={50}
          value={cfg.baseHours}
          onChange={(e) => update({ baseHours: Number(e.target.value) })}
        />
      </label>
      <label>
        <span>Abwesend</span>
        <span className="prep-check">
          <input type="checkbox" checked={cfg.pauseWhenIdle} onChange={(e) => update({ pauseWhenIdle: e.target.checked })} /> nicht
          zählen nach
          <input
            className="input sm prep-min"
            type="number"
            min={1}
            value={cfg.idleMinutes}
            disabled={!cfg.pauseWhenIdle}
            onChange={(e) => update({ idleMinutes: Number(e.target.value) })}
          />
          min ohne Eingabe
        </span>
      </label>

      <h4 className="prep-settings-sub">Programme</h4>
      <datalist id="prep-processes">
        {processes.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
      {cfg.apps.map((a) => (
        <div key={a.id} className="prep-app-row">
          <input className="input sm" value={a.name} aria-label="Name" onChange={(e) => setApp(a.id, { name: e.target.value })} />
          <input
            className="input sm"
            list="prep-processes"
            value={a.exes.join(', ')}
            placeholder="Programm.exe"
            aria-label={`Prozessnamen für ${a.name}`}
            onChange={(e) => setApp(a.id, { exes: e.target.value.split(',').map((x) => x.trimStart()) })}
          />
          <button className="icon-btn sm danger" title="Entfernen" aria-label={`${a.name} entfernen`} onClick={() => update({ apps: cfg.apps.filter((x) => x.id !== a.id) })}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        className="link-btn"
        onClick={() => update({ apps: [...cfg.apps, { id: newId(), name: 'Neues Programm', exes: [] }] })}
      >
        <Plus size={13} /> Programm hinzufügen
      </button>
      <p className="widget-settings-hint">
        Gezählt wird, solange das Programm offen ist, einmal pro Minute geprüft. „Gesamt“ zählt Überschneidungen nur einmal.
        Prozessnamen findest du im Task-Manager unter Details; während ein Programm läuft, schlägt das Feld es vor. Foundry
        im Browser lässt sich nicht erkennen, nur die Desktop-App.
      </p>
    </div>
  )
}
