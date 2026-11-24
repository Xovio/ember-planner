import { useMemo, useState } from 'react'
import { addDays, isSameMonth, isToday } from 'date-fns'
import { expandAll } from '@shared/recurrence'
import { useCalendarMap, useHolidays, useStore, useVisibleEvents } from '../../store'
import { calVar } from '../../lib/theme'
import { WEEKDAY_SHORT, fmt, monthGridRange, toLocalDate, toLocalTime } from '../../lib/dates'
import { DeadlineChip } from '../todos/TodoItem'
import { acceptsDayDrop, clickOccurrence, dropOnDay } from './TimeGrid'
import { eventMenu } from '../../lib/menus'
import { isMultiDay, layoutSpans } from './layout'
import { SpanLanes } from './SpanLanes'
import type { Todo } from '@shared/types'

const MAX_CHIPS = 3

export function MonthGrid(): React.JSX.Element {
  const cursor = useStore((s) => s.cursor)
  const events = useVisibleEvents()
  const calendars = useCalendarMap()
  const holiday = useHolidays()
  const setQuickCreate = useStore((s) => s.setQuickCreate)
  const selectEvent = useStore((s) => s.selectEvent)
  const openMenu = useStore((s) => s.openMenu)
  const selection = useStore((s) => s.selection)
  const [dropDay, setDropDay] = useState<string | null>(null)
  const setCursor = useStore((s) => s.setCursor)
  const setView = useStore((s) => s.setView)

  const { days, start, end } = useMemo(() => monthGridRange(cursor), [cursor])
  const occs = useMemo(() => expandAll(events, start, end), [events, start, end])
  // events over several days run as bars through each week row
  const spans = useMemo(() => {
    const multi = occs.filter(isMultiDay)
    const out: ReturnType<typeof layoutSpans> = []
    for (let w = 0; w < days.length; w += 7) out.push(...layoutSpans(days.slice(w, w + 7), multi))
    return out
  }, [occs, days])
  const todos = useStore((s) => s.data!.todos)
  const deadlines = useMemo(() => {
    const map = new Map<string, { todo: Todo; kind: 'hard' | 'soft' }[]>()
    const add = (k: string, v: { todo: Todo; kind: 'hard' | 'soft' }): void => {
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(v)
    }
    for (const t of todos) {
      if (t.done) continue
      if (t.hardDeadline) add(t.hardDeadline, { todo: t, kind: 'hard' })
      if (t.softDeadline && t.softDeadline !== t.hardDeadline) add(t.softDeadline, { todo: t, kind: 'soft' })
    }
    return map
  }, [todos])

  const goDay = (d: Date): void => {
    setCursor(d)
    setView('day')
  }

  return (
    <div className="month">
      <div className="month-head">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="month-grid">
        {days.map((d, di) => {
          const next = addDays(d, 1)
          const list = occs
            .filter((o) => o.start < next && o.end > d && !isMultiDay(o))
            .sort((a, b) => Number(b.event.allDay) - Number(a.event.allDay) || a.start.getTime() - b.start.getTime())
          const dls = deadlines.get(toLocalDate(d)) ?? []
          // lines: bars first (at most MAX_CHIPS lanes), then deadlines, then the day's own events
          const lanes = spans[di]
          const shownLanes = lanes.slice(0, MAX_CHIPS)
          const hiddenBars = lanes.slice(MAX_CHIPS).filter(Boolean).length
          let room = MAX_CHIPS + 1 - shownLanes.length
          const shownDl = dls.slice(0, Math.min(2, room))
          room -= shownDl.length
          const rest = list.length + dls.length - shownDl.length + hiddenBars
          const budget = rest > room ? Math.max(0, room - 1) : room
          const extra = rest - budget
          return (
            <div
              key={d.toISOString()}
              className={`month-cell ${isSameMonth(d, cursor) ? '' : 'outside'} ${isToday(d) ? 'today' : ''} ${holiday(d) ? 'holiday' : ''} ${
                dropDay === toLocalDate(d) ? 'drop' : ''
              }`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return
                const r = e.currentTarget.getBoundingClientRect()
                setQuickCreate({
                  allDay: true,
                  start: d.toISOString(),
                  end: addDays(d, 1).toISOString(),
                  anchor: { x: r.left, y: r.top, w: r.width, h: r.height }
                })
              }}
              onDragOver={(e) => {
                if (!acceptsDayDrop(e)) return
                e.preventDefault()
                setDropDay(toLocalDate(d))
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropDay(null)
              }}
              onDrop={(e) => {
                setDropDay(null)
                if (dropOnDay(e, d)) e.preventDefault()
              }}
            >
              <div className="month-dayhead">
                <button className="month-daynum" onClick={() => goDay(d)} title="Tagesansicht öffnen">
                  {d.getDate() === 1 ? fmt(d, 'd. MMM') : d.getDate()}
                </button>
                {holiday(d) && (
                  <span className="holiday-label" title={`Feiertag: ${holiday(d)}`}>
                    {holiday(d)}
                  </span>
                )}
              </div>
              <div className="month-chips">
                <SpanLanes pieces={shownLanes} calendars={calendars} />
                {shownDl.map(({ todo, kind }) => (
                  <DeadlineChip key={todo.id + kind} todo={todo} kind={kind} />
                ))}
                {list.slice(0, budget).map((o) => {
                  const color = calVar(calendars.get(o.event.calendarId)?.color ?? 'red')
                  return (
                    <button
                      key={o.key}
                      className={`chip ${o.event.allDay ? 'chip-allday' : 'chip-timed'} ${
                        selection?.kind === 'event' && selection.id === o.event.id ? 'selected' : ''
                      }`}
                      style={{ '--c': color } as React.CSSProperties}
                      onClick={(e) => clickOccurrence(o.event.id, o.start.toISOString(), e.currentTarget)}
                      onDoubleClick={() => selectEvent(o.event.id, o.start.toISOString())}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        openMenu(e.clientX, e.clientY, eventMenu(o.event.id, o.start.toISOString()))
                      }}
                      title={o.event.title}
                    >
                      {!o.event.allDay && <span className="chip-dot" />}
                      {!o.event.allDay && <span className="chip-time">{toLocalTime(o.start)}</span>}
                      <span className="chip-title">{o.event.title || '(Ohne Titel)'}</span>
                    </button>
                  )
                })}
                {extra > 0 && (
                  <button className="month-more" onClick={() => goDay(d)}>
                    + {extra} weitere
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
