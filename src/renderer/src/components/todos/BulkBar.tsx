import { CheckCheck, MoreHorizontal, Sun, Sunrise, CalendarArrowUp, Trash2, X } from 'lucide-react'
import { useStore } from '../../store'
import { dayPresets, todoMenu } from '../../lib/menus'

/** Appears when several ToDos are picked (Strg/Shift+Klick). */
export function BulkBar({ ids: visible }: { ids: string[] }): React.JSX.Element | null {
  const picked = useStore((s) => s.picked)
  const setPicked = useStore((s) => s.setPicked)
  const toggleTodos = useStore((s) => s.toggleTodos)
  const updateTodos = useStore((s) => s.updateTodos)
  const deleteTodos = useStore((s) => s.deleteTodos)
  const openMenu = useStore((s) => s.openMenu)
  const ids = picked.filter((p) => visible.includes(p))
  if (ids.length < 2) return null
  const p = dayPresets()
  const n = `${ids.length} ToDos`

  return (
    <div className="bulkbar" role="toolbar" aria-label="Mehrfachauswahl">
      <strong>{ids.length} ausgewählt</strong>
      <button title="Erledigt" onClick={() => (toggleTodos(ids, true), setPicked([]))}>
        <CheckCheck size={15} />
      </button>
      <button title="Wunschtag heute" onClick={() => updateTodos(ids, { softDeadline: p[0].date }, `${n}: Wunschtag heute`)}>
        <Sun size={15} />
      </button>
      <button title="Wunschtag morgen" onClick={() => updateTodos(ids, { softDeadline: p[1].date }, `${n}: Wunschtag morgen`)}>
        <Sunrise size={15} />
      </button>
      <button title="Wunschtag nächste Woche" onClick={() => updateTodos(ids, { softDeadline: p[3].date }, `${n}: nächste Woche`)}>
        <CalendarArrowUp size={15} />
      </button>
      <button
        title="Mehr"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          openMenu(r.left, r.bottom + 4, todoMenu(ids))
        }}
      >
        <MoreHorizontal size={15} />
      </button>
      <button title="In den Papierkorb" className="danger" onClick={() => deleteTodos(ids)}>
        <Trash2 size={15} />
      </button>
      <span style={{ flex: 1 }} />
      <button title="Auswahl aufheben (Esc)" onClick={() => setPicked([])}>
        <X size={15} />
      </button>
    </div>
  )
}
