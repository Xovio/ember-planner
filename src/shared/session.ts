import { addDays, differenceInCalendarDays } from 'date-fns'
import type { CalendarEvent, CalendarInfo, Category, Todo, TodoList } from './types'
import { expandAll, type Occurrence } from './recurrence'
import { localDate } from './todo'

/** how far ahead the countdown looks for the next session */
export const SESSION_HORIZON_DAYS = 180

/** prep slots ("Session-Prep", "Vorbereitung") and ToDo time blocks are never the session itself */
const PREP = /prep|vorbereit/i

const CAMPAIGN = /d\s*(&|n|und)\s*d|kampagne|campaign|session|rollenspiel|pen\s*&?\s*paper/i

/** the calendar, list or category that looks most like a campaign: the demo ids first, then by name */
export function guessCampaign<T extends CalendarInfo | TodoList | Category>(items: T[], preferredId: string): string {
  return (items.find((i) => i.id === preferredId) ?? items.find((i) => CAMPAIGN.test(i.name)))?.id ?? ''
}

/**
 * The next session that has not ended yet: in `calendarId` (any calendar when empty), with `keyword`
 * in the title (any title when empty). All-day events, ToDo time blocks and prep slots are skipped. Recurring sessions are expanded.
 */
export function findNextSession(
  events: CalendarEvent[],
  opts: { calendarId: string; keyword: string },
  now: Date
): Occurrence | null {
  const kw = opts.keyword.trim().toLowerCase()
  const pool = events.filter(
    (e) =>
      !e.allDay &&
      !e.todoId &&
      !PREP.test(e.title) &&
      (!opts.calendarId || e.calendarId === opts.calendarId) &&
      (!kw || e.title.toLowerCase().includes(kw))
  )
  return expandAll(pool, now, addDays(now, SESSION_HORIZON_DAYS)).find((o) => o.end > now) ?? null
}

/** the earlier of the two deadlines, i.e. when the ToDo should be done */
const dueDate = (t: Todo): string | undefined =>
  [t.softDeadline, t.hardDeadline].filter((d): d is string => !!d).sort()[0]

/**
 * Open prep ToDos for a session: in the category or list (either matches; nothing when both are empty),
 * due on or before the session day or without a deadline. Sorted by deadline, undated ones last.
 */
export function prepTodos(
  todos: Todo[],
  opts: { categoryId: string; listId: string },
  sessionStart: Date
): Todo[] {
  if (!opts.categoryId && !opts.listId) return []
  const day = localDate(sessionStart)
  return todos
    .filter(
      (t) =>
        !t.done &&
        ((opts.categoryId && t.categoryId === opts.categoryId) || (opts.listId && t.listId === opts.listId)) &&
        (!dueDate(t) || dueDate(t)! <= day)
    )
    .sort((a, b) => (dueDate(a) ?? '9999').localeCompare(dueDate(b) ?? '9999') || b.priority - a.priority)
}

/** "läuft gerade", "heute", "morgen", "in 4 Tagen" */
export function sessionCountdown(session: Occurrence, now: Date): { big: string; small: string } {
  if (session.start <= now) return { big: 'Jetzt', small: 'läuft gerade' }
  const days = differenceInCalendarDays(session.start, now)
  if (days === 0) return { big: 'Heute', small: 'ist Session' }
  if (days === 1) return { big: 'Morgen', small: 'ist Session' }
  return { big: String(days), small: 'Tage bis zur Session' }
}
