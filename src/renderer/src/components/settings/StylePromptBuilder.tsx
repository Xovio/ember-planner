import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

const MOODS = ['ruhig', 'verspielt', 'kontrastreich', 'minimalistisch', 'warm', 'kühl', 'retro', 'futuristisch']
const BASES = ['Blau', 'Grün', 'Rot', 'Orange', 'Violett', 'Türkis', 'Rosa', 'Grau']

const TOKENS =
  '--bg, --surface-1/2/3, --surface-raised, --border, --border-strong, --grid-line, --grid-line-half, ' +
  '--text-1/2/3, --text-on-accent, --accent, --accent-hover, --accent-soft, --accent-softer, --accent-text, ' +
  '--accent-muted, --now, --focus, --danger, --warn, --shadow, --glow, ' +
  '--cal-red/blue/orange/aqua/yellow/violet/magenta/green, --event-mix, --heat-empty, --heat-1 bis --heat-5'

export function StylePromptBuilder(): React.JSX.Element {
  const [name, setName] = useState('')
  const [dark, setDark] = useState(true)
  const [base, setBase] = useState('Blau')
  const [mood, setMood] = useState('ruhig')
  const [notes, setNotes] = useState('')
  const [copied, setCopied] = useState(false)

  const id = (name.trim() || 'mein-style').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const prompt =
    `Erstelle einen neuen Style „${name.trim() || 'Mein Style'}“ für meine Kalender-App.\n\n` +
    `- Modus: ${dark ? 'dunkel' : 'hell'}\n- Grundfarbe/Akzent: ${base}\n- Stimmung: ${mood}\n` +
    (notes.trim() ? `- Zusätzliche Wünsche: ${notes.trim()}\n` : '') +
    `\nUmsetzung:\n1. In src/renderer/src/styles/themes.css einen Block [data-theme='${id}'] mit allen Variablen anlegen: ${TOKENS}.\n` +
    `2. In src/renderer/src/lib/theme.ts einen Eintrag in THEMES ergänzen (id '${id}', Name, Beschreibung, dark: ${dark}, 4 Swatches).\n` +
    `3. Text-Kontrast (WCAG AA) und die Unterscheidbarkeit der 8 Kalenderfarben auf der Fläche prüfen.\n` +
    `4. npm run typecheck ausführen.`

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      <h3 style={{ margin: 0 }}>Style-Prompt-Builder</h3>
      <input className="input" placeholder="Name des Styles" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="input" value={dark ? 'dark' : 'light'} onChange={(e) => setDark(e.target.value === 'dark')}>
          <option value="dark">Dunkel</option>
          <option value="light">Hell</option>
        </select>
        <select className="input" value={base} onChange={(e) => setBase(e.target.value)}>
          {BASES.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select className="input" value={mood} onChange={(e) => setMood(e.target.value)}>
          {MOODS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <textarea className="input" rows={2} placeholder="Weitere Wünsche (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <textarea className="input" rows={9} readOnly value={prompt} />
      <div>
        <button className="btn btn-primary sm" onClick={() => void copy()}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Kopiert' : 'Prompt kopieren'}
        </button>
      </div>
    </div>
  )
}
