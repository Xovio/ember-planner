import { Search } from 'lucide-react'
import { useStore } from '../store'
import { usePages, type PageDef } from '../plugins/registry'

export function NavRail(): React.JSX.Element {
  const page = useStore((s) => s.page)
  const setPage = useStore((s) => s.setPage)
  const openPalette = useStore((s) => s.openPalette)
  const pages = usePages()

  const item = ({ id, label, icon: Icon, hint }: PageDef): React.JSX.Element => (
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
      {pages.filter((p) => p.position !== 'bottom').map(item)}
      <div className="rail-spacer" />
      <button className="rail-item" onClick={openPalette} title="Suchen & Befehle (Strg+K)">
        <Search size={20} strokeWidth={1.8} />
        <span>Suchen</span>
      </button>
      {pages.filter((p) => p.position === 'bottom').map(item)}
    </nav>
  )
}
