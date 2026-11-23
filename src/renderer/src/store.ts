import { useCallback, useMemo } from 'react'
import { create } from 'zustand'
import { addDays, addMonths, addWeeks, startOfDay } from 'date-fns'
import {
  INBOX_ID,
  TRASH_DAYS,
  normalizeData,
  type AppData,
  type CalendarEvent,
  type CalendarInfo,
  type CalendarViewKind,
  type Category,
  type ReminderPayload,
  type Settings,
  type Todo,
  type TodoList
} from '@shared/types'
import { api, isDemo } from './lib/api'
import { holidayOn } from '@shared/holidays'
import { daysBetween, localDate, nextRecurrence, parseLocalDate } from '@shared/todo'

/* ───────────── UI types ───────────── */

export type Page = 'plan' | 'todos' | 'overview' | 'settings'
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
  overlay: { kind: 'add'; addKind: AddKind; prefill?: string } | { kind: 'palette' } | { kind: 'help' } | null
  toasts: Toast[]
  todoView: TodoView
  todoCategory: string | null
  /** multi-selection in ToDo lists */
  picked: string[]
  canUndo: boolean
  canRedo: boolean

  init(): Promise<void>
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

  undo(): void
  redo(): void

  createEvent(ev: Partial<CalendarEvent> & { start: string; end: string }, opts?: { select?: boolean }): string
  updateEvent(id: string, patch: Partial<CalendarEvent>, coalesce?: string): void
  deleteEvent(id: string, scope: 'all' | 'one', occurrenceStart?: string): void
  duplicateEvent(id: string): void
  moveEvent(id: string, start: Date, end: Date): void

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

  /** replace all data (restore / import) – one undo step */
  replaceData(next: AppData, label: string): void
  /** add imported ToDos to the inbox */
  importTodos(todos: NewTodo[], label: string): void

  pushToast(t: Omit<Toast, 'id'>): void
  dismissToast(id: string): void
  onReminder(p: ReminderPayload): void
}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

let saveTimer: ReturnType<typeof setTimeout> | null = null
function persist(data: AppData): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void api.save(data), 250)
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
    persist(next)
    if (record) syncHistoryFlags()
    if (opts.undoToast && opts.label) get().pushToast({ kind: 'undo', title: opts.label })
  }

  const stamp = (): string => new Date().toISOString()

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
    toasts: [],
    todoView: 'open',
    todoCategory: null,
    picked: [],
    canUndo: false,
    canRedo: false,

    async init() {
      const data = await api.load()
      set({ data, view: data.settings.defaultView })
      // empty the trash of entries older than TRASH_DAYS (not undoable: they expired)
      const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString()
      if (data.trash.some((t) => (t.deletedAt ?? '') < cutoff)) {
        mutate((d) => ({ ...d, trash: d.trash.filter((t) => (t.deletedAt ?? '') >= cutoff) }), { history: false })
      }
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
    selectEvent: (id, occurrenceStart) => get().select({ kind: 'event', id, occurrenceStart }),
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

    /* ── history ── */
    undo() {
      const cur = get().data
      const entry = past.pop()
      if (!entry || !cur) return
      future.push({ data: cur, label: entry.label })
      lastCoalesce = null
      set({ data: entry.data })
      persist(entry.data)
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
      persist(entry.data)
      syncHistoryFlags()
      dropStaleSelection()
      get().pushToast({ kind: 'info', title: `Wiederholt: ${entry.label}` })
    },

    /* ── events ── */
    createEvent(partial, opts = {}) {
      const data = get().data
      if (!data) return ''
      const firstVisible = data.calendars.find((c) => c.visible) ?? data.calendars[0]
      const ts = stamp()
      const ev: CalendarEvent = {
        id: uid(),
        calendarId: firstVisible?.id ?? 'personal',
        title: '',
        allDay: false,
        reminders: [...data.settings.defaultReminders],
        recurrence: null,
        createdAt: ts,
        updatedAt: ts,
        ...partial
      }
      mutate((d) => ({ ...d, events: [...d.events, ev] }), { label: 'Termin angelegt' })
      set({ quickCreate: null })
      if (opts.select) get().selectEvent(ev.id)
      return ev.id
    },

    updateEvent(id, patch, coalesce) {
      mutate(
        (d) => ({ ...d, events: d.events.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: stamp() } : e)) }),
        { label: 'Termin bearbeitet', coalesce: coalesce ? `ev:${id}:${coalesce}` : undefined }
      )
    },

    deleteEvent(id, scope, occurrenceStart) {
      const ev = get().data?.events.find((e) => e.id === id)
      if (!ev) return
      const title = ev.title || '(Ohne Titel)'
      mutate(
        (d) => {
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
          return {
            ...d,
            events: d.events.filter((e) => e.id !== id),
            todos: d.todos.map((t) => (t.linkedEventId === id ? { ...t, linkedEventId: undefined } : t))
          }
        },
        {
          label: scope === 'one' && ev.recurrence ? `„${title}“ (ein Termin) gelöscht` : `„${title}“ gelöscht`,
          undoToast: true
        }
      )
      const sel = get().selection
      if (sel?.kind === 'event' && sel.id === id) get().clearSelection()
      set({ preview: null })
    },

    duplicateEvent(id) {
      const ev = get().data?.events.find((e) => e.id === id)
      if (!ev) return
      const copy: CalendarEvent = { ...structuredClone(ev), id: uid(), todoId: undefined, external: undefined }
      mutate((d) => ({ ...d, events: [...d.events, copy] }), { label: 'Termin dupliziert', undoToast: true })
      get().selectEvent(copy.id)
    },

    moveEvent(id, start, end) {
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
      const calId = data.calendars.some((c) => c.id === data.settings.todoCalendarId)
        ? data.settings.todoCalendarId
        : data.calendars[0].id
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
