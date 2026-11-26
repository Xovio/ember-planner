import { describe, expect, it } from 'vitest'
import { IDLES, availableIdles, findPath, idleById, idleDuration, idleKey, idleTarget, nextIdle, walkable } from './idle'
import { FURNITURE, defaultRoom } from './room'
import type { Room } from './types'

const room = defaultRoom() // rug (2,2) 3×2, beanbag (4,3), plant (0,4), lamp (5,0)
const ch = (r: Room = room, owned: string[] = [], idle?: { off: string[]; pinned?: string }) => ({ owned, room: r, idle })
const ids = (l: { id: string }[]) => l.map((d) => d.id).sort()

describe('idle catalogue', () => {
  it('has three free starters and furniture idles that point to real furniture', () => {
    expect(IDLES.filter((d) => d.starter).length).toBe(3)
    const styles = new Set(FURNITURE.map((f) => f.style))
    for (const d of IDLES) for (const s of d.needs ?? []) expect(styles.has(s)).toBe(true)
    expect(new Set(IDLES.map((d) => d.id)).size).toBe(IDLES.length)
  })
})

describe('available idles', () => {
  it('starters plus what the placed furniture brings; bought ones once owned', () => {
    expect(ids(availableIdles(ch()))).toEqual(['hum', 'look', 'relax', 'stretch', 'water'])
    expect(ids(availableIdles(ch(room, [idleKey('dance')])))).toContain('dance')
    expect(ids(availableIdles(ch({ items: [] })))).toEqual(['hum', 'look', 'stretch'])
  })

  it('leaves out switched off ones', () => {
    expect(ids(availableIdles(ch(room, [], { off: ['water', 'look'] })))).toEqual(['hum', 'relax', 'stretch'])
  })
})

describe('choosing the next idle', () => {
  const list = availableIdles(ch())
  it('takes the pinned one, else never the same twice', () => {
    expect(nextIdle(list, 'look', 'water', () => 0.5)?.id).toBe('water')
    for (let i = 0; i < 10; i++) expect(nextIdle(list, 'look', undefined, () => i / 10)?.id).not.toBe('look')
    expect(nextIdle([idleById('look')!], 'look', undefined, () => 0)?.id).toBe('look')
    expect(nextIdle([], null, undefined, () => 0)).toBeNull()
  })
  it('lasts 20 to 40 seconds', () => {
    expect(idleDuration(() => 0)).toBe(20_000)
    expect(idleDuration(() => 1)).toBe(40_000)
  })
})

describe('walking', () => {
  it('walks around furniture and over rugs', () => {
    const free = walkable(room)
    expect(free.has('4,3')).toBe(false) // beanbag
    expect(free.has('2,2')).toBe(true) // rug
    const path = findPath(room, [3, 3], [5, 3])!
    expect(path[0]).toEqual([3, 3])
    expect(path.at(-1)).toEqual([5, 3])
    expect(path.some(([x, y]) => x === 4 && y === 3)).toBe(false)
    expect(path.length).toBe(5)
  })

  it('finds no way into a closed corner', () => {
    const r: Room = { items: [{ id: 'f-sofa-sage', x: 0, y: 1, rot: 0 }, { id: 'f-armchair-sage', x: 1, y: 0, rot: 0 }] }
    expect(findPath(r, [3, 3], [0, 0])).toBeNull()
  })
})

describe('where to go', () => {
  it('sits on the beanbag from the tile in front of it', () => {
    const t = idleTarget(room, idleById('relax')!, [3, 3])!
    expect(t).toMatchObject({ stand: [4, 4], item: 'f-beanbag-coral' })
    expect(t.seat).toBeDefined()
  })

  it('stands next to the plant and looks at it', () => {
    const t = idleTarget(room, idleById('water')!, [3, 3])!
    expect(t.item).toBe('f-plant-green')
    expect(Math.abs(t.stand[0] - 0) + Math.abs(t.stand[1] - 4)).toBe(1)
  })

  it('uses the turned front side (desk turned towards the left wall side)', () => {
    const r: Room = { items: [{ id: 'f-desk-wood', x: 3, y: 0, rot: 0 }] }
    expect(idleTarget(r, idleById('laptop')!, [0, 5])!.stand[1]).toBe(1)
    const r2: Room = { items: [{ id: 'f-desk-wood', x: 4, y: 2, rot: 1 }] } // 1×2, front faces -x
    expect(idleTarget(r2, idleById('laptop')!, [0, 5])!.stand[0]).toBe(3)
  })

  it('in a wheelchair stays in the chair next to the sofa', () => {
    const r: Room = { items: [{ id: 'f-sofa-sage', x: 2, y: 0, rot: 0 }] }
    const t = idleTarget(r, idleById('read')!, [0, 5], true)!
    expect(t.seat).toBeUndefined()
    expect(t.stand[1]).toBe(1)
  })

  it('gives up when the furniture cannot be reached', () => {
    const r: Room = { items: [{ id: 'f-plant-green', x: 0, y: 0, rot: 0 }, { id: 'f-sofa-sage', x: 0, y: 1, rot: 0 }, { id: 'f-armchair-sage', x: 1, y: 0, rot: 0 }] }
    expect(idleTarget(r, idleById('water')!, [3, 3])).toBeNull()
  })
})
