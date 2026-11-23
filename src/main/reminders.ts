import { Notification } from 'electron'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { expandAll } from '@shared/recurrence'
import type { AppData, ReminderPayload } from '@shared/types'

const TICK_MS = 15_000
/** reminders missed while the app was closed are still shown if they are this fresh */
const STARTUP_GRACE_MS = 10 * 60_000

export class ReminderScheduler {
  private lastTick = Date.now() - STARTUP_GRACE_MS
  private fired = new Set<string>()
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly getData: () => AppData,
    private readonly onFire: (p: ReminderPayload, n: Notification | null) => void
  ) {}

  start(): void {
    this.tick()
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  /** re-check right away, e.g. after data changed */
  poke(): void {
    this.tick()
  }

  private tick(): void {
    const now = Date.now()
    const from = this.lastTick
    this.lastTick = now
    const data = this.getData()
    this.checkDeadlines(data, from, now)
    const visible = new Set(data.calendars.filter((c) => c.visible).map((c) => c.id))
    const events = data.events.filter((e) => e.reminders.length > 0 && visible.has(e.calendarId))
    if (events.length === 0) return

    const maxLead = Math.max(...events.flatMap((e) => e.reminders)) * 60_000
    const occs = expandAll(events, new Date(from - 60_000), new Date(now + maxLead + 60_000))

    for (const occ of occs) {
      for (const minutes of occ.event.reminders) {
        const fireAt = occ.start.getTime() - minutes * 60_000
        if (fireAt <= from || fireAt > now) continue
        const key = `${occ.key}::${minutes}`
        if (this.fired.has(key)) continue
        this.fired.add(key)
        this.fire({
          kind: 'event',
          id: occ.event.id,
          title: occ.event.title || '(Ohne Titel)',
          start: occ.start.toISOString(),
          minutesBefore: minutes,
          location: occ.event.location
        })
      }
    }
  }

  /** hard deadlines: the day before and on the day, at the configured hour */
  private checkDeadlines(data: AppData, from: number, now: number): void {
    const s = data.settings
    if (!s.deadlineReminders) return
    for (const t of data.todos) {
      if (t.done || !t.hardDeadline) continue
      const [y, m, d] = t.hardDeadline.split('-').map(Number)
      const dayOf = new Date(y, m - 1, d, s.deadlineReminderHour, 0, 0, 0)
      const dayBefore = new Date(y, m - 1, d - 1, s.deadlineReminderHour, 0, 0, 0)
      for (const [at, note] of [
        [dayBefore, 'Harte Deadline morgen'],
        [dayOf, 'Harte Deadline heute']
      ] as const) {
        const fireAt = at.getTime()
        if (fireAt <= from || fireAt > now) continue
        const key = `todo::${t.id}::${t.hardDeadline}::${fireAt}`
        if (this.fired.has(key)) continue
        this.fired.add(key)
        console.log(`[deadline] ${t.title} (${note})`)
        let n: Notification | null = null
        if (Notification.isSupported()) {
          n = new Notification({ title: `📅 ${t.title}`, body: note, silent: true })
          n.show()
        }
        this.onFire(
          { kind: 'todo', id: t.id, title: t.title, start: dayOf.toISOString(), minutesBefore: 0, note },
          n
        )
      }
    }
  }

  private fire(p: ReminderPayload): void {
    console.log(`[reminder] ${p.title} (${p.minutesBefore} min before ${p.start})`)
    const start = new Date(p.start)
    const when =
      p.minutesBefore === 0
        ? 'Jetzt'
        : `${format(start, 'HH:mm', { locale: de })} Uhr · in ${humanLead(p.minutesBefore)}`
    let n: Notification | null = null
    if (Notification.isSupported()) {
      n = new Notification({
        title: p.title,
        body: [when, p.location].filter(Boolean).join('\n'),
        silent: true // the app plays its own chime
      })
      n.show()
    }
    this.onFire(p, n)
  }
}

export function humanLead(min: number): string {
  if (min < 60) return `${min} Min.`
  if (min < 1440) {
    const h = Math.round(min / 60)
    return h === 1 ? '1 Stunde' : `${h} Stunden`
  }
  const d = Math.round(min / 1440)
  return d === 1 ? '1 Tag' : `${d} Tagen`
}
