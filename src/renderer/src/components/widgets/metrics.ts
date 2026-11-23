import { addDays } from 'date-fns'
import type { Occurrence } from '@shared/recurrence'

/** Minutes covered by timed events on `day` (overlaps counted once). */
export function bookedMinutes(day: Date, occs: Occurrence[]): number {
  const ds = day.getTime()
  const de = addDays(day, 1).getTime()
  const spans = occs
    .filter((o) => !o.event.allDay && o.start.getTime() < de && o.end.getTime() > ds)
    .map((o) => [Math.max(ds, o.start.getTime()), Math.min(de, o.end.getTime())] as [number, number])
    .sort((a, b) => a[0] - b[0])
  let total = 0
  let curS = -1
  let curE = -1
  for (const [s, e] of spans) {
    if (s > curE) {
      if (curE > curS) total += curE - curS
      curS = s
      curE = e
    } else {
      curE = Math.max(curE, e)
    }
  }
  if (curE > curS) total += curE - curS
  return Math.round(total / 60000)
}

export function countOnDay(day: Date, occs: Occurrence[]): number {
  const ds = day.getTime()
  const de = addDays(day, 1).getTime()
  return occs.filter((o) => o.start.getTime() < de && o.end.getTime() > ds).length
}

/** "nice" axis maximum: 2, 4, 6, 8, 10, 12 … */
export function niceMax(v: number, min = 4): number {
  const m = Math.max(min, v)
  const step = m <= 10 ? 2 : m <= 20 ? 4 : 6
  return Math.ceil(m / step) * step
}

export const fmtHours = (min: number): string => {
  const h = min / 60
  return `${h.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`
}
