import { useMemo, useState } from 'react'
import { Check, GripVertical, Pencil, Plus, Target, Trash2, X } from 'lucide-react'
import { DAY_NAMES, goalsForWeek, goalWeek, slotsLabel, weekKey, type GoalWeek } from '@shared/goals'
import type { CalendarEvent, GoalSlot, WeeklyGoal } from '@shared/types'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, toLocalTime } from '../../lib/dates'
import { GOAL_MIME, goalDrag } from '../../lib/dnd'
import { useNow } from '../calendar/TimeGrid'

const uid = (): string => `goal-${Math.random().toString(36).slice(2, 10)}`

/** where every goal of the week of `day` stands */
export function useGoalWeeks(day: Date): GoalWeek[] {
  const goals = useStore((s) => s.data!.goals)
  const events = useStore((s) => s.data!.events)
  const now = useNow(60_000)
  return useMemo(() => goalsForWeek(goals, day).map((g) => goalWeek(g, events, day, now)), [goals, events, day, now])
}

/** round check for a goal block, like the ToDo check */
export function GoalCheck({ event, size = 16 }: { event: CalendarEvent; size?: number }): React.JSX.Element | null {
  const setDone = useStore((s) => s.setGoalDone)
  if (!event.goal) return null
  const done = !!event.goal.done
  return (
    <button
      className={`todo-check goal-check ${done ? 'done' : ''}`}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation()
        setDone(event.id, !done)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={done ? 'Als nicht geschafft markieren' : 'Geschafft'}
      aria-pressed={done}
    >
      <Check size={size - 6} strokeWidth={3.2} />
    </button>
  )
}

/** "Hat's geklappt?" for a block whose time passed unchecked */
export function MissedPrompt({ event }: { event: CalendarEvent }): React.JSX.Element {
  const st = useStore.getState
  const start = new Date(event.start)
  return (
    <div className="goal-missed">
      <span>
        <strong>{event.title}</strong> {fmt(start, 'EEE')} {toLocalTime(start)} – hat’s geklappt?
      </span>
      <div className="goal-missed-actions">
        <button className="btn sm btn-primary" onClick={() => st().setGoalDone(event.id, true)}>
          Ja
        </button>
        <button
          className="btn sm btn-outline"
          title="Zurück in den Vorrat, dann neu in die Woche ziehen"
          onClick={() => {
            st().returnGoalBlock(event.id)
            if (st().page !== 'plan') st().setView('week')
          }}
        >
          Verschieben
        </button>
        <button className="btn sm btn-ghost" title="Zählt diese Woche nicht mehr" onClick={() => st().strikeGoalBlock(event.id)}>
          Diese Woche nicht
        </button>
      </div>
    </div>
  )
}

/** done ● · planned ◐ · open ○ */
function Pips({ w }: { w: GoalWeek }): React.JSX.Element {
  const pips = [
    ...w.done.map(() => 'done'),
    ...w.planned.map(() => 'planned'),
    ...Array.from({ length: w.open }, () => 'open')
  ]
  return (
    <span className="goal-pips" aria-label={`${w.done.length} von ${w.target} geschafft`}>
      {pips.map((p, i) => (
        <i key={i} className={p} />
      ))}
    </span>
  )
}

/** one goal: progress, a draggable block while some are open, the edit button */
export function GoalRow({ w, draggable, onEdit }: { w: GoalWeek; draggable: boolean; onEdit(): void }): React.JSX.Element {
  const color = useStore((s) => s.data!.calendars.find((c) => c.id === w.goal.calendarId)?.color ?? 'green')
  const complete = w.target > 0 && w.done.length >= w.target
  return (
    <div className={`goal-row ${complete ? 'complete' : ''}`} style={{ '--c': calVar(color) } as React.CSSProperties}>
      <div className="goal-row-head">
        <Target size={14} className="goal-icon" />
        <span className="goal-title" title={w.goal.slots.length ? `Feste Zeiten: ${slotsLabel(w.goal.slots)}` : undefined}>
          {w.goal.title}
        </span>
        <span className="goal-count">
          {w.done.length}/{w.target}
        </span>
        <button className="icon-btn sm ghost-hover" onClick={onEdit} aria-label={`${w.goal.title} bearbeiten`}>
          <Pencil size={12} />
        </button>
      </div>
      <Pips w={w} />
      {draggable && w.open > 0 && (
        <div
          className="goal-chip"
          draggable
          title="In die Woche ziehen"
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'copy'
            e.dataTransfer.setData(GOAL_MIME, w.goal.id)
            goalDrag.id = w.goal.id
          }}
          onDragEnd={() => (goalDrag.id = null)}
        >
          <GripVertical size={12} />
          <b>{w.goal.title} einplanen</b>
          <span>{w.open} offen</span>
        </div>
      )}
    </div>
  )
}

/** sidebar section on the calendar page: goals of the shown week, blocks to drag in, missed ones to answer */
export function GoalBar({ day }: { day: Date }): React.JSX.Element {
  const weeks = useGoalWeeks(day)
  const [editing, setEditing] = useState<WeeklyGoal | 'new' | null>(null)
  const missed = weeks.flatMap((w) => w.missed)
  return (
    <div className="goalbar">
      <div className="section-head">
        <span>Wochenziele {weekKey(day).split('-W')[1] && <span className="muted">KW {Number(weekKey(day).split('-W')[1])}</span>}</span>
        <button className="icon-btn sm" aria-label="Wochenziel anlegen" title="Wochenziel anlegen" onClick={() => setEditing('new')}>
          <Plus size={16} />
        </button>
      </div>
      {weeks.length === 0 && (
        <button className="goal-empty" onClick={() => setEditing('new')}>
          z. B. „3× Gym“ – mit festen Zeiten oder zum Reinziehen
        </button>
      )}
      {weeks.map((w) => (
        <GoalRow key={w.goal.id} w={w} draggable onEdit={() => setEditing(w.goal)} />
      ))}
      {missed.map((e) => (
        <MissedPrompt key={e.id} event={e} />
      ))}
      {editing && <GoalEditor goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

const DURATIONS = [30, 45, 60, 90, 105, 120, 150, 180]
const durLabel = (m: number): string => (m < 60 ? `${m} min` : `${(m / 60).toLocaleString('de-DE', { maximumFractionDigits: 2 })} h`)

/** create or edit a weekly goal, with its fixed times */
export function GoalEditor({ goal, onClose }: { goal: WeeklyGoal | null; onClose(): void }): React.JSX.Element {
  const data = useStore((s) => s.data!)
  const upsert = useStore((s) => s.upsertGoal)
  const archive = useStore((s) => s.archiveGoal)
  const writable = data.calendars.filter((c) => !c.external || c.external.provider === 'google')
  const [draft, setDraft] = useState<WeeklyGoal>(
    () =>
      goal ?? {
        id: uid(),
        title: '',
        count: 3,
        calendarId: data.settings.todoCalendarId,
        durationMin: 90,
        slots: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
  )
  const [onlyThisWeek, setOnlyThisWeek] = useState(!!goal?.week)
  const set = (p: Partial<WeeklyGoal>): void => setDraft((d) => ({ ...d, ...p }))
  const setSlot = (i: number, p: Partial<GoalSlot>): void => set({ slots: draft.slots.map((s, x) => (x === i ? { ...s, ...p } : s)) })

  const save = (): void => {
    if (!draft.title.trim()) return
    const count = Math.max(1, Math.round(draft.count), draft.slots.length)
    upsert({ ...draft, title: draft.title.trim(), count, week: onlyThisWeek ? (goal?.week ?? weekKey(new Date())) : undefined })
    onClose()
  }

  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="confirm-dialog goal-editor"
        role="dialog"
        aria-label={goal ? 'Wochenziel bearbeiten' : 'Wochenziel anlegen'}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="confirm-head">
          <Target size={18} />
          <h2>{goal ? 'Wochenziel bearbeiten' : 'Neues Wochenziel'}</h2>
          <span style={{ flex: 1 }} />
          <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Schließen">
            <X size={14} />
          </button>
        </div>
        <div className="goal-editor-grid">
          <label>Was</label>
          <input className="input sm" autoFocus value={draft.title} placeholder="z. B. Gym" onChange={(e) => set({ title: e.target.value })} />
          <label>Wie oft</label>
          <span className="goal-inline">
            <input
              className="input sm goal-num"
              type="number"
              min={1}
              max={14}
              value={draft.count}
              onChange={(e) => set({ count: Number(e.target.value) })}
            />
            × pro Woche, je
            <select className="input sm" value={draft.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })}>
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {durLabel(m)}
                </option>
              ))}
            </select>
          </span>
          <label>Kalender</label>
          <select className="input sm" value={draft.calendarId} onChange={(e) => set({ calendarId: e.target.value })}>
            {writable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label>Feste Zeiten</label>
          <div className="goal-slots">
            {draft.slots.map((s, i) => (
              <div key={i} className="goal-slot">
                <select className="input sm" value={s.day} onChange={(e) => setSlot(i, { day: Number(e.target.value) })} aria-label="Wochentag">
                  {DAY_NAMES.map((d, x) => (
                    <option key={d} value={x}>
                      {d}
                    </option>
                  ))}
                </select>
                <input className="input sm" type="time" value={s.time} onChange={(e) => setSlot(i, { time: e.target.value })} aria-label="Uhrzeit" />
                <select className="input sm" value={s.durationMin} onChange={(e) => setSlot(i, { durationMin: Number(e.target.value) })} aria-label="Dauer">
                  {DURATIONS.map((m) => (
                    <option key={m} value={m}>
                      {durLabel(m)}
                    </option>
                  ))}
                </select>
                <button type="button" className="icon-btn sm" onClick={() => set({ slots: draft.slots.filter((_, x) => x !== i) })} aria-label="Zeit entfernen">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                set({
                  slots: [...draft.slots, { day: draft.slots.length ? Math.min(6, draft.slots[draft.slots.length - 1].day + 2) : 1, time: '15:30', durationMin: draft.durationMin }],
                  count: Math.max(draft.count, draft.slots.length + 1)
                })
              }
            >
              <Plus size={13} /> Feste Zeit
            </button>
          </div>
        </div>
        <p className="widget-settings-hint">
          Feste Zeiten trägt Ember jede Woche selbst ein
          {draft.slots.length > 0 && draft.count > draft.slots.length
            ? `; die übrigen ${draft.count - draft.slots.length} ziehst du aus der Seitenleiste in die Woche.`
            : '. Ohne feste Zeiten ziehst du die Bausteine aus der Seitenleiste in die Woche.'}{' '}
          Ist ein Termin vorbei und nicht abgehakt, fragt Ember nach.
        </p>
        <label className="goal-once">
          <input type="checkbox" checked={onlyThisWeek} onChange={(e) => setOnlyThisWeek(e.target.checked)} /> Nur diese Woche
        </label>
        <div className="confirm-actions">
          {goal && (
            <button
              type="button"
              className="btn btn-danger-outline sm"
              style={{ marginRight: 'auto' }}
              title="Kommende Termine des Ziels kommen in den Papierkorb, vergangene und Punkte bleiben"
              onClick={() => {
                archive(goal.id)
                onClose()
              }}
            >
              <Trash2 size={13} /> Ziel entfernen
            </button>
          )}
          <button type="button" className="btn btn-ghost sm" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary sm" disabled={!draft.title.trim()}>
            {goal ? 'Speichern' : 'Anlegen'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** sidebar section on the ToDo page: this week's goals at a glance, with a way into the week to plan them */
export function TodoGoalsSection(): React.JSX.Element {
  const now = useNow(60_000)
  const today = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()), [now])
  const weeks = useGoalWeeks(today)
  const setView = useStore((s) => s.setView)
  const [editing, setEditing] = useState<WeeklyGoal | 'new' | null>(null)
  const target = weeks.reduce((s, w) => s + w.target, 0)
  const done = weeks.reduce((s, w) => s + Math.min(w.done.length, w.target), 0)
  const open = weeks.reduce((s, w) => s + w.open, 0)
  const missed = weeks.flatMap((w) => w.missed)

  return (
    <div className="goalbar todo-goals">
      <div className="section-head">
        <span>
          Wochenziele{' '}
          {target > 0 && (
            <span className="muted">
              {done}/{target}
            </span>
          )}
        </span>
        <button className="icon-btn sm" aria-label="Wochenziel anlegen" title="Wochenziel anlegen" onClick={() => setEditing('new')}>
          <Plus size={16} />
        </button>
      </div>
      {weeks.length === 0 && (
        <button className="goal-empty" onClick={() => setEditing('new')}>
          z. B. „3× Gym“ – erscheint hier und im Kalender
        </button>
      )}
      {weeks.map((w) => (
        <GoalRow key={w.goal.id} w={w} draggable={false} onEdit={() => setEditing(w.goal)} />
      ))}
      {missed.map((e) => (
        <MissedPrompt key={e.id} event={e} />
      ))}
      {weeks.length > 0 && (
        <button className="link-btn todo-goals-plan" onClick={() => setView('week')}>
          {open > 0 ? `${open} offen – in der Woche einplanen →` : 'Zur Woche →'}
        </button>
      )}
      {editing && <GoalEditor goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
