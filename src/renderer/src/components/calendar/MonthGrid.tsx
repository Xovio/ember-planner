import { useMemo, useState } from 'react'
import { addDays, isSameMonth, isToday } from 'date-fns'
import { expandAll } from '@shared/recurrence'
import { useCalendarMap, useStore, useVisibleEvents } from '../../store'
import { calVar } from '../../lib/theme'
import { WEEKDAY_SHORT, fmt, monthGridRange, toLocalDate, toLocalTime } from '../../lib/dates'
import { DeadlineChip } from '../todos/TodoItem'
import { acceptsDayDrop, clickOccurrence, dropOnDay } from './TimeGrid'
import { eventMenu } from '../../lib/menus'
import type { Todo } from '@shared/types'

const MAX_CHIPS = 3

export function MonthGrid(): React.JSX.Element {
  const cursor = useStore((s) => s.cursor)
  const events = useVisibleEvents()
  const calendars = useCalendarMap()
  const setQuickCreate = useStore((s) => s.setQuickCreate)
  const selectEvent = useStore((s) => s.selectEvent)
  const openMenu = useStore((s) => s.openMenu)
  const selection = useStore((s) => s.selection)
  const [dropDay, setDropDay] = useState<string | null>(null)
  const setCursor = useStore((s) => s.setCursor)
  const setView = useStore((s) => s.setView)

  const { days, start, end } = useMemo(() => monthGridRange(cursor), [cursor])
  const occs = useMemo(() => expandAll(events, start, end), [events, start, end])
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
        {days.map((d) => {
          const next = addDays(d, 1)
          const list = occs
            .filter((o) => o.start < next && o.end > d)
            .sort((a, b) => Number(b.event.allDay) - Number(a.event.allDay) || a.start.getTime() - b.start.getTime())
          const dls = deadlines.get(toLocalDate(d)) ?? []
          const shownDl = dls.slice(0, 2)
          const budget = Math.max(1, MAX_CHIPS + 1 - shownDl.length)
          const extra = list.length + dls.length - shownDl.length - budget
          return (
            <div
              key={d.toISOString()}
              className={`month-cell ${isSameMonth(d, cursor) ? '' : 'outside'} ${isToday(d) ? 'today' : ''} ${
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
              <button className="month-daynum" onClick={() => goDay(d)} title="Tagesansicht öffnen">
                {d.getDate() === 1 ? fmt(d, 'd. MMM') : d.getDate()}
              </button>
              <div className="month-chips">
                {shownDl.map(({ todo, kind }) => (
                  <DeadlineChip key={todo.id + kind} todo={todo} kind={kind} />
                ))}
                {list.slice(0, extra > 0 ? budget - 1 : budget).map((o) => {
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
                    + {extra + 1} weitere
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
