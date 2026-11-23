import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CheckSquare, Flag, Frame, Maximize, Minus, Plus, StickyNote } from 'lucide-react'
import { CALENDAR_COLORS, type Board, type BoardFrame, type BoardNote, type CalendarColor } from '@shared/types'
import { NOTE_W, borderPoint, boardBounds, boundsOf, contentOf, frameOf, freeSpot, noteHeight, noteRect, type Rect } from '@shared/board'
import { uid, useStore, type MenuItem } from '../../store'
import { calVar } from '../../lib/theme'
import { addNote, connect, moveItems, parentOf, patchFrame, patchNotes, removeItems } from '../../lib/board'

interface View {
  x: number
  y: number
  z: number
}

/** last view per board, so switching boards keeps the place */
const views = new Map<string, View>()
let lastColor: CalendarColor = 'yellow'

const COLOR_NAMES: Record<CalendarColor, string> = {
  red: 'Rot',
  blue: 'Blau',
  orange: 'Orange',
  aqua: 'Türkis',
  yellow: 'Gelb',
  violet: 'Violett',
  magenta: 'Magenta',
  green: 'Grün'
}

const Z_MIN = 0.25
const Z_MAX = 2.5
const clampZ = (z: number): number => Math.min(Z_MAX, Math.max(Z_MIN, z))

type Draft = { note: BoardNote; isNew: boolean; parentId?: string }
type Next = 'done' | 'child' | 'sibling' | 'blur'

type Drag =
  | { kind: 'move'; notes: string[]; frames: string[]; sx: number; sy: number; dx: number; dy: number; moved: boolean }
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; add: string[] }
  | { kind: 'connect'; from: string; x: number; y: number }
  | { kind: 'resize'; frame: string; sx: number; sy: number; w0: number; h0: number; w: number; h: number }

const isTextField = (el: EventTarget | null): boolean =>
  !!(el as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')

interface Props {
  board: Board
  /** extra buttons at the right end of the toolbar */
  actions?: React.ReactNode
}

export function BoardCanvas({ board, actions }: Props): React.JSX.Element {
  const editBoard = useStore((s) => s.editBoard)
  const openMenu = useStore((s) => s.openMenu)
  const todos = useStore((s) => s.data?.todos)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [view, setViewState] = useState<View>(() => views.get(board.id) ?? { x: 0, y: 0, z: 1 })
  const viewRef = useRef(view)
  const [sel, setSel] = useState<string[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [titleEdit, setTitleEdit] = useState<string | null>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)

  const setView = useCallback(
    (v: View) => {
      viewRef.current = v
      views.set(board.id, v)
      setViewState(v)
    },
    [board.id]
  )
  const setDrag = (d: Drag | null): void => {
    dragRef.current = d
    setDragState(d)
  }

  const edit = useCallback(
    (fn: (b: Board) => Board, label: string, coalesce?: string) => editBoard(board.id, fn, label, coalesce),
    [editBoard, board.id]
  )
  const current = (): Board => useStore.getState().data?.boards.find((b) => b.id === board.id) ?? board

  /* ── view ── */

  const fit = useCallback(() => {
    const el = viewportRef.current
    if (!el) return
    const { width: vw, height: vh } = el.getBoundingClientRect()
    const b = boardBounds(current())
    if (!b) return setView({ x: vw / 2 - NOTE_W / 2, y: vh / 3, z: 1 })
    const z = clampZ(Math.min(1, (vw - 120) / b.w, (vh - 120) / b.h))
    setView({ x: vw / 2 - (b.x + b.w / 2) * z, y: vh / 2 - (b.y + b.h / 2) * z, z })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setView, board.id])

  // first visit of a board: show everything
  useLayoutEffect(() => {
    const saved = views.get(board.id)
    let ro: ResizeObserver | null = null
    let stop: ReturnType<typeof setTimeout> | undefined
    if (saved) setView(saved)
    else {
      fit()
      // the page may still be settling into its layout: keep fitting for a moment
      const el = viewportRef.current
      if (el) {
        ro = new ResizeObserver(() => el.clientWidth > 0 && fit())
        ro.observe(el)
        stop = setTimeout(() => ro?.disconnect(), 600)
      }
    }
    setSel([])
    setDraft(null)
    setTitleEdit(null)
    return () => {
      ro?.disconnect()
      clearTimeout(stop)
    }
  }, [board.id, fit, setView])

  const zoomAt = (factor: number, cx?: number, cy?: number): void => {
    const el = viewportRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = cx ?? r.width / 2
    const py = cy ?? r.height / 2
    const v = viewRef.current
    const z = clampZ(v.z * factor)
    setView({ z, x: px - ((px - v.x) / v.z) * z, y: py - ((py - v.y) / v.z) * z })
  }

  // wheel: pan, Ctrl/pinch: zoom (needs a non-passive listener)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const v = viewRef.current
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect()
        zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
      } else if (e.shiftKey) setView({ ...v, x: v.x - e.deltaY })
      else setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setView])

  /** screen → board coordinates */
  const toBoard = (clientX: number, clientY: number): { x: number; y: number } => {
    const r = viewportRef.current!.getBoundingClientRect()
    const v = viewRef.current
    return { x: (clientX - r.left - v.x) / v.z, y: (clientY - r.top - v.y) / v.z }
  }
  const viewCenter = (): { x: number; y: number } => {
    const r = viewportRef.current!.getBoundingClientRect()
    return toBoard(r.left + r.width / 2, r.top + r.height / 2)
  }

  /* ── notes ── */

  const startDraft = (x: number, y: number, color?: CalendarColor, parentId?: string): void => {
    const b = current()
    const spot = freeSpot(b.notes, x, y)
    const inFrame = frameOf({ x: spot.x, y: spot.y, w: NOTE_W } as BoardNote, b.frames)
    setDraft({
      isNew: true,
      parentId,
      note: { id: uid(), x: spot.x, y: spot.y, w: NOTE_W, text: '', votes: 0, color: color ?? inFrame?.color ?? lastColor }
    })
    setSel([])
  }

  const commitNote = (d: Draft, raw: string, next: Next): void => {
    const text = raw.replace(/\s+$/, '')
    let id: string | null = null
    if (d.isNew) {
      if (text.trim()) {
        edit((b) => addNote(b, { ...d.note, text }, d.parentId, uid()), 'Zettel angelegt')
        id = d.note.id
      }
    } else {
      if (text !== d.note.text) edit((b) => patchNotes(b, [d.note.id], { text }), 'Zettel bearbeitet')
      id = d.note.id
    }
    setDraft(null)
    if (next === 'blur') return
    setSel(id ? [id] : [])
    if (!id || next === 'done') return
    const base = { ...d.note, text }
    if (next === 'child') startDraft(base.x + base.w + 64, base.y, base.color, id)
    else startDraft(base.x, base.y + noteHeight(base) + 16, base.color, d.parentId ?? parentOf(current(), id))
  }

  const editNote = (n: BoardNote): void => {
    setDraft({ note: n, isNew: false })
    setSel([n.id])
  }

  const addVote = (n: BoardNote, delta: 1 | -1): void =>
    edit((b) => patchNotes(b, [n.id], (x) => ({ votes: Math.max(0, x.votes + delta) })), delta > 0 ? 'Punkt vergeben' : 'Punkt entfernt', `vote:${n.id}`)

  const setColor = (ids: string[], color: CalendarColor): void => {
    lastColor = color
    edit((b) => {
      const frames = new Set(ids.filter((id) => b.frames.some((f) => f.id === id)))
      const nb = patchNotes(b, ids, { color })
      return { ...nb, frames: nb.frames.map((f) => (frames.has(f.id) ? { ...f, color } : f)) }
    }, 'Farbe geändert')
  }

  const deleteSel = (ids = sel): void => {
    if (!ids.length) return
    edit((b) => removeItems(b, ids), ids.length > 1 ? `${ids.length} Elemente entfernt` : 'Entfernt')
    setSel([])
  }

  const duplicate = (ids = sel): void => {
    const b = current()
    const copies = b.notes.filter((n) => ids.includes(n.id)).map((n) => ({ ...n, id: uid(), x: n.x + 24, y: n.y + 24, todoId: undefined }))
    if (!copies.length) return
    edit((x) => ({ ...x, notes: [...x.notes, ...copies] }), 'Zettel dupliziert')
    setSel(copies.map((c) => c.id))
  }

  /** frame around the selected notes, or an empty one in the middle of the view */
  const addFrame = (): void => {
    const b = current()
    const rects = b.notes.filter((n) => sel.includes(n.id)).map(noteRect)
    const around = boundsOf(rects, 28)
    const c = viewCenter()
    const r: Rect = around ? { ...around, y: around.y - 24, h: around.h + 24 } : { x: c.x - 260, y: c.y - 170, w: 520, h: 340 }
    const frame: BoardFrame = { id: uid(), ...r, title: '', color: rects.length ? b.notes.find((n) => n.id === sel[0])!.color : lastColor }
    // behind everything that is already there
    edit((x) => ({ ...x, frames: [frame, ...x.frames] }), 'Rahmen angelegt')
    setSel([frame.id])
    setTitleEdit(frame.id)
  }

  /* ── pointer handling ── */

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d) return
      const z = viewRef.current.z
      if (d.kind === 'pan') {
        const moved = d.moved || Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 3
        setView({ ...viewRef.current, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy })
        if (moved !== d.moved) setDrag({ ...d, moved })
      } else if (d.kind === 'move') {
        const dx = (e.clientX - d.sx) / z
        const dy = (e.clientY - d.sy) / z
        setDrag({ ...d, dx, dy, moved: d.moved || Math.abs(dx) + Math.abs(dy) > 3 / z })
      } else if (d.kind === 'marquee') {
        const p = toBoard(e.clientX, e.clientY)
        setDrag({ ...d, x1: p.x, y1: p.y })
      } else if (d.kind === 'connect') {
        const p = toBoard(e.clientX, e.clientY)
        setDrag({ ...d, x: p.x, y: p.y })
      } else if (d.kind === 'resize') {
        setDrag({ ...d, w: Math.max(160, d.w0 + (e.clientX - d.sx) / z), h: Math.max(120, d.h0 + (e.clientY - d.sy) / z) })
      }
    }
    const onUp = (e: PointerEvent): void => {
      const d = dragRef.current
      setDrag(null)
      if (!d) return
      if (d.kind === 'pan' && !d.moved) {
        setSel([])
      } else if (d.kind === 'move' && d.moved) {
        edit((b) => moveItems(b, d.notes, d.frames, d.dx, d.dy), 'Verschoben')
      } else if (d.kind === 'marquee') {
        const r = { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) }
        const b = current()
        const hit = (o: Rect): boolean => o.x < r.x + r.w && r.x < o.x + o.w && o.y < r.y + r.h && r.y < o.y + o.h
        const ids = b.notes.filter((n) => hit(noteRect(n))).map((n) => n.id)
        const frames = b.frames.filter((f) => f.x >= r.x && f.y >= r.y && f.x + f.w <= r.x + r.w && f.y + f.h <= r.y + r.h).map((f) => f.id)
        setSel([...new Set([...d.add, ...ids, ...frames])])
      } else if (d.kind === 'connect') {
        const target = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-note]')
        const to = target?.dataset.note
        if (to && to !== d.from) edit((b) => connect(b, d.from, to, uid()), 'Verbunden')
        else if (!to) {
          // dropped on empty space: new connected note there
          const from = current().notes.find((n) => n.id === d.from)
          startDraft(d.x - NOTE_W / 2, d.y - 24, from?.color, d.from)
        }
      } else if (d.kind === 'resize') {
        edit((b) => patchFrame(b, d.frame, { w: d.w, h: d.h }), 'Rahmengröße geändert')
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag !== null])

  const onBackgroundDown = (e: React.PointerEvent): void => {
    if (e.button === 2) return
    if ((e.target as HTMLElement).closest('.bn, .bf-head, .bf-resize, .be-hit, .board-toolbar, .board-hint')) return
    if (e.shiftKey && e.button === 0) {
      const p = toBoard(e.clientX, e.clientY)
      setDrag({ kind: 'marquee', x0: p.x, y0: p.y, x1: p.x, y1: p.y, add: sel })
    } else {
      const v = viewRef.current
      setDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false })
    }
  }

  const onBackgroundDouble = (e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('.bn, .bf-head, .board-toolbar, .board-hint')) return
    const p = toBoard(e.clientX, e.clientY)
    startDraft(p.x - NOTE_W / 2, p.y - 24)
  }

  const startMove = (e: React.PointerEvent, id: string): void => {
    if (e.button !== 0) return
    e.stopPropagation()
    const b = current()
    let ids = sel.includes(id) ? sel : [id]
    if (e.shiftKey) ids = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]
    setSel(ids)
    if (e.shiftKey) return
    const frames = ids.filter((x) => b.frames.some((f) => f.id === x))
    const notes = new Set(ids.filter((x) => b.notes.some((n) => n.id === x)))
    const frameSet = new Set(frames)
    for (const fid of frames) {
      const c = contentOf(b.frames.find((f) => f.id === fid)!, b)
      c.notes.forEach((n) => notes.add(n))
      c.frames.forEach((f) => frameSet.add(f))
    }
    setDrag({ kind: 'move', notes: [...notes], frames: [...frameSet], sx: e.clientX, sy: e.clientY, dx: 0, dy: 0, moved: false })
  }

  /* ── menus ── */

  const colorItems = (ids: string[], currentColor?: CalendarColor): MenuItem[] =>
    CALENDAR_COLORS.map((c) => ({ label: COLOR_NAMES[c], swatch: calVar(c), checked: c === currentColor, action: () => setColor(ids, c) }))

  const noteMenu = (e: React.MouseEvent, n: BoardNote): void => {
    e.preventDefault()
    e.stopPropagation()
    const ids = sel.includes(n.id) ? sel : [n.id]
    if (!sel.includes(n.id)) setSel([n.id])
    const st = useStore.getState()
    const todo = n.todoId ? todos?.find((t) => t.id === n.todoId) : undefined
    const items: MenuItem[] = [
      { label: 'Bearbeiten', hint: 'Enter', action: () => editNote(n) },
      { label: 'Farbe', items: colorItems(ids, n.color) },
      { separator: true },
      { label: 'Punkt vergeben', action: () => addVote(n, 1) },
      ...(n.votes ? [{ label: 'Punkte zurücksetzen', action: () => edit((b) => patchNotes(b, ids, { votes: 0 }), 'Punkte zurückgesetzt') }] : []),
      {
        label: 'Nächster Schritt',
        checked: !!n.action,
        action: () => edit((b) => patchNotes(b, ids, { action: !n.action }), n.action ? 'Kein nächster Schritt mehr' : 'Als nächster Schritt markiert')
      },
      { separator: true },
      todo
        ? { label: 'ToDo öffnen', action: () => st.selectTodo(todo.id) }
        : { label: 'Als ToDo übernehmen', action: () => st.noteToTodo(board.id, n.id) },
      { label: 'Als Termin planen …', action: () => st.openAdd('event', n.text.split('\n')[0]) },
      { separator: true },
      ...(ids.length > 1 ? [{ label: 'In Rahmen fassen', hint: 'G', action: addFrame }] : []),
      { label: 'Duplizieren', hint: 'Strg+D', action: () => duplicate(ids) },
      { label: ids.length > 1 ? `${ids.length} Zettel löschen` : 'Löschen', hint: 'Entf', danger: true, action: () => deleteSel(ids) }
    ]
    openMenu(e.clientX, e.clientY, items)
  }

  const frameMenu = (e: React.MouseEvent, f: BoardFrame): void => {
    e.preventDefault()
    e.stopPropagation()
    setSel([f.id])
    const inner = contentOf(f, current())
    openMenu(e.clientX, e.clientY, [
      { label: 'Umbenennen', action: () => setTitleEdit(f.id) },
      { label: 'Farbe', items: colorItems([f.id], f.color) },
      { separator: true },
      { label: 'Rahmen entfernen (Zettel bleiben)', action: () => deleteSel([f.id]) },
      ...(inner.notes.length
        ? [{ label: `Rahmen mit ${inner.notes.length} Zetteln löschen`, danger: true, action: () => deleteSel([f.id, ...inner.notes, ...inner.frames]) }]
        : [])
    ])
  }

  const backgroundMenu = (e: React.MouseEvent): void => {
    if ((e.target as HTMLElement).closest('.bn, .bf-head, .board-toolbar')) return
    e.preventDefault()
    const p = toBoard(e.clientX, e.clientY)
    openMenu(e.clientX, e.clientY, [
      { label: 'Neuer Zettel hier', hint: 'Doppelklick', action: () => startDraft(p.x - NOTE_W / 2, p.y - 24) },
      { label: 'Neuer Rahmen', hint: 'G', action: addFrame },
      { separator: true },
      { label: 'Alles zeigen', hint: '0', action: fit }
    ])
  }

  /* ── keyboard ── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const st = useStore.getState()
      if (st.overlay || st.contextMenu || draft || titleEdit || isTextField(e.target)) return
      const b = current()
      const k = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      const one = sel.length === 1 ? b.notes.find((n) => n.id === sel[0]) : undefined
      const run = (fn: () => void): void => {
        e.preventDefault()
        fn()
      }
      if (mod && k === 'a') return run(() => setSel(b.notes.map((n) => n.id)))
      if (mod && k === 'd') return run(() => duplicate())
      if (mod || e.altKey) return
      if (k === 'delete' || k === 'backspace') return sel.length ? run(() => deleteSel()) : undefined
      if (k === 'escape' && sel.length) return run(() => setSel([]))
      if (k === 'enter' && one) return run(() => editNote(one))
      if (k === 'enter' && sel.length === 1 && b.frames.some((f) => f.id === sel[0])) return run(() => setTitleEdit(sel[0]))
      if (k === 'tab' && one) {
        return run(() =>
          e.shiftKey
            ? startDraft(one.x + one.w + 64, one.y, one.color, one.id)
            : startDraft(one.x, one.y + noteHeight(one) + 16, one.color, parentOf(b, one.id))
        )
      }
      if (k === 'n' || (k === 'enter' && !sel.length)) {
        const c = viewCenter()
        return run(() => startDraft(c.x - NOTE_W / 2, c.y - 40))
      }
      if (k === 'g') return run(addFrame)
      if (k === '+' || k === '=') return run(() => zoomAt(1.2))
      if (k === '-') return run(() => zoomAt(1 / 1.2))
      if (k === '0') return run(fit)
      if (k.startsWith('arrow') && sel.length) {
        const step = e.shiftKey ? 40 : 10
        const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0
        const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0
        return run(() =>
          edit((x) => moveItems(x, sel.filter((id) => x.notes.some((n) => n.id === id)), sel.filter((id) => x.frames.some((f) => f.id === id)), dx, dy), 'Verschoben', 'nudge')
        )
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ── render ── */

  const moving = drag?.kind === 'move' && drag.moved ? drag : null
  const movedNotes = new Set(moving?.notes)
  const movedFrames = new Set(moving?.frames)
  const posNote = (n: BoardNote): BoardNote => (movedNotes.has(n.id) ? { ...n, x: n.x + moving!.dx, y: n.y + moving!.dy } : n)
  const posFrame = (f: BoardFrame): BoardFrame => {
    let r = movedFrames.has(f.id) ? { ...f, x: f.x + moving!.dx, y: f.y + moving!.dy } : f
    if (drag?.kind === 'resize' && drag.frame === f.id) r = { ...r, w: drag.w, h: drag.h }
    return r
  }
  const shown = board.notes.map((n) => (draft && !draft.isNew && draft.note.id === n.id ? n : posNote(n)))
  const rectById = new Map(shown.map((n) => [n.id, noteRect(n)]))
  if (draft?.isNew) rectById.set(draft.note.id, noteRect(draft.note))

  const empty = !board.notes.length && !board.frames.length && !draft
  const grid = 24 * view.z

  return (
    <div className="board">
      <div className="board-toolbar">
        <button className="btn btn-ghost sm" onClick={() => { const c = viewCenter(); startDraft(c.x - NOTE_W / 2, c.y - 40) }} title="Neuer Zettel (N oder Doppelklick)">
          <StickyNote size={15} /> Zettel
        </button>
        <button className="btn btn-ghost sm" onClick={addFrame} title={sel.length ? 'Auswahl in Rahmen fassen (G)' : 'Neuer Rahmen (G)'}>
          <Frame size={15} /> Rahmen
        </button>
        <div className="board-zoom">
          <button className="icon-btn" onClick={() => zoomAt(1 / 1.2)} title="Verkleinern (−)">
            <Minus size={15} />
          </button>
          <button className="board-zoom-val" onClick={() => setView({ ...viewRef.current, z: 1 })} title="Auf 100 % setzen">
            {Math.round(view.z * 100)} %
          </button>
          <button className="icon-btn" onClick={() => zoomAt(1.2)} title="Vergrößern (+)">
            <Plus size={15} />
          </button>
          <button className="icon-btn" onClick={fit} title="Alles zeigen (0)">
            <Maximize size={15} />
          </button>
        </div>
        <div className="board-toolbar-spacer" />
        {actions}
      </div>

      <div
        ref={viewportRef}
        className={`board-viewport ${drag?.kind === 'pan' && drag.moved ? 'panning' : ''}`}
        style={{ backgroundSize: `${grid}px ${grid}px`, backgroundPosition: `${view.x}px ${view.y}px` }}
        onPointerDown={onBackgroundDown}
        onDoubleClick={onBackgroundDouble}
        onContextMenu={backgroundMenu}
        // focus can still scroll an overflow:hidden box; keep it at 0 so coordinates stay right
        onScroll={(e) => {
          e.currentTarget.scrollTop = 0
          e.currentTarget.scrollLeft = 0
        }}
      >
        <div className="board-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          {board.frames.map((f0) => {
            const f = posFrame(f0)
            return (
              <div
                key={f.id}
                className={`bf ${sel.includes(f.id) ? 'selected' : ''}`}
                style={{ left: f.x, top: f.y, width: f.w, height: f.h, ['--tone' as string]: calVar(f.color) }}
              >
                <div
                  className="bf-head"
                  onPointerDown={(e) => titleEdit !== f.id && startMove(e, f.id)}
                  onDoubleClick={() => setTitleEdit(f.id)}
                  onContextMenu={(e) => frameMenu(e, f0)}
                >
                  {titleEdit === f.id ? (
                    <FrameTitle
                      value={f.title}
                      onDone={(title) => {
                        if (title !== f.title) edit((b) => patchFrame(b, f.id, { title }), 'Rahmen umbenannt')
                        setTitleEdit(null)
                      }}
                    />
                  ) : (
                    <span className={f.title ? '' : 'bf-untitled'}>{f.title || 'Rahmen ohne Titel'}</span>
                  )}
                </div>
                <div
                  className="bf-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setDrag({ kind: 'resize', frame: f.id, sx: e.clientX, sy: e.clientY, w0: f.w, h0: f.h, w: f.w, h: f.h })
                  }}
                />
              </div>
            )
          })}

          <svg className="be-layer" width="1" height="1">
            <defs>
              <marker id="be-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
              </marker>
            </defs>
            {board.edges.map((e) => {
              const a = rectById.get(e.from)
              const b = rectById.get(e.to)
              if (!a || !b) return null
              const p1 = borderPoint(a, b.x + b.w / 2, b.y + b.h / 2)
              const p2 = borderPoint(b, a.x + a.w / 2, a.y + a.h / 2)
              const d = `M${p1.x},${p1.y} L${p2.x},${p2.y}`
              return (
                <g key={e.id} className={`be ${sel.includes(e.id) ? 'selected' : ''}`}>
                  <path className="be-line" d={d} markerEnd="url(#be-arrow)" />
                  <path
                    className="be-hit"
                    d={d}
                    onPointerDown={(ev) => {
                      ev.stopPropagation()
                      setSel([e.id])
                    }}
                    onContextMenu={(ev) => {
                      ev.preventDefault()
                      ev.stopPropagation()
                      setSel([e.id])
                      openMenu(ev.clientX, ev.clientY, [{ label: 'Verbindung löschen', hint: 'Entf', danger: true, action: () => deleteSel([e.id]) }])
                    }}
                  />
                </g>
              )
            })}
            {draft?.isNew && draft.parentId && rectById.get(draft.parentId) && (() => {
              const a = rectById.get(draft.parentId)!
              const b = rectById.get(draft.note.id)!
              const p1 = borderPoint(a, b.x + b.w / 2, b.y + b.h / 2)
              const p2 = borderPoint(b, a.x + a.w / 2, a.y + a.h / 2)
              return <path className="be-line pending" d={`M${p1.x},${p1.y} L${p2.x},${p2.y}`} markerEnd="url(#be-arrow)" />
            })()}
            {drag?.kind === 'connect' && rectById.get(drag.from) && (() => {
              const a = rectById.get(drag.from)!
              const p1 = borderPoint(a, drag.x, drag.y)
              return <path className="be-line pending" d={`M${p1.x},${p1.y} L${drag.x},${drag.y}`} markerEnd="url(#be-arrow)" />
            })()}
          </svg>

          {shown.map((n) => {
            const editing = draft && !draft.isNew && draft.note.id === n.id
            const todo = n.todoId ? todos?.find((t) => t.id === n.todoId) : undefined
            return (
              <div
                key={n.id}
                data-note={n.id}
                className={`bn ${sel.includes(n.id) ? 'selected' : ''} ${editing ? 'editing' : ''} ${movedNotes.has(n.id) ? 'dragging' : ''}`}
                style={{ left: n.x, top: n.y, width: n.w, minHeight: noteHeight(n), ['--tone' as string]: calVar(n.color) }}
                onPointerDown={(e) => !editing && startMove(e, n.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  editNote(n)
                }}
                onContextMenu={(e) => noteMenu(e, n)}
              >
                {editing ? (
                  <NoteEditor initial={n.text} onDone={(text, next) => commitNote(draft, text, next)} />
                ) : (
                  <div className="bn-text">{n.text || <span className="bn-ph">Leerer Zettel</span>}</div>
                )}
                <NoteFoot note={n} todoDone={todo?.done} hasTodo={!!todo} onVote={(d) => addVote(n, d)} onTodo={() => todo && useStore.getState().selectTodo(todo.id)} />
                <div
                  className="bn-connect"
                  title="Ziehen, um zu verbinden – auf freier Fläche loslassen für einen neuen Zettel"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    const p = toBoard(e.clientX, e.clientY)
                    setDrag({ kind: 'connect', from: n.id, x: p.x, y: p.y })
                  }}
                />
              </div>
            )
          })}

          {draft?.isNew && (
            <div
              className="bn editing"
              data-note={draft.note.id}
              style={{ left: draft.note.x, top: draft.note.y, width: draft.note.w, minHeight: noteHeight(draft.note), ['--tone' as string]: calVar(draft.note.color) }}
            >
              <NoteEditor key={draft.note.id} initial="" onDone={(text, next) => commitNote(draft, text, next)} />
            </div>
          )}

          {drag?.kind === 'marquee' && (
            <div
              className="board-marquee"
              style={{
                left: Math.min(drag.x0, drag.x1),
                top: Math.min(drag.y0, drag.y1),
                width: Math.abs(drag.x1 - drag.x0),
                height: Math.abs(drag.y1 - drag.y0)
              }}
            />
          )}
        </div>

        {empty && (
          <div className="board-hint">
            <StickyNote size={28} strokeWidth={1.5} />
            <p>
              <strong>Doppelklick</strong> irgendwo legt einen Zettel an.
            </p>
            <p className="muted">
              Beim Schreiben: <kbd>Enter</kbd> verbundener Zettel · <kbd>Tab</kbd> Zettel darunter · <kbd>Esc</kbd> fertig
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function NoteEditor({ initial, onDone }: { initial: string; onDone: (text: string, next: Next) => void }): React.JSX.Element {
  const [text, setText] = useState(initial)
  const done = useRef(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // no scrolling: the viewport is positioned by its transform alone
    el.focus({ preventScroll: true })
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  // grow with the text
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }, [text])
  const finish = (next: Next): void => {
    if (done.current) return
    done.current = true
    onDone(text, next)
  }
  return (
    <textarea
      ref={ref}
      className="bn-input"
      value={text}
      placeholder="Idee …"
      rows={1}
      onChange={(e) => setText(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish('blur')}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          finish('done')
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          finish('done')
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          finish('child')
        } else if (e.key === 'Tab') {
          e.preventDefault()
          finish('sibling')
        }
      }}
    />
  )
}

function FrameTitle({ value, onDone }: { value: string; onDone: (v: string) => void }): React.JSX.Element {
  const [text, setText] = useState(value)
  const done = useRef(false)
  const finish = (v: string): void => {
    if (done.current) return
    done.current = true
    onDone(v.trim())
  }
  return (
    <input
      className="bf-input"
      ref={(el) => {
        if (el && !el.dataset.focused) {
          el.dataset.focused = '1'
          el.focus({ preventScroll: true })
        }
      }}
      value={text}
      placeholder="Titel des Rahmens"
      onChange={(e) => setText(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onFocus={(e) => e.target.select()}
      onBlur={() => finish(text)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') finish(text)
        if (e.key === 'Escape') finish(value)
      }}
    />
  )
}

function NoteFoot({
  note,
  hasTodo,
  todoDone,
  onVote,
  onTodo
}: {
  note: BoardNote
  hasTodo: boolean
  todoDone?: boolean
  onVote: (d: 1 | -1) => void
  onTodo: () => void
}): React.JSX.Element {
  const stop = (e: React.PointerEvent): void => e.stopPropagation()
  return (
    <div className="bn-foot">
      {note.votes > 0 && (
        <button className="bn-votes" onPointerDown={stop} onClick={() => onVote(-1)} title="Punkt entfernen">
          {Array.from({ length: Math.min(note.votes, 8) }, (_, i) => (
            <i key={i} />
          ))}
          {note.votes > 8 && <span>+{note.votes - 8}</span>}
        </button>
      )}
      <button className="bn-vote-add" onPointerDown={stop} onClick={() => onVote(1)} title="Punkt vergeben">
        <Plus size={12} />
      </button>
      <span className="bn-foot-spacer" />
      {note.action && !hasTodo && (
        <span className="bn-flag" title="Nächster Schritt">
          <Flag size={12} />
        </span>
      )}
      {hasTodo && (
        <button className={`bn-todo ${todoDone ? 'done' : ''}`} onPointerDown={stop} onClick={onTodo} title={todoDone ? 'ToDo erledigt – öffnen' : 'ToDo öffnen'}>
          <CheckSquare size={13} />
        </button>
      )}
    </div>
  )
}
