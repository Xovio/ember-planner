import { useState } from 'react'
import { addMinutes, differenceInMinutes } from 'date-fns'
import { AlignLeft, Bell, Copy, Lock, MapPin, Pencil, Repeat, Trash2, X } from 'lucide-react'
import { isCalendarLocked } from '@shared/google'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, formatDuration, reminderLabel, toLocalTime } from '../../lib/dates'
import { describeRecurrence } from '../details/EventDetails'
import { TodoCheck } from '../todos/TodoItem'
import { Popover } from '../ui/Popover'
import { DiscordInfo } from '../discord/DiscordInfo'
import { GoalCheck, MissedPrompt } from '../goals/Goals'

/** Read-only peek at an event with quick actions; "Bearbeiten" opens the details panel. */
export function EventPreview(): React.JSX.Element | null {
  const pv = useStore((s) => s.preview)
  const ev = useStore((s) => (pv ? s.data?.events.find((e) => e.id === pv.eventId) : undefined))
  const cal = useStore((s) => (ev ? s.data?.calendars.find((c) => c.id === ev.calendarId) : undefined))
  const todo = useStore((s) => (ev?.todoId ? s.data?.todos.find((t) => t.id === ev.todoId) : undefined))
  const setPreview = useStore((s) => s.setPreview)
  const selectEvent = useStore((s) => s.selectEvent)
  const del = useStore((s) => s.deleteEvent)
  const duplicate = useStore((s) => s.duplicateEvent)
  const [askScope, setAskScope] = useState(false)
  if (!pv || !ev) return null

  const baseStart = new Date(ev.start)
  const duration = differenceInMinutes(new Date(ev.end), baseStart)
  const start = pv.occurrenceStart ? new Date(pv.occurrenceStart) : baseStart
  const end = addMinutes(start, duration)
  const isSeries = !!ev.recurrence
  const locked = isCalendarLocked(cal)

  return (
    <Popover anchor={pv.anchor} onClose={() => setPreview(null)} width={340} label="Termin">
      <div className="pv" style={{ '--c': calVar(cal?.color ?? 'red') } as React.CSSProperties}>
        <div className="pv-toolbar">
          <button
            className="icon-btn sm"
            title={locked ? 'Details (Doppelklick)' : 'Bearbeiten (Doppelklick)'}
            onClick={() => selectEvent(ev.id, pv.occurrenceStart)}
          >
            <Pencil size={14} />
          </button>
          <button
            className="icon-btn sm"
            title={locked ? 'Als eigenen Termin kopieren' : 'Duplizieren'}
            onClick={() => duplicate(ev.id)}
          >
            <Copy size={14} />
          </button>
          {!locked && (
            <button
              className="icon-btn sm danger"
              title="Löschen (Entf)"
              onClick={() => (isSeries && pv.occurrenceStart ? setAskScope(true) : del(ev.id, 'all'))}
            >
              <Trash2 size={14} />
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="icon-btn sm" onClick={() => setPreview(null)} aria-label="Schließen">
            <X size={14} />
          </button>
        </div>

        {askScope && (
          <div className="pv-scope">
            <span>Wiederkehrenden Termin löschen:</span>
            <button className="btn btn-danger sm" onClick={() => del(ev.id, 'one', pv.occurrenceStart)}>
              Nur diesen
            </button>
            <button className="btn btn-danger-outline sm" onClick={() => del(ev.id, 'following', pv.occurrenceStart)}>
              Diesen und folgende
            </button>
            <button className="btn btn-danger-outline sm" onClick={() => del(ev.id, 'all')}>
              Ganze Serie
            </button>
          </div>
        )}

        <div className="pv-head">
          <i className="pv-swatch" />
          <div>
            <h3>{ev.title || '(Ohne Titel)'}</h3>
            <p>
              {fmt(start, 'EEEE, d. MMMM')}
              {ev.allDay ? ' · ganztägig' : ` · ${toLocalTime(start)} – ${toLocalTime(end)}`}
              {!ev.allDay && <span className="muted"> ({formatDuration(duration)})</span>}
            </p>
          </div>
        </div>
        <ul className="pv-facts">
          {ev.recurrence && (
            <li>
              <Repeat size={14} /> {describeRecurrence(ev.recurrence, baseStart)}
            </li>
          )}
          {ev.location && (
            <li>
              <MapPin size={14} /> {ev.location}
            </li>
          )}
          {ev.reminders.length > 0 && (
            <li>
              <Bell size={14} />{' '}
              {ev.reminders
                .slice()
                .sort((a, b) => a - b)
                .map(reminderLabel)
                .join(', ')}
            </li>
          )}
          {ev.notes && (
            <li className="pv-notes">
              <AlignLeft size={14} /> <span>{ev.notes}</span>
            </li>
          )}
          <li className="pv-cal">
            <i /> {cal?.name}
            {locked && (
              <span className="pv-locked" title="Dieser Kalender ist schreibgeschützt">
                <Lock size={11} /> schreibgeschützt
              </span>
            )}
          </li>
        </ul>
        <DiscordInfo ev={ev} occurrenceStart={pv.occurrenceStart} compact />
        {todo && (
          <div className="pv-todo">
            <TodoCheck todo={todo} size={16} />
            <span className={todo.done ? 'is-done' : ''}>ToDo: {todo.title}</span>
          </div>
        )}
        {ev.goal && !ev.goal.done && end.getTime() <= Date.now() ? (
          <MissedPrompt event={ev} />
        ) : ev.goal ? (
          <div className="pv-todo">
            <GoalCheck event={ev} />
            <span className={ev.goal.done ? 'is-done' : ''}>Wochenziel {ev.goal.done ? 'geschafft' : 'abhaken'}</span>
          </div>
        ) : null}
      </div>
    </Popover>
  )
}
