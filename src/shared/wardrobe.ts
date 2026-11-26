import type { AttrId, AvatarLook } from './types'

/**
 * Looks (always free) and clothes (bought with coins). Every item is a drawn style plus a colour;
 * shading, highlight and outline are derived from that colour, so new colours cost nothing.
 */

export const SKIN_TONES = [
  '#fde4cf', '#f8d5b8', '#f6c9a4', '#efb88f', '#e0a37a', '#c98a62',
  '#b0744f', '#9a6242', '#80503a', '#6a4030', '#553326', '#42271e'
]

export const HAIR_STYLES: { id: string; name: string }[] = [
  { id: 'bob', name: 'Bob' },
  { id: 'short', name: 'Kurz' },
  { id: 'long', name: 'Lang' },
  { id: 'curly', name: 'Locken' },
  { id: 'longcurly', name: 'Lange Locken' },
  { id: 'afro', name: 'Afro' },
  { id: 'bun', name: 'Dutt' },
  { id: 'ponytail', name: 'Zopf' },
  { id: 'pigtails', name: 'Zwei Zöpfe' },
  { id: 'braid', name: 'Flechtzopf' },
  { id: 'shoulder', name: 'Mittellang' },
  { id: 'dreads', name: 'Dreadlocks' },
  { id: 'sidepart', name: 'Seitenscheitel' },
  { id: 'quiff', name: 'Tolle' },
  { id: 'slick', name: 'Zurückgegelt' },
  { id: 'messy', name: 'Strubbelig' },
  { id: 'spiky', name: 'Stachelig' },
  { id: 'crop', name: 'Fransen-Kurz' },
  { id: 'manbun', name: 'Männerdutt' },
  { id: 'undercut', name: 'Undercut' },
  { id: 'mohawk', name: 'Iro' },
  { id: 'buzz', name: 'Raspel' },
  { id: 'bald', name: 'Glatze' }
]

export const BEARDS: { id: AvatarLook['beard']; name: string }[] = [
  { id: 'none', name: 'Keiner' },
  { id: 'stubble', name: 'Stoppeln' },
  { id: 'short', name: 'Kurz' },
  { id: 'full', name: 'Voll' },
  { id: 'mustache', name: 'Schnurrbart' },
  { id: 'goatee', name: 'Kinnbart' }
]

/**
 * Quick starting points. They only set shape features (no colours) and every one of them
 * stays freely changeable afterwards: there is no gender switch that locks anything.
 */
export const LOOK_PRESETS: { id: string; name: string; look: Partial<AvatarLook> }[] = [
  { id: 'fem', name: 'Eher weiblich', look: { body: 'curvy', face: 'oval', eyeShape: 'almond', brows: 'thin', lashes: true, blush: true, beard: 'none', hair: 'long' } },
  { id: 'masc', name: 'Eher männlich', look: { body: 'broad', face: 'square', eyeShape: 'narrow', brows: 'thick', lashes: false, blush: false, beard: 'stubble', hair: 'short', makeup: 'none' } },
  { id: 'neutral', name: 'Neutral', look: { body: 'straight', face: 'round', eyeShape: 'round', brows: 'soft', lashes: false, beard: 'none', hair: 'bob' } }
]

const isHex = (v: string | undefined): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v)

/** the colours a look resolves to: palette entries or custom picks */
export function lookColors(look: Pick<AvatarLook, 'skin' | 'skinHex' | 'hairColor' | 'eyes'>): { skin: string; hair: string; eyes: string } {
  return {
    skin: isHex(look.skinHex) ? look.skinHex : (SKIN_TONES[look.skin] ?? SKIN_TONES[3]),
    hair: HAIR_COLORS[look.hairColor] ?? (isHex(look.hairColor) ? look.hairColor : HAIR_COLORS.ginger),
    eyes: EYE_COLORS[look.eyes] ?? (isHex(look.eyes) ? look.eyes : EYE_COLORS.plum)
  }
}

export const HAIR_COLORS: Record<string, string> = {
  ginger: '#d9824a',
  brown: '#7a4a32',
  black: '#33262f',
  blonde: '#e8c070',
  auburn: '#9c3f2e',
  silver: '#d6d2da',
  lavender: '#b79be0',
  mint: '#7cc7a8',
  pink: '#f29ab8'
}

export const EYE_COLORS: Record<string, string> = {
  plum: '#4a2f3e',
  brown: '#5a3a24',
  blue: '#2f5d8a',
  green: '#2f6e4a',
  hazel: '#6a5a2a',
  grey: '#4a5560'
}

export type Slot = 'top' | 'bottom' | 'shoes' | 'hat' | 'extra'

export const SLOTS: { id: Slot; name: string; optional: boolean }[] = [
  { id: 'top', name: 'Oberteil', optional: false },
  { id: 'bottom', name: 'Unterteil', optional: false },
  { id: 'shoes', name: 'Schuhe', optional: false },
  { id: 'hat', name: 'Kopf', optional: true },
  { id: 'extra', name: 'Extra', optional: true }
]

export interface Item {
  id: string
  slot: Slot
  style: string
  name: string
  color: string
  price: number
  /** only buyable from this attribute level on */
  unlock?: { attr: AttrId; level: number }
}

const item = (slot: Slot, style: string, name: string, price: number, colors: Record<string, [string, string]>, unlock?: Item['unlock']): Item[] =>
  Object.entries(colors).map(([key, [label, color]]) => ({ id: `${style}-${key}`, slot, style, name: `${name} ${label}`, color, price, ...(unlock ? { unlock } : {}) }))

export const ITEMS: Item[] = [
  ...item('top', 'hoodie', 'Hoodie', 60, {
    coral: ['Koralle', '#e5615a'],
    sage: ['Salbei', '#8fb59a'],
    lavender: ['Lavendel', '#a998d8'],
    mustard: ['Senf', '#e0a43c'],
    navy: ['Nachtblau', '#4a5a8c']
  }),
  ...item('top', 'tee', 'T-Shirt', 35, {
    cream: ['Creme', '#f3ead8'],
    sky: ['Himmel', '#8cc4e8'],
    rose: ['Rosé', '#f0a6b4']
  }),
  ...item('top', 'sweater', 'Strickpulli', 70, {
    oat: ['Hafer', '#e3d2b4'],
    forest: ['Wald', '#4f7d5c'],
    berry: ['Beere', '#a8456a']
  }),
  ...item('top', 'sport', 'Sportshirt', 55, { teal: ['Türkis', '#3fa6a0'] }, { attr: 'fitness', level: 2 }),
  ...item('top', 'robe', 'Magierrobe', 120, { indigo: ['Indigo', '#5b4bb0'] }, { attr: 'creativity', level: 3 }),
  ...item('bottom', 'pants', 'Hose', 40, {
    navy: ['Marine', '#4a5578'],
    denim: ['Jeans', '#5f7fb0'],
    olive: ['Oliv', '#7a7f4a'],
    charcoal: ['Anthrazit', '#4a4650']
  }),
  ...item('bottom', 'shorts', 'Shorts', 30, { denim: ['Jeans', '#5f7fb0'], khaki: ['Khaki', '#c2a878'] }),
  ...item('bottom', 'skirt', 'Rock', 45, { plum: ['Pflaume', '#8a4a78'], mustard: ['Senf', '#e0a43c'] }),
  ...item('shoes', 'sneakers', 'Sneaker', 30, { cream: ['Creme', '#f3ece0'], red: ['Rot', '#d9534f'], ink: ['Tinte', '#3f3a4a'] }),
  ...item('shoes', 'boots', 'Stiefel', 50, { brown: ['Braun', '#8a5a3a'] }),
  ...item('shoes', 'slippers', 'Hausschuhe', 35, { pink: ['Rosa', '#f2a6b8'] }),
  ...item('hat', 'beanie', 'Mütze', 45, { coral: ['Koralle', '#e5615a'], sage: ['Salbei', '#8fb59a'] }),
  ...item('hat', 'cap', 'Cap', 40, { navy: ['Marine', '#4a5a8c'] }),
  ...item('hat', 'flowers', 'Blumenkranz', 80, { spring: ['Frühling', '#f2a6b8'] }, { attr: 'stamina', level: 2 }),
  ...item('hat', 'wizard', 'Zauberhut', 150, { indigo: ['Indigo', '#5b4bb0'] }, { attr: 'creativity', level: 5 }),
  ...item('extra', 'scarf', 'Schal', 40, { red: ['Rot', '#d9534f'], mustard: ['Senf', '#e0a43c'] }),
  ...item('extra', 'headphones', 'Kopfhörer', 70, { ink: ['Tinte', '#3f3a4a'] }, { attr: 'mind', level: 2 })
]

export const itemById = (id: string | undefined): Item | undefined => (id ? ITEMS.find((i) => i.id === id) : undefined)

/* ── colour ramps: one shared shadow and light tone for the whole scene ── */

const SHADOW = [91, 58, 94] // plum
const LIGHT = [255, 243, 214] // warm cream
const LINE = [58, 32, 48]

function mix(hex: string, to: number[], t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v + (to[i] - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** base, shadow, highlight and outline for a colour */
export function ramp(base: string): { base: string; shade: string; light: string; line: string } {
  return { base, shade: mix(base, SHADOW, 0.28), light: mix(base, LIGHT, 0.38), line: mix(base, LINE, 0.55) }
}
