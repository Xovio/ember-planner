import { useMemo, useState } from 'react'
import { addDays, addMinutes } from 'date-fns'
import { BookMarked, CalendarPlus, CheckSquare, Clock, CornerDownLeft, Flag, Hourglass, List, MapPin, Repeat, Sparkles, Tag, Timer } from 'lucide-react'
import { CALENDAR_COLORS } from '@shared/types'
import { parseLocalDate, recurrenceLabel } from '@shared/todo'
import { uid, useStore, writableCalendars, type AddKind } from '../store'
import { calVar } from '../lib/theme'
import { fmt, fromLocal } from '../lib/dates'
import { looksLikeEvent, parseEventInput, parseQuickAdd } from '../lib/quickAdd'
import { templateKey } from '@shared/templates'
import { PRIORITY_LABEL, deadlineLabel, formatEstimate } from '../lib/todos'

/** One input for everything: with a clock time it becomes an event, otherwise a ToDo. */
export function UniversalAdd({ initialKind, prefill }: { initialKind: AddKind; prefill?: string }): React.JSX.Element {
  const data = useStore((s) => s.data!)
  const close = useStore((s) => s.closeOverlay)
  const createEvent = useStore((s) => s.createEvent)
  const addTodo = useStore((s) => s.addTodo)
  const upsertCategory = useStore((s) => s.upsertCategory)
  const pushToast = useStore((s) => s.pushToast)
  const setCursor = useStore((s) => s.setCursor)
  const page = useStore((s) => s.page)
  const [text, setText] = useState(prefill ?? '')
  const [kind, setKind] = useState<AddKind>(initialKind)

  const ev = useMemo(
    () => parseEventInput(text, data.calendars, new Date(), data.templates),
    [text, data.calendars, data.templates]
  )
  // "/vorlage" starts from an event template: it fills in what the text leaves open
  const tpl = ev.templateId ? data.templates.find((t) => t.id === ev.templateId) : undefined
  const resolved: 'event' | 'todo' = kind === 'auto' ? (tpl || looksLikeEvent(text) ? 'event' : 'todo') : kind
  const td = useMemo(() => parseQuickAdd(text, data.categories, data.lists), [text, data.categories, data.lists])
  const firstVisible = data.calendars.find((c) => c.visible) ?? data.calendars[0]
  const tplCal = tpl && writableCalendars(data).some((c) => c.id === tpl.calendarId) ? tpl.calendarId : undefined
  const cal = data.calendars.find((c) => c.id === (ev.calendarId ?? tplCal ?? firstVisible.id))!
  const evTitle = ev.title || tpl?.title || tpl?.name || ''
  const startTime = ev.allDay ? undefined : (ev.start ?? (tpl && !tpl.allDay ? tpl.startTime : undefined))
  const allDay = !startTime

  const eventRange = (): { start: Date; end: Date } => {
    if (allDay) {
      const s = parseLocalDate(ev.date)
      const days = tpl?.allDay ? Math.max(1, Math.round(tpl.durationMin / 1440)) : 1
      return { start: s, end: addDays(s, days) }
    }
    const s = fromLocal(ev.date, startTime)
    const minutes = ev.durationMin ?? tpl?.durationMin ?? data.settings.defaultDurationMin
    let e = ev.start && ev.end ? fromLocal(ev.date, ev.end) : addMinutes(s, minutes)
    if (e <= s) e = addDays(e, 1)
    return { start: s, end: e }
  }

  const submit = (): void => {
    if (resolved === 'event') {
      if (!evTitle) return
      const { start, end } = eventRange()
      createEvent({
        title: evTitle,
        calendarId: cal.id,
        allDay,
        start: start.toISOString(),
        end: end.toISOString(),
        ...(tpl
          ? {
              reminders: [...tpl.reminders],
              ...(tpl.location ? { location: tpl.location } : {}),
              ...(tpl.notes ? { notes: tpl.notes } : {}),
              templateId: tpl.id
            }
          : {})
      })
      if (page === 'plan') setCursor(start)
      pushToast({ kind: 'undo', title: `Termin „${evTitle}“ angelegt` })
    } else {
      if (!td.title) return
      let categoryId = td.categoryId
      if (!categoryId && td.newCategory) {
        categoryId = uid()
        upsertCategory({ id: categoryId, name: td.newCategory, color: CALENDAR_COLORS[data.categories.length % CALENDAR_COLORS.length] })
      }
      addTodo({
        title: td.title,
        hardDeadline: td.hardDeadline,
        softDeadline: td.softDeadline,
        priority: td.priority,
        categoryId,
        estimateMin: td.estimateMin,
        recurrence: td.recurrence,
        ...(td.listId ? { listId: td.listId } : {})
      })
      pushToast({ kind: 'undo', title: `ToDo „${td.title}“ angelegt` })
    }
    close()
  }

  const { start, end } = eventRange()
  const list = td.listId ? data.lists.find((l) => l.id === td.listId) : undefined
  const cat = td.categoryId ? data.categories.find((c) => c.id === td.categoryId) : undefined

  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="spotlight" role="dialog" aria-label="Neu anlegen">
        <div className="spot-input">
          {resolved === 'event' ? <CalendarPlus size={19} /> : <CheckSquare size={19} />}
          <input
            autoFocus
            value={text}
            placeholder="„Zahnarzt Do 14 Uhr 1h“ oder „Karte zeichnen bis Fr #dnd“"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') close()
              if (e.key === 'Tab') {
                e.preventDefault()
                setKind(resolved === 'event' ? 'todo' : 'event')
              }
            }}
          />
          <kbd>↵</kbd>
        </div>
        <div className="spot-kinds" role="radiogroup" aria-label="Art">
          {(['auto', 'event', 'todo'] as const).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              {k === 'auto' ? (
                <>
                  <Sparkles size={13} /> Automatisch
                </>
              ) : k === 'event' ? (
                <>
                  <CalendarPlus size={13} /> Termin
                </>
              ) : (
                <>
                  <CheckSquare size={13} /> ToDo
                </>
              )}
            </button>
          ))}
          <span className="muted spot-tabhint">
            <kbd>Tab</kbd> wechselt
          </span>
        </div>

        {text.trim() ? (
          <div className="spot-preview">
            {resolved === 'event' ? (
              <>
                <strong>{evTitle || <span className="muted">Titel fehlt</span>}</strong>
                <div className="qa-chips">
                  {tpl && (
                    <span className="qa-chip">
                      <BookMarked size={12} /> Vorlage: {tpl.name}
                    </span>
                  )}
                  <span className="qa-chip">
                    <Clock size={12} /> {fmt(start, 'EEE, d. MMM')}
                    {allDay ? ' · ganztägig' : ` · ${fmt(start, 'HH:mm')}–${fmt(end, 'HH:mm')}`}
                  </span>
                  <span className="qa-chip" style={{ '--c': calVar(cal.color) } as React.CSSProperties}>
                    <i className="qa-dot" /> {cal.name}
                  </span>
                  {tpl?.location && (
                    <span className="qa-chip">
                      <MapPin size={12} /> {tpl.location}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <strong>{td.title || <span className="muted">Titel fehlt</span>}</strong>
                <div className="qa-chips">
                  {td.hardDeadline && (
                    <span className="qa-chip">
                      <Flag size={12} /> hart: {deadlineLabel(td.hardDeadline)}
                    </span>
                  )}
                  {td.softDeadline && (
                    <span className="qa-chip">
                      <Hourglass size={12} /> weich: {deadlineLabel(td.softDeadline)}
                    </span>
                  )}
                  {td.priority > 0 && <span className="qa-chip">Priorität: {PRIORITY_LABEL[td.priority]}</span>}
                  {(cat || td.newCategory) && (
                    <span className="qa-chip">
                      <Tag size={12} /> {cat?.name ?? `${td.newCategory} (neu)`}
                    </span>
                  )}
                  <span className="qa-chip">
                    <List size={12} /> {list?.name ?? 'Eingang'}
                  </span>
                  {td.estimateMin && (
                    <span className="qa-chip">
                      <Timer size={12} /> {formatEstimate(td.estimateMin)}
                    </span>
                  )}
                  {td.recurrence && (
                    <span className="qa-chip">
                      <Repeat size={12} /> {recurrenceLabel(td.recurrence)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="spot-help">
            <div>
              <strong>Termin</strong> – mit Uhrzeit: <code>Zahnarzt Do 14 Uhr</code> <code>Session 28.11. 19-23 Uhr #dnd</code>{' '}
              <code>Urlaub Montag ganztägig</code>
            </div>
            {data.templates.length > 0 && (
              <div>
                <strong>Vorlage</strong> – mit <code>/</code>:{' '}
                {data.templates.slice(0, 4).map((t) => (
                  <code key={t.id}>/{templateKey(t)} Fr</code>
                ))}
              </div>
            )}
            <div>
              <strong>ToDo</strong> – sonst: <code>Karte zeichnen bis Fr ~Mi #dnd !! 2h</code> <code>@projekte</code>
            </div>
          </div>
        )}
        <div className="spot-foot">
          <CornerDownLeft size={12} /> anlegen · <kbd>Esc</kbd> schließen
        </div>
      </div>
    </div>
  )
}
