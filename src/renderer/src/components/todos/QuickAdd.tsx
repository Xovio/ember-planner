import { useMemo, useState } from 'react'
import { CornerDownLeft, Flag, Hourglass, Plus, Repeat, Tag, Timer, List } from 'lucide-react'
import { CALENDAR_COLORS } from '@shared/types'
import { uid, useStore } from '../../store'
import { parseQuickAdd } from '../../lib/quickAdd'
import { recurrenceLabel } from '@shared/todo'
import { deadlineLabel, formatEstimate, PRIORITY_LABEL } from '../../lib/todos'

export function QuickAdd({ compact, autoFocus }: { compact?: boolean; autoFocus?: boolean }): React.JSX.Element {
  const data = useStore((s) => s.data!)
  const addTodo = useStore((s) => s.addTodo)
  const upsertCategory = useStore((s) => s.upsertCategory)
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  const parsed = useMemo(() => parseQuickAdd(text, data.categories, data.lists), [text, data.categories, data.lists])
  const list = parsed.listId ? data.lists.find((l) => l.id === parsed.listId) : undefined
  const cat = parsed.categoryId ? data.categories.find((c) => c.id === parsed.categoryId) : undefined

  const submit = (): void => {
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
        </div>
      )}
    </div>
  )
}
