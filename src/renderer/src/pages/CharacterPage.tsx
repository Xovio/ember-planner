import { useMemo, useState } from 'react'
import { Coins, Lock, Sparkles } from 'lucide-react'
import {
  ATTRS,
  attrLevel,
  attrXp,
  categoryAttr,
  characterLevel,
  coinBalance,
  goalAttr
} from '@shared/character'
import {
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  ITEMS,
  SKIN_TONES,
  SLOTS,
  type Item,
  type Slot
} from '@shared/wardrobe'
import type { AttrId, AvatarLook } from '@shared/types'
import { useStore } from '../store'
import { calVar } from '../lib/theme'
import { fmt } from '../lib/dates'
import { Avatar, type Expression } from '../components/character/Avatar'

type Tab = 'look' | 'wardrobe' | 'shop' | 'attrs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'look', label: 'Aussehen' },
  { id: 'wardrobe', label: 'Kleiderschrank' },
  { id: 'shop', label: 'Shop' },
  { id: 'attrs', label: 'Attribute' }
]

const BUILDS = ['schmal', 'mittel', 'breit']

/** the character: look (free), wardrobe, shop with coins, attributes and where they come from */
export function CharacterPage(): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const update = useStore((s) => s.updateCharacter)
  const [tab, setTab] = useState<Tab>(ch.created ? 'wardrobe' : 'look')
  const [tryOn, setTryOn] = useState<Item | null>(null)
  const [mood, setMood] = useState<Expression>('happy')
  const xp = useMemo(() => attrXp(ch), [ch])
  const coins = coinBalance(ch)
  const outfit = tryOn ? { ...ch.outfit, [tryOn.slot]: tryOn.id } : ch.outfit
  const recent = useMemo(
    () =>
      Object.entries(ch.rewards)
        .map(([k, r]) => ({ k, ...r, at: r.at.length === 19 ? new Date(r.at).toISOString() : r.at }))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 6),
    [ch.rewards]
  )

  return (
    <div className="character-page">
      <section className="char-stage card">
        <div className="char-stage-head">
          <div>
            <h1>{ch.name || 'Dein Charakter'}</h1>
            <p>Level {characterLevel(ch)}</p>
          </div>
          <div className="char-coins" title="Coins zum Ausgeben">
            <Coins size={16} /> {coins.toLocaleString('de-DE')}
          </div>
        </div>
        <div className="char-avatar">
          <Avatar look={ch.look} outfit={outfit} expression={mood} animate size={230} title={ch.name || 'Dein Charakter'} />
          {tryOn && <span className="char-tryon">Anprobe: {tryOn.name}</span>}
        </div>
        <div className="segmented small char-moods" role="tablist" aria-label="Stimmung">
          {(
            [
              ['content', 'Zufrieden'],
              ['happy', 'Fröhlich'],
              ['proud', 'Stolz'],
              ['cheer', 'Jubel'],
              ['sleepy', 'Müde']
            ] as [Expression, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={mood === id} className={mood === id ? 'on' : ''} onClick={() => setMood(id)}>
              {label}
            </button>
          ))}
        </div>
        <ul className="char-attrs">
          {ATTRS.map((a) => {
            const lv = attrLevel(xp[a.id])
            return (
              <li key={a.id} title={`${a.hint} · ${xp[a.id]} XP`}>
                <span className="char-attr-name">{a.name}</span>
                <span className="char-attr-level">Lv {lv.level}</span>
                <span className="prep-goal-bar">
                  <span style={{ width: `${((xp[a.id] - lv.from) / (lv.to - lv.from)) * 100}%` }} />
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="char-panel card">
        {!ch.created && (
          <div className="char-welcome">
            <Sparkles size={18} />
            <div>
              <strong>Gestalte deinen Charakter</strong>
              <p>Aussehen kostet nie etwas und lässt sich jederzeit ändern. Kleidung kaufst du mit Coins aus erledigten ToDos, Zielen und Sessions.</p>
            </div>
            <button className="btn btn-primary sm" onClick={() => (update({ created: true }, 'Charakter erstellt'), setTab('shop'))}>
              Fertig
            </button>
          </div>
        )}
        <div className="segmented" role="tablist" aria-label="Bereich">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'on' : ''}
              onClick={() => {
                setTab(t.id)
                setTryOn(null)
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="char-tab">
          {tab === 'look' && <LookEditor look={ch.look} name={ch.name} onChange={(look, name) => update({ look, name })} />}
          {tab === 'wardrobe' && <Wardrobe />}
          {tab === 'shop' && <Shop tryOn={tryOn} setTryOn={setTryOn} />}
          {tab === 'attrs' && <AttrSources />}
        </div>
        {recent.length > 0 && (
          <div className="char-recent">
            <h4>Zuletzt verdient</h4>
            <ul className="points-recent">
              {recent.map((r) => (
                <li key={r.k}>
                  <span className="points-kind">{r.attr ? ATTRS.find((a) => a.id === r.attr)?.name : 'Coins'}</span>
                  <span className="points-label">{r.label}</span>
                  <span className="muted">{fmt(new Date(r.at), 'd. MMM')}</span>
                  <strong>+{r.coins}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

function LookEditor({ look, name, onChange }: { look: AvatarLook; name: string; onChange(look: AvatarLook, name: string): void }): React.JSX.Element {
  const set = (p: Partial<AvatarLook>): void => onChange({ ...look, ...p }, name)
  return (
    <div className="look-editor">
      <label className="look-row">
        <span>Name</span>
        <input className="input sm" value={name} placeholder="Wie heißt dein Charakter?" onChange={(e) => onChange(look, e.target.value)} />
      </label>
      <div className="look-row">
        <span>Hautton</span>
        <div className="look-swatches">
          {SKIN_TONES.map((c, i) => (
            <button key={c} className={`swatch ${look.skin === i ? 'on' : ''}`} style={{ '--c': c } as React.CSSProperties} onClick={() => set({ skin: i })} aria-label={`Hautton ${i + 1}`} />
          ))}
        </div>
      </div>
      <div className="look-row">
        <span>Frisur</span>
        <div className="look-chips">
          {HAIR_STYLES.map((h) => (
            <button key={h.id} className={`look-chip ${look.hair === h.id ? 'on' : ''}`} onClick={() => set({ hair: h.id })}>
              {h.name}
            </button>
          ))}
        </div>
      </div>
      <div className="look-row">
        <span>Haarfarbe</span>
        <div className="look-swatches">
          {Object.entries(HAIR_COLORS).map(([id, c]) => (
            <button key={id} className={`swatch ${look.hairColor === id ? 'on' : ''}`} style={{ '--c': c } as React.CSSProperties} onClick={() => set({ hairColor: id })} aria-label={`Haarfarbe ${id}`} />
          ))}
        </div>
      </div>
      <div className="look-row">
        <span>Augen</span>
        <div className="look-swatches">
          {Object.entries(EYE_COLORS).map(([id, c]) => (
            <button key={id} className={`swatch ${look.eyes === id ? 'on' : ''}`} style={{ '--c': c } as React.CSSProperties} onClick={() => set({ eyes: id })} aria-label={`Augenfarbe ${id}`} />
          ))}
        </div>
      </div>
      <div className="look-row">
        <span>Statur</span>
        <div className="segmented small">
          {BUILDS.map((label, i) => (
            <button key={label} className={look.build === i ? 'on' : ''} onClick={() => set({ build: i })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="look-row">
        <span>Extras</span>
        <div className="look-chips">
          <button className={`look-chip ${look.glasses ? 'on' : ''}`} onClick={() => set({ glasses: !look.glasses })}>
            Brille
          </button>
          <button className={`look-chip ${look.hearingAid ? 'on' : ''}`} onClick={() => set({ hearingAid: !look.hearingAid })}>
            Hörgerät
          </button>
        </div>
      </div>
      <p className="widget-settings-hint">Aussehen ist immer kostenlos. Coins gibt es nur für Kleidung und später fürs Zimmer.</p>
    </div>
  )
}

function ItemTile({ it, active, onClick, children }: { it: Item; active: boolean; onClick(): void; children?: React.ReactNode }): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  return (
    <button className={`item-tile ${active ? 'on' : ''}`} onClick={onClick} title={it.name}>
      <Avatar look={ch.look} outfit={{ ...ch.outfit, [it.slot]: it.id }} size={70} title={it.name} />
      <span className="item-name">{it.name}</span>
      {children}
    </button>
  )
}

function Wardrobe(): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const equip = useStore((s) => s.equip)
  return (
    <div className="wardrobe">
      {SLOTS.map((slot) => {
        const owned = ITEMS.filter((i) => i.slot === slot.id && ch.owned.includes(i.id))
        if (owned.length === 0 && !slot.optional) return null
        return (
          <div key={slot.id} className="item-group">
            <h4>{slot.name}</h4>
            <div className="item-grid">
              {slot.optional && (
                <button className={`item-tile none ${!ch.outfit[slot.id] ? 'on' : ''}`} onClick={() => equip(slot.id, null)}>
                  <span className="item-none">–</span>
                  <span className="item-name">Nichts</span>
                </button>
              )}
              {owned.map((it) => (
                <ItemTile key={it.id} it={it} active={ch.outfit[slot.id] === it.id} onClick={() => equip(slot.id, it.id)} />
              ))}
              {owned.length === 0 && <p className="widget-settings-hint">Noch nichts – schau im Shop vorbei.</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Shop({ tryOn, setTryOn }: { tryOn: Item | null; setTryOn(i: Item | null): void }): React.JSX.Element {
  const ch = useStore((s) => s.data!.character)
  const buy = useStore((s) => s.buyItem)
  const pushToast = useStore((s) => s.pushToast)
  const coins = coinBalance(ch)
  const xp = attrXp(ch)
  const [slot, setSlot] = useState<Slot>('top')
  const items = ITEMS.filter((i) => i.slot === slot && !ch.owned.includes(i.id))
  return (
    <div className="shop">
      <div className="look-chips">
        {SLOTS.map((s) => (
          <button key={s.id} className={`look-chip ${slot === s.id ? 'on' : ''}`} onClick={() => setSlot(s.id)}>
            {s.name}
          </button>
        ))}
      </div>
      <div className="item-grid">
        {items.length === 0 && <p className="widget-settings-hint">Alles aus dieser Ecke gehört schon dir.</p>}
        {items.map((it) => {
          const locked = it.unlock && attrLevel(xp[it.unlock.attr]).level < it.unlock.level
          const lockText = it.unlock ? `${ATTRS.find((a) => a.id === it.unlock!.attr)?.name} Lv ${it.unlock.level}` : ''
          return (
            <ItemTile key={it.id} it={it} active={tryOn?.id === it.id} onClick={() => setTryOn(tryOn?.id === it.id ? null : it)}>
              {locked ? (
                <span className="item-price locked">
                  <Lock size={11} /> {lockText}
                </span>
              ) : (
                <span className={`item-price ${coins < it.price ? 'short' : ''}`}>
                  <Coins size={11} /> {it.price}
                </span>
              )}
            </ItemTile>
          )
        })}
      </div>
      {tryOn && (
        <div className="shop-buy">
          <span>
            {tryOn.name} · <Coins size={12} /> {tryOn.price}
          </span>
          <button
            className="btn btn-primary sm"
            onClick={() => {
              if (buy(tryOn.id)) setTryOn(null)
              else
                pushToast({
                  kind: 'info',
                  title: tryOn.unlock && attrLevel(xp[tryOn.unlock.attr]).level < tryOn.unlock.level ? 'Noch gesperrt' : 'Noch nicht genug Coins',
                  body: `Du hast ${coins} Coins.`
                })
            }}
          >
            Kaufen
          </button>
        </div>
      )}
    </div>
  )
}

/** which category and weekly goal feeds which attribute */
function AttrSources(): React.JSX.Element {
  const data = useStore((s) => s.data!)
  const upsertCategory = useStore((s) => s.upsertCategory)
  const upsertGoal = useStore((s) => s.upsertGoal)
  const goals = data.goals.filter((g) => !g.archived)
  const select = (value: AttrId | null, onChange: (v: AttrId | null) => void): React.JSX.Element => (
    <select className="input sm" value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as AttrId | null)}>
      <option value="">– keins –</option>
      {ATTRS.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  )
  return (
    <div className="attr-sources">
      <p className="widget-settings-hint">
        Erledigte ToDos geben Coins nach Schwierigkeit × Zeit (abgehakter Zeitblock, sonst Schätzung) und Erfahrung für das Attribut
        ihrer Kategorie. Ohne Kategorie wächst Ordnung. Ziel-Bausteine, Sessions (Sozial) und Prep-Stunden (Kreativität) zählen auch.
      </p>
      <h4>Kategorien</h4>
      {data.categories.map((c) => (
        <div key={c.id} className="attr-row" style={{ '--c': calVar(c.color) } as React.CSSProperties}>
          <span className="cat-tag">
            <i />
            {c.name}
          </span>
          {select(categoryAttr(c), (v) => upsertCategory({ ...c, attribute: v }))}
        </div>
      ))}
      {goals.length > 0 && <h4>Wochenziele</h4>}
      {goals.map((g) => (
        <div key={g.id} className="attr-row">
          <span>{g.title}</span>
          {select(goalAttr(g), (v) => upsertGoal({ ...g, attribute: v }))}
        </div>
      ))}
    </div>
  )
}
