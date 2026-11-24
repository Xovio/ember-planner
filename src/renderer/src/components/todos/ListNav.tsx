import { useMemo, useState } from 'react'
import { AlertTriangle, Archive, CalendarRange, CheckCheck, CircleDashed, Inbox, Layers, Pencil, Plus, Sun, Trash2 } from 'lucide-react'
import { CALENDAR_COLORS, INBOX_ID, type Category, type TodoList } from '@shared/types'
import { uid, useStore, type TodoView } from '../../store'
import { calVar } from '../../lib/theme'
import { TODO_MIME, todoDrag } from '../../lib/dnd'
import { VIEW_LABELS, matchesView } from '../../lib/todos'
import { NameColorForm } from '../NameColorForm'

export const SMART_VIEWS: { id: TodoView; icon: typeof Inbox }[] = [
  { id: 'open', icon: Layers },
  { id: 'today', icon: Sun },
  { id: 'week', icon: CalendarRange },
  { id: 'overdue', icon: AlertTriangle },
  { id: 'nodate', icon: CircleDashed },
  { id: 'done', icon: CheckCheck },
  { id: 'archive', icon: Archive },
  { id: 'trash', icon: Trash2 }
]

/** archive and trash only on the ToDo page, below a divider */
const QUIET_VIEWS: TodoView[] = ['archive', 'trash']

export function useTodoCounts(): Record<string, number> {
  const todos = useStore((s) => s.data!.todos)
  const trash = useStore((s) => s.data!.trash)
  // changed occurrences travel with their series and are not counted on their own
  const eventTrash = useStore((s) => s.data!.eventTrash.filter((e) => !e.seriesId).length)
  const lists = useStore((s) => s.data!.lists)
  return useMemo(() => {
    const c: Record<string, number> = {}
    for (const v of SMART_VIEWS) c[v.id] = todos.filter((t) => matchesView(t, v.id)).length
    c.trash = trash.length + eventTrash
    for (const l of lists) c[`list:${l.id}`] = todos.filter((t) => t.listId === l.id && !t.done).length
    return c
  }, [todos, trash, eventTrash, lists])
}

export function SmartViews({ only, onPick }: { only?: TodoView[]; onPick?: () => void }): React.JSX.Element {
  const view = useStore((s) => s.todoView)
  const setView = useStore((s) => s.setTodoView)
  const counts = useTodoCounts()
  return (
    <nav className="smart-views">
      {SMART_VIEWS.filter((v) => !only || only.includes(v.id)).map(({ id, icon: Icon }) => (
        <button
          key={id}
          className={`nav-row ${view === id ? 'on' : ''} ${id === 'overdue' && counts[id] ? 'alert' : ''} ${
            id === QUIET_VIEWS[0] ? 'nav-divided' : ''
          } ${QUIET_VIEWS.includes(id) ? 'quiet' : ''}`}
          onClick={() => {
            setView(id)
            onPick?.()
          }}
        >
          <Icon size={16} />
          <span>{VIEW_LABELS[id]}</span>
          {counts[id] > 0 && <em>{counts[id]}</em>}
        </button>
      ))}
    </nav>
  )
}

/** User lists; ToDos can be dropped onto a list to move them. */
export function ListsSection({ onPick }: { onPick?: () => void }): React.JSX.Element {
  const lists = useStore((s) => s.data!.lists)
  const view = useStore((s) => s.todoView)
  const setView = useStore((s) => s.setTodoView)
  const upsert = useStore((s) => s.upsertList)
  const remove = useStore((s) => s.removeList)
  const updateTodos = useStore((s) => s.updateTodos)
  const picked = useStore((s) => s.picked)
  const counts = useTodoCounts()
  const [editing, setEditing] = useState<TodoList | null>(null)
  const [dropOn, setDropOn] = useState<string | null>(null)

  return (
    <div>
      <div className="section-head">
        <span>Listen</span>
        <button
          className="icon-btn sm"
          aria-label="Liste hinzufügen"
          title="Liste hinzufügen"
          onClick={() => setEditing({ id: uid(), name: '', color: CALENDAR_COLORS[lists.length % CALENDAR_COLORS.length] })}
        >
          <Plus size={16} />
        </button>
      </div>
      {lists.map((l) =>
        editing?.id === l.id ? (
          <NameColorForm
            key={l.id}
            name={l.name}
            color={l.color}
            placeholder="Name der Liste"
            onCancel={() => setEditing(null)}
            onSave={(name, color) => {
              upsert({ ...l, name, color })
              setEditing(null)
            }}
            onDelete={l.id === INBOX_ID ? undefined : () => (remove(l.id), setEditing(null))}
          />
        ) : (
          <div
            key={l.id}
            className={`nav-row ${view === `list:${l.id}` ? 'on' : ''} ${dropOn === l.id ? 'drop' : ''}`}
            onClick={() => {
              setView(`list:${l.id}`)
              onPick?.()
            }}
            role="button"
            tabIndex={0}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(TODO_MIME)) return
              e.preventDefault()
              setDropOn(l.id)
            }}
            onDragLeave={() => setDropOn(null)}
            onDrop={(e) => {
              setDropOn(null)
              const id = e.dataTransfer.getData(TODO_MIME) || todoDrag.id
              if (!id) return
              const ids = picked.includes(id) ? picked : [id]
              updateTodos(ids, { listId: l.id }, `${ids.length > 1 ? `${ids.length} ToDos` : 'ToDo'} nach „${l.name}“ verschoben`)
            }}
          >
            {l.id === INBOX_ID ? <Inbox size={16} /> : <i className="list-dot" style={{ background: calVar(l.color) }} />}
            <span>{l.name}</span>
            {counts[`list:${l.id}`] > 0 && <em>{counts[`list:${l.id}`]}</em>}
            <button
              className="icon-btn sm ghost-hover"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(l)
              }}
              aria-label="Liste bearbeiten"
            >
              <Pencil size={12} />
            </button>
          </div>
        )
      )}
      {editing && !lists.some((l) => l.id === editing.id) && (
        <NameColorForm
          name=""
          color={editing.color}
          placeholder="Name der Liste"
          onCancel={() => setEditing(null)}
          onSave={(name, color) => {
            upsert({ ...editing, name, color })
            setEditing(null)
            setView(`list:${editing.id}`)
          }}
        />
      )}
    </div>
  )
}

export function CategoriesSection(): React.JSX.Element {
  const categories = useStore((s) => s.data!.categories)
  const active = useStore((s) => s.todoCategory)
  const onPick = useStore((s) => s.setTodoCategory)
  const upsert = useStore((s) => s.upsertCategory)
  const remove = useStore((s) => s.removeCategory)
  const [editing, setEditing] = useState<Category | null>(null)

  return (
    <div>
      <div className="section-head">
        <span>Kategorien</span>
        <button
          className="icon-btn sm"
          aria-label="Kategorie hinzufügen"
          title="Kategorie hinzufügen"
          onClick={() => setEditing({ id: uid(), name: '', color: CALENDAR_COLORS[categories.length % CALENDAR_COLORS.length] })}
        >
          <Plus size={16} />
        </button>
      </div>
      {editing ? (
        <NameColorForm
          name={editing.name}
          color={editing.color}
          placeholder="Name der Kategorie"
          onCancel={() => setEditing(null)}
          onSave={(name, color) => {
            upsert({ ...editing, name, color })
            setEditing(null)
          }}
          onDelete={categories.some((c) => c.id === editing.id) ? () => (remove(editing.id), setEditing(null)) : undefined}
        />
      ) : (
        <div className="cat-cloud">
          {categories.map((c) => (
            <button
              key={c.id}
              className={`cat-tag big ${active === c.id ? 'on' : ''}`}
              style={{ '--c': calVar(c.color) } as React.CSSProperties}
              onClick={() => onPick(active === c.id ? null : c.id)}
              onDoubleClick={() => setEditing(c)}
              onContextMenu={(e) => {
                e.preventDefault()
                setEditing(c)
              }}
              title="Klick: filtern · Doppel-/Rechtsklick: bearbeiten"
            >
              <i />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
