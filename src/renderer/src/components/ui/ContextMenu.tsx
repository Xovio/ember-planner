import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight } from 'lucide-react'
import { useStore, type MenuItem } from '../../store'

/** Global right-click menu with one level of submenus and keyboard support. */
export function ContextMenu(): React.JSX.Element | null {
  const menu = useStore((s) => s.contextMenu)
  const close = useStore((s) => s.closeMenu)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent): void => {
      if (!(e.target as HTMLElement).closest('.ctx-menu')) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    const t = setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('blur', close)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('blur', close)
    }
  }, [menu, close])

  if (!menu) return null
  return createPortal(<MenuList items={menu.items} x={menu.x} y={menu.y} onDone={close} autoFocus />, document.body)
}

function MenuList({
  items,
  x,
  y,
  onDone,
  autoFocus
}: {
  items: MenuItem[]
  x: number
  y: number
  onDone: () => void
  autoFocus?: boolean
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [open, setOpen] = useState<number | null>(null)
  const [subPos, setSubPos] = useState({ x: 0, y: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setPos({
      left: x + w > window.innerWidth - 8 ? Math.max(8, x - w) : x,
      top: y + h > window.innerHeight - 8 ? Math.max(8, window.innerHeight - h - 8) : y
    })
    if (autoFocus) el.querySelector<HTMLButtonElement>('button')?.focus()
  }, [x, y, autoFocus])

  const openSub = (i: number, el: HTMLElement): void => {
    const r = el.getBoundingClientRect()
    setSubPos({ x: r.right - 2, y: r.top - 5 })
    setOpen(i)
  }

  return (
    <div
      ref={ref}
      className="ctx-menu"
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={(e) => {
        const btns = [...(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > button') ?? [])]
        const idx = btns.indexOf(document.activeElement as HTMLButtonElement)
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          const next = btns[(idx + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]
          next?.focus()
        }
      }}
    >
      {items.map((it, i) =>
        it.separator ? (
          <hr key={i} />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`ctx-item ${it.danger ? 'danger' : ''} ${open === i ? 'open' : ''}`}
            onMouseEnter={(e) => (it.items ? openSub(i, e.currentTarget) : setOpen(null))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' && it.items) {
                e.stopPropagation()
                openSub(i, e.currentTarget)
              }
            }}
            onClick={(e) => {
              if (it.items) return openSub(i, e.currentTarget)
              it.action?.()
              onDone()
            }}
          >
            <span className="ctx-check">{it.checked ? <Check size={13} /> : it.swatch ? <i style={{ background: it.swatch }} /> : null}</span>
            <span className="ctx-label">{it.label}</span>
            {it.hint && <span className="ctx-hint">{it.hint}</span>}
            {it.items && <ChevronRight size={13} className="ctx-arrow" />}
          </button>
        )
      )}
      {open !== null && items[open]?.items && <MenuList items={items[open].items!} x={subPos.x} y={subPos.y} onDone={onDone} />}
    </div>
  )
}
