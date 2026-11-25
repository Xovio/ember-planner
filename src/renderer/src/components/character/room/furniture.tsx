import type { ReactNode } from 'react'
import { depthOrder, type Furniture } from '@shared/room'
import type { PlacedFurniture } from '@shared/types'
import { ramp } from '@shared/wardrobe'
import { BoxShape, FLOOR_MATRIX, P, box, pathOf, pts, rotPart, rotPt, type Part, type Pt } from './iso'

/**
 * Every piece of furniture as code: boxes in its own footprint (front = +y when not turned)
 * plus organic decor drawn through L(x, y, z), which follows the turn. Wall items use
 * x = along the wall, y = out of the wall.
 */

type L = (x: number, y: number, z?: number) => Pt
type R = ReturnType<typeof ramp>

interface Spec {
  parts: Part[]
  decor?: (L: L, r: R) => ReactNode
  /** light sources: x, y, z, radius */
  glows?: [number, number, number, number][]
}

const WOOD = '#b8794a'
const DARK = '#8a5a3a'
const CREAM = '#f3ead8'
const TERRA = '#d9824a'
const BOOKS = ['#e5615a', '#4a5a8c', '#e0a43c', '#8fb59a', '#a998d8', '#f3ead8', '#d9824a', '#6a8caf']

const legs = (x0: number, y0: number, x1: number, y1: number, h: number, c: string, t = 0.08): Part[] => [
  box(x0, y0, t, t, h, c),
  box(x1 - t, y0, t, t, h, c),
  box(x0, y1 - t, t, t, h, c),
  box(x1 - t, y1 - t, t, t, h, c)
]

/** a circle lying in a wall (a along, z up), as a polygon */
const wallCircle = (L: L, a: number, z: number, r: number, o: number): Pt[] =>
  Array.from({ length: 20 }, (_, i) => {
    const t = (i / 20) * Math.PI * 2
    return L(a + (Math.cos(t) * r) / 22.4, o, z + Math.sin(t) * r)
  })

function leaves(x: number, y: number, r: R, big = false): ReactNode {
  const s = big ? 1.35 : 1
  const leaf = (a: number, len: number, fill: string, k: number): ReactNode => (
    <path
      key={k}
      d={`M0,0 Q${-6 * s},${-len * 0.5} 0,${-len} Q${6 * s},${-len * 0.5} 0,0Z`}
      transform={`translate(${x} ${y}) rotate(${a})`}
      fill={fill}
      stroke={r.line}
      strokeOpacity=".25"
      strokeWidth=".5"
    />
  )
  return (
    <g className="rf-sway" style={{ transformOrigin: `${x}px ${y}px` }}>
      {leaf(-58, 20 * s, r.shade, 1)}
      {leaf(55, 19 * s, r.shade, 2)}
      {leaf(-28, 27 * s, r.base, 3)}
      {leaf(24, 26 * s, r.base, 4)}
      {leaf(-4, 32 * s, r.light, 5)}
    </g>
  )
}

function shelfBooks(x0: number, x1: number, z: number, seed: number): Part[] {
  const out: Part[] = []
  let x = x0
  let i = seed
  while (x < x1 - 0.1) {
    const w = 0.09 + ((i * 7) % 5) * 0.015
    const h = 10 + ((i * 5) % 4) * 1.6
    if (i % 7 !== 3) out.push(box(x, 0.16, w, 0.3, h, BOOKS[i % BOOKS.length], z))
    x += w + 0.008
    i++
  }
  return out
}

const SPECS: Record<string, (c: string) => Spec> = {
  beanbag: () => ({
    parts: [],
    decor: (L, r) => {
      const [x, y] = L(0.5, 0.55)
      return (
        <g>
          <path
            d={`M${x - 15},${y - 3} Q${x - 17},${y - 21} ${x - 3},${y - 24} Q${x + 14},${y - 25} ${x + 16},${y - 6} Q${x + 16},${y + 4} ${x},${y + 5} Q${x - 14},${y + 5} ${x - 15},${y - 3}Z`}
            fill={r.base}
            stroke={r.line}
            strokeWidth=".7"
          />
          <path
            d={`M${x + 5},${y - 23} Q${x + 16},${y - 19} ${x + 16},${y - 6} Q${x + 16},${y + 4} ${x + 2},${y + 5} Q${x + 12},${y - 6} ${x + 5},${y - 23}Z`}
            fill={r.shade}
          />
          <path
            d={`M${x - 10},${y - 9} Q${x - 1},${y - 3} ${x + 9},${y - 10}`}
            stroke={r.shade}
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
          />
          <ellipse cx={x - 7} cy={y - 17} rx="4.5" ry="2.4" fill={r.light} opacity=".85" />
        </g>
      )
    }
  }),
  plant: () => ({
    parts: [box(0.3, 0.3, 0.4, 0.4, 13, TERRA)],
    decor: (L, r) => {
      const [x, y] = L(0.5, 0.5, 13)
      return leaves(x, y, r)
    }
  }),
  monstera: () => ({
    parts: [box(0.24, 0.24, 0.52, 0.52, 11, '#e3d2b4')],
    decor: (L, r) => {
      const [x, y] = L(0.5, 0.5, 11)
      return leaves(x, y, r, true)
    }
  }),
  lamp: () => ({
    parts: [box(0.36, 0.36, 0.28, 0.28, 3, DARK)],
    glows: [[0.5, 0.5, 52, 64]],
    decor: (L, r) => {
      const [x, y0] = L(0.5, 0.5, 3)
      const yb = L(0.5, 0.5, 50)[1]
      const yt = L(0.5, 0.5, 64)[1]
      return (
        <g>
          <line x1={x} y1={y0} x2={x} y2={yb} stroke={DARK} strokeWidth="2.2" strokeLinecap="round" />
          <path
            d={`M${x - 11},${yb} Q${x},${yb + 3} ${x + 11},${yb} L${x + 7},${yt} Q${x},${yt - 2} ${x - 7},${yt}Z`}
            fill={r.base}
            stroke={r.line}
            strokeWidth=".7"
          />
          <path
            d={`M${x + 2},${yb + 1.4} Q${x + 7},${yb + 1} ${x + 11},${yb} L${x + 7},${yt} Q${x + 4},${yt - 1} ${x + 2},${yt - 1}Z`}
            fill={r.shade}
          />
          <ellipse cx={x} cy={yb + 1} rx="8" ry="1.6" fill="#fff3d6" opacity=".8" />
        </g>
      )
    }
  }),
  stool: (c) => ({
    parts: [...legs(0.27, 0.27, 0.73, 0.73, 13, ramp(c).shade), box(0.22, 0.22, 0.56, 0.56, 3, c, 13)]
  }),
  cushion: () => ({
    parts: [],
    decor: (L, r) => {
      const [x, y] = L(0.5, 0.5)
      return (
        <g>
          <ellipse cx={x} cy={y - 2} rx="14" ry="7" fill={r.shade} />
          <ellipse cx={x} cy={y - 5} rx="14" ry="7" fill={r.base} stroke={r.line} strokeWidth=".6" />
          <ellipse cx={x - 3} cy={y - 7} rx="5" ry="2" fill={r.light} opacity=".8" />
          <circle cx={x} cy={y - 5} r="1.3" fill={r.shade} />
        </g>
      )
    }
  }),
  books: () => ({
    parts: [
      box(0.24, 0.3, 0.52, 0.4, 4, '#e5615a'),
      box(0.27, 0.27, 0.46, 0.42, 4, '#8fb59a', 4),
      box(0.3, 0.33, 0.42, 0.34, 3.5, CREAM, 8),
      box(0.33, 0.31, 0.36, 0.36, 3, '#4a5a8c', 11.5)
    ]
  }),
  candles: () => ({
    parts: [],
    glows: [[0.5, 0.5, 14, 42]],
    decor: (L, r) =>
      (
        [
          [0.36, 0.42, 12],
          [0.62, 0.38, 16],
          [0.5, 0.66, 8]
        ] as const
      ).map(([a, b, h], i) => {
        const [x, y] = L(a, b)
        return (
          <g key={i}>
            <rect x={x - 2.6} y={y - h} width="5.2" height={h} rx="1" fill={r.base} />
            <rect x={x} y={y - h} width="2.6" height={h} fill={r.shade} />
            <ellipse cx={x} cy={y - h} rx="2.6" ry="1.2" fill={r.light} />
            <path
              className="rf-flicker"
              d={`M${x},${y - h - 7} Q${x + 2.3},${y - h - 3} ${x},${y - h - 1.3} Q${x - 2.3},${y - h - 3} ${x},${y - h - 7}Z`}
              fill="#ffc861"
              style={{ animationDelay: `${i * 0.4}s` }}
            />
          </g>
        )
      })
  }),
  nightstand: (c) => ({
    parts: [box(0.14, 0.16, 0.72, 0.68, 20, c), box(0.2, 0.84, 0.6, 0.03, 7, ramp(c).light, 9)],
    decor: (L, r) => {
      const [x, y] = L(0.5, 0.87, 12.5)
      const [vx, vy] = L(0.5, 0.45, 20)
      return (
        <g>
          <circle cx={x} cy={y} r="1.3" fill={r.line} />
          <path d={`M${vx - 3},${vy} Q${vx - 4},${vy - 6} ${vx},${vy - 8} Q${vx + 4},${vy - 6} ${vx + 3},${vy}Z`} fill="#8cc4e8" />
          <circle cx={vx - 1} cy={vy - 11} r="2.4" fill="#f0a6b4" />
          <circle cx={vx + 2} cy={vy - 12} r="2" fill="#e0a43c" />
        </g>
      )
    }
  }),
  armchair: (c) => ({
    parts: [
      box(0.1, 0.04, 0.8, 0.2, 25, c),
      box(0.2, 0.24, 0.6, 0.66, 9, c),
      box(0.04, 0.24, 0.16, 0.68, 15, c),
      box(0.8, 0.24, 0.16, 0.68, 15, c),
      box(0.22, 0.28, 0.56, 0.58, 3, c, 9)
    ]
  }),
  sofa: (c) => ({
    parts: [
      box(0.05, 0.04, 1.9, 0.2, 25, c),
      box(0.2, 0.24, 1.6, 0.66, 9, c),
      box(0.03, 0.24, 0.17, 0.7, 15, c),
      box(1.8, 0.24, 0.17, 0.7, 15, c),
      box(0.23, 0.3, 0.76, 0.56, 3, c, 9),
      box(1.01, 0.3, 0.76, 0.56, 3, c, 9)
    ],
    decor: (L) => {
      const [x, y] = L(0.45, 0.32, 18)
      return (
        <path
          d={`M${x - 6},${y + 2} Q${x - 7},${y - 8} ${x},${y - 9} Q${x + 7},${y - 8} ${x + 6},${y + 2} Q${x},${y + 4} ${x - 6},${y + 2}Z`}
          fill="#f3c26b"
          stroke="#8a6a3a"
          strokeOpacity=".35"
          strokeWidth=".6"
        />
      )
    }
  }),
  bookshelf: (c) => ({
    parts: [
      box(0.05, 0.05, 1.9, 0.08, 58, c),
      box(0.05, 0.13, 0.09, 0.36, 58, c),
      box(1.86, 0.13, 0.09, 0.36, 58, c),
      box(0.14, 0.13, 1.72, 0.36, 2.5, c),
      box(0.14, 0.13, 1.72, 0.36, 2.5, c, 19),
      box(0.14, 0.13, 1.72, 0.36, 2.5, c, 38),
      box(0.05, 0.13, 1.9, 0.36, 3, c, 56),
      ...shelfBooks(0.17, 1.84, 2.5, 1),
      ...shelfBooks(0.17, 1.84, 21.5, 4),
      ...shelfBooks(0.17, 1.84, 40.5, 9)
    ]
  }),
  desk: (c) => ({
    parts: [
      box(0.06, 0.16, 0.1, 0.1, 24, c),
      box(0.06, 0.74, 0.1, 0.1, 24, c),
      box(1.3, 0.16, 0.62, 0.68, 24, c),
      box(0, 0.1, 2, 0.8, 3, c, 24),
      box(0.36, 0.36, 0.6, 0.4, 1.2, '#d6d2da', 27),
      box(0.36, 0.3, 0.6, 0.05, 15, '#5a6a9c', 27)
    ],
    decor: (L, r) => {
      const [dx, dy] = L(1.61, 0.84, 15)
      const [mx, my] = L(1.55, 0.45, 27)
      return (
        <g>
          <line
            x1={dx - 4}
            y1={dy + 2}
            x2={dx + 4}
            y2={dy - 2}
            stroke={r.line}
            strokeOpacity=".5"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <rect x={mx - 3} y={my - 7} width="6" height="7" rx="1.2" fill="#e5615a" />
          <ellipse cx={mx} cy={my - 7} rx="3" ry="1.1" fill="#8a4a3a" />
        </g>
      )
    }
  }),
  dresser: (c) => {
    const lt = ramp(c).light
    return {
      parts: [
        box(0.05, 0.12, 1.9, 0.74, 30, c),
        box(0.12, 0.86, 0.84, 0.03, 11, lt, 3),
        box(1.04, 0.86, 0.84, 0.03, 11, lt, 3),
        box(0.12, 0.86, 0.84, 0.03, 11, lt, 16),
        box(1.04, 0.86, 0.84, 0.03, 11, lt, 16)
      ],
      decor: (L, r) => {
        const knobs = [L(0.54, 0.89, 8.5), L(1.46, 0.89, 8.5), L(0.54, 0.89, 21.5), L(1.46, 0.89, 21.5)]
        const [vx, vy] = L(1.5, 0.5, 30)
        return (
          <g>
            {knobs.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="1.3" fill={r.line} />
            ))}
            <path d={`M${vx - 4},${vy} Q${vx - 5},${vy - 7} ${vx},${vy - 9} Q${vx + 5},${vy - 7} ${vx + 4},${vy}Z`} fill="#a998d8" />
            <line x1={vx} y1={vy - 9} x2={vx - 2} y2={vy - 18} stroke="#6fa77a" strokeWidth="1" />
            <line x1={vx} y1={vy - 9} x2={vx + 3} y2={vy - 16} stroke="#6fa77a" strokeWidth="1" />
            <circle cx={vx - 2} cy={vy - 19} r="2.2" fill="#f3c26b" />
            <circle cx={vx + 3} cy={vy - 17} r="2" fill="#f0a6b4" />
          </g>
        )
      }
    }
  },
  bed: (c) => ({
    parts: [
      box(0, 0, 2, 0.2, 32, WOOD),
      box(0, 0.2, 2, 2.8, 11, WOOD),
      box(0.08, 0.22, 1.84, 2.7, 6, CREAM, 11),
      box(0.05, 1.0, 1.9, 1.95, 6.6, c, 11.2),
      box(0.3, 0.3, 1.4, 0.5, 5, '#fff0dc', 17)
    ]
  }),
  fireplace: (c) => ({
    parts: [
      box(0.05, 0.1, 1.9, 0.62, 44, c),
      box(0.35, 0.72, 1.3, 0.22, 2, ramp(c).shade),
      box(0.55, 0.72, 0.9, 0.02, 26, '#4a2f3e', 3),
      box(0, 0.05, 2, 0.75, 4, WOOD, 44)
    ],
    glows: [[1, 0.9, 14, 90]],
    decor: (L) => {
      const [x, y] = L(1, 0.74, 4)
      return (
        <g>
          <rect x={x - 9} y={y - 3} width="18" height="3.4" rx="1.6" fill="#7a4a32" />
          <path
            className="rf-flicker"
            d={`M${x - 8},${y - 2} Q${x - 9},${y - 12} ${x - 3},${y - 17} Q${x - 2},${y - 9} ${x},${y - 8} Q${x + 1},${y - 16} ${x + 5},${y - 19} Q${x + 10},${y - 10} ${x + 8},${y - 2}Z`}
            fill="#f2a24a"
          />
          <path
            className="rf-flicker"
            style={{ animationDelay: '.3s' }}
            d={`M${x - 4},${y - 2} Q${x - 4},${y - 8} ${x},${y - 11} Q${x + 4},${y - 7} ${x + 4},${y - 2}Z`}
            fill="#ffd27a"
          />
        </g>
      )
    }
  }),

  /* wall items: x along the wall, y out of it */
  picture: () => ({
    parts: [box(0.14, 0, 0.72, 0.06, 30, WOOD, 46), box(0.2, 0.06, 0.6, 0.01, 24, CREAM, 49)],
    decor: (L, r) => {
      const o = 0.071
      return (
        <g>
          <path d={pathOf([L(0.2, o, 49), L(0.2, o, 58), L(0.38, o, 65), L(0.55, o, 59), L(0.8, o, 66), L(0.8, o, 49)])} fill={r.base} />
          <path d={pathOf([L(0.2, o, 49), L(0.2, o, 54), L(0.5, o, 57), L(0.8, o, 53), L(0.8, o, 49)])} fill={r.shade} />
          <path d={pathOf(wallCircle(L, 0.64, 68, 2.6, o))} fill="#fff3d6" />
        </g>
      )
    }
  }),
  clock: () => ({
    parts: [],
    decor: (L, r) => {
      const c = L(0.5, 0.06, 66)
      return (
        <g>
          <path d={pathOf(wallCircle(L, 0.5, 66, 8.5, 0.02))} fill={r.line} opacity=".55" />
          <path d={pathOf(wallCircle(L, 0.5, 66, 7.4, 0.06))} fill={r.base} />
          <path d={pathOf(wallCircle(L, 0.5, 66, 5.6, 0.065))} fill={r.light} />
          <line
            x1={c[0]}
            y1={c[1]}
            x2={L(0.5, 0.06, 71)[0]}
            y2={L(0.5, 0.06, 71)[1]}
            stroke={r.line}
            strokeWidth="1"
            strokeLinecap="round"
          />
          <line
            x1={c[0]}
            y1={c[1]}
            x2={L(0.62, 0.06, 66)[0]}
            y2={L(0.62, 0.06, 66)[1]}
            stroke={r.line}
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
      )
    }
  }),
  wallshelf: (c) => ({
    parts: [
      box(0.1, 0, 1.8, 0.32, 3, c, 58),
      box(0.3, 0.06, 0.22, 0.2, 7, TERRA, 61),
      box(1.0, 0.06, 0.08, 0.24, 11, '#e5615a', 61),
      box(1.09, 0.06, 0.08, 0.24, 10, '#4a5a8c', 61),
      box(1.18, 0.06, 0.09, 0.24, 12, '#e0a43c', 61),
      box(1.5, 0.08, 0.16, 0.16, 6, '#cfe6ee', 61)
    ],
    decor: (L) => {
      const [x, y] = L(0.41, 0.16, 68)
      return leaves(x, y, ramp('#6fa77a'))
    }
  }),
  lights: (c) => {
    const at = (a: number): number => 88 - 7 * Math.sin(Math.PI * ((a % 1.5) / 1.5))
    const bulbs = Array.from({ length: 13 }, (_, i) => 0.1 + i * 0.233)
    return {
      parts: [],
      glows: bulbs.filter((_, i) => i % 3 === 1).map((a) => [a, 0.05, at(a), 26] as [number, number, number, number]),
      decor: (L) => (
        <g>
          <path
            d={pathOf(
              Array.from({ length: 31 }, (_, i) => L(i * 0.1, 0.04, at(i * 0.1))),
              false
            )}
            fill="none"
            stroke="#6a5a5a"
            strokeWidth=".7"
          />
          {bulbs.map((a, i) => {
            const [x, y] = L(a, 0.05, at(a))
            return (
              <circle
                key={i}
                className="rf-twinkle"
                cx={x}
                cy={y + 1.6}
                r="1.7"
                fill={i % 2 ? c : '#fff0c0'}
                style={{ animationDelay: `${(i % 5) * 0.6}s` }}
              />
            )
          })}
        </g>
      )
    }
  },

  /* unlocked by attributes */
  bench: (c) => ({
    parts: [
      box(0.25, 0.36, 0.1, 0.28, 12, DARK),
      box(1.65, 0.36, 0.1, 0.28, 12, DARK),
      box(0.05, 0.42, 0.08, 0.08, 30, '#6a6070'),
      box(1.87, 0.42, 0.08, 0.08, 30, '#6a6070'),
      box(0.15, 0.32, 1.7, 0.36, 4, c, 12)
    ],
    decor: (L) => {
      const a = L(-0.02, 0.46, 30)
      const b = L(2.02, 0.46, 30)
      return (
        <g>
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#9a95a3" strokeWidth="1.8" strokeLinecap="round" />
          {[L(0.12, 0.46, 30), L(1.88, 0.46, 30)].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx="3" ry="7" fill="#4a4458" />
              <ellipse cx={x + 0.8} cy={y} rx="1.8" ry="5" fill="#5e5870" />
            </g>
          ))}
        </g>
      )
    }
  }),
  easel: (c) => ({
    parts: [box(0.47, 0.18, 0.06, 0.06, 52, c), box(0.18, 0.52, 0.64, 0.05, 30, CREAM, 20), box(0.2, 0.57, 0.6, 0.08, 2, c, 19)],
    decor: (L) => {
      const legsFront = [
        [L(0.26, 0.74, 0), L(0.44, 0.52, 62)],
        [L(0.74, 0.74, 0), L(0.56, 0.52, 62)]
      ]
      const o = 0.575
      return (
        <g>
          <path d={pathOf([L(0.22, o, 22), L(0.22, o, 34), L(0.45, o, 41), L(0.78, o, 36), L(0.78, o, 22)])} fill="#8cc4e8" />
          <path d={pathOf(wallCircle(L, 0.62, 43, 3.4, o))} fill="#e0a43c" />
          <path d={pathOf([L(0.22, o, 22), L(0.22, o, 28), L(0.5, o, 31), L(0.78, o, 26), L(0.78, o, 22)])} fill="#8fb59a" />
          {legsFront.map(([a, b], i) => (
            <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={ramp(c).base} strokeWidth="2.4" strokeLinecap="round" />
          ))}
        </g>
      )
    }
  }),
  basketshelf: (c) => ({
    parts: [
      box(0.05, 0.05, 1.9, 0.08, 40, c),
      box(0.05, 0.13, 0.09, 0.4, 40, c),
      box(0.96, 0.13, 0.08, 0.4, 40, c),
      box(1.86, 0.13, 0.09, 0.4, 40, c),
      box(0.14, 0.13, 0.82, 0.4, 2.5, c),
      box(1.04, 0.13, 0.82, 0.4, 2.5, c),
      box(0.14, 0.13, 0.82, 0.4, 2.5, c, 19),
      box(1.04, 0.13, 0.82, 0.4, 2.5, c, 19),
      box(0.18, 0.18, 0.74, 0.38, 13, '#d9b27a', 2.5),
      box(1.08, 0.18, 0.74, 0.38, 13, '#c9a0c8', 2.5),
      box(0.18, 0.18, 0.74, 0.38, 13, '#9cc0a0', 21.5),
      box(1.08, 0.18, 0.74, 0.38, 13, '#d9b27a', 21.5),
      box(0.05, 0.13, 1.9, 0.4, 3, c, 38)
    ]
  }),
  hangchair: () => ({
    parts: [box(0.3, 0.1, 0.4, 0.4, 2.5, '#6a6070')],
    decor: (L, r) => {
      const base = L(0.5, 0.3, 2)
      const top = L(0.5, 0.3, 84)
      const hook = L(0.5, 0.55, 80)
      const [x, y] = L(0.5, 0.55, 36)
      return (
        <g>
          <path
            d={`M${base[0]},${base[1]} L${top[0]},${top[1]} Q${(top[0] + hook[0]) / 2},${top[1] - 8} ${hook[0]},${hook[1]}`}
            fill="none"
            stroke="#6a6070"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <line x1={hook[0]} y1={hook[1]} x2={x} y2={y - 20} stroke="#8a7a70" strokeWidth="1" />
          <path
            d={`M${x - 14},${y} Q${x - 14},${y - 22} ${x},${y - 22} Q${x + 14},${y - 22} ${x + 14},${y} Q${x + 13},${y + 14} ${x},${y + 15} Q${x - 13},${y + 14} ${x - 14},${y}Z`}
            fill={r.base}
            stroke={r.line}
            strokeWidth=".7"
          />
          <path
            d={`M${x - 9},${y + 1} Q${x - 9},${y - 14} ${x},${y - 15} Q${x + 9},${y - 14} ${x + 9},${y + 1} Q${x},${y + 6} ${x - 9},${y + 1}Z`}
            fill={r.shade}
          />
          <ellipse cx={x} cy={y + 2} rx="10" ry="5" fill="#e5807a" />
          <ellipse cx={x - 2} cy={y + 0.5} rx="5" ry="2" fill="#f3a8a0" />
        </g>
      )
    }
  }),
  telescope: () => ({
    parts: [],
    decor: (L, r) => {
      const hub = L(0.5, 0.5, 26)
      const feet = [L(0.2, 0.78), L(0.82, 0.72), L(0.52, 0.18)]
      const a = L(0.3, 0.7, 22)
      const b = L(0.74, 0.28, 46)
      return (
        <g>
          {feet.map(([x, y], i) => (
            <line key={i} x1={hub[0]} y1={hub[1]} x2={x} y2={y} stroke={DARK} strokeWidth="1.6" strokeLinecap="round" />
          ))}
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={r.base} strokeWidth="6.5" strokeLinecap="round" />
          <line x1={a[0]} y1={a[1] - 1.6} x2={b[0]} y2={b[1] - 1.6} stroke={r.light} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
          <circle cx={b[0]} cy={b[1]} r="3.6" fill="#e0c070" />
          <circle cx={a[0]} cy={a[1]} r="2" fill={r.line} />
        </g>
      )
    }
  }),
  gametable: (c) => ({
    parts: [
      ...legs(0.2, 0.2, 1.8, 1.8, 20, DARK, 0.12),
      box(0.1, 0.1, 1.8, 1.8, 3, WOOD, 20),
      box(0.25, 0.25, 1.5, 1.5, 0.6, c, 23),
      box(0.35, 0.3, 1.3, 0.05, 11, '#a998d8', 23.6),
      box(0.8, 0.9, 0.1, 0.1, 5, '#e5615a', 23.6),
      box(1.15, 1.1, 0.1, 0.1, 5, '#8cc4e8', 23.6),
      box(0.9, 1.3, 0.1, 0.1, 5, '#e0a43c', 23.6)
    ],
    decor: (L) => {
      const [x, y] = L(1.45, 1.4, 25)
      const hex = Array.from(
        { length: 6 },
        (_, i) => [x + 3.4 * Math.cos((i * Math.PI) / 3 + Math.PI / 6), y - 2 + 3.4 * Math.sin((i * Math.PI) / 3 + Math.PI / 6)] as Pt
      )
      return <polygon points={pts(hex)} fill={CREAM} stroke="#8a6a8a" strokeWidth=".6" />
    }
  })
}

export const hasStyle = (style: string): boolean => style in SPECS

/** screen point mapping for a placed item (floor or wall) */
export function placer(f: Furniture, p: PlacedFurniture): L {
  if (f.kind === 'wall') {
    return p.wall === 'l' ? (a, o, z = 0) => P(o, p.x + a, z) : (a, o, z = 0) => P(p.x + a, o, z)
  }
  return (x, y, z = 0) => {
    const [rx, ry] = rotPt(x, y, f.w, f.d, p.rot)
    return P(p.x + rx, p.y + ry, z)
  }
}

/** the world-space boxes of an item */
function worldParts(f: Furniture, p: PlacedFurniture, spec: Spec): Part[] {
  if (f.kind === 'wall')
    return spec.parts.map((b) => (p.wall === 'l' ? { ...b, x: b.y, y: p.x + b.x, w: b.d, d: b.w } : { ...b, x: p.x + b.x }))
  return spec.parts.map((b) => {
    const r = rotPart(b, f.w, f.d, p.rot)
    return { ...r, x: r.x + p.x, y: r.y + p.y }
  })
}

/** one piece of furniture */
export function FurnitureShape({ f, p }: { f: Furniture; p: PlacedFurniture }): React.JSX.Element | null {
  if (f.kind === 'rug') return <RugShape f={f} p={p} />
  const make = SPECS[f.style]
  if (!make) return null
  const spec = make(f.color)
  const L = placer(f, p)
  return (
    <g>
      {depthOrder(worldParts(f, p, spec)).map((b, i) => (
        <BoxShape key={i} b={b} />
      ))}
      {spec.decor?.(L, ramp(f.color))}
    </g>
  )
}

/** where an item gives light, in screen points with radius */
export function glowsOf(f: Furniture, p: PlacedFurniture): [number, number, number][] {
  const spec = SPECS[f.style]?.(f.color)
  if (!spec?.glows) return []
  const L = placer(f, p)
  return spec.glows.map(([x, y, z, r]) => [...L(x, y, z), r])
}

function RugShape({ f, p }: { f: Furniture; p: PlacedFurniture }): React.JSX.Element {
  const r = ramp(f.color)
  const turned = p.rot % 2 === 1
  const w = turned ? f.d : f.w
  const d = turned ? f.w : f.d
  const shape = (fill: string, inset = 0, extra: React.SVGProps<SVGRectElement> = {}): ReactNode =>
    f.style === 'roundrug' ? (
      <ellipse
        cx={p.x + w / 2}
        cy={p.y + d / 2}
        rx={w / 2 - 0.06 - inset}
        ry={d / 2 - 0.06 - inset}
        fill={fill}
        {...(extra as unknown as React.SVGProps<SVGEllipseElement>)}
      />
    ) : (
      <rect
        x={p.x + 0.06 + inset}
        y={p.y + 0.06 + inset}
        width={w - 0.12 - inset * 2}
        height={d - 0.12 - inset * 2}
        rx={0.32 - inset * 0.5}
        fill={fill}
        {...extra}
      />
    )
  const line = {
    fill: 'none',
    stroke: r.light,
    strokeWidth: 1.6,
    vectorEffect: 'non-scaling-stroke' as const
  }
  return (
    <g>
      <g transform="translate(0 1.3)">
        <g transform={FLOOR_MATRIX}>{shape(r.shade)}</g>
      </g>
      <g transform={FLOOR_MATRIX}>
        {shape(r.base)}
        {shape('none', 0.2, { ...line, strokeDasharray: '4 3' })}
        {f.style === 'roundrug' && shape(r.shade, Math.min(w, d) / 2 - 0.45)}
        {f.style === 'bigrug' && shape('none', 0.45, { ...line, stroke: r.shade, strokeWidth: 3 })}
        {f.style === 'bigrug' && shape(r.light, Math.min(w, d) / 2 - 0.4)}
      </g>
    </g>
  )
}
