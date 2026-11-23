import { useMemo } from 'react'
import { addDays, isToday, isTomorrow, startOfDay } from 'date-fns'
import { AlertTriangle, Clock, PartyPopper } from 'lucide-react'
import { expandAll } from '@shared/recurrence'
import { deadlineStatus, localDate } from '@shared/todo'
import { anchorOf, useCalendarMap, useStore, useVisibleEvents } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, formatCountdown, greeting, toLocalTime } from '../../lib/dates'
import { useOpenTodos } from '../../lib/todos'
import { useNow } from '../calendar/TimeGrid'
import { TodoItem } from '../todos/TodoItem'
import { bookedMinutes, fmtHours } from '../widgets/metrics'

/** "Heute" tab: what's next, today's timeline and the ToDos that need attention. */
export function TodayTab(): React.JSX.Element {
  const events = useVisibleEvents()
  const calendars = useCalendarMap()
  const setPreview = useStore((s) => s.setPreview)
  const todos = useOpenTodos()
  const now = useNow()

  const { today, next, booked } = useMemo(() => {
    const d0 = startOfDay(now)
    const today = expandAll(events, d0, addDays(d0, 1))
    const upcoming = expandAll(events, now, addDays(d0, 30)).filter((o) => o.start > now && !o.event.allDay)
    return { today, next: upcoming[0] ?? null, booked: bookedMinutes(d0, today) }
  }, [events, now])

  const soon = localDate(addDays(now, 2))
  const focus = todos.filter((t) => {
    const st = deadlineStatus(t)
    if (st === 'overdue' || st === 'soft-missed' || st === 'today') return true
    return (t.hardDeadline && t.hardDeadline <= soon) || (t.softDeadline && t.softDeadline <= soon)
  })
  const overdue = focus.filter((t) => deadlineStatus(t) === 'overdue').length

  return (
    <div className="today-tab">
      <div className="tt-hero">
        <p className="kicker">{fmt(now, 'EEEE, d. MMMM')}</p>
        <h2>{greeting(now)}</h2>
        <p className="muted">
          {today.length} {today.length === 1 ? 'Termin' : 'Termine'} · {fmtHours(booked)} verplant · {todos.length} ToDos offen
        </p>
      </div>

      {next && (
        <button
          className="nextup-body tt-next"
          style={{ '--c': calVar(calendars.get(next.event.calendarId)?.color ?? 'red') } as React.CSSProperties}
          onClick={(e) => setPreview({ eventId: next.event.id, occurrenceStart: next.start.toISOString(), anchor: anchorOf(e.currentTarget) })}
        >
          <span className="nextup-count">
            <Clock size={12} /> {formatCountdown(next.start.getTime() - now.getTime())}
          </span>
          <strong>{next.event.title || '(Ohne Titel)'}</strong>
          <span className="nextup-meta">
            {isToday(next.start) ? 'Heute' : isTomorrow(next.start) ? 'Morgen' : fmt(next.start, 'EEE, d. MMM')}, {toLocalTime(next.start)} – {toLocalTime(next.end)}
          </span>
        </button>
      )}

      <section>
        <h4 className="section-head">
          <span>Tagesplan</span>
        </h4>
        {today.length === 0 ? (
          <p className="empty-mini">Heute ist nichts eingetragen.</p>
        ) : (
          <ol className="timeline compact">
            {today.map((o) => {
              const past = o.end <= now
              const live = o.start <= now && o.end > now
              return (
                <li key={o.key} className={`${past ? 'past' : ''} ${live ? 'live' : ''}`}>
                  <button
                    className="timeline-item"
                    style={{ '--c': calVar(calendars.get(o.event.calendarId)?.color ?? 'red') } as React.CSSProperties}
                    onClick={(e) => setPreview({ eventId: o.event.id, occurrenceStart: o.start.toISOString(), anchor: anchorOf(e.currentTarget) })}
                  >
                    <span className="tl-time">{o.event.allDay ? 'ganzt.' : toLocalTime(o.start)}</span>
                    <span className="tl-dot" />
                    <span className="tl-main">
                      <strong>{o.event.title || '(Ohne Titel)'}</strong>
                      {live && <span>Läuft gerade</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section>
        <h4 className="section-head">
          <span>Fokus</span>
          {overdue > 0 && (
            <span className="status-pill crit">
              <AlertTriangle size={11} /> {overdue} überfällig
            </span>
          )}
        </h4>
        {focus.length === 0 ? (
          <p className="empty-mini with-icon">
            <PartyPopper size={15} /> Nichts Dringendes.
          </p>
        ) : (
          <div className="todo-list">
            {focus.map((t) => (
              <TodoItem key={t.id} todo={t} compact draggable />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
