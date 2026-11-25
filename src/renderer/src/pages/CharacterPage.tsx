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
  BEARDS,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  LOOK_PRESETS,
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
import { Avatar, LOOK_DEFAULTS, type Expression } from '../components/character/Avatar'
import { RoomView } from '../components/character/room/RoomView'

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
  const [view, setView] = useState<'figure' | 'room'>(ch.created ? 'room' : 'figure')
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

  const switcher = (
    <div className="segmented char-view" role="tablist" aria-label="Ansicht">
      <button role="tab" aria-selected={view === 'room'} className={view === 'room' ? 'on' : ''} onClick={() => setView('room')}>
        Zimmer
      </button>
      <button role="tab" aria-selected={view === 'figure'} className={view === 'figure' ? 'on' : ''} onClick={() => setView('figure')}>
        Figur und Kleidung
      </button>
    </div>
  )

  if (view === 'room')
    return (
      <div className="character-page room-mode">
        {switcher}
        <RoomView />
      </div>
    )

  return (
    <div className="character-page">
      {switcher}
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

type Opt<T> = [T, string][]

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: Opt<T>; onChange(v: T): void }): React.JSX.Element {
  return (
    <div className="segmented small">
      {options.map(([v, label]) => (
        <button key={String(v)} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

/** palette swatches plus a free colour picker; `custom` is the picked colour when it is not from the palette */
function Swatches({
  colors,
  active,
  custom,
  label,
  onPick,
  onCustom
}: {
  colors: [string, string][]
  active: string | null
  custom: string | null
  label: string
  onPick(id: string): void
  onCustom(hex: string): void
}): React.JSX.Element {
  return (
    <div className="look-swatches">
      {colors.map(([id, c]) => (
        <button key={id} className={`swatch ${active === id ? 'on' : ''}`} style={{ '--c': c } as React.CSSProperties} onClick={() => onPick(id)} aria-label={`${label} ${id}`} />
      ))}
      <label className={`swatch look-picker ${custom ? 'on' : ''}`} style={{ '--c': custom ?? 'transparent' } as React.CSSProperties} title="Eigene Farbe">
        <input type="color" value={custom ?? colors[0][1]} onChange={(e) => onCustom(e.target.value)} aria-label={`${label}: eigene Farbe`} />
      </label>
    </div>
  )
}

const BODY_OPTS: Opt<AvatarLook['body']> = [
  ['straight', 'gerade'],
  ['curvy', 'kurvig'],
  ['broad', 'breite Schultern']
]
const HEIGHT_OPTS: Opt<number> = [
  [0, 'klein'],
  [1, 'mittel'],
  [2, 'groß']
]
const FACE_OPTS: Opt<AvatarLook['face']> = [
  ['round', 'rund'],
  ['oval', 'oval'],
  ['square', 'kantig']
]
const EYE_OPTS: Opt<AvatarLook['eyeShape']> = [
  ['round', 'rund'],
  ['almond', 'mandel'],
  ['soft', 'sanft']
]
const BROW_OPTS: Opt<AvatarLook['brows']> = [
  ['thin', 'fein'],
  ['soft', 'mittel'],
  ['thick', 'kräftig']
]
const MAKEUP_OPTS: Opt<AvatarLook['makeup']> = [
  ['none', 'keins'],
  ['lips', 'Lippen'],
  ['liner', 'Lidstrich'],
  ['both', 'beides']
]

const isHex = (v: string): string | null => (/^#[0-9a-f]{6}$/i.test(v) ? v : null)

function LookEditor({ look: raw, name, onChange }: { look: AvatarLook; name: string; onChange(look: AvatarLook, name: string): void }): React.JSX.Element {
  const look = { ...LOOK_DEFAULTS, ...raw }
  const set = (p: Partial<AvatarLook>): void => onChange({ ...look, ...p }, name)
  const flag = (key: 'lashes' | 'blush' | 'freckles' | 'mole' | 'glasses' | 'hearingAid' | 'wheelchair', label: string): React.JSX.Element => (
    <button className={`look-chip ${look[key] ? 'on' : ''}`} onClick={() => set({ [key]: !look[key] })}>
      {label}
    </button>
  )
  const row = (label: string, child: React.ReactNode): React.JSX.Element => (
    <div className="look-row">
      <span>{label}</span>
      {child}
    </div>
  )
  return (
    <div className="look-editor">
      <label className="look-row">
        <span>Name</span>
        <input className="input sm" value={name} placeholder="Wie heißt dein Charakter?" onChange={(e) => onChange(look, e.target.value)} />
      </label>
      {row(
        'Schnellstart',
        <div className="look-chips">
          {LOOK_PRESETS.map((p) => (
            <button key={p.id} className="look-chip" onClick={() => set(p.look)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <p className="widget-settings-hint look-hint">Vorlagen setzen nur ein paar Formen. Jedes Merkmal lässt sich danach frei kombinieren.</p>

      <h4 className="look-section">Körper</h4>
      {row('Statur', <Seg value={look.build} options={BUILDS.map((l, i) => [i, l])} onChange={(build) => set({ build })} />)}
      {row('Körperform', <Seg value={look.body} options={BODY_OPTS} onChange={(body) => set({ body })} />)}
      {row('Größe', <Seg value={look.height} options={HEIGHT_OPTS} onChange={(height) => set({ height })} />)}
      {row(
        'Hautton',
        <Swatches
          colors={SKIN_TONES.map((c, i) => [String(i), c])}
          active={look.skinHex ? null : String(look.skin)}
          custom={look.skinHex ?? null}
          label="Hautton"
          onPick={(i) => set({ skin: Number(i), skinHex: undefined })}
          onCustom={(c) => set({ skinHex: c })}
        />
      )}

      <h4 className="look-section">Gesicht</h4>
      {row('Gesichtsform', <Seg value={look.face} options={FACE_OPTS} onChange={(face) => set({ face })} />)}
      {row('Augenform', <Seg value={look.eyeShape} options={EYE_OPTS} onChange={(eyeShape) => set({ eyeShape })} />)}
      {row(
        'Augenfarbe',
        <Swatches
          colors={Object.entries(EYE_COLORS)}
          active={EYE_COLORS[look.eyes] ? look.eyes : null}
          custom={isHex(look.eyes)}
          label="Augenfarbe"
          onPick={(eyes) => set({ eyes })}
          onCustom={(eyes) => set({ eyes })}
        />
      )}
      {row('Brauen', <Seg value={look.brows} options={BROW_OPTS} onChange={(brows) => set({ brows })} />)}
      {row('Make-up', <Seg value={look.makeup} options={MAKEUP_OPTS} onChange={(makeup) => set({ makeup })} />)}
      {row(
        'Details',
        <div className="look-chips">
          {flag('lashes', 'Wimpern')}
          {flag('blush', 'Wangenröte')}
          {flag('freckles', 'Sommersprossen')}
          {flag('mole', 'Muttermal')}
        </div>
      )}

      <h4 className="look-section">Haare</h4>
      {row(
        'Frisur',
        <div className="look-chips">
          {HAIR_STYLES.map((h) => (
            <button key={h.id} className={`look-chip ${look.hair === h.id ? 'on' : ''}`} onClick={() => set({ hair: h.id })}>
              {h.name}
            </button>
          ))}
        </div>
      )}
      {row(
        'Haarfarbe',
        <Swatches
          colors={Object.entries(HAIR_COLORS)}
          active={HAIR_COLORS[look.hairColor] ? look.hairColor : null}
          custom={isHex(look.hairColor)}
          label="Haarfarbe"
          onPick={(hairColor) => set({ hairColor })}
          onCustom={(hairColor) => set({ hairColor })}
        />
      )}
      {row(
        'Bart',
        <div className="look-chips">
          {BEARDS.map((b) => (
            <button key={b.id} className={`look-chip ${look.beard === b.id ? 'on' : ''}`} onClick={() => set({ beard: b.id })}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <h4 className="look-section">Hilfsmittel</h4>
      {row(
        'Dabei',
        <div className="look-chips">
          {flag('glasses', 'Brille')}
          {flag('hearingAid', 'Hörgerät')}
          {flag('wheelchair', 'Rollstuhl')}
        </div>
      )}
      <p className="widget-settings-hint">Aussehen ist immer kostenlos. Coins gibt es nur für Kleidung und fürs Zimmer.</p>
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
