import { useMemo, useRef, useState } from 'react'
import { BookOpen, Plus, Search, X } from 'lucide-react'
import { addLink, linkOf, noteTypes, removeLink, resolveLink, searchNotes, type NoteEntry, type NoteLink } from '@shared/notes'
import { anchorOf, useStore, type Anchor } from '../../store'
import { useNotes, openNote } from '../../lib/notes'
import { api } from '../../lib/api'
import { Popover } from '../ui/Popover'

/**
 * Linked Obsidian notes as chips. A click opens the note in Obsidian; "+ Notiz" searches the vaults.
 * `inherited` are shown greyed (e.g. "vom Projekt") and cannot be removed here.
 */
export function NoteLinksField({
  links,
  onChange,
  inherited = [],
  inheritedLabel = 'vom Projekt',
  bare = false
}: {
  links: NoteLink[] | undefined
  onChange: (links: NoteLink[]) => void
  inherited?: NoteLink[]
  inheritedLabel?: string
  /** without the field icon column (e.g. in a page header) */
  bare?: boolean
}): React.JSX.Element | null {
  const entries = useNotes((s) => s.entries)
  const status = useNotes((s) => s.status)
  const [picker, setPicker] = useState<Anchor | null>(null)
  const own = links ?? []
  if (!api.obsidian) return null
  if (status === 'off' && !own.length && !inherited.length && bare) return null

  const body = (
    <div className="note-links">
      {own.map((l) => (
        <NoteChip key={`${l.vault}/${l.path}`} link={l} entry={resolveLink(l, entries)} ready={status === 'ready'} onRemove={() => onChange(removeLink(own, l))} />
      ))}
      {inherited.map((l) => (
        <NoteChip key={`i:${l.vault}/${l.path}`} link={l} entry={resolveLink(l, entries)} ready={status === 'ready'} inherited={inheritedLabel} />
      ))}
      <button type="button" className="note-add" onClick={(e) => setPicker(anchorOf(e.currentTarget))}>
        <Plus size={13} /> Notiz
      </button>
      {picker && (
        <NotePicker
          anchor={picker}
          exclude={own}
          onPick={(e) => onChange(addLink(own, linkOf(e)))}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
  if (bare) return body
  return (
    <div className="field">
      <BookOpen size={16} className="field-icon" />
      {body}
    </div>
  )
}

function NoteChip({
  link,
  entry,
  ready,
  inherited,
  onRemove
}: {
  link: NoteLink
  entry: NoteEntry | null
  ready: boolean
  inherited?: string
  onRemove?: () => void
}): React.JSX.Element {
  // after a rename/move in Obsidian, open the note where it is now
  const target = entry ? linkOf(entry) : link
  const missing = ready && !entry
  const title = missing
    ? `Nicht gefunden: ${link.vault} / ${link.path}`
    : `${link.vault} / ${target.path}${inherited ? ` · ${inherited}` : ''} – in Obsidian öffnen`
  return (
    <span className={`note-chip ${inherited ? 'inherited' : ''} ${missing ? 'missing' : ''}`} title={title}>
      <button type="button" className="note-chip-open" onClick={() => void openNote(target)}>
        {entry?.type && <em>{entry.type}</em>}
        <span>{entry?.title ?? link.title}</span>
        {missing && <small>nicht gefunden</small>}
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Verknüpfung zu ${link.title} lösen`}>
          <X size={12} />
        </button>
      )}
    </span>
  )
}

/** search popover over all indexed notes; Enter picks, the popover stays open for more */
export function NotePicker({
  anchor,
  exclude = [],
  onPick,
  onClose
}: {
  anchor: Anchor
  exclude?: NoteLink[]
  onPick: (e: NoteEntry) => void
  onClose: () => void
}): React.JSX.Element {
  const entries = useNotes((s) => s.entries)
  const status = useNotes((s) => s.status)
  const setPage = useStore((s) => s.setPage)
  const [q, setQ] = useState('')
  const [type, setType] = useState<string | undefined>()
  const [idx, setIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const types = useMemo(() => noteTypes(entries).slice(0, 8), [entries])
  const taken = useMemo(() => new Set(exclude.map((l) => `${l.vault}/${l.path}`.toLowerCase())), [exclude])
  const results = useMemo(
    () => searchNotes(entries, q, { type, limit: 40 }).filter((e) => !taken.has(`${e.vault}/${e.path}`.toLowerCase())),
    [entries, q, type, taken]
  )
  const multiVault = useMemo(() => new Set(entries.map((e) => e.vault)).size > 1, [entries])
  const safeIdx = Math.min(idx, Math.max(0, results.length - 1))

  return (
    <Popover anchor={anchor} onClose={onClose} width={360} placement="below" className="note-picker" label="Notiz verknüpfen">
      {status === 'off' ? (
        <div className="note-picker-empty">
          <p>Noch kein Obsidian-Vault eingeschaltet.</p>
          <button
            className="btn btn-outline sm"
            onClick={() => {
              onClose()
              setPage('settings')
              setTimeout(() => document.getElementById('settings-obsidian')?.scrollIntoView({ block: 'start' }), 50)
            }}
          >
            Vaults in den Optionen wählen
          </button>
        </div>
      ) : (
        <>
          <div className="note-picker-search">
            <Search size={15} />
            <input
              autoFocus
              value={q}
              placeholder={status === 'loading' ? 'Vaults werden gelesen …' : `${entries.length} Notizen durchsuchen …`}
              onChange={(e) => {
                setQ(e.target.value)
                setIdx(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  const n = (safeIdx + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length)
                  setIdx(n)
                  listRef.current?.querySelector(`[data-idx="${n}"]`)?.scrollIntoView({ block: 'nearest' })
                }
                if (e.key === 'Enter' && results[safeIdx]) {
                  e.preventDefault()
                  onPick(results[safeIdx])
                  setQ('')
                }
              }}
            />
          </div>
          {types.length > 1 && (
            <div className="note-types">
              {types.map((t) => (
                <button
                  key={t.type}
                  className={type === t.type ? 'on' : ''}
                  onClick={() => {
                    setType(type === t.type ? undefined : t.type)
                    setIdx(0)
                  }}
                >
                  {t.type}
                </button>
              ))}
            </div>
          )}
          <div className="note-results" ref={listRef}>
            {results.length === 0 && <p className="empty-mini">{status === 'loading' ? 'Einen Moment …' : 'Keine passende Notiz.'}</p>}
            {results.map((e, i) => (
              <button
                key={`${e.vault}/${e.path}`}
                data-idx={i}
                className={`note-result ${i === safeIdx ? 'on' : ''}`}
                onMouseMove={() => setIdx(i)}
                onClick={() => onPick(e)}
              >
                <span>{e.title}</span>
                <small>
                  {[e.type, multiVault ? e.vault : null, e.folder.split('/').slice(-2).join(' / ')].filter(Boolean).join(' · ')}
                </small>
              </button>
            ))}
          </div>
          <div className="spot-foot">
            <kbd>↵</kbd> verknüpfen · <kbd>Esc</kbd> fertig
          </div>
        </>
      )}
    </Popover>
  )
}
