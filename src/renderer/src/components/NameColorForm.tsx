import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { CALENDAR_COLORS, type CalendarColor } from '@shared/types'
import { COLOR_NAMES, calVar } from '../lib/theme'

/** Inline form for anything with a name + palette color (lists, categories). */
export function NameColorForm({
  name: initialName,
  color: initialColor,
  placeholder,
  onSave,
  onCancel,
  onDelete,
  deleteConfirm
}: {
  name: string
  color: CalendarColor
  placeholder: string
  onSave: (name: string, color: CalendarColor) => void
  onCancel: () => void
  onDelete?: () => void
  deleteConfirm?: string
}): React.JSX.Element {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState<CalendarColor>(initialColor)
  const save = (): void => (name.trim() ? onSave(name.trim(), color) : onCancel())

  return (
    <div className="cal-form">
      <input
        autoFocus
        className="input sm"
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className="swatches">
        {CALENDAR_COLORS.map((c) => (
          <button
            key={c}
            className={`swatch ${c === color ? 'on' : ''}`}
            style={{ '--c': calVar(c) } as React.CSSProperties}
            onClick={() => setColor(c)}
            title={COLOR_NAMES[c]}
            aria-label={COLOR_NAMES[c]}
          />
        ))}
      </div>
      <div className="cal-form-actions">
        {onDelete && (
          <button
            className="icon-btn sm danger"
            title="Löschen"
            onClick={() => {
              if (!deleteConfirm || confirm(deleteConfirm)) onDelete()
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost sm" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn btn-primary sm" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  )
}
