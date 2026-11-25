import { describe, expect, it } from 'vitest'
import {
  FURNITURE,
  ROOM_SIZE,
  avatarSpot,
  canPlace,
  chest,
  defaultRoom,
  depthOrder,
  findSpot,
  footprint,
  furnitureById,
  rotated
} from './room'
import { ITEMS } from './wardrobe'
import { defaultCharacter, normalizeData } from './types'

const room = defaultRoom()
const f = (id: string) => furnitureById(id)!

describe('furniture catalogue', () => {
  it('has unique ids that never clash with clothes', () => {
    const ids = FURNITURE.map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.some((id) => ITEMS.some((i) => i.id === id))).toBe(false)
  })

  it('keeps prices in their classes and the starter set free', () => {
    for (const x of FURNITURE) {
      if (x.starter) expect(x.price).toBe(0)
      else if (x.group === 'small') expect(x.price).toBeGreaterThanOrEqual(20), expect(x.price).toBeLessThanOrEqual(50)
      else if (x.group === 'medium') expect(x.price).toBeGreaterThanOrEqual(60), expect(x.price).toBeLessThanOrEqual(120)
      else if (x.group === 'large') expect(x.price).toBeGreaterThanOrEqual(150), expect(x.price).toBeLessThanOrEqual(300)
    }
    expect(FURNITURE.filter((x) => x.starter).map((x) => x.style).sort()).toEqual(['beanbag', 'lamp', 'plant', 'rug'])
  })

  it('places every starter item in the default room, validly', () => {
    for (const p of room.items) expect(canPlace(room, p)).toBe(true)
    expect(room.items.map((p) => p.id).sort()).toEqual(FURNITURE.filter((x) => x.starter).map((x) => x.id).sort())
  })
})

describe('placing', () => {
  it('keeps things inside the room', () => {
    expect(canPlace(room, { id: 'f-sofa-sage', x: 5, y: 5, rot: 0 })).toBe(false) // 2 wide
    expect(canPlace(room, { id: 'f-sofa-sage', x: 5, y: 4, rot: 1 })).toBe(true) // turned: 1 × 2
    expect(canPlace(room, { id: 'f-sofa-sage', x: -1, y: 0, rot: 0 })).toBe(false)
    expect(canPlace(room, { id: 'f-sofa-sage', x: 0.5, y: 0, rot: 0 })).toBe(false)
  })

  it('does not stack furniture but lets it stand on rugs', () => {
    expect(canPlace(room, { id: 'f-stool-wood', x: 4, y: 3, rot: 0 })).toBe(false) // beanbag
    expect(canPlace(room, { id: 'f-stool-wood', x: 2, y: 2, rot: 0 })).toBe(true) // on the rug
    expect(canPlace(room, { id: 'f-roundrug-rose', x: 3, y: 3, rot: 0 })).toBe(false) // rug on rug
  })

  it('moving an item ignores its own old place', () => {
    expect(canPlace(room, { id: 'f-beanbag-coral', x: 4, y: 3, rot: 0 })).toBe(true)
  })

  it('keeps wall items off the window and off each other', () => {
    const r = { items: [...room.items, { id: 'f-picture-sea', x: 0, y: 0, rot: 0, wall: 'r' as const }] }
    expect(canPlace(r, { id: 'f-clock-cream', x: 2, y: 0, rot: 0, wall: 'r' })).toBe(false) // window
    expect(canPlace(r, { id: 'f-clock-cream', x: 0, y: 0, rot: 0, wall: 'r' })).toBe(false) // picture
    expect(canPlace(r, { id: 'f-clock-cream', x: 0, y: 0, rot: 0, wall: 'l' })).toBe(true)
    expect(canPlace(r, { id: 'f-lights-warm', x: 4, y: 0, rot: 0, wall: 'l' })).toBe(false) // too long
  })

  it('turns by swapping the footprint, only where it fits', () => {
    expect(footprint({ id: 'f-bed-sage', x: 0, y: 0, rot: 1 }, f('f-bed-sage'))).toEqual({ x: 0, y: 0, w: 3, d: 2 })
    const r = { items: [{ id: 'f-bed-sage', x: 4, y: 0, rot: 0 }] }
    expect(rotated(r, r.items[0])).toBeNull() // 3 wide does not fit from x = 4
    const r2 = { items: [{ id: 'f-bed-sage', x: 0, y: 0, rot: 0 }] }
    expect(rotated(r2, r2.items[0])).toEqual({ id: 'f-bed-sage', x: 0, y: 0, rot: 1 })
    expect(rotated(r2, { id: 'f-picture-sea', x: 0, y: 0, rot: 0, wall: 'l' })).toBeNull()
  })

  it('finds a free spot near the middle, or none when the room is full', () => {
    const spot = findSpot(room, f('f-armchair-sage'))!
    expect(canPlace(room, spot)).toBe(true)
    expect(findSpot(room, f('f-clock-cream'))).toEqual({ id: 'f-clock-cream', x: 0, y: 0, rot: 0, wall: 'l' })
    const full = { items: [] as { id: string; x: number; y: number; rot: number }[] }
    // fill every tile with 1×1 things of different ids is impossible (one each), so use beds
    for (let x = 0; x < ROOM_SIZE; x += 2) full.items.push({ id: `f-bed-${['sage', 'lavender', 'coral'][x / 2]}`, x, y: 0, rot: 0 })
    for (const id of ['f-sofa-sage', 'f-sofa-terracotta', 'f-sofa-navy']) full.items.push({ id, x: full.items.length * 2 - 6, y: 3, rot: 0 })
    for (const id of ['f-desk-wood', 'f-desk-dark', 'f-dresser-wood']) full.items.push({ id, x: full.items.length * 2 - 12, y: 4, rot: 0 })
    for (const id of ['f-dresser-sage', 'f-dresser-rose', 'f-bookshelf-wood']) full.items.push({ id, x: full.items.length * 2 - 18, y: 5, rot: 0 })
    for (const p of full.items) expect(canPlace(full, p)).toBe(true)
    expect(findSpot(full, f('f-stool-wood'))).toBeNull()
  })

  it('puts the character on a free tile', () => {
    const s = avatarSpot(room)
    expect(canPlace(room, { id: 'f-stool-wood', ...s, rot: 0 })).toBe(true)
  })
})

describe('chest', () => {
  it('holds owned furniture that is not placed, starters included', () => {
    const ch = { owned: ['f-sofa-sage', 'hoodie-coral'], room: { items: room.items.filter((p) => p.id !== 'f-plant-green') } }
    expect(chest(ch).map((x) => x.id).sort()).toEqual(['f-plant-green', 'f-sofa-sage'])
  })
})

describe('drawing order', () => {
  it('draws back boxes first and stacked boxes bottom up', () => {
    const order = depthOrder([
      { k: 'front', x: 3, y: 3, w: 1, d: 1 },
      { k: 'top', x: 0, y: 0, w: 1, d: 1, z: 10 },
      { k: 'back', x: 0, y: 0, w: 1, d: 1 },
      { k: 'long', x: 1, y: 0, w: 1, d: 3 }
    ]).map((b) => b.k)
    expect(order.indexOf('back')).toBeLessThan(order.indexOf('top'))
    expect(order.indexOf('back')).toBeLessThan(order.indexOf('long'))
    expect(order.indexOf('long')).toBeLessThan(order.indexOf('front'))
  })
})

describe('saved data', () => {
  it('gives older characters the default room', () => {
    const { room: _drop, ...old } = defaultCharacter()
    const d = normalizeData({ character: old } as never)
    expect(d.character.room.items.length).toBe(4)
  })
})
