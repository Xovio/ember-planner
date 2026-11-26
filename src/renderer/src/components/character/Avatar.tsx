import { useId } from 'react'
import type { AvatarLook } from '@shared/types'
import { itemById, lookColors, ramp } from '@shared/wardrobe'

export type Expression = 'content' | 'happy' | 'proud' | 'sleepy' | 'cheer'

/**
 * The character as layered SVG (viewBox 200×280, about 2.5 heads tall). Every colour comes from
 * a ramp (base, shade, light, line), so skin, hair and clothes can take any colour.
 * Shape features (body, face, eyes, brows, hair, beard …) combine freely; there is no gender switch.
 * Animation (breathing, blinking, waving) only runs with `animate` and without reduced motion (CSS).
 * `pose="rest"` lets both arms hang (used in the room).
 */
export function Avatar({
  look: raw,
  outfit,
  expression = 'content',
  animate = false,
  pose = 'wave',
  action,
  sit = 'stand',
  walking = false,
  size = 200,
  title
}: {
  look: AvatarLook
  outfit: Record<string, string>
  expression?: Expression
  animate?: boolean
  pose?: 'wave' | 'rest'
  /** an idle animation (see shared/idle.ts): arms, props and motion */
  action?: string
  /** sitting on a chair it brings, on the floor, or on furniture (the room draws that) */
  sit?: 'stand' | 'chair' | 'floor' | 'seat'
  walking?: boolean
  size?: number
  title?: string
}): React.JSX.Element {
  const uid = useId().replace(/:/g, '')
  const look = { ...LOOK_DEFAULTS, ...raw }
  const colors = lookColors(look)
  const skin = ramp(colors.skin)
  const hair = ramp(colors.hair)
  const iris = colors.eyes
  const top = itemById(outfit.top)
  const bottom = itemById(outfit.bottom)
  const shoes = itemById(outfit.shoes)
  const hat = itemById(outfit.hat)
  const extra = itemById(outfit.extra)
  const t = ramp(top?.color ?? '#e5615a')
  const b = ramp(bottom?.color ?? '#4a5578')
  const s = ramp(shoes?.color ?? '#f3ece0')
  const dx = (Math.max(0, Math.min(2, look.build)) - 1) * 6
  const sh = look.body === 'broad' ? 5 : 0
  const robe = top?.style === 'robe'
  const cheer = expression === 'cheer' && !action
  const blushColor = mixBlush(skin.base)
  const scale = [0.93, 1, 1.06][Math.max(0, Math.min(2, look.height))] ?? 1
  const chair = look.wheelchair ? 'wheelchair' : sit
  const seated = chair !== 'stand'
  const sy = chair === 'floor' ? 32 : seated ? 20 : 0
  const eye = EYE_SHAPES[look.eyeShape] ?? EYE_SHAPES.round
  const face = FACES[look.face] ?? FACES.round
  const tee = top?.style === 'tee'
  const arms = (action && ACTION_ARMS[action]) || (cheer ? ARMS_UP : pose === 'rest' ? ARMS_REST : ARMS_WAVE)
  const armProps = { c: t, skin, short: tee }

  return (
    <svg
      viewBox="-10 -30 220 310"
      width={size}
      height={(size * 310) / 220}
      className={`avatar ${animate ? 'animated' : ''} ${action ? `act-${action}` : ''} ${walking ? 'walking' : ''}`}
      role="img"
      aria-label={title ?? 'Dein Charakter'}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <defs>
        <clipPath id={`il${uid}`}>
          <ellipse cx="83" cy={eye.cy} rx={eye.rx} ry={eye.ry} />
        </clipPath>
        <clipPath id={`ir${uid}`}>
          <ellipse cx="117" cy={eye.cy} rx={eye.rx} ry={eye.ry} />
        </clipPath>
        <clipPath id={`fc${uid}`}>{face.shape({})}</clipPath>
      </defs>
      {chair !== 'seat' && <ellipse cx="100" cy="266" rx={(seated ? 58 : 44 + dx) * scale} ry="8" fill="#6b4a5a" opacity=".22" />}

      <g transform={`translate(100 266) scale(${scale}) translate(-100 -266)`}>
        <g className="av-body">
          {chair === 'wheelchair' && <WheelchairBack />}
          {chair === 'chair' && <ChairBack />}
          <g transform={`translate(0 ${sy})`}>
            <BackHair style={look.hair} c={hair} />
          </g>

          <g className="av-breath">
            {chair === 'floor' ? (
              <CrossedLegs c={robe ? t : b} s={s} />
            ) : (
              <>
                {!robe && <Legs style={bottom?.style ?? 'pants'} c={b} skin={skin} seated={seated} />}
                <Shoes style={shoes?.style ?? 'sneakers'} c={s} />
              </>
            )}
            {chair === 'wheelchair' && <WheelchairFront />}
            {chair === 'chair' && <ChairSeat />}
            <g transform={`translate(0 ${sy})`}>
              <Torso style={top?.style ?? 'hoodie'} c={t} dx={dx} sh={sh} body={look.body} seated={seated} />
              {action && <PropsBehind action={action} />}
              <g className={arms.lc ?? ''}>
                <Arm d={arms.l[0]} hand={arms.l[1]} dx={-dx - sh} {...armProps} />
              </g>
              <g className={arms.rc ?? ''}>
                <Arm d={arms.r[0]} hand={arms.r[1]} dx={dx + sh} {...armProps} shaded />
              </g>
              {extra?.style === 'scarf' && <Scarf c={ramp(extra.color)} />}
              <OverHair style={look.hair} c={hair} />
              {action && <PropsFront action={action} />}
            </g>
          </g>

          <g transform={`translate(0 ${sy})`}>
            <g className="av-head" transform="rotate(-4 100 150)">
              <ellipse cx={100 - face.ear} cy="104" rx="7" ry="9" fill={skin.base} stroke={skin.line} strokeWidth="2.5" />
              <ellipse cx={100 + face.ear} cy="104" rx="7" ry="9" fill={skin.base} stroke={skin.line} strokeWidth="2.5" />
              {look.hearingAid && (
                <path
                  d={`M${100 - face.ear - 5} 92 Q${100 - face.ear - 13} 98 ${100 - face.ear - 9} 110 Q${100 - face.ear - 5} 114 ${100 - face.ear - 2} 108`}
                  fill="#a99ec0"
                  stroke="#5d5470"
                  strokeWidth="2"
                />
              )}
              {face.shape({ fill: skin.base, stroke: skin.line, strokeWidth: 2.5 })}
              <Earrings style={look.earrings} ear={face.ear} />
              <g clipPath={`url(#fc${uid})`}>
                <path d="M40 92 Q100 108 160 92 L160 60 L40 60 Z" fill={skin.shade} opacity=".55" />
                <path d="M120 140 Q146 128 152 100 Q160 140 120 160 Z" fill={skin.shade} opacity=".45" />
                {action === 'laptop' && <rect x="40" y="110" width="120" height="50" fill="#9cd0f0" opacity=".18" />}
              </g>

              {look.freckles && (
                <g fill={skin.line} opacity=".42">
                  {FRECKLES.map(([x, y], i) => (
                    <g key={i}>
                      <circle cx={x} cy={y} r="1.4" />
                      <circle cx={200 - x} cy={y} r="1.4" />
                    </g>
                  ))}
                </g>
              )}
              {look.blush && (
                <>
                  <ellipse cx="72" cy="121" rx="9" ry="5" fill={blushColor} opacity=".55" />
                  <ellipse cx="128" cy="121" rx="9" ry="5" fill={blushColor} opacity=".55" />
                </>
              )}
              {look.mole && <circle cx="124" cy="131" r="1.7" fill={skin.line} opacity=".7" />}
              <Beard style={look.beard} c={hair} />
              <Eyes expression={expression} iris={iris} uid={uid} shape={eye} lashes={look.lashes} liner={look.makeup === 'liner' || look.makeup === 'both'} />
              <Brows expression={expression} line={hair.line} style={look.brows} lift={eye.cy - 104} />
              {look.scar && <path d="M118 74 L126 96 M119 80 l4 -1.5 M122 88 l4 -1.5" fill="none" stroke={skin.line} strokeWidth="2" opacity=".55" />}
              <Nose style={look.nose} line={skin.line} light={skin.light} />
              <Mouth expression={expression} lips={look.makeup === 'lips' || look.makeup === 'both'} />
              <Piercing style={look.piercing} />

              <FrontHair style={look.hair} c={hair} skin={skin} />
              {look.glasses && (
                <g fill="none" stroke="#4a3a48" strokeWidth="2.5">
                  <rect x="70" y="92" width="26" height="24" rx="9" />
                  <rect x="104" y="92" width="26" height="24" rx="9" />
                  <path d="M96 102 Q100 99 104 102" />
                </g>
              )}
              {hat && <Hat style={hat.style} c={ramp(hat.color)} />}
              {extra?.style === 'headphones' && <Headphones c={ramp(extra.color)} />}
            </g>
            {action && <HeadFx action={action} />}
          </g>
        </g>
      </g>
    </svg>
  )
}

/** fills in features older saved looks do not have yet */
export const LOOK_DEFAULTS: Omit<AvatarLook, 'skin' | 'hair' | 'hairColor' | 'eyes' | 'build' | 'glasses' | 'hearingAid'> = {
  body: 'straight',
  height: 1,
  face: 'round',
  eyeShape: 'round',
  brows: 'soft',
  lashes: false,
  beard: 'none',
  nose: 'none',
  earrings: 'none',
  piercing: 'none',
  scar: false,
  freckles: false,
  mole: false,
  blush: true,
  makeup: 'none',
  wheelchair: false
}

type Ramp = ReturnType<typeof ramp>
type ShapeProps = React.SVGProps<SVGPathElement> & React.SVGProps<SVGEllipseElement>

const FACES: Record<string, { ear: number; shape: (p: ShapeProps) => React.JSX.Element }> = {
  round: { ear: 55, shape: (p) => <ellipse cx="100" cy="98" rx="56" ry="52" {...(p as React.SVGProps<SVGEllipseElement>)} /> },
  oval: { ear: 51, shape: (p) => <ellipse cx="100" cy="100" rx="52" ry="55" {...(p as React.SVGProps<SVGEllipseElement>)} /> },
  square: {
    ear: 55,
    shape: (p) => <path d="M46 96 Q46 48 100 46 Q154 48 154 96 L152 122 Q148 148 100 150 Q52 148 48 122 Z" {...(p as React.SVGProps<SVGPathElement>)} />
  }
}

interface EyeShape {
  cy: number
  rx: number
  ry: number
  /** how high the lid arcs above the eye, and how much the outer corner lifts */
  arc: number
  tilt: number
  /** lid stroke width (without liner) */
  lidW?: number
  /** a thin crease line above the lid */
  crease?: boolean
}

const EYE_SHAPES: Record<string, EyeShape> = {
  round: { cy: 104, rx: 9, ry: 11.5, arc: 4.5, tilt: 0 },
  almond: { cy: 105, rx: 10, ry: 9, arc: 3.5, tilt: 2.5 },
  soft: { cy: 105, rx: 9, ry: 10, arc: 1, tilt: -1 },
  narrow: { cy: 106, rx: 9.5, ry: 6.5, arc: 1.5, tilt: 0.5, lidW: 3 },
  small: { cy: 105, rx: 6.5, ry: 7.5, arc: 2, tilt: 0, lidW: 2.6 },
  hooded: { cy: 106, rx: 9, ry: 8.5, arc: 0.5, tilt: -1.5, lidW: 4.2, crease: true }
}

const FRECKLES: [number, number][] = [
  [62, 115],
  [68, 111],
  [67, 119],
  [74, 115],
  [59, 120],
  [79, 112]
]

function mixBlush(skinHex: string): string {
  const n = parseInt(skinHex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const to = [240, 106, 122]
  return `rgb(${c.map((v, i) => Math.round(v + (to[i] - v) * 0.55)).join(',')})`
}

/* ── hair ── */

function BackHair({ style, c }: { style: string; c: Ramp }): React.JSX.Element | null {
  const p = { fill: c.base, stroke: c.line, strokeWidth: 3 }
  const shortBack = <path d="M40 96 Q36 34 100 30 Q164 34 160 96 Q150 84 100 84 Q50 84 40 96 Z" {...p} />
  switch (style) {
    case 'long':
      return <path d="M34 100 Q28 28 100 24 Q172 28 166 100 L170 184 Q152 198 140 176 L60 176 Q48 198 30 184 Z" {...p} />
    case 'longcurly': {
      const puffs = [[34, 110], [28, 138], [32, 166], [46, 186], [166, 110], [172, 138], [168, 166], [154, 186], [60, 40], [100, 28], [140, 40]]
      return (
        <g {...p}>
          {puffs.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="20" />
          ))}
          <path d="M36 100 Q30 30 100 26 Q170 30 164 100 L166 180 L34 180 Z" stroke="none" />
        </g>
      )
    }
    case 'curly': {
      const puffs = [[52, 60], [70, 40], [100, 32], [130, 40], [148, 60], [158, 88], [42, 88], [40, 116], [160, 116]]
      return (
        <g {...p}>
          {puffs.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="24" />
          ))}
          <circle cx="100" cy="88" r="58" stroke="none" />
        </g>
      )
    }
    case 'afro': {
      const puffs = Array.from({ length: 14 }, (_, i) => {
        const a = Math.PI * (0.86 + (i / 13) * 1.28)
        return [100 + Math.cos(a) * 66, 84 + Math.sin(a) * 62]
      })
      return (
        <g {...p}>
          {puffs.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="24" />
          ))}
          <ellipse cx="100" cy="84" rx="70" ry="64" stroke="none" />
          <path d="M60 30 Q80 18 104 18" fill="none" stroke={c.light} strokeWidth="6" />
        </g>
      )
    }
    case 'short':
    case 'braid':
    case 'sidepart':
    case 'quiff':
    case 'spiky':
    case 'messy':
    case 'slick':
      return shortBack
    case 'manbun':
      return (
        <g>
          {shortBack}
          <circle cx="100" cy="20" r="14" {...p} />
          <path d="M90 32 Q100 36 110 32" fill="none" stroke={c.line} strokeWidth="3" />
        </g>
      )
    case 'shoulder':
      return <path d="M36 100 Q30 30 100 26 Q170 30 164 100 L166 152 Q158 164 148 156 L146 110 L54 110 L52 156 Q42 164 34 152 Z" {...p} />
    case 'dreads': {
      const xs = [40, 52, 64, 136, 148, 160]
      return (
        <g>
          {shortBack}
          {xs.map((x) => (
            <g key={x}>
              <path d={`M${x} 84 L${x + (x < 100 ? -2 : 2)} 168`} stroke={c.line} strokeWidth="14" />
              <path d={`M${x} 84 L${x + (x < 100 ? -2 : 2)} 168`} stroke={c.base} strokeWidth="9" />
              <path d={`M${x - 4} 110 l8 -2 M${x - 4} 136 l8 -2`} stroke={c.shade} strokeWidth="1.6" />
            </g>
          ))}
        </g>
      )
    }
    case 'ponytail':
      return (
        <g>
          {shortBack}
          <path d="M146 54 Q190 62 182 128 Q178 160 160 172 Q172 128 156 92 Z" {...p} />
          <path d="M168 80 Q182 108 172 150" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'pigtails':
      return (
        <g>
          {shortBack}
          <path d="M44 88 Q10 100 16 152 Q20 174 36 182 Q28 142 54 106 Z" {...p} />
          <path d="M156 88 Q190 100 184 152 Q180 174 164 182 Q172 142 146 106 Z" {...p} />
        </g>
      )
    case 'undercut':
    case 'crop':
    case 'mohawk':
    case 'buzz':
    case 'bald':
      return null
    default:
      return (
        <g>
          {style === 'bun' && <circle cx="100" cy="22" r="20" {...p} />}
          <path d="M36 100 Q30 30 100 26 Q170 30 164 100 Q168 128 156 146 Q150 120 146 104 L54 104 Q50 120 44 146 Q32 128 36 100 Z" {...p} />
        </g>
      )
  }
}

/** hair that falls in front of the body (the braid over the shoulder) */
function OverHair({ style, c }: { style: string; c: Ramp }): React.JSX.Element | null {
  if (style !== 'braid') return null
  return (
    <g fill={c.base} stroke={c.line} strokeWidth="2.5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse key={i} cx={134 + i * 1.2} cy={142 + i * 12} rx={9 - i * 0.5} ry="8" transform={`rotate(${i % 2 ? 14 : -14} ${134 + i * 1.2} ${142 + i * 12})`} />
      ))}
      <circle cx="141" cy="214" r="4.5" fill="#e5615a" stroke="none" />
      <path d="M137 218 Q140 228 136 232 M142 218 Q146 228 146 232" fill="none" />
    </g>
  )
}

function FrontHair({ style, c, skin }: { style: string; c: Ramp; skin: Ramp }): React.JSX.Element | null {
  const p = { fill: c.base, stroke: c.line, strokeWidth: 3 }
  const curlyFront = (
    <g>
      <path d="M44 92 Q42 40 100 34 Q158 40 156 92 Q146 74 128 74 Q116 64 100 70 Q84 64 72 74 Q54 74 44 92 Z" {...p} />
      {[[64, 62], [84, 52], [104, 50], [124, 54], [142, 66]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="11" fill={c.base} stroke={c.line} strokeWidth="2.5" />
      ))}
      <path d="M70 50 Q80 42 92 44" fill="none" stroke={c.light} strokeWidth="4" />
    </g>
  )
  const swept = (
    <g>
      <path d="M42 96 Q40 34 100 30 Q160 34 158 96 Q150 78 136 72 Q120 62 96 66 Q70 70 56 84 Q48 88 42 96 Z" {...p} />
      <path d="M64 52 Q82 42 104 42" fill="none" stroke={c.light} strokeWidth="4" />
    </g>
  )
  switch (style) {
    case 'curly':
    case 'longcurly':
      return curlyFront
    case 'afro':
      return (
        <g>
          <path d="M46 90 Q44 44 100 40 Q156 44 154 90 Q140 70 100 68 Q60 70 46 90 Z" {...p} />
          {[[52, 80], [62, 68], [78, 62], [96, 60], [114, 61], [130, 65], [146, 76]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="8" fill={c.base} stroke={c.line} strokeWidth="2.2" />
          ))}
        </g>
      )
    case 'short':
      return (
        <g>
          <path d="M44 92 Q42 38 100 34 Q158 38 156 92 Q148 74 132 70 Q124 80 110 76 Q100 64 86 72 Q72 66 60 78 Q50 82 44 92 Z" {...p} />
          <path d="M64 54 Q78 44 96 44" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'ponytail':
    case 'braid':
      return (
        <g>
          {swept}
          {style === 'ponytail' && <circle cx="154" cy="62" r="6" fill="#e5615a" stroke={c.line} strokeWidth="1.5" />}
        </g>
      )
    case 'pigtails':
      return (
        <g>
          <path d="M42 98 Q38 34 100 30 Q162 34 158 98 Q150 76 128 70 Q110 66 101 48 Q92 66 72 70 Q50 76 42 98 Z" {...p} />
          <circle cx="44" cy="96" r="6" fill="#e5615a" stroke={c.line} strokeWidth="1.5" />
          <circle cx="156" cy="96" r="6" fill="#e5615a" stroke={c.line} strokeWidth="1.5" />
          <path d="M62 54 Q78 42 96 42" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'undercut':
      return (
        <g>
          <path d="M46 92 Q45 76 51 66 Q54 78 53 92 Z" fill={c.base} opacity=".3" />
          <path d="M154 92 Q155 76 149 66 Q146 78 147 92 Z" fill={c.base} opacity=".3" />
          <path d="M50 72 Q50 26 104 24 Q160 28 152 72 Q140 58 120 60 Q96 50 78 62 Q62 60 50 72 Z" {...p} />
          <path d="M66 42 Q86 30 110 32" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'sidepart':
      return (
        <g>
          <path d="M44 94 Q40 36 100 32 Q160 36 156 94 Q152 76 140 70 Q118 62 86 62 Q76 64 70 58 Q60 70 52 80 Q46 86 44 94 Z" {...p} />
          <path d="M70 58 Q66 46 72 36" fill="none" stroke={c.line} strokeWidth="2.2" />
          <path d="M82 46 Q106 38 132 48" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'quiff':
      return (
        <g>
          <path d="M46 92 Q42 52 58 40 Q66 14 102 12 Q140 12 150 40 Q158 56 154 92 Q148 74 132 68 Q110 62 92 64 Q70 64 58 76 Q50 82 46 92 Z" {...p} />
          <path d="M60 72 Q62 40 96 30 Q124 22 146 42 Q126 34 106 40 Q80 48 74 70 Z" fill={c.shade} opacity=".55" />
          <path d="M60 72 Q62 40 96 30 Q124 22 146 42" fill="none" stroke={c.line} strokeWidth="2.2" />
          <path d="M80 22 Q102 14 126 20" fill="none" stroke={c.light} strokeWidth="5" />
        </g>
      )
    case 'spiky':
      return (
        <g>
          <path d="M44 94 Q40 62 48 50 L38 32 L62 38 L64 14 L84 30 L100 6 L114 30 L136 14 L136 38 L162 32 L152 52 Q160 64 156 94 Q148 76 134 72 L122 80 L112 66 L98 78 L86 66 L74 78 Q56 76 44 94 Z" {...p} />
          <path d="M72 40 L66 24 M100 34 L100 16 M126 40 L132 24" fill="none" stroke={c.light} strokeWidth="3.5" />
        </g>
      )
    case 'messy':
      return (
        <g>
          <path d="M44 94 Q38 40 70 32 Q76 18 92 26 Q102 12 116 26 Q132 20 136 34 Q162 42 156 94 Q150 76 138 72 L130 82 Q122 70 112 76 L104 66 Q96 78 86 72 L76 82 Q66 72 56 82 Q48 86 44 94 Z" {...p} />
          <path d="M102 22 Q96 8 110 4" fill="none" stroke={c.line} strokeWidth="3" />
          <path d="M64 50 Q78 40 94 42" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'crop':
      return (
        <g>
          <path d="M46 94 Q45 80 50 72 Q53 82 52 94 Z" fill={c.base} opacity=".35" />
          <path d="M154 94 Q155 80 150 72 Q147 82 148 94 Z" fill={c.base} opacity=".35" />
          <path d="M48 82 Q46 34 100 32 Q154 34 152 82 L150 76 Q100 70 50 76 Z" {...p} />
          <path d="M68 74 L70 64 M84 73 L86 62 M100 72 L102 62 M116 73 L118 62 M132 74 L134 64" fill="none" stroke={c.line} strokeWidth="1.8" />
          <path d="M66 46 Q86 38 108 40" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'slick':
    case 'manbun':
      return (
        <g>
          <path d="M46 88 Q44 32 100 28 Q156 32 154 88 Q150 66 138 58 Q120 50 100 50 Q80 50 62 58 Q50 66 46 88 Z" {...p} />
          <path d="M66 52 Q88 38 122 40 M80 50 Q102 44 132 50" fill="none" stroke={c.shade} strokeWidth="2.2" />
          <path d="M70 42 Q90 32 112 34" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'mohawk':
      return (
        <g>
          <path d="M46 90 Q44 44 100 42 Q156 44 154 90 Q148 70 100 66 Q52 70 46 90 Z" fill={c.base} opacity=".4" stroke={c.line} strokeOpacity=".3" strokeWidth="2" />
          <path d="M84 66 Q78 32 86 8 Q100 -4 114 8 Q122 32 116 66 Q100 60 84 66 Z" {...p} />
          <path d="M94 14 Q92 32 94 52" fill="none" stroke={c.light} strokeWidth="4" />
        </g>
      )
    case 'shoulder':
      return (
        <g>
          <path d="M42 100 Q38 34 100 30 Q162 34 158 100 Q150 76 132 68 Q112 60 102 44 Q90 60 68 68 Q50 76 42 100 Z" {...p} />
          <path d="M62 54 Q78 42 94 42" fill="none" stroke={c.light} strokeWidth="4" />
          <path d="M112 44 Q128 46 140 58" fill="none" stroke={c.light} strokeWidth="3" />
        </g>
      )
    case 'dreads':
      return (
        <g>
          <path d="M44 92 Q42 38 100 34 Q158 38 156 92 Q148 74 128 70 Q100 62 72 70 Q52 74 44 92 Z" {...p} />
          {[64, 82, 100, 118, 136].map((x) => (
            <path key={x} d={`M${x} 40 Q${x - 2} 56 ${x + 2} 68`} fill="none" stroke={c.shade} strokeWidth="2" />
          ))}
          <path d="M66 50 Q80 42 96 42" fill="none" stroke={c.light} strokeWidth="3.5" />
        </g>
      )
    case 'buzz':
      return (
        <g>
          <path d="M46 90 Q44 44 100 42 Q156 44 154 90 Q148 70 100 66 Q52 70 46 90 Z" fill={c.base} opacity=".62" stroke={c.line} strokeOpacity=".35" strokeWidth="2" />
          <path d="M66 54 Q82 48 98 48" fill="none" stroke={c.light} strokeWidth="3" opacity=".6" />
        </g>
      )
    case 'bald':
      return <path d="M68 60 Q84 50 104 52" fill="none" stroke={skin.light} strokeWidth="5" opacity=".9" />
    default:
      return (
        <g>
          <path d="M42 98 Q38 36 100 30 Q162 36 158 98 Q152 80 140 76 Q138 90 124 92 Q122 72 110 66 Q104 84 90 86 Q88 70 80 68 Q72 86 58 88 Q50 90 42 98 Z" {...p} />
          <path d="M120 40 Q148 50 154 86 Q146 68 132 62 Z" fill={c.shade} opacity=".8" />
          <path d="M60 56 Q76 42 96 42" fill="none" stroke={c.light} strokeWidth="5" />
          <path d="M110 42 Q122 42 132 50" fill="none" stroke={c.light} strokeWidth="4" />
          {style === 'bob' && <path d="M100 32 Q94 14 112 10 Q104 20 106 32" {...p} strokeWidth={2.5} />}
        </g>
      )
  }
}

function Beard({ style, c }: { style: string; c: Ramp }): React.JSX.Element | null {
  const p = { fill: c.base, stroke: c.line, strokeWidth: 2.5 }
  const stache = <path d="M90 120 Q97 113 104 118 Q111 113 118 120 Q112 124 104 121 Q96 124 90 120 Z" {...p} strokeWidth={2} />
  switch (style) {
    case 'stubble':
      return <path d="M50 108 Q54 150 100 152 Q146 150 150 108 Q142 126 128 132 Q116 126 104 132 Q92 126 80 132 Q60 126 50 108 Z" fill={c.base} opacity=".28" />
    case 'short':
      return (
        <g>
          <path d="M50 108 Q54 152 100 154 Q146 152 150 108 Q142 128 126 132 Q114 122 104 128 Q94 122 82 132 Q60 128 50 108 Z" {...p} />
          {stache}
        </g>
      )
    case 'full':
      return (
        <g>
          <path d="M50 110 Q48 168 100 172 Q152 168 150 110 Q144 128 126 132 Q114 122 104 128 Q94 122 82 132 Q56 128 50 110 Z" {...p} />
          <path d="M130 134 Q144 140 140 160" fill="none" stroke={c.shade} strokeWidth="4" />
          {stache}
        </g>
      )
    case 'heavy':
      return (
        <g>
          <path d="M50 108 Q54 152 100 154 Q146 152 150 108 Q142 126 128 132 Q116 126 104 132 Q92 126 80 132 Q60 126 50 108 Z" fill={c.base} opacity=".5" />
          <g opacity=".5">{stache}</g>
        </g>
      )
    case 'long':
      return (
        <g>
          <path d="M50 110 Q46 170 74 192 Q100 214 126 192 Q154 170 150 110 Q144 128 126 132 Q114 122 104 128 Q94 122 82 132 Q56 128 50 110 Z" {...p} />
          <path d="M84 150 Q88 176 98 196 M118 150 Q118 176 110 196 M132 140 Q142 160 132 180" fill="none" stroke={c.shade} strokeWidth="3" />
          {stache}
        </g>
      )
    case 'mustache':
      return stache
    case 'handlebar':
      return (
        <path
          d="M78 112 Q76 123 87 122 Q96 121 104 118 Q112 121 121 122 Q132 123 130 112 Q128 118 122 117 Q112 112 104 117 Q96 112 86 117 Q80 118 78 112 Z"
          {...p}
          strokeWidth={2}
        />
      )
    case 'anchor':
      return (
        <g>
          {stache}
          <path d="M88 132 Q104 128 120 132 Q118 158 104 168 Q90 158 88 132 Z" {...p} strokeWidth={2} />
          <path d="M104 140 L104 160" fill="none" stroke={c.shade} strokeWidth="2.5" />
        </g>
      )
    case 'chinstrap':
      return <path d="M50 106 Q54 152 100 154 Q146 152 150 106 Q146 140 100 145 Q54 140 50 106 Z" {...p} strokeWidth={2} />
    case 'sideburns':
      return (
        <g {...p} strokeWidth={2}>
          <path d="M49 86 L58 87 Q58 108 62 122 Q54 122 50 110 Z" />
          <path d="M151 86 L142 87 Q142 108 138 122 Q146 122 150 110 Z" />
        </g>
      )
    case 'goatee':
      return (
        <g>
          {stache}
          <path d="M94 134 Q104 132 114 134 Q112 150 104 152 Q96 150 94 134 Z" {...p} strokeWidth={2} />
        </g>
      )
    default:
      return null
  }
}

/* ── face ── */

function Eyes({
  expression,
  iris,
  uid,
  shape,
  lashes,
  liner
}: {
  expression: Expression
  iris: string
  uid: string
  shape: EyeShape
  lashes: boolean
  liner: boolean
}): React.JSX.Element {
  const lid = '#5b3340'
  const { cy, rx, ry, arc, tilt } = shape
  // inner and outer lid corners follow the eye width; the right eye mirrors the left
  const inL = 83 + rx + 3
  const outL = 83 - rx - 2
  const inR = 117 - rx - 3
  const outR = 117 + rx + 2
  if (expression === 'proud') {
    return (
      <g fill="none" stroke={lid} strokeWidth="4">
        <path d={`M${83 - rx} ${cy + 4} Q83 ${cy - 7} ${83 + rx} ${cy + 4}`} />
        <path d={`M${117 - rx} ${cy + 4} Q117 ${cy - 7} ${117 + rx} ${cy + 4}`} />
      </g>
    )
  }
  if (expression === 'sleepy') {
    return (
      <g fill="none" stroke={lid} strokeWidth="3.5">
        <path d={`M${83 - rx} ${cy + 1} Q83 ${cy + 7} ${83 + rx} ${cy + 1}`} />
        <path d={`M${117 - rx} ${cy + 1} Q117 ${cy + 7} ${117 + rx} ${cy + 1}`} />
      </g>
    )
  }
  const lower = shift(iris)
  const top = cy - ry
  const corner = top + arc - tilt
  // lid from inner to outer corner; the outer end lifts with `tilt`
  const lidL = `M${inL} ${top + arc - 0.5} Q83 ${top - arc} ${outL} ${corner}`
  const lidR = `M${inR} ${top + arc - 0.5} Q117 ${top - arc} ${outR} ${corner}`
  const w = liner ? 5 : (shape.lidW ?? 3.5)
  const glint = Math.min(3.6, ry * 0.36)
  return (
    <g className="av-blink">
      {[83, 117].map((cx, i) => (
        <g key={cx}>
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={iris} />
          <ellipse cx={cx} cy={cy + ry * 0.7} rx={rx - 1} ry={ry * 0.52} fill={lower} clipPath={`url(#${i ? 'ir' : 'il'}${uid})`} />
          <circle cx={cx - rx * 0.33} cy={cy - ry * 0.43} r={glint} fill="#fff8ee" />
          {ry > 7 && <circle cx={cx + rx * 0.33} cy={cy + ry * 0.43} r="1.7" fill="#fff8ee" />}
        </g>
      ))}
      {shape.crease && (
        <g fill="none" stroke={lid} strokeWidth="1.6" opacity=".55">
          <path d={`M${inL - 2} ${top - 2} Q83 ${top - arc - 6} ${outL + 1} ${corner - 4}`} />
          <path d={`M${inR + 2} ${top - 2} Q117 ${top - arc - 6} ${outR - 1} ${corner - 4}`} />
        </g>
      )}
      <path d={lidL} fill="none" stroke={lid} strokeWidth={w} />
      <path d={lidR} fill="none" stroke={lid} strokeWidth={w} />
      {liner && <path d={`M${outL - 1} ${corner} l-7 -2.5 M${outR + 1} ${corner} l7 -2.5`} stroke={lid} strokeWidth="3" />}
      {lashes && (
        <g stroke={lid} strokeWidth="2.2">
          <path d={`M${outL} ${corner} l-4 -3 M${outL + 2} ${corner - 3} l-5 -5 M${outL + 5} ${corner - 5} l-2.5 -6`} />
          <path d={`M${outR} ${corner} l4 -3 M${outR - 2} ${corner - 3} l5 -5 M${outR - 5} ${corner - 5} l2.5 -6`} />
        </g>
      )}
    </g>
  )
}

/** a lighter tint of the iris for its lower half */
function shift(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * 0.3))
  return `rgb(${c.join(',')})`
}

function Brows({ expression, line, style, lift }: { expression: Expression; line: string; style: string; lift: number }): React.JSX.Element {
  const up = (expression === 'cheer' || expression === 'happy' ? -3 : expression === 'sleepy' ? 3 : 0) + lift * 0.5
  const w = style === 'thick' || style === 'unibrow' ? 5 : style === 'thin' ? 2 : 3
  const arch = style === 'arched' ? 4 : 0
  return (
    <g fill="none" stroke={line} strokeWidth={w}>
      <path d={`M74 ${84 + up} Q82 ${79 + up - arch} 91 ${82 + up}`} />
      {style === 'slit' ? (
        <>
          <path d={`M109 ${81 + up} Q112 ${79.5 + up} 116 ${79 + up}`} />
          <path d={`M120 ${79 + up} Q124 ${80 + up} 127 ${83 + up}`} />
        </>
      ) : (
        <path d={`M109 ${81 + up} Q118 ${78 + up - arch} 127 ${83 + up}`} />
      )}
      {style === 'unibrow' && <path d={`M90 ${82 + up} Q100 ${80 + up} 110 ${81 + up}`} strokeWidth={w * 0.7} />}
    </g>
  )
}

function Nose({ style, line, light }: { style: string; line: string; light: string }): React.JSX.Element | null {
  const p = { fill: 'none', stroke: line, strokeWidth: 2.2, opacity: 0.75 }
  switch (style) {
    case 'dot':
      return <ellipse cx="103" cy="114" rx="2.6" ry="1.8" fill={line} opacity=".45" />
    case 'button':
      return (
        <g>
          <circle cx="103" cy="113" r="4" fill={light} opacity=".7" />
          <path d="M99 115 Q103 119 107 115" {...p} />
        </g>
      )
    case 'pointed':
      return <path d="M105 103 L99 115 Q102 118 107 116" {...p} />
    case 'wide':
      return <path d="M95 113 Q97 118 100 116 Q103 118 106 116 Q109 118 111 113" {...p} />
    default:
      return null
  }
}

const METAL = { fill: '#d9dde6', line: '#6b6f7a', gold: '#e8c15a', goldLine: '#9a7a2a' }

function Earrings({ style, ear }: { style: string; ear: number }): React.JSX.Element | null {
  if (style === 'studs')
    return (
      <g fill={METAL.gold} stroke={METAL.goldLine} strokeWidth="1.2">
        <circle cx={100 - ear - 1} cy="113" r="2.8" />
        <circle cx={100 + ear + 1} cy="113" r="2.8" />
      </g>
    )
  if (style === 'hoops')
    return (
      <g fill="none" stroke={METAL.gold} strokeWidth="2.4">
        <circle cx={100 - ear - 2} cy="119" r="5.5" />
        <circle cx={100 + ear + 2} cy="119" r="5.5" />
      </g>
    )
  return null
}

function Piercing({ style }: { style: string }): React.JSX.Element | null {
  const ring = { fill: 'none', stroke: METAL.fill, strokeWidth: 2 }
  const ball = { fill: METAL.fill, stroke: METAL.line, strokeWidth: 1.2 }
  switch (style) {
    case 'nose':
      return <path d="M108 115 A2.6 2.6 0 1 1 106 119" {...ring} />
    case 'brow':
      return (
        <g {...ball}>
          <circle cx="122" cy="75" r="2.2" />
          <circle cx="124" cy="87" r="2.2" />
        </g>
      )
    case 'lip':
      return <path d="M110 128 A3 3 0 1 1 106 131" {...ring} />
    default:
      return null
  }
}

function Mouth({ expression, lips }: { expression: Expression; lips: boolean }): React.JSX.Element {
  const edge = lips ? '#b23a5e' : '#8a3a44'
  if (expression === 'content') return <path d="M97 123 Q104 129 111 122" fill="none" stroke={lips ? '#c2456a' : edge} strokeWidth={lips ? 3.4 : 2.5} />
  if (expression === 'sleepy') return <ellipse cx="105" cy="125" rx="3.5" ry="4" fill="#b5545a" stroke={edge} strokeWidth="1.8" />
  const big = expression === 'cheer'
  return (
    <g>
      <path d={big ? 'M95 121 Q104 136 114 120 Z' : 'M98 122 Q104 131 111 121 Z'} fill="#b5545a" stroke={edge} strokeWidth={lips ? 2.6 : 1.8} />
      <path d={big ? 'M99 128 Q104 131 110 127' : 'M101 126 Q104 128 107 125'} fill="none" stroke="#e48a8a" strokeWidth="2" />
    </g>
  )
}

/* ── body ── */

function Torso({
  style,
  c,
  dx,
  sh,
  body,
  seated
}: {
  style: string
  c: Ramp
  dx: number
  sh: number
  body: AvatarLook['body']
  seated: boolean
}): React.JSX.Element {
  const by = style === 'robe' ? (seated ? 232 : 252) : 222
  const fl = style === 'robe' ? 10 : 0
  const hp = body === 'curvy' ? 6 : 0
  const wa = body === 'curvy' ? 3 : 0
  const L = 70 - dx - sh
  const R = 130 + dx + sh
  const body_ = `M${L} 168 Q${L - 2} 148 86 145 L114 145 Q${R + 2} 148 ${R} 168 Q${R - wa} 186 ${R + 4 + fl + hp} ${by - 14} Q${R + 5 + fl + hp} ${by} 120 ${by} L80 ${by} Q${L - 5 - fl - hp} ${by} ${L - 4 - fl - hp} ${by - 14} Q${L + wa} 186 ${L} 168 Z`
  const shadeD = `M118 148 Q${R + 2} 152 ${R} 168 Q${R - wa} 186 ${R + 4 + fl + hp} ${by - 14} Q${R + 5 + fl + hp} ${by} 120 ${by} L112 ${by} Q124 190 118 148 Z`
  return (
    <g>
      <path d={body_} fill={c.base} stroke={c.line} strokeWidth="3" />
      <path d={shadeD} fill={c.shade} />
      <path d={`M${L + 8} 156 Q${L + 4} 176 ${L + 6} 200`} fill="none" stroke={c.light} strokeWidth="4" opacity=".8" />
      {body === 'curvy' && <path d="M84 170 Q92 178 100 172 Q108 178 116 170" fill="none" stroke={c.shade} strokeWidth="2.5" opacity=".8" />}
      {style === 'hoodie' && (
        <g>
          <path d="M84 186 h32 v14 a7 7 0 0 1 -7 7 h-18 a7 7 0 0 1 -7 -7 z" fill={c.shade} stroke={c.line} strokeWidth="2" />
          <path d="M92 150 l8 10 l8 -10" fill="none" stroke="#fbe9d8" strokeWidth="3" />
          <path d="M93 160 v14 M107 160 v12" stroke="#fbe9d8" strokeWidth="2.5" />
        </g>
      )}
      {style === 'tee' && <path d="M88 146 Q100 158 112 146" fill="none" stroke={c.line} strokeWidth="2.5" />}
      {style === 'sweater' && (
        <g fill="none" stroke={c.line} strokeWidth="2">
          <path d="M86 147 Q100 156 114 147" strokeWidth="5" stroke={c.shade} />
          <path d="M100 160 q-5 8 0 16 q5 8 0 16 q-5 8 0 16" />
          <path d={`M${L + 2} 212 H${R - 2}`} strokeWidth="3" stroke={c.shade} />
        </g>
      )}
      {style === 'sport' && (
        <g>
          <path d="M90 146 L100 160 L110 146" fill="none" stroke={c.line} strokeWidth="2.5" />
          <path d={`M${L - 2} 190 L${R + 2} 170 L${R + 3} 180 L${L - 2} 200 Z`} fill="#f3ece0" opacity=".85" />
        </g>
      )}
      {style === 'robe' && (
        <g>
          <path d="M90 146 L100 170 L110 146" fill="none" stroke="#e8c070" strokeWidth="3" />
          <rect x={L} y="196" width={R - L} height="7" rx="3" fill="#e8c070" />
          <path d="M84 228 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 z" fill="#e8c070" transform={seated ? 'translate(0 -14)' : undefined} />
        </g>
      )}
    </g>
  )
}

function Arm({
  d,
  dx,
  c,
  skin,
  short,
  hand,
  shaded
}: {
  d: string
  dx: number
  c: Ramp
  skin: Ramp
  short: boolean
  hand: [number, number]
  shaded?: boolean
}): React.JSX.Element {
  const tr = `translate(${dx} 0)`
  const fill = shaded ? c.shade : c.base
  return (
    <g transform={tr}>
      <path d={d} fill="none" stroke={short ? skin.line : c.line} strokeWidth="19" />
      <path d={d} fill="none" stroke={short ? skin.base : fill} strokeWidth="14" />
      {short && <path d={d} fill="none" stroke={fill} strokeWidth="16" strokeDasharray="16 200" />}
      <circle cx={hand[0]} cy={hand[1]} r="9.5" fill={skin.base} stroke={skin.line} strokeWidth="2.5" />
    </g>
  )
}

function Legs({ style, c, skin, seated }: { style: string; c: Ramp; skin: Ramp; seated: boolean }): React.JSX.Element {
  const y0 = seated ? 228 : 204
  const full = seated ? 26 : 46
  const leg = (fill: string, line: string, h: number): React.JSX.Element => (
    <g>
      <rect className="av-leg-l" x="78" y={y0} width="22" height={h} rx="10" fill={fill} stroke={line} strokeWidth="2.5" />
      <g className="av-leg-r">
        <rect x="102" y={y0 - 2} width="21" height={h - 2} rx="10" fill={fill} stroke={line} strokeWidth="2.5" transform={`rotate(7 112 ${y0})`} />
      </g>
    </g>
  )
  if (style === 'shorts') {
    return (
      <g>
        {leg(skin.base, skin.line, full)}
        {leg(c.base, c.line, seated ? 12 : 22)}
      </g>
    )
  }
  if (style === 'skirt') {
    const k = seated ? 22 : 0
    return (
      <g>
        {leg(skin.base, skin.line, full)}
        <path d={`M70 ${198 + k} L130 ${198 + k} L142 ${232 + k * 0.6} Q100 ${244 + k * 0.6} 58 ${232 + k * 0.6} Z`} fill={c.base} stroke={c.line} strokeWidth="2.5" />
        <path d={`M118 ${200 + k} L130 ${198 + k} L142 ${232 + k * 0.6} Q132 ${236 + k * 0.6} 124 ${238 + k * 0.6} Z`} fill={c.shade} />
      </g>
    )
  }
  return (
    <g>
      {leg(c.base, c.line, full)}
      <rect x="114" y={y0 + 2} width="6" height={full - 10} rx="3" fill={c.shade} transform={`rotate(7 112 ${y0})`} />
    </g>
  )
}

const CHAIR = ramp('#5a6a9c')
const RIM = ramp('#4a4458')

/** rear wheels and backrest, behind the body */
function WheelchairBack(): React.JSX.Element {
  return (
    <g>
      {[46, 154].map((x) => (
        <g key={x}>
          <circle cx={x} cy="224" r="36" fill="none" stroke={RIM.base} strokeWidth="7" />
          <circle cx={x} cy="224" r="28" fill="none" stroke={RIM.light} strokeWidth="2" opacity=".7" />
          <path d={`M${x - 26} 224 H${x + 26} M${x} 198 V250 M${x - 18} 206 L${x + 18} 242 M${x + 18} 206 L${x - 18} 242`} stroke={RIM.light} strokeWidth="1.4" opacity=".7" />
          <circle cx={x} cy="224" r="5" fill={CHAIR.base} stroke={CHAIR.line} strokeWidth="1.5" />
        </g>
      ))}
      <rect x="62" y="150" width="76" height="80" rx="10" fill={CHAIR.shade} stroke={CHAIR.line} strokeWidth="2.5" />
    </g>
  )
}

/** seat edge, armrests, footrest and casters, in front of the legs */
function WheelchairFront(): React.JSX.Element {
  return (
    <g stroke={CHAIR.line} strokeWidth="2.5">
      <rect x="58" y="226" width="84" height="10" rx="5" fill={CHAIR.base} />
      <path d="M58 208 H76 M124 208 H142" stroke={CHAIR.base} strokeWidth="6" />
      <path d="M76 240 L72 262 M124 240 L128 262" fill="none" stroke={RIM.base} strokeWidth="3" />
      <rect x="66" y="258" width="68" height="6" rx="3" fill={CHAIR.base} />
      <circle cx="62" cy="266" r="5" fill={RIM.base} />
      <circle cx="138" cy="266" r="5" fill={RIM.base} />
    </g>
  )
}

function Shoes({ style, c }: { style: string; c: Ramp }): React.JSX.Element {
  if (style === 'boots') {
    return (
      <g fill={c.base} stroke={c.line} strokeWidth="2.5">
        <rect x="76" y="232" width="25" height="24" rx="8" />
        <rect x="104" y="229" width="24" height="24" rx="8" />
        <ellipse cx="88" cy="254" rx="17" ry="8" />
        <ellipse cx="118" cy="251" rx="16" ry="8" />
      </g>
    )
  }
  return (
    <g>
      <ellipse cx="88" cy="252" rx="16" ry="10" fill={c.base} stroke={c.line} strokeWidth="2.5" />
      <ellipse cx="119" cy="249" rx="15" ry="9.5" fill={c.base} stroke={c.line} strokeWidth="2.5" />
      <path d="M78 256 Q88 260 100 256" fill="none" stroke={c.shade} strokeWidth="3" />
      {style === 'slippers' && (
        <g fill="#fff3e6" stroke={c.line} strokeWidth="1.5">
          <circle cx="94" cy="246" r="5" />
          <circle cx="124" cy="243" r="5" />
        </g>
      )}
    </g>
  )
}

function Scarf({ c }: { c: Ramp }): React.JSX.Element {
  return (
    <g stroke={c.line} strokeWidth="2.5">
      <path d="M78 140 Q100 154 122 140 L124 150 Q100 166 76 150 Z" fill={c.base} />
      <path d="M110 150 L116 180 L104 182 L102 154 Z" fill={c.shade} />
    </g>
  )
}

function Hat({ style, c }: { style: string; c: Ramp }): React.JSX.Element {
  const p = { fill: c.base, stroke: c.line, strokeWidth: 3 }
  if (style === 'beanie') {
    return (
      <g>
        <path d="M44 80 Q46 20 100 18 Q154 20 156 80 Z" {...p} />
        <path d="M120 24 Q150 36 154 78 L132 78 Q132 44 120 24 Z" fill={c.shade} />
        <rect x="40" y="70" width="120" height="16" rx="8" {...p} fill={c.shade} />
        <circle cx="100" cy="14" r="10" {...p} fill={c.light} />
      </g>
    )
  }
  if (style === 'cap') {
    return (
      <g>
        <path d="M48 74 Q50 24 100 22 Q150 24 152 74 Z" {...p} />
        <path d="M120 72 Q160 64 182 78 Q160 86 120 82 Z" {...p} fill={c.shade} />
        <circle cx="100" cy="24" r="4" fill={c.line} />
      </g>
    )
  }
  if (style === 'wizard') {
    return (
      <g>
        <path d="M54 70 L104 -22 Q112 -26 116 -16 L148 70 Z" {...p} />
        <path d="M110 -18 L148 70 L126 70 Z" fill={c.shade} />
        <ellipse cx="100" cy="72" rx="64" ry="11" {...p} fill={c.shade} />
        <path d="M100 26 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 z" fill="#e8c070" />
      </g>
    )
  }
  if (style === 'flowers') {
    const spots: [number, number, string][] = [[58, 54, c.base], [74, 40, '#f6e28a'], [92, 34, '#fff3e6'], [110, 34, c.base], [128, 40, '#f6e28a'], [144, 54, '#fff3e6']]
    return (
      <g>
        <path d="M52 60 Q100 20 150 60" fill="none" stroke="#5f9f6e" strokeWidth="5" />
        {spots.map(([x, y, f], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="8" fill={f} stroke={c.line} strokeWidth="2" />
            <circle cx={x} cy={y} r="2.5" fill="#e0a43c" />
          </g>
        ))}
      </g>
    )
  }
  return <g />
}

function Headphones({ c }: { c: Ramp }): React.JSX.Element {
  return (
    <g stroke={c.line} strokeWidth="3">
      <path d="M44 100 Q40 26 100 24 Q160 26 156 100" fill="none" stroke={c.base} strokeWidth="8" />
      <rect x="32" y="90" width="18" height="28" rx="8" fill={c.base} />
      <rect x="150" y="90" width="18" height="28" rx="8" fill={c.shade} />
    </g>
  )
}

/* ── idle actions: arms, props and little effects ── */

interface Arms {
  l: [string, [number, number]]
  r: [string, [number, number]]
  /** css classes for the arm groups (animation) */
  lc?: string
  rc?: string
}

const L_REST: Arms['l'] = ['M74 158 Q58 176 60 196', [60, 201]]
const R_REST: Arms['r'] = ['M126 158 Q142 176 140 196', [140, 201]]
const L_UP: Arms['l'] = ['M74 158 Q58 146 50 128', [48, 121]]
const R_UP: Arms['r'] = ['M126 158 Q142 146 150 128', [152, 121]]
const ARMS_REST: Arms = { l: L_REST, r: R_REST }
const ARMS_UP: Arms = { l: L_UP, r: R_UP, rc: 'av-wave' }
const ARMS_WAVE: Arms = { l: L_REST, r: R_UP, rc: 'av-wave' }

const ACTION_ARMS: Record<string, Arms> = {
  look: ARMS_REST,
  hum: ARMS_REST,
  stretch: { l: ['M74 158 Q50 130 46 96', [44, 90]], r: ['M126 158 Q150 130 154 96', [156, 90]] },
  wave: ARMS_WAVE,
  hop: { l: L_UP, r: R_UP },
  dance: { l: ['M74 158 Q52 140 48 118', [46, 112]], r: ['M126 158 Q148 168 152 186', [153, 192]], lc: 'av-swing-l', rc: 'av-swing-r' },
  yoga: { l: ['M74 158 Q40 90 96 14', [97, 12]], r: ['M126 158 Q160 90 104 14', [103, 12]] },
  meditate: { l: ['M74 158 Q56 180 54 204', [52, 208]], r: ['M126 158 Q144 180 146 204', [148, 208]] },
  laptop: { l: ['M74 158 Q70 184 86 190', [88, 192]], r: ['M126 158 Q130 184 114 190', [112, 192]], lc: 'av-type-l', rc: 'av-type-r' },
  read: { l: ['M74 158 Q64 180 76 176', [77, 174]], r: ['M126 158 Q136 180 124 176', [123, 174]] },
  browse: { l: ['M74 158 Q64 180 76 176', [77, 174]], r: ['M126 158 Q136 180 124 176', [123, 174]] },
  relax: { l: ['M74 158 Q42 132 62 92', [64, 88]], r: ['M126 158 Q158 132 138 92', [136, 88]] },
  nap: { l: ['M74 158 Q70 186 90 196', [92, 198]], r: ['M126 158 Q130 186 110 196', [108, 198]] },
  water: { l: L_REST, r: ['M126 158 Q148 170 160 160', [162, 158]], rc: 'av-pour' },
  paint: { l: ['M74 158 Q60 176 64 190', [64, 192]], r: ['M126 158 Q150 140 160 118', [162, 112]], rc: 'av-paint' },
  lift: { l: ['M74 158 Q52 180 58 150', [58, 146]], r: ['M126 158 Q148 180 142 150', [142, 146]], lc: 'av-lift', rc: 'av-lift av-lift-late' },
  stargaze: { l: L_REST, r: ['M126 158 Q148 140 156 112', [158, 106]] },
  dice: { l: L_REST, r: ['M126 158 Q146 168 156 176', [158, 178]], rc: 'av-throw' },
  warm: { l: ['M74 158 Q64 182 80 190', [82, 192]], r: ['M126 158 Q136 182 120 190', [118, 192]] }
}

/** a plain wooden chair behind and under the character */
function ChairBack(): React.JSX.Element {
  const c = ramp('#b8794a')
  return <rect x="66" y="164" width="68" height="76" rx="9" fill={c.shade} stroke={c.line} strokeWidth="2.5" />
}

function ChairSeat(): React.JSX.Element {
  const c = ramp('#b8794a')
  return (
    <g stroke={c.line} strokeWidth="2.5">
      <rect x="60" y="234" width="80" height="9" rx="4" fill={c.base} />
      <path d="M66 243 L64 266 M134 243 L136 266" stroke={c.shade} strokeWidth="5" />
    </g>
  )
}

/** sitting on the floor */
function CrossedLegs({ c, s }: { c: Ramp; s: Ramp }): React.JSX.Element {
  return (
    <g stroke={c.line} strokeWidth="2.5">
      <rect x="60" y="244" width="52" height="18" rx="9" fill={c.base} transform="rotate(8 86 253)" />
      <rect x="88" y="244" width="52" height="18" rx="9" fill={c.shade} transform="rotate(-8 114 253)" />
      <ellipse cx="66" cy="262" rx="8" ry="6" fill={s.base} stroke={s.line} />
      <ellipse cx="134" cy="262" rx="8" ry="6" fill={s.base} stroke={s.line} />
    </g>
  )
}

/** props behind the arms (held from the sides) */
function PropsBehind({ action }: { action: string }): React.JSX.Element | null {
  if (action === 'read' || action === 'browse') {
    const c = ramp(action === 'read' ? '#5a8fb8' : '#c2685a')
    return (
      <g className="av-book" stroke={c.line} strokeWidth="2">
        <path d="M76 150 L100 156 L124 150 L124 184 L100 190 L76 184 Z" fill={c.base} />
        <path d="M100 156 V190" stroke={c.shade} strokeWidth="2.5" />
        <path d="M84 162 L94 165 M106 165 L116 162" stroke={c.light} strokeWidth="2" />
      </g>
    )
  }
  return null
}

/** props in front of the hands */
function PropsFront({ action }: { action: string }): React.JSX.Element | null {
  switch (action) {
    case 'laptop': {
      const c = ramp('#9aa0b4')
      return (
        <g stroke={c.line} strokeWidth="2">
          <rect x="70" y="164" width="60" height="38" rx="4" fill={c.base} />
          <circle cx="100" cy="182" r="5" fill="#f3ead8" stroke="none" />
          <path d="M97 181 l3 -3 l3 3" fill="none" stroke="#e5615a" strokeWidth="1.5" />
          <rect x="64" y="200" width="72" height="7" rx="3" fill={c.shade} />
        </g>
      )
    }
    case 'water': {
      const c = ramp('#8fb59a')
      return (
        <g>
          <g stroke={c.line} strokeWidth="2">
            <path d="M158 146 h22 v20 a4 4 0 0 1 -4 4 h-14 a4 4 0 0 1 -4 -4 Z" fill={c.base} />
            <path d="M180 150 L196 140" stroke={c.base} strokeWidth="4" />
            <path d="M162 146 Q169 134 176 146" fill="none" />
          </g>
          {[0, 1, 2].map((i) => (
            <ellipse key={i} className="av-drop" cx={198 + i * 2} cy={146} rx="1.6" ry="2.4" fill="#8cc4e8" style={{ animationDelay: `${i * 0.35}s` }} />
          ))}
        </g>
      )
    }
    case 'paint':
      return (
        <g>
          <ellipse cx="58" cy="196" rx="14" ry="8" fill="#e8d2b0" stroke="#8a6a4a" strokeWidth="1.8" />
          <circle cx="52" cy="194" r="2.4" fill="#e5615a" />
          <circle cx="58" cy="192" r="2.4" fill="#8cc4e8" />
          <circle cx="64" cy="194" r="2.4" fill="#e0a43c" />
          <g className="av-paint">
            <path d="M162 112 L176 92" stroke="#8a5a3a" strokeWidth="3" />
            <path d="M176 92 l4 -6" stroke="#5a8fb8" strokeWidth="4" />
          </g>
        </g>
      )
    case 'lift':
      return (
        <g fill="#4a4458">
          {[58, 142].map((x, i) => (
            <g key={x} className={`av-lift ${i ? 'av-lift-late' : ''}`}>
              <rect x={x - 12} y="143" width="24" height="5" rx="2" fill="#9a95a3" />
              <rect x={x - 15} y="138" width="6" height="15" rx="2" />
              <rect x={x + 9} y="138" width="6" height="15" rx="2" />
            </g>
          ))}
        </g>
      )
    case 'dice':
      return (
        <g className="av-die">
          <polygon points="172,184 180,180 188,184 188,193 180,197 172,193" fill="#f3ead8" stroke="#8a6a8a" strokeWidth="1.6" />
          <path d="M172 184 L180 188 L188 184 M180 188 V197" fill="none" stroke="#8a6a8a" strokeWidth="1.2" />
        </g>
      )
    default:
      return null
  }
}

/** little effects around the head */
function HeadFx({ action }: { action: string }): React.JSX.Element | null {
  const note = (x: number, y: number, d: number, k: number): React.JSX.Element => (
    <g key={k} className="av-float" style={{ animationDelay: `${d}s` }}>
      <path d={`M${x} ${y} v-14 l9 -3 v14`} fill="none" stroke="#a998d8" strokeWidth="2.2" />
      <ellipse cx={x - 2.5} cy={y} rx="3.5" ry="2.6" fill="#a998d8" />
      <ellipse cx={x + 6.5} cy={y - 3} rx="3.5" ry="2.6" fill="#a998d8" />
    </g>
  )
  const z = (x: number, y: number, d: number, k: number, size: number): React.JSX.Element => (
    <path
      key={k}
      className="av-float"
      style={{ animationDelay: `${d}s` }}
      d={`M${x} ${y} h${size} l-${size} ${size} h${size}`}
      fill="none"
      stroke="#8cc4e8"
      strokeWidth="2.4"
    />
  )
  const spark = (x: number, y: number, d: number, k: number): React.JSX.Element => (
    <path
      key={k}
      className="av-twinkle"
      style={{ animationDelay: `${d}s` }}
      d={`M${x} ${y - 6} Q${x + 1} ${y - 1} ${x + 6} ${y} Q${x + 1} ${y + 1} ${x} ${y + 6} Q${x - 1} ${y + 1} ${x - 6} ${y} Q${x - 1} ${y - 1} ${x} ${y - 6}Z`}
      fill="#f3c26b"
    />
  )
  switch (action) {
    case 'hum':
    case 'dance':
      return <g>{[note(164, 60, 0, 1), note(176, 40, 1.2, 2)]}</g>
    case 'nap':
    case 'relax':
      return <g>{[z(156, 54, 0, 1, 8), z(168, 36, 1, 2, 11)]}</g>
    case 'meditate':
    case 'stargaze':
      return <g>{[spark(40, 40, 0, 1), spark(166, 30, 0.8, 2), spark(176, 70, 1.6, 3)]}</g>
    case 'warm':
      return (
        <path className="av-float" d="M162 52 c-3 -4 -9 -2 -7 3 c1 3 7 7 7 7 c0 0 6 -4 7 -7 c2 -5 -4 -7 -7 -3Z" fill="#f0a6b4" />
      )
    default:
      return null
  }
}
