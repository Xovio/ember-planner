import { localDate, parseLocalDate } from './todo'
import type { ISODateTime, Todo, TodoTemplate } from './types'

/**
 * ToDo templates ("Wohnung putzen" with its checklist): a preset that makes a fresh, normal ToDo
 * every time it is used. Unlike a repeatable ToDo, each use has its own checklist, deadlines and history.
 */

const dayDiff = (from: Date, to: Date): number =>
  Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86_400_000)

const plusDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** template from an existing ToDo; deadlines become "n days after making it" (never negative) */
export function templateFromTodo(t: Todo, id: string, now: Date = new Date(), ts: ISODateTime = now.toISOString()): TodoTemplate {
  const tpl: TodoTemplate = {
    id,
    name: t.title.trim() || 'Vorlage',
    title: t.title.trim(),
    listId: t.listId,
    priority: t.priority,
    subtasks: t.subtasks.map((s) => s.title.trim()).filter(Boolean),
    createdAt: ts,
    updatedAt: ts
  }
  if (t.categoryId) tpl.categoryId = t.categoryId
  if (t.difficulty !== undefined) tpl.difficulty = t.difficulty
  if (t.estimateMin) tpl.estimateMin = t.estimateMin
  if (t.notes?.trim()) tpl.notes = t.notes
  if (t.hardDeadline) tpl.hardInDays = Math.max(0, dayDiff(now, parseLocalDate(t.hardDeadline)))
  if (t.softDeadline) tpl.softInDays = Math.max(0, dayDiff(now, parseLocalDate(t.softDeadline)))
  return tpl
}

/** the fields of a new ToDo made from `tpl` today; `newId` makes the subtask ids */
export function todoFromTemplate(
  tpl: TodoTemplate,
  newId: () => string,
  opts: { now?: Date; listIds?: string[]; categoryIds?: string[] } = {}
): Partial<Todo> & { title: string } {
  const now = opts.now ?? new Date()
  const out: Partial<Todo> & { title: string } = {
    title: tpl.title.trim() || tpl.name.trim() || 'Vorlage',
    priority: tpl.priority,
    subtasks: tpl.subtasks.filter((s) => s.trim()).map((title) => ({ id: newId(), title: title.trim(), done: false }))
  }
  // a list or category that was deleted meanwhile is simply left out
  if (tpl.listId && (!opts.listIds || opts.listIds.includes(tpl.listId))) out.listId = tpl.listId
  if (tpl.categoryId && (!opts.categoryIds || opts.categoryIds.includes(tpl.categoryId))) out.categoryId = tpl.categoryId
  if (tpl.difficulty !== undefined) out.difficulty = tpl.difficulty
  if (tpl.estimateMin) out.estimateMin = tpl.estimateMin
  if (tpl.notes) out.notes = tpl.notes
  if (tpl.hardInDays !== undefined) out.hardDeadline = localDate(plusDays(now, tpl.hardInDays))
  if (tpl.softInDays !== undefined) out.softDeadline = localDate(plusDays(now, tpl.softInDays))
  return out
}

/** most used first, then by name */
export function sortTemplates(list: TodoTemplate[]): TodoTemplate[] {
  return [...list].sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0) || a.name.localeCompare(b.name, 'de'))
}

/** "am selben Tag", "am Tag danach", "nach 3 Tagen" */
export function inDaysLabel(n: number): string {
  if (n <= 0) return 'am selben Tag'
  if (n === 1) return 'am Tag danach'
  return `nach ${n} Tagen`
}
