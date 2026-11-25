import { CalendarClock, Check, Flag, RotateCw, Hourglass, ListChecks, MoreHorizontal, Sun, Sunrise, CalendarArrowUp, Repeat, Timer } from 'lucide-react'
import type { Todo } from '@shared/types'
import { deadlineStatus, localDate, recurrenceLabel } from '@shared/todo'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { deadlineLabel, formatEstimate, useCategoryMap, useCooldown, useListMap } from '../../lib/todos'
import { cooldownLabel, formatLeft } from '@shared/repeatable'
import { fmt } from '../../lib/dates'
import { TODO_MIME, todoDrag } from '../../lib/dnd'
import { dayPresets, todoMenu } from '../../lib/menus'

export const DEADLINE_MIME = 'application/x-deadline'

export function TodoCheck({ todo, size = 18 }: { todo: Todo; size?: number }): React.JSX.Element {
  const toggle = useStore((s) => s.toggleTodo)
  const left = useCooldown(todo)
  // a repeatable ToDo shows as ticked off while it cools down
  const checked = todo.done || left > 0
  const label = todo.repeatable
    ? left > 0
      ? `Wieder in ${formatLeft(left)} – klicken nimmt das letzte Abhaken zurück`
      : 'Erledigt (wiederholbar)'
    : todo.done
      ? 'Als offen markieren'
      : 'Erledigt'
  return (
    <button
      className={`todo-check p${todo.priority} ${checked ? 'done' : ''} ${todo.repeatable ? 'repeatable' : ''}`}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation()
        toggle(todo.id)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      title={todo.repeatable ? label : undefined}
      aria-pressed={checked}
    >
      <Check size={size - 6} strokeWidth={3.2} />
    </button>
  )
}

/** „3×“ and, while cooling down, when it can be ticked off again */
function RepeatBadge({ todo }: { todo: Todo }): React.JSX.Element {
  const left = useCooldown(todo)
  const n = todo.repeatable!.completions.length
  const tip = `Beliebig oft abhakbar · Abklingzeit ${cooldownLabel(todo.repeatable!.cooldownMin)} · ${n}× erledigt`
  return (
    <span className={`meta-plain repeat-badge ${left > 0 ? 'cooling' : ''}`} title={tip} aria-label={tip}>
      <RotateCw size={12} /> {n > 0 && `${n}×`}
      {left > 0 && <span> · wieder in {formatLeft(left)}</span>}
    </span>
  )
}

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return localDate(d)
}

/** the single deadline worth showing first */
function primaryDeadline(t: Todo): 'hard' | 'soft' | null {
  if (!t.hardDeadline && !t.softDeadline) return null
  if (!t.softDeadline) return 'hard'
  if (!t.hardDeadline) return 'soft'
  const st = deadlineStatus(t)
  if (st === 'overdue') return 'hard'
  if (st === 'soft-missed') return 'soft'
  return t.softDeadline <= t.hardDeadline ? 'soft' : 'hard'
}

/** One deadline badge; status shown by icon + text, never color alone. */
export function DeadlineBadge({ todo, kind, compact }: { todo: Todo; kind: 'hard' | 'soft'; compact?: boolean }): React.JSX.Element | null {
  const date = kind === 'hard' ? todo.hardDeadline : todo.softDeadline
  if (!date) return null
  const status = todo.done ? 'later' : deadlineStatus(todo)
  const crit = kind === 'hard' && status === 'overdue'
  const warn = (kind === 'soft' && status === 'soft-missed') || (kind === 'hard' && !crit && date <= tomorrow() && !todo.done)
  return (
    <span className={`dl-badge ${kind} ${crit ? 'crit' : ''} ${warn ? 'warn' : ''}`} title={`${kind === 'hard' ? 'Harte' : 'Weiche'} Deadline: ${date}`}>
      {kind === 'hard' ? <Flag size={12} /> : <Hourglass size={12} />}
      {!compact && <span className="dl-kind">{kind === 'hard' ? 'hart' : 'weich'}</span>}
      {deadlineLabel(date)}
    </span>
  )
}

let rangeAnchor: string | null = null

export function TodoItem({
  todo,
  showList,
  compact,
  draggable,
  orderedIds
}: {
  todo: Todo
  showList?: boolean
  compact?: boolean
  draggable?: boolean
  /** visible order, for Shift+click range selection */
  orderedIds?: string[]
}): React.JSX.Element {
  const selected = useStore((s) => s.selection?.kind === 'todo' && s.selection.id === todo.id)
  const picked = useStore((s) => s.picked.includes(todo.id))
  const event = useStore((s) => (todo.linkedEventId ? s.data?.events.find((e) => e.id === todo.linkedEventId) : undefined))
  const categories = useCategoryMap()
  const lists = useListMap()
  const cat = todo.categoryId ? categories.get(todo.categoryId) : undefined
  const list = lists.get(todo.listId)
  const subDone = todo.subtasks.filter((s) => s.done).length
  const primary = primaryDeadline(todo)
  const secondary = primary === 'hard' ? 'soft' : primary === 'soft' ? 'hard' : null

  const onClick = (e: React.MouseEvent): void => {
    const st = useStore.getState()
    if (e.ctrlKey || e.metaKey) {
      const base = st.picked.length ? st.picked : st.selection?.kind === 'todo' ? [st.selection.id] : []
      st.setPicked(base.includes(todo.id) ? base.filter((x) => x !== todo.id) : [...base, todo.id])
      rangeAnchor = todo.id
      return
    }
    if (e.shiftKey && orderedIds && rangeAnchor && orderedIds.includes(rangeAnchor)) {
      const a = orderedIds.indexOf(rangeAnchor)
      const b = orderedIds.indexOf(todo.id)
      st.setPicked(orderedIds.slice(Math.min(a, b), Math.max(a, b) + 1))
      return
    }
    rangeAnchor = todo.id
    st.setPicked([])
    st.selectTodo(todo.id)
  }

  const quick = (date: string, label: string): void =>
    useStore.getState().updateTodos([todo.id], { softDeadline: date }, `Wunschtag ${label}: „${todo.title}“`)
  const presets = dayPresets()
  const cooling = useCooldown(todo) > 0

  return (
    <div
      className={`todo-item ${compact ? 'compact' : ''} ${todo.done ? 'is-done' : ''} ${cooling ? 'is-cooling' : ''} ${selected ? 'selected' : ''} ${picked ? 'picked' : ''}`}
      data-todo-id={todo.id}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        const st = useStore.getState()
        const ids = st.picked.includes(todo.id) ? st.picked : [todo.id]
        st.openMenu(e.clientX, e.clientY, todoMenu(ids))
      }}
      draggable={draggable && !todo.done}
      onDragStart={(e) => {
        e.dataTransfer.setData(TODO_MIME, todo.id)
        e.dataTransfer.setData('text/plain', todo.title)
        e.dataTransfer.effectAllowed = 'copyMove'
        todoDrag.id = todo.id
        document.body.classList.add('dragging-todo')
      }}
      onDragEnd={() => {
        todoDrag.id = null
        document.body.classList.remove('dragging-todo')
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') useStore.getState().selectTodo(todo.id)
      }}
    >
      <TodoCheck todo={todo} size={compact ? 16 : 18} />
      <div className="todo-main">
        <span className="todo-title">{todo.title || '(Ohne Titel)'}</span>
        <div className="todo-meta">
          {primary && <DeadlineBadge todo={todo} kind={primary} compact={compact} />}
          {cat && (
            <span className="cat-tag" style={{ '--c': calVar(cat.color) } as React.CSSProperties}>
              <i />
              {cat.name}
            </span>
          )}
          {todo.repeatable && <RepeatBadge todo={todo} />}
          {todo.recurrence && (
            <span className="meta-plain" title={recurrenceLabel(todo.recurrence)} aria-label={recurrenceLabel(todo.recurrence)}>
              <Repeat size={12} />
            </span>
          )}
          {event && (
            <span className="meta-plain scheduled" title="Im Kalender eingeplant">
              <CalendarClock size={12} /> {fmt(new Date(event.start), 'EEE HH:mm')}
            </span>
          )}
          <span className="todo-meta-extra">
            {secondary && <DeadlineBadge todo={todo} kind={secondary} compact={compact} />}
            {todo.subtasks.length > 0 && (
              <span className="meta-plain">
                <ListChecks size={12} /> {subDone}/{todo.subtasks.length}
              </span>
            )}
            {todo.estimateMin ? (
              <span className="meta-plain">
                <Timer size={12} /> {formatEstimate(todo.estimateMin)}
              </span>
            ) : null}
            {showList && list && <span className="meta-plain list-name">{list.name}</span>}
          </span>
        </div>
      </div>
      {!todo.done && (
        <div className="todo-actions" onClick={(e) => e.stopPropagation()}>
          <button title="Wunschtag: heute" onClick={() => quick(presets[0].date, 'heute')}>
            <Sun size={14} />
          </button>
          <button title="Wunschtag: morgen" onClick={() => quick(presets[1].date, 'morgen')}>
            <Sunrise size={14} />
          </button>
          <button title="Wunschtag: nächste Woche" onClick={() => quick(presets[3].date, 'nächste Woche')}>
            <CalendarArrowUp size={14} />
          </button>
          <button
            title="Mehr Aktionen"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              const st = useStore.getState()
              const ids = st.picked.includes(todo.id) ? st.picked : [todo.id]
              st.openMenu(r.left, r.bottom + 4, todoMenu(ids))
            }}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

/** Deadline marker shown inside calendar views; drag it to another day to move the deadline. */
export function DeadlineChip({ todo, kind }: { todo: Todo; kind: 'hard' | 'soft' }): React.JSX.Element {
  const selectTodo = useStore((s) => s.selectTodo)
  const categories = useCategoryMap()
  const cat = todo.categoryId ? categories.get(todo.categoryId) : undefined
  return (
    <button
      className={`chip chip-deadline ${kind}`}
      style={{ '--c': calVar(cat?.color ?? 'red') } as React.CSSProperties}
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.setData(DEADLINE_MIME, `${todo.id}|${kind}`)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={(e) => {
        e.stopPropagation()
        selectTodo(todo.id)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        useStore.getState().openMenu(e.clientX, e.clientY, todoMenu([todo.id]))
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      title={`${kind === 'hard' ? 'Harte' : 'Weiche'} Deadline: ${todo.title} – ziehen zum Verschieben`}
    >
      {kind === 'hard' ? <Flag size={11} /> : <Hourglass size={11} />}
      <span className="chip-title">{todo.title}</span>
    </button>
  )
}
