import { INBOX_ID, type Todo, type TodoList } from './types'

/**
 * Projects: a list with sub-lists (one level deep). The parent shows the ToDos of all its sub-lists
 * and how far the project is.
 */

export const childLists = (lists: TodoList[], id: string): TodoList[] => lists.filter((l) => l.parentId === id)

export const isProject = (lists: TodoList[], id: string): boolean => lists.some((l) => l.parentId === id)

/** the list itself plus its sub-lists */
export function listScope(lists: TodoList[], id: string): Set<string> {
  return new Set([id, ...childLists(lists, id).map((l) => l.id)])
}

/** parents in their order, each followed by its sub-lists; sub-lists whose parent is gone count as top-level */
export function sortedLists(lists: TodoList[]): { list: TodoList; depth: 0 | 1 }[] {
  const ids = new Set(lists.map((l) => l.id))
  const top = lists.filter((l) => !l.parentId || !ids.has(l.parentId) || l.parentId === l.id)
  return top.flatMap((l) => [{ list: l, depth: 0 as const }, ...childLists(lists, l.id).filter((c) => c.id !== l.id).map((c) => ({ list: c, depth: 1 as const }))])
}

/** "Umzug › Küche" for a sub-list, the plain name otherwise */
export function listLabel(lists: TodoList[], l: TodoList): string {
  const parent = l.parentId ? lists.find((x) => x.id === l.parentId) : undefined
  return parent ? `${parent.name} › ${l.name}` : l.name
}

/** lists `id` may be put under: top-level lists other than itself and the inbox; none if it has sub-lists itself */
export function parentOptions(lists: TodoList[], id: string): TodoList[] {
  if (id === INBOX_ID || isProject(lists, id)) return []
  return sortedLists(lists)
    .filter((x) => x.depth === 0 && x.list.id !== id && x.list.id !== INBOX_ID)
    .map((x) => x.list)
}

export interface Progress {
  done: number
  total: number
}

/** done of all ToDos in the lists; repeatable ToDos are never done for good and don't count */
export function listProgress(todos: Todo[], scope: Set<string>): Progress {
  let done = 0
  let total = 0
  for (const t of todos) {
    if (!scope.has(t.listId) || t.repeatable) continue
    total++
    if (t.done) done++
  }
  return { done, total }
}
