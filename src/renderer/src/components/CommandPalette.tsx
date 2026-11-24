import { useMemo, useRef, useState } from 'react'
import { addYears } from 'date-fns'
import {
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  Lightbulb,
  Moon,
  PanelRight,
  Plus,
  Redo2,
  Search,
  Sun,
  Undo2,
  Keyboard,
  type LucideIcon
} from 'lucide-react'
import { expandEvent } from '@shared/recurrence'
import { useStore } from '../store'
import { listPages } from '../plugins/registry'
import { THEMES, calVar } from '../lib/theme'
import { fmt } from '../lib/dates'

interface Cmd {
  id: string
  group: 'Termine' | 'ToDos' | 'Befehle'
  label: string
  sub?: string
  hint?: string
  icon?: LucideIcon
  swatch?: string
  run: () => void
}

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Strg+K: search events and ToDos, jump anywhere, run any command. */
export function CommandPalette(): React.JSX.Element {
  const data = useStore((s) => s.data!)
  const close = useStore((s) => s.closeOverlay)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands = useMemo<Cmd[]>(() => {
    const st = (): ReturnType<typeof useStore.getState> => useStore.getState()
    const go = (fn: () => void) => () => {
      close()
      fn()
    }
    const cmds: Cmd[] = [
      { id: 'new', group: 'Befehle', label: 'Neu anlegen', hint: 'N', icon: Plus, run: () => st().openAdd() },
      { id: 'new-ev', group: 'Befehle', label: 'Neuer Termin', icon: CalendarPlus, run: () => st().openAdd('event') },
      { id: 'new-todo', group: 'Befehle', label: 'Neues ToDo', icon: CheckSquare, run: () => st().openAdd('todo') },
      { id: 'today', group: 'Befehle', label: 'Zu heute springen', hint: 'T', icon: CalendarDays, run: go(() => (st().setPage('plan'), st().goToday())) },
      ...(['day', 'week', 'month', 'agenda'] as const).map((v, i) => ({
        id: `view-${v}`,
        group: 'Befehle' as const,
        label: `Ansicht: ${['Tag', 'Woche', 'Monat', 'Agenda'][i]}`,
        hint: ['D', 'W', 'M', 'A'][i],
        icon: CalendarDays,
        run: go(() => st().setView(v))
      })),
      ...listPages().map((p): Cmd => ({ id: `p-${p.id}`, group: 'Befehle', label: `Gehe zu: ${p.label}`, icon: p.icon, run: go(() => st().setPage(p.id)) })),
      { id: 'new-board', group: 'Befehle', label: 'Neues Brainstorm-Board', icon: Lightbulb, run: go(() => st().addBoard()) },
      { id: 'tab-today', group: 'Befehle', label: 'Seitenspalte: Heute', hint: 'H', icon: Sun, run: go(() => (st().setPage('plan'), st().setRightTab('today'))) },
      { id: 'panel', group: 'Befehle', label: 'Seitenspalte ein-/ausblenden', hint: 'B', icon: PanelRight, run: go(() => st().togglePanel()) },
      { id: 'undo', group: 'Befehle', label: 'Rückgängig', hint: 'Strg Z', icon: Undo2, run: go(() => st().undo()) },
      { id: 'redo', group: 'Befehle', label: 'Wiederholen', hint: 'Strg Y', icon: Redo2, run: go(() => st().redo()) },
      { id: 'holidays', group: 'Befehle', label: 'Feiertage ein-/ausblenden', icon: CalendarDays, run: go(() => st().updateSettings({ showHolidays: !st().data?.settings.showHolidays })) },
      { id: 'help', group: 'Befehle', label: 'Tastenkürzel anzeigen', hint: '?', icon: Keyboard, run: () => st().openHelp() },
      ...THEMES.map((t) => ({
        id: `theme-${t.id}`,
        group: 'Befehle' as const,
        label: `Theme: ${t.name}`,
        sub: t.description,
        icon: t.dark ? Moon : Sun,
        run: go(() => st().updateSettings({ theme: t.id }))
      }))
    ]
    return cmds
  }, [close])

  const results = useMemo<Cmd[]>(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    const match = (s: string): boolean => words.every((w) => norm(s).includes(w))
    if (!words.length) return commands.slice(0, 9)
    const st = useStore.getState
    const now = new Date()
    const calMap = new Map(data.calendars.map((c) => [c.id, c]))
    const events: Cmd[] = data.events
      .filter((e) => match(`${e.title} ${e.location ?? ''}`))
      .map((e) => {
        const next = expandEvent(e, now, addYears(now, 1))[0]
        const when = next?.start ?? new Date(e.start)
        return {
          id: `ev-${e.id}`,
          group: 'Termine' as const,
          label: e.title || '(Ohne Titel)',
          sub: `${fmt(when, 'EEE, d. MMM yyyy')}${e.allDay ? '' : ` · ${fmt(when, 'HH:mm')}`}${e.recurrence ? ' · wiederkehrend' : ''}`,
          swatch: calVar(calMap.get(e.calendarId)?.color ?? 'red'),
          run: () => {
            close()
            st().setPage('plan')
            st().setCursor(when)
            st().selectEvent(e.id, next ? next.start.toISOString() : undefined)
          }
        }
      })
      .slice(0, 8)
    const todos: Cmd[] = data.todos
      .filter((t) => match(t.title))
      .sort((a, b) => Number(a.done) - Number(b.done))
      .slice(0, 8)
      .map((t) => ({
        id: `todo-${t.id}`,
        group: 'ToDos' as const,
        label: t.title,
        sub: [t.done ? 'erledigt' : 'offen', t.hardDeadline && `hart ${t.hardDeadline}`, t.softDeadline && `weich ${t.softDeadline}`]
          .filter(Boolean)
          .join(' · '),
        icon: CheckSquare,
        run: () => {
          close()
          st().selectTodo(t.id)
        }
      }))
    return [...commands.filter((c) => match(c.label)), ...events, ...todos]
  }, [q, commands, data.events, data.todos, data.calendars, close])

  const run = (c?: Cmd): void => c?.run()
  const safeIdx = Math.min(idx, Math.max(0, results.length - 1))
  let lastGroup = ''

  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="spotlight palette" role="dialog" aria-label="Befehlspalette">
        <div className="spot-input">
          <Search size={18} />
          <input
            autoFocus
            value={q}
            placeholder="Termine, ToDos oder Befehle suchen …"
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
              if (e.key === 'Enter') run(results[safeIdx])
              if (e.key === 'Escape') close()
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {results.length === 0 && <p className="empty-mini">Nichts gefunden.</p>}
          {results.map((c, i) => {
            const head = c.group !== lastGroup ? c.group : null
            lastGroup = c.group
            const Icon = c.icon
            return (
              <div key={c.id}>
                {head && <div className="palette-group">{head}</div>}
                <button
                  data-idx={i}
                  className={`palette-item ${i === safeIdx ? 'on' : ''}`}
                  onMouseMove={() => setIdx(i)}
                  onClick={() => run(c)}
                >
                  <span className="palette-icon">
                    {c.swatch ? <i style={{ background: c.swatch }} /> : Icon ? <Icon size={15} /> : null}
                  </span>
                  <span className="palette-text">
                    <span>{c.label}</span>
                    {c.sub && <small>{c.sub}</small>}
                  </span>
                  {c.hint && <kbd>{c.hint}</kbd>}
                </button>
              </div>
            )
          })}
        </div>
        <div className="spot-foot">
          <kbd>↑</kbd>
          <kbd>↓</kbd> auswählen · <kbd>↵</kbd> ausführen
        </div>
      </div>
    </div>
  )
}

