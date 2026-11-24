import { useMemo } from 'react'
import { addDays, isToday, isTomorrow, startOfDay } from 'date-fns'
import { ArrowRight, Clock, MapPin } from 'lucide-react'
import { expandAll } from '@shared/recurrence'
import { useCalendarMap, useStore, useVisibleEvents } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, formatCountdown, toLocalTime } from '../../lib/dates'
import { useNow } from '../calendar/TimeGrid'

/** open an event in the calendar, at the clicked occurrence */
function useOpenEvent(): (id: string, occ?: string) => void {
  const selectEvent = useStore((s) => s.selectEvent)
  const setCursor = useStore((s) => s.setCursor)
  const setPage = useStore((s) => s.setPage)
  return (id, occ) => {
    setPage('plan')
    if (occ) setCursor(new Date(occ))
    selectEvent(id, occ)
  }
}

/** today's events as a timeline */
export function AgendaWidget(): React.JSX.Element {
  const events = useVisibleEvents()
  const calendars = useCalendarMap()
  const setPage = useStore((s) => s.setPage)
  const openEdit = useOpenEvent()
  const now = useNow()

  const today = useMemo(() => {
    const d0 = startOfDay(now)
    return expandAll(events, d0, addDays(d0, 1))
  }, [events, now])

  const allDay = today.filter((o) => o.event.allDay)
  const timed = today.filter((o) => !o.event.allDay)
  const nowIdx = timed.findIndex((o) => o.end > now)

  return (
    <section className="card agenda-card">
      <div className="widget-head">
        <div>
          <h3>Tagesplan</h3>
          <p>{fmt(now, 'EEEE')}</p>
        </div>
      </div>
      {allDay.length > 0 && (
        <div className="today-allday">
          {allDay.map((o) => (
            <button
              key={o.key}
              className="chip chip-allday"
              style={{ '--c': calVar(calendars.get(o.event.calendarId)?.color ?? 'red') } as React.CSSProperties}
              onClick={() => openEdit(o.event.id, o.start.toISOString())}
            >
              {o.event.title || '(Ohne Titel)'}
            </button>
          ))}
        </div>
      )}
      {timed.length === 0 ? (
        <div className="empty-mini">Keine Termine mit Uhrzeit.</div>
      ) : (
        <ol className="timeline">
          {timed.map((o, i) => {
            const past = o.end <= now
            const live = o.start <= now && o.end > now
            return (
              <li key={o.key} className={`${past ? 'past' : ''} ${live ? 'live' : ''}`}>
                {i === nowIdx && !live && (
                  <div className="timeline-now">
                    <span>{toLocalTime(now)}</span>
                  </div>
                )}
                <button
                  className="timeline-item"
                  style={{ '--c': calVar(calendars.get(o.event.calendarId)?.color ?? 'red') } as React.CSSProperties}
                  onClick={() => openEdit(o.event.id, o.start.toISOString())}
                >
                  <span className="tl-time">
                    {toLocalTime(o.start)}
                    <small>{toLocalTime(o.end)}</small>
                  </span>
                  <span className="tl-dot" />
                  <span className="tl-main">
                    <strong>{o.event.title || '(Ohne Titel)'}</strong>
                    <span>
                      {live ? 'Läuft gerade' : calendars.get(o.event.calendarId)?.name}
                      {o.event.location ? ` · ${o.event.location}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
      <button className="link-btn" onClick={() => setPage('plan')}>
        Zum Kalender <ArrowRight size={14} />
      </button>
    </section>
  )
}

/** countdown to the next timed event within 30 days */
export function NextUpWidget(): React.JSX.Element {
  const events = useVisibleEvents()
  const calendars = useCalendarMap()
  const openEdit = useOpenEvent()
  const now = useNow()

  const next = useMemo(() => {
    const d0 = startOfDay(now)
    return expandAll(events, now, addDays(d0, 30)).find((o) => o.start > now && !o.event.allDay) ?? null
  }, [events, now])

  return (
    <section className="card nextup">
      <div className="nextup-label">
        <Clock size={14} /> Als Nächstes
      </div>
      {next ? (
        <button
          className="nextup-body"
          style={{ '--c': calVar(calendars.get(next.event.calendarId)?.color ?? 'red') } as React.CSSProperties}
          onClick={() => openEdit(next.event.id, next.start.toISOString())}
        >
          <span className="nextup-count">{formatCountdown(next.start.getTime() - now.getTime())}</span>
          <strong>{next.event.title || '(Ohne Titel)'}</strong>
          <span className="nextup-meta">
            {isToday(next.start) ? 'Heute' : isTomorrow(next.start) ? 'Morgen' : fmt(next.start, 'EEE, d. MMM')},{' '}
            {toLocalTime(next.start)} – {toLocalTime(next.end)}
            {next.event.location && (
              <>
                <br />
                <MapPin size={12} /> {next.event.location}
              </>
            )}
          </span>
        </button>
      ) : (
        <p className="empty-mini">Keine anstehenden Termine in den nächsten 30 Tagen.</p>
      )}
    </section>
  )
}
