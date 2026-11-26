import { useMemo, useState } from 'react'
import { addDays, addWeeks } from 'date-fns'
import { CheckCheck, Coins, Dices, Hourglass, Sparkles, Target, Trophy } from 'lucide-react'
import { ATTRS } from '@shared/character'
import { goalsForWeek, goalWeek, setBonus, weekKey, weekStart } from '@shared/goals'
import type { AttrId, Reward } from '@shared/types'
import { useStore } from '../../store'
import { fmt } from '../../lib/dates'
import { useNow } from '../calendar/TimeGrid'

/** rewards keep prep days as local "YYYY-MM-DDTHH:mm:ss" without zone */
const rewardTime = (r: Reward): number => new Date(r.at).getTime()

export interface WeekReview {
  coins: number
  todos: number
  goalsDone: number
  goalsTotal: number
  completionist: boolean
  sessions: number
  prepHours: number
  topAttr?: { id: AttrId; xp: number }
}

/** what happened in the week starting `monday` – only what was achieved, nothing that was missed */
export function reviewWeek(
  rewards: Record<string, Reward>,
  goals: Parameters<typeof goalsForWeek>[0],
  events: Parameters<typeof goalWeek>[1],
  monday: Date,
  now: Date
): WeekReview {
  const from = monday.getTime()
  const to = addDays(monday, 7).getTime()
  const r: WeekReview = { coins: 0, todos: 0, goalsDone: 0, goalsTotal: 0, completionist: false, sessions: 0, prepHours: 0 }
  const xp = new Map<AttrId, number>()
  for (const [key, w] of Object.entries(rewards)) {
    const t = rewardTime(w)
    if (t < from || t >= to) continue
    r.coins += w.coins
    if (w.attr) xp.set(w.attr, (xp.get(w.attr) ?? 0) + w.xp)
    if (key.startsWith('todo:')) r.todos++
    else if (key.startsWith('session:')) r.sessions++
    else if (key.startsWith('prep:')) r.prepHours += Number(/^(\d+)/.exec(w.label)?.[1] ?? 0)
  }
  const weeks = goalsForWeek(goals, monday)
    .map((g) => goalWeek(g, events, monday, now))
    .filter((w) => w.target > 0)
  r.goalsTotal = weeks.length
  r.goalsDone = weeks.filter((w) => w.done.length >= w.target).length
  r.completionist = setBonus(goals, events, monday, now).complete
  const top = [...xp].sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] > 0) r.topAttr = { id: top[0], xp: top[1] }
  return r
}

/** "Wochenrückblick": a friendly look back – on Sundays at this week, otherwise at last week */
export function WeeklyReviewWidget(): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const goals = useStore((s) => s.data!.goals)
  const events = useStore((s) => s.data!.events)
  const setCursor = useStore((s) => s.setCursor)
  const setView = useStore((s) => s.setView)
  const now = useNow(60_000)
  const sunday = now.getDay() === 0
  const [which, setWhich] = useState<'last' | 'this'>(sunday ? 'this' : 'last')
  const thisMonday = weekStart(now)
  const monday = which === 'this' ? thisMonday : addWeeks(thisMonday, -1)
  const r = useMemo(() => reviewWeek(ch.rewards, goals, events, monday, now), [ch.rewards, goals, events, monday.getTime(), now])
  const week = Number(weekKey(monday).split('-W')[1])
  const empty = r.coins === 0 && r.goalsDone === 0
  const attr = r.topAttr ? ATTRS.find((a) => a.id === r.topAttr!.id) : undefined
  const planMonday = which === 'this' ? addWeeks(thisMonday, 1) : thisMonday

  return (
    <section className="card widget review-card">
      <div className="widget-head">
        <div>
          <h3>Wochenrückblick</h3>
          <p>
            KW {week} · {fmt(monday, 'd. MMM')} – {fmt(addDays(monday, 6), 'd. MMM')}
          </p>
        </div>
        <div className="segmented small" role="tablist" aria-label="Woche">
          <button role="tab" aria-selected={which === 'last'} className={which === 'last' ? 'on' : ''} onClick={() => setWhich('last')}>
            Letzte
          </button>
          <button role="tab" aria-selected={which === 'this'} className={which === 'this' ? 'on' : ''} onClick={() => setWhich('this')}>
            Diese
          </button>
        </div>
      </div>

      {empty ? (
        <p className="review-empty">
          {which === 'this' ? 'Die Woche ist noch frisch – jede Kleinigkeit zählt.' : 'Eine ruhige Woche. Auch Pausen gehören dazu.'}
        </p>
      ) : (
        <>
          <div className="review-hero">
            <Coins size={18} />
            <strong>{r.coins.toLocaleString('de-DE')}</strong>
            <span>Coins verdient</span>
            {r.completionist && (
              <em className="review-badge" title="Alle Wochenziele geschafft">
                <Trophy size={12} /> Completionist
              </em>
            )}
          </div>
          <ul className="review-list">
            {r.todos > 0 && (
              <li>
                <CheckCheck size={14} /> <b>{r.todos}</b> {r.todos === 1 ? 'ToDo' : 'ToDos'} erledigt
              </li>
            )}
            {r.goalsTotal > 0 && r.goalsDone > 0 && (
              <li>
                <Target size={14} /> <b>{r.goalsDone}</b> von {r.goalsTotal} Wochenzielen komplett
              </li>
            )}
            {r.sessions > 0 && (
              <li>
                <Dices size={14} /> <b>{r.sessions}</b> {r.sessions === 1 ? 'Session' : 'Sessions'} gespielt
              </li>
            )}
            {r.prepHours > 0 && (
              <li>
                <Hourglass size={14} /> <b>{r.prepHours}</b> {r.prepHours === 1 ? 'Stunde' : 'Stunden'} Prep
              </li>
            )}
            {attr && (
              <li>
                <Sparkles size={14} /> Am meisten gewachsen: <b>{attr.name}</b> +{r.topAttr!.xp} XP
              </li>
            )}
          </ul>
        </>
      )}

      <button
        className="link-btn review-plan"
        onClick={() => {
          setCursor(planMonday)
          setView('week')
        }}
      >
        {which === 'this' ? 'Nächste Woche planen →' : 'Diese Woche planen →'}
      </button>
    </section>
  )
}
