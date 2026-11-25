import { useEffect, useRef, useState } from 'react'
import { Archive, Coins, Lock, Moon, RotateCw, Sun, Sunrise, Sunset, Wand2 } from 'lucide-react'
import { ATTRS, attrLevel, attrXp, coinBalance } from '@shared/character'
import {
  FURNITURE,
  FURN_GROUPS,
  chest,
  findSpot,
  furnitureById,
  isSurface,
  ownsFurniture,
  rotated,
  surfaces,
  canPlace,
  type FurnGroup,
  type Furniture
} from '@shared/room'
import type { PlacedFurniture } from '@shared/types'
import { useStore } from '../../../store'
import { RoomScene } from './RoomScene'
import { FurniturePreview } from './FurniturePreview'
import { PHASE_LOOK, phaseAt, type Phase } from './iso'

type LightMode = 'auto' | Phase
const LIGHT_MODES: LightMode[] = ['auto', 'morning', 'day', 'evening', 'night']
const LIGHT_ICON = { morning: Sunrise, day: Sun, evening: Sunset, night: Moon }

/** pauses animation while the window is hidden */
export function useHidden(): boolean {
  const [hidden, setHidden] = useState(document.visibilityState === 'hidden')
  useEffect(() => {
    const on = (): void => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return hidden
}

export function useClockPhase(paused: boolean): Phase {
  const [phase, setPhase] = useState(() => phaseAt(new Date()))
  useEffect(() => {
    if (paused) return
    setPhase(phaseAt(new Date()))
    const t = window.setInterval(() => setPhase(phaseAt(new Date())), 60_000)
    return () => window.clearInterval(t)
  }, [paused])
  return phase
}

/** the room stage (view and edit mode) plus the chest and the furniture shop */
export function RoomView(): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const setRoomItems = useStore((s) => s.setRoomItems)
  const setSurface = useStore((s) => s.setRoomSurface)
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [light, setLight] = useState<LightMode>('auto')
  const [tab, setTab] = useState<'chest' | 'shop'>('chest')
  const stage = useRef<HTMLDivElement>(null)
  const hidden = useHidden()
  const clock = useClockPhase(hidden)
  const phase = light === 'auto' ? clock : light
  const items = ch.room.items
  const coins = coinBalance(ch)
  const sel = selected ? items.find((p) => p.id === selected) : undefined
  const selF = sel ? furnitureById(sel.id) : undefined

  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(null), 2600)
    return () => window.clearTimeout(t)
  }, [hint])

  const startEditing = (): void => {
    setEditing(true)
    stage.current?.focus()
  }
  const stopEditing = (): void => {
    setEditing(false)
    setSelected(null)
  }
  const replace = (p: PlacedFurniture, label: string): void =>
    setRoomItems(
      items.map((o) => (o.id === p.id ? p : o)),
      label
    )
  const place = (f: Furniture): void => {
    if (isSurface(f)) return setSurface(f.id)
    const spot = findSpot(ch.room, f)
    if (!spot) return setHint('Kein freier Platz. Lagere erst etwas in die Kiste.')
    setRoomItems([...items, spot], `${f.name} aufgestellt`)
    setEditing(true)
    setSelected(f.id)
    stage.current?.focus()
  }
  const store = (id: string): void => {
    const f = furnitureById(id)
    setRoomItems(
      items.filter((p) => p.id !== id),
      `${f?.name ?? 'Möbel'} eingelagert`
    )
    setSelected(null)
  }
  const turn = (): void => {
    if (!sel) return
    const next = rotated(ch.room, sel)
    if (!next) return setHint(selF?.kind === 'wall' ? 'Wandsachen lassen sich nicht drehen.' : 'Zum Drehen ist hier kein Platz.')
    replace(next, `${selF?.name ?? 'Möbel'} gedreht`)
  }
  const nudge = (dx: number, dy: number): void => {
    if (!sel || !selF) return
    const next = selF.kind === 'wall' ? { ...sel, x: sel.x + (dx || dy) } : { ...sel, x: sel.x + dx, y: sel.y + dy }
    if (canPlace(ch.room, next)) replace(next, `${selF.name} verschoben`)
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (!editing) return
    const k = e.key.toLowerCase()
    const map: Record<string, () => void> = {
      arrowleft: () => nudge(-1, 0),
      arrowright: () => nudge(1, 0),
      arrowup: () => nudge(0, -1),
      arrowdown: () => nudge(0, 1),
      r: turn,
      delete: () => sel && store(sel.id),
      backspace: () => sel && store(sel.id),
      escape: () => (selected ? setSelected(null) : stopEditing())
    }
    const fn = map[k]
    if (!fn || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    e.stopPropagation()
    fn()
  }

  const LightIcon = light === 'auto' ? LIGHT_ICON[clock] : LIGHT_ICON[light]
  return (
    <>
      <section className="room-stage card">
        <div className="char-stage-head">
          <div>
            <h1>{ch.name ? `Zimmer von ${ch.name}` : 'Dein Zimmer'}</h1>
            <p>{editing ? 'Einrichten: ziehen, R dreht, Entf lagert ein' : `${items.length} Dinge im Zimmer`}</p>
          </div>
          <div className="room-head-actions">
            <button
              className="btn btn-ghost sm"
              title="Licht: automatisch nach Uhrzeit oder fest"
              onClick={() => setLight(LIGHT_MODES[(LIGHT_MODES.indexOf(light) + 1) % LIGHT_MODES.length])}
            >
              <LightIcon size={15} /> {light === 'auto' ? `Auto (${PHASE_LOOK[clock].label})` : PHASE_LOOK[light].label}
            </button>
            <div className="char-coins" title="Coins zum Ausgeben">
              <Coins size={16} /> {coins.toLocaleString('de-DE')}
            </div>
            {editing ? (
              <button className="btn btn-primary sm" onClick={stopEditing}>
                Fertig
              </button>
            ) : (
              <button className="btn sm" onClick={startEditing}>
                <Wand2 size={14} /> Einrichten
              </button>
            )}
          </div>
        </div>
        <div className="room-canvas" ref={stage} tabIndex={0} onKeyDown={onKey} aria-label="Zimmer">
          <RoomScene
            items={items}
            wall={ch.room.wall}
            floor={ch.room.floor}
            look={ch.look}
            outfit={ch.outfit}
            phase={phase}
            editing={editing}
            selected={selected}
            onSelect={setSelected}
            onMove={(p) => replace(p, `${furnitureById(p.id)?.name ?? 'Möbel'} verschoben`)}
            paused={hidden}
          />
        </div>
        <div className={`room-toolbar ${editing ? '' : 'idle'}`}>
          {hint ? (
            <span className="room-hint">{hint}</span>
          ) : editing && sel && selF ? (
            <>
              <strong>{selF.name}</strong>
              {selF.kind !== 'wall' && (
                <button className="btn btn-ghost sm" onClick={turn} title="Drehen (R)">
                  <RotateCw size={14} /> Drehen
                </button>
              )}
              <button className="btn btn-ghost sm" onClick={() => store(sel.id)} title="In die Kiste (Entf)">
                <Archive size={14} /> Einlagern
              </button>
            </>
          ) : editing ? (
            <span className="room-hint">Möbel anklicken und auf eine Kachel ziehen. Pfeiltasten verschieben, Esc beendet.</span>
          ) : (
            <span className="room-hint">Gekauftes wartet in der Kiste. Nichts geht verloren, alles lässt sich jederzeit umräumen.</span>
          )}
        </div>
      </section>

      <section className="char-panel card">
        <div className="segmented" role="tablist" aria-label="Bereich">
          <button role="tab" aria-selected={tab === 'chest'} className={tab === 'chest' ? 'on' : ''} onClick={() => setTab('chest')}>
            Kiste
          </button>
          <button role="tab" aria-selected={tab === 'shop'} className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')}>
            Möbel-Shop
          </button>
        </div>
        {tab === 'chest' ? (
          <Chest onPlace={place} onPick={(id) => (startEditing(), setSelected(id))} selected={selected} />
        ) : (
          <FurnitureShop onPlace={place} coins={coins} />
        )}
      </section>
    </>
  )
}

function Chest({
  onPlace,
  onPick,
  selected
}: {
  onPlace(f: Furniture): void
  onPick(id: string): void
  selected: string | null
}): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const stored = chest(ch)
  return (
    <div className="shop">
      <div className="item-group">
        <h4>In der Kiste</h4>
        <div className="item-grid">
          {stored.length === 0 && (
            <p className="widget-settings-hint">Leer. Alles, was dir gehört, steht im Zimmer. Neues gibt es im Möbel-Shop.</p>
          )}
          {stored.map((f) => (
            <button key={f.id} className="item-tile" onClick={() => onPlace(f)} title={`${f.name} aufstellen`}>
              <FurniturePreview f={f} size={70} />
              <span className="item-name">{f.name}</span>
              <span className="item-price">Aufstellen</span>
            </button>
          ))}
        </div>
      </div>
      <SurfacePicker />
      <div className="item-group">
        <h4>Im Zimmer</h4>
        <div className="look-chips">
          {ch.room.items.map((p) => {
            const f = furnitureById(p.id)
            return f ? (
              <button key={p.id} className={`look-chip ${selected === p.id ? 'on' : ''}`} onClick={() => onPick(p.id)}>
                {f.name}
              </button>
            ) : null
          })}
        </div>
      </div>
    </div>
  )
}

/** owned wallpapers and floors, the ones in use marked */
function SurfacePicker(): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const setSurface = useStore((s) => s.setRoomSurface)
  const now = surfaces(ch.room)
  const owned = FURNITURE.filter((f) => isSurface(f) && ownsFurniture(ch, f))
  return (
    <div className="item-group">
      <h4>Tapeten und Böden</h4>
      <div className="item-grid">
        {owned.map((f) => {
          const on = now.wall.id === f.id || now.floor.id === f.id
          return (
            <button key={f.id} className={`item-tile ${on ? 'on' : ''}`} onClick={() => setSurface(f.id)} title={`${f.name} anbringen`}>
              <FurniturePreview f={f} size={70} />
              <span className="item-name">{f.name}</span>
              <span className="item-price">{on ? 'In Gebrauch' : 'Anbringen'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FurnitureShop({ onPlace, coins }: { onPlace(f: Furniture): void; coins: number }): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const buy = useStore((s) => s.buyFurniture)
  const pushToast = useStore((s) => s.pushToast)
  const [group, setGroup] = useState<FurnGroup>('small')
  const [pick, setPick] = useState<Furniture | null>(null)
  const [bought, setBought] = useState<Furniture | null>(null)
  const xp = attrXp(ch)
  const list = FURNITURE.filter((f) => f.group === group && !ownsFurniture(ch, f))
  const lockOf = (f: Furniture): string | null =>
    f.unlock && attrLevel(xp[f.unlock.attr]).level < f.unlock.level
      ? `${ATTRS.find((a) => a.id === f.unlock!.attr)?.name} Lv ${f.unlock.level}`
      : null

  return (
    <div className="shop">
      <div className="look-chips">
        {FURN_GROUPS.map((g) => (
          <button key={g.id} className={`look-chip ${group === g.id ? 'on' : ''}`} onClick={() => (setGroup(g.id), setPick(null))}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="item-grid">
        {list.length === 0 && <p className="widget-settings-hint">Alles aus dieser Ecke gehört schon dir.</p>}
        {list.map((f) => {
          const lock = lockOf(f)
          return (
            <button
              key={f.id}
              className={`item-tile ${pick?.id === f.id ? 'on' : ''}`}
              onClick={() => setPick(pick?.id === f.id ? null : f)}
              title={f.name}
            >
              <FurniturePreview f={f} size={70} />
              <span className="item-name">{f.name}</span>
              {lock ? (
                <span className="item-price locked">
                  <Lock size={11} /> {lock}
                </span>
              ) : (
                <span className={`item-price ${coins < f.price ? 'short' : ''}`}>
                  <Coins size={11} /> {f.price}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {pick && (
        <div className="shop-buy">
          <span>
            {pick.name} · <Coins size={12} /> {pick.price}
          </span>
          <button
            className="btn btn-primary sm"
            onClick={() => {
              if (buy(pick.id)) {
                setBought(pick)
                setPick(null)
              } else
                pushToast({
                  kind: 'info',
                  title: lockOf(pick) ? 'Noch gesperrt' : 'Noch nicht genug Coins',
                  body: `Du hast ${coins} Coins.`
                })
            }}
          >
            Kaufen
          </button>
        </div>
      )}
      {bought && !pick && (
        <div className="shop-buy">
          <span>{isSurface(bought) ? `${bought.name} gehört dir.` : `${bought.name} liegt in deiner Kiste.`}</span>
          <button className="btn sm" onClick={() => (onPlace(bought), setBought(null))}>
            {isSurface(bought) ? 'Gleich anbringen' : 'Gleich aufstellen'}
          </button>
        </div>
      )}
    </div>
  )
}
