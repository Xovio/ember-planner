import { useCallback, useMemo } from 'react'
import { create } from 'zustand'
import { addDays, addMonths, addWeeks, startOfDay } from 'date-fns'
import {
  INBOX_ID,
  TRASH_DAYS,
  normalizeData,
  type AppData,
  type Board,
  type CalendarEvent,
  type CalendarInfo,
  type CalendarViewKind,
  type Category,
  type EventTemplate,
  type ReminderPayload,
  type Settings,
  type Todo,
  type TodoList,
  type PointsLedger,
  type Character,
  type WeeklyGoal
} from '@shared/types'
import { applyPatch, type RemoteChange } from '@shared/patch'
import { isCalendarLocked } from '@shared/google'
import { api, isDemo } from './lib/api'
import { holidayOn } from '@shared/holidays'
import { daysBetween, localDate, nextRecurrence, parseLocalDate } from '@shared/todo'
import { detachOccurrence, endSeriesBefore, splitSeries } from '@shared/series'
import { goalEvent, markFilled, slotsToFill, weekKey } from '@shared/goals'
import { attrLevel, attrXp, coinBalance } from '@shared/character'
import { itemById } from '@shared/wardrobe'
import {
  isPlaceholderId,
  placeholderEvent,
  placeholderTemplateId,
  skipPlaceholder,
  templateFromEvent,
  templateKey
} from '@shared/templates'

/* ───────────── UI types ───────────── */

export type CorePage = 'plan' | 'todos' | 'overview' | 'ideas' | 'settings'
/** a registered page id (see plugins/registry); core ids are listed for autocompletion */
export type Page = CorePage | (string & {})
export type RightTab = 'todos' | 'today' | 'details'

export type Selection =
  | { kind: 'event'; id: string; occurrenceStart?: string }
  | { kind: 'todo'; id: string }
  | null

/** screen rectangle a popover attaches to */
export interface Anchor {
  x: number
  y: number
  w: number
  h: number
}

export interface QuickCreateState {
  start: string
  end: string
  allDay: boolean
  anchor: Anchor
  /** "Fertig machen": turns the placeholder of this template into a real event */
  placeholderOf?: string
}

export interface PreviewState {
  eventId: string
  occurrenceStart?: string
  anchor: Anchor
}

export interface MenuItem {
  label?: string
  hint?: string
  danger?: boolean
  checked?: boolean
  separator?: boolean
  /** color swatch (CSS value) shown before the label */
  swatch?: string
  action?: () => void
  items?: MenuItem[]
}

export interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

/** a question before an action that others will see and that can't be taken back (e.g. a Discord cancellation) */
export interface ConfirmState {
  title: string
  body: string
  confirmLabel: string
  action: () => void
}

export interface Toast {
  id: string
  kind: 'reminder' | 'deadline' | 'info' | 'undo'
  title: string
  body?: string
  eventId?: string
  todoId?: string
}

/** smart views or a user list ("list:<id>") */
export type TodoView = 'open' | 'today' | 'week' | 'overdue' | 'nodate' | 'done' | 'archive' | 'trash' | `list:${string}`

export type NewTodo = Partial<Todo> & { title: string }

export type AddKind = 'auto' | 'event' | 'todo'

interface MutateOpts {
  /** history label; omit together with history:false for silent changes */
  label?: string
  /** consecutive changes with the same key within 1.5 s form one undo step */
  coalesce?: string
  history?: boolean
  /** show a toast with an undo button */
  undoToast?: boolean
}

interface State {
  data: AppData | null
  page: Page
  view: CalendarViewKind
  cursor: Date
  rightTab: RightTab
  selection: Selection
  quickCreate: QuickCreateState | null
  preview: PreviewState | null
  contextMenu: ContextMenuState | null
  overlay:
    | { kind: 'add'; addKind: AddKind; prefill?: string }
    | { kind: 'palette' }
    | { kind: 'help' }
    | { kind: 'announce'; eventId: string }
    | null
  confirm: ConfirmState | null
  toasts: Toast[]
  todoView: TodoView
  todoCategory: string | null
  /** multi-selection in ToDo lists */
  picked: string[]
  canUndo: boolean
  canRedo: boolean
  /** open brainstorm board */
  boardId: string | null

  init(): Promise<void>
  /** change from the main process (e.g. Google sync) – not an undo step */
  applyRemote(change: RemoteChange): void
  setPage(p: Page): void
  setView(v: CalendarViewKind): void
  setCursor(d: Date): void
  step(dir: -1 | 1): void
  goToday(): void
  setRightTab(t: RightTab): void
  togglePanel(open?: boolean): void

  select(sel: Selection): void
  selectEvent(id: string, occurrenceStart?: string): void
  selectTodo(id: string): void
  clearSelection(): void
  setQuickCreate(q: QuickCreateState | null): void
  setPreview(p: PreviewState | null): void
  openMenu(x: number, y: number, items: MenuItem[]): void
  closeMenu(): void
  openAdd(addKind?: AddKind, prefill?: string): void
  openPalette(): void
  openHelp(): void
  closeOverlay(): void
  /** opens the "In Discord ankündigen" dialog; a series occurrence is detached first */
  openAnnounce(eventId: string, occurrenceStart?: string): void
  askConfirm(c: ConfirmState | null): void

  undo(): void
  redo(): void

  createEvent(ev: Partial<CalendarEvent> & { start: string; end: string }, opts?: { select?: boolean }): string
  updateEvent(id: string, patch: Partial<CalendarEvent>, coalesce?: string): void
  /** `confirmed`: the user agreed that a Discord announcement gets cancelled */
  deleteEvent(id: string, scope: 'all' | 'one' | 'following', occurrenceStart?: string, confirmed?: boolean): void
  /**
   * Splits a series for editing: 'one' makes the occurrence an own event, 'following' starts a new
   * series there. Selects and returns the id to edit from now on.
   */
  editOccurrence(id: string, occurrenceStart: string, scope: 'one' | 'following'): string
  /** brings events back from the trash (a series with its changed occurrences) */
  restoreEvents(ids: string[]): void
  /** removes events from the trash for good (still undoable in this session) */
  purgeEvents(ids: string[] | 'all'): void
  /** moves a single occurrence of a series (only this one) */
  moveOccurrence(id: string, occurrenceStart: string, start: Date, end: Date): void
  duplicateEvent(id: string): void
  moveEvent(id: string, start: Date, end: Date): void

  /** saves an event as a template and returns its id */
  saveAsTemplate(eventId: string): string
  upsertTemplate(t: EventTemplate): void
  /** "fällt aus": the placeholder of this template moves on one step */
  skipPlaceholder(templateId: string): void
  /** click on a placeholder: open "Fertig machen" at it */
  openPlaceholder(templateId: string, anchor: Anchor): void
  removeTemplate(id: string): void

  upsertCalendar(c: CalendarInfo): void
  removeCalendar(id: string): void
  toggleCalendar(id: string): void
  updateSettings(patch: Partial<Settings>): void

  setTodoView(v: TodoView): void
  setTodoCategory(id: string | null): void
  setPicked(ids: string[]): void
  addTodo(t: NewTodo): string
  updateTodo(id: string, patch: Partial<Todo>, coalesce?: string): void
  updateTodos(ids: string[], patch: Partial<Todo>, label: string): void
  toggleTodo(id: string): void
  toggleTodos(ids: string[], done: boolean): void
  /** moves ToDos to the trash */
  deleteTodos(ids: string[]): void
  restoreTodos(ids: string[]): void
  /** removes ToDos from the trash for good (still undoable in this session) */
  purgeTodos(ids: string[] | 'all'): void
  upsertList(l: TodoList): void
  removeList(id: string): void
  upsertCategory(c: Category): void
  removeCategory(id: string): void
  scheduleTodo(todoId: string, start: Date, end: Date): void

  /* weekly goals */
  upsertGoal(g: WeeklyGoal): void
  /** archived goals keep their past blocks and points */
  archiveGoal(id: string): void
  /** a block of the goal as an event at `start` */
  planGoalBlock(goalId: string, start: Date, durationMin?: number): void
  setGoalDone(eventId: string, done: boolean): void
  /** missed or unwanted block: back to the pool (event into the trash) */
  returnGoalBlock(eventId: string): void
  /** not this week: event into the trash and one block less for that week */
  strikeGoalBlock(eventId: string): void
  /** puts the fixed times of all goals into this and next week (once per week) */
  fillGoalSlots(now?: Date): void
  /** silent: the points ledger after reconciling */
  setPoints(points: PointsLedger): void

  /* character */
  updateCharacter(patch: Partial<Character>, label?: string): void
  /** spends coins; false when too few or locked */
  buyItem(id: string): boolean
  /** put on an owned item, or take off an optional slot (null) */
  equip(slot: string, id: string | null): void
  /** silent: rewards after reconciling */
  setRewards(rewards: Character['rewards']): void

  /** replace all data (restore / import) – one undo step */
  replaceData(next: AppData, label: string): void
  /** add imported ToDos to the inbox */
  importTodos(todos: NewTodo[], label: string): void

  openBoard(id: string | null): void
  addBoard(title?: string): string
  /** change one board; `coalesce` merges quick consecutive edits into one undo step */
  editBoard(id: string, fn: (b: Board) => Board, label: string, coalesce?: string): void
  deleteBoard(id: string): void
  /** creates a ToDo from a note and links both */
  noteToTodo(boardId: string, noteId: string): void

  pushToast(t: Omit<Toast, 'id'>): void
  dismissToast(id: string): void
  onReminder(p: ReminderPayload): void
}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/** number of the last remote change contained in the local data */
let remoteSeq = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
/** saves the newest state (read when the timer fires, so remote changes received meanwhile are included) */
function persist(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const data = useStore.getState().data
    if (data) void api.save(data, remoteSeq)
  }, 250)
}

/** calendars new events may go into (not read-only, not a Google calendar while writing back is off) */
export function writableCalendars(data: AppData): CalendarInfo[] {
  return data.calendars.filter((c) => !isCalendarLocked(c))
}

/** first writable calendar, preferring `preferred` and visible ones */
function writableCalendarId(data: AppData, preferred?: string): string {
  const ok = writableCalendars(data)
  if (preferred && ok.some((c) => c.id === preferred)) return preferred
  return (ok.find((c) => c.visible) ?? ok[0] ?? data.calendars[0])?.id ?? 'personal'
}

export function isEventLocked(data: AppData, ev: CalendarEvent | undefined): boolean {
  return !!ev && isCalendarLocked(data.calendars.find((c) => c.id === ev.calendarId))
}

const HISTORY_MAX = 100
interface HistoryEntry {
  data: AppData
  label: string
}

export const useStore = create<State>((set, get) => {
  const past: HistoryEntry[] = []
  const future: HistoryEntry[] = []
  let lastCoalesce: { key: string; at: number } | null = null

  const syncHistoryFlags = (): void => set({ canUndo: past.length > 0, canRedo: future.length > 0 })

  /** apply a change to the persisted data, recording it for undo */
  const mutate = (fn: (d: AppData) => AppData, opts: MutateOpts = {}): void => {
    const cur = get().data
    if (!cur) return
    const next = fn(cur)
    if (next === cur) return
    const record = opts.history !== false
    if (record) {
      const now = Date.now()
      const merge = opts.coalesce && lastCoalesce?.key === opts.coalesce && now - lastCoalesce.at < 1500
      if (!merge) {
        past.push({ data: cur, label: opts.label ?? 'Änderung' })
        if (past.length > HISTORY_MAX) past.shift()
      }
      lastCoalesce = opts.coalesce ? { key: opts.coalesce, at: now } : null
      future.length = 0
    }
    set({ data: next })
    persist()
    if (record) syncHistoryFlags()
    if (opts.undoToast && opts.label) get().pushToast({ kind: 'undo', title: opts.label })
  }

  const stamp = (): string => new Date().toISOString()
  const toHm = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  /** after undo/redo the selected item may be gone */
  const dropStaleSelection = (): void => {
    const { selection, data } = get()
    if (!selection || !data) return
    const exists =
      selection.kind === 'event'
        ? data.events.some((e) => e.id === selection.id)
        : data.todos.some((t) => t.id === selection.id) || data.trash.some((t) => t.id === selection.id)
    if (!exists) get().clearSelection()
  }

  /** true (and a hint) when the event can't be changed here */
  const locked = (id: string): boolean => {
    const data = get().data
    if (!data || !isEventLocked(data, data.events.find((e) => e.id === id))) return false
    get().pushToast({ kind: 'info', title: 'Dieser Kalender ist schreibgeschützt' })
    return true
  }

  return {
    data: null,
    page: 'plan',
    view: 'week',
    cursor: startOfDay(new Date()),
    rightTab: 'todos',
    selection: null,
    quickCreate: null,
    preview: null,
    contextMenu: null,
    overlay: null,
    confirm: null,
    toasts: [],
    todoView: 'open',
    todoCategory: null,
    picked: [],
    canUndo: false,
    canRedo: false,
    boardId: null,

    async init() {
      const { data, seq } = await api.load()
      remoteSeq = seq
      set({ data, view: data.settings.defaultView })
      // empty the trash of entries older than TRASH_DAYS (not undoable: they expired)
      const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString()
      const expired = (x: { deletedAt?: string }): boolean => (x.deletedAt ?? '') < cutoff
      if (data.trash.some(expired) || data.eventTrash.some(expired)) {
        mutate(
          (d) => ({
            ...d,
            trash: d.trash.filter((t) => !expired(t)),
            eventTrash: d.eventTrash.filter((e) => !expired(e))
          }),
          { history: false }
        )
      }
      get().fillGoalSlots()
      if (isDemo) applyDemoParams()
    },

    /* ── navigation ── */
    setPage: (page) => set({ page, quickCreate: null, preview: null, picked: [] }),
    setView: (view) => set({ view, page: 'plan', quickCreate: null, preview: null }),
    setCursor: (d) => set({ cursor: startOfDay(d) }),
    step(dir) {
      const { view, cursor } = get()
      const next =
        view === 'day'
          ? addDays(cursor, dir)
          : view === 'week'
            ? addWeeks(cursor, dir)
            : view === 'month'
              ? addMonths(cursor, dir)
              : addWeeks(cursor, dir * 4)
      set({ cursor: next, quickCreate: null, preview: null })
    },
    goToday: () => set({ cursor: startOfDay(new Date()) }),
    setRightTab(rightTab) {
      set({ rightTab })
      if (!get().data?.settings.showTodoPanel) get().togglePanel(true)
    },
    togglePanel(open) {
      const cur = get().data?.settings.showTodoPanel
      mutate((d) => ({ ...d, settings: { ...d.settings, showTodoPanel: open ?? !cur } }), { history: false })
    },

    /* ── selection & overlays ── */
    select(selection) {
      set({ selection, preview: null, quickCreate: null, ...(selection ? { rightTab: 'details' as const } : {}) })
      if (selection && !get().data?.settings.showTodoPanel) get().togglePanel(true)
    },
    selectEvent: (id, occurrenceStart) =>
      // placeholders are not events: they open "Fertig machen" instead (see clickOccurrence)
      isPlaceholderId(id) ? undefined : get().select({ kind: 'event', id, occurrenceStart }),
    selectTodo: (id) => get().select({ kind: 'todo', id }),
    clearSelection() {
      const wasDetails = get().rightTab === 'details'
      set({ selection: null, ...(wasDetails ? { rightTab: 'todos' as const } : {}) })
    },
    setQuickCreate: (quickCreate) => set({ quickCreate, preview: null, contextMenu: null }),
    setPreview: (preview) => set({ preview, quickCreate: null, contextMenu: null }),
    openMenu: (x, y, items) => set({ contextMenu: { x, y, items }, preview: null }),
    closeMenu: () => set({ contextMenu: null }),
    openAdd: (addKind = 'auto', prefill) =>
      set({ overlay: { kind: 'add', addKind, prefill }, quickCreate: null, preview: null, contextMenu: null }),
    openPalette: () => set({ overlay: { kind: 'palette' }, quickCreate: null, preview: null, contextMenu: null }),
    openHelp: () => set({ overlay: { kind: 'help' }, quickCreate: null, preview: null, contextMenu: null }),
    closeOverlay: () => set({ overlay: null }),
    openAnnounce(eventId, occurrenceStart) {
      const ev = get().data?.events.find((e) => e.id === eventId)
      if (!ev) return
      const id = ev.recurrence && occurrenceStart ? get().editOccurrence(eventId, occurrenceStart, 'one') : eventId
      set({ overlay: { kind: 'announce', eventId: id }, quickCreate: null, preview: null, contextMenu: null })
    },
    askConfirm: (confirm) => set({ confirm, contextMenu: null }),

    applyRemote({ seq, patch }) {
      const cur = get().data
      // before load finished the loaded data already contains it; older numbers were seen already
      if (!cur || seq <= remoteSeq) return
      remoteSeq = seq
      // rebase the undo history so undoing a local step does not revert the remote change
      for (const entry of past) entry.data = applyPatch(entry.data, patch)
      for (const entry of future) entry.data = applyPatch(entry.data, patch)
      set({ data: applyPatch(cur, patch) })
    },

    /* ── history ── */
    undo() {
      const cur = get().data
      const entry = past.pop()
      if (!entry || !cur) return
      future.push({ data: cur, label: entry.label })
      lastCoalesce = null
      set({ data: entry.data })
      persist()
      syncHistoryFlags()
      dropStaleSelection()
      get().pushToast({ kind: 'info', title: `Rückgängig: ${entry.label}` })
    },
    redo() {
      const cur = get().data
      const entry = future.pop()
      if (!entry || !cur) return
      past.push({ data: cur, label: entry.label })
      lastCoalesce = null
      set({ data: entry.data })
      persist()
      syncHistoryFlags()
      dropStaleSelection()
      get().pushToast({ kind: 'info', title: `Wiederholt: ${entry.label}` })
    },

    /* ── events ── */
    createEvent(partial, opts = {}) {
      const data = get().data
      if (!data) return ''
      const ts = stamp()
      const ev: CalendarEvent = {
        id: uid(),
        title: '',
        allDay: false,
        reminders: [...data.settings.defaultReminders],
        recurrence: null,
        createdAt: ts,
        updatedAt: ts,
        ...partial,
        calendarId: writableCalendarId(data, partial.calendarId)
      }
      mutate((d) => ({ ...d, events: [...d.events, ev] }), { label: 'Termin angelegt' })
      set({ quickCreate: null })
      if (opts.select) get().selectEvent(ev.id)
      return ev.id
    },

    updateEvent(id, patch, coalesce) {
      if (locked(id)) return
      mutate(
        (d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: stamp() } : e)) }),
        { label: 'Termin bearbeitet', coalesce: coalesce ? `ev:${id}:${coalesce}` : undefined }
      )
    },

    deleteEvent(id, scope, occurrenceStart, confirmed) {
      const data = get().data
      const ev = data?.events.find((e) => e.id === id)
      if (!ev || locked(id)) return
      // an announced session: others will see the cancellation, so ask first
      const wholeEvent = scope === 'all' || !ev.recurrence || !occurrenceStart
      const link = ev.discord
      if (wholeEvent && !confirmed && link?.own && (link.status === undefined || link.status <= 2)) {
        const server = data!.calendars.find((c) => c.id === `d:${link.guildId}`)?.name ?? 'Discord'
        const people = link.userCount ? ` – ${link.userCount === 1 ? '1 Person ist' : `${link.userCount} Personen sind`} interessiert` : ''
        get().askConfirm({
          title: 'Termin löschen und in Discord absagen?',
          body: `„${ev.title || '(Ohne Titel)'}“ ist auf ${server} angekündigt${people}. Das Event wird dort abgesagt, alle sehen die Absage. Das lässt sich in Discord nicht zurücknehmen – den Termin selbst holst du mit Strg+Z oder aus dem Papierkorb zurück.`,
          confirmLabel: 'Löschen und absagen',
          action: () => get().deleteEvent(id, scope, occurrenceStart, true)
        })
        return
      }
      const title = ev.title || '(Ohne Titel)'
      const series = !!ev.recurrence && !!occurrenceStart
      mutate(
        (d) => {
          if (scope === 'following' && series) {
            const events = endSeriesBefore(d.events, id, occurrenceStart!, stamp())
            const ids = new Set(events.map((e) => e.id))
            return {
              ...d,
              events,
              todos: d.todos.map((t) =>
                t.linkedEventId && !ids.has(t.linkedEventId) ? { ...t, linkedEventId: undefined } : t
              )
            }
          }
          if (scope === 'one' && occurrenceStart && ev.recurrence) {
            return {
              ...d,
              events: d.events.map((e) =>
                e.id === id && e.recurrence
                  ? {
                      ...e,
                      updatedAt: stamp(),
                      recurrence: { ...e.recurrence, exdates: [...(e.recurrence.exdates ?? []), occurrenceStart] }
                    }
                  : e
              )
            }
          }
          // into the trash, a series together with its changed occurrences
          const ts = stamp()
          const gone = d.events.filter((e) => e.id === id || (ev.recurrence && e.seriesId === id))
          const goneIds = new Set(gone.map((e) => e.id))
          return {
            ...d,
            events: d.events.filter((e) => !goneIds.has(e.id)),
            eventTrash: [...gone.map((e) => ({ ...e, deletedAt: ts })), ...d.eventTrash],
            todos: d.todos.map((t) =>
              t.linkedEventId && goneIds.has(t.linkedEventId) ? { ...t, linkedEventId: undefined } : t
            )
          }
        },
        {
          label:
            scope === 'one' && series
              ? `„${title}“ (ein Termin) gelöscht`
              : scope === 'following' && series
                ? `„${title}“ ab diesem Termin gelöscht`
                : `„${title}“ im Papierkorb`,
          undoToast: true
        }
      )
      const sel = get().selection
      if (sel?.kind === 'event' && sel.id === id) get().clearSelection()
      set({ preview: null })
    },

    restoreEvents(ids) {
      const data = get().data
      if (!data) return
      // a restored series brings its changed occurrences along
      const pick = new Set(ids)
      for (const e of data.eventTrash) if (e.seriesId && pick.has(e.seriesId)) pick.add(e.id)
      const back = data.eventTrash.filter((e) => pick.has(e.id))
      if (!back.length) return
      const first = back.find((e) => e.id === ids[0]) ?? back[0]
      // new ids: at Google the old events are gone (or about to be), so they are uploaded as new ones
      const newId = new Map(back.map((e) => [e.id, uid()]))
      const ts = stamp()
      mutate(
        (d) => {
          const live = new Set(d.events.map((e) => e.id))
          const todos = new Map(d.todos.map((t) => [t.id, t]))
          const relink = new Map<string, string>()
          const restored = back.map((e) => {
            const id = newId.get(e.id)!
            const seriesId = e.seriesId ? (newId.get(e.seriesId) ?? (live.has(e.seriesId) ? e.seriesId : undefined)) : undefined
            const todo = e.todoId ? todos.get(e.todoId) : undefined
            const keepTodo = !!todo && !todo.linkedEventId && !relink.has(todo.id)
            if (keepTodo) relink.set(todo.id, id)
            return {
              ...e,
              id,
              calendarId: writableCalendarId(d, e.calendarId),
              external: undefined,
              // the Discord event was cancelled when the event was deleted: announce again if wanted
              discord: undefined,
              deletedAt: undefined,
              seriesId,
              originalStart: seriesId ? e.originalStart : undefined,
              todoId: keepTodo ? e.todoId : undefined,
              updatedAt: ts
            }
          })
          return {
            ...d,
            // the series first, so it reaches Google before its changed occurrences
            events: [...d.events, ...restored.filter((e) => !e.seriesId), ...restored.filter((e) => e.seriesId)],
            eventTrash: d.eventTrash.filter((e) => !pick.has(e.id)),
            todos: relink.size
              ? d.todos.map((t) => (relink.has(t.id) ? { ...t, linkedEventId: relink.get(t.id), updatedAt: ts } : t))
              : d.todos
          }
        },
        {
          label: ids.length > 1 ? `${ids.length} Termine wiederhergestellt` : `„${first.title || '(Ohne Titel)'}“ wiederhergestellt`,
          undoToast: true
        }
      )
    },

    purgeEvents(ids) {
      const trash = get().data?.eventTrash ?? []
      const pick = new Set(ids === 'all' ? trash.map((e) => e.id) : ids)
      for (const e of trash) if (e.seriesId && pick.has(e.seriesId)) pick.add(e.id)
      if (!pick.size) return
      const first = trash.find((e) => e.id === (ids === 'all' ? '' : ids[0]))
      mutate((d) => ({ ...d, eventTrash: d.eventTrash.filter((e) => !pick.has(e.id)) }), {
        label:
          ids === 'all'
            ? 'Termine im Papierkorb gelöscht'
            : ids.length > 1
              ? `${ids.length} Termine endgültig gelöscht`
              : `„${first?.title || '(Ohne Titel)'}“ endgültig gelöscht`,
        undoToast: true
      })
    },

    editOccurrence(id, occurrenceStart, scope) {
      const ev = get().data?.events.find((e) => e.id === id)
      if (!ev?.recurrence || locked(id)) return id
      const title = ev.title || '(Ohne Titel)'
      let target = id
      mutate(
        (d) => {
          if (scope === 'one') {
            target = uid()
            return { ...d, events: detachOccurrence(d.events, id, occurrenceStart, target, stamp()) }
          }
          const r = splitSeries(d.events, id, occurrenceStart, uid(), stamp(), uid)
          target = r.id
          return r.events === d.events ? d : { ...d, events: r.events }
        },
        {
          label: scope === 'one' ? `„${title}“: Termin aus der Serie gelöst` : `„${title}“: Serie ab hier geteilt`
        }
      )
      if (target !== id) get().selectEvent(target, scope === 'following' ? occurrenceStart : undefined)
      return target
    },

    moveOccurrence(id, occurrenceStart, start, end) {
      if (locked(id)) return
      const title = get().data?.events.find((e) => e.id === id)?.title || '(Ohne Titel)'
      mutate(
        (d) => ({
          ...d,
          events: detachOccurrence(d.events, id, occurrenceStart, uid(), stamp(), {
            start: start.toISOString(),
            end: end.toISOString()
          })
        }),
        { label: `„${title}“ verschoben (nur dieser Termin)`, undoToast: true }
      )
    },

    duplicateEvent(id) {
      const data = get().data
      const ev = data?.events.find((e) => e.id === id)
      if (!data || !ev) return
      // a copy of a Google event lands in a local calendar; single changed occurrences become plain events
      const copy: CalendarEvent = {
        ...structuredClone(ev),
        id: uid(),
        calendarId: writableCalendarId(data, ev.calendarId),
        todoId: undefined,
        external: undefined,
        discord: undefined,
        seriesId: undefined,
        originalStart: undefined
      }
      mutate((d) => ({ ...d, events: [...d.events, copy] }), { label: 'Termin dupliziert', undoToast: true })
      get().selectEvent(copy.id)
    },

    moveEvent(id, start, end) {
      if (locked(id)) return
      mutate(
        (d) => ({
          ...d,
          events: d.events.map((e) =>
            e.id === id ? { ...e, start: start.toISOString(), end: end.toISOString(), updatedAt: stamp() } : e
          )
        }),
        { label: 'Termin verschoben' }
      )
    },

    /* ── event templates ── */
    saveAsTemplate(eventId) {
      const ev = get().data?.events.find((e) => e.id === eventId)
      if (!ev) return ''
      const t = templateFromEvent(ev, uid())
      // the event becomes the template's last session, so a rhythm continues from it
      mutate(
        (d) => ({
          ...d,
          templates: [...d.templates, t],
          events: d.events.map((e) => (e.id === eventId && !e.templateId ? { ...e, templateId: t.id } : e))
        }),
        { label: `Vorlage „${t.name}“ gespeichert` }
      )
      get().pushToast({
        kind: 'undo',
        title: `Vorlage „${t.name}“ gespeichert`,
        body: `In der Schnelleingabe mit /${templateKey(t)} · verwalten unter Optionen`
      })
      return t.id
    },
    upsertTemplate(t) {
      mutate(
        (d) => ({
          ...d,
          templates: d.templates.some((x) => x.id === t.id)
            ? d.templates.map((x) => (x.id === t.id ? t : x))
            : [...d.templates, t]
        }),
        { label: 'Vorlage bearbeitet', coalesce: `tpl:${t.id}` }
      )
    },
    skipPlaceholder(templateId) {
      const d0 = get().data
      const t = d0?.templates.find((x) => x.id === templateId)
      if (!d0 || !t) return
      const next = skipPlaceholder(t, d0.events)
      mutate((d) => ({ ...d, templates: d.templates.map((x) => (x.id === t.id ? next : x)) }), {
        label: `„${t.name}“ fällt aus`,
        undoToast: true
      })
    },
    openPlaceholder(templateId, anchor) {
      const d = get().data
      const t = d?.templates.find((x) => x.id === templateId)
      const ph = d && t ? placeholderEvent(t, d.events) : null
      if (!ph) return
      set({
        quickCreate: { start: ph.start, end: ph.end, allDay: ph.allDay, anchor, placeholderOf: templateId },
        preview: null,
        contextMenu: null
      })
    },
    removeTemplate(id) {
      const t = get().data?.templates.find((x) => x.id === id)
      mutate((d) => ({ ...d, templates: d.templates.filter((x) => x.id !== id) }), {
        label: `Vorlage „${t?.name}“ gelöscht`,
        undoToast: true
      })
    },

    /* ── calendars & settings ── */
    upsertCalendar(c) {
      mutate(
        (d) => {
          const exists = d.calendars.some((x) => x.id === c.id)
          return { ...d, calendars: exists ? d.calendars.map((x) => (x.id === c.id ? c : x)) : [...d.calendars, c] }
        },
        { label: 'Kalender gespeichert' }
      )
    },
    removeCalendar(id) {
      const cal = get().data?.calendars.find((c) => c.id === id)
      mutate(
        (d) => {
          if (d.calendars.length <= 1) return d
          return {
            ...d,
            calendars: d.calendars.filter((c) => c.id !== id),
            events: d.events.filter((e) => e.calendarId !== id)
          }
        },
        { label: `Kalender „${cal?.name}“ gelöscht`, undoToast: true }
      )
    },
    toggleCalendar(id) {
      mutate(
        (d) => ({ ...d, calendars: d.calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)) }),
        { history: false }
      )
    },
    updateSettings(patch) {
      mutate((d) => ({ ...d, settings: { ...d.settings, ...patch } }), { history: false })
    },

    /* ── todos ── */
    setTodoView: (todoView) => set({ todoView, picked: [] }),
    setTodoCategory: (todoCategory) => set({ todoCategory, picked: [] }),
    setPicked: (picked) => set({ picked }),

    addTodo(t) {
      const ts = stamp()
      const id = uid()
      const view = get().todoView
      const todo: Todo = {
        id,
        listId: view.startsWith('list:') ? view.slice(5) : INBOX_ID,
        categoryId: get().todoCategory ?? undefined,
        priority: 0,
        subtasks: [],
        done: false,
        createdAt: ts,
        updatedAt: ts,
        ...t
      }
      mutate((d) => ({ ...d, todos: [...d.todos, todo] }), { label: 'ToDo angelegt' })
      return id
    },

    updateTodo(id, patch, coalesce) {
      mutate(
        (d) => ({ ...d, todos: d.todos.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: stamp() } : t)) }),
        { label: 'ToDo bearbeitet', coalesce: coalesce ? `todo:${id}:${coalesce}` : undefined }
      )
    },

    updateTodos(ids, patch, label) {
      const set_ = new Set(ids)
      mutate(
        (d) => ({ ...d, todos: d.todos.map((t) => (set_.has(t.id) ? { ...t, ...patch, updatedAt: stamp() } : t)) }),
        { label, undoToast: ids.length > 1 }
      )
    },

    toggleTodo(id) {
      const t = get().data?.todos.find((x) => x.id === id)
      if (!t) return
      get().toggleTodos([id], !t.done)
    },

    toggleTodos(ids, done) {
      const set_ = new Set(ids)
      const ts = stamp()
      const today = localDate(new Date())
      const first = get().data?.todos.find((t) => t.id === ids[0])
      // completing a recurring ToDo creates its next instance (same undo step)
      const spawned: Todo[] = []
      if (done) {
        for (const t of get().data?.todos ?? []) {
          if (!set_.has(t.id) || t.done) continue
          const next = nextRecurrence(t, today)
          if (!next) continue
          spawned.push({
            ...t,
            ...next,
            id: uid(),
            done: false,
            doneAt: undefined,
            linkedEventId: undefined,
            subtasks: t.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
            createdAt: ts,
            updatedAt: ts
          })
        }
      }
      const nextDay = spawned.length === 1 ? (spawned[0].softDeadline ?? spawned[0].hardDeadline) : undefined
      const base = ids.length > 1 ? `${ids.length} ToDos ${done ? 'erledigt' : 'wieder geöffnet'}` : `„${first?.title}“ ${done ? 'erledigt' : 'wieder geöffnet'}`
      mutate(
        (d) => ({
          ...d,
          todos: [
            ...d.todos.map((t) =>
              set_.has(t.id)
                ? {
                    ...t,
                    done,
                    doneAt: done ? ts : undefined,
                    // the series lives on in the new instance
                    ...(done && t.recurrence && !t.done ? { recurrence: null } : {}),
                    updatedAt: ts
                  }
                : t
            ),
            ...spawned
          ]
        }),
        {
          label: nextDay ? `${base} · nächstes Mal ${deadlineText(nextDay, today)}` : base,
          undoToast: done
        }
      )
    },

    deleteTodos(ids) {
      const set_ = new Set(ids)
      const ts = stamp()
      const first = get().data?.todos.find((t) => t.id === ids[0])
      mutate(
        (d) => ({
          ...d,
          todos: d.todos.filter((t) => !set_.has(t.id)),
          trash: [
            ...d.todos.filter((t) => set_.has(t.id)).map((t) => ({ ...t, linkedEventId: undefined, deletedAt: ts })),
            ...d.trash
          ],
          events: d.events.map((e) => (e.todoId && set_.has(e.todoId) ? { ...e, todoId: undefined } : e))
        }),
        {
          label: ids.length > 1 ? `${ids.length} ToDos im Papierkorb` : `„${first?.title}“ im Papierkorb`,
          undoToast: true
        }
      )
      const sel = get().selection
      if (sel?.kind === 'todo' && set_.has(sel.id)) get().clearSelection()
      set({ picked: get().picked.filter((p) => !set_.has(p)) })
    },

    restoreTodos(ids) {
      const set_ = new Set(ids)
      const first = get().data?.trash.find((t) => t.id === ids[0])
      mutate(
        (d) => {
          const lists = new Set(d.lists.map((l) => l.id))
          const back = d.trash
            .filter((t) => set_.has(t.id))
            // the list may have been deleted meanwhile
            .map((t) => ({ ...t, deletedAt: undefined, listId: lists.has(t.listId) ? t.listId : INBOX_ID }))
          return { ...d, todos: [...d.todos, ...back], trash: d.trash.filter((t) => !set_.has(t.id)) }
        },
        {
          label: ids.length > 1 ? `${ids.length} ToDos wiederhergestellt` : `„${first?.title}“ wiederhergestellt`,
          undoToast: true
        }
      )
      set({ picked: get().picked.filter((p) => !set_.has(p)) })
    },

    purgeTodos(ids) {
      const trash = get().data?.trash ?? []
      const set_ = new Set(ids === 'all' ? trash.map((t) => t.id) : ids)
      if (!set_.size) return
      mutate((d) => ({ ...d, trash: d.trash.filter((t) => !set_.has(t.id)) }), {
        label: ids === 'all' ? 'Papierkorb geleert' : set_.size > 1 ? `${set_.size} ToDos endgültig gelöscht` : `„${trash.find((t) => set_.has(t.id))?.title}“ endgültig gelöscht`,
        undoToast: true
      })
      const sel = get().selection
      if (sel?.kind === 'todo' && set_.has(sel.id)) get().clearSelection()
      set({ picked: get().picked.filter((p) => !set_.has(p)) })
    },

    upsertList(l) {
      mutate(
        (d) => ({
          ...d,
          lists: d.lists.some((x) => x.id === l.id) ? d.lists.map((x) => (x.id === l.id ? l : x)) : [...d.lists, l]
        }),
        { label: 'Liste gespeichert' }
      )
    },
    removeList(id) {
      if (id === INBOX_ID) return
      const list = get().data?.lists.find((l) => l.id === id)
      mutate(
        (d) => ({
          ...d,
          lists: d.lists.filter((l) => l.id !== id),
          todos: d.todos.map((t) => (t.listId === id ? { ...t, listId: INBOX_ID } : t))
        }),
        { label: `Liste „${list?.name}“ gelöscht`, undoToast: true }
      )
      if (get().todoView === `list:${id}`) set({ todoView: 'open' })
    },
    upsertCategory(c) {
      mutate(
        (d) => ({
          ...d,
          categories: d.categories.some((x) => x.id === c.id)
            ? d.categories.map((x) => (x.id === c.id ? c : x))
            : [...d.categories, c]
        }),
        { label: 'Kategorie gespeichert' }
      )
    },
    removeCategory(id) {
      const cat = get().data?.categories.find((c) => c.id === id)
      mutate(
        (d) => ({
          ...d,
          categories: d.categories.filter((c) => c.id !== id),
          todos: d.todos.map((t) => (t.categoryId === id ? { ...t, categoryId: undefined } : t))
        }),
        { label: `Kategorie „${cat?.name}“ gelöscht`, undoToast: true }
      )
      if (get().todoCategory === id) set({ todoCategory: null })
    },

    scheduleTodo(todoId, start, end) {
      const data = get().data
      const todo = data?.todos.find((t) => t.id === todoId)
      if (!data || !todo) return
      const ts = stamp()
      const calId = writableCalendarId(data, data.settings.todoCalendarId)
      const ev: CalendarEvent = {
        id: uid(),
        calendarId: calId,
        title: todo.title,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        reminders: [...data.settings.defaultReminders],
        recurrence: null,
        todoId,
        createdAt: ts,
        updatedAt: ts
      }
      mutate(
        (d) => ({
          ...d,
          // one time block per ToDo: a new one replaces the previous
          events: [...d.events.filter((e) => e.id !== todo.linkedEventId), ev],
          todos: d.todos.map((t) => (t.id === todoId ? { ...t, linkedEventId: ev.id, updatedAt: ts } : t))
        }),
        { label: `„${todo.title}“ eingeplant` }
      )
    },

    /* ── weekly goals ── */
    upsertGoal(g) {
      const prev = get().data?.goals.find((x) => x.id === g.id)
      const slotsChanged = !!prev && JSON.stringify(prev.slots) !== JSON.stringify(g.slots)
      const now = Date.now()
      // blocks the old fixed times put into the future; they are replaced by the new ones
      const stale = (e: CalendarEvent): boolean =>
        slotsChanged &&
        e.goal?.goalId === g.id &&
        !e.goal.done &&
        new Date(e.start).getTime() > now &&
        prev!.slots.some((s) => s.day === (new Date(e.start).getDay() + 6) % 7 && s.time === toHm(new Date(e.start)))
      const goal = { ...g, updatedAt: stamp(), ...(slotsChanged || !prev ? { filledWeeks: [] } : {}) }
      mutate(
        (d) => ({
          ...d,
          goals: prev ? d.goals.map((x) => (x.id === g.id ? goal : x)) : [...d.goals, goal],
          events: d.events.filter((e) => !stale(e))
        }),
        { label: prev ? `Ziel „${g.title}“ geändert` : `Ziel „${g.title}“ angelegt` }
      )
      if (!prev || slotsChanged) get().fillGoalSlots()
    },

    archiveGoal(id) {
      const g = get().data?.goals.find((x) => x.id === id)
      if (!g) return
      const now = Date.now()
      mutate(
        (d) => ({
          ...d,
          goals: d.goals.map((x) => (x.id === id ? { ...x, archived: true, updatedAt: stamp() } : x)),
          // blocks still ahead go into the trash; past ones stay as history
          events: d.events.filter((e) => !(e.goal?.goalId === id && !e.goal.done && new Date(e.start).getTime() > now)),
          eventTrash: [
            ...d.events.filter((e) => e.goal?.goalId === id && !e.goal.done && new Date(e.start).getTime() > now).map((e) => ({ ...e, deletedAt: stamp() })),
            ...d.eventTrash
          ]
        }),
        { label: `Ziel „${g.title}“ entfernt`, undoToast: true }
      )
    },

    planGoalBlock(goalId, start, durationMin) {
      const data = get().data
      const goal = data?.goals.find((g) => g.id === goalId)
      if (!data || !goal) return
      const ts = stamp()
      const ev: CalendarEvent = {
        id: uid(),
        reminders: [...data.settings.defaultReminders],
        createdAt: ts,
        updatedAt: ts,
        ...goalEvent(goal, start, durationMin ?? goal.durationMin),
        calendarId: writableCalendarId(data, goal.calendarId)
      }
      mutate((d) => ({ ...d, events: [...d.events, ev] }), { label: `„${goal.title}“ eingeplant` })
    },

    setGoalDone(eventId, done) {
      const ev = get().data?.events.find((e) => e.id === eventId)
      if (!ev?.goal) return
      const ts = stamp()
      mutate(
        (d) => ({
          ...d,
          events: d.events.map((e) =>
            e.id === eventId ? { ...e, goal: { ...e.goal!, done, doneAt: done ? ts : undefined }, updatedAt: ts } : e
          )
        }),
        { label: `„${ev.title}“ ${done ? 'geschafft' : 'wieder offen'}`, undoToast: done }
      )
    },

    returnGoalBlock(eventId) {
      const ev = get().data?.events.find((e) => e.id === eventId)
      if (!ev) return
      const ts = stamp()
      mutate(
        (d) => ({ ...d, events: d.events.filter((e) => e.id !== eventId), eventTrash: [{ ...ev, deletedAt: ts }, ...d.eventTrash] }),
        { label: `„${ev.title}“ zurück in den Vorrat`, undoToast: true }
      )
      if (get().selection?.id === eventId) get().clearSelection()
    },

    strikeGoalBlock(eventId) {
      const ev = get().data?.events.find((e) => e.id === eventId)
      if (!ev?.goal) return
      const week = weekKey(new Date(ev.start))
      const ts = stamp()
      mutate(
        (d) => ({
          ...d,
          events: d.events.filter((e) => e.id !== eventId),
          eventTrash: [{ ...ev, deletedAt: ts }, ...d.eventTrash],
          goals: d.goals.map((g) => (g.id === ev.goal!.goalId ? { ...g, struck: { ...(g.struck ?? {}), [week]: (g.struck?.[week] ?? 0) + 1 } } : g))
        }),
        { label: `„${ev.title}“ für diese Woche gestrichen`, undoToast: true }
      )
      if (get().selection?.id === eventId) get().clearSelection()
    },

    fillGoalSlots(now = new Date()) {
      const data = get().data
      if (!data || data.goals.length === 0) return
      const todo = slotsToFill(data.goals, [now, addWeeks(now, 1)], now)
      if (todo.length === 0) return
      const ts = stamp()
      const created: CalendarEvent[] = []
      for (const t of todo) {
        const goal = data.goals.find((g) => g.id === t.goalId)!
        for (const s of t.starts) {
          created.push({
            id: uid(),
            reminders: [...data.settings.defaultReminders],
            createdAt: ts,
            updatedAt: ts,
            ...goalEvent(goal, s.start, s.durationMin),
            calendarId: writableCalendarId(data, goal.calendarId)
          })
        }
      }
      mutate(
        (d) => ({
          ...d,
          events: [...d.events, ...created],
          goals: d.goals.map((g) => todo.filter((t) => t.goalId === g.id).reduce((acc, t) => markFilled(acc, t.week), g))
        }),
        { history: false }
      )
    },

    setPoints(points) {
      mutate((d) => ({ ...d, points }), { history: false })
    },

    /* ── character ── */
    updateCharacter(patch, label) {
      mutate((d) => ({ ...d, character: { ...d.character, ...patch } }), label ? { label } : { label: 'Charakter geändert', coalesce: 'character' })
    },

    buyItem(id) {
      const ch = get().data?.character
      const it = itemById(id)
      if (!ch || !it || ch.owned.includes(id)) return false
      if (coinBalance(ch) < it.price) return false
      if (it.unlock && attrLevel(attrXp(ch)[it.unlock.attr]).level < it.unlock.level) return false
      mutate(
        (d) => ({
          ...d,
          character: {
            ...d.character,
            owned: [...d.character.owned, id],
            spent: d.character.spent + it.price,
            outfit: { ...d.character.outfit, [it.slot]: id }
          }
        }),
        { label: `${it.name} gekauft`, undoToast: true }
      )
      return true
    },

    equip(slot, id) {
      mutate(
        (d) => {
          const outfit = { ...d.character.outfit }
          if (id) outfit[slot] = id
          else delete outfit[slot]
          return { ...d, character: { ...d.character, outfit } }
        },
        { label: 'Outfit geändert', coalesce: 'outfit' }
      )
    },

    setRewards(rewards) {
      mutate((d) => ({ ...d, character: { ...d.character, rewards } }), { history: false })
    },

    replaceData(next, label) {
      mutate(() => normalizeData(next), { label, undoToast: true })
      set({ selection: null, picked: [], rightTab: get().rightTab === 'details' ? 'todos' : get().rightTab })
    },

    importTodos(list, label) {
      const ts = stamp()
      const todos: Todo[] = list.map((t) => ({
        id: uid(),
        listId: INBOX_ID,
        priority: 0,
        done: false,
        createdAt: ts,
        updatedAt: ts,
        ...t,
        subtasks: (t.subtasks ?? []).map((s) => ({ ...s, id: uid() }))
      }))
      if (!todos.length) return
      mutate((d) => ({ ...d, todos: [...d.todos, ...todos] }), { label, undoToast: true })
    },

    /* ── brainstorm boards ── */
    openBoard: (boardId) => set({ boardId, page: 'ideas' }),

    addBoard(title = '') {
      const ts = stamp()
      const board: Board = { id: uid(), title, notes: [], frames: [], edges: [], createdAt: ts, updatedAt: ts }
      mutate((d) => ({ ...d, boards: [board, ...d.boards] }), { label: 'Board angelegt' })
      set({ boardId: board.id, page: 'ideas' })
      return board.id
    },

    editBoard(id, fn, label, coalesce) {
      mutate(
        (d) => {
          let changed = false
          const boards = d.boards.map((b) => {
            if (b.id !== id) return b
            const next = fn(b)
            if (next === b) return b
            changed = true
            return { ...next, updatedAt: stamp() }
          })
          return changed ? { ...d, boards } : d
        },
        { label, coalesce: coalesce ? `board:${id}:${coalesce}` : undefined }
      )
    },

    deleteBoard(id) {
      const b = get().data?.boards.find((x) => x.id === id)
      if (!b) return
      mutate((d) => ({ ...d, boards: d.boards.filter((x) => x.id !== id) }), {
        label: `Board „${b.title || 'Ohne Titel'}“ gelöscht`,
        undoToast: true
      })
      if (get().boardId === id) set({ boardId: get().data?.boards[0]?.id ?? null })
    },

    noteToTodo(boardId, noteId) {
      const board = get().data?.boards.find((b) => b.id === boardId)
      const note = board?.notes.find((n) => n.id === noteId)
      if (!board || !note || !note.text.trim()) return
      const [first, ...rest] = note.text.trim().split('\n')
      const ts = stamp()
      const todo: Todo = {
        id: uid(),
        title: first.trim(),
        listId: INBOX_ID,
        priority: 0,
        subtasks: [],
        done: false,
        notes: [rest.join('\n').trim(), `Aus dem Brainstorm „${board.title || 'Ohne Titel'}“`]
          .filter(Boolean)
          .join('\n\n'),
        createdAt: ts,
        updatedAt: ts
      }
      mutate(
        (d) => ({
          ...d,
          todos: [...d.todos, todo],
          boards: d.boards.map((b) =>
            b.id === boardId
              ? { ...b, updatedAt: ts, notes: b.notes.map((n) => (n.id === noteId ? { ...n, todoId: todo.id, action: true } : n)) }
              : b
          )
        }),
        { label: `ToDo „${todo.title}“ angelegt`, undoToast: true }
      )
    },

    /* ── toasts ── */
    pushToast(t) {
      const id = uid()
      // only one undo toast at a time: the newest replaces older ones
      const keep = t.kind === 'undo' || t.kind === 'info' ? get().toasts.filter((x) => x.kind !== t.kind) : get().toasts
      set({ toasts: [...keep, { ...t, id }] })
      if (t.kind === 'info') setTimeout(() => get().dismissToast(id), 2500)
      if (t.kind === 'undo') setTimeout(() => get().dismissToast(id), 7000)
    },

    dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

    onReminder(p) {
      if (p.kind === 'todo') {
        get().pushToast({ kind: 'deadline', title: p.title, body: p.note, todoId: p.id })
        return
      }
      const start = new Date(p.start)
      const time = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      get().pushToast({
        kind: 'reminder',
        title: p.title,
        body: p.minutesBefore === 0 ? `Beginnt jetzt · ${time} Uhr` : `Beginnt um ${time} Uhr`,
        eventId: p.id
      })
    }
  }
})

/**
 * Demo/screenshot URL parameters (web build with ?demo only), e.g.
 * ?demo&page=plan&view=month&tab=today&theme=rose&todo=2&add=Text&palette=suche
 */
function applyDemoParams(): void {
  const p = new URLSearchParams(location.search)
  const st = useStore.getState()
  const page = p.get('page') as Page | null
  if (page) st.setPage(page)
  const view = p.get('view') as CalendarViewKind | null
  if (view) useStore.setState({ view })
  const theme = p.get('theme')
  if (theme) st.updateSettings({ theme })
  const tab = p.get('tab') as RightTab | null
  if (tab) useStore.setState({ rightTab: tab })
  const todo = p.get('todo')
  if (todo) {
    const t = st.data?.todos[Number(todo)]
    if (t) st.selectTodo(t.id)
  }
  const ev = p.get('event')
  if (ev) {
    const e = st.data?.events[Number(ev)]
    if (e) st.selectEvent(e.id)
  }
  if (p.has('add')) st.openAdd('auto', p.get('add') ?? '')
  if (p.has('palette')) {
    st.openPalette()
    const q = p.get('palette')
    if (q) setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>('.palette input')
      if (!input) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, q)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }, 50)
  }
  if (p.has('picked')) {
    const ids = (st.data?.todos ?? []).filter((t) => !t.done).slice(0, Number(p.get('picked')) || 3).map((t) => t.id)
    st.setPicked(ids)
  }
}

/** "morgen", "am Sa, 28. Nov." */
function deadlineText(d: string, today: string): string {
  const diff = daysBetween(today, d)
  if (diff === 1) return 'morgen'
  const date = parseLocalDate(d)
  return `am ${date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}`
}

/** next half hour */
export function roundUp(d: Date, step = 30): Date {
  const r = new Date(d)
  r.setSeconds(0, 0)
  const m = r.getMinutes()
  r.setMinutes(Math.ceil((m + 1) / step) * step)
  return r
}

/** visible events only */
export function useVisibleEvents(): CalendarEvent[] {
  const data = useStore((s) => s.data)
  return useMemo(() => {
    if (!data) return []
    const visible = new Set(data.calendars.filter((c) => c.visible).map((c) => c.id))
    return data.events.filter((e) => visible.has(e.calendarId))
  }, [data])
}

/**
 * Visible events plus the grey "next session" placeholders of templates with a rhythm.
 * Only for drawing the calendar – placeholders are never stored, synced or reminded of.
 */
export function useCalendarEvents(): CalendarEvent[] {
  const visible = useVisibleEvents()
  const data = useStore((s) => s.data)
  return useMemo(() => {
    if (!data) return visible
    const shown = new Set(data.calendars.filter((c) => c.visible).map((c) => c.id))
    const phs = data.templates
      .filter((t) => t.rhythm && shown.has(t.calendarId))
      .map((t) => placeholderEvent(t, data.events))
      .filter((e): e is CalendarEvent => !!e)
    return phs.length ? [...visible, ...phs] : visible
  }, [visible, data])
}

export { isPlaceholderId, placeholderTemplateId }

/** holiday name for a day, or undefined when holidays are hidden */
export function useHolidays(): (d: Date) => string | undefined {
  const show = useStore((s) => s.data?.settings.showHolidays)
  const region = useStore((s) => s.data?.settings.holidayRegion ?? 'DE')
  return useCallback((d: Date) => (show ? holidayOn(localDate(d), region) : undefined), [show, region])
}

export function useCalendarMap(): Map<string, CalendarInfo> {
  const calendars = useStore((s) => s.data?.calendars)
  return useMemo(() => new Map((calendars ?? []).map((c) => [c.id, c])), [calendars])
}

export const anchorOf = (el: Element): Anchor => {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}
