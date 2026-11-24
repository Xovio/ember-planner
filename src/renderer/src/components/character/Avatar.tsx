import { useId } from 'react'
import type { AvatarLook } from '@shared/types'
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES, itemById, ramp } from '@shared/wardrobe'

export type Expression = 'content' | 'happy' | 'proud' | 'sleepy' | 'cheer'

/**
 * The character as layered SVG (viewBox 200×280, about 2.5 heads tall). Every colour comes from
 * a ramp (base, shade, light, line), so skin, hair and clothes can take any colour.
 * Animation (breathing, blinking, waving) only runs with `animate` and without reduced motion (CSS).
 */
export function Avatar({
  look,
  outfit,
  expression = 'content',
  animate = false,
  size = 200,
  title
}: {
  look: AvatarLook
  outfit: Record<string, string>
  expression?: Expression
  animate?: boolean
  size?: number
  title?: string
}): React.JSX.Element {
  const uid = useId().replace(/:/g, '')
  const skin = ramp(SKIN_TONES[look.skin] ?? SKIN_TONES[3])
  const hair = ramp(HAIR_COLORS[look.hairColor] ?? HAIR_COLORS.ginger)
  const iris = EYE_COLORS[look.eyes] ?? EYE_COLORS.plum
  const top = itemById(outfit.top)
  const bottom = itemById(outfit.bottom)
  const shoes = itemById(outfit.shoes)
  const hat = itemById(outfit.hat)
  const extra = itemById(outfit.extra)
  const t = ramp(top?.color ?? '#e5615a')
  const b = ramp(bottom?.color ?? '#4a5578')
  const s = ramp(shoes?.color ?? '#f3ece0')
  const dx = (Math.max(0, Math.min(2, look.build)) - 1) * 6
  const robe = top?.style === 'robe'
  const cheer = expression === 'cheer'
  const blushColor = mixBlush(skin.base)

  return (
    <svg
      viewBox="-10 -30 220 310"
      width={size}
      height={(size * 310) / 220}
      className={`avatar ${animate ? 'animated' : ''}`}
      role="img"
      aria-label={title ?? 'Dein Charakter'}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <defs>
        <clipPath id={`il${uid}`}>
          <ellipse cx="83" cy="104" rx="9" ry="11.5" />
        </clipPath>
        <clipPath id={`ir${uid}`}>
          <ellipse cx="117" cy="104" rx="9" ry="11.5" />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="266" rx={44 + dx} ry="8" fill="#6b4a5a" opacity=".22" />

      <BackHair style={look.hair} c={hair} />

      <g className="av-breath">
        {/* legs */}
        {!robe && <Legs style={bottom?.style ?? 'pants'} c={b} skin={skin} />}
        <Shoes style={shoes?.style ?? 'sneakers'} c={s} />
        {/* body */}
        <Torso style={top?.style ?? 'hoodie'} c={t} dx={dx} />
        {/* arms */}
        <Arm d={cheer ? 'M74 158 Q58 146 50 128' : 'M74 158 Q58 176 60 196'} dx={-dx} c={t} skin={skin} short={top?.style === 'tee'} hand={cheer ? [48, 121] : [60, 201]} />
        <g className="av-wave">
          <Arm d="M126 158 Q142 146 150 128" dx={dx} c={t} skin={skin} short={top?.style === 'tee'} hand={[152, 121]} shaded />
        </g>
        {extra?.style === 'scarf' && <Scarf c={ramp(extra.color)} />}
      </g>

      <g transform="rotate(-4 100 150)">
        <ellipse cx="45" cy="104" rx="7" ry="9" fill={skin.base} stroke={skin.line} strokeWidth="2.5" />
        <ellipse cx="155" cy="104" rx="7" ry="9" fill={skin.base} stroke={skin.line} strokeWidth="2.5" />
        {look.hearingAid && <path d="M40 92 Q32 98 36 110 Q40 114 43 108" fill="#a99ec0" stroke="#5d5470" strokeWidth="2" />}
        <ellipse cx="100" cy="98" rx="56" ry="52" fill={skin.base} stroke={skin.line} strokeWidth="2.5" />
        <path d="M48 92 Q100 108 152 92 L152 70 L48 70 Z" fill={skin.shade} opacity=".55" />
        <path d="M120 140 Q146 128 152 100 Q156 132 120 148 Z" fill={skin.shade} opacity=".45" />

        <Eyes expression={expression} iris={iris} uid={uid} />
        <Brows expression={expression} line={hair.line} />
        <ellipse cx="72" cy="121" rx="9" ry="5" fill={blushColor} opacity=".55" />
        <ellipse cx="128" cy="121" rx="9" ry="5" fill={blushColor} opacity=".55" />
        <Mouth expression={expression} />

        <FrontHair style={look.hair} c={hair} />
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
    </svg>
  )
}

type Ramp = ReturnType<typeof ramp>

function mixBlush(skinHex: string): string {
  const n = parseInt(skinHex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const to = [240, 106, 122]
  return `rgb(${c.map((v, i) => Math.round(v + (to[i] - v) * 0.55)).join(',')})`
}

function BackHair({ style, c }: { style: string; c: Ramp }): React.JSX.Element {
  const p = { fill: c.base, stroke: c.line, strokeWidth: 3 }
  if (style === 'long') return <path d="M34 100 Q28 28 100 24 Q172 28 166 100 L170 184 Q152 198 140 176 L60 176 Q48 198 30 184 Z" {...p} />
  if (style === 'curly') {
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
  if (style === 'short') return <path d="M40 96 Q36 34 100 30 Q164 34 160 96 Q150 84 100 84 Q50 84 40 96 Z" {...p} />
  return (
    <g>
      {style === 'bun' && <circle cx="100" cy="22" r="20" {...p} />}
      <path d="M36 100 Q30 30 100 26 Q170 30 164 100 Q168 128 156 146 Q150 120 146 104 L54 104 Q50 120 44 146 Q32 128 36 100 Z" {...p} />
    </g>
  )
}

function FrontHair({ style, c }: { style: string; c: Ramp }): React.JSX.Element {
  const p = { fill: c.base, stroke: c.line, strokeWidth: 3 }
  if (style === 'curly') {
    return (
      <g>
        <path d="M44 92 Q42 40 100 34 Q158 40 156 92 Q146 74 128 74 Q116 64 100 70 Q84 64 72 74 Q54 74 44 92 Z" {...p} />
        {[[64, 62], [84, 52], [104, 50], [124, 54], [142, 66]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="11" fill={c.base} stroke={c.line} strokeWidth="2.5" />
        ))}
        <path d="M70 50 Q80 42 92 44" fill="none" stroke={c.light} strokeWidth="4" />
      </g>
    )
  }
  if (style === 'short') {
    return (
      <g>
        <path d="M44 92 Q42 38 100 34 Q158 38 156 92 Q148 74 132 70 Q124 80 110 76 Q100 64 86 72 Q72 66 60 78 Q50 82 44 92 Z" {...p} />
        <path d="M64 54 Q78 44 96 44" fill="none" stroke={c.light} strokeWidth="4" />
      </g>
    )
  }
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

function Eyes({ expression, iris, uid }: { expression: Expression; iris: string; uid: string }): React.JSX.Element {
  const lid = '#5b3340'
  if (expression === 'proud') {
    return (
      <g fill="none" stroke={lid} strokeWidth="4">
        <path d="M74 108 Q83 97 92 108" />
        <path d="M108 108 Q117 97 126 108" />
      </g>
    )
  }
  if (expression === 'sleepy') {
    return (
      <g fill="none" stroke={lid} strokeWidth="3.5">
        <path d="M74 105 Q83 111 92 105" />
        <path d="M108 105 Q117 111 126 105" />
      </g>
    )
  }
  const lower = shift(iris)
  return (
    <g className="av-blink">
      <ellipse cx="83" cy="104" rx="9" ry="11.5" fill={iris} />
      <ellipse cx="117" cy="104" rx="9" ry="11.5" fill={iris} />
      <ellipse cx="83" cy="112" rx="8" ry="6" fill={lower} clipPath={`url(#il${uid})`} />
      <ellipse cx="117" cy="112" rx="8" ry="6" fill={lower} clipPath={`url(#ir${uid})`} />
      <circle cx="80" cy="99" r="3.6" fill="#fff8ee" />
      <circle cx="114" cy="99" r="3.6" fill="#fff8ee" />
      <circle cx="86" cy="109" r="1.7" fill="#fff8ee" />
      <circle cx="120" cy="109" r="1.7" fill="#fff8ee" />
      <path d="M72 97 Q83 88 95 96" fill="none" stroke={lid} strokeWidth="3.5" />
      <path d="M106 96 Q117 88 128 97" fill="none" stroke={lid} strokeWidth="3.5" />
      <path d="M72 97 l-4 -3 M128 97 l4 -3" stroke={lid} strokeWidth="2.5" />
    </g>
  )
}

/** a lighter tint of the iris for its lower half */
function shift(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * 0.3))
  return `rgb(${c.join(',')})`
}

function Brows({ expression, line }: { expression: Expression; line: string }): React.JSX.Element {
  const up = expression === 'cheer' || expression === 'happy' ? -3 : expression === 'sleepy' ? 3 : 0
  return (
    <g fill="none" stroke={line} strokeWidth="3">
      <path d={`M74 ${84 + up} Q82 ${79 + up} 91 ${82 + up}`} />
      <path d={`M109 ${81 + up} Q118 ${78 + up} 127 ${83 + up}`} />
    </g>
  )
}

function Mouth({ expression }: { expression: Expression }): React.JSX.Element {
  if (expression === 'content') return <path d="M97 123 Q104 129 111 122" fill="none" stroke="#8a3a44" strokeWidth="2.5" />
  if (expression === 'sleepy') return <ellipse cx="105" cy="125" rx="3.5" ry="4" fill="#b5545a" stroke="#8a3a44" strokeWidth="1.8" />
  const big = expression === 'cheer'
  return (
    <g>
      <path d={big ? 'M95 121 Q104 136 114 120 Z' : 'M98 122 Q104 131 111 121 Z'} fill="#b5545a" stroke="#8a3a44" strokeWidth="1.8" />
      <path d={big ? 'M99 128 Q104 131 110 127' : 'M101 126 Q104 128 107 125'} fill="none" stroke="#e48a8a" strokeWidth="2" />
    </g>
  )
}

function Torso({ style, c, dx }: { style: string; c: Ramp; dx: number }): React.JSX.Element {
  const by = style === 'robe' ? 252 : 222
  const fl = style === 'robe' ? 10 : 0
  const body = `M${70 - dx} 168 Q${68 - dx} 148 86 145 L114 145 Q${132 + dx} 148 ${130 + dx} 168 L${134 + dx + fl} ${by - 14} Q${135 + dx + fl} ${by} 120 ${by} L80 ${by} Q${65 - dx - fl} ${by} ${66 - dx - fl} ${by - 14} Z`
  const shadeD = `M118 148 Q${132 + dx} 152 ${130 + dx} 168 L${134 + dx + fl} ${by - 14} Q${135 + dx + fl} ${by} 120 ${by} L112 ${by} Q124 190 118 148 Z`
  return (
    <g>
      <path d={body} fill={c.base} stroke={c.line} strokeWidth="3" />
      <path d={shadeD} fill={c.shade} />
      <path d={`M${78 - dx} 156 Q${74 - dx} 176 ${76 - dx} 200`} fill="none" stroke={c.light} strokeWidth="4" opacity=".8" />
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
          <path d={`M${70 - dx} 212 H${130 + dx}`} strokeWidth="3" stroke={c.shade} />
        </g>
      )}
      {style === 'sport' && (
        <g>
          <path d="M90 146 L100 160 L110 146" fill="none" stroke={c.line} strokeWidth="2.5" />
          <path d={`M${68 - dx} 190 L${132 + dx} 170 L${133 + dx} 180 L${68 - dx} 200 Z`} fill="#f3ece0" opacity=".85" />
        </g>
      )}
      {style === 'robe' && (
        <g>
          <path d="M90 146 L100 170 L110 146" fill="none" stroke="#e8c070" strokeWidth="3" />
          <rect x={70 - dx} y="196" width={60 + 2 * dx} height="7" rx="3" fill="#e8c070" />
          <path d="M84 228 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 z" fill="#e8c070" />
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

function Legs({ style, c, skin }: { style: string; c: Ramp; skin: Ramp }): React.JSX.Element {
  const leg = (fill: string, line: string, h: number): React.JSX.Element => (
    <g>
      <rect x="78" y="204" width="22" height={h} rx="10" fill={fill} stroke={line} strokeWidth="2.5" />
      <rect x="102" y="202" width="21" height={h - 2} rx="10" fill={fill} stroke={line} strokeWidth="2.5" transform="rotate(7 112 204)" />
    </g>
  )
  if (style === 'shorts') {
    return (
      <g>
        {leg(skin.base, skin.line, 46)}
        {leg(c.base, c.line, 22)}
      </g>
    )
  }
  if (style === 'skirt') {
    return (
      <g>
        {leg(skin.base, skin.line, 46)}
        <path d="M70 198 L130 198 L142 232 Q100 244 58 232 Z" fill={c.base} stroke={c.line} strokeWidth="2.5" />
        <path d="M118 200 L130 198 L142 232 Q132 236 124 238 Z" fill={c.shade} />
      </g>
    )
  }
  return (
    <g>
      {leg(c.base, c.line, 46)}
      <rect x="114" y="206" width="6" height="36" rx="3" fill={c.shade} transform="rotate(7 112 204)" />
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
