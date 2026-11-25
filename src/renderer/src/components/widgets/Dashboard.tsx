import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Columns3, Eye, EyeOff, GripVertical, Maximize2, Minimize2, Plus, Settings2 } from 'lucide-react'
import type { OverviewLayout } from '@shared/types'
import { useStore } from '../../store'
import { useWidgets } from '../../plugins/registry'
import { MAX_COLUMNS, columnCount, moveWidget, nextSize, resolveLayout, setColumns, setHidden, setSize, spanOf, stepWidget } from '../../plugins/layout'

const SIZE_LABEL = { half: '1 Spalte', wide: '2 Spalten', full: 'volle Breite' }
const GAP = 18

/** width of the element, kept current */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

/** the overview's widget grid; in edit mode widgets can be dragged, resized and hidden */
export function Dashboard({ editing }: { editing: boolean }): React.JSX.Element {
  const widgets = useWidgets()
  const layout = useStore((s) => s.data!.settings.overviewLayout)
  const updateSettings = useStore((s) => s.updateSettings)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [settingsId, setSettingsId] = useState<string | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const width = useWidth(gridRef)
  // until the first measurement, assume the old two columns
  const cols = width ? columnCount(layout, width, GAP) : 2
  const resolved = useMemo(() => resolveLayout(widgets, layout), [widgets, layout])
  const byId = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets])
  const save = (next: OverviewLayout): void => updateSettings({ overviewLayout: next })

  const endDrag = (): void => {
    setDragId(null)
    setOverId(null)
  }

  return (
    <>
      {editing && (
        <div className="dash-columns" role="group" aria-label="Spalten">
          <Columns3 size={15} />
          <span>Spalten</span>
          <div className="segmented small">
            {[0, ...Array.from({ length: MAX_COLUMNS }, (_, i) => i + 1)].map((n) => (
              <button
                key={n}
                className={(layout?.columns ?? 0) === n ? 'on' : ''}
                title={n ? `${n} Spalten` : 'So viele, wie auf den Bildschirm passen'}
                onClick={() => save(setColumns(widgets, layout, n))}
              >
                {n || 'Auto'}
              </button>
            ))}
          </div>
          {cols < (layout?.columns ?? 0) && <span className="field-hint">Fenster zu schmal – gerade {cols}</span>}
        </div>
      )}
      <div
        ref={gridRef}
        className={`dash-grid ${editing ? 'editing' : ''} ${cols === 1 ? 'one-col' : ''}`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        // dropping on a free spot moves the widget to the end
        onDragOver={(e) => {
          if (dragId) e.preventDefault()
        }}
        onDrop={(e) => {
          e.preventDefault()
          const last = resolved.visible.at(-1)?.id
          if (dragId && last && dragId !== last) save(moveWidget(widgets, layout, dragId, last))
          endDrag()
        }}
      >
        {resolved.visible.map(({ id, size }, i) => {
          const w = byId.get(id)!
          const Comp = w.component
          return (
            <div
              key={id}
              className={`dash-item ${w.tall ? 'tall' : ''} ${dragId === id ? 'dragging' : ''} ${overId === id && dragId !== id ? 'drop-target' : ''}`}
              data-size={size}
              style={{ gridColumn: `span ${spanOf(size, cols)}` }}
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
                e.stopPropagation()
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
                  {cols > 1 && (
                    <button
                      className="icon-btn"
                      title={`Breite: ${SIZE_LABEL[size]} → ${SIZE_LABEL[nextSize(size, cols)]}`}
                      aria-label={`${w.title}: Breite ${SIZE_LABEL[nextSize(size, cols)]}`}
                      onClick={() => save(setSize(widgets, layout, id, nextSize(size, cols)))}
                    >
                      {size === 'full' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                  )}
                  {w.settings && (
                    <button
                      className={`icon-btn ${settingsId === id ? 'active' : ''}`}
                      title="Einstellungen"
                      aria-label={`${w.title}: Einstellungen`}
                      aria-expanded={settingsId === id}
                      onClick={() => setSettingsId(settingsId === id ? null : id)}
                    >
                      <Settings2 size={14} />
                    </button>
                  )}
                  <button
                    className="icon-btn"
                    title="Ausblenden"
                    aria-label={`${w.title} ausblenden`}
                    onClick={() => save(setHidden(widgets, layout, id, true))}>
                    <EyeOff size={14} />
                  </button>
                </div>
              )}
              {editing && settingsId === id && w.settings && (
                <div
                  className="dash-settings card"
                  // typing or selecting text in the form must not start dragging the widget
                  onDragStart={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                >
                  <w.settings />
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
