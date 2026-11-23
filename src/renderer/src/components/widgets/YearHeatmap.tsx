import { useMemo, useRef, useState } from 'react'
import { addDays, addWeeks, isAfter, startOfDay, startOfWeek } from 'date-fns'
import { expandAll } from '@shared/recurrence'
import { useStore, useVisibleEvents } from '../../store'
import { WEEK, fmt, toLocalDate } from '../../lib/dates'
import { HoverTip, useHoverTip } from './HoverTip'

const WEEKS = 53

/** count → heat step (0 = empty) */
function level(n: number): number {
  if (n <= 0) return 0
  if (n >= 5) return 5
  return n
}

export function YearHeatmap(): React.JSX.Element {
  const events = useVisibleEvents()
  const todos = useStore((s) => s.data!.todos)
  const [mode, setMode] = useState<'events' | 'todos'>('events')
  const ref = useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useHoverTip()

  const { weeks, counts, total, activeDays, months } = useMemo(() => {
    const today = startOfDay(new Date())
    const first = addWeeks(startOfWeek(today, WEEK), -(WEEKS - 1))
    const end = addDays(startOfWeek(today, WEEK), 7)
    const counts = new Map<string, number>()
    if (mode === 'events') {
      for (const o of expandAll(events, first, end)) {
        for (let d = startOfDay(o.start); d < o.end; d = addDays(d, 1)) {
          const k = toLocalDate(d)
          counts.set(k, (counts.get(k) ?? 0) + 1)
          if (!o.event.allDay) break
        }
      }
    } else {
      for (const t of todos) {
        if (!t.done || !t.doneAt) continue
        const k = toLocalDate(new Date(t.doneAt))
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
    const weeks: Date[][] = []
    const months: { col: number; label: string }[] = []
    for (let w = 0; w < WEEKS; w++) {
      const ws = addWeeks(first, w)
      weeks.push(Array.from({ length: 7 }, (_, i) => addDays(ws, i)))
      const firstOfMonth = weeks[w].find((d) => d.getDate() === 1)
      if (firstOfMonth) months.push({ col: w, label: fmt(firstOfMonth, 'MMM') })
    }
    let total = 0
    let activeDays = 0
    for (const [k, v] of counts) {
      if (k > toLocalDate(today)) continue
      total += v
      activeDays++
    }
    return { weeks, counts, total, activeDays, months }
  }, [events, todos, mode])

  const today = startOfDay(new Date())

  return (
    <div className="card widget">
      <div className="widget-head">
        <div>
          <h3>Aktivität</h3>
          <p>{mode === 'events' ? 'Termine' : 'Erledigte ToDos'} pro Tag, letzte 12 Monate</p>
        </div>
        <div className="segmented small" role="tablist" aria-label="Datenquelle">
          <button role="tab" aria-selected={mode === 'events'} className={mode === 'events' ? 'on' : ''} onClick={() => setMode('events')}>
            Termine
          </button>
          <button role="tab" aria-selected={mode === 'todos'} className={mode === 'todos' ? 'on' : ''} onClick={() => setMode('todos')}>
            ToDos
          </button>
        </div>
        <div className="widget-figure">
          <strong>{total}</strong>
          <span>
            {mode === 'events' ? 'Termine' : 'erledigt'} an {activeDays} Tagen
          </span>
        </div>
      </div>
      <div className="heatmap" ref={ref} onMouseLeave={hide}>
        <div className="hm-months" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
          {months.map((m) => (
            <span key={m.col} style={{ gridColumn: m.col + 1 }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="hm-body">
          <div className="hm-dows">
            <span>Mo</span>
            <span />
            <span>Mi</span>
            <span />
            <span>Fr</span>
            <span />
            <span />
          </div>
          <div className="hm-grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, 1fr)` }}>
            {weeks.map((week) =>
              week.map((d) => {
                const future = isAfter(d, today)
                const n = counts.get(toLocalDate(d)) ?? 0
                const label =
                  mode === 'events' ? `${n} ${n === 1 ? 'Termin' : 'Termine'}` : `${n} erledigt`
                return (
                  <i
                    key={d.toISOString()}
                    className={`hm-cell l${level(n)} ${future ? 'future' : ''}`}
                    onMouseEnter={(e) => show(e, ref.current, fmt(d, 'EEE, d. MMM yyyy'), label)}
                    aria-label={`${fmt(d, 'd. MMM yyyy')}: ${label}`}
                  />
                )
              })
            )}
          </div>
        </div>
        <div className="hm-legend">
          <span>weniger</span>
          {[0, 1, 2, 3, 4, 5].map((l) => (
            <i key={l} className={`hm-cell l${l}`} />
          ))}
          <span>mehr</span>
        </div>
        <HoverTip tip={tip} />
      </div>
    </div>
  )
}
