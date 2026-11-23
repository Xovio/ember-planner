import { useMemo, useState } from 'react'
import { addDays, addMinutes } from 'date-fns'
import { CalendarPlus, CheckSquare, Clock, CornerDownLeft, Flag, Hourglass, List, Sparkles, Tag, Timer } from 'lucide-react'
import { CALENDAR_COLORS } from '@shared/types'
import { parseLocalDate } from '@shared/todo'
import { uid, useStore, type AddKind } from '../store'
import { calVar } from '../lib/theme'
import { fmt, fromLocal } from '../lib/dates'
import { looksLikeEvent, parseEventInput, parseQuickAdd } from '../lib/quickAdd'
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

  const resolved: 'event' | 'todo' = kind === 'auto' ? (looksLikeEvent(text) ? 'event' : 'todo') : kind
  const ev = useMemo(() => parseEventInput(text, data.calendars), [text, data.calendars])
  const td = useMemo(() => parseQuickAdd(text, data.categories, data.lists), [text, data.categories, data.lists])
  const firstVisible = data.calendars.find((c) => c.visible) ?? data.calendars[0]
  const cal = data.calendars.find((c) => c.id === (ev.calendarId ?? firstVisible.id))!

  const eventRange = (): { start: Date; end: Date } => {
    if (ev.allDay || !ev.start) {
      const s = parseLocalDate(ev.date)
      return { start: s, end: addDays(s, 1) }
    }
    const s = fromLocal(ev.date, ev.start)
    let e = ev.end ? fromLocal(ev.date, ev.end) : addMinutes(s, ev.durationMin ?? data.settings.defaultDurationMin)
    if (e <= s) e = addDays(e, 1)
    return { start: s, end: e }
  }

  const submit = (): void => {
    if (resolved === 'event') {
      if (!ev.title) return
      const { start, end } = eventRange()
      createEvent({ title: ev.title, calendarId: cal.id, allDay: ev.allDay || !ev.start, start: start.toISOString(), end: end.toISOString() })
      if (page === 'plan') setCursor(start)
      pushToast({ kind: 'undo', title: `Termin „${ev.title}“ angelegt` })
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
                <strong>{ev.title || <span className="muted">Titel fehlt</span>}</strong>
                <div className="qa-chips">
                  <span className="qa-chip">
                    <Clock size={12} /> {fmt(start, 'EEE, d. MMM')}
                    {ev.allDay || !ev.start ? ' · ganztägig' : ` · ${fmt(start, 'HH:mm')}–${fmt(end, 'HH:mm')}`}
                  </span>
                  <span className="qa-chip" style={{ '--c': calVar(cal.color) } as React.CSSProperties}>
                    <i className="qa-dot" /> {cal.name}
                  </span>
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
