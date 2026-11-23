import { CalendarDays, CheckSquare, LayoutDashboard, Lightbulb, Search, Settings } from 'lucide-react'
import { useStore, type Page } from '../store'

const ITEMS: { id: Page; label: string; icon: typeof CalendarDays; hint: string }[] = [
  { id: 'plan', label: 'Planen', icon: CalendarDays, hint: 'T' },
  { id: 'todos', label: 'ToDos', icon: CheckSquare, hint: '' },
  { id: 'overview', label: 'Übersicht', icon: LayoutDashboard, hint: '' },
  { id: 'ideas', label: 'Ideen', icon: Lightbulb, hint: '' }
]

export function NavRail(): React.JSX.Element {
  const page = useStore((s) => s.page)
  const setPage = useStore((s) => s.setPage)
  const openPalette = useStore((s) => s.openPalette)

  const item = (id: Page, label: string, Icon: typeof CalendarDays, hint: string): React.JSX.Element => (
    <button
      key={id}
      className={`rail-item ${page === id ? 'active' : ''}`}
      onClick={() => setPage(id)}
      title={hint ? `${label} (${hint})` : label}
      aria-current={page === id ? 'page' : undefined}
    >
      <Icon size={20} strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  )

  return (
    <nav className="rail" aria-label="Hauptnavigation">
      {ITEMS.map((i) => item(i.id, i.label, i.icon, i.hint))}
      <div className="rail-spacer" />
      <button className="rail-item" onClick={openPalette} title="Suchen & Befehle (Strg+K)">
        <Search size={20} strokeWidth={1.8} />
        <span>Suchen</span>
      </button>
      {item('settings', 'Optionen', Settings, '')}
    </nav>
  )
}
