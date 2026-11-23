import { BellRing, Flag, Undo2, X } from 'lucide-react'
import { useStore } from '../store'

export function Toasts(): React.JSX.Element | null {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  const selectEvent = useStore((s) => s.selectEvent)
  const selectTodo = useStore((s) => s.selectTodo)
  const setPage = useStore((s) => s.setPage)
  const undo = useStore((s) => s.undo)
  if (toasts.length === 0) return null

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) =>
        t.kind === 'undo' || t.kind === 'info' ? (
          <div key={t.id} className={`toast toast-slim toast-${t.kind}`}>
            <span className="toast-slim-text">{t.title}</span>
            {t.kind === 'undo' && (
              <button
                className="toast-undo"
                onClick={() => {
                  dismiss(t.id)
                  undo()
                }}
              >
                <Undo2 size={14} /> Rückgängig <kbd>Strg Z</kbd>
              </button>
            )}
            <button className="icon-btn sm" onClick={() => dismiss(t.id)} aria-label="Schließen">
              <X size={14} />
            </button>
          </div>
        ) : (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <div className="toast-icon">{t.kind === 'deadline' ? <Flag size={18} /> : <BellRing size={18} />}</div>
            <div className="toast-text">
              <strong>{t.title}</strong>
              {t.body && <span>{t.body}</span>}
              {t.eventId && (
                <button
                  className="link-btn"
                  onClick={() => {
                    setPage('plan')
                    selectEvent(t.eventId!)
                    dismiss(t.id)
                  }}
                >
                  Termin öffnen
                </button>
              )}
              {t.todoId && (
                <button
                  className="link-btn"
                  onClick={() => {
                    selectTodo(t.todoId!)
                    dismiss(t.id)
                  }}
                >
                  ToDo öffnen
                </button>
              )}
            </div>
            <button className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Schließen">
              <X size={16} />
            </button>
          </div>
        )
      )}
    </div>
  )
}
