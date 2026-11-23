import { CalendarCheck2, ListTodo, PanelRightClose, Sun, SquarePen } from 'lucide-react'
import { useStore, type RightTab } from '../store'
import { TodoPanel } from './todos/TodoPanel'
import { TodayTab } from './today/TodayTab'
import { EventDetails } from './details/EventDetails'
import { TodoDetails } from './details/TodoDetails'

const TABS: { id: RightTab; label: string; icon: typeof Sun }[] = [
  { id: 'todos', label: 'ToDos', icon: ListTodo },
  { id: 'today', label: 'Heute', icon: Sun },
  { id: 'details', label: 'Details', icon: SquarePen }
]

/** Right column of the workspace: ToDos to plan, today's focus, details of the selection. */
export function RightPanel({ tabs = true }: { tabs?: boolean }): React.JSX.Element {
  const tab = useStore((s) => s.rightTab)
  const setTab = useStore((s) => s.setRightTab)
  const selection = useStore((s) => s.selection)
  const togglePanel = useStore((s) => s.togglePanel)
  const active = tabs ? tab : 'details'

  return (
    <aside className="right-panel">
      {tabs && (
        <div className="rp-tabs" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={active === id}
              className={active === id ? 'on' : ''}
              disabled={id === 'details' && !selection}
              onClick={() => setTab(id)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="icon-btn sm" onClick={() => togglePanel(false)} title="Spalte ausblenden" aria-label="Spalte ausblenden">
            <PanelRightClose size={16} />
          </button>
        </div>
      )}
      <div className="rp-body">
        {active === 'todos' && <TodoPanel />}
        {active === 'today' && <TodayTab />}
        {active === 'details' &&
          (selection?.kind === 'event' ? (
            <EventDetails key={selection.id} id={selection.id} occurrenceStart={selection.occurrenceStart} />
          ) : selection?.kind === 'todo' ? (
            <TodoDetails key={selection.id} id={selection.id} />
          ) : (
            <div className="empty-state small">
              <CalendarCheck2 size={28} strokeWidth={1.4} />
              <p>Wähle einen Termin oder ein ToDo aus, um es hier zu bearbeiten.</p>
            </div>
          ))}
      </div>
    </aside>
  )
}
