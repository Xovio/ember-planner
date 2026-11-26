import { rotPt } from '@shared/room'
import { ramp } from '@shared/wardrobe'

/**
 * Isometric helpers: a tile is 2·T wide and T tall on screen, walls are H high.
 * Floor point (u, v, height z) → screen. (0, 0) is the back corner of the room.
 */
export const T = 20
export const H = 104
export const OX = 150
export const OY = 116

export type Pt = [number, number]

export const P = (u: number, v: number, z = 0): Pt => [OX + T * (u - v), OY + (T / 2) * (u + v) - z]

export const pts = (a: Pt[]): string => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/** screen → floor (u, v) */
export function toFloor(x: number, y: number): [number, number] {
  const a = (x - OX) / T
  const b = (y - OY) / (T / 2)
  return [(a + b) / 2, (b - a) / 2]
}

/** the matrix that maps floor units onto the screen, for flat things (rugs, grid) */
export const FLOOR_MATRIX = `matrix(${T} ${T / 2} ${-T} ${T / 2} ${OX} ${OY})`

/** a box in tile units: footprint x, y, w, d and height h (screen units) from z up */
export interface Part {
  x: number
  y: number
  z?: number
  w: number
  d: number
  h: number
  c: string
}

export const box = (x: number, y: number, w: number, d: number, h: number, c: string, z = 0): Part => ({ x, y, z, w, d, h, c })

/** a point in a W×D footprint turned `rot` quarter turns (shared with the room logic) */
export { rotPt } from '@shared/room'

export function rotPart(p: Part, W: number, D: number, rot: number): Part {
  const [ax, ay] = rotPt(p.x, p.y, W, D, rot)
  const [bx, by] = rotPt(p.x + p.w, p.y + p.d, W, D, rot)
  return {
    ...p,
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    d: Math.abs(by - ay)
  }
}

/** the three visible faces of a box: front-left (lit), front-right (shade) and top (light) */
export function BoxShape({ b }: { b: Part }): React.JSX.Element {
  const r = ramp(b.c)
  const z0 = b.z ?? 0
  const z1 = z0 + b.h
  const { x, y, w, d } = b
  const stroke = { stroke: r.line, strokeOpacity: 0.35, strokeWidth: 0.5 }
  return (
    <g>
      <polygon points={pts([P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x, y + d, z1)])} fill={r.base} {...stroke} />
      <polygon points={pts([P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z1), P(x + w, y, z1)])} fill={r.shade} {...stroke} />
      <polygon points={pts([P(x, y, z1), P(x + w, y, z1), P(x + w, y + d, z1), P(x, y + d, z1)])} fill={r.light} {...stroke} />
    </g>
  )
}

/** a smooth path through screen points */
export const pathOf = (a: Pt[], close = true): string =>
  a.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + (close ? ' Z' : '')

/** time of day for the room light */
export type Phase = 'morning' | 'day' | 'evening' | 'night'

export function phaseAt(d: Date): Phase {
  const h = d.getHours() + d.getMinutes() / 60
  if (h >= 6 && h < 9) return 'morning'
  if (h >= 9 && h < 17) return 'day'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

export const PHASE_LOOK: Record<
  Phase,
  {
    sky: string
    tint: string
    tintOpacity: number
    glow: number
    sun: number
    label: string
  }
> = {
  morning: {
    sky: '#f7c9b4',
    tint: '#ffcfb0',
    tintOpacity: 0.1,
    glow: 0.35,
    sun: 0.26,
    label: 'Morgen'
  },
  day: {
    sky: '#a8d4ef',
    tint: '#fff1d6',
    tintOpacity: 0.05,
    glow: 0.12,
    sun: 0.32,
    label: 'Tag'
  },
  evening: {
    sky: '#f2a77c',
    tint: '#e9875a',
    tintOpacity: 0.17,
    glow: 0.75,
    sun: 0.14,
    label: 'Abend'
  },
  night: {
    sky: '#38325f',
    tint: '#241c4a',
    tintOpacity: 0.36,
    glow: 1,
    sun: 0.06,
    label: 'Nacht'
  }
}
