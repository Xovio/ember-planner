import { useMemo, useState } from 'react'
import { Copy, FileDown, RotateCcw, X } from 'lucide-react'
import type { Board } from '@shared/types'
import { boardFileName, boardOutline, boardToCanvas, boardToMarkdown } from '@shared/board'
import { useStore } from '../../store'
import { api } from '../../lib/api'

const MD_FILTER = [{ name: 'Markdown', extensions: ['md'] }]
const CANVAS_FILTER = [{ name: 'Obsidian Canvas', extensions: ['canvas'] }]

/**
 * Right-hand panel: own conclusion, generated Obsidian note (editable before saving)
 * and export as .md with an optional .canvas next to it.
 */
export function BoardExport({ board, onClose }: { board: Board; onClose: () => void }): React.JSX.Element {
  const editBoard = useStore((s) => s.editBoard)
  const toast = useStore((s) => s.pushToast)
  const todos = useStore((s) => s.data?.todos)
  const [withCanvas, setWithCanvas] = useState(true)
  /** hand-edited preview; null = follows the board */
  const [override, setOverride] = useState<string | null>(null)

  const name = boardFileName(board.title)
  const generated = useMemo(
    () => boardToMarkdown(board, { todos, canvasFile: withCanvas ? `${name}.canvas` : undefined }),
    [board, todos, withCanvas, name]
  )
  const markdown = override ?? generated
  const outline = useMemo(() => boardOutline(board), [board])
  const ideaCount = board.notes.filter((n) => n.text.trim()).length
  const info = (title: string): void => toast({ kind: 'info', title })

  const save = async (): Promise<void> => {
    try {
      const extras = withCanvas ? [{ name: `${name}.canvas`, content: boardToCanvas(board) }] : []
      const path = await api.saveFile(`${name}.md`, markdown, MD_FILTER, extras)
      if (path) info(withCanvas ? 'Notiz und Canvas gespeichert' : 'Notiz gespeichert')
    } catch (err) {
      info(`Das hat nicht geklappt – ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const saveCanvas = async (): Promise<void> => {
    try {
      const path = await api.saveFile(`${name}.canvas`, boardToCanvas(board), CANVAS_FILTER)
      if (path) info('Canvas gespeichert')
    } catch (err) {
      info(`Das hat nicht geklappt – ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(markdown)
      info('Markdown kopiert')
    } catch {
      info('Kopieren ging nicht')
    }
  }

  return (
    <aside className="board-export" aria-label="Zusammenfassen und exportieren">
      <header className="board-export-head">
        <h2>Zusammenfassen</h2>
        <button className="icon-btn sm" onClick={onClose} title="Schließen">
          <X size={15} />
        </button>
      </header>

      <div className="board-export-body">
        <p className="board-export-stats muted">
          {ideaCount} {ideaCount === 1 ? 'Idee' : 'Ideen'}
          {outline.groups.some((g) => g.frame) && ` in ${outline.groups.filter((g) => g.frame).length} Gruppen`}
          {outline.actions.length > 0 && ` · ${outline.actions.length} nächste Schritte`}
        </p>

        <label className="board-export-label" htmlFor="board-summary">
          Fazit
          <span className="muted"> – deine Kernaussage, steht oben in der Notiz</span>
        </label>
        <textarea
          id="board-summary"
          className="input board-summary"
          placeholder="Was nehme ich aus diesem Brainstorm mit?"
          value={board.summary ?? ''}
          onChange={(e) => editBoard(board.id, (b) => ({ ...b, summary: e.target.value }), 'Fazit bearbeitet', 'summary')}
        />

        <div className="board-export-label row">
          <span>Vorschau (Markdown für Obsidian)</span>
          {override !== null && (
            <button className="link-btn" onClick={() => setOverride(null)} title="Eigene Änderungen verwerfen und neu aus dem Board erzeugen">
              <RotateCcw size={12} /> Neu erzeugen
            </button>
          )}
        </div>
        <textarea
          className="input board-preview"
          spellCheck={false}
          value={markdown}
          onChange={(e) => setOverride(e.target.value)}
        />
        {override !== null && <p className="muted board-export-note">Angepasst – Änderungen am Board fließen erst nach „Neu erzeugen“ ein.</p>}

        <label className="board-export-check">
          <input type="checkbox" checked={withCanvas} onChange={(e) => setWithCanvas(e.target.checked)} />
          <span>
            Board als <code>.canvas</code> daneben speichern und in der Notiz einbetten
          </span>
        </label>
      </div>

      <footer className="board-export-foot">
        <button className="btn btn-primary" onClick={() => void save()} disabled={!ideaCount}>
          <FileDown size={15} /> Als Notiz speichern …
        </button>
        <div className="board-export-row">
          <button className="btn btn-ghost sm" onClick={() => void copy()} disabled={!ideaCount}>
            <Copy size={14} /> Kopieren
          </button>
          <button className="btn btn-ghost sm" onClick={() => void saveCanvas()} disabled={!board.notes.length}>
            Nur .canvas …
          </button>
        </div>
      </footer>
    </aside>
  )
}
