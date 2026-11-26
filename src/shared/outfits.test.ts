import { describe, expect, it } from 'vitest'
import { cycleKey, cyclePick, outfitForIdle, randomLook, randomOutfit, wearable } from './outfits'
import { BEARDS, HAIR_STYLES, ITEMS, ownsItem } from './wardrobe'
import type { SavedOutfit } from './types'

/** a small repeatable random source */
const seq = (seed: number): (() => number) => {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

describe('randomLook', () => {
  it('only picks known values and never touches aids', () => {
    for (let i = 1; i < 40; i++) {
      const l = randomLook(seq(i))
      expect(HAIR_STYLES.some((h) => h.id === l.hair)).toBe(true)
      expect(BEARDS.some((b) => b.id === l.beard)).toBe(true)
      expect(l.skin).toBeGreaterThanOrEqual(0)
      for (const key of ['glasses', 'hearingAid', 'wheelchair']) expect(l).not.toHaveProperty(key)
    }
  })
})

describe('owning clothes', () => {
  it('gives every starter piece for free', () => {
    const starters = ITEMS.filter((i) => i.starter)
    expect(starters.length).toBeGreaterThan(5)
    for (const it of starters) expect(ownsItem({ owned: [] }, it)).toBe(true)
    expect(ITEMS.filter((i) => !i.starter).every((i) => i.price > 0)).toBe(true)
  })

  it('has unique ids', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
  })

  it('random outfits use only owned pieces', () => {
    const ch = { owned: ['hoodie-coral'] }
    for (let i = 1; i < 20; i++) {
      const o = randomOutfit(ch, seq(i))
      for (const id of Object.values(o)) expect(ownsItem(ch, ITEMS.find((x) => x.id === id)!)).toBe(true)
      expect(o.top).toBeDefined()
    }
  })

  it('drops pieces that are not owned or sit in the wrong slot', () => {
    expect(wearable({ top: 'tee-white', bottom: 'cargo-khaki', hat: 'tee-black', shoes: 'gone' }, { owned: [] })).toEqual({ top: 'tee-white' })
  })
})

describe('outfit rotation', () => {
  const a: SavedOutfit = { id: 'a', name: 'A', items: { top: 'tee-white' }, rotate: true }
  const b: SavedOutfit = { id: 'b', name: 'B', items: { top: 'tee-black' }, rotate: true }
  const c: SavedOutfit = { id: 'c', name: 'C', items: { top: 'tee-grey' }, tag: 'fitness' }

  it('splits time into windows', () => {
    const d = new Date(2026, 10, 26, 13, 40)
    expect(cycleKey('off', d)).toBeNull()
    expect(cycleKey('daily', d)).toBe('2026-11-26')
    expect(cycleKey('often', d)).toBe('2026-11-26/4')
    expect(cycleKey('often', new Date(2026, 10, 26, 14, 59))).toBe('2026-11-26/4')
    expect(cycleKey('often', new Date(2026, 10, 26, 15, 0))).toBe('2026-11-26/5')
  })

  it('only takes outfits marked for rotation and avoids the one already on', () => {
    expect(cyclePick([c], 'k', {})).toBeNull()
    for (const key of ['x', 'y', 'z', '2026-11-26']) {
      const got = cyclePick([a, b, c], key, a.items)
      expect(got?.id).toBe('b')
    }
  })

  it('wears a tagged outfit for a matching idle animation', () => {
    expect(outfitForIdle([a, c], 'lift')?.id).toBe('c')
    expect(outfitForIdle([a, c], 'laptop')).toBeUndefined()
    expect(outfitForIdle([a, c], undefined)).toBeUndefined()
  })
})
