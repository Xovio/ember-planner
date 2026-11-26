import { useMemo } from 'react'
import { BookMarked, BookOpen, CalendarClock, Megaphone, Trash2 } from 'lucide-react'
import type { EventTemplate } from '@shared/types'
import { nextPlaceholder, templateKey, templateSessions } from '@shared/templates'
import { useStore, writableCalendars } from '../../store'
import { calVar } from '../../lib/theme'
import { fmt, formatDuration, WEEKDAY_SHORT } from '../../lib/dates'
import { api } from '../../lib/api'
import { NoteLinksField } from '../notes/NoteLinks'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480]
const RHYTHMS = [
  { v: 0, label: 'aus' },
  { v: 1, label: 'jede Woche' },
  { v: 2, label: 'alle 2 Wochen' },
  { v: 3, label: 'alle 3 Wochen' },
  { v: 4, label: 'alle 4 Wochen' }
]

/** Options → Termin-Vorlagen: rename, adjust or delete templates saved from events. */
export function TemplatesSection(): React.JSX.Element {
  const templates = useStore((s) => s.data!.templates)
  const data = useStore((s) => s.data!)
  const calendars = useMemo(() => writableCalendars(data), [data.calendars]) // eslint-disable-line react-hooks/exhaustive-deps
  const upsert = useStore((s) => s.upsertTemplate)
  const remove = useStore((s) => s.removeTemplate)
  const servers = useMemo(() => data.calendars.filter((c) => c.external?.provider === 'discord'), [data.calendars])

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
                {api.obsidian && (
                  <div className="tpl-fields" title="Jeder neue Termin aus dieser Vorlage bekommt diese Notizen">
                    <BookOpen size={14} className="muted" />
                    <NoteLinksField bare links={t.noteLinks} onChange={(noteLinks) => set({ noteLinks: noteLinks.length ? noteLinks : undefined })} />
                  </div>
                )}
                <div className="tpl-fields tpl-session">
                  <CalendarClock size={14} className="muted" />
                  <span className="muted">Nächste Session vormerken</span>
                  <select
                    className="input"
                    value={t.rhythm?.everyWeeks ?? 0}
                    aria-label="Rhythmus"
                    title="Zeigt die nächste Session als grauen Platzhalter im Kalender, bis du sie fertig machst"
                    onChange={(e) => {
                      const every = Number(e.target.value)
                      if (!every) return set({ rhythm: undefined, skipUntil: undefined })
                      const last = templateSessions(t, data.events)
                        .map((x) => new Date(x.start))
                        .sort((a, b) => b.getTime() - a.getTime())[0]
                      const weekday = t.rhythm?.weekday ?? (last ? (last.getDay() + 6) % 7 : 4)
                      set({ rhythm: { weekday, everyWeeks: every } })
                    }}
                  >
                    {RHYTHMS.map((r) => (
                      <option key={r.v} value={r.v}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  {t.rhythm && (
                    <>
                      <select
                        className="input"
                        value={t.rhythm.weekday}
                        aria-label="Wochentag"
                        onChange={(e) => set({ rhythm: { ...t.rhythm!, weekday: Number(e.target.value) }, skipUntil: undefined })}
                      >
                        {WEEKDAY_SHORT.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <NextHint t={t} />
                    </>
                  )}
                  {servers.length > 0 && (
                    <>
                      <Megaphone size={14} className="muted" />
                      <select
                        className="input"
                        value={t.discord?.guildId ?? ''}
                        aria-label="Discord-Server zum Ankündigen"
                        title="Server, auf dem Sessions dieser Vorlage angekündigt werden. Kanal oder Ort merkt sich die Vorlage beim ersten Ankündigen."
                        onChange={(e) =>
                          set({ discord: e.target.value ? { guildId: e.target.value, kind: 'voice' } : undefined })
                        }
                      >
                        <option value="">nicht ankündigen</option>
                        {servers.map((c) => (
                          <option key={c.id} value={c.external!.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
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

/** "nächste: Fr, 4. Dez." */
function NextHint({ t }: { t: EventTemplate }): React.JSX.Element | null {
  const events = useStore((s) => s.data!.events)
  const next = nextPlaceholder(t, events)
  if (!next) return null
  return <span className="muted tpl-when">nächste: {fmt(next.start, 'EEE, d. MMM')}</span>
}
