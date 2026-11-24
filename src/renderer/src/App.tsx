import { useEffect } from 'react'
import { useStore } from './store'
import { api } from './lib/api'
import { applyTheme } from './lib/theme'
import { playChime } from './lib/chime'
import { TitleBar } from './components/TitleBar'
import { NavRail } from './components/NavRail'
import { Toasts } from './components/Toasts'
import { QuickCreate } from './components/calendar/QuickCreate'
import { EventPreview } from './components/calendar/EventPreview'
import { ContextMenu } from './components/ui/ContextMenu'
import { UniversalAdd } from './components/UniversalAdd'
import { CommandPalette } from './components/CommandPalette'
import { ShortcutHelp } from './components/ShortcutHelp'
import { CalendarPage } from './pages/CalendarPage'
import { TodayPage } from './pages/TodayPage'
import { TodosPage } from './pages/TodosPage'
import { SettingsPage } from './pages/SettingsPage'
import { IdeasPage } from './pages/IdeasPage'
import { RightPanel } from './components/RightPanel'

export function App(): React.JSX.Element {
  const data = useStore((s) => s.data)
  const page = useStore((s) => s.page)
  const quickCreate = useStore((s) => s.quickCreate)
  const preview = useStore((s) => s.preview)
  const overlay = useStore((s) => s.overlay)
  const selection = useStore((s) => s.selection)
  const theme = data?.settings.theme

  useEffect(() => {
    void useStore.getState().init()
  }, [])

  useEffect(() => {
    if (!theme) return
    api.setTitleBarTheme(applyTheme(theme))
  }, [theme])

  // main-process events
  useEffect(() => {
    const offs = [
      api.onReminder((p) => {
        const st = useStore.getState()
        st.onReminder(p)
        if (st.data?.settings.reminderSound) playChime()
      }),
      api.onOpenEvent((id) => {
        const st = useStore.getState()
        st.setPage('plan')
        const ev = st.data?.events.find((e) => e.id === id)
        if (ev) st.setCursor(new Date(ev.start))
        st.selectEvent(id)
      }),
      api.onOpenTodo((id) => useStore.getState().selectTodo(id)),
      api.onNewEvent(() => useStore.getState().openAdd('event')),
      api.onRemoteChange((c) => useStore.getState().applyRemote(c)),
      api.google?.onNotice((text) => useStore.getState().pushToast({ kind: 'info', title: text })) ?? (() => {})
    ]
    return () => offs.forEach((off) => off())
  }, [])

  useKeyboardShortcuts()

  if (!data) {
    return (
      <div className="app-loading">
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <NavRail />
        <main className="page">
          {page === 'plan' && <CalendarPage />}
          {page === 'todos' && <TodosPage />}
          {page === 'overview' && (
            <div className="with-details">
              <TodayPage />
              {selection && <RightPanel tabs={false} />}
            </div>
          )}
          {page === 'ideas' && <IdeasPage />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
      {quickCreate && <QuickCreate key={quickCreate.start + quickCreate.end + String(quickCreate.allDay)} />}
      {preview && <EventPreview key={preview.eventId + (preview.occurrenceStart ?? '')} />}
      {overlay?.kind === 'add' && <UniversalAdd initialKind={overlay.addKind} prefill={overlay.prefill} />}
      {overlay?.kind === 'palette' && <CommandPalette />}
      {overlay?.kind === 'help' && <ShortcutHelp />}
      <ContextMenu />
      <Toasts />
    </div>
  )
}

const isTextField = (el: EventTarget | null): boolean =>
  !!(el as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')

function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const st = useStore.getState()
      const k = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey

      // global combos work everywhere except inside text fields (they keep native undo)
      if (mod && k === 'k') {
        e.preventDefault()
        if (st.overlay?.kind === 'palette') st.closeOverlay()
        else st.openPalette()
        return
      }
      if (mod && k === ' ') {
        e.preventDefault()
        st.openAdd()
        return
      }
      if (isTextField(e.target)) return
      if (mod && k === 'z' && !e.shiftKey) {
        e.preventDefault()
        st.undo()
        return
      }
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) {
        e.preventDefault()
        st.redo()
        return
      }
      if (mod || e.altKey) return
      if (st.overlay || st.contextMenu) return

      if (k === 'escape') {
        if (st.preview || st.quickCreate) return // popovers close themselves
        if (st.picked.length) return st.setPicked([])
        if (st.selection) return st.clearSelection()
        return
      }

      // the board has its own keys (letters, Entf, Tab …)
      if (st.page === 'ideas' && !['/', '?', 'escape'].includes(k)) return

      // Entf on a selected / previewed event
      if (k === 'delete' || k === 'backspace') {
        const target = st.preview
          ? { id: st.preview.eventId, occ: st.preview.occurrenceStart }
          : st.selection?.kind === 'event'
            ? { id: st.selection.id, occ: st.selection.occurrenceStart }
            : null
        if (target) {
          e.preventDefault()
          const ev = st.data?.events.find((x) => x.id === target.id)
          st.deleteEvent(target.id, ev?.recurrence && target.occ ? 'one' : 'all', target.occ)
        } else if (st.selection?.kind === 'todo') {
          e.preventDefault()
          st.deleteTodos([st.selection.id])
        }
        return
      }

      const onPlan = st.page === 'plan'
      const map: Record<string, () => void> = {
        n: () => st.openAdd(),
        t: () => {
          st.setPage('plan')
          st.goToday()
        },
        d: () => st.setView('day'),
        w: () => st.setView('week'),
        m: () => st.setView('month'),
        a: () => st.setView('agenda'),
        h: () => {
          st.setPage('plan')
          st.setRightTab('today')
        },
        b: () => st.togglePanel(),
        '/': () => st.openPalette(),
        '?': () => st.openHelp(),
        arrowleft: () => onPlan && st.step(-1),
        arrowright: () => onPlan && st.step(1)
      }
      // on the ToDo page, letters belong to the list (j/k etc.); keep only safe ones
      if (st.page === 'todos' && !['n', 't', 'b', '/', '?'].includes(k)) return
      const fn = map[k]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
