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
  /** start timestamps of occurrences that were deleted or moved individually */
  exdates?: ISODateTime[]
  /**
   * Original RRULE (without "RRULE:") when the rule needs more than the fields above,
   * e.g. "FREQ=MONTHLY;BYDAY=2TU". Then it wins over freq/interval/… for expansion,
   * which only stay as an approximation for display.
   */
  rrule?: string
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
  /** last change at the provider (ISO) */
  updated?: string
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
  /** single occurrence that was changed: id of the series it belongs to */
  seriesId?: string
  /** single occurrence that was changed: its start in the series (the series has it as exdate) */
  originalStart?: ISODateTime
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
  /** repeating ToDo: completing it creates the next instance (exdates unused) */
  recurrence?: Recurrence | null
  /** set while the ToDo lies in `AppData.trash` */
  deletedAt?: ISODateTime
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/** days a deleted ToDo stays in the trash */
export const TRASH_DAYS = 30
/** done ToDos older than this many days move to the archive view */
export const ARCHIVE_DAYS = 14

/* ───────────── Brainstorm boards ───────────── */

/** sticky note on a board; position/size in board coordinates (px at zoom 1) */
export interface BoardNote {
  id: string
  x: number
  y: number
  w: number
  text: string
  color: CalendarColor
  /** dot votes */
  votes: number
  /** marked as a next step: exported as `- [ ]` */
  action?: boolean
  /** ToDo created from this note */
  todoId?: string
}

/** frame that groups the notes whose center lies inside it */
export interface BoardFrame {
  id: string
  x: number
  y: number
  w: number
  h: number
  title: string
  color: CalendarColor
}

export interface BoardEdge {
  id: string
  from: string
  to: string
}

export interface Board {
  id: string
  title: string
  notes: BoardNote[]
  frames: BoardFrame[]
  edges: BoardEdge[]
  /** the user's own conclusion, exported above the structure */
  summary?: string
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
  /** show public holidays in the calendar (computed, never stored as events) */
  showHolidays: boolean
  /** 'DE' = nationwide only, 'DE-BY' etc. = with state holidays */
  holidayRegion: string
  /** look for new versions on GitHub and install them on quit (installed app only) */
  autoUpdate: boolean
}

export interface AppData {
  version: 1
  calendars: CalendarInfo[]
  events: CalendarEvent[]
  lists: TodoList[]
  categories: Category[]
  todos: Todo[]
  /** deleted ToDos, restorable for TRASH_DAYS; kept apart so no view or reminder sees them */
  trash: Todo[]
  boards: Board[]
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
  showTodoPanel: true,
  showHolidays: false,
  holidayRegion: 'DE',
  autoUpdate: true
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
    trash: [],
    boards: [],
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
    trash: raw.trash ?? [],
    boards: (raw.boards ?? []).map((b) => ({ ...b, notes: b.notes ?? [], frames: b.frames ?? [], edges: b.edges ?? [] })),
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) }
  }
}
