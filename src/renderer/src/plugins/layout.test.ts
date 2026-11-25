import { describe, expect, it } from 'vitest'
import { columnCount, moveWidget, nextSize, resolveLayout, setColumns, setHidden, setSize, spanOf, stepWidget, type WidgetMeta } from './layout'

const W: WidgetMeta[] = [
  { id: 'a', size: 'full' },
  { id: 'b', size: 'half' },
  { id: 'c', size: 'half' },
  { id: 'd', size: 'half', defaultHidden: true }
]
const ids = (l: ReturnType<typeof resolveLayout>): string[] => l.visible.map((w) => w.id)

describe('resolveLayout', () => {
  it('uses registry order and default sizes without a saved layout', () => {
    const r = resolveLayout(W, undefined)
    expect(ids(r)).toEqual(['a', 'b', 'c'])
    expect(r.visible[0].size).toBe('full')
    expect(r.hidden).toEqual(['d'])
  })

  it('puts arranged widgets first, appends new ones and ignores unknown ids', () => {
    const r = resolveLayout(W, { order: ['c', 'zombie', 'a', 'c'], hidden: [], sizes: {} })
    expect(ids(r)).toEqual(['c', 'a', 'b'])
  })

  it('applies hidden ids and size overrides, tolerating junk', () => {
    const r = resolveLayout(W, { order: [], hidden: ['b'], sizes: { c: 'full', a: 'huge' as never } })
    expect(ids(r)).toEqual(['a', 'c'])
    expect(r.visible.find((w) => w.id === 'c')?.size).toBe('full')
    expect(r.visible.find((w) => w.id === 'a')?.size).toBe('full')
    expect(resolveLayout(W, { order: 'x' } as never).visible).toHaveLength(3)
  })
})

describe('layout changes', () => {
  it('moves a widget onto another one', () => {
    expect(ids(resolveLayout(W, moveWidget(W, undefined, 'c', 'a')))).toEqual(['c', 'a', 'b'])
    expect(ids(resolveLayout(W, moveWidget(W, undefined, 'a', 'c')))).toEqual(['b', 'c', 'a'])
  })

  it('steps over hidden widgets and stops at the ends', () => {
    const l = setHidden(W, undefined, 'b', true)
    expect(ids(resolveLayout(W, stepWidget(W, l, 'c', -1)))).toEqual(['c', 'a'])
    expect(ids(resolveLayout(W, stepWidget(W, l, 'a', -1)))).toEqual(['a', 'c'])
  })

  it('keeps a default-hidden widget hidden after other changes, and shows it on request', () => {
    const l = moveWidget(W, undefined, 'c', 'a')
    expect(resolveLayout(W, l).hidden).toEqual(['d'])
    const shown = setHidden(W, l, 'd', false)
    expect(ids(resolveLayout(W, shown))).toEqual(['c', 'a', 'b', 'd'])
  })

  it('keeps choices for widgets that are not registered right now', () => {
    const saved = { order: ['plugin-x', 'b'], hidden: ['plugin-x'], sizes: { 'plugin-x': 'full' as const } }
    const next = moveWidget(W, saved, 'c', 'b')
    expect(next.order).toContain('plugin-x')
    expect(next.hidden).toContain('plugin-x')
    expect(next.sizes['plugin-x']).toBe('full')
  })

  it('stores only sizes that differ from the default', () => {
    expect(setSize(W, undefined, 'b', 'full').sizes).toEqual({ b: 'full' })
    expect(setSize(W, { order: [], hidden: [], sizes: { b: 'full' } }, 'b', 'half').sizes).toEqual({})
  })
})

describe('columns', () => {
  it('fits as many columns as the width allows, at most four', () => {
    expect(columnCount(undefined, 700)).toBe(1)
    expect(columnCount(undefined, 1000)).toBe(2)
    expect(columnCount(undefined, 1400)).toBe(3)
    expect(columnCount(undefined, 2200)).toBe(4)
  })

  it('uses the chosen count but shrinks on narrow windows', () => {
    const l = setColumns(W, undefined, 3)
    expect(l.columns).toBe(3)
    expect(columnCount(l, 2200)).toBe(3)
    expect(columnCount(l, 600)).toBe(2)
    expect(setColumns(W, l, 0).columns).toBeUndefined()
    expect(columnCount({ order: [], hidden: [], sizes: {}, columns: 9 }, 2200)).toBe(4)
  })

  it('keeps the column choice when widgets move', () => {
    expect(moveWidget(W, setColumns(W, undefined, 4), 'c', 'a').columns).toBe(4)
  })

  it('spans and cycles sizes; wide only with more than two columns', () => {
    expect(spanOf('full', 4)).toBe(4)
    expect(spanOf('wide', 4)).toBe(2)
    expect(spanOf('wide', 1)).toBe(1)
    expect(nextSize('half', 3)).toBe('wide')
    expect(nextSize('half', 2)).toBe('full')
    expect(nextSize('wide', 3)).toBe('full')
    expect(nextSize('full', 3)).toBe('half')
    expect(resolveLayout(W, { order: [], hidden: [], sizes: { b: 'wide' } }).visible.find((w) => w.id === 'b')?.size).toBe('wide')
  })
})
