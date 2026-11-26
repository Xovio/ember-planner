import { defaultRoom } from './room'

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
  provider: 'google' | 'discord'
  id: string
  etag?: string
  calendarId?: string
  /** last change at the provider (ISO) */
  updated?: string
}

/** connection of an event to a Discord scheduled event */
export interface DiscordLink {
  guildId: string
  eventId: string
  /** announced from this app (editable, follows the calendar event); false = someone else's event */
  own: boolean
  /** 'voice' = in a voice channel, 'external' = place or link */
  kind?: 'voice' | 'external'
  channelId?: string
  /** people marked as interested */
  userCount?: number
  /** Discord status: 1 planned, 2 running, 3 finished, 4 cancelled */
  status?: number
  /** own events: the fields as last seen at Discord */
  synced?: { name: string; start: string; end: string; location?: string; description?: string }
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
  /** Discord server: show all events, not only those you are interested in or created */
  discordAll?: boolean
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
  /** announced on / imported from a Discord server */
  discord?: DiscordLink
  /** created from this event template – the last one marks where the next placeholder goes */
  templateId?: string
  /** one building block of a weekly goal, e.g. one of "3× Gym"; checked off on the event */
  goal?: GoalLink
  /** set while the event lies in `AppData.eventTrash` */
  deletedAt?: ISODateTime
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface GoalLink {
  goalId: string
  done?: boolean
  doneAt?: ISODateTime
}

/** "3× Gym" per week: blocks are dragged into the week as events and checked off there */
export interface WeeklyGoal {
  id: string
  title: string
  /** blocks per week */
  count: number
  calendarId: string
  durationMin: number
  /** fixed times, put into every week automatically (e.g. Di 15:30 and Do 15:30); the rest is planned by hand */
  slots: GoalSlot[]
  /** only for this ISO week ("2026-W48"); absent = every week */
  week?: string
  /** weeks whose fixed times were already put in, so deleted ones don't come back */
  filledWeeks?: string[]
  /** blocks struck for a week ("not this week"): week → number struck */
  struck?: Record<string, number>
  archived?: boolean
  /** attribute that grows with each block; absent = guessed from the title */
  attribute?: AttrId | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface GoalSlot {
  /** 0 = Mo … 6 = So */
  day: number
  /** "HH:mm" */
  time: string
  durationMin: number
}

export type Difficulty = 0 | 1 | 2 | 3

export type AttrId = 'fitness' | 'stamina' | 'mind' | 'creativity' | 'order' | 'social'

/** one award: coins and, if any, XP for one attribute; keyed like the points ledger so nothing counts twice */
export interface Reward {
  at: ISODateTime
  coins: number
  attr?: AttrId
  xp: number
  label: string
}

/** look = identity, always free; outfit = bought items. No gender switch: every feature combines freely */
export interface AvatarLook {
  skin: number
  /** custom skin colour from the picker; wins over `skin` */
  skinHex?: string
  hair: string
  /** a HAIR_COLORS key or a custom '#rrggbb' */
  hairColor: string
  /** an EYE_COLORS key or a custom '#rrggbb' */
  eyes: string
  /** body width 0 (slim) … 2 (round) */
  build: number
  /** shoulders and hips */
  body: 'straight' | 'curvy' | 'broad'
  /** 0 small, 1 medium, 2 tall */
  height: number
  face: 'round' | 'oval' | 'square'
  eyeShape: 'round' | 'almond' | 'soft' | 'narrow' | 'small' | 'hooded'
  brows: 'thin' | 'soft' | 'thick' | 'arched' | 'unibrow' | 'slit'
  lashes: boolean
  beard: 'none' | 'stubble' | 'heavy' | 'short' | 'full' | 'long' | 'mustache' | 'handlebar' | 'goatee' | 'anchor' | 'chinstrap' | 'sideburns'
  nose: 'none' | 'dot' | 'button' | 'pointed' | 'wide'
  earrings: 'none' | 'studs' | 'hoops'
  piercing: 'none' | 'nose' | 'brow' | 'lip'
  scar: boolean
  freckles: boolean
  mole: boolean
  blush: boolean
  makeup: 'none' | 'lips' | 'liner' | 'both'
  glasses: boolean
  hearingAid: boolean
  wheelchair: boolean
}

export interface Character {
  /** false until the creator was finished once */
  created: boolean
  name: string
  look: AvatarLook
  /** slot → item id ("top" → "hoodie-coral") */
  outfit: Record<string, string>
  owned: string[]
  spent: number
  since: ISODateTime
  rewards: Record<string, Reward>
  /** furniture standing in the room; owned furniture that is not placed waits in the chest */
  room: Room
  /** idle animations switched off, and one to play all the time */
  idle?: { off: string[]; pinned?: string }
  /** saved outfits; `rotate` ones take turns automatically, a `tag` one is worn for matching activities */
  outfits?: SavedOutfit[]
  outfitCycle?: OutfitCycle
  /** the time window the last automatic outfit was picked for */
  outfitCycleKey?: string
}

export type OutfitTag = 'fitness' | 'work' | 'study' | 'creative' | 'dnd' | 'relax' | 'party'
export type OutfitCycle = 'off' | 'daily' | 'often'

export interface SavedOutfit {
  id: string
  name: string
  /** slot → item id, like Character.outfit */
  items: Record<string, string>
  rotate?: boolean
  tag?: OutfitTag
}

/** one piece of furniture in the room: floor tile (x, y) and turn 0–3, or a spot on a wall */
export interface PlacedFurniture {
  id: string
  x: number
  y: number
  rot: number
  /** wall items: left wall (along y) or right wall (along x); x is the spot along it */
  wall?: 'l' | 'r'
}

export interface Room {
  items: PlacedFurniture[]
  /** wallpaper and flooring ids; absent = the built-in cream wall and oak planks */
  wall?: string
  floor?: string
}

export type PointKind = 'todo' | 'goal' | 'goal-week' | 'goal-set' | 'session' | 'prep'

export interface PointEntry {
  at: ISODateTime
  kind: PointKind
  points: number
  label: string
}

/** points only ever grow: entries are keyed (e.g. "todo:<id>") so nothing counts twice */
export interface PointsLedger {
  /** nothing done before this moment earns points */
  since: ISODateTime
  entries: Record<string, PointEntry>
}

/** reusable presets for new events, e.g. "DnD-Session" (Fr 19:00, 4 h, Kalender DnD, Ort Discord) */
export interface EventTemplate {
  id: string
  name: string
  /** title of new events (falls back to the name) */
  title: string
  calendarId: string
  allDay: boolean
  /** usual start "HH:mm"; used when no time is given */
  startTime?: string
  durationMin: number
  location?: string
  notes?: string
  reminders: number[]
  /** "next session": show the next date as a grey placeholder until it is made a real event */
  rhythm?: TemplateRhythm
  /** defaults for announcing events of this template on Discord */
  discord?: TemplateDiscord
  /** placeholders before this day are skipped ("fällt aus") */
  skipUntil?: LocalDate
}

export interface TemplateRhythm {
  /** Mon=0 … Sun=6 */
  weekday: number
  /** every n weeks (1–4) */
  everyWeeks: number
}

export interface TemplateDiscord {
  guildId: string
  kind: 'voice' | 'external'
  channelId?: string
}

export type Priority = 0 | 1 | 2 | 3

export interface TodoList {
  id: string
  name: string
  color: CalendarColor
  /** sub-list of this list (one level): the parent becomes a project that shows all its sub-lists */
  parentId?: string
}

export interface Category {
  id: string
  name: string
  color: CalendarColor
  /** which character attribute grows when ToDos of this category are done; absent = guessed from the name */
  attribute?: AttrId | null
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
  /** 0 leicht · 1 mittel · 2 schwer · 3 episch – drives coins and attribute XP (priority stays urgency) */
  difficulty?: Difficulty
  linkedEventId?: string
  notes?: string
  done: boolean
  doneAt?: ISODateTime
  source?: { kind: 'obsidian'; vault: string; file: string; line: number }
  /** repeating ToDo: completing it creates the next instance (exdates unused) */
  recurrence?: Recurrence | null
  /** can be ticked off again and again (after a cooldown); such a ToDo is never `done` */
  repeatable?: Repeatable | null
  /** set while the ToDo lies in `AppData.trash` */
  deletedAt?: ISODateTime
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Repeatable {
  /** minutes after a completion before it can be ticked off again; 0 = right away */
  cooldownMin: number
  /** every completion, oldest first */
  completions: ISODateTime[]
}

/** reusable preset for ToDos ("Wohnung putzen" with its checklist): every use makes a fresh ToDo */
export interface TodoTemplate {
  id: string
  name: string
  /** title of new ToDos (falls back to the name) */
  title: string
  listId?: string
  categoryId?: string
  priority: Priority
  difficulty?: Difficulty
  /** checklist items; every new ToDo starts with all of them open */
  subtasks: string[]
  estimateMin?: number
  notes?: string
  /** deadlines relative to the day the ToDo is made: 0 = same day */
  hardInDays?: number
  softInDays?: number
  /** how often it was used (for sorting) */
  uses?: number
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
  font: string
  corners: string
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
  /** arrangement of the widgets on the overview page */
  overviewLayout: OverviewLayout
  /** per-widget options, keyed by widget id; each widget validates its own values */
  widgetConfig: Record<string, Record<string, unknown>>
  /** the character as a small companion at the bottom of other pages */
  companion: boolean
  /** companion panel unfolded (false = only the small tab) */
  companionOpen: boolean
}

/** half = one column, wide = two columns, full = the whole row */
export type WidgetSize = 'half' | 'wide' | 'full'

/** user's arrangement of registered widgets; ids that are no longer registered are ignored */
export interface OverviewLayout {
  /** widget ids in display order; ids missing here were never arranged and follow in default order */
  order: string[]
  hidden: string[]
  /** size chosen by the user, overriding the widget's default */
  sizes: Record<string, WidgetSize>
  /** number of grid columns; absent or 0 = as many as fit */
  columns?: number
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
  /** deleted events (series together with their changed occurrences), restorable for TRASH_DAYS */
  eventTrash: CalendarEvent[]
  templates: EventTemplate[]
  todoTemplates: TodoTemplate[]
  boards: Board[]
  goals: WeeklyGoal[]
  points: PointsLedger
  character: Character
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
  font: 'default',
  corners: 'soft',
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
  autoUpdate: true,
  overviewLayout: { order: [], hidden: [], sizes: {} },
  widgetConfig: {},
  companion: true,
  companionOpen: true
}

export const INBOX_ID = 'inbox'

export function defaultCharacter(): Character {
  return {
    created: false,
    name: '',
    look: {
      skin: 3,
      hair: 'bob',
      hairColor: 'ginger',
      eyes: 'plum',
      build: 1,
      body: 'straight',
      height: 1,
      face: 'round',
      eyeShape: 'round',
      brows: 'soft',
      lashes: false,
      beard: 'none',
      nose: 'none',
      earrings: 'none',
      piercing: 'none',
      scar: false,
      freckles: false,
      mole: false,
      blush: true,
      makeup: 'none',
      glasses: false,
      hearingAid: false,
      wheelchair: false
    },
    outfit: { top: 'hoodie-coral', bottom: 'pants-navy', shoes: 'sneakers-cream' },
    owned: ['hoodie-coral', 'pants-navy', 'sneakers-cream'],
    spent: 0,
    since: new Date().toISOString(),
    rewards: {},
    room: defaultRoom()
  }
}

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
    eventTrash: [],
    templates: [],
    todoTemplates: [],
    boards: [],
    goals: [],
    points: { since: new Date().toISOString(), entries: {} },
    character: defaultCharacter(),
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
    eventTrash: raw.eventTrash ?? [],
    templates: raw.templates ?? [],
    todoTemplates: (raw.todoTemplates ?? []).map((t) => ({ ...t, subtasks: t.subtasks ?? [], priority: t.priority ?? 0 })),
    boards: (raw.boards ?? []).map((b) => ({ ...b, notes: b.notes ?? [], frames: b.frames ?? [], edges: b.edges ?? [] })),
    goals: raw.goals ?? [],
    points: raw.points?.since ? { since: raw.points.since, entries: raw.points.entries ?? {} } : base.points,
    character: raw.character
      ? { ...base.character, ...raw.character, look: { ...base.character.look, ...raw.character.look }, room: { ...raw.character.room, items: raw.character.room?.items ?? base.character.room.items } }
      : base.character,
    settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) }
  }
}
