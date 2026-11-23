import { useEffect, useMemo } from 'react'
import { CheckCheck, Keyboard } from 'lucide-react'
import type { Priority } from '@shared/types'
import { useStore } from '../store'
import { calVar } from '../lib/theme'
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
            <kbd>↓</kbd> wählen · <kbd>␣</kbd> erledigt · <kbd>Entf</kbd> löschen · <kbd>1</kbd>–<kbd>3</kbd> Priorität · Strg/Shift+Klick: mehrere
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
              {view === 'done' ? `${visible.length} erledigt` : `${openCount} offen`}
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

        {view !== 'done' && <QuickAdd />}
        <BulkBar ids={ordered} />

        <div className="todo-groups">
          {groups.length === 0 && (
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
      else if (/^[0-3]$/.test(k) && targets.length) st.updateTodos(targets, { priority: Number(k) as Priority }, 'Priorität geändert')
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
