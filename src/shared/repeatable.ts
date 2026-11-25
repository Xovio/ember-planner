import type { ISODateTime, Todo } from './types'

/**
 * Repeatable ToDos („Waschmaschine befüllen“): never done for good, every completion counts
 * for points and rewards. A cooldown keeps you from ticking them off twice in a row –
 * it is a nudge, not a lock: setting it to zero is fine.
 */

/** cooldown choices in minutes */
export const COOLDOWN_OPTIONS = [0, 15, 30, 60, 120, 240, 480, 720, 1440, 2880, 10080]
export const DEFAULT_COOLDOWN = 60
/** only the newest completions are kept on the ToDo (points stay in the ledger anyway) */
export const MAX_COMPLETIONS = 500

export function cooldownLabel(min: number): string {
  if (min <= 0) return 'Keine'
  if (min < 60) return `${min} min`
  if (min < 1440) return `${min / 60} ${min === 60 ? 'Stunde' : 'Stunden'}`
  if (min === 10080) return '1 Woche'
  return `${min / 1440} ${min === 1440 ? 'Tag' : 'Tage'}`
}

export const lastCompletion = (t: Pick<Todo, 'repeatable'>): ISODateTime | undefined => t.repeatable?.completions.at(-1)

/** milliseconds until the ToDo can be ticked off again; 0 = available */
export function cooldownLeft(t: Pick<Todo, 'repeatable'>, now: number = Date.now()): number {
  const last = lastCompletion(t)
  if (!t.repeatable || !last || t.repeatable.cooldownMin <= 0) return 0
  return Math.max(0, new Date(last).getTime() + t.repeatable.cooldownMin * 60_000 - now)
}

export const isCoolingDown = (t: Pick<Todo, 'repeatable'>, now: number = Date.now()): boolean => cooldownLeft(t, now) > 0

/** „12 min“, „1 h 20 min“, „2 Tage“ */
export function formatLeft(ms: number): string {
  const min = Math.ceil(ms / 60_000)
  if (min < 60) return `${min} min`
  if (min < 1440) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const d = Math.round(min / 1440)
  return `${d} ${d === 1 ? 'Tag' : 'Tage'}`
}

/** the ToDo with one more completion at `at`; unchanged while cooling down */
export function completeRepeatable(t: Todo, at: ISODateTime): Todo {
  if (!t.repeatable || isCoolingDown(t, new Date(at).getTime())) return t
  const completions = [...t.repeatable.completions, at].slice(-MAX_COMPLETIONS)
  return { ...t, done: false, doneAt: undefined, repeatable: { ...t.repeatable, completions } }
}

/** takes back the newest completion (its points go too, like re-opening a ToDo) */
export function undoRepeatable(t: Todo): Todo {
  if (!t.repeatable?.completions.length) return t
  return { ...t, repeatable: { ...t.repeatable, completions: t.repeatable.completions.slice(0, -1) } }
}

/** turns a ToDo into a repeatable one; a finished ToDo keeps its completion (and points) */
export function makeRepeatable(t: Todo, cooldownMin = DEFAULT_COOLDOWN): Partial<Todo> {
  return {
    repeatable: { cooldownMin, completions: t.done && t.doneAt ? [t.doneAt] : (t.repeatable?.completions ?? []) },
    recurrence: null,
    done: false,
    doneAt: undefined
  }
}

/** ledger key of one completion; `@` keeps `todo:ab` apart from `todo:abc…` */
export const completionKey = (id: string, at: ISODateTime): string => `todo:${id}@${at}`
export const completionPrefix = (id: string): string => `todo:${id}@`

/** completions since `since` with their ledger keys */
export function completionsSince(t: Todo, since: ISODateTime): { key: string; at: ISODateTime }[] {
  return (t.repeatable?.completions ?? []).filter((at) => at >= since).map((at) => ({ key: completionKey(t.id, at), at }))
}

/** keys in `entries` that belong to completions the ToDo no longer has */
export function staleCompletionKeys(t: Todo, entries: Record<string, unknown>, live: Set<string>): string[] {
  const prefix = completionPrefix(t.id)
  return Object.keys(entries).filter((k) => k.startsWith(prefix) && !live.has(k))
}
