import { useMemo, useRef } from 'react'
import { addDays, isToday, startOfWeek } from 'date-fns'
import { expandAll } from '@shared/recurrence'
import { useVisibleEvents } from '../../store'
import { WEEK, daysOfRange, fmt } from '../../lib/dates'
import { bookedMinutes, fmtHours, niceMax } from './metrics'
import { HoverTip, useHoverTip } from './HoverTip'

const CHART_H = 132

/** Single series → no legend; the card title names the measure. */
export function WeekLoad(): React.JSX.Element {
  const events = useVisibleEvents()
  const ref = useRef<HTMLDivElement>(null)
  const { tip, show, hide } = useHoverTip()

  const { days, values, max, total } = useMemo(() => {
    const start = startOfWeek(new Date(), WEEK)
    const days = daysOfRange(start, 7)
    const occs = expandAll(events, start, addDays(start, 7))
    const values = days.map((d) => bookedMinutes(d, occs))
    const maxH = niceMax(Math.max(...values) / 60)
    return { days, values, max: maxH * 60, total: values.reduce((a, b) => a + b, 0) }
  }, [events])

  const peak = Math.max(...values)
  const ticks = [0, max / 2, max]

  return (
    <div className="card widget">
      <div className="widget-head">
        <div>
          <h3>Wochenauslastung</h3>
          <p>Verplante Stunden pro Tag</p>
        </div>
        <div className="widget-figure">
          <strong>{fmtHours(total)}</strong>
          <span>diese Woche</span>
        </div>
      </div>
      <div className="weekload" ref={ref} onMouseLeave={hide}>
        <div className="wl-axis" style={{ height: CHART_H }}>
          {ticks.map((t) => (
            <span key={t} style={{ bottom: (t / max) * CHART_H }}>
              {t / 60}
            </span>
          ))}
        </div>
        <div className="wl-plot" style={{ height: CHART_H }}>
          {ticks.map((t) => (
            <i key={t} className="wl-grid" style={{ bottom: (t / max) * CHART_H }} />
          ))}
          {days.map((d, i) => {
            const v = values[i]
            const h = v === 0 ? 0 : Math.max(4, (v / max) * CHART_H)
            const labelled = isToday(d) || (v === peak && v > 0)
            return (
              <div
                key={d.toISOString()}
                className={`wl-col ${isToday(d) ? 'today' : ''}`}
                tabIndex={0}
                onMouseEnter={(e) => show(e, ref.current, fmt(d, 'EEEE, d. MMM'), fmtHours(v))}
                onFocus={(e) => show(e, ref.current, fmt(d, 'EEEE, d. MMM'), fmtHours(v))}
                onBlur={hide}
                aria-label={`${fmt(d, 'EEEE')}: ${fmtHours(v)}`}
              >
                {labelled && v > 0 && (
                  <span className="wl-value" style={{ bottom: h + 4 }}>
                    {fmtHours(v)}
                  </span>
                )}
                <span className="wl-bar" style={{ height: h }} />
              </div>
            )
          })}
        </div>
        <div className="wl-labels">
          {days.map((d) => (
            <span key={d.toISOString()} className={isToday(d) ? 'today' : ''}>
              {fmt(d, 'EEEEEE')}
            </span>
          ))}
        </div>
        <HoverTip tip={tip} />
      </div>
    </div>
  )
}
