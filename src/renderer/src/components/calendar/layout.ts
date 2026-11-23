import { addDays } from 'date-fns'
import type { Occurrence } from '@shared/recurrence'

export interface Segment {
  occ: Occurrence
  startMin: number
  endMin: number
  col: number
  cols: number
  /** segment continues from the previous day / into the next day */
  clippedStart: boolean
  clippedEnd: boolean
}

const MIN_VISIBLE = 20

/** Splits timed occurrences into per-day segments and assigns side-by-side columns. */
export function layoutDay(day: Date, occs: Occurrence[]): Segment[] {
  const dayStart = day.getTime()
  const dayEnd = addDays(day, 1).getTime()

  const segs: Segment[] = []
  for (const occ of occs) {
    const s = occ.start.getTime()
    const e = Math.max(occ.end.getTime(), s + 1)
    if (s >= dayEnd || e <= dayStart) continue
    const startMin = Math.max(0, (s - dayStart) / 60000)
    const endMin = Math.min(1440, (e - dayStart) / 60000)
    segs.push({
      occ,
      startMin,
      endMin: Math.max(endMin, startMin + MIN_VISIBLE),
      col: 0,
      cols: 1,
      clippedStart: s < dayStart,
      clippedEnd: e > dayEnd
    })
  }

  segs.sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  let cluster: Segment[] = []
  let colEnds: number[] = []
  let clusterEnd = -1

  const flush = (): void => {
    for (const s of cluster) s.cols = colEnds.length
    cluster = []
    colEnds = []
  }

  for (const seg of segs) {
    if (seg.startMin >= clusterEnd && cluster.length) flush()
    let col = colEnds.findIndex((end) => end <= seg.startMin)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(seg.endMin)
    } else {
      colEnds[col] = seg.endMin
    }
    seg.col = col
    cluster.push(seg)
    clusterEnd = Math.max(clusterEnd, seg.endMin)
  }
  flush()
  return segs
}
