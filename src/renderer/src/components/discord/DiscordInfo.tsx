import { ExternalLink, Megaphone, Unlink, Users } from 'lucide-react'
import { discordEventUrl } from '@shared/discord'
import type { CalendarEvent } from '@shared/types'
import { isEventLocked, useStore } from '../../store'
import { api } from '../../lib/api'
import { DISCORD_STATUS_LABEL } from '../../lib/discordStatus'

/** Discord line in preview and details: server, interested count, status, link – or the button to announce. */
export function DiscordInfo({
  ev,
  occurrenceStart,
  compact
}: {
  ev: CalendarEvent
  occurrenceStart?: string
  compact?: boolean
}): React.JSX.Element | null {
  const calendars = useStore((s) => s.data!.calendars)
  const locked = useStore((s) => isEventLocked(s.data!, ev))
  const openAnnounce = useStore((s) => s.openAnnounce)
  const updateEvent = useStore((s) => s.updateEvent)
  const link = ev.discord
  const hasServers = calendars.some((c) => c.external?.provider === 'discord')

  if (!link) {
    // announcing needs the desktop app, a server and an own (writable) event in the future
    const start = occurrenceStart ?? ev.start
    if (!api.discord || !hasServers || locked || new Date(start).getTime() <= Date.now()) return null
    return (
      <button className="btn btn-ghost sm discord-announce" onClick={() => openAnnounce(ev.id, occurrenceStart)}>
        <Megaphone size={14} /> In Discord ankündigen
      </button>
    )
  }

  const server = calendars.find((c) => c.id === `d:${link.guildId}`)?.name ?? 'Discord-Server'
  const status = link.status && link.status !== 1 ? DISCORD_STATUS_LABEL[link.status] : null
  return (
    <div className={`discord-info ${link.status === 4 ? 'is-cancelled' : ''}`}>
      <Megaphone size={14} className="discord-mark" aria-hidden />
      <span className="discord-where">
        {link.own ? 'Angekündigt auf ' : 'Event auf '}
        <strong>{server}</strong>
        {status && <> · {status}</>}
      </span>
      {link.userCount !== undefined && (
        <span className="discord-count">
          <Users size={12} /> {link.userCount} interessiert
        </span>
      )}
      <span className="discord-actions">
        <a className="link-btn" href={discordEventUrl(link.guildId, link.eventId)} target="_blank" rel="noreferrer">
          In Discord öffnen <ExternalLink size={11} />
        </a>
        {link.own && link.status === 4 && !compact && (
          <button
            className="link-btn"
            onClick={() => {
              updateEvent(ev.id, { discord: undefined })
              openAnnounce(ev.id)
            }}
          >
            Neu ankündigen
          </button>
        )}
        {link.own && link.status !== 4 && !compact && (
          <button
            className="link-btn"
            title="Das Event in Discord bleibt, wie es ist; Änderungen am Termin gehen nicht mehr dorthin"
            onClick={() => updateEvent(ev.id, { discord: undefined })}
          >
            <Unlink size={11} /> Nicht mehr abgleichen
          </button>
        )}
      </span>
    </div>
  )
}
