import { useMemo } from 'react'
import { addDays, isToday, isTomorrow, startOfDay } from 'date-fns'
import { MapPin, Repeat, Bell, CalendarPlus } from 'lucide-react'
import { expandAll, type Occurrence } from '@shared/recurrence'
import { DiscordBadge, placeholderClass } from '../discord/DiscordBadge'
import { useCalendarEvents, useCalendarMap, useHolidays, useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, toLocalTime } from '../../lib/dates'
import { clickOccurrence } from './TimeGrid'
import { eventMenu } from '../../lib/menus'

const DAYS = 42

export function AgendaList(): React.JSX.Element {
  const cursor = useStore((s) => s.cursor)
  const events = useCalendarEvents()
  const calendars = useCalendarMap()
  const holiday = useHolidays()
  const openAdd = useStore((s) => s.openAdd)
  const selectEvent = useStore((s) => s.selectEvent)
  const openMenu = useStore((s) => s.openMenu)

  const groups = useMemo(() => {
    const start = startOfDay(cursor)
    const occs = expandAll(events, start, addDays(start, DAYS))
    const map = new Map<string, { day: Date; items: Occurrence[] }>()
    for (const o of occs) {
      // multi-day events are listed on each day they cover within range
      for (let d = startOfDay(o.start < start ? start : o.start); d < o.end && d < addDays(start, DAYS); d = addDays(d, 1)) {
        const k = d.toISOString()
        if (!map.has(k)) map.set(k, { day: d, items: [] })
        map.get(k)!.items.push(o)
        if (!o.event.allDay) break
      }
    }
    // holidays get their own day even without events
    for (let d = start; d < addDays(start, DAYS); d = addDays(d, 1)) {
      if (holiday(d) && !map.has(d.toISOString())) map.set(d.toISOString(), { day: d, items: [] })
    }
    return [...map.values()].sort((a, b) => a.day.getTime() - b.day.getTime())
  }, [cursor, events, holiday])

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <CalendarPlus size={36} strokeWidth={1.4} />
        <h3>Nichts geplant</h3>
        <p>In den nächsten sechs Wochen stehen keine Termine an.</p>
        <button className="btn btn-primary" onClick={() => openAdd('event')}>
          Termin anlegen
        </button>
      </div>
    )
  }

  return (
    <div className="agenda">
      {groups.map(({ day, items }) => (
        <section key={day.toISOString()} className={`agenda-day ${isToday(day) ? 'today' : ''}`}>
          <div className="agenda-date">
            <span className="agenda-dnum">{fmt(day, 'd')}</span>
            <span className="agenda-dlabel">
              <strong>{isToday(day) ? 'Heute' : isTomorrow(day) ? 'Morgen' : fmt(day, 'EEEE')}</strong>
              <span>{fmt(day, 'MMMM yyyy')}</span>
              {holiday(day) && <span className="holiday-label">{holiday(day)}</span>}
            </span>
          </div>
          <div className="agenda-items">
            {items.map((o) => {
              const cal = calendars.get(o.event.calendarId)
              return (
                <button
                  key={o.key + day.toISOString()}
                  className={`agenda-item ${placeholderClass(o.event)}`}
                  style={{ '--c': calVar(cal?.color ?? 'red') } as React.CSSProperties}
                  onClick={(e) => clickOccurrence(o.event.id, o.start.toISOString(), e.currentTarget)}
                  onDoubleClick={() => selectEvent(o.event.id, o.start.toISOString())}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    openMenu(e.clientX, e.clientY, eventMenu(o.event.id, o.start.toISOString()))
                  }}
                >
                  <span className="agenda-time">
                    {o.event.allDay ? 'ganztägig' : `${toLocalTime(o.start)} – ${toLocalTime(o.end)}`}
                  </span>
                  <span className="agenda-bar" />
                  <span className="agenda-main">
                    <span className={`agenda-title ${o.event.discord?.status === 4 ? 'dc-cancelled-text' : ''}`}>
                      {o.event.title || '(Ohne Titel)'} <DiscordBadge ev={o.event} />
                    </span>
                    <span className="agenda-sub">
                      {cal?.name}
                      {o.event.location && (
                        <>
                          <MapPin size={12} /> {o.event.location}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="agenda-icons">
                    {o.event.recurrence && <Repeat size={14} />}
                    {o.event.reminders.length > 0 && <Bell size={14} />}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
