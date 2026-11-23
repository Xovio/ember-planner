import { useMemo, useRef, useState } from 'react'
import { addDays, addMonths, isSameMonth, isToday, nextMonday, nextSaturday } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { LocalDate } from '@shared/types'
import { localDate, parseLocalDate } from '@shared/todo'
import { anchorOf, type Anchor } from '../../store'
import { WEEKDAY_SHORT, fmt, monthGridRange } from '../../lib/dates'
import { resolveDate } from '../../lib/quickAdd'
import { Popover } from './Popover'

/** Date field with typed input ("fr", "3.12.", "morgen"), presets and a month grid. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Datum wählen',
  clearable,
  icon,
  className = ''
}: {
  value?: LocalDate
  onChange: (v: LocalDate | undefined) => void
  placeholder?: string
  clearable?: boolean
  icon?: React.ReactNode
  className?: string
}): React.JSX.Element {
  const btn = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const label = value ? fmt(parseLocalDate(value), 'EEE, d. MMM yyyy') : placeholder

  return (
    <>
      <span className={`datefield ${value ? '' : 'empty'} ${className}`}>
        <button ref={btn} type="button" className="datefield-btn" onClick={() => setAnchor(anchorOf(btn.current!))}>
          {icon ?? <CalendarDays size={14} />}
          <span>{label}</span>
        </button>
        {clearable && value && (
          <button type="button" className="icon-btn sm" onClick={() => onChange(undefined)} aria-label="Datum entfernen">
            <X size={13} />
          </button>
        )}
      </span>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} placement="below" width={264} label="Datum wählen">
          <DatePanel
            value={value}
            clearable={clearable}
            onPick={(v) => {
              onChange(v)
              setAnchor(null)
            }}
          />
        </Popover>
      )}
    </>
  )
}

export function DatePanel({
  value,
  onPick,
  clearable
}: {
  value?: LocalDate
  onPick: (v: LocalDate | undefined) => void
  clearable?: boolean
}): React.JSX.Element {
  const [month, setMonth] = useState(() => (value ? parseLocalDate(value) : new Date()))
  const [text, setText] = useState('')
  const typed = text.trim() ? resolveDate(text.trim()) : undefined
  const { days } = useMemo(() => monthGridRange(month), [month])
  const today = new Date()
  const presets: [string, Date][] = [
    ['Heute', today],
    ['Morgen', addDays(today, 1)],
    ['Wochenende', today.getDay() === 6 ? today : nextSaturday(today)],
    ['Nächste Woche', nextMonday(today)]
  ]

  return (
    <div className="datepanel">
      <input
        autoFocus
        className="input sm"
        placeholder="z. B. fr, 3.12., in 2 wochen"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && typed) onPick(typed)
        }}
      />
      {text.trim() && (
        <div className={`datepanel-typed ${typed ? '' : 'invalid'}`}>
          {typed ? (
            <button onClick={() => onPick(typed)}>
              ↵ {fmt(parseLocalDate(typed), 'EEEE, d. MMMM yyyy')}
            </button>
          ) : (
            'Nicht erkannt'
          )}
        </div>
      )}
      <div className="datepanel-presets">
        {presets.map(([l, d]) => (
          <button key={l} onClick={() => onPick(localDate(d))}>
            {l}
            <span>{fmt(d, 'EEE')}</span>
          </button>
        ))}
      </div>
      <div className="mini-head">
        <span>{fmt(month, 'MMMM yyyy')}</span>
        <div>
          <button className="icon-btn sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Vorheriger Monat">
            <ChevronLeft size={16} />
          </button>
          <button className="icon-btn sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Nächster Monat">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="mini-grid">
        {WEEKDAY_SHORT.map((w) => (
          <span key={w} className="mini-dow">
            {w}
          </span>
        ))}
        {days.map((d) => {
          const k = localDate(d)
          return (
            <button
              key={k}
              className={['mini-day', isSameMonth(d, month) ? '' : 'outside', isToday(d) ? 'today' : '', k === value ? 'selected' : ''].join(' ')}
              onClick={() => onPick(k)}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
      {clearable && value && (
        <button className="btn btn-ghost sm datepanel-clear" onClick={() => onPick(undefined)}>
          Datum entfernen
        </button>
      )}
    </div>
  )
}
