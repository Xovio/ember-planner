import { useLayoutEffect, useRef, useState } from 'react'
import { isSurface, type Furniture } from '@shared/room'
import { ramp } from '@shared/wardrobe'
import { FurnitureShape } from './furniture'
import { H, P, pts } from './iso'
import { RoomScene } from './RoomScene'

/** one item on a little patch of floor (or wall), for the chest and the shop; the view hugs the drawing */
export function FurniturePreview({ f, size = 84 }: { f: Furniture; size?: number }): React.JSX.Element {
  const g = useRef<SVGGElement>(null)
  const [box, setBox] = useState<string | null>(null)
  useLayoutEffect(() => {
    const b = g.current?.getBBox()
    if (!b || !b.width) return
    const side = Math.max(b.width, b.height, 30) + 8
    setBox(`${b.x + b.width / 2 - side / 2} ${b.y + b.height / 2 - side / 2} ${side} ${side}`)
  }, [f])
  const { w, d } = f
  if (isSurface(f))
    return (
      <div className="surface-preview" style={{ width: size, height: size }} aria-hidden="true">
        <RoomScene items={[]} wall={f.kind === 'wallpaper' ? f.id : undefined} floor={f.kind === 'flooring' ? f.id : undefined} phase="day" paused label={f.name} />
      </div>
    )
  return (
    <svg viewBox={box ?? '0 0 300 260'} width={size} height={size} aria-hidden="true" style={{ visibility: box ? 'visible' : 'hidden' }}>
      <g ref={g}>
        {f.kind === 'wall' ? (
          <>
            <polygon points={pts([P(0, 0, 36), P(w, 0, 36), P(w, 0, H - 6), P(0, 0, H - 6)])} fill={ramp('#f2d9c0').base} />
            <FurnitureShape f={f} p={{ id: f.id, x: 0, y: 0, rot: 0, wall: 'r' }} />
          </>
        ) : (
          <>
            <polygon points={pts([P(0, 0), P(w, 0), P(w, d), P(0, d)])} fill="#c98d5f" opacity=".35" />
            <FurnitureShape f={f} p={{ id: f.id, x: 0, y: 0, rot: 0 }} />
          </>
        )}
      </g>
    </svg>
  )
}
