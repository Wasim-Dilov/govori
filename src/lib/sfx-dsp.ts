// Govori's sounds, synthesised from scratch. No audio files, no samples.
//
// The palette is a small Bulgarian folk band rather than the usual app chimes:
//   tambura  a long-necked lute with paired metal strings (plucked answers and the lesson tune)
//   tapan    the big double-headed drum (a soft thud for "not quite", the dance beat)
//   chan     a cast shepherd's bell (a run of right answers)
//   kaval    the breathy end-blown flute (streaks and level-ups)
//   wood     a knuckle on the tambura's body (taps)
// The lesson-complete tune is one bar of ръченица, the 7/8 dance counted quick-quick-slow.
//
// Everything here is plain arithmetic on Float32Arrays: no Web Audio, so the same code renders
// in the browser (see audio.ts) and in Node (scripts/sfx-preview.ts) for checking levels.

export type SfxName = 'tap' | 'select' | 'correct' | 'wrong' | 'combo' | 'complete' | 'streak' | 'welcome'

/** How many steps the "correct" pluck can climb before it stays on the top note. */
export const CORRECT_STEPS = 8

// ---------------------------------------------------------------- helpers
/** A small seeded random source, so a render is repeatable and variants differ only by seed. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TAU = Math.PI * 2
/** Semitones above A4 (440 Hz) to a frequency. */
const st = (n: number) => 440 * 2 ** (n / 12)
const cents = (f: number, c: number) => f * 2 ** (c / 1200)
const dB = (d: number) => 10 ** (d / 20)

// The tambura here is tuned around D. Semitone offsets from A4.
const N = { D3: -19, A3: -12, D4: -7, E4: -5, Fs4: -3, G4: -2, A4: 0, B4: 2, Cs5: 4, D5: 5, E5: 7, Fs5: 9, G5: 10, A5: 12, B5: 14, D6: 17 }

/** One mono voice being mixed into a buffer. */
interface Mix {
  out: Float32Array
  sr: number
}
const at = (m: Mix, seconds: number) => Math.max(0, Math.round(seconds * m.sr))

/** A two-pole resonant band-pass (constant peak gain), used for wood, breath and drum skin. */
function bandpass(sr: number, freq: number, q: number) {
  const w = (TAU * freq) / sr
  const alpha = Math.sin(w) / (2 * q)
  const a0 = 1 + alpha
  const b0 = alpha / a0
  const a1 = (-2 * Math.cos(w)) / a0
  const a2 = (1 - alpha) / a0
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  return (x: number) => {
    const y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x
    y2 = y1
    y1 = y
    return y
  }
}

// ---------------------------------------------------------------- tambura: plucked metal strings
interface Pluck {
  /** Seconds for the note to die away. */
  ring?: number
  /** 0 dull .. 1 bright: how hard the plectrum hits. */
  bright?: number
  /** Where the string is picked, as a fraction of its length. Near the bridge is thinner. */
  pick?: number
  /** A palm on the strings: stops the note quickly. */
  mute?: boolean
  gain?: number
  seed?: number
}

/**
 * One string, by the extended Karplus-Strong method: a burst of noise goes round a delay line
 * one period long, losing a little treble each lap, which is what a real plucked string does.
 */
function string(m: Mix, start: number, freq: number, p: Required<Omit<Pluck, 'mute'>> & { mute: boolean }) {
  const { sr, out } = m
  const period = sr / freq
  // Loop low-pass: s is both its strength and its delay in samples.
  const s = p.mute ? 0.5 : 0.5 - 0.32 * p.bright
  const len = Math.floor(period - s - 0.1)
  if (len < 2) return
  // A first-order all-pass makes up the leftover fraction of a sample so the note is in tune.
  // Both filters delay by slightly different amounts at different pitches, so work it out at this one.
  const w = TAU / period
  const lowDelay = Math.atan2(s * Math.sin(w), 1 - s + s * Math.cos(w)) / w
  const frac = period - len - lowDelay
  const C = Math.sin(((1 - frac) * w) / 2) / Math.sin(((1 + frac) * w) / 2)
  const ring = p.mute ? Math.min(p.ring, 0.09) : p.ring
  const loss = 10 ** (-3 / (freq * ring))

  // The pluck itself: noise, darkened for a soft stroke, with the comb a pick position leaves.
  const rand = rng(p.seed)
  const line = new Float32Array(len)
  let lp = 0
  const dark = 0.25 + 0.7 * p.bright
  let mean = 0
  for (let i = 0; i < len; i++) {
    lp += dark * (rand() * 2 - 1 - lp)
    line[i] = lp
    mean += lp
  }
  mean /= len
  const gap = Math.max(1, Math.round(len * p.pick))
  const shaped = new Float32Array(len)
  let peak = 1e-9
  for (let i = 0; i < len; i++) {
    shaped[i] = line[i] - mean - 0.9 * (line[(i - gap + len) % len] - mean)
    peak = Math.max(peak, Math.abs(shaped[i]))
  }
  for (let i = 0; i < len; i++) line[i] = shaped[i] / peak

  const from = at(m, start)
  const total = Math.min(out.length - from, Math.round((ring * 1.15 + 0.02) * sr))
  const fade = Math.round(0.012 * sr)
  // The plectrum takes about a millisecond to let go.
  const rise = Math.max(1, Math.round(0.0012 * sr))
  let prev = 0
  let apIn = 0
  let apOut = 0
  for (let n = 0, i = 0; n < total; n++) {
    const y = line[i]
    const low = (1 - s) * y + s * prev
    prev = y
    const ap = C * low + apIn - C * apOut
    apIn = low
    apOut = ap
    line[i] = loss * ap
    if (++i === len) i = 0
    const tail = n > total - fade ? (total - n) / fade : 1
    out[from + n] += y * p.gain * tail * Math.min(1, n / rise)
  }
}

/** A tambura note: its strings come in pairs, struck a few milliseconds apart and never quite in tune. */
function tambura(m: Mix, start: number, note: number, p: Pluck = {}) {
  const base = { ring: p.ring ?? 0.7, bright: p.bright ?? 0.7, pick: p.pick ?? 0.17, mute: p.mute ?? false, gain: (p.gain ?? 1) * 0.5, seed: p.seed ?? 1 }
  const f = st(note)
  string(m, start, cents(f, -3.5), base)
  string(m, start + 0.006, cents(f, 3.5), { ...base, seed: base.seed + 97, pick: base.pick + 0.03 })
}

// ---------------------------------------------------------------- tapan: the big drum
/** A soft mallet on the low head: a short falling thud, voiced high enough for a phone speaker. */
function tapan(m: Mix, start: number, gain = 1, seed = 5) {
  const { sr, out } = m
  const from = at(m, start)
  const total = Math.min(out.length - from, Math.round(0.3 * sr))
  const rand = rng(seed)
  const skin = bandpass(sr, 520, 1.6)
  const shell = bandpass(sr, 1150, 2.5)
  let phase = 0
  for (let n = 0; n < total; n++) {
    const t = n / sr
    const f = 132 + 120 * Math.exp(-t / 0.03)
    phase += (TAU * f) / sr
    // Overdriving the thud adds the harmonics small speakers can actually play.
    const body = Math.tanh(2.6 * Math.sin(phase)) * Math.exp(-t / 0.07)
    const x = rand() * 2 - 1
    const slap = skin(x) * Math.exp(-t / 0.03) * 3.2 + shell(x) * Math.exp(-t / 0.012) * 1.6
    const attack = Math.min(1, n / (0.002 * sr))
    const tail = n > total - 400 ? (total - n) / 400 : 1
    out[from + n] += (0.32 * body + slap) * attack * tail * gain * 0.7
  }
}

/** The thin stick on the high head: the "tek" of the dance beat. */
function tek(m: Mix, start: number, gain = 1, seed = 9) {
  const { sr, out } = m
  const from = at(m, start)
  const total = Math.min(out.length - from, Math.round(0.07 * sr))
  const rand = rng(seed)
  const head = bandpass(sr, 1750, 3.5)
  const rim = bandpass(sr, 3400, 5)
  for (let n = 0; n < total; n++) {
    const t = n / sr
    const x = rand() * 2 - 1
    out[from + n] += (head(x) * 2.2 + rim(x) * 1.2) * Math.exp(-t / 0.012) * gain * 0.5
  }
}

// ---------------------------------------------------------------- wood: a knuckle on the tambura
function wood(m: Mix, start: number, pitch = 1, gain = 1, seed = 3) {
  const { sr, out } = m
  const from = at(m, start)
  const total = Math.min(out.length - from, Math.round(0.06 * sr))
  const rand = rng(seed)
  const a = bandpass(sr, 1180 * pitch, 9)
  const b = bandpass(sr, 2550 * pitch, 7)
  let phase = 0
  for (let n = 0; n < total; n++) {
    const t = n / sr
    const hit = (rand() * 2 - 1) * Math.exp(-t / 0.0025)
    phase += (TAU * 640 * pitch) / sr
    const knock = Math.sin(phase) * Math.exp(-t / 0.007) * 0.35
    out[from + n] += (a(hit) * 3 + b(hit) * 1.4 + knock) * gain
  }
}

// ---------------------------------------------------------------- chan: a cast shepherd's bell
/**
 * A struck bell is a handful of partials that are not whole multiples of each other, each dying
 * at its own rate. Two of them sit a hair apart, which gives a real bell its slow warble.
 */
function chan(m: Mix, start: number, freq: number, gain = 1, ring = 0.9, seed = 11) {
  const { sr, out } = m
  const from = at(m, start)
  const total = Math.min(out.length - from, Math.round(ring * 1.3 * sr))
  const rand = rng(seed)
  // [ratio, level, how long it rings relative to the bell]
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [1.0045, 0.55, 0.95],
    [2.01, 0.5, 0.7],
    [2.76, 0.42, 0.5],
    [4.07, 0.22, 0.32],
    [5.4, 0.16, 0.22],
    [6.9, 0.07, 0.14],
  ]
  const clapper = bandpass(sr, freq * 3.2, 2)
  // Each partial is a sine made by recurrence (two multiplies a sample) with its own decay.
  const k = partials.length
  const coef = new Float64Array(k)
  const cur = new Float64Array(k)
  const prev = new Float64Array(k)
  const amp = new Float64Array(k)
  const decay = new Float64Array(k)
  for (let i = 0; i < k; i++) {
    const [ratio, level, life] = partials[i]
    const w = (TAU * freq * ratio) / sr
    const phase = rand() * TAU
    coef[i] = 2 * Math.cos(w)
    cur[i] = Math.sin(phase)
    prev[i] = Math.sin(phase - w)
    amp[i] = level
    decay[i] = Math.exp(-6.9 / (ring * life * sr))
  }
  const fade = Math.round(0.02 * sr)
  let strikeEnv = 1.5
  const strikeDecay = Math.exp(-1 / (0.004 * sr))
  for (let n = 0; n < total; n++) {
    let v = 0
    for (let i = 0; i < k; i++) {
      v += amp[i] * cur[i]
      const next = coef[i] * cur[i] - prev[i]
      prev[i] = cur[i]
      cur[i] = next
      amp[i] *= decay[i]
    }
    const strike = strikeEnv > 1e-4 ? clapper(rand() * 2 - 1) * strikeEnv : 0
    strikeEnv *= strikeDecay
    const attack = Math.min(1, n / (0.0015 * sr))
    const tail = n > total - fade ? (total - n) / fade : 1
    out[from + n] += (v * 0.42 + strike) * attack * tail * gain
  }
}

// ---------------------------------------------------------------- kaval: the shepherd's flute
/** A kaval note: mostly fundamental, a breath of air over it, and vibrato that arrives late. */
function kaval(m: Mix, start: number, note: number, dur: number, gain = 1, seed = 21) {
  const { sr, out } = m
  const from = at(m, start)
  const total = Math.min(out.length - from, Math.round((dur + 0.09) * sr))
  const rand = rng(seed)
  const f0 = st(note)
  const air = bandpass(sr, f0 * 2.02, 1.4)
  const hiss = bandpass(sr, f0 * 5.1, 1.1)
  let phase = 0
  for (let n = 0; n < total; n++) {
    const t = n / sr
    const depth = 0.0065 * Math.min(1, Math.max(0, (t - 0.12) / 0.18))
    const f = f0 * (1 + depth * Math.sin(TAU * 5.4 * t))
    phase += (TAU * f) / sr
    const env = Math.min(1, t / 0.04) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.09) : 1)
    const tone = Math.sin(phase) + 0.3 * Math.sin(2 * phase + 0.4) + 0.11 * Math.sin(3 * phase) + 0.04 * Math.sin(4 * phase)
    const x = rand() * 2 - 1
    // The chiff: a puff of air as the note starts.
    const chiff = 1 + 2.2 * Math.exp(-t / 0.03)
    const breath = (air(x) * 0.5 + hiss(x) * 0.16) * chiff
    out[from + n] += (tone * 0.5 + breath) * env * gain * 0.6
  }
}

// ---------------------------------------------------------------- a small wooden room
/** A short, quiet reverb (four combs and two all-passes) so the band sits in a room, not in a void. */
function room(dry: Float32Array, sr: number, wet: number, size = 1): Float32Array {
  const out = new Float32Array(dry.length)
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => Math.round(d * size * sr))
  const acc = new Float32Array(dry.length)
  for (const d of combs) {
    const buf = new Float32Array(d)
    const fb = 10 ** ((-3 * d) / sr / 0.42)
    let damp = 0
    for (let n = 0, i = 0; n < dry.length; n++) {
      const y = buf[i]
      damp += 0.45 * (y - damp)
      buf[i] = dry[n] + damp * fb
      if (++i === d) i = 0
      acc[n] += y * 0.25
    }
  }
  let sig = acc
  for (const d of [0.005, 0.0017].map((x) => Math.round(x * sr))) {
    const buf = new Float32Array(d)
    const next = new Float32Array(dry.length)
    for (let n = 0, i = 0; n < dry.length; n++) {
      const delayed = buf[i]
      const v = sig[n] + 0.7 * delayed
      next[n] = delayed - 0.7 * v
      buf[i] = v
      if (++i === d) i = 0
    }
    sig = next
  }
  for (let n = 0; n < dry.length; n++) out[n] = dry[n] + wet * sig[n]
  return out
}

/** Finish a render: clear rumble, set the level, and make sure it ends in silence. */
function master(buf: Float32Array, sr: number, peakDb: number): Float32Array {
  // One-pole high-pass at 70 Hz: nothing below that is useful, and it removes any offset.
  const k = Math.exp((-TAU * 70) / sr)
  let x1 = 0
  let y1 = 0
  let peak = 1e-9
  for (let n = 0; n < buf.length; n++) {
    const y = k * (y1 + buf[n] - x1)
    x1 = buf[n]
    y1 = y
    buf[n] = y
    peak = Math.max(peak, Math.abs(y))
  }
  const g = dB(peakDb) / peak
  const fade = Math.min(buf.length, Math.round(0.03 * sr))
  const rise = Math.max(1, Math.round(0.0008 * sr))
  for (let n = 0; n < buf.length; n++) {
    const tail = n > buf.length - fade ? (buf.length - n) / fade : 1
    buf[n] *= g * tail * Math.min(1, n / rise)
  }
  return buf
}

// ---------------------------------------------------------------- the sounds
/** The notes a run of right answers climbs: a rising line that settles a fifth above home. */
const CLIMB = [N.A4, N.B4, N.D5, N.E5, N.Fs5, N.A5, N.B5, N.D6]

/**
 * Render one sound. `step` is how far up the run a right answer is (0 for the first);
 * `variant` reseeds the noise so two plays of the same sound are not sample-identical.
 */
export function renderSfx(name: SfxName, sr: number, step = 0, variant = 0): Float32Array {
  const seed = 1 + variant * 131
  const mix = (seconds: number): Mix => ({ out: new Float32Array(Math.round(seconds * sr)), sr })

  switch (name) {
    // A knuckle on wood: for moving around the app. Very quiet.
    case 'tap': {
      const m = mix(0.09)
      wood(m, 0, 1, 1, seed)
      return master(m.out, sr, -22)
    }
    // Choosing an answer: a damped string, like a finger resting on the tambura.
    case 'select': {
      const m = mix(0.2)
      tambura(m, 0, N.A3, { mute: true, bright: 0.45, gain: 1, seed })
      wood(m, 0, 0.8, 0.12, seed + 1)
      return master(room(m.out, sr, 0.05), sr, -19)
    }
    // Right: a quick grace note into a ringing string over the open D. Each one in a row is a step higher.
    case 'correct': {
      const m = mix(1.05)
      const note = CLIMB[Math.max(0, Math.min(CLIMB.length - 1, step))]
      const grace = note - (note === N.D5 || note === N.A5 || note === N.D6 ? 1 : 2)
      tambura(m, 0, N.D4, { ring: 0.5, bright: 0.4, gain: 0.34, seed: seed + 2 })
      tambura(m, 0, grace, { ring: 0.07, bright: 0.75, gain: 0.5, seed: seed + 3 })
      tambura(m, 0.055, note, { ring: 0.62, bright: 0.82, gain: 1, seed })
      return master(room(m.out, sr, 0.1), sr, -10)
    }
    // Not quite: the drum, soft, and a hand stopping the strings. Neutral, never a buzzer.
    case 'wrong': {
      const m = mix(0.5)
      tapan(m, 0, 0.75, seed)
      tambura(m, 0.01, N.A3, { mute: true, bright: 0.35, gain: 0.8, seed: seed + 1 })
      tambura(m, 0.01, N.D4, { mute: true, bright: 0.35, gain: 0.6, seed: seed + 2 })
      return master(room(m.out, sr, 0.07), sr, -13)
    }
    // Five in a row: the shepherd's bell swings once, clink then clank.
    case 'combo': {
      const m = mix(1.5)
      chan(m, 0, st(N.A5), 1, 1.0, seed)
      chan(m, 0.13, st(N.Fs5), 0.5, 0.8, seed + 1)
      return master(room(m.out, sr, 0.12), sr, -14)
    }
    // Lesson complete: one bar of ръченица (7/8, counted 2+2+3) and home on the downbeat.
    case 'complete': {
      const m = mix(2.7)
      const e = 0.118 // one eighth note
      // The drum: dum on one, tek on the next two beats, dum to land.
      tapan(m, 0, 0.8, seed)
      tek(m, 2 * e, 0.8, seed + 1)
      tek(m, 4 * e, 0.8, seed + 2)
      tek(m, 6 * e, 0.45, seed + 3)
      tapan(m, 7 * e, 1, seed + 4)
      // The open strings drone under the tune.
      tambura(m, 0, N.D3, { ring: 0.9, bright: 0.35, gain: 0.5, seed: seed + 5 })
      // The tune: quick, quick, then three running eighths.
      tambura(m, 0, N.A4, { ring: 0.4, bright: 0.8, gain: 0.85, seed: seed + 6 })
      tambura(m, 2 * e, N.D5, { ring: 0.4, bright: 0.8, gain: 0.9, seed: seed + 7 })
      tambura(m, 4 * e, N.E5, { ring: 0.22, bright: 0.85, gain: 0.85, seed: seed + 8 })
      tambura(m, 5 * e, N.Fs5, { ring: 0.22, bright: 0.85, gain: 0.9, seed: seed + 9 })
      tambura(m, 6 * e, N.E5, { ring: 0.22, bright: 0.8, gain: 0.8, seed: seed + 10 })
      // Home: the full chord rolled upwards, and the bell.
      const home = 7 * e
      tambura(m, home, N.D3, { ring: 1.5, bright: 0.45, gain: 0.7, seed: seed + 11 })
      tambura(m, home + 0.012, N.A3, { ring: 1.4, bright: 0.5, gain: 0.6, seed: seed + 12 })
      tambura(m, home + 0.024, N.Fs4, { ring: 1.4, bright: 0.6, gain: 0.6, seed: seed + 13 })
      tambura(m, home + 0.036, N.D5, { ring: 1.5, bright: 0.85, gain: 1, seed: seed + 14 })
      chan(m, home + 0.02, st(N.A5), 0.3, 1.3, seed + 15)
      return master(room(m.out, sr, 0.16), sr, -8)
    }
    // A longer streak, a new level: the kaval answers with a short call.
    case 'streak': {
      const m = mix(1.7)
      tambura(m, 0, N.D3, { ring: 1.2, bright: 0.35, gain: 0.5, seed: seed + 1 })
      kaval(m, 0, N.A4, 0.05, 0.7, seed)
      kaval(m, 0.06, N.D5, 0.24, 1, seed + 2)
      kaval(m, 0.33, N.E5, 0.07, 0.8, seed + 3)
      kaval(m, 0.42, N.Fs5, 0.62, 1, seed + 4)
      return master(room(m.out, sr, 0.22), sr, -17)
    }
    // Opening the app after setup: two open strings, unhurried.
    case 'welcome': {
      const m = mix(2.2)
      tambura(m, 0, N.D3, { ring: 1.5, bright: 0.4, gain: 0.7, seed })
      tambura(m, 0.16, N.A3, { ring: 1.4, bright: 0.5, gain: 0.7, seed: seed + 1 })
      tambura(m, 0.32, N.D4, { ring: 1.4, bright: 0.6, gain: 0.8, seed: seed + 2 })
      tambura(m, 0.48, N.Fs4, { ring: 1.4, bright: 0.7, gain: 0.8, seed: seed + 3 })
      tambura(m, 0.64, N.A4, { ring: 1.5, bright: 0.8, gain: 1, seed: seed + 4 })
      return master(room(m.out, sr, 0.18), sr, -11)
    }
  }
}
