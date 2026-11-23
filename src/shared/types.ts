/** ISO-8601 timestamp, e.g. "2026-11-23T14:00:00.000Z" */
export type ISODateTime = string
/** Local calendar date, "yyyy-MM-dd" */
export type LocalDate = string

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Recurrence {
  freq: RecurrenceFreq
  /** every n days/weeks/months/years */
  interval: number
  /** weekly only: 0 = Monday … 6 = Sunday */
  byWeekday?: number[]
  /** last possible day (inclusive) */
  until?: LocalDate
  /** total number of occurrences */
  count?: number
  /** start timestamps of occurrences that were deleted individually */
  exdates?: ISODateTime[]
}

/** Keys into the calendar palette; actual hex values depend on the theme. */
export type CalendarColor =
  | 'red'
  | 'blue'
  | 'orange'
  | 'aqua'
  | 'yellow'
  | 'violet'
  | 'magenta'
  | 'green'

export const CALENDAR_COLORS: CalendarColor[] = [
  'red',
  'blue',
  'orange',
  'aqua',
  'yellow',
  'violet',
  'magenta',
  'green'
]

export interface ExternalRef {
  provider: 'google'
  id: string
  etag?: string
  calendarId?: string
}

export interface CalendarInfo {
  id: string
  name: string
  color: CalendarColor
  visible: boolean
  /** events can't be changed here (e.g. a subscribed Google calendar) */
  readOnly?: boolean
  /** reminders the provider applies to events that use its defaults */
  defaultReminders?: number[]
  external?: ExternalRef
}

export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  /** for all-day events: local midnight of first day */
  start: ISODateTime
  /** exclusive; for all-day events: local midnight of the day after the last day */
  end: ISODateTime
  allDay: boolean
  location?: string
  notes?: string
  recurrence?: Recurrence | null
  /** minutes before start; 0 = at start */
  reminders: number[]
  external?: ExternalRef
  /** time block created by scheduling a ToDo */
  todoId?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export type Priority = 0 | 1 | 2 | 3

export interface TodoList {
  id: string
  name: string
  color: CalendarColor
}

export interface Category {
  id: string
  name: string
  color: CalendarColor
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Todo {
  id: string
  title: string
  listId: string
  categoryId?: string
  priority: Priority
  subtasks: Subtask[]
  /** 📅 in Obsidian Tasks format */
  hardDeadline?: LocalDate
  /** ⏳ in Obsidian Tasks format */
  softDeadline?: LocalDate
  estimateMin?: number
  linkedEventId?: string
  notes?: string
  done: boolean
  doneAt?: ISODateTime
  source?: { kind: 'obsidian'; vault: string; file: string; line: number }
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export type CalendarViewKind = 'day' | 'week' | 'month' | 'agenda'

export interface Settings {
  theme: string
  defaultView: CalendarViewKind
  defaultReminders: number[]
  defaultDurationMin: number
  launchAtLogin: boolean
  closeToTray: boolean
  reminderSound: boolean
  /** hour the day/week view scrolls to on open */
  dayStartHour: number
  /** calendar that receives time blocks created from ToDos */
  todoCalendarId: string
  /** notify on the morning of (and the day before) a hard deadline */
  deadlineReminders: boolean
  deadlineReminderHour: number
  /** show the ToDo panel next to the calendar */
  showTodoPanel: boolean
}

export interface AppData {
  version: 1
  calendars: CalendarInfo[]
  events: CalendarEvent[]
  lists: TodoList[]
  categories: Category[]
  todos: Todo[]
  settings: Settings
}

/** what the UI receives on start: the data plus the number of the last remote patch in it */
export interface LoadResult {
  data: AppData
  seq: number
}

export interface ReminderPayload {
  kind: 'event' | 'todo'
  /** event id or todo id */
  id: string
  title: string
  /** event start, or deadline day for todos */
  start: ISODateTime
  minutesBefore: number
  location?: string
  /** todos: human text like "Heute fällig" */
  note?: string
}

export interface TitleBarTheme {
  color: string
  symbolColor: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'ember',
  defaultView: 'week',
  defaultReminders: [10],
  defaultDurationMin: 60,
  launchAtLogin: false,
  closeToTray: true,
  reminderSound: true,
  dayStartHour: 7,
  todoCalendarId: 'personal',
  deadlineReminders: true,
  deadlineReminderHour: 9,
  showTodoPanel: true
}

export const INBOX_ID = 'inbox'

export function createDefaultData(): AppData {
  return {
    version: 1,
    calendars: [
      { id: 'personal', name: 'Persönlich', color: 'red', visible: true },
      { id: 'dnd', name: 'DnD & Kampagnen', color: 'violet', visible: true },
      { id: 'work', name: 'Projekte', color: 'blue', visible: true }
    ],
    events: [],
    lists: [
      { id: INBOX_ID, name: 'Eingang', color: 'red' },
      { id: 'projects', name: 'Projekte', color: 'blue' },
      { id: 'campaigns', name: 'Kampagnen-Prep', color: 'violet' }
    ],
    categories: [
      { id: 'cat-private', name: 'Privat', color: 'red' },
      { id: 'cat-project', name: 'Projekt', color: 'blue' },
      { id: 'cat-dnd', name: 'DnD', color: 'violet' },
      { id: 'cat-home', name: 'Haushalt', color: 'green' }
    ],
    todos: [],
    settings: { ...DEFAULT_SETTINGS }
  }
}

/** Fills in fields that older data files may lack. */
export function normalizeData(raw: Partial<AppData> | null | undefined): AppData {
  const base = createDefaultData()
  if (!raw) return base
  const lists = raw.lists?.length ? raw.lists : base.lists
  if (!lists.some((l) => l.id === INBOX_ID)) lists.unshift(base.lists[0])
  return {
    version: 1,
    calendars: raw.calendars?.length ? raw.calendars : base.calendars,
    events: raw.events ?? [],
    lists,
    categories: raw.categories ?? base.categories,
    todos: (raw.todos ?? []).map((t) => ({ ...t, subtasks: t.subtasks ?? [], priority: t.priority ?? 0 })),
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) }
  }
}
