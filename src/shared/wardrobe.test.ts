import { describe, expect, it } from 'vitest'
import { BEARDS, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, LOOK_PRESETS, SKIN_TONES, lookColors } from './wardrobe'
import { defaultCharacter, normalizeData } from './types'

describe('look colours', () => {
  it('use the palette, custom picks, and fall back on anything odd', () => {
    const look = defaultCharacter().look
    expect(lookColors(look)).toEqual({ skin: SKIN_TONES[3], hair: HAIR_COLORS.ginger, eyes: EYE_COLORS.plum })
    expect(lookColors({ ...look, skinHex: '#123456', hairColor: '#abcdef', eyes: '#00ff00' })).toEqual({ skin: '#123456', hair: '#abcdef', eyes: '#00ff00' })
    expect(lookColors({ ...look, skin: 99, skinHex: 'red', hairColor: 'nope', eyes: '#12' })).toEqual({ skin: SKIN_TONES[3], hair: HAIR_COLORS.ginger, eyes: EYE_COLORS.plum })
  })
})

describe('presets', () => {
  it('only set shape features, never colours or aids', () => {
    for (const p of LOOK_PRESETS) {
      for (const key of ['skin', 'skinHex', 'hairColor', 'eyes', 'glasses', 'hearingAid', 'wheelchair']) expect(p.look).not.toHaveProperty(key)
      if (p.look.hair) expect(HAIR_STYLES.some((h) => h.id === p.look.hair)).toBe(true)
      if (p.look.beard) expect(BEARDS.some((b) => b.id === p.look.beard)).toBe(true)
    }
  })
})

describe('older saved looks', () => {
  it('keep their choices and get defaults for the new features', () => {
    const old = { skin: 7, hair: 'curly', hairColor: 'black', eyes: 'green', build: 2, glasses: true, hearingAid: false }
    const d = normalizeData({ character: { ...defaultCharacter(), look: old } } as never)
    expect(d.character.look).toMatchObject({ ...old, body: 'straight', face: 'round', beard: 'none', blush: true, wheelchair: false })
  })
})
