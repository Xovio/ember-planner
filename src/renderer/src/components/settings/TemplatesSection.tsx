import { useMemo } from 'react'
import { BookMarked, Trash2 } from 'lucide-react'
import type { EventTemplate } from '@shared/types'
import { templateKey } from '@shared/templates'
import { useStore, writableCalendars } from '../../store'
import { calVar } from '../../lib/theme'
import { formatDuration } from '../../lib/dates'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480]

/** Options → Termin-Vorlagen: rename, adjust or delete templates saved from events. */
export function TemplatesSection(): React.JSX.Element {
  const templates = useStore((s) => s.data!.templates)
  const data = useStore((s) => s.data!)
  const calendars = useMemo(() => writableCalendars(data), [data.calendars]) // eslint-disable-line react-hooks/exhaustive-deps
  const upsert = useStore((s) => s.upsertTemplate)
  const remove = useStore((s) => s.removeTemplate)

  return (
    <section className="settings-section">
      <h2>Termin-Vorlagen</h2>
      {templates.length === 0 ? (
        <p className="settings-empty">
          <BookMarked size={14} /> Noch keine Vorlagen. Öffne einen Termin und speichere ihn mit dem Lesezeichen-Knopf
          (oder per Rechtsklick) als Vorlage – danach legst du ihn in der Schnelleingabe mit <code>/name</code> an oder
          wählst die Vorlage im Popup beim Klick ins Raster.
        </p>
      ) : (
        <div className="tpl-list">
          {templates.map((t) => {
            const set = (patch: Partial<EventTemplate>): void => upsert({ ...t, ...patch })
            const cal = calendars.find((c) => c.id === t.calendarId)
            return (
              <div key={t.id} className="tpl-row" style={{ '--c': calVar(cal?.color ?? 'red') } as React.CSSProperties}>
                <div className="tpl-main">
                  <input
                    className="input tpl-name"
                    value={t.name}
                    aria-label="Name der Vorlage"
                    onChange={(e) => set({ name: e.target.value })}
                  />
                  <code className="tpl-key" title="In der Schnelleingabe">
                    /{templateKey(t) || '…'}
                  </code>
                </div>
                <div className="tpl-fields">
                  <input
                    className="input"
                    placeholder="Titel neuer Termine"
                    value={t.title}
                    aria-label="Titel"
                    onChange={(e) => set({ title: e.target.value })}
                  />
                  <select
                    className="input"
                    value={t.calendarId}
                    aria-label="Kalender"
                    onChange={(e) => set({ calendarId: e.target.value })}
                  >
                    {!cal && <option value={t.calendarId}>(Kalender fehlt)</option>}
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {t.allDay ? (
                    <span className="muted tpl-when">ganztägig</span>
                  ) : (
                    <>
                      <input
                        type="time"
                        className="input xs-time"
                        step={900}
                        value={t.startTime ?? ''}
                        aria-label="Übliche Uhrzeit"
                        title="Übliche Uhrzeit – gilt, wenn du keine angibst"
                        onChange={(e) => set({ startTime: e.target.value || undefined })}
                      />
                      <select
                        className="input"
                        value={t.durationMin}
                        aria-label="Dauer"
                        onChange={(e) => set({ durationMin: Number(e.target.value) })}
                      >
                        {[...new Set([...DURATIONS, t.durationMin])]
                          .sort((a, b) => a - b)
                          .map((m) => (
                            <option key={m} value={m}>
                              {formatDuration(m)}
                            </option>
                          ))}
                      </select>
                    </>
                  )}
                  <input
                    className="input"
                    placeholder="Ort oder Link"
                    value={t.location ?? ''}
                    aria-label="Ort"
                    onChange={(e) => set({ location: e.target.value || undefined })}
                  />
                </div>
                <button
                  className="icon-btn sm danger"
                  title="Vorlage löschen"
                  aria-label={`Vorlage „${t.name}“ löschen`}
                  onClick={() => remove(t.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
