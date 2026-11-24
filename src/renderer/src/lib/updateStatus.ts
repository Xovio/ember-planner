import { useEffect, useState } from 'react'
import type { UpdateInfo } from '@shared/update'
import { api } from './api'

/** live auto-update state (null in the browser build or while loading) */
export function useUpdateInfo(): UpdateInfo | null {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  useEffect(() => {
    const updates = api.updates
    if (!updates) return
    let alive = true
    void updates.info().then((i) => alive && setInfo(i))
    const off = updates.onStatus(setInfo)
    return () => {
      alive = false
      off()
    }
  }, [])
  return info
}
