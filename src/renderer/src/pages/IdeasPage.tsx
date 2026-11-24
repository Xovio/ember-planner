import { useEffect, useState } from 'react'
import { Lightbulb, NotebookPen, Plus } from 'lucide-react'
import { useStore } from '../store'
import { fmt } from '../lib/dates'
import { BoardCanvas } from '../components/ideas/BoardCanvas'
import { BoardExport } from '../components/ideas/BoardExport'
import { RightPanel } from '../components/RightPanel'

/** Brainstorm boards: list on the left, canvas in the middle, summary/export or ToDo details on the right. */
export function IdeasPage(): React.JSX.Element {
  const boards = useStore((s) => s.data?.boards ?? [])
  const boardId = useStore((s) => s.boardId)
  const openBoard = useStore((s) => s.openBoard)
  const addBoard = useStore((s) => s.addBoard)
  const editBoard = useStore((s) => s.editBoard)
  const deleteBoard = useStore((s) => s.deleteBoard)
  const openMenu = useStore((s) => s.openMenu)
  const selection = useStore((s) => s.selection)
  const clearSelection = useStore((s) => s.clearSelection)
  const [exportOpen, setExportOpen] = useState(false)

  const board = boards.find((b) => b.id === boardId) ?? boards[0]

  // a selection from another page would open its details here
  useEffect(() => {
    clearSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const boardMenu = (e: React.MouseEvent, id: string): void => {
    e.preventDefault()
    openMenu(e.clientX, e.clientY, [
      { label: 'Öffnen', action: () => openBoard(id) },
      { label: 'Board löschen', danger: true, action: () => deleteBoard(id) }
    ])
  }

  return (
    <div className="ideas-page">
      <nav className="ideas-list" aria-label="Boards">
        <div className="ideas-list-head">
          <h2>Ideen</h2>
          <button className="icon-btn sm" onClick={() => addBoard()} title="Neues Board">
            <Plus size={16} />
          </button>
        </div>
        {boards.map((b) => (
          <button
            key={b.id}
            className={`ideas-item ${b.id === board?.id ? 'active' : ''}`}
            onClick={() => openBoard(b.id)}
            onContextMenu={(e) => boardMenu(e, b.id)}
          >
            <span className="ideas-item-title">{b.title || 'Ohne Titel'}</span>
            <span className="ideas-item-meta">
              {fmt(new Date(b.updatedAt), 'd. MMM')} · {b.notes.length} Zettel
            </span>
          </button>
        ))}
      </nav>

      {board ? (
        <div className="ideas-main">
          <BoardCanvas
            key={board.id}
            board={board}
            actions={
              <>
                <input
                  className="board-title"
                  value={board.title}
                  placeholder="Board ohne Titel"
                  onChange={(e) => editBoard(board.id, (b) => ({ ...b, title: e.target.value }), 'Board umbenannt', 'title')}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  aria-label="Titel des Boards"
                />
                <button
                  className={`btn sm ${exportOpen ? 'btn-outline' : 'btn-ghost'}`}
                  onClick={() => setExportOpen(!exportOpen)}
                  title="Zusammenfassen und als Markdown für Obsidian exportieren"
                >
                  <NotebookPen size={15} /> Zusammenfassen
                </button>
              </>
            }
          />
          {selection?.kind === 'todo' ? (
            <RightPanel tabs={false} />
          ) : (
            exportOpen && <BoardExport key={board.id} board={board} onClose={() => setExportOpen(false)} />
          )}
        </div>
      ) : (
        <div className="ideas-empty">
          <Lightbulb size={40} strokeWidth={1.4} />
          <h2>Platz für Ideen</h2>
          <p className="muted">
            Ein Board ist eine freie Fläche für Zettel, Gruppen und Verbindungen. Am Ende fasst du es zusammen und nimmst es als
            Notiz mit nach Obsidian.
          </p>
          <button className="btn btn-primary" onClick={() => addBoard()}>
            <Plus size={16} /> Erstes Board anlegen
          </button>
        </div>
      )}
    </div>
  )
}
