import { useMemo } from 'react'
import { endOfWeek, isSameMonth, isSameYear, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, PanelRightOpen, Plus, Search, Undo2, Redo2 } from 'lucide-react'
import type { CalendarViewKind } from '@shared/types'
import { useStore } from '../store'
import { WEEK, daysOfRange, fmt } from '../lib/dates'
import { MiniMonth } from '../components/calendar/MiniMonth'
import { CalendarList } from '../components/calendar/CalendarList'
import { TimeGrid } from '../components/calendar/TimeGrid'
import { MonthGrid } from '../components/calendar/MonthGrid'
import { AgendaList } from '../components/calendar/AgendaList'
import { CategoriesSection, ListsSection, SmartViews } from '../components/todos/ListNav'
import { RightPanel } from '../components/RightPanel'

const VIEWS: { id: CalendarViewKind; label: string; key: string }[] = [
  { id: 'day', label: 'Tag', key: 'D' },
  { id: 'week', label: 'Woche', key: 'W' },
  { id: 'month', label: 'Monat', key: 'M' },
  { id: 'agenda', label: 'Agenda', key: 'A' }
]

/** The main workspace: calendar in the middle, filters left, ToDos/Heute/Details right. */
export function CalendarPage(): React.JSX.Element {
  const view = useStore((s) => s.view)
  const cursor = useStore((s) => s.cursor)
  const setView = useStore((s) => s.setView)
  const step = useStore((s) => s.step)
  const goToday = useStore((s) => s.goToday)
  const openAdd = useStore((s) => s.openAdd)
  const openPalette = useStore((s) => s.openPalette)
  const showPanel = useStore((s) => s.data!.settings.showTodoPanel)
  const togglePanel = useStore((s) => s.togglePanel)
  const setRightTab = useStore((s) => s.setRightTab)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)

  const weekDays = useMemo(() => daysOfRange(startOfWeek(cursor, WEEK), 7), [cursor])
  const dayDays = useMemo(() => [cursor], [cursor])
  const showTodos = (): void => setRightTab('todos')

  return (
    <div className="calendar-page">
      <aside className="sidebar">
        <button className="btn btn-primary btn-block" onClick={() => openAdd()}>
          <Plus size={16} strokeWidth={2.4} /> Neu
          <kbd>N</kbd>
        </button>
        <MiniMonth />
        <CalendarList />
        <div className="sidebar-todos">
          <div className="section-head">
            <span>ToDos</span>
          </div>
          <SmartViews only={['open', 'today', 'overdue']} onPick={showTodos} />
        </div>
        <ListsSection onPick={showTodos} />
        <CategoriesSection />
      </aside>

      <section className="cal-main">
        <div className="toolbar">
          <button className="btn btn-outline" onClick={goToday} title="Heute (T)">
            Heute
          </button>
          <div className="btn-pair">
            <button className="icon-btn" onClick={() => step(-1)} aria-label="Zurück" title="Zurück (←)">
              <ChevronLeft size={18} />
            </button>
            <button className="icon-btn" onClick={() => step(1)} aria-label="Weiter" title="Weiter (→)">
              <ChevronRight size={18} />
            </button>
          </div>
          <h1 className="toolbar-title">{rangeTitle(view, cursor)}</h1>
          <div className="btn-pair">
            <button className="icon-btn" onClick={undo} disabled={!canUndo} title="Rückgängig (Strg+Z)" aria-label="Rückgängig">
              <Undo2 size={17} />
            </button>
            <button className="icon-btn" onClick={redo} disabled={!canRedo} title="Wiederholen (Strg+Y)" aria-label="Wiederholen">
              <Redo2 size={17} />
            </button>
          </div>
          <button className="icon-btn" onClick={openPalette} title="Suchen & Befehle (Strg+K)" aria-label="Suchen">
            <Search size={17} />
          </button>
          <div className="segmented" role="tablist" aria-label="Ansicht">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                className={view === v.id ? 'on' : ''}
                onClick={() => setView(v.id)}
                title={`${v.label} (${v.key})`}
              >
                {v.label}
              </button>
            ))}
          </div>
          {!showPanel && (
            <button className="icon-btn" onClick={() => togglePanel(true)} title="Seitenspalte einblenden" aria-label="Seitenspalte einblenden">
              <PanelRightOpen size={18} />
            </button>
          )}
        </div>

        <div className="view-host">
          {view === 'week' && <TimeGrid days={weekDays} />}
          {view === 'day' && <TimeGrid days={dayDays} />}
          {view === 'month' && <MonthGrid />}
          {view === 'agenda' && <AgendaList />}
        </div>
      </section>
      {showPanel && <RightPanel />}
    </div>
  )
}

function rangeTitle(view: CalendarViewKind, cursor: Date): React.ReactNode {
  if (view === 'day') {
    return (
      <>
        {fmt(cursor, 'EEEE, d. MMMM')} <span className="muted">{fmt(cursor, 'yyyy')}</span>
      </>
    )
  }
  if (view === 'week') {
    const s = startOfWeek(cursor, WEEK)
    const e = endOfWeek(cursor, WEEK)
    const label = isSameMonth(s, e)
      ? `${fmt(s, 'd.')} – ${fmt(e, 'd. MMMM')}`
      : isSameYear(s, e)
        ? `${fmt(s, 'd. MMM')} – ${fmt(e, 'd. MMM')}`
        : `${fmt(s, 'd. MMM yyyy')} – ${fmt(e, 'd. MMM')}`
    return (
      <>
        {label} <span className="muted">{fmt(e, 'yyyy')}</span>
      </>
    )
  }
  if (view === 'agenda') {
    return (
      <>
        Ab {fmt(cursor, 'd. MMMM')} <span className="muted">· 6 Wochen</span>
      </>
    )
  }
  return (
    <>
      {fmt(cursor, 'MMMM')} <span className="muted">{fmt(cursor, 'yyyy')}</span>
    </>
  )
}
