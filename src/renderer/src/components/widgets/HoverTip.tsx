import { useCallback, useState } from 'react'

export interface Tip {
  x: number
  y: number
  title: string
  value?: string
}

/** Tooltip positioned inside a `position: relative` widget container. */
export function useHoverTip(): {
  tip: Tip | null
  show: (e: React.MouseEvent | React.FocusEvent, container: HTMLElement | null, title: string, value?: string) => void
  hide: () => void
} {
  const [tip, setTip] = useState<Tip | null>(null)
  const show = useCallback(
    (e: React.MouseEvent | React.FocusEvent, container: HTMLElement | null, title: string, value?: string) => {
      if (!container) return
      const box = container.getBoundingClientRect()
      const target = (e.currentTarget as HTMLElement).getBoundingClientRect()
      setTip({
        x: target.left - box.left + target.width / 2,
        y: target.top - box.top,
        title,
        value
      })
    },
    []
  )
  const hide = useCallback(() => setTip(null), [])
  return { tip, show, hide }
}

export function HoverTip({ tip }: { tip: Tip | null }): React.JSX.Element | null {
  if (!tip) return null
  return (
    <div className="hovertip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      <span>{tip.title}</span>
      {tip.value && <strong>{tip.value}</strong>}
    </div>
  )
}
