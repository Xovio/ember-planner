import { toTasksLine } from './todo'
import type { Board, BoardFrame, BoardNote, CalendarColor, Todo } from './types'

export const NOTE_W = 200
export const NOTE_MIN_H = 76
const LINE_H = 20
const CHAR_W = 7.4
const PAD = 12
const FOOTER = 22

/** estimated rendered height of a note (the UI uses the same as min-height, so both agree) */
export function noteHeight(n: Pick<BoardNote, 'text' | 'w'>): number {
  const perLine = Math.max(8, Math.floor((n.w - PAD * 2) / CHAR_W))
  const lines = (n.text || ' ').split('\n').reduce((sum, l) => sum + Math.max(1, Math.ceil(l.length / perLine)), 0)
  return Math.max(NOTE_MIN_H, lines * LINE_H + PAD * 2 + FOOTER)
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const noteRect = (n: BoardNote): Rect => ({ x: n.x, y: n.y, w: n.w, h: noteHeight(n) })

/** point that decides which frame a note belongs to: its top center */
const anchorOf = (n: BoardNote): { x: number; y: number } => ({ x: n.x + n.w / 2, y: n.y + 24 })

const inside = (p: { x: number; y: number }, r: Rect): boolean =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

/** innermost frame containing the note, if any */
export function frameOf(n: BoardNote, frames: BoardFrame[]): BoardFrame | undefined {
  const a = anchorOf(n)
  return frames.filter((f) => inside(a, f)).sort((p, q) => p.w * p.h - q.w * q.h)[0]
}

/** notes (and nested frames) that move along with a frame */
export function contentOf(frame: BoardFrame, board: Pick<Board, 'notes' | 'frames'>): { notes: string[]; frames: string[] } {
  return {
    notes: board.notes.filter((n) => inside(anchorOf(n), frame)).map((n) => n.id),
    frames: board.frames
      .filter((f) => f.id !== frame.id && f.x >= frame.x && f.y >= frame.y && f.x + f.w <= frame.x + frame.w && f.y + f.h <= frame.y + frame.h)
      .map((f) => f.id)
  }
}

/** bounding box of rectangles, grown by `pad` (null when empty) */
export function boundsOf(rects: Rect[], pad = 0): Rect | null {
  if (!rects.length) return null
  const x1 = Math.min(...rects.map((r) => r.x))
  const y1 = Math.min(...rects.map((r) => r.y))
  const x2 = Math.max(...rects.map((r) => r.x + r.w))
  const y2 = Math.max(...rects.map((r) => r.y + r.h))
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 }
}

export const boardBounds = (b: Pick<Board, 'notes' | 'frames'>): Rect | null =>
  boundsOf([...b.notes.map(noteRect), ...b.frames])

const overlaps = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** first free spot at (x, y) or below it, so a new note never hides another one */
export function freeSpot(notes: BoardNote[], x: number, y: number, w = NOTE_W, ignore?: string): { x: number; y: number } {
  const rects = notes.filter((n) => n.id !== ignore).map(noteRect)
  let top = y
  for (let i = 0; i < 50; i++) {
    const r = { x, y: top, w, h: NOTE_MIN_H }
    const hit = rects.find((o) => overlaps(r, o))
    if (!hit) return { x, y: top }
    top = hit.y + hit.h + 16
  }
  return { x, y: top }
}

/** point on the border of `r` in direction of (tx, ty) from its center – where an arrow starts/ends */
export function borderPoint(r: Rect, tx: number, ty: number): { x: number; y: number } {
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (!dx && !dy) return { x: cx, y: cy }
  const t = Math.min(dx ? r.w / 2 / Math.abs(dx) : Infinity, dy ? r.h / 2 / Math.abs(dy) : Infinity)
  return { x: cx + dx * t, y: cy + dy * t }
}

/* ───────────── Outline (structure → summary) ───────────── */

export interface OutlineItem {
  note: BoardNote
  children: OutlineItem[]
}

export interface OutlineGroup {
  /** null = notes outside any frame */
  frame: BoardFrame | null
  items: OutlineItem[]
}

export interface BoardOutline {
  groups: OutlineGroup[]
  /** notes marked as next step */
  actions: BoardNote[]
}

const byWeight = (a: BoardNote, b: BoardNote): number => b.votes - a.votes || a.y - b.y || a.x - b.x

/**
 * Turns the board into a tree: frames become groups (top to bottom, left to right),
 * arrows inside a group become nesting, votes decide the order.
 */
export function boardOutline(board: Board): BoardOutline {
  const notes = board.notes.filter((n) => n.text.trim())
  const actions = notes.filter((n) => n.action).sort(byWeight)
  const ideas = notes.filter((n) => !n.action)
  const frames = [...board.frames].sort((a, b) => a.y - b.y || a.x - b.x)
  const groupOf = new Map(ideas.map((n) => [n.id, frameOf(n, board.frames)?.id ?? null]))
  const ideaIds = new Set(ideas.map((n) => n.id))

  // first incoming arrow from a note of the same group = parent
  const parent = new Map<string, string>()
  for (const e of board.edges) {
    if (parent.has(e.to) || e.from === e.to || !ideaIds.has(e.from) || !ideaIds.has(e.to)) continue
    if (groupOf.get(e.from) !== groupOf.get(e.to)) continue
    // no cycles: walk up from the would-be parent
    let p: string | undefined = e.from
    let cycle = false
    while (p) {
      if (p === e.to) {
        cycle = true
        break
      }
      p = parent.get(p)
    }
    if (!cycle) parent.set(e.to, e.from)
  }

  const build = (n: BoardNote): OutlineItem => ({
    note: n,
    children: ideas.filter((c) => parent.get(c.id) === n.id).sort(byWeight).map(build)
  })
  const rootsIn = (frameId: string | null): OutlineItem[] =>
    ideas
      .filter((n) => groupOf.get(n.id) === frameId && !parent.has(n.id))
      .sort(byWeight)
      .map(build)

  const groups: OutlineGroup[] = frames.map((f) => ({ frame: f, items: rootsIn(f.id) })).filter((g) => g.items.length)
  const loose = rootsIn(null)
  if (loose.length) groups.push({ frame: null, items: loose })
  return { groups, actions }
}

/* ───────────── Markdown (Obsidian) ───────────── */

const votesText = (v: number): string => (v > 0 ? ` (${v} ${v === 1 ? 'Punkt' : 'Punkte'})` : '')

function bullets(items: OutlineItem[], depth = 0): string[] {
  const out: string[] = []
  const indent = '  '.repeat(depth)
  for (const it of items) {
    const [first, ...rest] = it.note.text.trim().split('\n')
    out.push(`${indent}- ${first.trim()}${votesText(it.note.votes)}`)
    for (const line of rest) if (line.trim()) out.push(`${indent}  ${line.trim()}`)
    out.push(...bullets(it.children, depth + 1))
  }
  return out
}

export const boardFileName = (title: string): string =>
  (title.trim() || 'Brainstorm').replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Brainstorm'

export interface MarkdownOptions {
  /** ToDos, so linked notes are written with their deadlines and done state */
  todos?: Todo[]
  /** file name of an exported .canvas to embed */
  canvasFile?: string
}

/**
 * Obsidian note: frontmatter, own conclusion, ideas by frame, next steps in Tasks format.
 * With a conclusion the ideas move into a collapsed callout so the note reads top-down.
 */
export function boardToMarkdown(board: Board, opts: MarkdownOptions = {}): string {
  const { groups, actions } = boardOutline(board)
  const title = board.title.trim() || 'Brainstorm'
  const summary = board.summary?.trim()
  const lines: string[] = ['---', `title: "${title.replace(/"/g, '\\"')}"`, `date: ${board.createdAt.slice(0, 10)}`, 'tags:', '  - brainstorm', '---', '', `# ${title}`, '']

  if (summary) lines.push('## Fazit', '', summary, '')

  const ideaLines: string[] = []
  const level = summary ? '###' : '##'
  for (const g of groups) {
    const heading = g.frame ? g.frame.title.trim() || 'Gruppe' : groups.length > 1 ? 'Weitere Ideen' : ''
    if (heading) ideaLines.push(`${level} ${heading}`, '')
    ideaLines.push(...bullets(g.items), '')
  }
  if (summary && ideaLines.length) {
    lines.push('> [!note]- Alle Ideen', ...ideaLines.map((l) => (l ? `> ${l}` : '>')))
    while (lines[lines.length - 1] === '>') lines.pop()
    lines.push('')
  } else lines.push(...ideaLines)

  if (actions.length) {
    lines.push('## Nächste Schritte', '')
    for (const a of actions) {
      const todo = a.todoId ? opts.todos?.find((t) => t.id === a.todoId) : undefined
      lines.push(todo ? toTasksLine(todo) : `- [ ] ${a.text.trim().replace(/\s*\n\s*/g, ' – ')}`)
    }
    lines.push('')
  }
  if (opts.canvasFile) lines.push('## Board', '', `![[${opts.canvasFile}]]`, '')
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/* ───────────── JSON Canvas (Obsidian .canvas) ───────────── */

/** Obsidian's preset colors 1–6; the rest as hex */
const CANVAS_COLOR: Record<CalendarColor, string> = {
  red: '1',
  orange: '2',
  yellow: '3',
  green: '4',
  aqua: '5',
  violet: '6',
  blue: '#3987e5',
  magenta: '#d55181'
}

/** JSON Canvas 1.0 (jsoncanvas.org): frames become groups, notes text nodes, arrows edges */
export function boardToCanvas(board: Board): string {
  const r = Math.round
  const nodes = [
    ...board.frames.map((f) => ({
      id: f.id,
      type: 'group',
      x: r(f.x),
      y: r(f.y),
      width: r(f.w),
      height: r(f.h),
      label: f.title,
      color: CANVAS_COLOR[f.color]
    })),
    ...board.notes.map((n) => ({
      id: n.id,
      type: 'text',
      x: r(n.x),
      y: r(n.y),
      width: r(n.w),
      height: r(noteHeight(n)),
      text: (n.action ? '- [ ] ' : '') + n.text + (n.votes ? `\n\n${'●'.repeat(Math.min(n.votes, 10))}` : ''),
      color: CANVAS_COLOR[n.color]
    }))
  ]
  const ids = new Set(board.notes.map((n) => n.id))
  const edges = board.edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({ id: e.id, fromNode: e.from, toNode: e.to, toEnd: 'arrow' }))
  return JSON.stringify({ nodes, edges }, null, '\t') + '\n'
}
