import type { AttrId, Character, PlacedFurniture, Room } from './types'

/**
 * The character's room: an isometric floor of ROOM_SIZE × ROOM_SIZE tiles with two walls.
 * x runs along the right wall, y along the left wall; (0, 0) is the back corner.
 * Floor furniture covers whole tiles (w × d, swapped when turned), rugs lie underneath,
 * wall items hang on one of the two walls. Everything is drawn from code (components/character/room).
 */

export const ROOM_SIZE = 6

/** the window is built in: right wall, spots 2–3 */
export const WINDOW = { wall: 'r' as const, x: 2, w: 2 }

/** floor, rug and wall items are placed; wallpaper and flooring cover the whole room */
export type FurnKind = 'floor' | 'rug' | 'wall' | 'wallpaper' | 'flooring'
export type FurnGroup = 'small' | 'medium' | 'large' | 'rug' | 'wall' | 'special' | 'surface'

export const FURN_GROUPS: { id: FurnGroup; name: string }[] = [
  { id: 'small', name: 'Kleinkram' },
  { id: 'medium', name: 'Möbel' },
  { id: 'large', name: 'Groß' },
  { id: 'rug', name: 'Teppiche' },
  { id: 'wall', name: 'Wand' },
  { id: 'special', name: 'Besonderes' },
  { id: 'surface', name: 'Tapeten und Böden' }
]

export interface Furniture {
  id: string
  style: string
  name: string
  color: string
  price: number
  kind: FurnKind
  group: FurnGroup
  /** tiles along x and y when not turned (wall items: spots along the wall) */
  w: number
  d: number
  /** part of the room from the start, free */
  starter?: boolean
  /** only buyable from this attribute level on */
  unlock?: { attr: AttrId; level: number }
}

const furn = (
  style: string,
  name: string,
  group: FurnGroup,
  kind: FurnKind,
  size: [number, number],
  price: number,
  colors: Record<string, [string, string]>,
  extra: { starter?: string; unlock?: Furniture['unlock'] } = {}
): Furniture[] =>
  Object.entries(colors).map(([key, [label, color]]) => ({
    id: `f-${style}-${key}`,
    style,
    name: `${name} ${label}`,
    color,
    price: extra.starter === key ? 0 : price,
    kind,
    group,
    w: size[0],
    d: size[1],
    ...(extra.starter === key ? { starter: true } : {}),
    ...(extra.unlock ? { unlock: extra.unlock } : {})
  }))

export const FURNITURE: Furniture[] = [
  /* small 20–50 */
  ...furn('beanbag', 'Sitzsack', 'small', 'floor', [1, 1], 45, {
    coral: ['Koralle', '#e5615a'],
    sage: ['Salbei', '#8fb59a'],
    lavender: ['Lavendel', '#a998d8'],
    mustard: ['Senf', '#e0a43c']
  }, { starter: 'coral' }),
  ...furn('plant', 'Topfpflanze', 'small', 'floor', [1, 1], 25, {
    green: ['Grün', '#6fa77a'],
    olive: ['Oliv', '#9aa860'],
    teal: ['Petrol', '#4f9a8e']
  }, { starter: 'green' }),
  ...furn('monstera', 'Monstera', 'small', 'floor', [1, 1], 50, { green: ['Grün', '#5f9a6a'] }),
  ...furn('lamp', 'Stehlampe', 'small', 'floor', [1, 1], 50, {
    honey: ['Honig', '#f3c26b'],
    rose: ['Rosé', '#f0a6b4'],
    sage: ['Salbei', '#a9c9a4']
  }, { starter: 'honey' }),
  ...furn('stool', 'Hocker', 'small', 'floor', [1, 1], 30, { wood: ['Holz', '#c48a56'], mint: ['Mint', '#8ccfb4'] }),
  ...furn('cushion', 'Bodenkissen', 'small', 'floor', [1, 1], 20, {
    rose: ['Rosé', '#f0a6b4'],
    sky: ['Himmel', '#8cc4e8'],
    oat: ['Hafer', '#e3d2b4']
  }),
  ...furn('books', 'Bücherstapel', 'small', 'floor', [1, 1], 25, { mixed: ['Bunt', '#e5615a'] }),
  ...furn('candles', 'Kerzen', 'small', 'floor', [1, 1], 35, { cream: ['Creme', '#f3ead8'], rose: ['Rosé', '#f0a6b4'] }),
  ...furn('nightstand', 'Nachttisch', 'small', 'floor', [1, 1], 45, { wood: ['Holz', '#b8794a'], cream: ['Creme', '#eadcc4'] }),

  /* medium 60–120 */
  ...furn('armchair', 'Sessel', 'medium', 'floor', [1, 1], 110, {
    mustard: ['Senf', '#e0a43c'],
    sage: ['Salbei', '#8fb59a'],
    plum: ['Pflaume', '#9a6a9c']
  }),
  ...furn('bookshelf', 'Bücherregal', 'medium', 'floor', [2, 1], 90, { wood: ['Holz', '#a86e45'], white: ['Creme', '#eadcc4'] }),
  ...furn('desk', 'Schreibtisch', 'medium', 'floor', [2, 1], 100, { wood: ['Holz', '#c48a56'], dark: ['Nussbaum', '#8a5a3a'] }),
  ...furn('dresser', 'Kommode', 'medium', 'floor', [2, 1], 80, { wood: ['Holz', '#b8794a'], sage: ['Salbei', '#9cbfa4'], rose: ['Rosé', '#e7b0b8'] }),

  /* large 150–300 */
  ...furn('sofa', 'Sofa', 'large', 'floor', [2, 1], 180, { sage: ['Salbei', '#8fb59a'], terracotta: ['Terrakotta', '#d9825f'], navy: ['Nachtblau', '#5a6a9c'] }),
  ...furn('bed', 'Bett', 'large', 'floor', [2, 3], 220, { sage: ['Salbei', '#8fb59a'], lavender: ['Lavendel', '#a998d8'], coral: ['Koralle', '#e5807a'] }),
  ...furn('fireplace', 'Kamin', 'large', 'floor', [2, 1], 300, { stone: ['Stein', '#d8c4b0'], brick: ['Ziegel', '#c27a62'] }),

  /* rugs */
  ...furn('rug', 'Teppich', 'rug', 'rug', [3, 2], 60, {
    terracotta: ['Terrakotta', '#d97b6c'],
    sage: ['Salbei', '#9cc0a0'],
    blue: ['Blau', '#7fa6d0']
  }, { starter: 'terracotta' }),
  ...furn('roundrug', 'Runder Teppich', 'rug', 'rug', [2, 2], 70, { mustard: ['Senf', '#e6b45a'], rose: ['Rosé', '#eaa2ae'] }),
  ...furn('bigrug', 'Großer Teppich', 'rug', 'rug', [3, 3], 120, { cream: ['Creme', '#e8d6bc'], lavender: ['Lavendel', '#b6a6dc'] }),

  /* wall */
  ...furn('picture', 'Bild', 'wall', 'wall', [1, 1], 30, { sunset: ['Abendrot', '#f0a87a'], sea: ['Meer', '#8cc4e8'], forest: ['Wald', '#8fb59a'] }),
  ...furn('clock', 'Wanduhr', 'wall', 'wall', [1, 1], 40, { cream: ['Creme', '#f3ead8'], mint: ['Mint', '#8ccfb4'] }),
  ...furn('wallshelf', 'Wandregal', 'wall', 'wall', [2, 1], 50, { wood: ['Holz', '#b8794a'] }),
  ...furn('lights', 'Lichterkette', 'wall', 'wall', [3, 1], 60, { warm: ['Warm', '#ffd27a'], pastel: ['Pastell', '#f0a6b4'] }),

  /* unlocked by attributes */
  ...furn('bench', 'Hantelbank', 'special', 'floor', [2, 1], 150, { red: ['Rot', '#d9625a'] }, { unlock: { attr: 'fitness', level: 3 } }),
  ...furn('easel', 'Staffelei', 'special', 'floor', [1, 1], 140, { wood: ['Holz', '#c48a56'] }, { unlock: { attr: 'creativity', level: 3 } }),
  ...furn('basketshelf', 'Korbregal', 'special', 'floor', [2, 1], 120, { wood: ['Holz', '#c9a27a'] }, { unlock: { attr: 'order', level: 3 } }),
  ...furn('hangchair', 'Hängesessel', 'special', 'floor', [1, 1], 180, { cream: ['Creme', '#efe2c8'] }, { unlock: { attr: 'stamina', level: 4 } }),
  ...furn('telescope', 'Teleskop', 'special', 'floor', [1, 1], 200, { navy: ['Nachtblau', '#4a5a8c'] }, { unlock: { attr: 'mind', level: 4 } }),
  ...furn('gametable', 'Spieltisch', 'special', 'floor', [2, 2], 250, { green: ['Grün', '#5f9a6a'], wine: ['Weinrot', '#9c4a5a'] }, { unlock: { attr: 'social', level: 4 } }),

  /* wallpaper 80–150 (style = pattern) */
  ...furn('plain', 'Tapete', 'surface', 'wallpaper', [0, 0], 80, {
    cream: ['Creme', '#f2d9c0'],
    sage: ['Salbei', '#cfe0c8'],
    rose: ['Rosé', '#f3cfd2'],
    sky: ['Himmel', '#cfe2f0']
  }, { starter: 'cream' }),
  ...furn('stripes', 'Streifentapete', 'surface', 'wallpaper', [0, 0], 120, { mustard: ['Senf', '#f2dcae'], mint: ['Mint', '#cfeadf'] }),
  ...furn('dots', 'Punkttapete', 'surface', 'wallpaper', [0, 0], 120, { lavender: ['Lavendel', '#ddd3f0'], peach: ['Pfirsich', '#f7d6c0'] }),
  ...furn('flowers', 'Blümchentapete', 'surface', 'wallpaper', [0, 0], 150, { cream: ['Creme', '#f4e6cf'], sage: ['Salbei', '#d6e4cf'] }),
  ...furn('panel', 'Holzvertäfelung', 'surface', 'wallpaper', [0, 0], 150, { oak: ['Eiche', '#d9b48a'] }),

  /* flooring 100–200 (style = pattern) */
  ...furn('planks', 'Dielen', 'surface', 'flooring', [0, 0], 100, {
    oak: ['Eiche', '#c98d5f'],
    walnut: ['Nussbaum', '#8f5f40'],
    birch: ['Birke', '#e2c39a']
  }, { starter: 'oak' }),
  ...furn('herringbone', 'Fischgrätparkett', 'surface', 'flooring', [0, 0], 160, { honey: ['Honig', '#d49a62'] }),
  ...furn('tiles', 'Fliesen', 'surface', 'flooring', [0, 0], 140, { terracotta: ['Terrakotta', '#d4876a'], sage: ['Salbei', '#a9c4a4'] }),
  ...furn('carpet', 'Teppichboden', 'surface', 'flooring', [0, 0], 120, { sage: ['Salbei', '#a9c2a0'], rose: ['Rosé', '#e3b2b4'] }),
  ...furn('checker', 'Schachbrettboden', 'surface', 'flooring', [0, 0], 180, { cream: ['Creme', '#e8d6bc'] })
]

export const furnitureById = (id: string | undefined): Furniture | undefined => (id ? FURNITURE.find((f) => f.id === id) : undefined)

/** things that give light in the evening */
export const LIGHT_STYLES = new Set(['lamp', 'candles', 'fireplace', 'lights'])

/* ── ownership ── */

export const ownsFurniture = (ch: Pick<Character, 'owned'>, f: Furniture): boolean => !!f.starter || ch.owned.includes(f.id)

export const isSurface = (f: Furniture): boolean => f.kind === 'wallpaper' || f.kind === 'flooring'

/** owned furniture that is not in the room (wallpaper and flooring are never in the chest) */
export function chest(ch: Pick<Character, 'owned' | 'room'>): Furniture[] {
  const placed = new Set(ch.room.items.map((p) => p.id))
  return FURNITURE.filter((f) => !isSurface(f) && ownsFurniture(ch, f) && !placed.has(f.id))
}

export const DEFAULT_WALL = 'f-plain-cream'
export const DEFAULT_FLOOR = 'f-planks-oak'

/** the wallpaper and flooring in use (falls back to the built-in ones) */
export function surfaces(room: Pick<Room, 'wall' | 'floor'>): { wall: Furniture; floor: Furniture } {
  const w = furnitureById(room.wall)
  const f = furnitureById(room.floor)
  return {
    wall: w?.kind === 'wallpaper' ? w : furnitureById(DEFAULT_WALL)!,
    floor: f?.kind === 'flooring' ? f : furnitureById(DEFAULT_FLOOR)!
  }
}

/* ── space ── */

export interface Rect {
  x: number
  y: number
  w: number
  d: number
}

/** tiles (or wall spots) a placed item covers */
export function footprint(p: PlacedFurniture, f: Furniture): Rect {
  if (f.kind === 'wall') return { x: p.x, y: 0, w: f.w, d: 1 }
  return p.rot % 2 ? { x: p.x, y: p.y, w: f.d, d: f.w } : { x: p.x, y: p.y, w: f.w, d: f.d }
}

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d

/** whether p fits: inside the room, not on the window, not on anything of its kind */
export function canPlace(room: Room, p: PlacedFurniture, ignore?: string): boolean {
  const f = furnitureById(p.id)
  if (!f || isSurface(f)) return false
  const r = footprint(p, f)
  if (!Number.isInteger(r.x) || !Number.isInteger(r.y) || r.x < 0 || r.x + r.w > ROOM_SIZE) return false
  if (f.kind === 'wall') {
    if (p.wall !== 'l' && p.wall !== 'r') return false
    if (p.wall === WINDOW.wall && r.x < WINDOW.x + WINDOW.w && WINDOW.x < r.x + r.w) return false
  } else if (r.y < 0 || r.y + r.d > ROOM_SIZE) return false
  return room.items.every((o) => {
    if (o.id === p.id || o.id === ignore) return true
    const g = furnitureById(o.id)
    if (!g || g.kind !== f.kind) return true
    if (f.kind === 'wall' && o.wall !== p.wall) return true
    return !overlaps(r, footprint(o, g))
  })
}

/** a free spot for f, closest to the middle of the room (or the first free spot on a wall) */
export function findSpot(room: Room, f: Furniture): PlacedFurniture | null {
  if (isSurface(f)) return null
  if (f.kind === 'wall') {
    for (const wall of ['l', 'r'] as const)
      for (let x = 0; x <= ROOM_SIZE - f.w; x++) {
        const p = { id: f.id, x, y: 0, rot: 0, wall }
        if (canPlace(room, p)) return p
      }
    return null
  }
  const c = (ROOM_SIZE - 1) / 2
  const tiles: [number, number][] = []
  for (let x = 0; x < ROOM_SIZE; x++) for (let y = 0; y < ROOM_SIZE; y++) tiles.push([x, y])
  tiles.sort((a, b) => Math.hypot(a[0] - c, a[1] - c) - Math.hypot(b[0] - c, b[1] - c) || a[0] - b[0] || a[1] - b[1])
  for (const rot of [0, 1])
    for (const [x, y] of tiles) {
      const p = { id: f.id, x, y, rot }
      if (canPlace(room, p)) return p
    }
  return null
}

/** turn an item a quarter; null when it does not fit that way */
export function rotated(room: Room, p: PlacedFurniture): PlacedFurniture | null {
  const f = furnitureById(p.id)
  if (!f || f.kind !== 'floor' && f.kind !== 'rug') return null
  const next = { ...p, rot: (p.rot + 1) % 4 }
  return canPlace(room, next) ? next : null
}

/** where the character stands: a free floor tile near the front middle */
export function avatarSpot(room: Room): { x: number; y: number } {
  const taken = new Set<string>()
  for (const p of room.items) {
    const f = furnitureById(p.id)
    if (!f || f.kind !== 'floor') continue
    const r = footprint(p, f)
    for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.d; y++) taken.add(`${x},${y}`)
  }
  const tiles: [number, number][] = []
  for (let x = 0; x < ROOM_SIZE; x++) for (let y = 0; y < ROOM_SIZE; y++) if (!taken.has(`${x},${y}`)) tiles.push([x, y])
  const best = (t: [number, number]): number => Math.hypot(t[0] - 2.6, t[1] - 3.2)
  tiles.sort((a, b) => best(a) - best(b))
  const t = tiles[0] ?? [ROOM_SIZE - 1, ROOM_SIZE - 1]
  return { x: t[0], y: t[1] }
}

/** the room as it comes: rug, beanbag, plant and floor lamp (the window is built in) */
export function defaultRoom(): Room {
  return {
    items: [
      { id: 'f-rug-terracotta', x: 2, y: 2, rot: 0 },
      { id: 'f-beanbag-coral', x: 4, y: 3, rot: 0 },
      { id: 'f-plant-green', x: 0, y: 4, rot: 0 },
      { id: 'f-lamp-honey', x: 5, y: 0, rot: 0 }
    ]
  }
}

/* ── drawing order ── */

export interface Box extends Rect {
  z?: number
}

/**
 * Painter's order for boxes on the floor (back first). A box is behind another when it ends
 * before the other starts along x or y; boxes stacked on the same tiles go bottom to top.
 */
export function depthOrder<T extends Box>(boxes: T[]): T[] {
  const n = boxes.length
  const behind = (a: Box, b: Box): boolean => {
    const sep = a.x + a.w <= b.x + 1e-9 || a.y + a.d <= b.y + 1e-9
    const rev = b.x + b.w <= a.x + 1e-9 || b.y + b.d <= a.y + 1e-9
    if (sep || rev) return sep && !rev
    return (a.z ?? 0) < (b.z ?? 0)
  }
  const after: number[][] = boxes.map(() => [])
  const deg = new Array(n).fill(0)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j && behind(boxes[i], boxes[j])) {
        after[i].push(j)
        deg[j]++
      }
  const key = (b: Box): number => b.x + b.w / 2 + b.y + b.d / 2 + (b.z ?? 0) / 100
  const out: T[] = []
  const done = new Array(n).fill(false)
  while (out.length < n) {
    let pick = -1
    for (let i = 0; i < n; i++) if (!done[i] && deg[i] === 0 && (pick < 0 || key(boxes[i]) < key(boxes[pick]))) pick = i
    // a cycle (only with odd overlaps): fall back to the simple sum
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || key(boxes[i]) < key(boxes[pick]))) pick = i
    done[pick] = true
    out.push(boxes[pick])
    for (const j of after[pick]) deg[j]--
  }
  return out
}
