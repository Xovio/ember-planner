import { useEffect, useRef, useState } from 'react'
import {
  availableIdles,
  findPath,
  idleById,
  idleDuration,
  idleTarget,
  nextIdle,
  walkable,
  type IdleDef,
  type IdleTarget,
  type Tile
} from '@shared/idle'
import { ROOM_SIZE, avatarSpot } from '@shared/room'
import type { Character } from '@shared/types'

/** what the room draws for the character right now */
export interface Actor {
  /** floor position (tile corner, may be between tiles while walking) */
  x: number
  y: number
  idle: IdleDef | null
  target: IdleTarget | null
  walking: boolean
}

const SPEED = 1.6 // tiles per second

/** a random free tile where nothing stands in front of the character (so it is not hidden) */
function strollSpot(room: Character['room'], rand: () => number): Tile | undefined {
  const free = walkable(room)
  const open = (x: number, y: number): boolean => x >= ROOM_SIZE || y >= ROOM_SIZE || free.has(`${x},${y}`)
  const all = [...free].map((k) => k.split(',').map(Number) as Tile)
  const clear = all.filter(([x, y]) => open(x + 1, y) && open(x, y + 1) && open(x + 1, y + 1))
  const pool = clear.length ? clear : all
  return pool[Math.floor(rand() * pool.length)]
}

const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Runs the idle animations: every 20–40 s the character picks something to do, walks there over
 * free tiles and does it. Stops while `enabled` is false (edit mode, hidden window); with reduced
 * motion it moves without walking. `play` asks for one idle right away.
 */
export function useIdleActor(ch: Character, enabled: boolean): { actor: Actor; play(id: string): void } {
  const room = ch.room
  const [actor, setActor] = useState<Actor>(() => ({ ...avatarSpot(room), idle: null, target: null, walking: false }))
  const ref = useRef(actor)
  ref.current = actor
  const chRef = useRef(ch)
  chRef.current = ch
  const timer = useRef<number | null>(null)
  const frame = useRef<number | null>(null)
  const [tick, setTick] = useState(0)
  const wish = useRef<string | null>(null)

  const stop = (): void => {
    if (timer.current) window.clearTimeout(timer.current)
    if (frame.current) cancelAnimationFrame(frame.current)
    timer.current = null
    frame.current = null
  }

  // the room changed under the character (furniture moved): start over from a free spot
  const layout = JSON.stringify(room.items)
  useEffect(() => {
    const free = walkable(room)
    const a = ref.current
    const here = `${Math.round(a.x)},${Math.round(a.y)}`
    const itemGone = a.target?.item && !room.items.some((p) => p.id === a.target!.item)
    if (!free.has(here) || itemGone) {
      stop()
      setActor({ ...avatarSpot(room), idle: null, target: null, walking: false })
      setTick((t) => t + 1)
    }
  }, [layout]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }
    const run = (): void => {
      const c = chRef.current
      const a = ref.current
      const from: Tile = [Math.round(a.x), Math.round(a.y)]
      const list = availableIdles(c)
      const wanted = wish.current ? list.find((d) => d.id === wish.current) : undefined
      wish.current = null
      const pick = wanted ?? nextIdle(list, a.idle?.id ?? null, c.idle?.pinned, Math.random)
      let idle = pick
      let target = idle ? idleTarget(c.room, idle, from, c.look.wheelchair) : null
      if (idle && !target) {
        // unreachable furniture: do a free one where we are
        idle = list.find((d) => !d.needs) ?? null
        target = idle ? idleTarget(c.room, idle, from) : null
      }
      // free idles sometimes stroll to another spot first
      if (idle && !idle.needs && target && Math.random() < 0.5) {
        const spot = strollSpot(c.room, Math.random)
        if (spot && findPath(c.room, from, spot)) target = { stand: spot, mirror: Math.random() < 0.5 }
      }
      if (!idle || !target) {
        timer.current = window.setTimeout(run, idleDuration(Math.random))
        return
      }
      const path = findPath(c.room, from, target.stand) ?? [target.stand]
      const act = (): void => {
        setActor({ x: target!.stand[0], y: target!.stand[1], idle, target, walking: false })
        timer.current = window.setTimeout(run, idleDuration(Math.random))
      }
      if (path.length <= 1 || reducedMotion()) return act()
      // walk: move along the path at a steady pace
      const start = performance.now()
      const total = (path.length - 1) / SPEED
      const step = (now: number): void => {
        const t = Math.min(total, (now - start) / 1000) * SPEED
        const i = Math.min(path.length - 2, Math.floor(t))
        const f = t - i
        const [ax, ay] = path[i]
        const [bx, by] = path[i + 1]
        const mirror = bx - by < ax - ay
        setActor({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, idle: null, target: { stand: target!.stand, mirror }, walking: true })
        if (t >= total) return act()
        frame.current = requestAnimationFrame(step)
      }
      frame.current = requestAnimationFrame(step)
    }
    // a short pause before the first idle, so opening the room is calm
    const delay = wish.current ? 0 : ref.current.idle ? idleDuration(Math.random) : 2500
    timer.current = window.setTimeout(run, delay)
    return stop
  }, [enabled, tick])

  // leaving edit mode or the window: stand still at the current spot
  useEffect(() => {
    if (!enabled) setActor((a) => ({ ...a, x: Math.round(a.x), y: Math.round(a.y), walking: false }))
  }, [enabled])

  const play = (id: string): void => {
    if (!idleById(id)) return
    wish.current = id
    stop()
    setTick((t) => t + 1)
  }
  return { actor, play }
}
