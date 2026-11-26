import type { AvatarLook, Character, OutfitCycle, OutfitTag, SavedOutfit } from './types'
import { BEARDS, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, ITEMS, SKIN_TONES, SLOTS, itemById, ownsItem } from './wardrobe'

/**
 * Saved outfits, the random buttons and outfit rotation. Pure logic so it can be tested;
 * the store applies the results.
 */

/** what an outfit can be meant for; the same activities later drive calendar mirroring */
export const OUTFIT_TAGS: { id: OutfitTag; name: string }[] = [
  { id: 'fitness', name: 'Fitness' },
  { id: 'work', name: 'Arbeit' },
  { id: 'study', name: 'Lernen' },
  { id: 'creative', name: 'Kreativ' },
  { id: 'dnd', name: 'D&D / Spiele' },
  { id: 'relax', name: 'Entspannen' },
  { id: 'party', name: 'Feiern' }
]

/** which activity an idle animation in the room belongs to */
export const IDLE_TAG: Record<string, OutfitTag> = {
  lift: 'fitness',
  yoga: 'fitness',
  laptop: 'work',
  read: 'study',
  browse: 'study',
  paint: 'creative',
  dice: 'dnd',
  meditate: 'relax',
  nap: 'relax',
  relax: 'relax',
  warm: 'relax',
  stargaze: 'relax',
  dance: 'party',
  hop: 'party',
  gm: 'dnd',
  game: 'dnd',
  guitar: 'creative',
  cook: 'relax',
  run: 'fitness'
}

export const OUTFIT_CYCLES: [OutfitCycle, string][] = [
  ['off', 'aus'],
  ['daily', 'täglich'],
  ['often', 'alle 3 Std.']
]

type Rand = () => number
const pick = <T>(list: readonly T[], r: Rand): T => list[Math.min(list.length - 1, Math.floor(r() * list.length))]
const maybe = <T>(p: number, yes: T, no: T, r: Rand): T => (r() < p ? yes : no)

/**
 * A random look. Aids (glasses, hearing aid, wheelchair) are part of who someone is,
 * so they are never touched.
 */
export function randomLook(r: Rand = Math.random): Partial<AvatarLook> {
  const beard = maybe<AvatarLook['beard']>(0.5, 'none', pick(BEARDS.filter((b) => b.id !== 'none'), r).id, r)
  return {
    skin: Math.floor(r() * SKIN_TONES.length),
    skinHex: undefined,
    hair: pick(HAIR_STYLES, r).id,
    hairColor: pick(Object.keys(HAIR_COLORS), r),
    eyes: pick(Object.keys(EYE_COLORS), r),
    build: Math.floor(r() * 3),
    height: Math.floor(r() * 3),
    body: pick(['straight', 'curvy', 'broad'] as const, r),
    face: pick(['round', 'oval', 'square'] as const, r),
    eyeShape: pick(['round', 'almond', 'soft', 'narrow', 'small', 'hooded'] as const, r),
    brows: pick(['thin', 'soft', 'thick', 'arched', 'unibrow', 'slit'] as const, r),
    nose: pick(['none', 'none', 'dot', 'button', 'pointed', 'wide'] as const, r),
    lashes: r() < 0.4,
    beard,
    blush: r() < 0.5,
    freckles: r() < 0.25,
    mole: r() < 0.2,
    scar: r() < 0.08,
    makeup: maybe<AvatarLook['makeup']>(0.7, 'none', pick(['lips', 'liner', 'both'] as const, r), r),
    earrings: maybe<AvatarLook['earrings']>(0.65, 'none', pick(['studs', 'hoops'] as const, r), r),
    piercing: maybe<AvatarLook['piercing']>(0.8, 'none', pick(['nose', 'brow', 'lip'] as const, r), r)
  }
}

/** one owned piece per slot; optional slots stay empty half of the time */
export function randomOutfit(ch: Pick<Character, 'owned'>, r: Rand = Math.random): Record<string, string> {
  const out: Record<string, string> = {}
  for (const slot of SLOTS) {
    const owned = ITEMS.filter((i) => i.slot === slot.id && ownsItem(ch, i))
    if (owned.length === 0 || (slot.optional && r() < 0.5)) continue
    out[slot.id] = pick(owned, r).id
  }
  return out
}

/** only pieces that still exist and are owned */
export function wearable(items: Record<string, string>, ch: Pick<Character, 'owned'>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [slot, id] of Object.entries(items)) {
    const it = itemById(id)
    if (it && it.slot === slot && ownsItem(ch, it)) out[slot] = id
  }
  return out
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** the time window an automatic outfit belongs to; a new window means a new outfit */
export function cycleKey(mode: OutfitCycle | undefined, now: Date): string | null {
  if (!mode || mode === 'off') return null
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return mode === 'daily' ? day : `${day}/${Math.floor(now.getHours() / 3)}`
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const same = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}

/** the outfit for a time window, chosen from the ones marked for rotation; avoids repeating what is on */
export function cyclePick(outfits: SavedOutfit[] | undefined, key: string, current: Record<string, string>): SavedOutfit | null {
  const pool = (outfits ?? []).filter((o) => o.rotate)
  if (pool.length === 0) return null
  let i = hash(key) % pool.length
  if (pool.length > 1 && same(pool[i].items, current)) i = (i + 1) % pool.length
  return pool[i]
}

/** an outfit tagged for what the figure is doing in the room, if there is one */
export function outfitForIdle(outfits: SavedOutfit[] | undefined, idleId: string | undefined): SavedOutfit | undefined {
  const tag = idleId ? IDLE_TAG[idleId] : undefined
  return tag ? outfits?.find((o) => o.tag === tag) : undefined
}
