import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../../store'
import { COMPANION_ACTIONS, activityAt, type CurrentActivity } from '@shared/activity'
import { IDLES, idleById, ownsIdle } from '@shared/idle'
import { outfitForTag, wearable } from '@shared/outfits'
import { Avatar, type Expression } from './Avatar'

/**
 * The character small in the corner of every page but its own. It does little things on its own
 * and mirrors what is in the calendar right now (and a while after), e.g. curls dumbbells during "Gym".
 * Folds down to a small tab; switched off in the options.
 */

const SIT: Record<string, 'stand' | 'chair' | 'floor'> = { write: 'chair' }
const EXPRESSION: Record<string, Expression> = {
  nap: 'sleepy',
  relax: 'sleepy',
  meditate: 'proud',
  yoga: 'proud',
  lift: 'proud',
  dance: 'happy',
  hop: 'happy'
}
const time = (d: Date): string => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
const nextDelay = (): number => 20_000 + Math.random() * 20_000

export function Companion(): React.JSX.Element | null {
  const data = useStore((s) => s.data)
  const page = useStore((s) => s.page)
  const updateSettings = useStore((s) => s.updateSettings)
  const setPage = useStore((s) => s.setPage)
  const ch = data?.character
  const show = !!ch?.created && data?.settings.companion !== false && page !== 'character'
  const open = data?.settings.companionOpen !== false

  const [now, setNow] = useState(() => new Date())
  const [hidden, setHidden] = useState(document.hidden)
  const [action, setAction] = useState<string | null>(null)
  const [cheer, setCheer] = useState(false)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000)
    const vis = (): void => setHidden(document.hidden)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  const events = data?.events
  const activity: CurrentActivity | null = useMemo(() => (events ? activityAt(events, now) : null), [events, now])

  // free animations it owns and has not switched off (no furniture down here)
  const free = useMemo(
    () => (ch ? IDLES.filter((d) => !d.needs && ownsIdle(ch, d) && !(ch.idle?.off ?? []).includes(d.id)).map((d) => d.id) : []),
    [ch]
  )

  // a new little thing every 20–40 s; with an activity two out of three rounds match it
  const pickRef = useRef<() => void>(() => {})
  pickRef.current = () => {
    const fromActivity = activity ? COMPANION_ACTIONS[activity.tag][activity.phase] : []
    const pool = fromActivity.length > 0 && Math.random() < 2 / 3 ? fromActivity : free
    const options = pool.filter((a) => a !== action)
    setAction(options.length > 0 ? options[Math.floor(Math.random() * options.length)] : (pool[0] ?? null))
  }
  useEffect(() => {
    if (!show || !open || hidden) return
    let t = window.setTimeout(function tick() {
      pickRef.current()
      t = window.setTimeout(tick, nextDelay())
    }, 1200)
    return () => window.clearTimeout(t)
  }, [show, open, hidden])

  // a new activity starts: switch right away
  const tag = activity ? `${activity.tag}/${activity.phase}` : ''
  useEffect(() => {
    if (show && open) pickRef.current()
  }, [tag]) // eslint-disable-line react-hooks/exhaustive-deps

  // a little cheer whenever something earns points (ToDo, goal, session …)
  const points = data ? Object.keys(data.points.entries).length : 0
  const lastPoints = useRef(points)
  useEffect(() => {
    if (points > lastPoints.current) {
      setCheer(true)
      const t = window.setTimeout(() => setCheer(false), 3500)
      lastPoints.current = points
      return () => window.clearTimeout(t)
    }
    lastPoints.current = points
    return undefined
  }, [points])

  if (!show || !ch) return null

  const name = ch.name.trim() || 'Deine Figur'
  const tagged = outfitForTag(ch.outfits, activity?.tag)
  const outfit = tagged ? wearable(tagged.items, ch) : ch.outfit
  const act = cheer ? undefined : (action ?? undefined)
  const sit = act ? (SIT[act] ?? (idleById(act)?.sit === 'seat' ? 'stand' : (idleById(act)?.sit ?? 'stand'))) : 'stand'
  const note = cheer
    ? 'Geschafft! 🎉'
    : activity
      ? activity.phase === 'during'
        ? `${COMPANION_ACTIONS[activity.tag].verb} – ${activity.title} bis ${time(activity.end)}`
        : `nach „${activity.title}“`
      : (idleById(act)?.name ?? '')

  if (!open) {
    return (
      <div className="companion">
        <button className="companion-tab" onClick={() => updateSettings({ companionOpen: true })} title="Begleiter aufklappen">
          <span className="companion-face" aria-hidden>
            <span className="companion-face-inner">
              <Avatar look={ch.look} outfit={outfit} size={72} expression="happy" />
            </span>
          </span>
          {name}
          <ChevronUp size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="companion">
      <div className="companion-card" role="complementary" aria-label="Begleiter">
        <div className="companion-head">
          <span>{name}</span>
          <button onClick={() => updateSettings({ companionOpen: false })} title="Zuklappen" aria-label="Begleiter zuklappen">
            <ChevronDown size={14} />
          </button>
        </div>
        <div className="companion-figure" onClick={() => setPage('character')} title="Zum Charakter">
          <Avatar
            look={ch.look}
            outfit={outfit}
            size={110}
            animate={!hidden}
            pose="rest"
            action={act}
            sit={sit}
            expression={cheer ? 'cheer' : (EXPRESSION[act ?? ''] ?? 'content')}
            title={note || name}
          />
        </div>
        <div className="companion-note">{note}</div>
      </div>
    </div>
  )
}
