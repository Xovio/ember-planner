import { ROOM_SIZE as N, footprint, furnitureById, rotPt, type Furniture } from './room'
import type { AttrId, Character, PlacedFurniture, Room } from './types'

/**
 * Idle animations: little things the character does in the room on its own, one every 20–40 s.
 * Three come with the start, free ones can be bought, furniture ones come with the furniture.
 * This file is pure logic (what is available, where the character goes, how it walks there);
 * drawing lives in Avatar.tsx and the room scene.
 */

/** how the character takes part: standing, on a chair it brings, on the floor, or on the furniture itself */
export type Sit = 'stand' | 'chair' | 'floor' | 'seat'

export interface IdleDef {
  id: string
  name: string
  price: number
  starter?: boolean
  unlock?: { attr: AttrId; level: number }
  /** furniture styles that bring this animation; any one placed in the room is enough */
  needs?: string[]
  /** where to stand: on the seat, at the front side, or next to it */
  spot?: 'seat' | 'front' | 'beside'
  sit: Sit
}

export const IDLES: IdleDef[] = [
  { id: 'look', name: 'Umschauen', price: 0, starter: true, sit: 'stand' },
  { id: 'stretch', name: 'Strecken und gähnen', price: 0, starter: true, sit: 'stand' },
  { id: 'hum', name: 'Vor sich hin summen', price: 0, starter: true, sit: 'stand' },

  { id: 'wave', name: 'Winken', price: 30, sit: 'stand' },
  { id: 'hop', name: 'Freudenhüpfer', price: 50, sit: 'stand' },
  { id: 'dance', name: 'Tanzen', price: 60, sit: 'stand' },
  { id: 'yoga', name: 'Yoga', price: 80, unlock: { attr: 'fitness', level: 2 }, sit: 'stand' },
  { id: 'meditate', name: 'Meditieren', price: 80, unlock: { attr: 'stamina', level: 2 }, sit: 'floor' },

  { id: 'laptop', name: 'Am Laptop arbeiten', price: 0, needs: ['desk'], spot: 'front', sit: 'chair' },
  { id: 'read', name: 'Lesen', price: 0, needs: ['sofa', 'armchair'], spot: 'seat', sit: 'seat' },
  { id: 'relax', name: 'Im Sitzsack lümmeln', price: 0, needs: ['beanbag'], spot: 'seat', sit: 'seat' },
  { id: 'nap', name: 'Nickerchen', price: 0, needs: ['bed'], spot: 'seat', sit: 'seat' },
  { id: 'water', name: 'Pflanze gießen', price: 0, needs: ['plant', 'monstera'], spot: 'beside', sit: 'stand' },
  { id: 'browse', name: 'Im Regal stöbern', price: 0, needs: ['bookshelf'], spot: 'front', sit: 'stand' },
  { id: 'warm', name: 'Am Kamin wärmen', price: 0, needs: ['fireplace'], spot: 'front', sit: 'stand' },
  { id: 'paint', name: 'Malen', price: 0, needs: ['easel'], spot: 'beside', sit: 'stand' },
  { id: 'lift', name: 'Hanteln stemmen', price: 0, needs: ['bench'], spot: 'beside', sit: 'stand' },
  { id: 'stargaze', name: 'Sterne gucken', price: 0, needs: ['telescope'], spot: 'beside', sit: 'stand' },
  { id: 'dice', name: 'Würfeln', price: 0, needs: ['gametable', 'dndtable'], spot: 'beside', sit: 'chair' },
  { id: 'gm', name: 'Spielleiten', price: 0, needs: ['dndtable'], spot: 'beside', sit: 'chair' },
  { id: 'guitar', name: 'Gitarre spielen', price: 0, needs: ['guitar'], spot: 'beside', sit: 'chair' },
  { id: 'cook', name: 'Kochen', price: 0, needs: ['kitchen'], spot: 'front', sit: 'stand' },
  { id: 'run', name: 'Laufen', price: 0, needs: ['treadmill'], spot: 'seat', sit: 'stand' },
  { id: 'game', name: 'Zocken', price: 0, needs: ['tv'], spot: 'front', sit: 'floor' }
]

export const idleById = (id: string | undefined): IdleDef | undefined => IDLES.find((i) => i.id === id)

/** ids of bought idles live in Character.owned with this prefix */
export const idleKey = (id: string): string => `i-${id}`

/** where the character sits on a piece of furniture: local x, y in its footprint and the seat height */
export const SEATS: Record<string, [number, number, number][]> = {
  sofa: [
    [0.62, 0.62, 10],
    [1.38, 0.62, 10]
  ],
  armchair: [[0.5, 0.62, 10]],
  beanbag: [[0.5, 0.68, 7]],
  bed: [[1, 1.35, 16]],
  /** standing on the belt */
  treadmill: [[0.5, 1.05, 5.5]]
}

/* ── what the character can do ── */

type Prefs = Pick<Character, 'owned' | 'room'> & { idle?: Character['idle'] }

export const ownsIdle = (ch: Pick<Character, 'owned'>, d: IdleDef): boolean => !!d.starter || !!d.needs || ch.owned.includes(idleKey(d.id))

/** placed furniture that brings this idle */
export function idleFurniture(room: Room, d: IdleDef): { p: PlacedFurniture; f: Furniture }[] {
  if (!d.needs) return []
  return room.items.flatMap((p) => {
    const f = furnitureById(p.id)
    return f && d.needs!.includes(f.style) ? [{ p, f }] : []
  })
}

/** owned, switched on and (for furniture ones) with the furniture in the room */
export function availableIdles(ch: Prefs): IdleDef[] {
  const off = new Set(ch.idle?.off ?? [])
  return IDLES.filter((d) => ownsIdle(ch, d) && !off.has(d.id) && (!d.needs || idleFurniture(ch.room, d).length > 0))
}

/** the next idle: the pinned one if set, else a random other one (never the same twice in a row when there is a choice) */
export function nextIdle(list: IdleDef[], current: string | null, pinned: string | undefined, rand: () => number): IdleDef | null {
  if (pinned) {
    const p = list.find((d) => d.id === pinned)
    if (p) return p
  }
  if (list.length === 0) return null
  const pool = list.length > 1 ? list.filter((d) => d.id !== current) : list
  return pool[Math.floor(rand() * pool.length) % pool.length]
}

/** how long one idle lasts: 20–40 s */
export const idleDuration = (rand: () => number): number => 20_000 + Math.round(rand() * 20_000)

/* ── walking ── */

export type Tile = [number, number]
const key = (t: Tile): string => `${t[0]},${t[1]}`

/** tiles the character can walk on: everything not covered by floor furniture (rugs are fine) */
export function walkable(room: Room): Set<string> {
  const taken = new Set<string>()
  for (const p of room.items) {
    const f = furnitureById(p.id)
    if (!f || f.kind !== 'floor') continue
    const r = footprint(p, f)
    for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.d; y++) taken.add(`${x},${y}`)
  }
  const out = new Set<string>()
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!taken.has(`${x},${y}`)) out.add(`${x},${y}`)
  return out
}

/** shortest walk over free tiles (4 directions), start and end included; null when there is no way */
export function findPath(room: Room, from: Tile, to: Tile, free = walkable(room)): Tile[] | null {
  if (!free.has(key(to))) return null
  const start = free.has(key(from)) ? from : to
  const prev = new Map<string, string | null>([[key(start), null]])
  const queue: Tile[] = [start]
  while (queue.length) {
    const t = queue.shift()!
    if (key(t) === key(to)) {
      const path: Tile[] = []
      let k: string | null = key(t)
      while (k) {
        const [x, y] = k.split(',').map(Number)
        path.unshift([x, y])
        k = prev.get(k) ?? null
      }
      return path
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ]) {
      const n: Tile = [t[0] + dx, t[1] + dy]
      if (free.has(key(n)) && !prev.has(key(n))) {
        prev.set(key(n), key(t))
        queue.push(n)
      }
    }
  }
  return null
}

export interface IdleTarget {
  /** the tile the character walks to */
  stand: Tile
  /** the furniture it uses */
  item?: string
  /** sitting on the furniture: local seat point */
  seat?: [number, number, number]
  /** the furniture is on the screen's left: draw the character mirrored */
  mirror: boolean
}

/** tiles next to a footprint, front side first when wanted */
function around(p: PlacedFurniture, f: Furniture, frontOnly: boolean): Tile[] {
  const r = footprint(p, f)
  if (frontOnly) {
    // points just in front of the local front edge (+y), turned with the piece
    return Array.from({ length: f.w }, (_, i) => {
      const [x, y] = rotPt(i + 0.5, f.d + 0.5, f.w, f.d, p.rot)
      return [Math.floor(p.x + x), Math.floor(p.y + y)] as Tile
    })
  }
  const out: Tile[] = []
  for (let x = r.x; x < r.x + r.w; x++) out.push([x, r.y + r.d], [x, r.y - 1])
  for (let y = r.y; y < r.y + r.d; y++) out.push([r.x + r.w, y], [r.x - 1, y])
  return out
}

/** screen x of a floor point (for left/right) */
const screenX = (x: number, y: number): number => x - y

/** where to go for an idle, from tile `from`; null when it cannot be reached */
export function idleTarget(room: Room, d: IdleDef, from: Tile, wheelchair = false): IdleTarget | null {
  const free = walkable(room)
  if (!d.needs) return free.has(key(from)) ? { stand: from, mirror: false } : null
  let best: { t: IdleTarget; len: number } | null = null
  for (const { p, f } of idleFurniture(room, d)) {
    const r = footprint(p, f)
    const seatHere = d.spot === 'seat' && !wheelchair
    const seats = seatHere ? (SEATS[f.style] ?? []) : [null]
    const tiles = around(p, f, d.spot === 'front' || d.spot === 'seat')
    for (const t of tiles) {
      const path = findPath(room, from, t, free)
      if (!path) continue
      for (const seat of seats) {
        const cx = r.x + r.w / 2
        const cy = r.y + r.d / 2
        const mirror = screenX(cx, cy) < screenX(t[0] + 0.5, t[1] + 0.5)
        const target: IdleTarget = { stand: t, item: p.id, mirror, ...(seat ? { seat } : {}) }
        if (!best || path.length < best.len) best = { t: target, len: path.length }
      }
    }
  }
  return best?.t ?? null
}
