import { useState } from 'react'
import { addDays, addMinutes } from 'date-fns'
import { AlignLeft, CalendarClock, Coins, Copy, Flag, Hourglass, List, ListChecks, Plus, Repeat, Signal, Tag, Timer, Trash2, X } from 'lucide-react'
import type { Difficulty, Priority, Recurrence, RecurrenceFreq, Todo } from '@shared/types'
import { DIFFICULTY_LABEL, todoMinutes, todoReward } from '@shared/character'
import { localDate, nextRecurrence, parseLocalDate, toTasksLine } from '@shared/todo'
import { roundUp, uid, useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { ESTIMATE_PRESETS, PRIORITY_LABEL, formatEstimate } from '../../lib/todos'
import { WEEKDAY_SHORT, fmt, fromLocal, toLocalTime } from '../../lib/dates'
import { TodoCheck } from '../todos/TodoItem'
import { DatePicker } from '../ui/DatePicker'
import { COOLDOWN_OPTIONS, cooldownLabel, formatLeft, lastCompletion, makeRepeatable } from '@shared/repeatable'
import { useCooldown } from '../../lib/todos'

/** ToDo editor inside the right panel. Every change saves immediately and is undoable. */
export function TodoDetails({ id }: { id: string }): React.JSX.Element {
  const todo = useStore((s) => s.data?.todos.find((t) => t.id === id))
  const data = useStore((s) => s.data!)
  const update = useStore((s) => s.updateTodo)
  const del = useStore((s) => s.deleteTodos)
  const schedule = useStore((s) => s.scheduleTodo)
  const selectEvent = useStore((s) => s.selectEvent)
  const setPage = useStore((s) => s.setPage)
  const setCursor = useStore((s) => s.setCursor)
  const clear = useStore((s) => s.clearSelection)

  const [newSub, setNewSub] = useState('')
  const [copied, setCopied] = useState(false)
  const [planDate, setPlanDate] = useState(() => localDate(new Date()))
  const [planTime, setPlanTime] = useState(() => toLocalTime(roundUp(new Date())))

  if (!todo) return <p className="empty-mini">Dieses ToDo existiert nicht mehr.</p>
  const set = (patch: Partial<Todo>, coalesce?: string): void => update(todo.id, patch, coalesce)
  const event = todo.linkedEventId ? data.events.find((e) => e.id === todo.linkedEventId) : undefined
  const softAfterHard = todo.softDeadline && todo.hardDeadline && todo.softDeadline > todo.hardDeadline
  const tasksLine = toTasksLine(todo, data.categories)
  const list = data.lists.find((l) => l.id === todo.listId)

  return (
    <div className="details" style={{ '--c': calVar(list?.color ?? 'red') } as React.CSSProperties}>
      <div className="details-accent" />
      <div className="details-toolbar">
        <span className="drawer-kicker">ToDo · {list?.name}</span>
        <span style={{ flex: 1 }} />
        <button className="icon-btn sm danger" title="In den Papierkorb (Entf)" onClick={() => del([todo.id])}>
          <Trash2 size={14} />
        </button>
        <button className="icon-btn sm" onClick={clear} title="Schließen (Esc)" aria-label="Schließen">
          <X size={15} />
        </button>
      </div>

      <div className="details-body">
        <div className="todo-title-row">
          <TodoCheck todo={todo} size={22} />
          <textarea
            className={`title-input todo-title-input ${todo.done ? 'is-done' : ''}`}
            value={todo.title}
            rows={1}
            autoFocus={!todo.title}
            placeholder="Was ist zu tun?"
            onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') }, 'title')}
          />
        </div>

        <div className="field">
          <Flag size={16} className="field-icon" />
          <div className="field-stack">
            <div className="deadline-grid">
              <label>
                <span className="dl-label hard">
                  <Flag size={12} /> Harte Deadline
                </span>
                <DatePicker value={todo.hardDeadline} onChange={(v) => set({ hardDeadline: v })} clearable placeholder="Keine" icon={<Flag size={13} />} />
              </label>
              <label>
                <span className="dl-label soft">
                  <Hourglass size={12} /> Weiche Deadline
                </span>
                <DatePicker value={todo.softDeadline} onChange={(v) => set({ softDeadline: v })} clearable placeholder="Keine" icon={<Hourglass size={13} />} />
              </label>
            </div>
            <span className={softAfterHard ? 'field-error' : 'field-hint'}>
              {softAfterHard ? 'Die weiche Deadline liegt nach der harten.' : 'Weich = Wunschtag, hart = muss fertig sein.'}
            </span>
          </div>
        </div>

        <TodoRepeat todo={todo} set={(patch) => set(patch, 'rec')} />

        <div className="field">
          <Signal size={16} className="field-icon" />
          <div className="segmented small">
            {PRIORITY_LABEL.map((label, p) => (
              <button key={label} className={todo.priority === p ? 'on' : ''} onClick={() => set({ priority: p as Priority })}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field" title="Schwierigkeit bestimmt mit der Dauer, wie viele Coins und wie viel Erfahrung es gibt">
          <Coins size={16} className="field-icon" />
          <div className="difficulty-row">
          <div className="segmented small">
            {DIFFICULTY_LABEL.map((label, d) => (
              <button key={label} className={(todo.difficulty ?? 1) === d ? 'on' : ''} onClick={() => set({ difficulty: d as Difficulty })}>
                {label}
              </button>
            ))}
          </div>
          <span className="field-hint">≈ {todoReward(todo.difficulty, todoMinutes(todo, data.events)).coins} Coins</span>
          </div>
        </div>

        <div className="field">
          <Tag size={16} className="field-icon" />
          <div className="cal-picker">
            {data.categories.map((c) => (
              <button
                key={c.id}
                className={`cal-pill sm ${c.id === todo.categoryId ? 'on' : ''}`}
                style={{ '--c': calVar(c.color) } as React.CSSProperties}
                onClick={() => set({ categoryId: c.id === todo.categoryId ? undefined : c.id })}
              >
                <i />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field two-col">
          <List size={16} className="field-icon" />
          <select className="input" value={todo.listId} onChange={(e) => set({ listId: e.target.value })}>
            {data.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <Timer size={16} className="field-icon" />
          <select className="input" value={todo.estimateMin ?? ''} onChange={(e) => set({ estimateMin: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Keine Schätzung</option>
            {ESTIMATE_PRESETS.map((m) => (
              <option key={m} value={m}>
                {formatEstimate(m)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <CalendarClock size={16} className="field-icon" />
          <div className="field-stack">
            {event ? (
              <div className="scheduled-box">
                <span>
                  Eingeplant: <strong>{fmt(new Date(event.start), "EEE, d. MMM 'um' HH:mm")}</strong>
                </span>
                <button
                  className="link-btn"
                  onClick={() => {
                    setPage('plan')
                    setCursor(new Date(event.start))
                    selectEvent(event.id)
                  }}
                >
                  Termin
                </button>
              </div>
            ) : (
              <span className="field-hint">Noch nicht eingeplant – ins Kalenderraster ziehen oder hier wählen:</span>
            )}
            <div className="datetime-row">
              <DatePicker value={planDate} onChange={(v) => v && setPlanDate(v)} />
              <input type="time" className="input" step={900} value={planTime} onChange={(e) => setPlanTime(e.target.value)} />
              <button
                className="btn btn-outline sm"
                onClick={() => {
                  const s = fromLocal(planDate, planTime)
                  schedule(todo.id, s, addMinutes(s, todo.estimateMin ?? data.settings.defaultDurationMin))
                }}
              >
                {event ? 'Verschieben' : 'Einplanen'}
              </button>
            </div>
          </div>
        </div>

        <div className="field">
          <ListChecks size={16} className="field-icon" />
          <div className="field-stack">
            {todo.subtasks.map((st) => (
              <div key={st.id} className="subtask">
                <button
                  className={`todo-check p0 ${st.done ? 'done' : ''}`}
                  style={{ width: 16, height: 16 }}
                  onClick={() => set({ subtasks: todo.subtasks.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)) })}
                  aria-label="Unteraufgabe abhaken"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
                <input
                  className={`subtask-input ${st.done ? 'is-done' : ''}`}
                  value={st.title}
                  onChange={(e) => set({ subtasks: todo.subtasks.map((x) => (x.id === st.id ? { ...x, title: e.target.value } : x)) }, `sub-${st.id}`)}
                />
                <button className="icon-btn sm" onClick={() => set({ subtasks: todo.subtasks.filter((x) => x.id !== st.id) })} aria-label="Unteraufgabe entfernen">
                  <X size={13} />
                </button>
              </div>
            ))}
            <div className="subtask add">
              <Plus size={14} />
              <input
                className="subtask-input"
                placeholder="Unteraufgabe hinzufügen"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSub.trim()) {
                    set({ subtasks: [...todo.subtasks, { id: uid(), title: newSub.trim(), done: false }] })
                    setNewSub('')
                  }
                }}
              />
            </div>
          </div>
        </div>

        <div className="field">
          <AlignLeft size={16} className="field-icon" />
          <textarea className="input textarea" placeholder="Notizen" rows={4} value={todo.notes ?? ''} onChange={(e) => set({ notes: e.target.value }, 'notes')} />
        </div>

        <div className="obsidian-preview">
          <div className="obsidian-head">
            <span>In Obsidian (Tasks-Format)</span>
            <button
              className="icon-btn sm"
              title="Kopieren"
              onClick={() => {
                void navigator.clipboard?.writeText(tasksLine).then(() => {
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                })
              }}
            >
              <Copy size={13} />
            </button>
          </div>
          <code>{tasksLine}</code>
          {copied && <span className="field-hint">Kopiert</span>}
        </div>

        <p className="details-foot">Änderungen werden sofort gespeichert · Strg+Z macht sie rückgängig</p>
      </div>
    </div>
  )
}

const REPEAT_UNITS: Record<RecurrenceFreq, [string, string]> = {
  daily: ['Tag', 'Tage'],
  weekly: ['Woche', 'Wochen'],
  monthly: ['Monat', 'Monate'],
  yearly: ['Jahr', 'Jahre']
}

/** Repeat rule of a ToDo: completing it creates the next instance. */
function TodoRepeat({ todo, set }: { todo: Todo; set: (patch: Partial<Todo>) => void }): React.JSX.Element {
  const rec = todo.recurrence
  const next = rec && !todo.done ? nextRecurrence(todo) : null
  const nextDay = next?.softDeadline ?? next?.hardDeadline
  const onChange = (r: Recurrence | null): void => set({ recurrence: r, ...(todo.repeatable ? { repeatable: null } : {}) })

  return (
    <div className="field">
      <Repeat size={16} className="field-icon" />
      <div className="field-stack">
        <select
          className="input"
          value={todo.repeatable ? 'free' : (rec?.freq ?? 'none')}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'none') return set({ recurrence: null, repeatable: null })
            if (v === 'free') return set(makeRepeatable(todo, todo.repeatable?.cooldownMin))
            const freq = v as RecurrenceFreq
            onChange({
              interval: rec?.interval ?? 1,
              freq,
              ...(freq === 'weekly' ? { byWeekday: rec?.byWeekday } : {}),
              ...(rec?.until ? { until: rec.until } : {}),
              ...(rec?.count ? { count: rec.count } : {})
            })
          }}
        >
          <option value="none">Wiederholt sich nicht</option>
          <option value="daily">Täglich</option>
          <option value="weekly">Wöchentlich</option>
          <option value="monthly">Monatlich</option>
          <option value="yearly">Jährlich</option>
          <option value="free">Beliebig oft (mit Abklingzeit)</option>
        </select>
        {todo.repeatable && <RepeatableBox todo={todo} set={set} />}
        {rec && (
          <div className="rec-box">
            <div className="rec-line">
              Alle
              <input
                type="number"
                min={1}
                max={99}
                className="input xs"
                value={rec.interval}
                onChange={(e) => onChange({ ...rec, interval: Math.max(1, Number(e.target.value) || 1) })}
              />
              {REPEAT_UNITS[rec.freq][rec.interval === 1 ? 0 : 1]}
            </div>
            {rec.freq === 'weekly' && (
              <div className="weekday-picker">
                {WEEKDAY_SHORT.map((w, i) => {
                  const on = rec.byWeekday?.includes(i)
                  return (
                    <button
                      key={w}
                      className={on ? 'on' : ''}
                      title={on ? undefined : 'Nur an bestimmten Wochentagen'}
                      onClick={() => {
                        const cur = new Set(rec.byWeekday ?? [])
                        if (on) cur.delete(i)
                        else cur.add(i)
                        onChange({ ...rec, byWeekday: cur.size ? [...cur].sort() : undefined })
                      }}
                    >
                      {w}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="rec-line">
              Endet
              <select
                className="input sm"
                value={rec.until ? 'until' : rec.count ? 'count' : 'never'}
                onChange={(e) => {
                  const v = e.target.value
                  const from = todo.softDeadline ?? todo.hardDeadline ?? localDate(new Date())
                  onChange({
                    ...rec,
                    until: v === 'until' ? localDate(addDays(parseLocalDate(from), 90)) : undefined,
                    count: v === 'count' ? 10 : undefined
                  })
                }}
              >
                <option value="never">nie</option>
                <option value="until">am</option>
                <option value="count">nach</option>
              </select>
              {rec.until && <DatePicker value={rec.until} onChange={(v) => v && onChange({ ...rec, until: v })} />}
              {rec.count && (
                <>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    className="input xs"
                    value={rec.count}
                    onChange={(e) => onChange({ ...rec, count: Math.max(1, Number(e.target.value) || 1) })}
                  />
                  Mal
                </>
              )}
            </div>
            <span className="field-hint">
              {todo.done
                ? 'Beim Abhaken entsteht das nächste ToDo.'
                : nextDay
                  ? `Beim Abhaken entsteht das nächste ToDo – fällig ${fmt(parseLocalDate(nextDay), 'EEE, d. MMM')}${
                      rec.count ? ` (noch ${rec.count - 1}× danach)` : ''
                    }.`
                  : 'Das ist das letzte Mal – beim Abhaken entsteht kein neues ToDo.'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** settings and stats of a repeatable ToDo */
function RepeatableBox({ todo, set }: { todo: Todo; set: (patch: Partial<Todo>) => void }): React.JSX.Element {
  const r = todo.repeatable!
  const left = useCooldown(todo)
  const last = lastCompletion(todo)
  const today = localDate(new Date())
  const todayCount = r.completions.filter((at) => localDate(new Date(at)) === today).length
  return (
    <div className="rec-box">
      <div className="rec-line">
        Abklingzeit
        <select
          className="input sm"
          value={r.cooldownMin}
          onChange={(e) => set({ repeatable: { ...r, cooldownMin: Number(e.target.value) } })}
        >
          {(COOLDOWN_OPTIONS.includes(r.cooldownMin) ? COOLDOWN_OPTIONS : [...COOLDOWN_OPTIONS, r.cooldownMin].sort((a, b) => a - b)).map((m) => (
            <option key={m} value={m}>
              {cooldownLabel(m)}
            </option>
          ))}
        </select>
      </div>
      <span className="field-hint">
        {r.completions.length === 0
          ? 'Bleibt in der Liste und bringt bei jedem Abhaken Punkte und Coins.'
          : `${r.completions.length}× erledigt${todayCount ? `, heute ${todayCount}×` : ''} · zuletzt ${fmt(new Date(last!), 'EEE, d. MMM HH:mm')}`}
        {left > 0 && ` · wieder abhakbar in ${formatLeft(left)}`}
      </span>
    </div>
  )
}
