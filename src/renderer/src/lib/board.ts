import type { Board, BoardFrame, BoardNote } from '@shared/types'

/* Pure board edits; the canvas wraps each in one undoable store change. */

export function addNote(b: Board, note: BoardNote, parentId?: string, edgeId?: string): Board {
  const edges = parentId && edgeId ? [...b.edges, { id: edgeId, from: parentId, to: note.id }] : b.edges
  return { ...b, notes: [...b.notes, note], edges }
}

export function patchNotes(b: Board, ids: string[], patch: Partial<BoardNote> | ((n: BoardNote) => Partial<BoardNote>)): Board {
  const set = new Set(ids)
  return { ...b, notes: b.notes.map((n) => (set.has(n.id) ? { ...n, ...(typeof patch === 'function' ? patch(n) : patch) } : n)) }
}

export function patchFrame(b: Board, id: string, patch: Partial<BoardFrame>): Board {
  return { ...b, frames: b.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)) }
}

/** removes notes, frames and arrows by id; arrows of removed notes go along */
export function removeItems(b: Board, ids: string[]): Board {
  const set = new Set(ids)
  const notes = b.notes.filter((n) => !set.has(n.id))
  const alive = new Set(notes.map((n) => n.id))
  return {
    ...b,
    notes,
    frames: b.frames.filter((f) => !set.has(f.id)),
    edges: b.edges.filter((e) => !set.has(e.id) && alive.has(e.from) && alive.has(e.to))
  }
}

export function moveItems(b: Board, noteIds: string[], frameIds: string[], dx: number, dy: number): Board {
  if (!dx && !dy) return b
  const ns = new Set(noteIds)
  const fs = new Set(frameIds)
  return {
    ...b,
    notes: b.notes.map((n) => (ns.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)),
    frames: b.frames.map((f) => (fs.has(f.id) ? { ...f, x: f.x + dx, y: f.y + dy } : f))
  }
}

export function connect(b: Board, from: string, to: string, id: string): Board {
  if (from === to || b.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from))) return b
  return { ...b, edges: [...b.edges, { id, from, to }] }
}

/** source of the first arrow pointing at a note */
export const parentOf = (b: Board, id: string): string | undefined => b.edges.find((e) => e.to === id)?.from
