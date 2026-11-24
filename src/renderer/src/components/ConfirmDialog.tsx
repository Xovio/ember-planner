import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '../store'

/** Asks before an action others will see and that can't be taken back. Esc cancels. */
export function ConfirmDialog(): React.JSX.Element | null {
  const confirm = useStore((s) => s.confirm)
  const ask = useStore((s) => s.askConfirm)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!confirm) return
    // the safe choice has the focus
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        ask(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [confirm, ask])
  if (!confirm) return null
  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && ask(null)}>
      <div className="confirm-dialog" role="alertdialog" aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <div className="confirm-head">
          <AlertTriangle size={18} />
          <h2 id="confirm-title">{confirm.title}</h2>
        </div>
        <p id="confirm-body">{confirm.body}</p>
        <div className="confirm-actions">
          <button ref={cancelRef} className="btn btn-ghost sm" onClick={() => ask(null)}>
            Abbrechen
          </button>
          <button
            className="btn btn-danger sm"
            onClick={() => {
              const action = confirm.action
              ask(null)
              action()
            }}
          >
            {confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
