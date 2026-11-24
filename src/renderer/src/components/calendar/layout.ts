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

/* ───────────── multi-day bars ───────────── */

/** one day's piece of a multi-day bar */
export interface SpanPiece {
  occ: Occurrence
  /** row of the bar, the same on every day it covers */
  lane: number
  /** the bar continues from the day before / into the day after (also beyond the row) */
  contLeft: boolean
  contRight: boolean
  /** first piece in the row: shows the title */
  head: boolean
  /** days the bar covers in this row (set on the head piece, 1 on others) */
  len: number
}

const dayKey = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** occurrence covers more than one calendar day (an end at midnight belongs to the day before) */
export function isMultiDay(o: Occurrence): boolean {
  return dayKey(o.start) !== dayKey(new Date(Math.max(o.start.getTime(), o.end.getTime() - 1)))
}

/**
 * Lays out multi-day occurrences as bars across `days` (one row: a week).
 * Returns per day the pieces by lane; `null` keeps a lane free so bars line up across days.
 */
export function layoutSpans(days: Date[], occs: Occurrence[]): (SpanPiece | null)[][] {
  const covers = (o: Occurrence, d: Date): boolean =>
    o.start.getTime() < addDays(d, 1).getTime() && Math.max(o.end.getTime(), o.start.getTime() + 1) > d.getTime()
  const items = occs
    .map((o) => {
      const idx = days.map((d, i) => (covers(o, d) ? i : -1)).filter((i) => i >= 0)
      return { o, first: idx[0], last: idx[idx.length - 1] }
    })
    .filter((x) => x.first !== undefined)
    // earlier first, then longer, so long bars take the top lanes
    .sort((a, b) => a.first - b.first || b.last - b.first - (a.last - a.first) || a.o.start.getTime() - b.o.start.getTime())

  const used: boolean[][] = days.map(() => [])
  const out: (SpanPiece | null)[][] = days.map(() => [])
  const rowStart = days[0].getTime()
  const rowEnd = addDays(days[days.length - 1], 1).getTime()
  for (const { o, first, last } of items) {
    const before = o.start.getTime() < rowStart
    const after = o.end.getTime() > rowEnd
    let lane = 0
    while (days.slice(first, last + 1).some((_, k) => used[first + k][lane])) lane++
    for (let i = first; i <= last; i++) {
      used[i][lane] = true
      out[i][lane] = { occ: o, lane, contLeft: i > first || before, contRight: i < last || after, head: i === first, len: i === first ? last - first + 1 : 1 }
    }
  }
  return out.map((lanes) => Array.from({ length: lanes.length }, (_, i) => lanes[i] ?? null))
}
