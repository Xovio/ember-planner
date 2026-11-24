import type { CalendarInfo } from '@shared/types'
import { useStore } from '../../store'
import { calVar } from '../../lib/theme'
import { toLocalTime } from '../../lib/dates'
import { eventMenu } from '../../lib/menus'
import { clickOccurrence } from './TimeGrid'
import type { SpanPiece } from './layout'
import { DiscordBadge, discordClass, placeholderClass } from '../discord/DiscordBadge'

/** one day's pieces of multi-day bars; empty lanes keep the bars of other days aligned */
export function SpanLanes({
  pieces,
  calendars
}: {
  pieces: (SpanPiece | null)[]
  calendars: Map<string, CalendarInfo>
}): React.JSX.Element {
  const selection = useStore((s) => s.selection)
  const selectEvent = useStore((s) => s.selectEvent)
  const openMenu = useStore((s) => s.openMenu)
  return (
    <>
      {pieces.map((p, i) => {
        if (!p) return <div key={`gap${i}`} className="chip-spacer" aria-hidden />
        const ev = p.occ.event
        const start = p.occ.start.toISOString()
        const title = ev.title || '(Ohne Titel)'
        const selected = selection?.kind === 'event' && selection.id === ev.id
        return (
          <button
            key={p.occ.key}
            className={`chip chip-allday chip-span ${p.contLeft ? 'cont-left' : ''} ${p.contRight ? 'cont-right' : ''} ${p.head ? 'head' : ''} ${
              selected ? 'selected' : ''
            } ${discordClass(ev)} ${placeholderClass(ev)}`}
            style={
              { '--c': calVar(calendars.get(ev.calendarId)?.color ?? 'red'), '--len': p.len } as React.CSSProperties
            }
            title={ev.allDay ? title : `${title}\n${toLocalTime(p.occ.start)} – ${toLocalTime(p.occ.end)}`}
            onClick={(e) => clickOccurrence(ev.id, start, e.currentTarget)}
            onDoubleClick={(e) => {
              e.stopPropagation()
              selectEvent(ev.id, start)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              openMenu(e.clientX, e.clientY, eventMenu(ev.id, start))
            }}
          >
            {p.head && !ev.allDay && !p.contLeft && <span className="chip-time">{toLocalTime(p.occ.start)}</span>}
            {/* the title stays on every piece for screen readers, but shows only on the first */}
            <span className={`chip-title ${p.head ? '' : 'sr-only'}`}>{title}</span>
            {p.head && <DiscordBadge ev={ev} />}
          </button>
        )
      })}
    </>
  )
}
