import { ANY, type AppTimeLog } from './apptime'
import { addDays } from 'date-fns'
import { goalBlockWeeks, goalWeek, setBonus, weekKey, weekStart } from './goals'
import { pastSessions, type SessionRule } from './points'
import { localDate } from './todo'
import { completionsSince, staleCompletionKeys } from './repeatable'
import type { AppData, AttrId, Category, Character, Difficulty, Reward, Todo, WeeklyGoal } from './types'

/**
 * The character: six attributes that level up on their own (XP) and coins to spend on clothes.
 * Like the points ledger, rewards are derived from the data and keyed so nothing counts twice;
 * re-opening a ToDo takes its reward back, deleting it keeps the reward.
 */

export const ATTRS: { id: AttrId; name: string; hint: string }[] = [
  { id: 'fitness', name: 'Fitness', hint: 'Sport, Bewegung' },
  { id: 'stamina', name: 'Ausdauer', hint: 'Wochenziele, dranbleiben' },
  { id: 'mind', name: 'Köpfchen', hint: 'Lernen, Projekte, Arbeit' },
  { id: 'creativity', name: 'Kreativität', hint: 'D&D-Prep, Ideen, Kunst' },
  { id: 'order', name: 'Ordnung', hint: 'Haushalt, Papierkram' },
  { id: 'social', name: 'Sozial', hint: 'Sessions, Freunde, Familie' }
]

export const DIFFICULTY_LABEL = ['leicht', 'mittel', 'schwer', 'episch']

const GUESS: [RegExp, AttrId][] = [
  [/sport|gym|fitness|lauf|jogg|training|yoga|rad|schwimm|bewegung|workout/i, 'fitness'],
  [/d\s*(&|n|und)\s*d|kampagne|prep|kreativ|kunst|musik|schreib|idee|zeichn|mal(en)?\b|design/i, 'creativity'],
  [/haushalt|putz|ordnung|papier|finanz|steuer|einkauf|wäsche|aufräum|küche|garten/i, 'order'],
  [/sozial|freund|familie|party|treffen|session|verein|date/i, 'social'],
  [/gesund|schlaf|routine|gewohn|meditat|ausdauer|habit/i, 'stamina'],
  [/lern|uni|schule|studi|projekt|arbeit|job|code|programm|lesen|kurs|sprache/i, 'mind']
]

/** the attribute a name sounds like, or null */
export function guessAttr(name: string): AttrId | null {
  return GUESS.find(([re]) => re.test(name))?.[1] ?? null
}

export const categoryAttr = (c: Category | undefined): AttrId | null =>
  c ? (c.attribute === undefined ? guessAttr(c.name) : c.attribute) : null

export const goalAttr = (g: WeeklyGoal): AttrId => (g.attribute === undefined ? guessAttr(g.title) : g.attribute) ?? 'stamina'

/* ── how much things are worth ── */

const COIN_BASE = [2, 4, 8, 15]
const XP_BASE = [5, 10, 20, 35]
/** longer than this counts as this long */
export const MAX_MINUTES = 240
const DEFAULT_MINUTES = 15

export const REWARD = {
  goal: { coins: 10, xp: 20 },
  goalWeek: { coins: 25, xp: 30 },
  /** "Completionist": every weekly goal of a week done */
  goalSet: { coins: 50, xp: 40 },
  session: { coins: 15, xp: 25 },
  prepHour: { coins: 4, xp: 10 }
}

/** minutes a ToDo took: its checked-off time block, else its estimate, else a quarter hour */
export function todoMinutes(t: Todo, events: AppData['events']): number {
  const block = t.linkedEventId ? events.find((e) => e.id === t.linkedEventId) : undefined
  const min = block ? (new Date(block.end).getTime() - new Date(block.start).getTime()) / 60000 : t.estimateMin ?? DEFAULT_MINUTES
  return Math.max(1, Math.min(MAX_MINUTES, Math.round(min)))
}

/** coins and XP for a ToDo: base by difficulty × (1 + minutes / 30) */
export function todoReward(difficulty: Difficulty | undefined, minutes: number): { coins: number; xp: number } {
  const d = difficulty ?? 1
  const f = 1 + Math.min(MAX_MINUTES, minutes) / 30
  return { coins: Math.round(COIN_BASE[d] * f), xp: Math.round(XP_BASE[d] * f) }
}

/** the rewards earned so far; the same object when nothing changed */
export function reconcileRewards(
  data: Pick<AppData, 'todos' | 'events' | 'goals' | 'categories' | 'character'>,
  opts: { now: Date; session: SessionRule | null; prep: AppTimeLog | null }
): Character['rewards'] {
  const ch = data.character
  const since = ch.since
  const out = { ...ch.rewards }
  let changed = false
  const put = (key: string, r: Reward): void => {
    const cur = out[key]
    if (cur && cur.coins === r.coins && cur.xp === r.xp && cur.attr === r.attr && cur.label === r.label) return
    out[key] = cur ? { ...r, at: cur.at } : r
    changed = true
  }
  const drop = (key: string): void => {
    if (!(key in out)) return
    delete out[key]
    changed = true
  }
  const cats = new Map(data.categories.map((c) => [c.id, c]))

  for (const t of data.todos) {
    const key = `todo:${t.id}`
    if (t.repeatable) {
      const r = todoReward(t.difficulty, todoMinutes(t, data.events))
      const attr = categoryAttr(cats.get(t.categoryId ?? '')) ?? 'order'
      const live = new Set<string>()
      for (const c of completionsSince(t, since)) {
        live.add(c.key)
        put(c.key, { at: c.at, ...r, attr, label: t.title })
      }
      for (const k of staleCompletionKeys(t, out, live)) drop(k)
      drop(key)
      continue
    }
    if (t.done && t.doneAt && t.doneAt >= since) {
      const r = todoReward(t.difficulty, todoMinutes(t, data.events))
      put(key, { at: t.doneAt, ...r, attr: categoryAttr(cats.get(t.categoryId ?? '')) ?? 'order', label: t.title })
    } else if (!t.done) drop(key)
  }

  const weeks = new Map<string, Date>()
  for (const e of data.events) {
    if (!e.goal) continue
    const goal = data.goals.find((g) => g.id === e.goal!.goalId)
    const key = `goal:${e.id}`
    if (e.goal.done && e.goal.doneAt && e.goal.doneAt >= since) {
      put(key, { at: e.goal.doneAt, ...REWARD.goal, attr: goal ? goalAttr(goal) : 'stamina', label: e.title })
    } else if (!e.goal.done) drop(key)
    weeks.set(`${e.goal.goalId}|${weekKey(new Date(e.start))}`, new Date(e.start))
  }
  for (const [k, day] of weeks) {
    const goal = data.goals.find((g) => g.id === k.split('|')[0])
    if (!goal) continue
    const key = `goal-week:${k.replace('|', ':')}`
    const w = goalWeek(goal, data.events, day, opts.now)
    if (w.target > 0 && w.done.length >= w.target && w.done.every((e) => e.goal!.doneAt! >= since)) {
      const last = w.done.map((e) => e.goal!.doneAt!).sort().pop()!
      put(key, { at: last, ...REWARD.goalWeek, attr: 'stamina', label: `${goal.title}: Wochenziel geschafft` })
    } else drop(key)
  }

  for (const [week, day] of goalBlockWeeks(data.events)) {
    const key = `goal-set:${week}`
    const s = setBonus(data.goals, data.events, day, opts.now)
    if (s.complete && s.doneAt.every((at) => at >= since)) {
      put(key, { at: s.at!, ...REWARD.goalSet, attr: 'stamina', label: `Completionist: alle ${s.total} Wochenziele geschafft` })
    } else if (addDays(weekStart(day), 7) > opts.now) drop(key) // a week that is over keeps its bonus
  }

  if (opts.session) {
    for (const o of pastSessions(data.events, opts.session, new Date(since), opts.now)) {
      put(`session:${o.event.id}:${o.start.toISOString()}`, {
        at: o.end.toISOString(),
        ...REWARD.session,
        attr: 'social',
        label: o.event.title || 'Session'
      })
    }
  }

  if (opts.prep) {
    const first = localDate(new Date(since))
    for (const [day, entry] of Object.entries(opts.prep.days)) {
      const hours = Math.floor((entry[ANY] ?? 0) / 3600)
      if (day < first || hours < 1) continue
      put(`prep:${day}`, {
        at: `${day}T23:59:00`,
        coins: hours * REWARD.prepHour.coins,
        xp: hours * REWARD.prepHour.xp,
        attr: 'creativity',
        label: `${hours} ${hours === 1 ? 'Stunde' : 'Stunden'} Prep`
      })
    }
  }

  return changed ? out : ch.rewards
}

/* ── totals and levels ── */

export const earnedCoins = (ch: Character): number => Object.values(ch.rewards).reduce((s, r) => s + r.coins, 0)
/** never below zero, even when a re-opened ToDo took coins back that were already spent */
export const coinBalance = (ch: Character): number => Math.max(0, earnedCoins(ch) - ch.spent)

export function attrXp(ch: Character): Record<AttrId, number> {
  const xp = Object.fromEntries(ATTRS.map((a) => [a.id, 0])) as Record<AttrId, number>
  for (const r of Object.values(ch.rewards)) if (r.attr) xp[r.attr] += r.xp
  return xp
}

/** attribute level n starts at 25·n·(n−1) XP: 0, 50, 150, 300, 500 … */
export function attrLevel(xp: number): { level: number; from: number; to: number } {
  let n = 1
  while (25 * (n + 1) * n <= xp) n++
  return { level: n, from: 25 * n * (n - 1), to: 25 * (n + 1) * n }
}

/** the character's level: one plus every attribute level gained */
export const characterLevel = (ch: Character): number =>
  1 + Object.values(attrXp(ch)).reduce((s, xp) => s + attrLevel(xp).level - 1, 0)
