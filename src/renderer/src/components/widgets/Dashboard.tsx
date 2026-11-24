import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, GripVertical, Maximize2, Minimize2, Plus } from 'lucide-react'
import type { OverviewLayout } from '@shared/types'
import { useStore } from '../../store'
import { useWidgets } from '../../plugins/registry'
import { moveWidget, resolveLayout, setHidden, setSize, stepWidget } from '../../plugins/layout'

/** the overview's widget grid; in edit mode widgets can be dragged, resized and hidden */
export function Dashboard({ editing }: { editing: boolean }): React.JSX.Element {
  const widgets = useWidgets()
  const layout = useStore((s) => s.data!.settings.overviewLayout)
  const updateSettings = useStore((s) => s.updateSettings)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const resolved = useMemo(() => resolveLayout(widgets, layout), [widgets, layout])
  const byId = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets])
  const save = (next: OverviewLayout): void => updateSettings({ overviewLayout: next })

  const endDrag = (): void => {
    setDragId(null)
    setOverId(null)
  }

  return (
    <>
      <div className={`dash-grid ${editing ? 'editing' : ''}`}>
        {resolved.visible.map(({ id, size }, i) => {
          const w = byId.get(id)!
          const Comp = w.component
          return (
            <div
              key={id}
              className={`dash-item ${w.tall ? 'tall' : ''} ${dragId === id ? 'dragging' : ''} ${overId === id && dragId !== id ? 'drop-target' : ''}`}
              data-size={size}
              draggable={editing}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', id)
                setDragId(id)
              }}
              onDragOver={(e) => {
                if (!dragId) return
                e.preventDefault()
                if (overId !== id) setOverId(id)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragId && dragId !== id) save(moveWidget(widgets, layout, dragId, id))
                endDrag()
              }}
              onDragEnd={endDrag}
            >
              {editing && (
                <div className="dash-tools" role="toolbar" aria-label={`${w.title} anordnen`}>
                  <span className="dash-grip" title="Ziehen zum Verschieben">
                    <GripVertical size={14} />
                    {w.title}
                  </span>
                  <button
                    className="icon-btn"
                    title="Nach vorne"
                    aria-label={`${w.title} nach vorne`}
                    disabled={i === 0}
                    onClick={() => save(stepWidget(widgets, layout, id, -1))}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    title="Nach hinten"
                    aria-label={`${w.title} nach hinten`}
                    disabled={i === resolved.visible.length - 1}
                    onClick={() => save(stepWidget(widgets, layout, id, 1))}
                  >
                    <ChevronRight size={15} />
                  </button>
                  <button
                    className="icon-btn"
                    title={size === 'full' ? 'Halbe Breite' : 'Volle Breite'}
                    aria-label={`${w.title}: ${size === 'full' ? 'halbe' : 'volle'} Breite`}
                    onClick={() => save(setSize(widgets, layout, id, size === 'full' ? 'half' : 'full'))}
                  >
                    {size === 'full' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                  <button
                    className="icon-btn"
                    title="Ausblenden"
                    aria-label={`${w.title} ausblenden`}
                    onClick={() => save(setHidden(widgets, layout, id, true))}>
                    <EyeOff size={14} />
                  </button>
                </div>
              )}
              <div className="dash-body" inert={editing || undefined}>
                <Comp />
              </div>
            </div>
          )
        })}
        {resolved.visible.length === 0 && (
          <p className="empty-mini dash-empty">
            Alle Widgets sind ausgeblendet. Über <strong>Anordnen</strong> holst du sie zurück.
          </p>
        )}
      </div>

      {editing && resolved.hidden.length > 0 && (
        <section className="dash-tray">
          <h4>
            <Eye size={14} /> Ausgeblendet
          </h4>
          <div className="dash-tray-items">
            {resolved.hidden.map((id) => {
              const w = byId.get(id)!
              return (
                <button
                  key={id}
                  className="chip dash-tray-chip"
                  title={w.description}
                  onClick={() => save(setHidden(widgets, layout, id, false))}
                >
                  <Plus size={13} /> {w.title}
                </button>
              )
            })}
          </div>
        </section>
      )}
    </>
  )
}
