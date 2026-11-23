import { useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, isSameDay, isSameMonth, isToday, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { expandAll } from '@shared/recurrence'
import { useHolidays, useStore, useVisibleEvents } from '../../store'
import { WEEK, WEEKDAY_SHORT, fmt, monthGridRange, toLocalDate } from '../../lib/dates'

export function MiniMonth(): React.JSX.Element {
  const cursor = useStore((s) => s.cursor)
  const view = useStore((s) => s.view)
  const setCursor = useStore((s) => s.setCursor)
  const events = useVisibleEvents()
  const holiday = useHolidays()
  const [month, setMonth] = useState(cursor)

  useEffect(() => setMonth(cursor), [cursor])

  const { days, start, end } = useMemo(() => monthGridRange(month), [month])
  const busy = useMemo(() => {
    const set = new Set<string>()
    for (const o of expandAll(events, start, end)) {
      for (let d = new Date(o.start); d < o.end; d = addDays(d, 1)) {
        set.add(toLocalDate(d))
        if (!o.event.allDay) break
      }
    }
    return set
  }, [events, start, end])

  const selWeek = { start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) }

  return (
    <div className="mini">
      <div className="mini-head">
        <span>{fmt(month, 'MMMM yyyy')}</span>
        <div>
          <button className="icon-btn sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Vorheriger Monat">
            <ChevronLeft size={16} />
          </button>
          <button className="icon-btn sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Nächster Monat">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="mini-grid">
        {WEEKDAY_SHORT.map((w) => (
          <span key={w} className="mini-dow">
            {w.slice(0, 2)}
          </span>
        ))}
        {days.map((d) => {
          const inWeek = view === 'week' && isWithinInterval(d, selWeek)
          const selected = view !== 'week' && isSameDay(d, cursor)
          return (
            <button
              key={d.toISOString()}
              className={[
                'mini-day',
                isSameMonth(d, month) ? '' : 'outside',
                isToday(d) ? 'today' : '',
                inWeek ? 'in-week' : '',
                selected ? 'selected' : '',
                holiday(d) ? 'holiday' : ''
              ].join(' ')}
              title={holiday(d)}
              onClick={() => setCursor(d)}
            >
              {d.getDate()}
              {busy.has(toLocalDate(d)) && <i className="mini-dot" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
