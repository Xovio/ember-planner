import { Keyboard } from 'lucide-react'
import { useStore } from '../store'

/** keys, label, separator between keys (default: +) */
type Row = [keys: string[], label: string, sep?: string]

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Überall',
    rows: [
      [['N'], 'Neu anlegen (Termin oder ToDo)'],
      [['Strg', 'Leertaste'], 'Neu anlegen, auch aus Textfeldern'],
      [['Strg', 'K'], 'Suchen & Befehle'],
      [['/'], 'Suchen & Befehle'],
      [['Strg', 'Z'], 'Rückgängig'],
      [['Strg', 'Y'], 'Wiederholen'],
      [['Entf'], 'Ausgewählten Termin / ToDo löschen'],
      [['Esc'], 'Auswahl aufheben, Fenster schließen'],
      [['?'], 'Diese Übersicht']
    ]
  },
  {
    title: 'Kalender',
    rows: [
      [['T'], 'Zu heute springen'],
      [['D'], 'Tagesansicht'],
      [['W'], 'Wochenansicht'],
      [['M'], 'Monatsansicht'],
      [['A'], 'Agenda'],
      [['←', '→'], 'Zurück / weiter blättern', ' '],
      [['H'], 'Seitenspalte „Heute“'],
      [['B'], 'Seitenspalte ein/aus']
    ]
  },
  {
    title: 'ToDo-Seite',
    rows: [
      [['↑', '↓'], 'ToDo wählen (auch J / K)', ' '],
      [['Shift', '↑'], 'Auswahl erweitern'],
      [['Leertaste'], 'Abhaken'],
      [['0', '3'], 'Priorität keine … hoch', '–'],
      [['Entf'], 'In den Papierkorb']
    ]
  },
  {
    title: 'Schnelleingabe',
    rows: [
      [['Tab'], 'Zwischen Termin und ToDo wechseln'],
      [['↵'], 'Anlegen']
    ]
  }
]

const MOUSE: Row[] = [
  [['Klick'], 'ins Raster: Schnell-Anlegen · auf Termin: Vorschau'],
  [['Doppelklick'], 'Details in der Seitenspalte'],
  [['Rechtsklick'], 'Menü mit allen Aktionen'],
  [['Ziehen'], 'ToDo ins Raster = einplanen, in den Monat = Wunschtag'],
  [['Strg', 'Klick'], 'Mehrfachauswahl in ToDo-Listen']
]

function Keys({ keys, sep = '+' }: { keys: string[]; sep?: string }): React.JSX.Element {
  return (
    <span className="sc-keys">
      {keys.map((k, i) => (
        <span key={k}>
          {i > 0 && sep.trim() && <span className="sc-sep">{sep}</span>}
          <kbd>{k}</kbd>
        </span>
      ))}
    </span>
  )
}

/** `?`: overview of all keyboard shortcuts. */
export function ShortcutHelp(): React.JSX.Element {
  const close = useStore((s) => s.closeOverlay)
  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="spotlight shortcut-help"
        role="dialog"
        aria-label="Tastenkürzel"
        tabIndex={-1}
        ref={(el) => el?.focus()}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === '?') {
            e.preventDefault()
            e.stopPropagation()
            close()
          }
        }}
      >
        <div className="spot-input">
          <Keyboard size={18} />
          <strong>Tastenkürzel</strong>
          <kbd style={{ marginLeft: 'auto' }}>Esc</kbd>
        </div>
        <div className="sc-grid">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h4>{s.title}</h4>
              {s.rows.map(([keys, label, sep]) => (
                <div className="sc-row" key={label + keys.join()}>
                  <span>{label}</span>
                  <Keys keys={keys} sep={sep} />
                </div>
              ))}
            </section>
          ))}
          <section className="sc-wide">
            <h4>Maus</h4>
            {MOUSE.map(([keys, label]) => (
              <div className="sc-row" key={label}>
                <span>{label}</span>
                <Keys keys={keys} />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
