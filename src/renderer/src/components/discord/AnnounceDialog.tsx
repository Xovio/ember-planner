import { useEffect, useMemo, useState } from 'react'
import { Headphones, MapPin, Megaphone } from 'lucide-react'
import type { DiscordChannel } from '@shared/discord'
import { useStore } from '../../store'
import { api } from '../../lib/api'
import { fmt, toLocalTime } from '../../lib/dates'
import { calVar } from '../../lib/theme'

/** "In Discord ankündigen": server, voice channel or place – title, time and notes come from the event. */
export function AnnounceDialog({ eventId }: { eventId: string }): React.JSX.Element | null {
  const ev = useStore((s) => s.data!.events.find((e) => e.id === eventId))
  const calendars = useStore((s) => s.data!.calendars)
  const close = useStore((s) => s.closeOverlay)
  const pushToast = useStore((s) => s.pushToast)
  const servers = useMemo(() => calendars.filter((c) => c.external?.provider === 'discord'), [calendars])
  // a session from a template starts with the template's Discord defaults
  const template = useStore((s) => (ev?.templateId ? s.data!.templates.find((t) => t.id === ev.templateId) : undefined))
  const upsertTemplate = useStore((s) => s.upsertTemplate)
  const preset = template?.discord && servers.some((s) => s.external?.id === template.discord!.guildId) ? template.discord : undefined
  const [guildId, setGuildId] = useState(preset?.guildId ?? servers[0]?.external?.id ?? '')
  const [kind, setKind] = useState<'voice' | 'external'>(preset?.kind ?? 'voice')
  const [channels, setChannels] = useState<DiscordChannel[] | null>(null)
  const [channelId, setChannelId] = useState(preset?.channelId ?? '')
  const [location, setLocation] = useState(ev?.location ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const discord = api.discord
    if (!guildId || !discord) return
    let alive = true
    setChannels(null)
    void discord.channels(guildId).then((r) => {
      if (!alive) return
      if (!r.ok) {
        setChannels([])
        setError(r.error)
        return
      }
      const voice = r.value.filter((c) => c.kind === 'voice')
      setChannels(voice)
      setChannelId((cur) => (voice.some((c) => c.id === cur) ? cur : (voice[0]?.id ?? '')))
      if (!voice.length) setKind('external')
    })
    return () => {
      alive = false
    }
  }, [guildId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close])

  if (!ev) return null
  const start = new Date(ev.start)
  const ready = !!guildId && (kind === 'voice' ? !!channelId : !!location.trim())

  const submit = async (): Promise<void> => {
    if (!api.discord || !ready) return
    setBusy(true)
    setError(null)
    const r = await api.discord.announce(eventId, {
      guildId,
      kind,
      ...(kind === 'voice' ? { channelId } : { location: location.trim() })
    })
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    // the first announcement of a template's session teaches the template where its sessions go
    if (template && !template.discord) {
      upsertTemplate({ ...template, discord: { guildId, kind, ...(kind === 'voice' ? { channelId } : {}) } })
    }
    const server = servers.find((s) => s.external?.id === guildId)?.name ?? 'Discord'
    pushToast({ kind: 'info', title: `„${ev.title || 'Termin'}“ auf ${server} angekündigt` })
    close()
  }

  return (
    <div className="overlay-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="announce-dialog" role="dialog" aria-labelledby="announce-title">
        <div className="confirm-head">
          <Megaphone size={18} />
          <h2 id="announce-title">In Discord ankündigen</h2>
        </div>
        <p className="announce-what">
          <strong>{ev.title || '(Ohne Titel)'}</strong>
          <span className="muted">
            {' '}
            · {fmt(start, 'EEE, d. MMM')} · {toLocalTime(start)} – {toLocalTime(new Date(ev.end))}
          </span>
        </p>

        {servers.length === 0 ? (
          <p className="field-error">
            Noch kein Server ausgewählt. Unter Optionen → Discord den Bot verbinden und einen Server anhaken.
          </p>
        ) : (
          <>
            <div className="announce-field">
              <span>Server</span>
              <div className="cal-picker">
                {servers.map((s) => (
                  <button
                    key={s.id}
                    className={`cal-pill sm ${s.external?.id === guildId ? 'on' : ''}`}
                    style={{ '--c': calVar(s.color) } as React.CSSProperties}
                    onClick={() => setGuildId(s.external!.id)}
                  >
                    <i />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="announce-field">
              <span>Wo</span>
              <div className="spot-kinds announce-kinds" role="radiogroup" aria-label="Art des Events">
                <button
                  role="radio"
                  aria-checked={kind === 'voice'}
                  className={kind === 'voice' ? 'on' : ''}
                  onClick={() => setKind('voice')}
                  disabled={channels?.length === 0}
                >
                  <Headphones size={13} /> Sprachkanal
                </button>
                <button
                  role="radio"
                  aria-checked={kind === 'external'}
                  className={kind === 'external' ? 'on' : ''}
                  onClick={() => setKind('external')}
                >
                  <MapPin size={13} /> Ort oder Link
                </button>
              </div>
            </div>

            {kind === 'voice' ? (
              <label className="announce-field">
                <span>Kanal</span>
                <select
                  className="input"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  disabled={!channels}
                >
                  {!channels && <option>Lade Kanäle …</option>}
                  {channels?.map((c) => (
                    <option key={c.id} value={c.id}>
                      🔊 {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="announce-field">
                <span>Ort</span>
                <input
                  className="input"
                  maxLength={100}
                  placeholder="z. B. Bei Mia, oder ein Link"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
            )}
            <p className="field-hint">
              Titel, Zeit und Notizen kommen aus dem Termin. Änderungen daran gehen automatisch zu Discord; löschst du den
              Termin, wird das Event nach einer Rückfrage abgesagt.
            </p>
          </>
        )}

        {error && <p className="field-error">{error}</p>}
        <div className="confirm-actions">
          <button className="btn btn-ghost sm" onClick={close}>
            Abbrechen
          </button>
          <button className="btn btn-primary sm" disabled={!ready || busy} onClick={() => void submit()}>
            {busy ? 'Wird angekündigt …' : 'Ankündigen'}
          </button>
        </div>
      </div>
    </div>
  )
}
