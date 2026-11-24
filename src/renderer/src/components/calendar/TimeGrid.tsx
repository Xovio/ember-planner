import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMinutes, isSameDay, isToday } from 'date-fns'
import { Repeat, Bell, SquareCheck } from 'lucide-react'
import { expandAll, type Occurrence } from '@shared/recurrence'
import { useCalendarMap, useHolidays, useStore, useVisibleEvents, type Anchor } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, minutesSinceMidnight, snap, toLocalTime } from '../../lib/dates'
import { layoutDay, type Segment } from './layout'
import { localDate } from '@shared/todo'
import { TODO_MIME, todoDrag } from '../../lib/dnd'
import { DEADLINE_MIME, DeadlineChip } from '../todos/TodoItem'
import { eventMenu } from '../../lib/menus'
import type { Todo } from '@shared/types'

const HOUR_H = 52
const SNAP = 15
const HOURS = Array.from({ length: 24 }, (_, i) => i)

type Drag =
  | { kind: 'create'; dayIdx: number; startMin: number; curMin: number }
  | { kind: 'move'; occ: Occurrence; el: HTMLElement; originDay: number; originMin: number; dayDelta: number; minDelta: number }
  | { kind: 'resize'; occ: Occurrence; el: HTMLElement; originMin: number; minDelta: number }
  | { kind: 'click'; occ: Occurrence; el: HTMLElement }

/** single click -> preview, double click -> details */
let lastClick: { key: string; at: number } | null = null
export function clickOccurrence(eventId: string, occurrenceStart: string, el: HTMLElement): void {
  const st = useStore.getState()
  const key = `${eventId}::${occurrenceStart}`
  const now = Date.now()
  if (lastClick && lastClick.key === key && now - lastClick.at < 380) {
    lastClick = null
    st.selectEvent(eventId, occurrenceStart)
    return
  }
  lastClick = { key, at: now }
  const r = el.getBoundingClientRect()
  st.setPreview({ eventId, occurrenceStart, anchor: { x: r.left, y: r.top, w: r.width, h: r.height } })
}

/** dropping a ToDo or deadline marker onto a whole day */
export function dropOnDay(e: React.DragEvent, day: Date): boolean {
  const st = useStore.getState()
  const k = localDate(day)
  const dl = e.dataTransfer.getData(DEADLINE_MIME)
  if (dl) {
    const [id, kind] = dl.split('|')
    st.updateTodos([id], kind === 'hard' ? { hardDeadline: k } : { softDeadline: k }, `${kind === 'hard' ? 'Deadline' : 'Wunschtag'} verschoben`)
    return true
  }
  const id = e.dataTransfer.getData(TODO_MIME)
  if (id) {
    const ids = st.picked.includes(id) ? st.picked : [id]
    st.updateTodos(ids, { softDeadline: k }, `Wunschtag ${fmt(day, 'EEE d. MMM')}`)
    return true
  }
  return false
}

export const acceptsDayDrop = (e: React.DragEvent): boolean =>
  e.dataTransfer.types.includes(TODO_MIME) || e.dataTransfer.types.includes(DEADLINE_MIME)

export function TimeGrid({ days }: { days: Date[] }): React.JSX.Element {
  const events = useVisibleEvents()
  const calendars = useCalendarMap()
  const holiday = useHolidays()
  const settings = useStore((s) => s.data!.settings)
  const setQuickCreate = useStore((s) => s.setQuickCreate)
  const quickCreate = useStore((s) => s.quickCreate)
  const selection = useStore((s) => s.selection)
  const selectEvent = useStore((s) => s.selectEvent)
  const openMenu = useStore((s) => s.openMenu)
  const moveEvent = useStore((s) => s.moveEvent)
  const moveOccurrence = useStore((s) => s.moveOccurrence)
  const scheduleTodo = useStore((s) => s.scheduleTodo)
  const todos = useStore((s) => s.data!.todos)
  const setCursor = useStore((s) => s.setCursor)
  const setView = useStore((s) => s.setView)

  const scrollRef = useRef<HTMLDivElement>(null)
  const colsRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [drop, setDrop] = useState<{ dayIdx: number; startMin: number; dur: number; title: string } | null>(null)
  const [dayDrop, setDayDrop] = useState<number | null>(null)
  const now = useNow()

  const rangeStart = days[0]
  const rangeEnd = addDays(days[days.length - 1], 1)
  const occs = useMemo(
    () => expandAll(events, rangeStart, rangeEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, rangeStart.getTime(), rangeEnd.getTime()]
  )
  const allDay = occs.filter((o) => o.event.allDay)
  const timed = occs.filter((o) => !o.event.allDay)

  // apply the live drag preview to the dragged occurrence
  const effective = useMemo(() => {
    if (!drag || (drag.kind !== 'move' && drag.kind !== 'resize')) return timed
    return timed.map((o) => {
      if (o.key !== drag.occ.key) return o
      if (drag.kind === 'move') {
        const start = addMinutes(addDays(o.start, drag.dayDelta), drag.minDelta)
        return { ...o, start, end: new Date(start.getTime() + (o.end.getTime() - o.start.getTime())) }
      }
      const end = addMinutes(o.end, drag.minDelta)
      return { ...o, end: end.getTime() - o.start.getTime() < SNAP * 60000 ? addMinutes(o.start, SNAP) : end }
    })
  }, [timed, drag])

  const perDay = useMemo(() => days.map((d) => layoutDay(d, effective)), [days, effective])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, settings.dayStartHour * HOUR_H - 8)
    // only on mount / when the number of columns changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length])

  const pointToCell = (clientX: number, clientY: number): { dayIdx: number; min: number } => {
    const rect = colsRef.current!.getBoundingClientRect()
    const colW = rect.width / days.length
    const dayIdx = Math.min(days.length - 1, Math.max(0, Math.floor((clientX - rect.left) / colW)))
    const min = Math.min(1440, Math.max(0, ((clientY - rect.top) / HOUR_H) * 60))
    return { dayIdx, min }
  }

  const onGridDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const { dayIdx, min } = pointToCell(e.clientX, e.clientY)
    const startMin = Math.floor(min / SNAP) * SNAP
    colsRef.current!.setPointerCapture(e.pointerId)
    setDrag({ kind: 'create', dayIdx, startMin, curMin: startMin + SNAP })
  }

  const onEventDown = (e: React.PointerEvent, seg: Segment, resize = false): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    colsRef.current!.setPointerCapture(e.pointerId)
    const { dayIdx, min } = pointToCell(e.clientX, e.clientY)
    // the original (un-previewed) occurrence
    const occ = timed.find((o) => o.key === seg.occ.key) ?? seg.occ
    const el = (e.currentTarget as HTMLElement).closest('.event-block') as HTMLElement
    if (resize) return setDrag({ kind: 'resize', occ, el, originMin: min, minDelta: 0 })
    setDrag({ kind: 'move', occ, el, originDay: dayIdx, originMin: min, dayDelta: 0, minDelta: 0 })
  }

  const onMove = (e: React.PointerEvent): void => {
    if (!drag || drag.kind === 'click') return
    const { dayIdx, min } = pointToCell(e.clientX, e.clientY)
    if (drag.kind === 'create') {
      const cur = Math.ceil(min / SNAP) * SNAP
      setDrag({ ...drag, curMin: cur <= drag.startMin ? Math.floor(min / SNAP) * SNAP : cur })
    } else if (drag.kind === 'move') {
      setDrag({ ...drag, dayDelta: dayIdx - drag.originDay, minDelta: snap(min - drag.originMin, SNAP) })
    } else {
      setDrag({ ...drag, minDelta: snap(min - drag.originMin, SNAP) })
    }
  }

  const onUp = (): void => {
    const d = drag
    setDrag(null)
    if (!d) return
    if (d.kind === 'create') {
      const day = days[d.dayIdx]
      let s = Math.min(d.startMin, d.curMin)
      let en = Math.max(d.startMin, d.curMin)
      if (en - s <= SNAP) {
        s = d.startMin
        en = Math.min(1440, s + settings.defaultDurationMin)
      }
      const rect = colsRef.current!.getBoundingClientRect()
      const colW = rect.width / days.length
      const anchor: Anchor = { x: rect.left + colW * d.dayIdx, y: rect.top + (s / 60) * HOUR_H, w: colW, h: ((en - s) / 60) * HOUR_H }
      setQuickCreate({ start: addMinutes(day, s).toISOString(), end: addMinutes(day, en).toISOString(), allDay: false, anchor })
      return
    }
    const click = (): void => clickOccurrence(d.occ.event.id, d.occ.start.toISOString(), d.el)
    if (d.kind === 'click') return click()
    // dragging one occurrence of a series changes only this one
    const move = (start: Date, end: Date): void =>
      d.occ.event.recurrence
        ? moveOccurrence(d.occ.event.id, d.occ.start.toISOString(), start, end)
        : moveEvent(d.occ.event.id, start, end)
    if (d.kind === 'move') {
      if (d.dayDelta === 0 && d.minDelta === 0) return click()
      const start = addMinutes(addDays(d.occ.start, d.dayDelta), d.minDelta)
      move(start, new Date(start.getTime() + (d.occ.end.getTime() - d.occ.start.getTime())))
      return
    }
    if (d.minDelta === 0) return click()
    const end = addMinutes(d.occ.end, d.minDelta)
    move(d.occ.start, end > d.occ.start ? end : addMinutes(d.occ.start, SNAP))
  }

  const todoById = useMemo(() => new Map(todos.map((t) => [t.id, t])), [todos])
  const deadlinesOn = (d: Date): { todo: Todo; kind: 'hard' | 'soft' }[] => {
    const k = localDate(d)
    const out: { todo: Todo; kind: 'hard' | 'soft' }[] = []
    for (const t of todos) {
      if (t.done) continue
      if (t.hardDeadline === k) out.push({ todo: t, kind: 'hard' })
      else if (t.softDeadline === k) out.push({ todo: t, kind: 'soft' })
    }
    return out
  }

  const onDragOver = (e: React.DragEvent): void => {
    if (e.dataTransfer.types.includes(DEADLINE_MIME)) {
      e.preventDefault()
      setDayDrop(pointToCell(e.clientX, e.clientY).dayIdx)
      return
    }
    if (!e.dataTransfer.types.includes(TODO_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    const t = todoDrag.id ? todoById.get(todoDrag.id) : undefined
    const dur = t?.estimateMin ?? settings.defaultDurationMin
    const { dayIdx, min } = pointToCell(e.clientX, e.clientY)
    const startMin = Math.min(1440 - SNAP, Math.floor(min / SNAP) * SNAP)
    if (!drop || drop.dayIdx !== dayIdx || drop.startMin !== startMin) {
      setDrop({ dayIdx, startMin, dur, title: t?.title ?? 'ToDo' })
    }
  }

  const onDrop = (e: React.DragEvent): void => {
    setDayDrop(null)
    if (e.dataTransfer.types.includes(DEADLINE_MIME)) {
      e.preventDefault()
      dropOnDay(e, days[pointToCell(e.clientX, e.clientY).dayIdx])
      return
    }
    const id = e.dataTransfer.getData(TODO_MIME)
    const target = drop
    setDrop(null)
    if (!id || !target) return
    e.preventDefault()
    const start = addMinutes(days[target.dayIdx], target.startMin)
    scheduleTodo(id, start, addMinutes(start, Math.min(target.dur, 1440 - target.startMin)))
  }

  const qcStart = quickCreate && !quickCreate.allDay ? new Date(quickCreate.start) : null
  const qcEnd = quickCreate ? new Date(quickCreate.end) : null
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`
  const nowMin = minutesSinceMidnight(now)

  return (
    <div className={`timegrid ${drag && drag.kind !== 'click' ? 'is-dragging' : ''}`}>
      <div className="tg-head" style={{ gridTemplateColumns: cols }}>
        <div className="tg-gutter-head">{fmt(days[0], "'KW' I")}</div>
        {days.map((d) => (
          <button
            key={d.toISOString()}
            className={`tg-dayhead ${isToday(d) ? 'today' : ''} ${holiday(d) ? 'holiday' : ''}`}
            onClick={() => {
              setCursor(d)
              setView('day')
            }}
            title={holiday(d) ? `Feiertag: ${holiday(d)} – Tagesansicht öffnen` : 'Tagesansicht öffnen'}
          >
            <span className="tg-dow">{fmt(d, 'EEE')}</span>
            <span className="tg-dnum">{fmt(d, 'd')}</span>
            {holiday(d) && <span className="tg-holiday">{holiday(d)}</span>}
          </button>
        ))}
      </div>

      <div className="tg-allday" style={{ gridTemplateColumns: cols }}>
        <div className="tg-gutter-label">ganztägig</div>
        {days.map((d) => {
          const list = allDay.filter((o) => o.start < addDays(d, 1) && o.end > d)
          return (
            <div
              key={d.toISOString()}
              className={`tg-allday-cell ${dayDrop === -1 - days.indexOf(d) ? 'drop' : ''}`}
              onDoubleClick={(e) => {
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
                setDayDrop(-1 - days.indexOf(d))
              }}
              onDragLeave={() => setDayDrop(null)}
              onDrop={(e) => {
                setDayDrop(null)
                if (dropOnDay(e, d)) e.preventDefault()
              }}
              title="Doppelklick: ganztägiger Termin · ToDo hierher ziehen: Wunschtag"
            >
              {deadlinesOn(d).map(({ todo, kind }) => (
                <DeadlineChip key={todo.id + kind} todo={todo} kind={kind} />
              ))}
              {list.map((o) => {
                const cal = calendars.get(o.event.calendarId)
                return (
                  <button
                    key={o.key}
                    className={`chip chip-allday ${selection?.kind === 'event' && selection.id === o.event.id ? 'selected' : ''}`}
                    style={{ '--c': calVar(cal?.color ?? 'red') } as React.CSSProperties}
                    onClick={(e) => clickOccurrence(o.event.id, o.start.toISOString(), e.currentTarget)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      selectEvent(o.event.id, o.start.toISOString())
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      openMenu(e.clientX, e.clientY, eventMenu(o.event.id, o.start.toISOString()))
                    }}
                  >
                    {o.event.title || '(Ohne Titel)'}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="tg-scroll" ref={scrollRef}>
        <div className="tg-body" style={{ gridTemplateColumns: '56px minmax(0, 1fr)', height: HOUR_H * 24 }}>
          <div className="tg-gutter">
            {HOURS.map((h) => (
              <div key={h} className="tg-hour-label" style={{ top: h * HOUR_H }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          <div
            className="tg-cols"
            ref={colsRef}
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
            onPointerDown={onGridDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            onDragOver={onDragOver}
            onDragLeave={(e) => {
              if (!colsRef.current?.contains(e.relatedTarget as Node)) {
                setDrop(null)
                setDayDrop(null)
              }
            }}
            onDrop={onDrop}
          >
            {days.map((d, i) => (
              <div key={d.toISOString()} className={`tg-col ${isToday(d) ? 'today' : ''} ${dayDrop === i ? 'drop' : ''}`}>
                {HOURS.map((h) => (
                  <div key={h} className="tg-slot" style={{ top: h * HOUR_H, height: HOUR_H }} />
                ))}

                {perDay[i].map((seg) => (
                  <EventBlock
                    key={seg.occ.key + i}
                    seg={seg}
                    color={calVar(calendars.get(seg.occ.event.calendarId)?.color ?? 'red')}
                    todoDone={seg.occ.event.todoId ? todoById.get(seg.occ.event.todoId)?.done : undefined}
                    dragging={
                      !!drag &&
                      (drag.kind === 'move' || drag.kind === 'resize') &&
                      drag.occ.key === seg.occ.key
                    }
                    selected={selection?.kind === 'event' && selection.id === seg.occ.event.id}
                    onDown={(e, resize) => onEventDown(e, seg, resize)}
                    onMenu={(e) => {
                      e.preventDefault()
                      openMenu(e.clientX, e.clientY, eventMenu(seg.occ.event.id, seg.occ.start.toISOString()))
                    }}
                  />
                ))}

                {drag?.kind === 'create' && drag.dayIdx === i && (
                  <CreatePreview day={d} a={drag.startMin} b={drag.curMin} />
                )}

                {qcStart && qcEnd && isSameDay(qcStart, d) && (
                  <CreatePreview
                    day={d}
                    a={minutesSinceMidnight(qcStart)}
                    b={Math.min(1440, minutesSinceMidnight(qcStart) + (qcEnd.getTime() - qcStart.getTime()) / 60000)}
                  />
                )}

                {drop && drop.dayIdx === i && (
                  <CreatePreview
                    day={d}
                    a={drop.startMin}
                    b={Math.min(1440, drop.startMin + drop.dur)}
                    label={drop.title}
                  />
                )}

                {isSameDay(d, now) && (
                  <div className="tg-now" style={{ top: (nowMin / 60) * HOUR_H }}>
                    <span className="tg-now-dot" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function EventBlock({
  seg,
  color,
  todoDone,
  dragging,
  selected,
  onDown,
  onMenu
}: {
  seg: Segment
  color: string
  /** undefined = not a ToDo time block */
  todoDone?: boolean
  dragging: boolean
  selected: boolean
  onDown: (e: React.PointerEvent, resize?: boolean) => void
  onMenu: (e: React.MouseEvent) => void
}): React.JSX.Element {
  const { occ } = seg
  const top = (seg.startMin / 60) * HOUR_H
  const height = Math.max(18, ((seg.endMin - seg.startMin) / 60) * HOUR_H - 2)
  const widthPct = 100 / seg.cols
  const compact = height < 38
  const ev = occ.event
  const timeLabel = `${toLocalTime(occ.start)} – ${toLocalTime(occ.end)}`
  return (
    <div
      className={`event-block ${compact ? 'compact' : ''} ${dragging ? 'dragging' : ''} ${ev.recurrence ? 'recurring' : ''} ${
        todoDone !== undefined ? 'todo-block' : ''
      } ${todoDone ? 'todo-done' : ''} ${selected ? 'selected' : ''}`}
      style={
        {
          top,
          height,
          left: `calc(${seg.col * widthPct}% + 2px)`,
          width: `calc(${widthPct}% - 4px)`,
          '--c': color
        } as React.CSSProperties
      }
      onPointerDown={(e) => onDown(e)}
      onContextMenu={onMenu}
      title={`${ev.title || '(Ohne Titel)'}\n${timeLabel}${ev.location ? `\n${ev.location}` : ''}`}
    >
      <div className="eb-title">
        {todoDone !== undefined && <SquareCheck size={12} className="eb-todo-icon" />}
        {ev.title || '(Ohne Titel)'}
        {compact && <span className="eb-time-inline">{toLocalTime(occ.start)}</span>}
      </div>
      {!compact && (
        <div className="eb-meta">
          {timeLabel}
          {ev.recurrence && <Repeat size={11} />}
          {ev.reminders.length > 0 && <Bell size={11} />}
        </div>
      )}
      {!compact && ev.location && height > 64 && <div className="eb-loc">{ev.location}</div>}
      {!seg.clippedEnd && (
        <div className="eb-resize" onPointerDown={(e) => onDown(e, true)} />
      )}
    </div>
  )
}

function CreatePreview({ day, a, b, label }: { day: Date; a: number; b: number; label?: string }): React.JSX.Element {
  const s = Math.min(a, b)
  const e = Math.max(a, b)
  return (
    <div className="create-preview" style={{ top: (s / 60) * HOUR_H, height: ((e - s) / 60) * HOUR_H }}>
      {label && <div className="create-preview-label">{label}</div>}
      {toLocalTime(addMinutes(day, s))} – {toLocalTime(addMinutes(day, e))}
    </div>
  )
}

export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
