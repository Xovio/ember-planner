import { useState } from 'react'
import { addDays, addMinutes } from 'date-fns'
import { BookMarked, Clock, Maximize2, Megaphone } from 'lucide-react'
import { isCalendarLocked } from '@shared/google'
import type { EventTemplate } from '@shared/types'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, fromLocal, toLocalDate, toLocalTime } from '../../lib/dates'
import { Popover } from '../ui/Popover'
import { api } from '../../lib/api'

/** Small "new event" popover at the clicked slot (title, time, calendar). */
export function QuickCreate(): React.JSX.Element | null {
  const qc = useStore((s) => s.quickCreate)
  const allCalendars = useStore((s) => s.data!.calendars)
  // Google calendars can't take new events until writing back is available
  const calendars = allCalendars.filter((c) => !isCalendarLocked(c))
  const setQuickCreate = useStore((s) => s.setQuickCreate)
  const createEvent = useStore((s) => s.createEvent)
  const openAnnounce = useStore((s) => s.openAnnounce)
  const firstVisible = calendars.find((c) => c.visible) ?? calendars[0] ?? allCalendars[0]
  const templates = useStore((s) => s.data!.templates)
  // "Fertig machen" on a placeholder: the template is set, the title is still to be written
  const finishing = qc?.placeholderOf ? templates.find((t) => t.id === qc.placeholderOf) : undefined
  const [title, setTitle] = useState('')
  const [calendarId, setCalendarId] = useState(
    finishing && calendars.some((c) => c.id === finishing.calendarId) ? finishing.calendarId : firstVisible.id
  )
  const [times, setTimes] = useState(() =>
    qc ? { s: toLocalTime(new Date(qc.start)), e: toLocalTime(new Date(qc.end)) } : { s: '', e: '' }
  )
  const [tpl, setTpl] = useState<EventTemplate | null>(finishing ?? null)
  const [announce, setAnnounce] = useState(!!finishing?.discord && !!api.discord)
  if (!qc) return null

  /** a template fills title, calendar and length; place, notes and reminders follow on save */
  const applyTemplate = (t: EventTemplate): void => {
    const on = tpl?.id !== t.id
    setTpl(on ? t : null)
    if (!on) return
    if (!title.trim() || title === tpl?.title) setTitle(t.title || t.name)
    if (calendars.some((c) => c.id === t.calendarId)) setCalendarId(t.calendarId)
    if (!qc.allDay && !t.allDay) {
      const s = fromLocal(toLocalDate(new Date(qc.start)), times.s)
      setTimes({ ...times, e: toLocalTime(addMinutes(s, t.durationMin)) })
    }
  }

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
    const extra = tpl
      ? {
          reminders: [...tpl.reminders],
          ...(tpl.location ? { location: tpl.location } : {}),
          ...(tpl.notes ? { notes: tpl.notes } : {}),
          ...(tpl.noteLinks?.length ? { noteLinks: [...tpl.noteLinks] } : {})
        }
      : {}
    if (finishing && !title.trim()) return
    const id = createEvent(
      { title: title.trim(), calendarId, allDay: qc.allDay, ...range(), ...extra, ...(tpl ? { templateId: tpl.id } : {}) },
      { select: more && !(finishing && announce) }
    )
    if (id && finishing && announce) openAnnounce(id)
  }

  return (
    <Popover
      anchor={qc.anchor}
      onClose={() => setQuickCreate(null)}
      width={330}
      label={finishing ? `${finishing.name} fertig machen` : 'Neuer Termin'}
    >
      <div
        className="qc"
        style={{ '--c': calVar(calendars.find((c) => c.id === calendarId)?.color ?? 'red') } as React.CSSProperties}
      >
        <input
          autoFocus
          className="qc-title"
          placeholder={finishing ? `Titel der ${finishing.name}` : 'Titel hinzufügen'}
          aria-required={finishing ? true : undefined}
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
              <input
                type="time"
                className="input xs-time"
                step={900}
                value={times.s}
                onChange={(e) => setTimes({ ...times, s: e.target.value })}
              />
              <span className="muted">–</span>
              <input
                type="time"
                className="input xs-time"
                step={900}
                value={times.e}
                onChange={(e) => setTimes({ ...times, e: e.target.value })}
              />
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
        {finishing && api.discord && (
          <label className="qc-announce" title={finishing.discord ? undefined : 'Discord-Vorgaben stellst du in der Vorlage ein'}>
            <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
            <Megaphone size={13} /> In Discord ankündigen
          </label>
        )}
        {!finishing && templates.length > 0 && (
          <div className="qc-templates" role="group" aria-label="Vorlagen">
            <BookMarked size={13} />
            {templates.map((t) => (
              <button
                key={t.id}
                className={`qc-tpl ${tpl?.id === t.id ? 'on' : ''}`}
                aria-pressed={tpl?.id === t.id}
                onClick={() => applyTemplate(t)}
                title={[t.title || t.name, t.location].filter(Boolean).join(' · ')}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
        <div className="qc-actions">
          <button
            className="btn btn-ghost sm"
            onClick={() => save(true)}
            title="Anlegen und alle Details bearbeiten (Strg+Enter)"
          >
            <Maximize2 size={13} /> Mehr Optionen
          </button>
          <span style={{ flex: 1 }} />
          <button
            className="btn btn-primary sm"
            onClick={() => save()}
            disabled={!!finishing && !title.trim()}
            title={finishing && !title.trim() ? 'Gib der Session zuerst einen Titel' : undefined}
          >
            {finishing ? 'Fertig machen' : 'Speichern'} <kbd>↵</kbd>
          </button>
        </div>
      </div>
    </Popover>
  )
}
