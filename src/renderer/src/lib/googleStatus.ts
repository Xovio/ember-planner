import { useEffect, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { de } from 'date-fns/locale'
import type { GoogleStatus } from '@shared/google'
import { api } from './api'

/** live Google connection + sync state (null in the browser build or while loading) */
export function useGoogleStatus(): GoogleStatus | null {
  const [status, setStatus] = useState<GoogleStatus | null>(null)
  useEffect(() => {
    const google = api.google
    if (!google) return
    let alive = true
    void google.status().then((s) => alive && setStatus(s))
    const off = google.onStatus(setStatus)
    return () => {
      alive = false
      off()
    }
  }, [])
  return status
}

/** "vor 3 Minuten" – re-rendered every 30 s by the caller's tick */
export function lastSyncLabel(iso: string | undefined): string {
  if (!iso) return 'noch nie'
  const ms = Date.now() - Date.parse(iso)
  if (ms < 45_000) return 'gerade eben'
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: de })
}

/** forces a re-render every `ms` so relative times stay fresh */
export function useTick(ms = 30_000): void {
  const [, set] = useState(0)
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}
