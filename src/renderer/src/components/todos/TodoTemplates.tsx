import { useMemo, useState } from 'react'
import { ClipboardList, ListChecks, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { Difficulty, Priority, TodoTemplate } from '@shared/types'
import { listLabel, sortedLists } from '@shared/lists'
import { DIFFICULTY_LABEL } from '@shared/character'
import { inDaysLabel, sortTemplates } from '@shared/todoTemplates'
import { uid, useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { ESTIMATE_PRESETS, PRIORITY_LABEL, formatEstimate } from '../../lib/todos'

/** sidebar section on the ToDo page: one click makes a fresh ToDo from a template */
export function TodoTemplatesSection(): React.JSX.Element {
  const templates = useStore((s) => s.data!.todoTemplates)
  const lists = useStore((s) => s.data!.lists)
  const apply = useStore((s) => s.applyTodoTemplate)
  const selectTodo = useStore((s) => s.selectTodo)
  const [editing, setEditing] = useState<TodoTemplate | 'new' | null>(null)
  const sorted = useMemo(() => sortTemplates(templates), [templates])

  return (
    <div className="todo-templates">
      <div className="section-head">
        <span>Vorlagen</span>
        <button className="icon-btn sm" aria-label="ToDo-Vorlage anlegen" title="ToDo-Vorlage anlegen" onClick={() => setEditing('new')}>
          <Plus size={16} />
        </button>
      </div>
      {sorted.length === 0 && (
        <button className="goal-empty" onClick={() => setEditing('new')}>
          z. B. „Wohnung putzen“ mit Checkliste – immer wieder neu anlegen
        </button>
      )}
      {sorted.map((t) => {
        const list = lists.find((l) => l.id === t.listId)
        return (
          <div
            key={t.id}
            className="nav-row tpl-row"
            role="button"
            tabIndex={0}
            title={`Neues ToDo „${t.title || t.name}“ anlegen`}
            onClick={() => {
              const id = apply(t.id)
              if (id) selectTodo(id)
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const id = apply(t.id)
              if (id) selectTodo(id)
            }}
          >
            {list ? <i className="list-dot" style={{ background: calVar(list.color) }} /> : <ClipboardList size={15} />}
            <span>{t.name}</span>
            {t.subtasks.length > 0 && (
              <em title={`${t.subtasks.length} Punkte auf der Checkliste`}>
                <ListChecks size={11} /> {t.subtasks.length}
              </em>
            )}
            <Plus size={13} className="tpl-add" aria-hidden />
            <button
              className="icon-btn sm ghost-hover"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(t)
              }}
              aria-label={`Vorlage ${t.name} bearbeiten`}
            >
              <Pencil size={12} />
            </button>
          </div>
        )
      })}
      {editing && <TodoTemplateEditor template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const DAY_OPTIONS = [0, 1, 2, 3, 5, 7, 14, 30]

function DaysSelect({ value, onChange, label }: { value?: number; onChange(v: number | undefined): void; label: string }): React.JSX.Element {
  const options = value !== undefined && !DAY_OPTIONS.includes(value) ? [...DAY_OPTIONS, value].sort((a, b) => a - b) : DAY_OPTIONS
  return (
    <select
      className="input sm"
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    >
      <option value="">Keine</option>
      {options.map((d) => (
        <option key={d} value={d}>
          {inDaysLabel(d)}
        </option>
      ))}
    </select>
  )
}

/** create or edit a ToDo template */
export function TodoTemplateEditor({ template, onClose }: { template: TodoTemplate | null; onClose(): void }): React.JSX.Element {
  const data = useStore((s) => s.data!)
  const upsert = useStore((s) => s.upsertTodoTemplate)
  const remove = useStore((s) => s.removeTodoTemplate)
  const [draft, setDraft] = useState<TodoTemplate>(
    () =>
      template ?? {
        id: uid(),
        name: '',
        title: '',
        priority: 0,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
  )
  const [checklist, setChecklist] = useState(() => draft.subtasks.join('\n'))
  const set = (p: Partial<TodoTemplate>): void => setDraft((d) => ({ ...d, ...p }))
  const name = draft.name.trim() || draft.title.trim()

  const save = (): void => {
    if (!name) return
    upsert({
      ...draft,
      name,
      title: draft.title.trim() || name,
      subtasks: checklist
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    })
    onClose()
  }

  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="confirm-dialog goal-editor"
        role="dialog"
        aria-label={template ? 'ToDo-Vorlage bearbeiten' : 'ToDo-Vorlage anlegen'}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="confirm-head">
          <ClipboardList size={18} />
          <h2>{template ? 'ToDo-Vorlage bearbeiten' : 'Neue ToDo-Vorlage'}</h2>
          <span style={{ flex: 1 }} />
          <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Schließen">
            <X size={14} />
          </button>
        </div>
        <div className="goal-editor-grid">
          <label>Name</label>
          <input className="input sm" autoFocus value={draft.name} placeholder="z. B. Wohnung putzen" onChange={(e) => set({ name: e.target.value })} />
          <label>Titel</label>
          <input
            className="input sm"
            value={draft.title}
            placeholder={draft.name.trim() || 'wie der Name'}
            onChange={(e) => set({ title: e.target.value })}
          />
          <label>Checkliste</label>
          <textarea
            className="input sm tpl-checklist"
            rows={4}
            value={checklist}
            placeholder={'Ein Punkt pro Zeile, z. B.\nBad\nKüche\nStaubsaugen'}
            onChange={(e) => setChecklist(e.target.value)}
          />
          <label>Liste</label>
          <select className="input sm" value={draft.listId ?? ''} onChange={(e) => set({ listId: e.target.value || undefined })}>
            <option value="">Die gerade offene</option>
            {sortedLists(data.lists).map(({ list: l }) => (
              <option key={l.id} value={l.id}>
                {listLabel(data.lists, l)}
              </option>
            ))}
          </select>
          <label>Kategorie</label>
          <select className="input sm" value={draft.categoryId ?? ''} onChange={(e) => set({ categoryId: e.target.value || undefined })}>
            <option value="">Keine</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label>Priorität</label>
          <div className="segmented small">
            {PRIORITY_LABEL.map((label, p) => (
              <button type="button" key={label} className={draft.priority === p ? 'on' : ''} onClick={() => set({ priority: p as Priority })}>
                {label}
              </button>
            ))}
          </div>
          <label>Schwierigkeit</label>
          <div className="segmented small">
            {DIFFICULTY_LABEL.map((label, d) => (
              <button type="button" key={label} className={(draft.difficulty ?? 1) === d ? 'on' : ''} onClick={() => set({ difficulty: d as Difficulty })}>
                {label}
              </button>
            ))}
          </div>
          <label>Dauer</label>
          <select className="input sm" value={draft.estimateMin ?? ''} onChange={(e) => set({ estimateMin: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Keine Schätzung</option>
            {ESTIMATE_PRESETS.map((m) => (
              <option key={m} value={m}>
                {formatEstimate(m)}
              </option>
            ))}
          </select>
          <label>Wunschtag</label>
          <DaysSelect label="Wunschtag" value={draft.softInDays} onChange={(v) => set({ softInDays: v })} />
          <label>Deadline</label>
          <DaysSelect label="Harte Deadline" value={draft.hardInDays} onChange={(v) => set({ hardInDays: v })} />
        </div>
        <p className="widget-settings-hint">
          Ein Klick auf die Vorlage legt ein neues ToDo an – mit frischer Checkliste. Wunschtag und Deadline zählen ab dem Tag, an dem
          du es anlegst.
        </p>
        <div className="confirm-actions">
          {template && (
            <button
              type="button"
              className="btn btn-danger-outline sm"
              style={{ marginRight: 'auto' }}
              title="Schon angelegte ToDos bleiben"
              onClick={() => {
                remove(template.id)
                onClose()
              }}
            >
              <Trash2 size={13} /> Vorlage löschen
            </button>
          )}
          <button type="button" className="btn btn-ghost sm" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary sm" disabled={!name}>
            {template ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </form>
    </div>
  )
}
