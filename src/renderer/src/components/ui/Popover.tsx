import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Anchor } from '../../store'

/**
 * Lightweight anchored popover (non-modal): closes on outside click and Escape,
 * never dims the rest of the app.
 */
export function Popover({
  anchor,
  onClose,
  width = 320,
  placement = 'side',
  className = '',
  children,
  label
}: {
  anchor: Anchor
  onClose: () => void
  width?: number
  placement?: 'side' | 'below'
  className?: string
  children: React.ReactNode
  label?: string
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    const m = 8
    let left: number
    let top: number
    if (placement === 'side') {
      left = anchor.x + anchor.w + m
      if (left + width > vw - m) left = anchor.x - width - m
      if (left < m) left = Math.min(vw - width - m, Math.max(m, anchor.x + anchor.w / 2 - width / 2))
      top = anchor.y
    } else {
      left = Math.min(vw - width - m, Math.max(m, anchor.x))
      top = anchor.y + anchor.h + 6
      if (top + h > vh - m) top = anchor.y - h - 6
    }
    top = Math.min(vh - h - m, Math.max(48, top))
    setPos({ left, top })
  }, [anchor, width, placement])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (ref.current?.contains(t)) return
      // clicks inside other popovers (e.g. a date picker opened from here) don't close this one
      if ((t as HTMLElement).closest?.('.popover, .ctx-menu')) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // defer so the click that opened the popover doesn't close it
    const t = setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className={`popover ${className}`}
      role="dialog"
      aria-label={label}
      style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
    >
      {children}
    </div>,
    document.body
  )
}
