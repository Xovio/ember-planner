import { Check } from 'lucide-react'
import type { CalendarViewKind } from '@shared/types'
import { useStore } from '../store'
import { THEMES } from '../lib/theme'
import { REMINDER_PRESETS, reminderLabel } from '../lib/dates'
import { api } from '../lib/api'
import { playChime } from '../lib/chime'
import { DataSection } from '../components/DataSection'
import { HOLIDAY_REGIONS } from '@shared/holidays'

export function SettingsPage(): React.JSX.Element {
  const s = useStore((st) => st.data!.settings)
  const update = useStore((st) => st.updateSettings)
  const calendars = useStore((st) => st.data!.calendars)

  return (
    <div className="settings-page">
      <h1>Optionen</h1>

      <section className="settings-section">
        <h2>Aussehen</h2>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-card ${s.theme === t.id ? 'on' : ''}`}
              onClick={() => update({ theme: t.id })}
            >
              <div className="theme-preview" style={{ background: t.swatches[0] }}>
                <span style={{ background: t.swatches[1] }} />
                <span style={{ background: t.swatches[2] }} />
                <span style={{ background: t.swatches[3] }} />
              </div>
              <div className="theme-meta">
                <strong>{t.name}</strong>
                <span>{t.description}</span>
              </div>
              {s.theme === t.id && (
                <span className="theme-check">
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
          <div className="theme-card ghost">
            <div className="theme-meta">
              <strong>Weitere Styles</strong>
              <span>folgen später</span>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2>Kalender</h2>
        <Row label="Standardansicht">
          <select
            className="input"
            value={s.defaultView}
            onChange={(e) => update({ defaultView: e.target.value as CalendarViewKind })}
          >
            <option value="day">Tag</option>
            <option value="week">Woche</option>
            <option value="month">Monat</option>
            <option value="agenda">Agenda</option>
          </select>
        </Row>
        <Row label="Standarddauer neuer Termine">
          <select
            className="input"
            value={s.defaultDurationMin}
            onChange={(e) => update({ defaultDurationMin: Number(e.target.value) })}
          >
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} Minuten` : `${m / 60} Stunde${m === 60 ? '' : 'n'}`}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Kalender für eingeplante ToDos" hint="Hier landen Zeitblöcke, wenn du ein ToDo in den Kalender ziehst">
          <select className="input" value={s.todoCalendarId} onChange={(e) => update({ todoCalendarId: e.target.value })}>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Feiertage" hint="Gesetzliche Feiertage im Kalender anzeigen – nur zur Info, es entstehen keine Termine">
          <Switch checked={s.showHolidays} onChange={(v) => update({ showHolidays: v })} />
          <select className="input" value={s.holidayRegion} onChange={(e) => update({ holidayRegion: e.target.value, showHolidays: true })}>
            {HOLIDAY_REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Tag beginnt um" hint="Dorthin scrollt die Tages- und Wochenansicht">
          <select
            className="input"
            value={s.dayStartHour}
            onChange={(e) => update({ dayStartHour: Number(e.target.value) })}
          >
            {Array.from({ length: 13 }, (_, h) => h).map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </Row>
      </section>

      <section className="settings-section">
        <h2>Erinnerungen</h2>
        <Row label="Standard für neue Termine">
          <div className="chip-select">
            {REMINDER_PRESETS.map((m) => {
              const on = s.defaultReminders.includes(m)
              return (
                <button
                  key={m}
                  className={on ? 'on' : ''}
                  onClick={() =>
                    update({
                      defaultReminders: on ? s.defaultReminders.filter((x) => x !== m) : [...s.defaultReminders, m]
                    })
                  }
                >
                  {reminderLabel(m)}
                </button>
              )
            })}
          </div>
        </Row>
        <Row label="Deadline-Erinnerungen" hint="Benachrichtigung am Vortag und am Tag einer harten Deadline">
          <Switch checked={s.deadlineReminders} onChange={(v) => update({ deadlineReminders: v })} />
          <select
            className="input"
            value={s.deadlineReminderHour}
            disabled={!s.deadlineReminders}
            onChange={(e) => update({ deadlineReminderHour: Number(e.target.value) })}
          >
            {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
              <option key={h} value={h}>
                um {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </Row>
        <Row label="Ton abspielen" hint="Kurzer Gong zusätzlich zur Windows-Benachrichtigung">
          <Switch checked={s.reminderSound} onChange={(v) => update({ reminderSound: v })} />
          <button className="btn btn-ghost sm" onClick={playChime}>
            Probehören
          </button>
        </Row>
      </section>

      <section className="settings-section">
        <h2>System</h2>
        <Row label="Beim Schließen in den Tray minimieren" hint="Nötig, damit Erinnerungen auch bei geschlossenem Fenster kommen">
          <Switch checked={s.closeToTray} onChange={(v) => update({ closeToTray: v })} />
        </Row>
        <Row
          label="Mit Windows starten"
          hint={api.kind === 'electron' ? 'Startet versteckt im Tray (nur in der installierten Version)' : 'Nur in der Desktop-App'}
        >
          <Switch checked={s.launchAtLogin} onChange={(v) => update({ launchAtLogin: v })} />
        </Row>
      </section>

      <DataSection />
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="settings-row">
      <div className="settings-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="settings-control">{children}</div>
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  )
}
