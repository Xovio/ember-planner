import { useState } from 'react'
import { addDays } from 'date-fns'
import { Clock, Maximize2 } from 'lucide-react'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, fromLocal, toLocalDate, toLocalTime } from '../../lib/dates'
import { Popover } from '../ui/Popover'

/** Small "new event" popover at the clicked slot (title, time, calendar). */
export function QuickCreate(): React.JSX.Element | null {
  const qc = useStore((s) => s.quickCreate)
  const calendars = useStore((s) => s.data!.calendars)
  const setQuickCreate = useStore((s) => s.setQuickCreate)
  const createEvent = useStore((s) => s.createEvent)
  const firstVisible = calendars.find((c) => c.visible) ?? calendars[0]
  const [title, setTitle] = useState('')
  const [calendarId, setCalendarId] = useState(firstVisible.id)
  const [times, setTimes] = useState(() =>
    qc ? { s: toLocalTime(new Date(qc.start)), e: toLocalTime(new Date(qc.end)) } : { s: '', e: '' }
  )
  if (!qc) return null

  const start = new Date(qc.start)
  const day = toLocalDate(start)
  const range = (): { start: string; end: string } => {
    if (qc.allDay) return { start: qc.start, end: qc.end }
    const s = fromLocal(day, times.s)
    let e = fromLocal(day, times.e)
    if (e <= s) e = addDays(e, 1)
    return { start: s.toISOString(), end: e.toISOString() }
  }
  const save = (more = false): void => {
    createEvent({ title: title.trim(), calendarId, allDay: qc.allDay, ...range() }, { select: more })
  }

  return (
    <Popover anchor={qc.anchor} onClose={() => setQuickCreate(null)} width={330} label="Neuer Termin">
      <div className="qc" style={{ '--c': calVar(calendars.find((c) => c.id === calendarId)?.color ?? 'red') } as React.CSSProperties}>
        <input
          autoFocus
          className="qc-title"
          placeholder="Titel hinzufügen"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save(e.ctrlKey || e.shiftKey)
          }}
        />
        <div className="qc-when">
          <Clock size={14} />
          <span>{fmt(start, 'EEE, d. MMM')}</span>
          {qc.allDay ? (
            <span className="muted">ganztägig</span>
          ) : (
            <>
              <input type="time" className="input xs-time" step={900} value={times.s} onChange={(e) => setTimes({ ...times, s: e.target.value })} />
              <span className="muted">–</span>
              <input type="time" className="input xs-time" step={900} value={times.e} onChange={(e) => setTimes({ ...times, e: e.target.value })} />
            </>
          )}
        </div>
        <div className="cal-picker">
          {calendars.map((c) => (
            <button
              key={c.id}
              className={`cal-pill sm ${c.id === calendarId ? 'on' : ''}`}
              style={{ '--c': calVar(c.color) } as React.CSSProperties}
              onClick={() => setCalendarId(c.id)}
            >
              <i />
              {c.name}
            </button>
          ))}
        </div>
        <div className="qc-actions">
          <button className="btn btn-ghost sm" onClick={() => save(true)} title="Anlegen und alle Details bearbeiten (Strg+Enter)">
            <Maximize2 size={13} /> Mehr Optionen
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-primary sm" onClick={() => save()}>
            Speichern <kbd>↵</kbd>
          </button>
        </div>
      </div>
    </Popover>
  )
}
