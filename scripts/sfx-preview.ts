// Renders every Govori sound to a WAV file and prints its levels, so the sounds can be
// auditioned and checked without opening the app.
//
//   node scripts/sfx-preview.ts [output folder]      (default: ./sfx-preview)
//
// It fails (exit 1) if a sound clips, starts or ends with a click, is out of tune, or would be
// too quiet on a phone speaker, so it doubles as a regression check after editing sfx-dsp.ts.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CORRECT_STEPS, renderSfx, type SfxName } from '../src/lib/sfx-dsp.ts'

const SR = 44_100
const outDir = process.argv[2] ?? 'sfx-preview'
mkdirSync(outDir, { recursive: true })

function wav(samples: Float32Array, sr: number): Buffer {
  const buf = Buffer.alloc(44 + samples.length * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + samples.length * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sr, 24)
  buf.writeUInt32LE(sr * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(samples.length * 2, 40)
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2)
  return buf
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity)

/** Energy of one frequency in a stretch of samples (Goertzel). */
function goertzel(s: Float32Array, sr: number, f: number, from = 0, to = s.length) {
  const w = (2 * Math.PI * f) / sr
  const c = 2 * Math.cos(w)
  let a = 0
  let b = 0
  for (let n = from; n < to; n++) {
    const t = s[n] + c * a - b
    b = a
    a = t
  }
  return Math.sqrt(a * a + b * b - c * a * b) / (to - from)
}

/** The strongest pitch near `expect`, in cents away from it. */
function tuning(s: Float32Array, sr: number, expect: number, from: number, to: number) {
  let best = 0
  let bestCents = 0
  for (let c = -60; c <= 60; c += 2) {
    const e = goertzel(s, sr, expect * 2 ** (c / 1200), from, to)
    if (e > best) {
      best = e
      bestCents = c
    }
  }
  return bestCents
}

/** Share of the energy between 300 Hz and 5 kHz: the part a phone speaker reproduces well. */
function speakerShare(s: Float32Array, sr: number) {
  let inBand = 0
  let all = 0
  for (let f = 60; f < 12_000; f *= 1.06) {
    const e = goertzel(s, sr, f) ** 2 * f // weight by bandwidth of the log step
    all += e
    if (f >= 300 && f <= 5000) inBand += e
  }
  return inBand / all
}

interface Row {
  file: string
  seconds: string
  peak: string
  rms: string
  speaker: string
  note: string
}
const rows: Row[] = []
const problems: string[] = []

function check(file: string, s: Float32Array, expect?: { freq: number; from: number; to: number }) {
  let peak = 0
  let sum = 0
  for (const v of s) {
    peak = Math.max(peak, Math.abs(v))
    sum += v * v
  }
  const rms = Math.sqrt(sum / s.length)
  const share = speakerShare(s, SR)
  let note = ''
  if (expect) {
    const off = tuning(s, SR, expect.freq, Math.round(expect.from * SR), Math.round(expect.to * SR))
    note = `${expect.freq.toFixed(1)} Hz ${off >= 0 ? '+' : ''}${off} cents`
    if (Math.abs(off) > 12) problems.push(`${file}: ${off} cents out of tune`)
  }
  if (peak > 0.5) problems.push(`${file}: peak ${db(peak).toFixed(1)} dBFS is too hot next to speech`)
  if (Math.abs(s[0]) > 0.02) problems.push(`${file}: starts with a click (${s[0].toFixed(3)})`)
  if (Math.abs(s[s.length - 1]) > 0.001) problems.push(`${file}: ends with a click`)
  if (s.some((v) => !Number.isFinite(v))) problems.push(`${file}: contains NaN`)
  if (share < 0.45) problems.push(`${file}: only ${(share * 100).toFixed(0)}% of its energy is in the phone-speaker range`)
  rows.push({ file, seconds: (s.length / SR).toFixed(2), peak: db(peak).toFixed(1), rms: db(rms).toFixed(1), speaker: `${(share * 100).toFixed(0)}%`, note })
  writeFileSync(join(outDir, file), wav(s, SR))
}

const st = (n: number) => 440 * 2 ** (n / 12)
const CLIMB = [0, 2, 5, 7, 9, 12, 14, 17]
const simple: SfxName[] = ['tap', 'select', 'wrong', 'combo', 'complete', 'streak', 'welcome']

for (let step = 0; step < CORRECT_STEPS; step++) check(`correct-${step + 1}.wav`, renderSfx('correct', SR, step), { freq: st(CLIMB[step]), from: 0.09, to: 0.4 })
for (const name of simple) {
  const expect = name === 'complete' ? { freq: st(5), from: 7 * 0.118 + 0.08, to: 7 * 0.118 + 0.6 } : name === 'streak' ? { freq: st(9), from: 0.5, to: 0.95 } : undefined
  check(`${name}.wav`, renderSfx(name, SR), expect)
}

// A whole lesson's worth in one file: taps, a climbing run, a miss, the bell, the finish.
const gapS = (n: number) => new Float32Array(Math.round(n * SR))
const demo = [
  renderSfx('tap', SR), gapS(0.5), renderSfx('select', SR), gapS(0.4),
  ...[0, 1, 2, 3, 4].flatMap((i) => [renderSfx('correct', SR, i), gapS(0.25)]),
  renderSfx('combo', SR), gapS(0.3), renderSfx('wrong', SR), gapS(0.6), renderSfx('correct', SR, 0), gapS(0.4),
  renderSfx('complete', SR), gapS(0.2), renderSfx('streak', SR),
]
const whole = new Float32Array(demo.reduce((n, d) => n + d.length, 0))
let o = 0
for (const d of demo) {
  whole.set(d, o)
  o += d.length
}
writeFileSync(join(outDir, 'demo-lesson.wav'), wav(whole, SR))

console.table(rows)
if (problems.length) {
  console.error(problems.map((p) => `PROBLEM  ${p}`).join('\n'))
  process.exit(1)
}
console.log(`${rows.length} sounds written to ${outDir}; no problems`)
