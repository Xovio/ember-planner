import { useMemo, useState } from 'react'
import { isToday, isTomorrow } from 'date-fns'
import { Dices, MapPin, Plus } from 'lucide-react'
import { findNextSession, guessCampaign, prepTodos, sessionCountdown } from '@shared/session'
import { localDate } from '@shared/todo'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, toLocalTime } from '../../lib/dates'
import { useNow } from '../calendar/TimeGrid'
import { useWidgetConfig } from '../../plugins/registry'
import { TodoItem } from '../todos/TodoItem'

export const SESSION_WIDGET_ID = 'session-countdown'

/** null = pick automatically (campaign-like name), '' = any calendar / not used */
interface SessionConfig extends Record<string, unknown> {
  calendarId: string | null
  keyword: string
  categoryId: string | null
  listId: string | null
}

const DEFAULTS: SessionConfig = { calendarId: null, keyword: 'Session', categoryId: null, listId: null }
const MAX_TODOS = 6

/** config with the automatic choices filled in */
function useSessionConfig(): [SessionConfig & { calendarId: string; categoryId: string; listId: string }, (p: Partial<SessionConfig>) => void] {
  const [cfg, update] = useWidgetConfig<SessionConfig>(SESSION_WIDGET_ID, DEFAULTS)
  const data = useStore((s) => s.data!)
  return [
    {
      ...cfg,
      calendarId: cfg.calendarId ?? guessCampaign(data.calendars, 'dnd'),
      categoryId: cfg.categoryId ?? guessCampaign(data.categories, 'cat-dnd'),
      listId: cfg.listId ?? guessCampaign(data.lists, 'campaigns')
    },
    update
  ]
}

/** countdown to the next D&D session with the prep ToDos that are due by then */
export function SessionCountdown(): React.JSX.Element {
  const [cfg] = useSessionConfig()
  const data = useStore((s) => s.data!)
  const addTodo = useStore((s) => s.addTodo)
  const selectEvent = useStore((s) => s.selectEvent)
  const setCursor = useStore((s) => s.setCursor)
  const setPage = useStore((s) => s.setPage)
  const now = useNow()
  const [draft, setDraft] = useState('')

  const session = useMemo(
    () => findNextSession(data.events, { calendarId: cfg.calendarId, keyword: cfg.keyword }, now),
    [data.events, cfg.calendarId, cfg.keyword, now]
  )
  const prep = useMemo(
    () => (session ? prepTodos(data.todos, { categoryId: cfg.categoryId, listId: cfg.listId }, session.start) : []),
    [data.todos, cfg.categoryId, cfg.listId, session]
  )
  const calendar = data.calendars.find((c) => c.id === (session?.event.calendarId ?? cfg.calendarId))
  const usesPrep = !!(cfg.categoryId || cfg.listId)

  const open = (): void => {
    if (!session) return
    setPage('plan')
    setCursor(session.start)
    selectEvent(session.event.id, session.start.toISOString())
  }

  const add = (): void => {
    const title = draft.trim()
    if (!title || !session) return
    addTodo({
      title,
      categoryId: cfg.categoryId || undefined,
      ...(cfg.listId ? { listId: cfg.listId } : {}),
      hardDeadline: localDate(session.start)
    })
    setDraft('')
  }

  if (!session) {
    return (
      <section className="card widget session-card">
        <div className="widget-head">
          <div>
            <h3>Nächste Session</h3>
            <p>{calendar ? calendar.name : 'Alle Kalender'}</p>
          </div>
        </div>
        <div className="empty-mini with-icon">
          <Dices size={16} /> Keine Session in den nächsten Monaten gefunden. Unter <strong>Anordnen</strong> → ⚙ stellst du
          ein, welcher Kalender und welcher Titel zählen.
        </div>
      </section>
    )
  }

  const cd = sessionCountdown(session, now)
  const color = calVar(calendar?.color ?? 'violet')
  const when = isToday(session.start) ? 'Heute' : isTomorrow(session.start) ? 'Morgen' : fmt(session.start, 'EEEE, d. MMMM')

  return (
    <section className="card widget session-card" style={{ '--c': color } as React.CSSProperties}>
      <div className="widget-head">
        <div>
          <h3>Nächste Session</h3>
          <p>{calendar?.name ?? 'Alle Kalender'}</p>
        </div>
        <div className="widget-figure session-figure">
          <strong>{cd.big}</strong>
          <span>{cd.small}</span>
        </div>
      </div>

      <button className="session-event" onClick={open}>
        <Dices size={18} />
        <span>
          <strong>{session.event.title || '(Ohne Titel)'}</strong>
          <span>
            {when}, {toLocalTime(session.start)} – {toLocalTime(session.end)}
            {session.event.location && (
              <>
                {' · '}
                <MapPin size={11} /> {session.event.location}
              </>
            )}
          </span>
        </span>
      </button>

      {usesPrep && (
        <>
          <h4 className="session-sub">
            Vorbereitung
            <span>{prep.length === 0 ? 'alles erledigt' : `${prep.length} offen`}</span>
          </h4>
          {prep.length === 0 ? (
            <p className="empty-mini">Nichts mehr bis zur Session fällig. 🎲</p>
          ) : (
            <div className="todo-list">
              {prep.slice(0, MAX_TODOS).map((t) => (
                <TodoItem key={t.id} todo={t} showList />
              ))}
              {prep.length > MAX_TODOS && <p className="session-more">+ {prep.length - MAX_TODOS} weitere</p>}
            </div>
          )}
          <form
            className="session-add"
            onSubmit={(e) => {
              e.preventDefault()
              add()
            }}
          >
            <Plus size={14} />
            <input
              className="input sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Vorbereitung bis ${fmt(session.start, 'd. MMM')} …`}
              aria-label="Vorbereitungs-ToDo hinzufügen"
            />
          </form>
        </>
      )}
    </section>
  )
}

/** options: which calendar and title count as a session, which ToDos count as prep */
export function SessionCountdownSettings(): React.JSX.Element {
  const [cfg, update] = useSessionConfig()
  const data = useStore((s) => s.data!)
  return (
    <div className="widget-settings">
      <label>
        <span>Kalender</span>
        <select className="input sm" value={cfg.calendarId} onChange={(e) => update({ calendarId: e.target.value })}>
          <option value="">Alle Kalender</option>
          {data.calendars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Titel enthält</span>
        <input
          className="input sm"
          value={cfg.keyword}
          placeholder="beliebiger Titel"
          onChange={(e) => update({ keyword: e.target.value })}
        />
      </label>
      <label>
        <span>Prep-Kategorie</span>
        <select className="input sm" value={cfg.categoryId} onChange={(e) => update({ categoryId: e.target.value })}>
          <option value="">keine</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Prep-Liste</span>
        <select className="input sm" value={cfg.listId} onChange={(e) => update({ listId: e.target.value })}>
          <option value="">keine</option>
          {data.lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <p className="widget-settings-hint">
        Termine mit „Prep“ oder „Vorbereitung“ im Titel zählen nie als Session. Als Vorbereitung gelten offene ToDos aus
        Kategorie oder Liste, die bis zum Session-Tag fällig sind oder kein Datum haben.
      </p>
    </div>
  )
}
