import { useEffect } from 'react'
import type { AppTimeLog } from '@shared/apptime'
import { reconcilePoints, type SessionRule } from '@shared/points'
import { guessCampaign } from '@shared/session'
import type { AppData } from '@shared/types'
import { useStore } from '../store'
import { api } from './api'

const SESSION_WIDGET_ID = 'session-countdown'
const RECHECK_MS = 5 * 60_000

/** the same session rule the countdown widget uses (its stored choice or the guessed campaign calendar) */
function sessionRule(data: AppData): SessionRule {
  const cfg = (data.settings.widgetConfig?.[SESSION_WIDGET_ID] ?? {}) as { calendarId?: string | null; keyword?: string }
  return {
    calendarId: cfg.calendarId ?? guessCampaign(data.calendars, 'dnd'),
    keyword: cfg.keyword ?? 'Session'
  }
}

/**
 * Keeps the points ledger in step with the data: after every change, when the prep log grows,
 * and every few minutes (sessions end, a new week needs its fixed goal times).
 */
export function usePointsSync(): void {
  useEffect(() => {
    let prep: AppTimeLog | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let ready = false

    const run = (): void => {
      timer = null
      const st = useStore.getState()
      const data = st.data
      if (!data) return
      const next = reconcilePoints(data, { now: new Date(), session: sessionRule(data), prep })
      if (next === data.points) return
      // a small cheer for new points, but not for what was caught up on start
      if (ready) {
        const gained = Object.entries(next.entries)
          .filter(([k]) => !(k in data.points.entries))
          .reduce((s, [, e]) => s + e.points, 0)
        if (gained > 0) st.pushToast({ kind: 'info', title: `+${gained} Punkte` })
      }
      st.setPoints(next)
    }
    const schedule = (): void => {
      if (!timer) timer = setTimeout(run, 400)
    }

    const unsub = useStore.subscribe((s, prev) => {
      if (!s.data || s.data === prev.data) return
      const d = s.data
      const p = prev.data
      if (!p || d.todos !== p.todos || d.events !== p.events || d.goals !== p.goals) schedule()
      if (!p) setTimeout(() => (ready = true), 1500)
    })
    const offPrep = api.appTime?.onUpdate((s) => {
      prep = s.log
      schedule()
    })
    void api.appTime?.get().then((s) => {
      prep = s.log
      schedule()
    })
    const tick = setInterval(() => {
      useStore.getState().fillGoalSlots()
      schedule()
    }, RECHECK_MS)
    if (useStore.getState().data) {
      schedule()
      setTimeout(() => (ready = true), 1500)
    }

    return () => {
      unsub()
      offPrep?.()
      clearInterval(tick)
      if (timer) clearTimeout(timer)
    }
  }, [])
}
