import type { OverviewLayout, WidgetSize } from '@shared/types'

/** what the layout logic needs to know about a registered widget */
export interface WidgetMeta {
  id: string
  size: WidgetSize
  /** starts hidden until the user shows it */
  defaultHidden?: boolean
}

export interface PlacedWidget {
  id: string
  size: WidgetSize
}

export interface ResolvedLayout {
  visible: PlacedWidget[]
  /** hidden ids in display order, for the "show again" tray */
  hidden: string[]
}

export const EMPTY_LAYOUT: OverviewLayout = { order: [], hidden: [], sizes: {} }

/** tolerate partial or foreign data from older settings files */
function clean(layout: Partial<OverviewLayout> | undefined): OverviewLayout {
  const cols = layout?.columns
  return {
    order: Array.isArray(layout?.order) ? layout.order : [],
    hidden: Array.isArray(layout?.hidden) ? layout.hidden : [],
    sizes: layout?.sizes && typeof layout.sizes === 'object' ? layout.sizes : {},
    ...(typeof cols === 'number' && cols >= 1 && cols <= MAX_COLUMNS ? { columns: Math.round(cols) } : {})
  }
}

export const MAX_COLUMNS = 4
/** a column is at least this wide (px) when the count is automatic */
export const MIN_COLUMN_WIDTH = 400
const SIZES = new Set(['half', 'wide', 'full'])

/** columns the grid gets: the user's choice, else as many as fit into `width` */
export function columnCount(layout: Partial<OverviewLayout> | undefined, width: number, gap = 18): number {
  const fit = Math.max(1, Math.min(MAX_COLUMNS, Math.floor((width + gap) / (MIN_COLUMN_WIDTH + gap))))
  const chosen = clean(layout).columns
  // a chosen count still shrinks on a narrow window, otherwise the widgets get squeezed
  return chosen ? Math.max(1, Math.min(chosen, Math.floor((width + gap) / (260 + gap)))) : fit
}

export function setColumns(widgets: WidgetMeta[], layout: Partial<OverviewLayout> | undefined, columns: number): OverviewLayout {
  const next = commit(widgets, layout, orderedIds(widgets, layout))
  if (columns >= 1 && columns <= MAX_COLUMNS) next.columns = columns
  else delete next.columns
  return next
}

/** grid columns a widget spans */
export const spanOf = (size: WidgetSize, columns: number): number =>
  size === 'full' ? columns : size === 'wide' ? Math.min(2, columns) : 1

/** next size for the resize button; „wide“ only exists with more than two columns */
export function nextSize(size: WidgetSize, columns: number): WidgetSize {
  if (size === 'half') return columns > 2 ? 'wide' : 'full'
  if (size === 'wide') return 'full'
  return 'half'
}

/** full order of the registered widgets: arranged ones first, then new ones in registry order */
export function orderedIds(widgets: WidgetMeta[], layout: Partial<OverviewLayout> | undefined): string[] {
  const known = new Set(widgets.map((w) => w.id))
  const arranged = clean(layout).order.filter((id, i, a) => known.has(id) && a.indexOf(id) === i)
  const seen = new Set(arranged)
  return [...arranged, ...widgets.filter((w) => !seen.has(w.id)).map((w) => w.id)]
}

export function resolveLayout(widgets: WidgetMeta[], layout: Partial<OverviewLayout> | undefined): ResolvedLayout {
  const l = clean(layout)
  const byId = new Map(widgets.map((w) => [w.id, w]))
  const arranged = new Set(l.order)
  const hidden = new Set(l.hidden)
  const isHidden = (w: WidgetMeta): boolean => hidden.has(w.id) || (!!w.defaultHidden && !arranged.has(w.id))
  const out: ResolvedLayout = { visible: [], hidden: [] }
  for (const id of orderedIds(widgets, l)) {
    const w = byId.get(id)!
    if (isHidden(w)) out.hidden.push(id)
    else out.visible.push({ id, size: SIZES.has(l.sizes[id]) ? l.sizes[id] : w.size })
  }
  return out
}

/**
 * Every change writes the complete order (so defaultHidden widgets count as arranged from then on)
 * and keeps the user's choices for widgets that are not registered right now, e.g. a disabled plugin.
 */
function commit(widgets: WidgetMeta[], layout: Partial<OverviewLayout> | undefined, order: string[]): OverviewLayout {
  const l = clean(layout)
  const known = new Set(widgets.map((w) => w.id))
  const hidden = new Set(l.hidden)
  // a defaultHidden widget that was never arranged stays hidden once it enters the order
  for (const w of widgets) if (w.defaultHidden && !l.order.includes(w.id)) hidden.add(w.id)
  const foreign = l.order.filter((id) => !known.has(id))
  return { order: [...order, ...foreign], hidden: [...hidden], sizes: { ...l.sizes }, ...(l.columns ? { columns: l.columns } : {}) }
}

/** move `id` to the position of `targetId` (before it when moving up, after it when moving down) */
export function moveWidget(
  widgets: WidgetMeta[],
  layout: Partial<OverviewLayout> | undefined,
  id: string,
  targetId: string
): OverviewLayout {
  const order = orderedIds(widgets, layout)
  const from = order.indexOf(id)
  const to = order.indexOf(targetId)
  if (from < 0 || to < 0 || from === to) return commit(widgets, layout, order)
  order.splice(from, 1)
  order.splice(to, 0, id)
  return commit(widgets, layout, order)
}

/** move one step among the visible widgets (-1 = earlier, 1 = later) */
export function stepWidget(
  widgets: WidgetMeta[],
  layout: Partial<OverviewLayout> | undefined,
  id: string,
  dir: -1 | 1
): OverviewLayout {
  const visible = resolveLayout(widgets, layout).visible.map((w) => w.id)
  const target = visible[visible.indexOf(id) + dir]
  return target ? moveWidget(widgets, layout, id, target) : commit(widgets, layout, orderedIds(widgets, layout))
}

export function setHidden(
  widgets: WidgetMeta[],
  layout: Partial<OverviewLayout> | undefined,
  id: string,
  hide: boolean
): OverviewLayout {
  const next = commit(widgets, layout, orderedIds(widgets, layout))
  next.hidden = hide ? [...new Set([...next.hidden, id])] : next.hidden.filter((h) => h !== id)
  return next
}

export function setSize(
  widgets: WidgetMeta[],
  layout: Partial<OverviewLayout> | undefined,
  id: string,
  size: WidgetSize
): OverviewLayout {
  const next = commit(widgets, layout, orderedIds(widgets, layout))
  const w = widgets.find((x) => x.id === id)
  const sizes = { ...next.sizes }
  if (w && w.size === size) delete sizes[id]
  else sizes[id] = size
  return { ...next, sizes }
}
