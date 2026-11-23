import { useEffect, useState } from 'react'
import { addDays, differenceInMinutes } from 'date-fns'
import {
  AlignLeft,
  Bell,
  CalendarDays,
  Clock,
  Copy,
  Lock,
  MapPin,
  Plus,
  Repeat,
  SquareCheck,
  Trash2,
  X
} from 'lucide-react'
import type { CalendarEvent, Recurrence, RecurrenceFreq } from '@shared/types'
import { weekdayIndex } from '@shared/recurrence'
import { isCalendarLocked } from '@shared/google'
import { isEventLocked, useStore } from '../../store'
import { calVar } from '../../lib/theme'
import {
  REMINDER_PRESETS,
  WEEKDAY_SHORT,
  fmt,
  formatDuration,
  fromLocal,
  reminderLabel,
  toLocalDate,
  toLocalTime
} from '../../lib/dates'
import { DatePicker } from '../ui/DatePicker'

const FREQ_LABEL: Record<RecurrenceFreq, [string, string]> = {
  daily: ['Tag', 'Tage'],
  weekly: ['Woche', 'Wochen'],
  monthly: ['Monat', 'Monate'],
  yearly: ['Jahr', 'Jahre']
}

const ORDINAL: Record<string, string> = {
  '1': 'ersten',
  '2': 'zweiten',
  '3': 'dritten',
  '4': 'vierten',
  '-1': 'letzten'
}
const DAY_NAME: Record<string, string> = {
  MO: 'Montag',
  TU: 'Dienstag',
  WE: 'Mittwoch',
  TH: 'Donnerstag',
  FR: 'Freitag',
  SA: 'Samstag',
  SU: 'Sonntag'
}

/** German text for rules our editor can't express (kept as raw RRULE from Google) */
function describeRawRule(rule: string): string {
  const parts = new Map(rule.split(';').map((p) => p.split('=') as [string, string]))
  const n = Number(parts.get('INTERVAL') ?? 1)
  const byDay = parts.get('BYDAY')
  const m = byDay && /^(-?\d)(MO|TU|WE|TH|FR|SA|SU)$/.exec(byDay)
  let s: string | null = null
  if (parts.get('FREQ') === 'MONTHLY' && m && ORDINAL[m[1]]) {
    s = `${n === 1 ? 'Monatlich' : `Alle ${n} Monate`} am ${ORDINAL[m[1]]} ${DAY_NAME[m[2]]}`
  } else if (parts.get('FREQ') === 'MONTHLY' && /^\d+$/.test(parts.get('BYMONTHDAY') ?? '')) {
    s = `${n === 1 ? 'Monatlich' : `Alle ${n} Monate`} am ${parts.get('BYMONTHDAY')}.`
  } else if (parts.get('FREQ') === 'WEEKLY' && byDay) {
    const days = byDay.split(',').map((d) => DAY_NAME[d]?.slice(0, 2))
    if (days.every(Boolean)) s = `${n === 1 ? 'Jede Woche' : `Alle ${n} Wochen`} ${days.join(', ')}`
  }
  return s ?? 'Benutzerdefinierte Wiederholung (aus Google)'
}

export function describeRecurrence(r: Recurrence, start: Date): string {
  if (r.rrule) {
    let raw = describeRawRule(r.rrule)
    if (r.until) raw += `, bis ${fmt(new Date(r.until + 'T00:00'), 'd. MMM yyyy')}`
    if (r.count) raw += `, ${r.count}×`
    return raw
  }
  const n = r.interval
  let s: string
  if (r.freq === 'weekly' && r.byWeekday?.length) {
    const days = r.byWeekday.map((d) => WEEKDAY_SHORT[d]).join(', ')
    s = n === 1 ? `Jede Woche ${days}` : `Alle ${n} Wochen ${days}`
  } else if (r.freq === 'monthly')
    s = n === 1 ? `Monatlich am ${start.getDate()}.` : `Alle ${n} Monate am ${start.getDate()}.`
  else if (r.freq === 'yearly') s = n === 1 ? `Jährlich am ${fmt(start, 'd. MMMM')}` : `Alle ${n} Jahre`
  else s = n === 1 ? (r.freq === 'daily' ? 'Täglich' : 'Wöchentlich') : `Alle ${n} ${FREQ_LABEL[r.freq][1]}`
  if (r.until) s += `, bis ${fmt(new Date(r.until + 'T00:00'), 'd. MMM yyyy')}`
  if (r.count) s += `, ${r.count}×`
  return s
}

type Fields = { startDate: string; startTime: string; endDate: string; endTime: string }

function fieldsOf(ev: CalendarEvent): Fields {
  const s = new Date(ev.start)
  const e = new Date(ev.end)
  return {
    startDate: toLocalDate(s),
    startTime: toLocalTime(s),
    endDate: toLocalDate(ev.allDay ? addDays(e, -1) : e),
    endTime: toLocalTime(e)
  }
}

function rangeOf(f: Fields, allDay: boolean): { s: Date; e: Date } | null {
  if (!f.startDate || !f.endDate) return null
  const r = allDay
    ? { s: fromLocal(f.startDate), e: addDays(fromLocal(f.endDate), 1) }
    : { s: fromLocal(f.startDate, f.startTime), e: fromLocal(f.endDate, f.endTime) }
  return r.e > r.s ? r : null
}

/** Event editor inside the right panel. Every change saves immediately and is undoable. */
export function EventDetails({ id, occurrenceStart }: { id: string; occurrenceStart?: string }): React.JSX.Element {
  const ev = useStore((s) => s.data?.events.find((e) => e.id === id))
  const calendars = useStore((s) => s.data!.calendars)
  const linkedTodo = useStore((s) => (ev?.todoId ? s.data?.todos.find((t) => t.id === ev.todoId) : undefined))
  const update = useStore((s) => s.updateEvent)
  const del = useStore((s) => s.deleteEvent)
  const duplicate = useStore((s) => s.duplicateEvent)
  const toggleTodo = useStore((s) => s.toggleTodo)
  const selectTodo = useStore((s) => s.selectTodo)
  const clear = useStore((s) => s.clearSelection)
  const isLocked = useStore((s) => isEventLocked(s.data!, ev))

  const [f, setF] = useState<Fields | null>(() => (ev ? fieldsOf(ev) : null))
  const [askScope, setAskScope] = useState(false)

  // follow external changes (dragging in the grid, undo)
  useEffect(() => {
    if (ev) setF(fieldsOf(ev))
  }, [ev?.start, ev?.end, ev?.allDay]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ev || !f) return <p className="empty-mini">Dieser Termin existiert nicht mehr.</p>

  const set = (patch: Partial<CalendarEvent>, coalesce?: string): void => update(ev.id, patch, coalesce)
  const commitFields = (next: Fields, allDay = ev.allDay): void => {
    setF(next)
    const r = rangeOf(next, allDay)
    if (r) set({ start: r.s.toISOString(), end: r.e.toISOString(), allDay }, 'time')
  }
  /** moving the start keeps the duration */
  const setStart = (date: string, time: string): void => {
    const cur = rangeOf(f, ev.allDay)
    if (!cur || !date) return setF({ ...f, startDate: date, startTime: time })
    const dur = cur.e.getTime() - cur.s.getTime()
    const ns = ev.allDay ? fromLocal(date) : fromLocal(date, time)
    const ne = new Date(ns.getTime() + dur)
    commitFields({
      startDate: date,
      startTime: time,
      endDate: toLocalDate(ev.allDay ? addDays(ne, -1) : ne),
      endTime: toLocalTime(ne)
    })
  }

  const valid = !!rangeOf(f, ev.allDay)
  const rec = ev.recurrence
  const start = new Date(ev.start)
  const cal = calendars.find((c) => c.id === ev.calendarId)
  const setRecurrence = (r: Recurrence | null): void => set({ recurrence: r }, 'rec')
  const r = rangeOf(f, ev.allDay)
  const durationLabel = r && !ev.allDay ? formatDuration(differenceInMinutes(r.e, r.s)) : null

  return (
    <div className="details" style={{ '--c': calVar(cal?.color ?? 'red') } as React.CSSProperties}>
      <div className="details-accent" />
      <div className="details-toolbar">
        <span className="drawer-kicker">Termin</span>
        <span style={{ flex: 1 }} />
        <button
          className="icon-btn sm"
          title={isLocked ? 'Als eigenen Termin kopieren' : 'Duplizieren'}
          onClick={() => duplicate(ev.id)}
        >
          <Copy size={14} />
        </button>
        {!isLocked && (
          <button
            className="icon-btn sm danger"
            title="Löschen"
            onClick={() => (rec && occurrenceStart ? setAskScope(true) : del(ev.id, 'all'))}
          >
            <Trash2 size={14} />
          </button>
        )}
        <button className="icon-btn sm" onClick={clear} title="Schließen (Esc)" aria-label="Schließen">
          <X size={15} />
        </button>
      </div>

      {askScope && (
        <div className="pv-scope">
          <span>Wiederkehrenden Termin löschen:</span>
          <button className="btn btn-danger sm" onClick={() => del(ev.id, 'one', occurrenceStart)}>
            Nur diesen
          </button>
          <button className="btn btn-danger-outline sm" onClick={() => del(ev.id, 'all')}>
            Ganze Serie
          </button>
        </div>
      )}

      {isLocked && (
        <div className="details-locked">
          <Lock size={14} />
          <span>
            {cal?.readOnly
              ? 'Dieser Google-Kalender ist schreibgeschützt.'
              : 'Google-Termine lassen sich in Ember Planner noch nicht bearbeiten – das kommt mit dem Hochladen.'}{' '}
            Mit <Copy size={12} /> kopierst du ihn in einen eigenen Kalender.
          </span>
        </div>
      )}

      <fieldset className="details-body" disabled={isLocked}>
        <textarea
          className="title-input details-title"
          placeholder="Titel hinzufügen"
          rows={1}
          value={ev.title}
          autoFocus={!ev.title}
          onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') }, 'title')}
        />

        {linkedTodo && (
          <div className="linked-todo">
            <SquareCheck size={16} />
            <span>
              Zeitblock für <strong>{linkedTodo.title}</strong>
              {linkedTodo.done && ' · erledigt'}
            </span>
            <button className="btn btn-ghost sm" onClick={() => toggleTodo(linkedTodo.id)}>
              {linkedTodo.done ? 'Wieder öffnen' : 'Abhaken'}
            </button>
            <button className="link-btn" onClick={() => selectTodo(linkedTodo.id)}>
              ToDo
            </button>
          </div>
        )}

        <div className="field">
          <CalendarDays size={16} className="field-icon" />
          <div className="cal-picker">
            {calendars
              .filter((c) => c.id === ev.calendarId || !isCalendarLocked(c))
              .map((c) => (
                <button
                  key={c.id}
                  className={`cal-pill ${c.id === ev.calendarId ? 'on' : ''}`}
                  style={{ '--c': calVar(c.color) } as React.CSSProperties}
                  onClick={() => set({ calendarId: c.id })}
                >
                  <i />
                  {c.name}
                </button>
              ))}
          </div>
        </div>

        <div className="field">
          <Clock size={16} className="field-icon" />
          <div className="field-stack">
            <label className="toggle">
              <input
                type="checkbox"
                checked={ev.allDay}
                onChange={(e) => {
                  const allDay = e.target.checked
                  const next = allDay
                    ? f
                    : f.startDate === f.endDate
                      ? { ...f, startTime: '09:00', endTime: '10:00' }
                      : f
                  commitFields(next, allDay)
                }}
              />
              <span className="toggle-track" />
              Ganztägig
            </label>
            <div className="datetime-grid">
              <span className="muted">Von</span>
              <DatePicker value={f.startDate} onChange={(v) => v && setStart(v, f.startTime)} />
              {!ev.allDay && (
                <input
                  type="time"
                  className="input"
                  step={300}
                  value={f.startTime}
                  onChange={(e) => setStart(f.startDate, e.target.value)}
                />
              )}
              <span className="muted">Bis</span>
              <DatePicker value={f.endDate} onChange={(v) => v && commitFields({ ...f, endDate: v })} />
              {!ev.allDay && (
                <input
                  type="time"
                  className="input"
                  step={300}
                  value={f.endTime}
                  onChange={(e) => commitFields({ ...f, endTime: e.target.value })}
                />
              )}
            </div>
            {!valid && (
              <span className="field-error">Das Ende muss nach dem Beginn liegen – wird erst dann gespeichert.</span>
            )}
            {durationLabel && <span className="field-hint">Dauer: {durationLabel}</span>}
          </div>
        </div>

        <div className="field">
          <Repeat size={16} className="field-icon" />
          <div className="field-stack">
            <select
              className="input"
              value={rec?.freq ?? 'none'}
              onChange={(e) => {
                const v = e.target.value
                if (v === 'none') return setRecurrence(null)
                const freq = v as RecurrenceFreq
                setRecurrence({
                  ...(rec ?? { interval: 1 }),
                  freq,
                  byWeekday: freq === 'weekly' ? (rec?.byWeekday ?? [weekdayIndex(start)]) : undefined
                })
              }}
            >
              <option value="none">Wiederholt sich nicht</option>
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich (am {start.getDate()}.)</option>
              <option value="yearly">Jährlich (am {fmt(start, 'd. MMMM')})</option>
            </select>
            {rec && (
              <div className="rec-box">
                <div className="rec-line">
                  Alle
                  <input
                    type="number"
                    min={1}
                    max={99}
                    className="input xs"
                    value={rec.interval}
                    onChange={(e) => setRecurrence({ ...rec, interval: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  {FREQ_LABEL[rec.freq][rec.interval === 1 ? 0 : 1]}
                </div>
                {rec.freq === 'weekly' && (
                  <div className="weekday-picker">
                    {WEEKDAY_SHORT.map((w, i) => {
                      const on = rec.byWeekday?.includes(i)
                      return (
                        <button
                          key={w}
                          className={on ? 'on' : ''}
                          onClick={() => {
                            const cur = new Set(rec.byWeekday ?? [])
                            if (on) cur.delete(i)
                            else cur.add(i)
                            if (cur.size === 0) return
                            setRecurrence({ ...rec, byWeekday: [...cur].sort() })
                          }}
                        >
                          {w}
                        </button>
                      )
                    })}
                  </div>
                )}
                <div className="rec-line">
                  Endet
                  <select
                    className="input sm"
                    value={rec.until ? 'until' : rec.count ? 'count' : 'never'}
                    onChange={(e) => {
                      const v = e.target.value
                      setRecurrence({
                        ...rec,
                        until: v === 'until' ? toLocalDate(addDays(start, 90)) : undefined,
                        count: v === 'count' ? 10 : undefined
                      })
                    }}
                  >
                    <option value="never">nie</option>
                    <option value="until">am</option>
                    <option value="count">nach</option>
                  </select>
                  {rec.until && (
                    <DatePicker value={rec.until} onChange={(v) => v && setRecurrence({ ...rec, until: v })} />
                  )}
                  {rec.count && (
                    <>
                      <input
                        type="number"
                        min={1}
                        className="input xs"
                        value={rec.count}
                        onChange={(e) => setRecurrence({ ...rec, count: Math.max(1, Number(e.target.value) || 1) })}
                      />
                      Terminen
                    </>
                  )}
                </div>
                <span className="field-hint">Änderungen gelten für die ganze Serie.</span>
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <Bell size={16} className="field-icon" />
          <div className="reminder-list">
            {ev.reminders
              .slice()
              .sort((a, b) => a - b)
              .map((m) => (
                <span key={m} className="reminder-chip">
                  {reminderLabel(m)}
                  <button
                    aria-label="Erinnerung entfernen"
                    onClick={() => set({ reminders: ev.reminders.filter((x) => x !== m) })}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            <label className="reminder-add">
              <Plus size={13} />
              <select
                value=""
                onChange={(e) => {
                  const m = Number(e.target.value)
                  if (!ev.reminders.includes(m)) set({ reminders: [...ev.reminders, m] })
                }}
              >
                <option value="" disabled>
                  Erinnerung
                </option>
                {REMINDER_PRESETS.filter((m) => !ev.reminders.includes(m)).map((m) => (
                  <option key={m} value={m}>
                    {reminderLabel(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="field">
          <MapPin size={16} className="field-icon" />
          <input
            className="input"
            placeholder="Ort oder Link"
            value={ev.location ?? ''}
            onChange={(e) => set({ location: e.target.value }, 'location')}
          />
        </div>

        <div className="field">
          <AlignLeft size={16} className="field-icon" />
          <textarea
            className="input textarea"
            placeholder="Notizen"
            rows={5}
            value={ev.notes ?? ''}
            onChange={(e) => set({ notes: e.target.value }, 'notes')}
          />
        </div>

        <p className="details-foot">Änderungen werden sofort gespeichert · Strg+Z macht sie rückgängig</p>
      </fieldset>
    </div>
  )
}
