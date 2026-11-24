import { Coins } from 'lucide-react'
import { ATTRS, attrLevel, attrXp, characterLevel, coinBalance } from '@shared/character'
import { useStore } from '../../store'
import { Avatar } from '../character/Avatar'

/** the character at a glance: avatar, level, coins and the three strongest attributes */
export function CharacterWidget(): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const setPage = useStore((s) => s.setPage)
  const xp = attrXp(ch)
  const top = [...ATTRS].sort((a, b) => xp[b.id] - xp[a.id]).slice(0, 3)
  return (
    <section className="card widget char-card">
      <div className="widget-head">
        <div>
          <h3>{ch.name || 'Dein Charakter'}</h3>
          <p>Level {characterLevel(ch)}</p>
        </div>
        <div className="char-coins">
          <Coins size={14} /> {coinBalance(ch).toLocaleString('de-DE')}
        </div>
      </div>
      <div className="char-card-body">
        <button className="char-card-avatar" onClick={() => setPage('character')} title="Zum Charakter">
          <Avatar look={ch.look} outfit={ch.outfit} expression="happy" animate size={110} />
        </button>
        <ul className="char-attrs compact">
          {top.map((a) => {
            const lv = attrLevel(xp[a.id])
            return (
              <li key={a.id}>
                <span className="char-attr-name">{a.name}</span>
                <span className="char-attr-level">Lv {lv.level}</span>
                <span className="prep-goal-bar">
                  <span style={{ width: `${((xp[a.id] - lv.from) / (lv.to - lv.from)) * 100}%` }} />
                </span>
              </li>
            )
          })}
          {!ch.created && (
            <li className="char-card-cta">
              <button className="link-btn" onClick={() => setPage('character')}>
                Charakter gestalten →
              </button>
            </li>
          )}
        </ul>
      </div>
    </section>
  )
}
