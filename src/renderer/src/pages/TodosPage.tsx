import { useEffect, useMemo } from 'react'
import { Archive, CalendarDays, CheckCheck, Keyboard, Repeat, RotateCcw, Trash2, X } from 'lucide-react'
import { ARCHIVE_DAYS, TRASH_DAYS, type Priority } from '@shared/types'
import { useCalendarMap, useStore } from '../store'
import { calVar } from '../lib/theme'
import { fmt, toLocalTime } from '../lib/dates'
import { VIEW_LABELS, groupTodos, matchesView } from '../lib/todos'
import { QuickAdd } from '../components/todos/QuickAdd'
import { TodoItem } from '../components/todos/TodoItem'
import { BulkBar } from '../components/todos/BulkBar'
import { CategoriesSection, ListsSection, SmartViews } from '../components/todos/ListNav'
import { RightPanel } from '../components/RightPanel'

/** Organising view: all lists, grouped by deadline status, fully keyboard-operable. */
export function TodosPage(): React.JSX.Element {
  const data = useStore((s) => s.data!)
  const view = useStore((s) => s.todoView)
  const category = useStore((s) => s.todoCategory)
  const setCategory = useStore((s) => s.setTodoCategory)
  const selection = useStore((s) => s.selection)

  const visible = useMemo(
    () => data.todos.filter((t) => matchesView(t, view) && (!category || t.categoryId === category)),
    [data.todos, view, category]
  )
  const groups = useMemo(() => groupTodos(visible), [visible])
  const ordered = useMemo(() => groups.flatMap((g) => g.items.map((t) => t.id)), [groups])
  const isList = view.startsWith('list:')
  const list = isList ? data.lists.find((l) => l.id === view.slice(5)) : undefined
  const title = list?.name ?? VIEW_LABELS[view]
  const openCount = visible.filter((t) => !t.done).length
  const quiet = view === 'done' || view === 'archive' || view === 'trash'

  useListKeyboard(ordered)

  return (
    <div className="todos-page">
      <aside className="sidebar">
        <SmartViews />
        <ListsSection />
        <CategoriesSection />
        <div className="sidebar-foot">
          <div className="shortcut-hint wrap">
            <Keyboard size={13} /> <kbd>↑</kbd>
            <kbd>↓</kbd> wählen · <kbd>␣</kbd> erledigt · <kbd>Entf</kbd> Papierkorb · <kbd>1</kbd>–<kbd>3</kbd> Priorität
            · Strg/Shift+Klick: mehrere · <kbd>?</kbd> alle Kürzel
          </div>
        </div>
      </aside>

      <section className="todos-main">
        <header className="todos-head">
          <div>
            <h1>
              {list && <i className="list-dot" style={{ background: calVar(list.color) }} />}
              {title}
            </h1>
            <p className="muted">
              {view === 'trash'
                ? `${data.trash.length + data.eventTrash.filter((e) => !e.seriesId).length} gelöscht · wird nach ${TRASH_DAYS} Tagen endgültig entfernt`
                : view === 'archive'
                  ? `${visible.length} archiviert · erledigte ToDos wandern nach ${ARCHIVE_DAYS} Tagen hierher`
                  : view === 'done'
                    ? `${visible.length} erledigt`
                    : `${openCount} offen`}
              {category && (
                <>
                  {' '}
                  · gefiltert nach <strong>{data.categories.find((c) => c.id === category)?.name}</strong>{' '}
                  <button className="link-btn" onClick={() => setCategory(null)}>
                    Filter aufheben
                  </button>
                </>
              )}
            </p>
          </div>
        </header>

        {!quiet && <QuickAdd />}
        {view === 'trash' ? (
          <TrashList />
        ) : (
          <>
            <BulkBar ids={ordered} />

            <div className="todo-groups">
              {groups.length === 0 && view === 'archive' && (
                <div className="empty-state">
                  <Archive size={34} strokeWidth={1.4} />
                  <h3>Archiv ist leer</h3>
                  <p>Erledigte ToDos landen nach {ARCHIVE_DAYS} Tagen hier.</p>
                </div>
              )}
              {groups.length === 0 && view !== 'archive' && (
                <div className="empty-state">
                  <CheckCheck size={34} strokeWidth={1.4} />
                  <h3>{view === 'done' ? 'Noch nichts erledigt' : 'Alles erledigt'}</h3>
                  <p>{view === 'done' ? 'Abgehakte ToDos erscheinen hier.' : 'Hier ist gerade nichts offen.'}</p>
                </div>
              )}
              {groups.map((g) => (
                <section key={g.id} className={`todo-group g-${g.id}`}>
                  <h2>
                    {g.label}
                    <span>{g.items.length}</span>
                  </h2>
                  <div className="todo-list">
                    {g.items.map((t) => (
                      <TodoItem key={t.id} todo={t} showList={!isList} draggable orderedIds={ordered} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </section>

      {selection && <RightPanel tabs={false} />}
    </div>
  )
}

/** ↑/↓ (j/k) move, Shift extends, Space toggles, Entf deletes, 0–3 priority, Enter opens. */
function useListKeyboard(ordered: string[]): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"], .popover, .ctx-menu')) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const st = useStore.getState()
      if (st.overlay) return
      const current = st.selection?.kind === 'todo' ? st.selection.id : null
      const targets = st.picked.length ? st.picked : current ? [current] : []
      const k = e.key

      const move = (dir: 1 | -1): void => {
        if (!ordered.length) return
        const idx = current ? ordered.indexOf(current) : -1
        const next = ordered[Math.min(ordered.length - 1, Math.max(0, idx + dir))] ?? ordered[0]
        if (e.shiftKey) {
          const base = st.picked.length ? st.picked : current ? [current] : []
          st.setPicked(base.includes(next) ? base : [...base, next])
        } else st.setPicked([])
        st.selectTodo(next)
        document.querySelector(`[data-todo-id="${next}"]`)?.scrollIntoView({ block: 'nearest' })
      }

      let handled = true
      if (k === 'ArrowDown' || k === 'j') move(1)
      else if (k === 'ArrowUp' || k === 'k') move(-1)
      else if (k === ' ' && targets.length) {
        const todos = st.data!.todos.filter((x) => targets.includes(x.id))
        st.toggleTodos(targets, !todos.every((x) => x.done))
      } else if ((k === 'Delete' || k === 'Backspace') && targets.length) st.deleteTodos(targets)
      else if (/^[0-3]$/.test(k) && targets.length)
        st.updateTodos(targets, { priority: Number(k) as Priority }, 'Priorität geändert')
      else handled = false

      if (handled) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [ordered])
}

/** Papierkorb for events and ToDos: restore or remove for good – both undoable with Strg+Z. */
function TrashList(): React.JSX.Element {
  const trash = useStore((s) => s.data!.trash)
  const allEvents = useStore((s) => s.data!.eventTrash)
  const lists = useStore((s) => s.data!.lists)
  const calendars = useCalendarMap()
  const restore = useStore((s) => s.restoreTodos)
  const purge = useStore((s) => s.purgeTodos)
  const restoreEvents = useStore((s) => s.restoreEvents)
  const purgeEvents = useStore((s) => s.purgeEvents)
  // changed occurrences of a deleted series come back with it
  const events = useMemo(() => allEvents.filter((e) => !e.seriesId), [allEvents])

  if (trash.length === 0 && events.length === 0) {
    return (
      <div className="empty-state">
        <Trash2 size={34} strokeWidth={1.4} />
        <h3>Papierkorb ist leer</h3>
        <p>Gelöschte Termine und ToDos bleiben {TRASH_DAYS} Tage hier und lassen sich wiederherstellen.</p>
      </div>
    )
  }

  const expiry = (deletedAt?: string): { deleted: Date; expires: Date } => {
    const deleted = deletedAt ? new Date(deletedAt) : new Date()
    return { deleted, expires: new Date(deleted.getTime() + TRASH_DAYS * 86400000) }
  }

  return (
    <div className="trash">
      <div className="trash-bar">
        <button
          className="btn btn-ghost sm"
          onClick={() => {
            if (events.length) restoreEvents(events.map((e) => e.id))
            if (trash.length) restore(trash.map((t) => t.id))
          }}
        >
          <RotateCcw size={14} /> Alle wiederherstellen
        </button>
        <button
          className="btn btn-ghost sm danger-text"
          onClick={() => {
            if (events.length) purgeEvents('all')
            if (trash.length) purge('all')
          }}
        >
          <Trash2 size={14} /> Papierkorb leeren
        </button>
      </div>

      {events.length > 0 && (
        <section>
          <h2 className="trash-heading">Termine</h2>
          <div className="todo-list">
            {events.map((e) => {
              const { deleted, expires } = expiry(e.deletedAt)
              const start = new Date(e.start)
              const cal = calendars.get(e.calendarId)
              return (
                <div className="trash-row" key={e.id}>
                  <CalendarDays size={15} className="trash-icon" />
                  <div className="todo-main">
                    <span className="todo-title">
                      {e.title || '(Ohne Titel)'} {e.recurrence && <Repeat size={12} aria-label="Serie" />}
                    </span>
                    <div className="todo-meta">
                      <span className="meta-plain">
                        {fmt(start, 'EEE d. MMM yyyy')}
                        {!e.allDay && `, ${toLocalTime(start)}`} · {cal?.name ?? 'Kalender gelöscht'} · gelöscht{' '}
                        {fmt(deleted, "d. MMM 'um' HH:mm")} · entfernt am {fmt(expires, 'd. MMM')}
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-ghost sm" onClick={() => restoreEvents([e.id])}>
                    <RotateCcw size={14} /> Wiederherstellen
                  </button>
                  <button
                    className="icon-btn sm danger"
                    title="Endgültig löschen"
                    aria-label="Endgültig löschen"
                    onClick={() => purgeEvents([e.id])}
                  >
                    <X size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {trash.length > 0 && (
        <section>
          {events.length > 0 && <h2 className="trash-heading">ToDos</h2>}
          <div className="todo-list">
            {trash.map((t) => {
              const list = lists.find((l) => l.id === t.listId)
              const { deleted, expires } = expiry(t.deletedAt)
              return (
                <div className="trash-row" key={t.id}>
                  <Trash2 size={15} className="trash-icon" />
                  <div className="todo-main">
                    <span className={`todo-title ${t.done ? 'is-done' : ''}`}>{t.title || '(Ohne Titel)'}</span>
                    <div className="todo-meta">
                      <span className="meta-plain">
                        gelöscht {fmt(deleted, "d. MMM 'um' HH:mm")} · {list?.name ?? 'Eingang'} · entfernt am{' '}
                        {fmt(expires, 'd. MMM')}
                      </span>
                    </div>
                  </div>
                  <button className="btn btn-ghost sm" onClick={() => restore([t.id])}>
                    <RotateCcw size={14} /> Wiederherstellen
                  </button>
                  <button
                    className="icon-btn sm danger"
                    title="Endgültig löschen"
                    aria-label="Endgültig löschen"
                    onClick={() => purge([t.id])}
                  >
                    <X size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
