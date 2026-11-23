import { useMemo } from 'react'
import { addDays, isThisYear } from 'date-fns'
import type { Category, LocalDate, Todo, TodoList } from '@shared/types'
import { compareTodos, daysBetween, deadlineStatus, effectiveDeadline, localDate, parseLocalDate, type DeadlineStatus } from '@shared/todo'
import { useStore, type TodoView } from '../store'
import { fmt } from './dates'

export function useCategoryMap(): Map<string, Category> {
  const cats = useStore((s) => s.data?.categories)
  return useMemo(() => new Map((cats ?? []).map((c) => [c.id, c])), [cats])
}

export function useListMap(): Map<string, TodoList> {
  const lists = useStore((s) => s.data?.lists)
  return useMemo(() => new Map((lists ?? []).map((l) => [l.id, l])), [lists])
}

/** all open todos sorted by earliest deadline */
export function useOpenTodos(): Todo[] {
  const todos = useStore((s) => s.data?.todos)
  return useMemo(() => (todos ?? []).filter((t) => !t.done).sort(compareTodos), [todos])
}

export function matchesView(t: Todo, view: TodoView, today = localDate(new Date())): boolean {
  if (view === 'done') return t.done
  if (view.startsWith('list:')) return t.listId === view.slice(5)
  if (t.done) return false
  const eff = effectiveDeadline(t)
  switch (view) {
    case 'open':
      return true
    case 'today':
      return !!eff && eff <= today
    case 'week':
      return !!eff && eff <= localDate(addDays(new Date(), 7))
    case 'overdue': {
      const s = deadlineStatus(t, today)
      return s === 'overdue' || s === 'soft-missed'
    }
    case 'nodate':
      return !eff
  }
  return false
}

export const VIEW_LABELS: Record<string, string> = {
  open: 'Alle offenen',
  today: 'Heute fällig',
  week: 'Nächste 7 Tage',
  overdue: 'Überfällig',
  nodate: 'Ohne Deadline',
  done: 'Erledigt'
}

export interface TodoGroup {
  id: DeadlineStatus | 'done'
  label: string
  items: Todo[]
}

const GROUP_LABEL: Record<DeadlineStatus, string> = {
  overdue: 'Harte Deadline verpasst',
  'soft-missed': 'Weiche Deadline verpasst',
  today: 'Heute',
  soon: 'In den nächsten 3 Tagen',
  later: 'Später',
  none: 'Ohne Deadline'
}

export function groupTodos(todos: Todo[]): TodoGroup[] {
  const open = todos.filter((t) => !t.done).sort(compareTodos)
  const done = todos.filter((t) => t.done).sort(compareTodos)
  const order: DeadlineStatus[] = ['overdue', 'soft-missed', 'today', 'soon', 'later', 'none']
  const groups: TodoGroup[] = order
    .map((id) => ({ id, label: GROUP_LABEL[id], items: open.filter((t) => deadlineStatus(t) === id) }))
    .filter((g) => g.items.length > 0)
  if (done.length) groups.push({ id: 'done', label: 'Erledigt', items: done })
  return groups
}

/** "Heute", "Morgen", "Fr, 28. Nov." or "vor 2 Tagen" */
export function deadlineLabel(d: LocalDate, today = localDate(new Date())): string {
  const diff = daysBetween(today, d)
  if (diff === 0) return 'Heute'
  if (diff === 1) return 'Morgen'
  if (diff === -1) return 'Gestern'
  if (diff < -1) return `vor ${-diff} Tagen`
  const date = parseLocalDate(d)
  if (diff < 7) return fmt(date, 'EEEE')
  return fmt(date, isThisYear(date) ? 'EEE, d. MMM' : 'd. MMM yyyy')
}

export const PRIORITY_LABEL = ['Keine', 'Niedrig', 'Mittel', 'Hoch'] as const

export function formatEstimate(min?: number): string {
  if (!min) return ''
  if (min < 60) return `${min} Min.`
  const h = min / 60
  return `${h.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std.`
}

export const ESTIMATE_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480]
