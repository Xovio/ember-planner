import { useMemo } from 'react'
import { GripVertical, X } from 'lucide-react'
import { compareTodos, deadlineStatus } from '@shared/todo'
import { useStore } from '../../store'
import { VIEW_LABELS, matchesView } from '../../lib/todos'
import { QuickAdd } from './QuickAdd'
import { TodoItem } from './TodoItem'
import { BulkBar } from './BulkBar'

/** ToDo tab of the right panel: filtered by the list/category picked in the left sidebar, draggable into the grid. */
export function TodoPanel(): React.JSX.Element {
  const all = useStore((s) => s.data!.todos)
  const lists = useStore((s) => s.data!.lists)
  const categories = useStore((s) => s.data!.categories)
  const view = useStore((s) => s.todoView)
  const category = useStore((s) => s.todoCategory)
  const setView = useStore((s) => s.setTodoView)
  const setCategory = useStore((s) => s.setTodoCategory)

  const todos = useMemo(
    () => all.filter((t) => matchesView(t, view) && (!category || t.categoryId === category)).sort(compareTodos),
    [all, view, category]
  )
  const overdue = todos.filter((t) => !t.done && deadlineStatus(t) === 'overdue').length
  const listName = view.startsWith('list:') ? lists.find((l) => l.id === view.slice(5))?.name : VIEW_LABELS[view]
  const catName = category ? categories.find((c) => c.id === category)?.name : undefined
  const filtered = view !== 'open' || !!category

  return (
    <div className="todo-panel">
      <div className="todo-panel-head">
        <div>
          <h3>
            {listName}
            {catName && <span className="muted"> · {catName}</span>}
          </h3>
          <p>
            {todos.filter((t) => !t.done).length} offen
            {overdue > 0 && <span className="overdue-count"> · {overdue} überfällig</span>}
          </p>
        </div>
        {filtered && (
          <button
            className="btn btn-ghost sm"
            onClick={() => {
              setView('open')
              setCategory(null)
            }}
            title="Filter zurücksetzen"
          >
            <X size={13} /> Filter
          </button>
        )}
      </div>
      <QuickAdd compact />
      <BulkBar ids={todos.map((t) => t.id)} />
      <div className="todo-panel-list">
        {todos.length === 0 ? (
          <p className="empty-mini">Nichts in dieser Auswahl.</p>
        ) : (
          todos.map((t) => <TodoItem key={t.id} todo={t} compact draggable orderedIds={todos.map((x) => x.id)} />)
        )}
      </div>
      <div className="todo-panel-foot">
        <span>
          <GripVertical size={13} /> Ins Raster ziehen = einplanen · in den Monat = Wunschtag
        </span>
      </div>
    </div>
  )
}
