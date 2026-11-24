import { Megaphone, Users } from 'lucide-react'
import type { CalendarEvent } from '@shared/types'

/** CSS classes that set Discord events apart: dashed edge for server events, struck through when cancelled */
export function discordClass(ev: CalendarEvent): string {
  const d = ev.discord
  if (!d) return ''
  return `${d.own ? 'dc-own' : 'dc-ext'} ${d.status === 4 ? 'dc-cancelled' : ''}`
}

/** grey, dashed "next session – noch planen" placeholder from a template with a rhythm */
export const placeholderClass = (ev: CalendarEvent): string => (ev.id.startsWith('ph:') ? 'is-placeholder' : '')

/** small mark with the number of interested people */
export function DiscordBadge({ ev }: { ev: CalendarEvent }): React.JSX.Element | null {
  const d = ev.discord
  if (!d) return null
  const label = `Discord${d.userCount !== undefined ? ` · ${d.userCount} interessiert` : ''}${d.status === 4 ? ' · abgesagt' : ''}`
  return (
    <span className="dc-badge" title={label} aria-label={label}>
      {/* with a count the people icon says enough; narrow columns need the space for the title */}
      {d.userCount !== undefined ? (
        <>
          <Users size={10} />
          {d.userCount}
        </>
      ) : (
        <Megaphone size={10} />
      )}
    </span>
  )
}
