import { useMemo, useState } from 'react'
import { startOfDay, subWeeks } from 'date-fns'
import { Sparkles, Target } from 'lucide-react'
import { weekStart } from '@shared/goals'
import { levelOf, pointsBetween, recentEntries, totalPoints } from '@shared/points'
import type { PointKind, WeeklyGoal } from '@shared/types'
import { useStore } from '../../store'
import { fmt } from '../../lib/dates'
import { useNow } from '../calendar/TimeGrid'
import { GoalEditor, GoalRow, MissedPrompt, useGoalWeeks } from '../goals/Goals'

/** this week's goals with their progress and the "Hat's geklappt?" questions */
export function GoalsWidget(): React.JSX.Element {
  const now = useNow(60_000)
  const today = useMemo(() => startOfDay(now), [now])
  const weeks = useGoalWeeks(today)
  const setView = useStore((s) => s.setView)
  const [editing, setEditing] = useState<WeeklyGoal | 'new' | null>(null)
  const target = weeks.reduce((s, w) => s + w.target, 0)
  const done = weeks.reduce((s, w) => s + Math.min(w.done.length, w.target), 0)

  return (
    <section className="card widget goals-card">
      <div className="widget-head">
        <div>
          <h3>Wochenziele</h3>
          <p>{weeks.length ? 'Diese Woche' : 'Noch keine Ziele'}</p>
        </div>
        {target > 0 && (
          <div className="widget-figure">
            <strong>
              {done}/{target}
            </strong>
            <span>geschafft</span>
          </div>
        )}
      </div>
      {weeks.length === 0 ? (
        <button className="goal-empty" onClick={() => setEditing('new')}>
          <Target size={14} /> Wochenziel anlegen, z. B. „3× Gym“ Di und Do 15:30
        </button>
      ) : (
        <div className="goals-list">
          {weeks.map((w) => (
            <GoalRow key={w.goal.id} w={w} draggable={false} onEdit={() => setEditing(w.goal)} />
          ))}
        </div>
      )}
      {weeks.flatMap((w) => w.missed).map((e) => (
        <MissedPrompt key={e.id} event={e} />
      ))}
      {weeks.some((w) => w.open > 0) && (
        <button className="link-btn goals-plan" onClick={() => setView('week')}>
          Offene Bausteine in der Woche einplanen →
        </button>
      )}
      {editing && <GoalEditor goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

const KIND_LABEL: Record<PointKind, string> = {
  todo: 'ToDo',
  goal: 'Ziel',
  'goal-week': 'Wochenziel',
  session: 'Session',
  prep: 'Prep'
}
const WEEKS = 8

/** level from all points, this week's points with the last weeks, the latest awards */
export function PointsWidget(): React.JSX.Element {
  const points = useStore((s) => s.data!.points)
  const now = useNow(60_000)
  const total = totalPoints(points)
  const { level, from, to } = levelOf(total)
  const bars = useMemo(() => {
    const thisWeek = weekStart(now)
    return Array.from({ length: WEEKS }, (_, i) => {
      const start = subWeeks(thisWeek, WEEKS - 1 - i)
      return { start, value: pointsBetween(points, start, subWeeks(start, -1)) }
    })
  }, [points, now])
  const max = Math.max(1, ...bars.map((b) => b.value))
  const recent = recentEntries(points, 4)

  return (
    <section className="card widget points-card">
      <div className="widget-head">
        <div>
          <h3>Punkte & Level</h3>
          <p>
            {total.toLocaleString('de-DE')} Punkte gesamt · noch {(to - total).toLocaleString('de-DE')} bis Level {level + 1}
          </p>
        </div>
        <div className="level-badge" title={`Level ${level}`}>
          <Sparkles size={13} />
          <strong>{level}</strong>
        </div>
      </div>
      <span className="prep-goal-bar level-bar">
        <span style={{ width: `${((total - from) / (to - from)) * 100}%` }} />
      </span>
      <div className="points-week">
        <div>
          <strong>{bars[WEEKS - 1].value}</strong>
          <span>diese Woche</span>
        </div>
        <div className="points-bars" aria-label="Punkte der letzten 8 Wochen">
          {bars.map((b, i) => (
            <span key={i} title={`KW ab ${fmt(b.start, 'd. MMM')}: ${b.value} Punkte`} className={i === WEEKS - 1 ? 'now' : ''}>
              <i style={{ height: `${Math.max(4, (b.value / max) * 100)}%` }} />
            </span>
          ))}
        </div>
      </div>
      {recent.length === 0 ? (
        <p className="empty-mini">Hak ein ToDo oder einen Ziel-Baustein ab – dafür gibt es Punkte.</p>
      ) : (
        <ul className="points-recent">
          {recent.map((e) => (
            <li key={e.key}>
              <span className={`points-kind k-${e.kind}`}>{KIND_LABEL[e.kind]}</span>
              <span className="points-label">{e.label}</span>
              <strong>+{e.points}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
