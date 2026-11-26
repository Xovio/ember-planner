import { useMemo, useState } from 'react'
import { ClipboardList, CornerDownLeft, Flag, Hourglass, Plus, Repeat, Tag, Timer, List } from 'lucide-react'
import { CALENDAR_COLORS, type Todo } from '@shared/types'
import { uid, useStore } from '../../store'
import { parseQuickAdd, splitTemplate } from '../../lib/quickAdd'
import { recurrenceLabel } from '@shared/todo'
import { deadlineLabel, formatEstimate, PRIORITY_LABEL } from '../../lib/todos'

export function QuickAdd({ compact, autoFocus }: { compact?: boolean; autoFocus?: boolean }): React.JSX.Element {
  const data = useStore((s) => s.data!)
  const addTodo = useStore((s) => s.addTodo)
  const applyTemplate = useStore((s) => s.applyTodoTemplate)
  const upsertCategory = useStore((s) => s.upsertCategory)
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  // "/putzen bis Freitag": a ToDo template, the rest of the text adjusts it
  const { template, rest } = useMemo(() => splitTemplate(text, data.todoTemplates), [text, data.todoTemplates])
  const parsed = useMemo(() => parseQuickAdd(rest, data.categories, data.lists), [rest, data.categories, data.lists])
  const list = parsed.listId ? data.lists.find((l) => l.id === parsed.listId) : undefined
  const cat = parsed.categoryId ? data.categories.find((c) => c.id === parsed.categoryId) : undefined

  const submit = (): void => {
    if (template) {
      const o: Partial<Todo> = {}
      if (parsed.title) o.title = parsed.title
      if (parsed.hardDeadline) o.hardDeadline = parsed.hardDeadline
      if (parsed.softDeadline) o.softDeadline = parsed.softDeadline
      if (parsed.priority) o.priority = parsed.priority
      if (parsed.categoryId) o.categoryId = parsed.categoryId
      if (parsed.listId) o.listId = parsed.listId
      if (parsed.estimateMin) o.estimateMin = parsed.estimateMin
      applyTemplate(template.id, o)
      setText('')
      return
    }
    if (!parsed.title) return
    let categoryId = parsed.categoryId
    if (!categoryId && parsed.newCategory) {
      categoryId = uid()
      upsertCategory({
        id: categoryId,
        name: parsed.newCategory,
        color: CALENDAR_COLORS[data.categories.length % CALENDAR_COLORS.length]
      })
    }
    addTodo({
      title: parsed.title,
      hardDeadline: parsed.hardDeadline,
      softDeadline: parsed.softDeadline,
      priority: parsed.priority,
      categoryId,
      estimateMin: parsed.estimateMin,
        recurrence: parsed.recurrence,
      ...(parsed.listId ? { listId: parsed.listId } : {})
    })
    setText('')
  }

  const hasTokens =
    template ||
    parsed.hardDeadline || parsed.softDeadline || parsed.priority || cat || parsed.newCategory || list || parsed.estimateMin || parsed.recurrence

  return (
    <div className={`quickadd ${compact ? 'compact' : ''} ${focused ? 'focused' : ''}`}>
      <div className="quickadd-row">
        <Plus size={compact ? 15 : 17} className="quickadd-plus" />
        <input
          autoFocus={autoFocus}
          value={text}
          placeholder={compact ? 'ToDo hinzufügen …' : 'Neues ToDo, z. B. „Karte zeichnen bis Freitag ~Mittwoch #dnd !! 2h“'}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') {
              setText('')
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        {text && !compact && (
          <span className="quickadd-enter">
            <CornerDownLeft size={13} />
          </span>
        )}
      </div>
      {text && hasTokens && (
        <div className="quickadd-preview">
          {template && (
            <span className="qa-chip">
              <ClipboardList size={12} /> Vorlage: {template.name}
              {template.subtasks.length > 0 && ` · ${template.subtasks.length} Punkte`}
            </span>
          )}
          {parsed.hardDeadline && (
            <span className="qa-chip">
              <Flag size={12} /> hart: {deadlineLabel(parsed.hardDeadline)}
            </span>
          )}
          {parsed.softDeadline && (
            <span className="qa-chip">
              <Hourglass size={12} /> weich: {deadlineLabel(parsed.softDeadline)}
            </span>
          )}
          {parsed.priority > 0 && <span className="qa-chip">Priorität: {PRIORITY_LABEL[parsed.priority]}</span>}
          {(cat || parsed.newCategory) && (
            <span className="qa-chip">
              <Tag size={12} /> {cat?.name ?? `${parsed.newCategory} (neu)`}
            </span>
          )}
          {list && (
            <span className="qa-chip">
              <List size={12} /> {list.name}
            </span>
          )}
          {parsed.estimateMin && (
            <span className="qa-chip">
              <Timer size={12} /> {formatEstimate(parsed.estimateMin)}
            </span>
          )}
          {parsed.recurrence && (
            <span className="qa-chip">
              <Repeat size={12} /> {recurrenceLabel(parsed.recurrence)}
            </span>
          )}
        </div>
      )}
      {!compact && focused && !text && (
        <div className="quickadd-help">
          <code>bis Freitag</code> harte Deadline · <code>~Mittwoch</code> weiche · <code>#kategorie</code> ·{' '}
          <code>@liste</code> · <code>!</code>–<code>!!!</code> Priorität · <code>2h</code> Schätzung · auch{' '}
          <code>📅 2026-11-30</code>
          {data.todoTemplates.length > 0 && (
            <>
              {' '}
              · <code>/{data.todoTemplates[0].name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')}</code> Vorlage
            </>
          )}
        </div>
      )}
    </div>
  )
}
