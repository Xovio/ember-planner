import { ROOM_SIZE as N, type Furniture } from '@shared/room'
import { ramp } from '@shared/wardrobe'
import { H, OX, OY, T } from './iso'

/**
 * Wallpaper and flooring patterns. Walls are drawn in their own plane (x along the wall in tiles,
 * y = minus height in screen units), floors in the floor plane (tiles), so patterns follow the room.
 */

const thin = { vectorEffect: 'non-scaling-stroke' as const }

export function WallSurface({ f, side }: { f: Furniture; side: 'l' | 'r' }): React.JSX.Element {
  const r = ramp(f.color)
  const fill = side === 'l' ? r.shade : r.base
  const ink = side === 'l' ? ramp(r.shade).shade : r.shade
  const m = side === 'l' ? `matrix(${-T} ${T / 2} 0 1 ${OX} ${OY})` : `matrix(${T} ${T / 2} 0 1 ${OX} ${OY})`
  const out: React.ReactNode[] = []
  if (f.style === 'stripes') {
    for (let i = 0; i < N * 4; i += 2) out.push(<rect key={i} x={i / 4} y={-H} width={1 / 8} height={H} fill={ink} opacity=".38" />)
  } else if (f.style === 'dots') {
    for (let row = 0; row * 13 + 44 < H - 4; row++)
      for (let a = (row % 2) * 0.25 + 0.125; a < N; a += 0.5) out.push(<ellipse key={`${row}-${a}`} cx={a} cy={-(44 + row * 13)} rx=".07" ry="1.6" fill={ink} opacity=".55" />)
  } else if (f.style === 'flowers') {
    for (let row = 0; row * 17 + 46 < H - 6; row++)
      for (let a = (row % 2) * 0.375 + 0.2; a < N; a += 0.75) {
        const z = -(48 + row * 17)
        out.push(
          <g key={`${row}-${a}`} opacity=".8">
            <ellipse cx={a - 0.09} cy={z} rx=".07" ry="1.7" fill="#e7a0a8" />
            <ellipse cx={a + 0.09} cy={z} rx=".07" ry="1.7" fill="#e7a0a8" />
            <ellipse cx={a} cy={z - 2} rx=".07" ry="1.7" fill="#e7a0a8" />
            <ellipse cx={a} cy={z + 2} rx=".07" ry="1.7" fill="#e7a0a8" />
            <ellipse cx={a} cy={z} rx=".05" ry="1.1" fill="#e0a43c" />
            <ellipse cx={a + 0.16} cy={z + 3.5} rx=".08" ry="1" fill="#8fb59a" />
          </g>
        )
      }
  } else if (f.style === 'panel') {
    for (let a = 0.5; a < N; a += 0.5) out.push(<line key={a} x1={a} y1={-H} x2={a} y2={0} stroke={r.line} strokeOpacity=".28" strokeWidth=".8" {...thin} />)
    out.push(<rect key="rail" x={0} y={-50} width={N} height={3} fill={r.light} />)
  }
  return (
    <g transform={m}>
      <rect x={0} y={-H} width={N} height={H} fill={fill} />
      {out}
    </g>
  )
}

/** the floor pattern, to be drawn inside the floor matrix */
export function FloorSurface({ f }: { f: Furniture }): React.JSX.Element {
  const r = ramp(f.color)
  const out: React.ReactNode[] = []
  const line = (k: string, x1: number, y1: number, x2: number, y2: number, o = 0.22): void => {
    out.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={r.line} strokeOpacity={o} strokeWidth=".7" {...thin} />)
  }
  if (f.style === 'planks') {
    for (let i = 0; i < N * 2; i++) {
      line(`h${i}`, 0, i / 2, N, i / 2)
      ;[0.8, 2.3, 3.9, 5.1].forEach((j, k) => {
        const x = (j + (i % 3) * 0.55) % N
        line(`v${i}-${k}`, x, i / 2, x, i / 2 + 0.5, 0.16)
      })
    }
  } else if (f.style === 'herringbone') {
    for (let k = 0; k <= N * 4; k++) {
      const p = Array.from({ length: N * 4 + 1 }, (_, j) => `${j / 4},${k / 4 + (j % 2) * 0.25}`).join(' ')
      out.push(<polyline key={k} points={p} fill="none" stroke={r.line} strokeOpacity=".22" strokeWidth=".7" {...thin} />)
    }
  } else if (f.style === 'tiles' || f.style === 'checker') {
    for (let x = 0; x < N * 2; x++)
      for (let y = 0; y < N * 2; y++)
        if ((x + y) % 2)
          out.push(<rect key={`${x}-${y}`} x={x / 2} y={y / 2} width=".5" height=".5" fill={f.style === 'checker' ? r.line : r.shade} opacity={f.style === 'checker' ? 0.42 : 0.18} />)
    if (f.style === 'tiles')
      for (let i = 1; i < N * 2; i++) {
        out.push(<line key={`gx${i}`} x1={i / 2} y1={0} x2={i / 2} y2={N} stroke={r.light} strokeWidth="1.2" {...thin} />)
        out.push(<line key={`gy${i}`} x1={0} y1={i / 2} x2={N} y2={i / 2} stroke={r.light} strokeWidth="1.2" {...thin} />)
      }
  } else if (f.style === 'carpet') {
    for (let i = 0; i < 160; i++) {
      const x = ((i * 37) % 97) / 97
      const y = ((i * 61) % 89) / 89
      out.push(<circle key={i} cx={x * N} cy={y * N} r=".025" fill={r.shade} opacity=".5" />)
    }
  }
  return (
    <g>
      <rect x="0" y="0" width={N} height={N} fill={f.color} />
      {out}
    </g>
  )
}
