import { useMemo } from 'react'
import { addDays, isToday, isTomorrow, startOfDay } from 'date-fns'
import { ArrowRight, CalendarPlus, Clock, MapPin } from 'lucide-react'
import { expandAll } from '@shared/recurrence'
import { useCalendarMap, useStore, useVisibleEvents } from '../store'
import { calVar } from '../lib/theme'
import { fmt, formatCountdown, greeting, toLocalTime } from '../lib/dates'
import { useNow } from '../components/calendar/TimeGrid'
import { WeekLoad } from '../components/widgets/WeekLoad'
import { YearHeatmap } from '../components/widgets/YearHeatmap'
import { bookedMinutes, fmtHours } from '../components/widgets/metrics'
import { DeadlineRadar } from '../components/widgets/DeadlineRadar'
import { CategoryBars, FocusTodos, TodoStats } from '../components/widgets/TodoWidgets'

export function TodayPage(): React.JSX.Element {
  const events = useVisibleEvents()
  const calendars = useCalendarMap()
  const selectEvent = useStore((s) => s.selectEvent)
  const openAdd = useStore((s) => s.openAdd)
  const setCursor = useStore((s) => s.setCursor)
  const openEdit = (id: string, occ?: string): void => {
    setPage('plan')
    if (occ) setCursor(new Date(occ))
    selectEvent(id, occ)
  }
  const setPage = useStore((s) => s.setPage)
  const now = useNow()

  const { today, next, booked } = useMemo(() => {
    const d0 = startOfDay(now)
    const today = expandAll(events, d0, addDays(d0, 1))
    const upcoming = expandAll(events, now, addDays(d0, 30)).filter((o) => o.start > now && !o.event.allDay)
    return { today, next: upcoming[0] ?? null, booked: bookedMinutes(d0, today) }
  }, [events, now])

  const allDay = today.filter((o) => o.event.allDay)
  const timed = today.filter((o) => !o.event.allDay)
  const nowIdx = timed.findIndex((o) => o.end > now)

  return (
    <div className="today-page">
      <header className="today-hero">
        <div>
          <p className="kicker">{fmt(now, 'EEEE, d. MMMM yyyy')}</p>
          <h1>{greeting(now)}</h1>
          <p className="hero-sub">
            {today.length === 0
              ? 'Heute ist nichts eingetragen.'
              : `${today.length} ${today.length === 1 ? 'Termin' : 'Termine'} heute · ${fmtHours(booked)} verplant`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openAdd()}>
          <CalendarPlus size={16} /> Neu <kbd>N</kbd>
        </button>
      </header>

      <TodoStats />

      <div className="today-grid">
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
                      style={
                        { '--c': calVar(calendars.get(o.event.calendarId)?.color ?? 'red') } as React.CSSProperties
                      }
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

        <div className="today-side">
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

          <WeekLoad />
        </div>

        <FocusTodos />
        <CategoryBars />

        <div className="today-wide">
          <DeadlineRadar />
        </div>

        <div className="today-wide">
          <YearHeatmap />
        </div>
      </div>
    </div>
  )
}
