import { addDays } from 'date-fns'
import { ANY, type AppTimeLog } from './apptime'
import { expandAll } from './recurrence'
import { goalWeek, weekKey } from './goals'
import { localDate } from './todo'
import type { AppData, CalendarEvent, PointEntry, PointsLedger, Todo } from './types'

/**
 * Points for getting things done. They are derived from the data and kept in a keyed ledger,
 * so they only grow: deleting a done ToDo keeps its points, re-opening it gives them back.
 */

export const POINTS = {
  todo: 10,
  /** extra per priority step (1–3) */
  todoPriority: 5,
  goal: 15,
  /** all blocks of a weekly goal done */
  goalWeek: 25,
  session: 30,
  prepHour: 5
}

export const todoPoints = (t: Pick<Todo, 'priority'>): number => POINTS.todo + POINTS.todoPriority * (t.priority ?? 0)

export interface SessionRule {
  calendarId: string
  keyword: string
}

const PREP = /prep|vorbereit/i

/** sessions that ended in (since, now] */
export function pastSessions(events: CalendarEvent[], rule: SessionRule, since: Date, now: Date) {
  const kw = rule.keyword.trim().toLowerCase()
  const pool = events.filter(
    (e) =>
      !e.allDay &&
      !e.todoId &&
      !e.goal &&
      !PREP.test(e.title) &&
      (!rule.calendarId || e.calendarId === rule.calendarId) &&
      (!kw || e.title.toLowerCase().includes(kw))
  )
  return expandAll(pool, addDays(since, -1), now).filter((o) => o.end > since && o.end <= now)
}

/**
 * The ledger with every award earned so far. `session` null = sessions don't count (widget not set up);
 * `prep` null = no prep log (browser). Returns the same object when nothing changed.
 */
export function reconcilePoints(
  data: Pick<AppData, 'todos' | 'events' | 'goals' | 'points'>,
  opts: { now: Date; session: SessionRule | null; prep: AppTimeLog | null }
): PointsLedger {
  const { now } = opts
  const ledger = data.points
  const since = new Date(ledger.since)
  const sinceIso = ledger.since
  const entries = { ...ledger.entries }
  let changed = false
  const put = (key: string, e: PointEntry): void => {
    const cur = entries[key]
    if (cur && cur.points === e.points && cur.label === e.label) return
    entries[key] = cur ? { ...e, at: cur.at } : e
    changed = true
  }
  const drop = (key: string): void => {
    if (!(key in entries)) return
    delete entries[key]
    changed = true
  }

  for (const t of data.todos) {
    const key = `todo:${t.id}`
    if (t.done && t.doneAt && t.doneAt >= sinceIso) put(key, { at: t.doneAt, kind: 'todo', points: todoPoints(t), label: t.title })
    else if (!t.done) drop(key)
  }

  const weeks = new Map<string, Date>()
  for (const e of data.events) {
    if (!e.goal) continue
    const key = `goal:${e.id}`
    if (e.goal.done && e.goal.doneAt && e.goal.doneAt >= sinceIso) {
      put(key, { at: e.goal.doneAt, kind: 'goal', points: POINTS.goal, label: e.title })
    } else if (!e.goal.done) drop(key)
    // every week with blocks is checked for the bonus; a week whose blocks were all deleted keeps it
    weeks.set(`${e.goal.goalId}|${weekKey(new Date(e.start))}`, new Date(e.start))
  }
  for (const [k, day] of weeks) {
    const goal = data.goals.find((g) => g.id === k.split('|')[0])
    if (!goal) continue
    const key = `goal-week:${k.replace('|', ':')}`
    const w = goalWeek(goal, data.events, day, now)
    const fresh = w.done.every((e) => e.goal!.doneAt! >= sinceIso)
    if (w.target > 0 && w.done.length >= w.target && fresh) {
      const last = w.done.map((e) => e.goal!.doneAt!).sort().pop()!
      put(key, { at: last, kind: 'goal-week', points: POINTS.goalWeek, label: `${goal.title}: Wochenziel geschafft` })
    } else drop(key)
  }
  if (opts.session) {
    for (const o of pastSessions(data.events, opts.session, since, now)) {
      put(`session:${o.event.id}:${o.start.toISOString()}`, {
        at: o.end.toISOString(),
        kind: 'session',
        points: POINTS.session,
        label: o.event.title || 'Session'
      })
    }
  }

  if (opts.prep) {
    const first = localDate(since)
    for (const [day, entry] of Object.entries(opts.prep.days)) {
      if (day < first) continue
      const hours = Math.floor((entry[ANY] ?? 0) / 3600)
      if (hours < 1) continue
      put(`prep:${day}`, {
        at: `${day}T23:59:00`,
        kind: 'prep',
        points: hours * POINTS.prepHour,
        label: `${hours} ${hours === 1 ? 'Stunde' : 'Stunden'} Prep`
      })
    }
  }

  return changed ? { ...ledger, entries } : ledger
}

export const totalPoints = (l: PointsLedger): number => Object.values(l.entries).reduce((s, e) => s + e.points, 0)

/** points earned in [from, to) */
export function pointsBetween(l: PointsLedger, from: Date, to: Date): number {
  const a = from.toISOString()
  const b = to.toISOString()
  let sum = 0
  for (const e of Object.values(l.entries)) {
    // prep entries carry a local date without zone; compare by the local day
    const at = e.kind === 'prep' ? new Date(e.at).toISOString() : e.at
    if (at >= a && at < b) sum += e.points
  }
  return sum
}

/** level n starts at 50·n·(n−1) points: 0, 100, 300, 600, 1.000 … */
export function levelOf(points: number): { level: number; from: number; to: number } {
  let n = 1
  while (50 * (n + 1) * n <= points) n++
  return { level: n, from: 50 * n * (n - 1), to: 50 * (n + 1) * n }
}

/** newest entries first */
export const recentEntries = (l: PointsLedger, n: number): (PointEntry & { key: string })[] =>
  Object.entries(l.entries)
    .map(([key, e]) => ({ ...e, key, at: e.kind === 'prep' ? new Date(e.at).toISOString() : e.at }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, n)
