import { useId } from 'react'
import '../styles/mascot.css'

// Щърко, Govori's stork. A white stork wearing a мартеница (the red-and-white
// cord Bulgarians wear in March until they see the first stork), with its two
// tassels, Пижо (white) and Пенда (red). Flat shapes, one silhouette outline
// drawn by an SVG filter: an ink line that reads on linen and a linen halo
// that reads on the dark theme.

export type MascotMood = 'idle' | 'happy' | 'sad' | 'think' | 'cheer' | 'sleep'

export interface MascotProps {
  mood?: MascotMood
  size?: number
  className?: string
  title?: string
}

const INK = '#2a1a20'
const WHITE = '#ffffff'
const BACK = '#eadfe3' // the far wing, a step darker than the body
const BEAK = '#ec5b3f'
const BEAK_DARK = '#c9402f'
const ROSE = '#d12c4a'
const BLUSH = '#ffb3c1'
const TEAR = '#8cc4ff'
const GOLD = '#f5a623'

/** Eight-pointed embroidery star (осмолъчка): two squares, one turned 45 degrees. */
function Star({ x, y, r, className }: { x: number; y: number; r: number; className?: string }) {
  const s = r * 0.72
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={className}>
        <rect x={-s} y={-s} width={s * 2} height={s * 2} fill={GOLD} />
        <rect x={-s} y={-s} width={s * 2} height={s * 2} fill={GOLD} transform="rotate(45)" />
        <rect x={-r * 0.22} y={-r * 0.22} width={r * 0.44} height={r * 0.44} fill={WHITE} transform="rotate(45)" />
      </g>
    </g>
  )
}

/** The folded wing: white coverts with ink primaries trailing back past the tail. */
function FoldedWing() {
  return (
    <>
      <path d="M78 118 C64 120 48 128 30 142 L42 143 L33 151 L48 150 L44 158 L60 153 C70 148 78 140 82 130 Z" fill={INK} />
      <path d="M118 116 C104 105 80 108 64 122 C76 140 100 148 122 140 C128 132 126 122 118 116 Z" fill={WHITE} />
      <path d="M76 128 C88 136 104 140 118 136" fill="none" stroke={BACK} strokeWidth="3" strokeLinecap="round" />
    </>
  )
}

/** A raised wing (happy, cheer): fanned up and back from the shoulder. */
function RaisedWing({ back = false }: { back?: boolean }) {
  return (
    <>
      <path d="M58 52 L48 46 L54 60 L40 58 L50 70 L38 72 L54 80 C62 74 66 66 66 58 Z" fill={INK} />
      <path d="M112 114 C96 96 78 74 62 54 C70 72 70 84 58 84 C72 100 92 116 112 124 Z" fill={back ? BACK : WHITE} />
    </>
  )
}

/** The thinking wing: curled up so its tip rests under the beak. */
function ChinWing() {
  return (
    <>
      <path d="M118 116 C104 106 82 110 68 124 C82 138 104 144 120 138 C126 130 126 122 118 116 Z" fill={WHITE} />
      <path d="M120 120 C134 112 144 98 146 82 C140 80 136 82 134 86 C130 98 122 106 112 112 Z" fill={WHITE} />
      <path d="M146 82 C140 78 134 80 132 84 L138 88 C142 88 145 86 146 82 Z" fill={INK} />
    </>
  )
}

function Eyes({ mood }: { mood: MascotMood }) {
  if (mood === 'happy' || mood === 'cheer')
    return <path d="M125.5 54 Q131 46.5 136.5 54" fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round" />
  if (mood === 'sleep')
    return <path d="M125.5 52.5 Q131 58.5 136.5 52.5" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
  const up = mood === 'think' ? -2.5 : 0
  return (
    <g className="m-eye">
      <circle cx="131" cy={52 + up} r="5" fill={INK} />
      <circle cx="132.8" cy={50.2 + up} r="1.7" fill={WHITE} />
      {mood === 'sad' && <path d="M124.5 44.5 L136 42" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
    </g>
  )
}

export function Mascot({ mood = 'idle', size = 120, className, title }: MascotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const outline = `m-outline-${uid}`
  const cord = `m-cord-${uid}`
  const label = title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true as const }

  return (
    <svg
      className={['gv-mascot', `gv-mascot--${mood}`, className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="-8 -12 216 216"
      {...label}
    >
      {title && <title>{title}</title>}
      <defs>
        <filter id={outline} x="-8" y="-12" width="216" height="216" filterUnits="userSpaceOnUse">
          <feMorphology in="SourceAlpha" operator="dilate" radius="5.2" result="halo" />
          <feFlood floodColor="#fff8f4" />
          <feComposite in2="halo" operator="in" result="haloFill" />
          <feMorphology in="SourceAlpha" operator="dilate" radius="2.6" result="line" />
          <feFlood floodColor={INK} />
          <feComposite in2="line" operator="in" result="lineFill" />
          <feMerge>
            <feMergeNode in="haloFill" />
            <feMergeNode in="lineFill" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={cord}>
          <rect x="103" y="95" width="30" height="10" rx="5" transform="rotate(-14 118 100)" />
        </clipPath>
      </defs>

      <ellipse className="m-shadow" cx="100" cy="191" rx="38" ry="5" fill={INK} opacity="0.13" />

      <g filter={`url(#${outline})`}>
        <g className="m-root">
          {/* legs */}
          <g className="m-legs" stroke={BEAK} strokeWidth="5.5" strokeLinecap="round" fill="none">
            <path d="M90 156 L88 187 L99 188" />
            <path d="M108 156 L110 187 L121 188" />
          </g>

          {/* far wing, only when the wings go up */}
          {mood === 'cheer' && (
            <g className="m-wing-back">
              <g transform="translate(14 -6)">
                <RaisedWing back />
              </g>
            </g>
          )}

          {/* body */}
          <g className="m-body">
            <ellipse cx="98" cy="132" rx="46" ry="33" transform="rotate(-14 98 132)" fill={WHITE} />
          </g>

          {/* near wing */}
          <g className="m-wing">{mood === 'happy' || mood === 'cheer' ? <RaisedWing /> : mood === 'think' ? <ChinWing /> : <FoldedWing />}</g>

          {/* neck, head and beak: one group so moods can tilt it from the neck base */}
          <g className="m-head">
            <path d="M110 120 C114 100 120 88 124 66" fill="none" stroke={WHITE} strokeWidth="21" strokeLinecap="round" />
            <circle cx="126" cy="57" r="22" fill={WHITE} />
            <g className="m-beak">
              <path d="M141 50 L185 67 Q187.5 69.5 184.5 70.5 L141 62 Z" fill={BEAK} />
              <path d="M141 61 L184.5 70.5 Q181 73.5 177 72.5 L142 68 Z" fill={BEAK_DARK} className="m-jaw" />
            </g>
            <ellipse cx="124" cy="65" rx="5.5" ry="3.4" fill={BLUSH} opacity="0.9" />
            <Eyes mood={mood} />
            {mood === 'sad' && <path className="m-tear" d="M134 60 Q137.5 66 134 69 Q130.5 66 134 60 Z" fill={TEAR} />}
          </g>

          {/* мартеница: twisted red-and-white cord with Пижо and Пенда */}
          <g className="m-cord">
            <g clipPath={`url(#${cord})`}>
              <rect x="100" y="90" width="36" height="20" fill={WHITE} />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <path key={i} d={`M${98 + i * 7} 112 l9 -24 l4 0 l-9 24 Z`} fill={ROSE} />
              ))}
            </g>
            <path d="M122 103 C123 110 122 116 120 122" fill="none" stroke={ROSE} strokeWidth="2.2" />
            <path d="M125 102 C128 110 129 117 130 124" fill="none" stroke={ROSE} strokeWidth="2.2" />
            <circle cx="120" cy="125" r="5.4" fill={WHITE} />
            <path d="M116.5 128 L115.5 134 M120 129 L120 135 M123.5 128 L124.5 134" stroke={WHITE} strokeWidth="2" strokeLinecap="round" />
            <circle cx="131" cy="127" r="5.4" fill={ROSE} />
            <path d="M127.5 130 L126.5 136 M131 131 L131 137 M134.5 130 L135.5 136" stroke={ROSE} strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* mood effects */}
          {mood === 'cheer' && (
            <g className="m-fx">
              <Star className="m-spark m-spark-1" x={34} y={36} r={9} />
              <Star className="m-spark m-spark-2" x={172} y={28} r={7} />
              <Star className="m-spark m-spark-3" x={176} y={112} r={8} />
            </g>
          )}
          {mood === 'think' && (
            <g className="m-fx" fill={INK}>
              <rect className="m-dot m-dot-1" x="150" y="30" width="5" height="5" />
              <rect className="m-dot m-dot-2" x="160" y="18" width="7" height="7" />
              <rect className="m-dot m-dot-3" x="173" y="4" width="9" height="9" />
            </g>
          )}
          {mood === 'sleep' && (
            <g className="m-fx" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path className="m-z m-z-1" d="M150 34 h9 l-9 10 h9" />
              <path className="m-z m-z-2" d="M164 14 h12 l-12 13 h12" />
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}

export default Mascot
