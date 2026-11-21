// One illustration family for Govori, drawn from the шевица (cross-stitch) geometry:
// fine-line rhombus lattices and the eight-pointed star (осмолъчка). 1.5pt strokes,
// rose at 40% and ink at 20%, with one small solid rose stitch as the focal point.
import type { ReactNode } from 'react'
import './illustration.css'

export type IllustrationName = 'stats' | 'quiz' | 'phrases' | 'welcome' | 'reminders' | 'voice' | 'install'

/** A rhombus (diamond) centred on cx, cy. */
const rhombus = (cx: number, cy: number, rx: number, ry = rx) => `M${cx} ${cy - ry}L${cx + rx} ${cy}L${cx} ${cy + ry}L${cx - rx} ${cy}Z`

/** The eight-pointed star: two overlapping squares, traced as one 16-point outline. */
function star(cx: number, cy: number, r: number) {
  const inner = r * 0.7654 // where the two squares' edges cross
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2
    const rad = i % 2 === 0 ? r : inner
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

/** A zigzag stitch line, like an embroidered hem. */
function zigzag(x0: number, x1: number, y: number, step: number, h: number) {
  let d = `M${x0} ${y}`
  for (let x = x0 + step, up = true; x <= x1 + 0.01; x += step, up = !up) d += `L${x} ${up ? y - h : y}`
  return d
}

type Stroke = { d: string; tone: 'rose' | 'ink' }
type Art = { strokes: Stroke[]; dots?: { d: string }[]; hole?: boolean }

function art(name: IllustrationName): Art {
  switch (name) {
    case 'stats': {
      // Stitched columns rising like a chart, the tallest crowned with a star.
      const strokes: Stroke[] = []
      const cols = [3, 5, 7]
      cols.forEach((n, c) => {
        const x = 34 + c * 26
        for (let i = 0; i < n; i++) strokes.push({ d: rhombus(x, 100 - i * 11, 6, 6), tone: c === 2 && i === n - 1 ? 'rose' : 'ink' })
      })
      strokes.push({ d: star(86, 18, 10), tone: 'rose' })
      strokes.push({ d: 'M16 108H104', tone: 'ink' })
      return { strokes, dots: [{ d: rhombus(86, 18, 2.6) }] }
    }
    case 'quiz': {
      // Two stars, his and hers, overlapping over a stitched hem.
      return {
        strokes: [
          { d: star(48, 52, 26), tone: 'ink' },
          { d: star(72, 52, 26), tone: 'rose' },
          { d: rhombus(60, 52, 6, 9), tone: 'rose' },
          { d: zigzag(20, 100, 98, 8, 6), tone: 'ink' },
        ],
        dots: [{ d: rhombus(60, 52, 2.6, 3.6) }],
      }
    }
    case 'phrases': {
      // A small lattice of stitches with one space waiting for her phrase.
      const strokes: Stroke[] = []
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) {
          if (r === 1 && c === 1) continue
          strokes.push({ d: rhombus(32 + c * 28, 32 + r * 28, 12, 12), tone: 'ink' })
        }
      strokes.push({ d: rhombus(60, 60, 12, 12), tone: 'rose' })
      strokes.push({ d: 'M60 54V66M54 60H66', tone: 'rose' })
      return { strokes }
    }
    case 'welcome': {
      // A ring of stitches with a faint star, leaving the centre for the brand mark.
      const strokes: Stroke[] = [{ d: star(60, 60, 52), tone: 'ink' }]
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI / 6) * i - Math.PI / 2
        strokes.push({ d: rhombus(60 + 44 * Math.cos(a), 60 + 44 * Math.sin(a), 4, 5), tone: i % 3 === 0 ? 'rose' : 'ink' })
      }
      return { strokes, hole: true }
    }
    case 'reminders': {
      // The evening star (вечерница) rising over an embroidered horizon.
      return {
        strokes: [
          { d: star(60, 42, 22), tone: 'rose' },
          { d: rhombus(60, 42, 7, 7), tone: 'rose' },
          { d: zigzag(14, 106, 92, 8, 7), tone: 'ink' },
          { d: zigzag(30, 90, 104, 6, 4), tone: 'ink' },
        ],
        dots: [{ d: rhombus(60, 42, 2.8) }],
      }
    }
    case 'voice': {
      // Sound travelling out as nested rhombuses.
      return {
        strokes: [
          { d: rhombus(60, 60, 12, 12), tone: 'rose' },
          { d: rhombus(60, 60, 26, 26), tone: 'rose' },
          { d: rhombus(60, 60, 40, 40), tone: 'ink' },
          { d: rhombus(60, 60, 54, 54), tone: 'ink' },
        ],
        dots: [{ d: rhombus(60, 60, 4) }],
      }
    }
    case 'install': {
      // A phone with a grid of icons, one of them ours.
      const strokes: Stroke[] = [{ d: 'M38 10H82A8 8 0 0 1 90 18V102A8 8 0 0 1 82 110H38A8 8 0 0 1 30 102V18A8 8 0 0 1 38 10Z', tone: 'ink' }]
      for (let r = 0; r < 3; r++)
        for (let c = 0; c < 3; c++) strokes.push({ d: rhombus(44 + c * 16, 36 + r * 18, 5, 5), tone: r === 2 && c === 1 ? 'rose' : 'ink' })
      strokes.push({ d: 'M52 100H68', tone: 'ink' })
      return { strokes, dots: [{ d: rhombus(60, 72, 2.4) }] }
    }
  }
}

export function Illustration({ name, size = 120, draw = true, className = '', children }: { name: IllustrationName; size?: number; draw?: boolean; className?: string; children?: ReactNode }) {
  const { strokes, dots = [], hole } = art(name)
  return (
    <span className={`ill ${draw ? 'ill--draw' : ''} ${hole ? 'ill--hole' : ''} ${className}`} style={{ width: size, height: size, ['--ill-sw' as string]: (180 / size).toFixed(3) }} aria-hidden="true">
      <svg viewBox="0 0 120 120" width={size} height={size} fill="none" strokeLinejoin="round" strokeLinecap="round">
        {strokes.map((s, i) => (
          <path key={i} d={s.d} pathLength={1} className={`ill__s ill__s--${s.tone}`} style={{ animationDelay: `${Math.min(i, 14) * 40}ms` }} />
        ))}
        {dots.map((d, i) => (
          <path key={`d${i}`} d={d.d} className="ill__dot" />
        ))}
      </svg>
      {children ? <span className="ill__center">{children}</span> : null}
    </span>
  )
}
