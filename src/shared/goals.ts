import { addDays, addMinutes, getISOWeek, getISOWeekYear, startOfWeek } from 'date-fns'
import type { CalendarEvent, GoalSlot, WeeklyGoal } from './types'

/**
 * Weekly goals ("3× Gym"): each goal has `count` blocks per week. Fixed slots are put into every
 * week automatically, the rest are dragged into the week by hand. Every block is a normal event with
 * `goal: { goalId }`, checked off on the event. A block whose time passed unchecked goes back to the pool
 * (and is asked about); striking it removes it from that week's target.
 */

export const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** ISO week key, e.g. "2026-W48" */
export function weekKey(d: Date): string {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, '0')}`
}

export const weekStart = (d: Date): Date => startOfWeek(d, { weekStartsOn: 1 })

/** goals that apply in the week of `day` */
export function goalsForWeek(goals: WeeklyGoal[], day: Date): WeeklyGoal[] {
  const key = weekKey(day)
  return goals.filter((g) => !g.archived && (!g.week || g.week === key))
}

/** this week's target after struck blocks */
export function weekTarget(goal: WeeklyGoal, week: string): number {
  return Math.max(0, goal.count - (goal.struck?.[week] ?? 0))
}

export interface GoalWeek {
  goal: WeeklyGoal
  target: number
  done: CalendarEvent[]
  /** planned and not over yet */
  planned: CalendarEvent[]
  /** over and not checked off: back in the pool, waiting for "Hat's geklappt?" */
  missed: CalendarEvent[]
  /** blocks still to place (missed ones count as open again) */
  open: number
}

/** where a goal stands in the week of `day` */
export function goalWeek(goal: WeeklyGoal, events: CalendarEvent[], day: Date, now: Date): GoalWeek {
  const from = weekStart(day).getTime()
  const to = addDays(weekStart(day), 7).getTime()
  const mine = events
    .filter((e) => e.goal?.goalId === goal.id && !e.deletedAt)
    .filter((e) => {
      const s = new Date(e.start).getTime()
      return s >= from && s < to
    })
    .sort((a, b) => a.start.localeCompare(b.start))
  const done = mine.filter((e) => e.goal!.done)
  const planned = mine.filter((e) => !e.goal!.done && new Date(e.end).getTime() > now.getTime())
  const missed = mine.filter((e) => !e.goal!.done && new Date(e.end).getTime() <= now.getTime())
  const target = weekTarget(goal, weekKey(day))
  return { goal, target, done, planned, missed, open: Math.max(0, target - done.length - planned.length) }
}

const parseTime = (t: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  return m ? Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2])) : 0
}

export function slotStart(weekMonday: Date, slot: GoalSlot): Date {
  return addMinutes(addDays(weekMonday, slot.day), parseTime(slot.time))
}

/** an event for one block of `goal` */
export function goalEvent(goal: WeeklyGoal, start: Date, durationMin: number): Omit<CalendarEvent, 'id' | 'reminders' | 'createdAt' | 'updatedAt'> {
  return {
    calendarId: goal.calendarId,
    title: goal.title,
    start: start.toISOString(),
    end: addMinutes(start, durationMin).toISOString(),
    allDay: false,
    recurrence: null,
    goal: { goalId: goal.id }
  }
}

/**
 * Fixed slots to put into the weeks of `days` (e.g. this and next week): one entry per goal and week
 * that was not filled yet. Slots already over are skipped, so a goal made on Friday doesn't start with misses.
 */
export function slotsToFill(goals: WeeklyGoal[], days: Date[], now: Date): { goalId: string; week: string; starts: { start: Date; durationMin: number }[] }[] {
  const out: { goalId: string; week: string; starts: { start: Date; durationMin: number }[] }[] = []
  for (const day of days) {
    const week = weekKey(day)
    const monday = weekStart(day)
    for (const g of goalsForWeek(goals, day)) {
      if (g.slots.length === 0 || g.filledWeeks?.includes(week)) continue
      const starts = g.slots
        .slice(0, g.count)
        .map((s) => ({ start: slotStart(monday, s), durationMin: s.durationMin || g.durationMin }))
        .filter((s) => addMinutes(s.start, s.durationMin) > now)
      out.push({ goalId: g.id, week, starts })
    }
  }
  return out
}

/** keep the list of filled weeks short */
export function markFilled(goal: WeeklyGoal, week: string): WeeklyGoal {
  const weeks = [...(goal.filledWeeks ?? []).filter((w) => w !== week), week].sort().slice(-8)
  return { ...goal, filledWeeks: weeks }
}

/** "Di 15:30 · Do 15:30" */
export const slotsLabel = (slots: GoalSlot[]): string => slots.map((s) => `${DAY_NAMES[s.day]} ${s.time}`).join(' · ')

/* ── set bonus ("Completionist"): every weekly goal of a week done ── */

/** at least this many goals make a set, so one goal alone doesn't pay twice */
export const SET_MIN_GOALS = 2

export interface SetBonus {
  week: string
  /** goals that count this week (target above zero) */
  total: number
  /** of those, complete */
  done: number
  complete: boolean
  /** when the last block of the set was checked off */
  at?: string
  /** every checked-off block of the set */
  doneAt: string[]
}

/**
 * Where the set bonus of the week of `day` stands. Counted are the week's active goals that existed
 * before the week ended and archived goals that had blocks in it (archiving later doesn't change the past).
 */
export function setBonus(goals: WeeklyGoal[], events: CalendarEvent[], day: Date, now: Date): SetBonus {
  const week = weekKey(day)
  const end = addDays(weekStart(day), 7).toISOString()
  const withBlocks = new Set(events.filter((e) => e.goal && !e.deletedAt && weekKey(new Date(e.start)) === week).map((e) => e.goal!.goalId))
  const counted = goals.filter(
    (g) =>
      (!g.week || g.week === week) &&
      (g.archived ? withBlocks.has(g.id) : !g.createdAt || g.createdAt < end)
  )
  const weeks = counted.map((g) => goalWeek(g, events, day, now)).filter((w) => w.target > 0)
  const doneWeeks = weeks.filter((w) => w.done.length >= w.target)
  const doneAt = doneWeeks.flatMap((w) => w.done.map((e) => e.goal!.doneAt ?? e.start)).sort()
  const complete = weeks.length >= SET_MIN_GOALS && doneWeeks.length === weeks.length
  return { week, total: weeks.length, done: doneWeeks.length, complete, at: complete ? doneAt.at(-1) : undefined, doneAt }
}

/** the weeks to check for a set bonus: every week that has goal blocks, as one day in it */
export function goalBlockWeeks(events: CalendarEvent[]): Map<string, Date> {
  const out = new Map<string, Date>()
  for (const e of events) if (e.goal && !e.deletedAt) out.set(weekKey(new Date(e.start)), new Date(e.start))
  return out
}
