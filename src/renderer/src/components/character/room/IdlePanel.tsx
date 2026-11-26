import { Coins, Lock, Pin, Play } from 'lucide-react'
import { ATTRS, attrLevel, attrXp, coinBalance } from '@shared/character'
import { IDLES, idleFurniture, ownsIdle, type IdleDef } from '@shared/idle'
import { FURNITURE, ownsFurniture } from '@shared/room'
import { useStore } from '../../../store'

const furnitureNames = (d: IdleDef): string =>
  [...new Set((d.needs ?? []).map((s) => FURNITURE.find((f) => f.style === s)?.name.split(' ')[0] ?? s))].join(' oder ')

/** the idle animations: what the character does, what furniture brings, what can be learned */
export function IdlePanel({
  current,
  onPlay,
  reach
}: {
  current: string | null
  onPlay(id: string): void
  reach(d: IdleDef): boolean
}): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const buy = useStore((s) => s.buyIdle)
  const setPrefs = useStore((s) => s.setIdlePrefs)
  const pushToast = useStore((s) => s.pushToast)
  const coins = coinBalance(ch)
  const xp = attrXp(ch)
  const off = new Set(ch.idle?.off ?? [])
  const pinned = ch.idle?.pinned
  const lockOf = (d: IdleDef): string | null =>
    d.unlock && attrLevel(xp[d.unlock.attr]).level < d.unlock.level
      ? `${ATTRS.find((a) => a.id === d.unlock!.attr)?.name} Lv ${d.unlock.level}`
      : null

  const row = (d: IdleDef): React.JSX.Element => {
    const hasFurniture = !d.needs || FURNITURE.some((f) => d.needs!.includes(f.style) && ownsFurniture(ch, f))
    const owned = ownsIdle(ch, d) && hasFurniture
    const placed = !d.needs || idleFurniture(ch.room, d).length > 0
    const here = placed && reach(d)
    const on = owned && !off.has(d.id)
    const lock = lockOf(d)
    return (
      <li key={d.id} className={`idle-row ${current === d.id ? 'now' : ''}`}>
        <div className="idle-name">
          <strong>{d.name}</strong>
          <span className="muted">
            {d.starter
              ? 'Ab Werk'
              : d.needs
                ? !hasFurniture
                  ? `kommt mit ${furnitureNames(d)} aus dem Möbel-Shop`
                  : !placed
                    ? `braucht ${furnitureNames(d)} im Zimmer`
                    : here
                      ? `mit ${furnitureNames(d)}`
                      : 'Zugestellt: räum einen Weg frei'
                : owned
                  ? 'Gelernt'
                  : 'Im Shop'}
          </span>
        </div>
        {owned ? (
          <div className="idle-actions">
            <button className="icon-btn sm" title="Jetzt abspielen" disabled={!here || !on} onClick={() => onPlay(d.id)}>
              <Play size={14} />
            </button>
            <button
              className={`icon-btn sm ${pinned === d.id ? 'on' : ''}`}
              title={pinned === d.id ? 'Nicht mehr festhalten' : 'Immer diese spielen'}
              onClick={() => setPrefs({ pinned: pinned === d.id ? undefined : d.id })}
            >
              <Pin size={14} />
            </button>
            <label className="toggle" title={on ? 'Ausschalten' : 'Einschalten'}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => setPrefs({ off: on ? [...off, d.id] : [...off].filter((x) => x !== d.id) })}
              />
              <span className="toggle-track" />
            </label>
          </div>
        ) : d.needs ? null : lock ? (
          <span className="item-price locked">
            <Lock size={11} /> {lock}
          </span>
        ) : (
          <button
            className="btn sm"
            onClick={() => {
              if (!buy(d.id)) pushToast({ kind: 'info', title: 'Noch nicht genug Coins', body: `Du hast ${coins} Coins.` })
            }}
          >
            <Coins size={12} /> {d.price}
          </button>
        )}
      </li>
    )
  }

  return (
    <div className="shop idle-panel">
      <p className="widget-settings-hint">
        Dein Charakter sucht sich alle 20 bis 40 Sekunden etwas aus. Möbel bringen eigene Animationen mit, weitere lernst du mit Coins.
      </p>
      <div className="item-group">
        <h4>Freie Animationen</h4>
        <ul className="idle-list">{IDLES.filter((d) => !d.needs).map(row)}</ul>
      </div>
      <div className="item-group">
        <h4>Mit Möbeln</h4>
        <ul className="idle-list">{IDLES.filter((d) => d.needs).map(row)}</ul>
      </div>
    </div>
  )
}
