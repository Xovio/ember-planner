import { useMemo, useRef } from 'react'
import { addDays, isWeekend } from 'date-fns'
import { Flag, Hourglass } from 'lucide-react'
import { daysBetween, effectiveDeadline, localDate } from '@shared/todo'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { useCategoryMap, useOpenTodos } from '../../lib/todos'
import { fmt } from '../../lib/dates'
import { HoverTip, useHoverTip } from './HoverTip'

const DAYS = 14
const MAX_ROWS = 8

/**
 * Next 14 days as a timeline: one row per ToDo, the soft→hard window as a band,
 * soft deadline as a ring, hard deadline as a filled flag marker.
 * Identity = category (legend below); deadline kind = marker shape, never color.
 */
export function DeadlineRadar(): React.JSX.Element {
  const todos = useOpenTodos()
  const categories = useCategoryMap()
  const openTodo = useStore((s) => s.selectTodo)
  const ref = useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useHoverTip()

  const today = localDate(new Date())
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(new Date(), i)), [])
  const horizon = localDate(addDays(new Date(), DAYS - 1))

  const rows = useMemo(
    () =>
      todos
        .filter((t) => {
          const eff = effectiveDeadline(t)
          return eff && eff <= horizon
        })
        .slice(0, MAX_ROWS),
    [todos, horizon]
  )
  const hidden = todos.filter((t) => {
    const eff = effectiveDeadline(t)
    return eff && eff <= horizon
  }).length - rows.length

  const legend = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>()
    for (const t of rows) {
      const c = t.categoryId ? categories.get(t.categoryId) : undefined
      const key = c?.id ?? '_none'
      if (!seen.has(key)) seen.set(key, { name: c?.name ?? 'Ohne Kategorie', color: c ? calVar(c.color) : 'var(--text-3)' })
    }
    return [...seen.values()]
  }, [rows, categories])

  /** column position (0…DAYS-1), clamped; overdue dates pin to column 0 */
  const col = (d: string): number => Math.max(0, Math.min(DAYS - 1, daysBetween(today, d)))
  const pct = (c: number): string => `${((c + 0.5) / DAYS) * 100}%`

  return (
    <div className="card widget">
      <div className="widget-head">
        <div>
          <h3>Deadline-Radar</h3>
          <p>Die nächsten 14 Tage</p>
        </div>
        <div className="radar-keys">
          <span>
            <i className="rk-soft" /> weich
          </span>
          <span>
            <i className="rk-hard" /> hart
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="empty-mini">Keine Deadlines in den nächsten 14 Tagen.</p>
      ) : (
        <div className="radar" ref={ref} onMouseLeave={hide}>
          <div className="radar-head">
            <span />
            <div className="radar-days" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
              {days.map((d, i) => (
                <span key={i} className={`${i === 0 ? 'today' : ''} ${isWeekend(d) ? 'we' : ''}`}>
                  <b>{fmt(d, 'EEEEEE')}</b>
                  {d.getDate()}
                </span>
              ))}
            </div>
          </div>
          {rows.map((t) => {
            const cat = t.categoryId ? categories.get(t.categoryId) : undefined
            const color = cat ? calVar(cat.color) : 'var(--text-3)'
            const s = t.softDeadline ? col(t.softDeadline) : undefined
            const h = t.hardDeadline ? col(t.hardDeadline) : undefined
            const overdue = !!t.hardDeadline && t.hardDeadline < today
            const softMissed = !!t.softDeadline && t.softDeadline < today
            return (
              <button
                key={t.id}
                className="radar-row"
                onClick={() => openTodo(t.id)}
                style={{ '--c': color } as React.CSSProperties}
              >
                <span className="radar-label" title={t.title}>
                  {overdue && <span className="status-pill crit">überfällig</span>}
                  {!overdue && softMissed && <span className="status-pill warn">weich verpasst</span>}
                  {t.title}
                </span>
                <span className="radar-track">
                  {days.map((d, i) => (
                    <i key={i} className={`radar-gridcell ${isWeekend(d) ? 'we' : ''}`} style={{ left: `${(i / DAYS) * 100}%`, width: `${100 / DAYS}%` }} />
                  ))}
                  <i className="radar-stem" style={{ width: pct(Math.min(s ?? 99, h ?? 99)) }} />
                  {s !== undefined && h !== undefined && h > s && (
                    <i className="radar-band" style={{ left: pct(s), width: `${((h - s) / DAYS) * 100}%` }} />
                  )}
                  {s !== undefined && (
                    <i
                      className="radar-mark soft"
                      style={{ left: pct(s) }}
                      onMouseEnter={(e) => show(e, ref.current, `Weich: ${t.title}`, fmt(new Date(t.softDeadline + 'T00:00'), 'EEE, d. MMM'))}
                    >
                      <Hourglass size={9} />
                    </i>
                  )}
                  {h !== undefined && (
                    <i
                      className="radar-mark hard"
                      style={{ left: pct(h) }}
                      onMouseEnter={(e) => show(e, ref.current, `Hart: ${t.title}`, fmt(new Date(t.hardDeadline + 'T00:00'), 'EEE, d. MMM'))}
                    >
                      <Flag size={9} />
                    </i>
                  )}
                </span>
              </button>
            )
          })}
          <HoverTip tip={tip} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="radar-foot">
          <div className="legend">
            {legend.map((l) => (
              <span key={l.name}>
                <i style={{ background: l.color }} />
                {l.name}
              </span>
            ))}
          </div>
          {hidden > 0 && <span className="muted">+ {hidden} weitere</span>}
        </div>
      )}
    </div>
  )
}
