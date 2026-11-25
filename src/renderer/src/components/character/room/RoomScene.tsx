import { useEffect, useId, useRef, useState } from 'react'
import { ROOM_SIZE as N, WINDOW, avatarSpot, canPlace, depthOrder, footprint, furnitureById, surfaces, type Furniture } from '@shared/room'
import type { AvatarLook, PlacedFurniture } from '@shared/types'
import { ramp } from '@shared/wardrobe'
import { Avatar } from '../Avatar'
import { FLOOR_MATRIX, H, OX, P, PHASE_LOOK, T, pathOf, pts, toFloor, type Phase, type Pt } from './iso'
import { FurnitureShape, glowsOf } from './furniture'
import { FloorSurface, WallSurface } from './surfaces'

const CURTAIN = '#e5807a'
const VIEW = { x: 0, y: -4, w: 300, h: 262 }

interface Drag {
  id: string
  grab: [number, number]
  cand: PlacedFurniture
  moved: boolean
}

/**
 * The isometric room: walls with window, wooden floor, furniture, the character and light by time
 * of day. In edit mode furniture can be picked, dragged on the tiles (or along the walls) and dropped
 * where it fits; everything else (turning, storing, keys) lives in the parent.
 */
export function RoomScene({
  items,
  wall: wallId,
  floor: floorId,
  look,
  outfit,
  phase,
  editing = false,
  selected = null,
  onSelect = () => undefined,
  onMove = () => undefined,
  paused,
  label = 'Dein Zimmer'
}: {
  items: PlacedFurniture[]
  wall?: string
  floor?: string
  /** without a look the room is shown empty (shop preview) */
  look?: AvatarLook
  outfit?: Record<string, string>
  phase: Phase
  editing?: boolean
  selected?: string | null
  onSelect?(id: string | null): void
  onMove?(p: PlacedFurniture): void
  paused: boolean
  label?: string
}): React.JSX.Element {
  const uid = useId().replace(/:/g, '')
  const svg = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const room = { items }
  const lookP = PHASE_LOOK[phase]

  useEffect(() => {
    if (!editing) setDrag(null)
  }, [editing])

  const point = (e: React.PointerEvent): [number, number] => {
    const m = svg.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m)
    return [p.x, p.y]
  }
  const candidate = (d: Drag, x: number, y: number): PlacedFurniture => {
    const f = furnitureById(d.id)!
    const base = items.find((p) => p.id === d.id)!
    if (f.kind === 'wall') {
      const wall = x < OX ? 'l' : 'r'
      const a = wall === 'l' ? (OX - x) / T : (x - OX) / T
      return { ...base, wall, x: Math.round(a - d.grab[0]) }
    }
    const [u, v] = toFloor(x, y)
    return {
      ...base,
      x: Math.round(u - d.grab[0]),
      y: Math.round(v - d.grab[1])
    }
  }

  const down = (e: React.PointerEvent, p: PlacedFurniture): void => {
    if (!editing) return
    e.stopPropagation()
    onSelect(p.id)
    const [x, y] = point(e)
    const f = furnitureById(p.id)!
    let grab: [number, number]
    if (f.kind === 'wall') {
      const a = p.wall === 'l' ? (OX - x) / T : (x - OX) / T
      grab = [a - p.x, 0]
    } else {
      const [u, v] = toFloor(x, y)
      grab = [u - p.x, v - p.y]
    }
    svg.current!.setPointerCapture(e.pointerId)
    setDrag({ id: p.id, grab, cand: p, moved: false })
  }
  const move = (e: React.PointerEvent): void => {
    if (!drag) return
    const [x, y] = point(e)
    const cand = candidate(drag, x, y)
    if (cand.x !== drag.cand.x || cand.y !== drag.cand.y || cand.wall !== drag.cand.wall) setDrag({ ...drag, cand, moved: true })
  }
  const up = (): void => {
    if (!drag) return
    const base = items.find((p) => p.id === drag.id)
    if (
      drag.moved &&
      base &&
      canPlace(room, drag.cand) &&
      (drag.cand.x !== base.x || drag.cand.y !== base.y || drag.cand.wall !== base.wall)
    )
      onMove(drag.cand)
    setDrag(null)
  }

  // the dragged item is shown where it would land
  const shown = items.map((p) => (drag && p.id === drag.id ? drag.cand : p))
  const placed = shown.map((p) => ({ p, f: furnitureById(p.id) })).filter((x): x is { p: PlacedFurniture; f: Furniture } => !!x.f)
  const rugs = placed.filter((x) => x.f.kind === 'rug')
  const wallItems = placed.filter((x) => x.f.kind === 'wall')
  const floorItems = placed.filter((x) => x.f.kind === 'floor')
  const spot = avatarSpot({ items: shown })
  type Drawn = {
    x: number
    y: number
    w: number
    d: number
    key: string
    node: React.ReactNode
  }
  const drawn: Drawn[] = floorItems.map(({ f, p }) => ({
    ...footprint(p, f),
    key: p.id,
    node: itemNode(f, p)
  }))
  if (look)
    drawn.push({
    x: spot.x + 0.2,
    y: spot.y + 0.2,
    w: 0.6,
    d: 0.6,
    key: 'avatar',
    node: avatarNode()
  })
  const dragValid = drag ? canPlace(room, drag.cand) : true

  function itemNode(f: Furniture, p: PlacedFurniture): React.ReactNode {
    return (
      <g
        key={p.id}
        className={`room-item ${editing ? 'editable' : ''} ${selected === p.id ? 'selected' : ''} ${drag?.id === p.id ? 'dragging' : ''}`}
        data-id={p.id}
        onPointerDown={(e) => down(e, p)}
      >
        <FurnitureShape f={f} p={p} />
      </g>
    )
  }
  function avatarNode(): React.ReactNode {
    const [x, y] = P(spot.x + 0.5, spot.y + 0.5)
    const h = 80
    const w = (h * 220) / 310
    return (
      <g key="avatar" transform={`translate(${x - w / 2} ${y - (h * 296) / 310})`} className="room-avatar">
        <Avatar look={look!} outfit={outfit ?? {}} animate={!paused} pose="rest" size={w} title="Dein Charakter im Zimmer" />
      </g>
    )
  }

  const outline = (p: PlacedFurniture, f: Furniture): Pt[] => {
    if (f.kind === 'wall') {
      const r = footprint(p, f)
      const L = (a: number, z: number): Pt => (p.wall === 'l' ? P(0, a, z) : P(a, 0, z))
      return [L(r.x, 40), L(r.x + r.w, 40), L(r.x + r.w, 92), L(r.x, 92)]
    }
    const r = footprint(p, f)
    return [P(r.x, r.y), P(r.x + r.w, r.y), P(r.x + r.w, r.y + r.d), P(r.x, r.y + r.d)]
  }
  const sel = selected ? placed.find((x) => x.p.id === selected) : undefined

  // window glass: rounded top
  const win = (inset: number): Pt[] => {
    const a0 = WINDOW.x + 0.12 + inset
    const a1 = WINDOW.x + WINDOW.w - 0.12 - inset
    const z0 = 34 + inset * 18
    const z1 = 70 - inset * 10
    const mid = (a0 + a1) / 2
    const arch = Array.from({ length: 13 }, (_, i) => {
      const t = Math.PI - (i / 12) * Math.PI
      return P(mid + Math.cos(t) * (a1 - a0) * 0.5, 0, z1 + Math.sin(t) * (12 - inset * 10))
    })
    return [P(a0, 0, z0), ...arch, P(a1, 0, z0)]
  }
  /** a curtain tied back towards its outer edge (side 1: left of the window, -1: right) */
  const curtain = (outer: number, inner: number): Pt[] => {
    const top = 86
    const bottom = 30
    const out: Pt[] = [P(outer, 0.02, top), P(inner, 0.02, top)]
    for (let i = 1; i <= 10; i++) {
      const t = i / 10
      const pull = Math.sin(t * Math.PI * 0.85) * 0.72
      out.push(P(inner + (outer - inner) * pull + Math.sin(t * 9) * 0.02, 0.02, top - t * (top - bottom)))
    }
    out.push(P(outer, 0.02, bottom))
    return out
  }
  const surf = surfaces({ wall: wallId, floor: floorId })
  const wr = ramp(surf.wall.color)
  const fr = ramp(surf.floor.color)
  const cr = ramp(CURTAIN)
  const glows = placed.flatMap(({ f, p }) => glowsOf(f, p))

  return (
    <svg
      ref={svg}
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      className={`room-scene ${editing ? 'editing' : ''} ${paused ? 'paused' : ''}`}
      role="img"
      aria-label={label}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
      onPointerDown={() => editing && onSelect(null)}
      strokeLinejoin="round"
    >
      <defs>
        <radialGradient id={`glow${uid}`}>
          <stop offset="0" stopColor="#ffd98a" stopOpacity=".8" />
          <stop offset=".45" stopColor="#ffc870" stopOpacity=".3" />
          <stop offset="1" stopColor="#ffc870" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`aoY${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b3a5e" stopOpacity=".22" />
          <stop offset="1" stopColor="#5b3a5e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`aoX${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5b3a5e" stopOpacity=".22" />
          <stop offset="1" stopColor="#5b3a5e" stopOpacity="0" />
        </linearGradient>
        <filter id={`soft${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={`grain${uid}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 .36 0 0 0 0 .23 0 0 0 0 .37 0 0 0 .08 0" />
        </filter>
        <clipPath id={`roomShape${uid}`}>
          <polygon points={pts([P(-0.3, N, H), P(-0.3, -0.3, H), P(N, -0.3, H), P(N, -0.3, -8), P(N, N, -8), P(-0.3, N, -8)])} />
        </clipPath>
        <clipPath id={`glass${uid}`}>
          <polygon points={pts(win(0.06))} />
        </clipPath>
      </defs>

      {/* floor slab and wall ends: the diorama edge */}
      <polygon points={pts([P(-0.3, N, 0), P(N, N, 0), P(N, N, -8), P(-0.3, N, -8)])} fill={fr.shade} />
      <polygon points={pts([P(N, -0.3, 0), P(N, N, 0), P(N, N, -8), P(N, -0.3, -8)])} fill={ramp(fr.shade).shade} />

      {/* walls */}
      <WallSurface f={surf.wall} side="l" />
      <WallSurface f={surf.wall} side="r" />
      <polygon points={pts([P(0, 0), P(0, N), P(0, N, 34), P(0, 0, 34)])} fill={ramp(wr.shade).shade} opacity=".35" />
      <polygon points={pts([P(0, 0), P(N, 0), P(N, 0, 34), P(0, 0, 34)])} fill={wr.shade} opacity=".35" />
      <polyline points={pts([P(0, N, 34), P(0, 0, 34), P(N, 0, 34)])} fill="none" stroke={wr.light} strokeWidth="1.4" />
      <polygon points={pts([P(0, 0), P(0, N), P(0, N, 5), P(0, 0, 5)])} fill={wr.line} opacity=".35" />
      <polygon points={pts([P(0, 0), P(N, 0), P(N, 0, 5), P(0, 0, 5)])} fill={wr.line} opacity=".25" />
      {/* wall tops and ends */}
      <polygon points={pts([P(-0.3, N, H), P(-0.3, -0.3, H), P(N, -0.3, H), P(N, 0, H), P(0, 0, H), P(0, N, H)])} fill={wr.light} />
      <polygon points={pts([P(-0.3, N, 0), P(0, N, 0), P(0, N, H), P(-0.3, N, H)])} fill={ramp(wr.shade).shade} />
      <polygon points={pts([P(N, 0, 0), P(N, -0.3, 0), P(N, -0.3, H), P(N, 0, H)])} fill={wr.shade} />

      {/* window */}
      <polygon points={pts(win(-0.04))} fill={ramp(WOOD_WINDOW).line} opacity=".8" />
      <polygon points={pts(win(0.06))} fill={lookP.sky} />
      <g clipPath={`url(#glass${uid})`}>
        {phase === 'night' ? (
          <>
            <circle cx={P(3.35, 0, 70)[0]} cy={P(3.35, 0, 70)[1]} r="5" fill="#fff3d6" />
            <circle cx={P(3.45, 0, 71)[0]} cy={P(3.45, 0, 71)[1]} r="4.4" fill={lookP.sky} />
            {[
              [2.5, 62],
              [2.8, 74],
              [3.1, 56],
              [3.6, 52]
            ].map(([a, z], i) => (
              <circle key={i} cx={P(a, 0, z)[0]} cy={P(a, 0, z)[1]} r=".9" fill="#fff3d6" />
            ))}
          </>
        ) : (
          <>
            <ellipse cx={P(2.7, 0, 64)[0]} cy={P(2.7, 0, 64)[1]} rx="9" ry="3.4" fill="#fff8ec" opacity=".85" />
            <ellipse cx={P(3.4, 0, 54)[0]} cy={P(3.4, 0, 54)[1]} rx="7" ry="2.6" fill="#fff8ec" opacity=".7" />
            <path
              d={pathOf([P(2, 0, 34), P(2.6, 0, 42), P(3.2, 0, 38), P(4, 0, 45), P(4, 0, 34)])}
              fill={phase === 'evening' ? '#b86a6a' : '#8fb59a'}
              opacity=".8"
            />
          </>
        )}
      </g>
      <line
        x1={P(3, 0, 34)[0]}
        y1={P(3, 0, 34)[1]}
        x2={P(3, 0, 81)[0]}
        y2={P(3, 0, 81)[1]}
        stroke={ramp(WOOD_WINDOW).light}
        strokeWidth="1.6"
      />
      <line
        x1={P(2.15, 0, 56)[0]}
        y1={P(2.15, 0, 56)[1]}
        x2={P(3.85, 0, 56)[0]}
        y2={P(3.85, 0, 56)[1]}
        stroke={ramp(WOOD_WINDOW).light}
        strokeWidth="1.6"
      />
      <polygon points={pts([P(1.95, 0, 30), P(4.05, 0, 30), P(4.05, 0.28, 30), P(1.95, 0.28, 30)])} fill={ramp(WOOD_WINDOW).light} />
      <polygon points={pts([P(1.95, 0.28, 30), P(4.05, 0.28, 30), P(4.05, 0.28, 27), P(1.95, 0.28, 27)])} fill={ramp(WOOD_WINDOW).base} />
      <polygon points={pts(curtain(1.55, 2.15))} fill={cr.base} stroke={cr.line} strokeOpacity=".3" strokeWidth=".5" />
      <polygon points={pts(curtain(4.45, 3.85))} fill={cr.shade} stroke={cr.line} strokeOpacity=".3" strokeWidth=".5" />
      <line
        x1={P(1.4, 0.02, 87)[0]}
        y1={P(1.4, 0.02, 87)[1]}
        x2={P(4.6, 0.02, 87)[0]}
        y2={P(4.6, 0.02, 87)[1]}
        stroke={ramp(WOOD_WINDOW).line}
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* floor */}
      <g transform={FLOOR_MATRIX}>
        <FloorSurface f={surf.floor} />
        <rect x="0" y="0" width={N} height=".9" fill={`url(#aoY${uid})`} />
        <rect x="0" y="0" width=".9" height={N} fill={`url(#aoX${uid})`} />
        <polygon
          points={`${WINDOW.x + 0.1},0.05 ${WINDOW.x + WINDOW.w - 0.1},0.05 ${WINDOW.x + WINDOW.w + 0.9},2.6 ${WINDOW.x + 1},2.6`}
          fill="#fff3d6"
          opacity={lookP.sun}
        />
        {editing &&
          Array.from({ length: N + 1 }, (_, i) => (
            <g key={`g${i}`} opacity=".55">
              <line x1={i} y1="0" x2={i} y2={N} stroke="#fff3d6" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
              <line x1="0" y1={i} x2={N} y2={i} stroke="#fff3d6" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
            </g>
          ))}
      </g>

      {/* rugs, then where the selection / drag lands */}
      {rugs.map(({ f, p }) => itemNode(f, p))}
      {sel && sel.f.kind !== 'wall' && (
        <polygon points={pts(outline(sel.p, sel.f))} className={`room-footprint ${drag && !dragValid ? 'blocked' : ''}`} />
      )}

      {/* soft contact shadows */}
      <g filter={`url(#soft${uid})`} opacity=".2">
        {floorItems.map(({ f, p }) => {
          const r = footprint(p, f)
          const g = f.style === 'plant' || f.style === 'lamp' || f.style === 'cushion' || f.style === 'candles' ? 0.22 : 0
          return (
            <polygon
              key={p.id}
              points={pts([
                P(r.x + g, r.y + g),
                P(r.x + r.w - g + 0.1, r.y + g),
                P(r.x + r.w - g + 0.1, r.y + r.d - g + 0.1),
                P(r.x + g, r.y + r.d - g + 0.1)
              ])}
              fill="#5b3a5e"
            />
          )
        })}
      </g>

      {wallItems.map(({ f, p }) => itemNode(f, p))}
      {sel && sel.f.kind === 'wall' && (
        <polygon points={pts(outline(sel.p, sel.f))} className={`room-footprint wall ${drag && !dragValid ? 'blocked' : ''}`} />
      )}
      {depthOrder(drawn).map((d) => d.node)}

      {/* light: tint for the time of day, lamps glowing, a little grain (only on the room) */}
      <g clipPath={`url(#roomShape${uid})`} pointerEvents="none">
        <rect
          x={VIEW.x}
          y={VIEW.y}
          width={VIEW.w}
          height={VIEW.h}
          fill={lookP.tint}
          opacity={lookP.tintOpacity}
          style={{ mixBlendMode: 'multiply' }}
          pointerEvents="none"
        />
        <g style={{ mixBlendMode: 'screen' }} opacity={lookP.glow} pointerEvents="none">
          {glows.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={`url(#glow${uid})`} className="room-glow" />
          ))}
        </g>
        <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} filter={`url(#grain${uid})`} pointerEvents="none" />
      </g>
    </svg>
  )
}

const WOOD_WINDOW = '#b8794a'
