import { useState } from 'react'
import { Check, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { CALENDAR_COLORS, type CalendarColor, type CalendarInfo } from '@shared/types'
import { uid, useStore } from '../../store'
import { COLOR_NAMES, calVar } from '../../lib/theme'

export function CalendarList(): React.JSX.Element {
  const calendars = useStore((s) => s.data!.calendars)
  const toggle = useStore((s) => s.toggleCalendar)
  const showHolidays = useStore((s) => s.data!.settings.showHolidays)
  const region = useStore((s) => s.data!.settings.holidayRegion)
  const updateSettings = useStore((s) => s.updateSettings)
  const setPage = useStore((s) => s.setPage)
  const toggleHolidays = (): void => updateSettings({ showHolidays: !showHolidays })
  const [editing, setEditing] = useState<CalendarInfo | null>(null)

  return (
    <div className="callist">
      <div className="section-head">
        <span>Meine Kalender</span>
        <button
          className="icon-btn sm"
          aria-label="Kalender hinzufügen"
          title="Kalender hinzufügen"
          onClick={() =>
            setEditing({
              id: uid(),
              name: '',
              color: CALENDAR_COLORS[calendars.length % CALENDAR_COLORS.length],
              visible: true
            })
          }
        >
          <Plus size={16} />
        </button>
      </div>

      {calendars.map((c) =>
        editing?.id === c.id ? (
          <CalendarEditForm key={c.id} value={editing} onDone={() => setEditing(null)} />
        ) : (
          <div key={c.id} className="callist-row">
            <button
              className={`cal-check ${c.visible ? 'on' : ''}`}
              style={{ '--c': calVar(c.color) } as React.CSSProperties}
              onClick={() => toggle(c.id)}
              aria-pressed={c.visible}
              aria-label={`${c.name} ${c.visible ? 'ausblenden' : 'einblenden'}`}
            >
              {c.visible && <Check size={12} strokeWidth={3} />}
            </button>
            <span className="callist-name" onClick={() => toggle(c.id)}>
              {c.name}
            </span>
            <button className="icon-btn sm ghost-hover" onClick={() => setEditing(c)} aria-label="Bearbeiten">
              <Pencil size={13} />
            </button>
          </div>
        )
      )}

      {editing && !calendars.some((c) => c.id === editing.id) && (
        <CalendarEditForm value={editing} onDone={() => setEditing(null)} isNew />
      )}

      <div className="callist-row">
        <button
          className={`cal-check holiday-check ${showHolidays ? 'on' : ''}`}
          onClick={toggleHolidays}
          aria-pressed={showHolidays}
          aria-label={`Feiertage ${showHolidays ? 'ausblenden' : 'einblenden'}`}
        >
          {showHolidays && <Check size={12} strokeWidth={3} />}
        </button>
        <span className="callist-name" onClick={toggleHolidays}>
          Feiertage <span className="callist-region">{region.replace('DE-', '')}</span>
        </span>
        <button
          className="icon-btn sm ghost-hover"
          onClick={() => setPage('settings')}
          aria-label="Bundesland wählen"
          title="Bundesland wählen"
        >
          <Settings2 size={13} />
        </button>
      </div>
    </div>
  )
}

function CalendarEditForm({
  value,
  onDone,
  isNew
}: {
  value: CalendarInfo
  onDone: () => void
  isNew?: boolean
}): React.JSX.Element {
  const upsert = useStore((s) => s.upsertCalendar)
  const remove = useStore((s) => s.removeCalendar)
  const count = useStore((s) => s.data!.calendars.length)
  const [name, setName] = useState(value.name)
  const [color, setColor] = useState<CalendarColor>(value.color)

  const save = (): void => {
    if (!name.trim()) return onDone()
    upsert({ ...value, name: name.trim(), color })
    onDone()
  }

  return (
    <div className="cal-form">
      <input
        autoFocus
        className="input sm"
        placeholder="Name des Kalenders"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') onDone()
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
        {!isNew && count > 1 && (
          <button
            className="icon-btn sm danger"
            title="Kalender und seine Termine löschen"
            onClick={() => {
              remove(value.id)
              onDone()
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost sm" onClick={onDone}>
          Abbrechen
        </button>
        <button className="btn btn-primary sm" onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  )
}
