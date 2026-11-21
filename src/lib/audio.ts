// Speech, recordings and little sound effects.
import { db } from './db.ts'

// ------------------------------------------------------------- text to speech
let voice: SpeechSynthesisVoice | null = null
let voicesLoaded = false

function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return
  const voices = speechSynthesis.getVoices()
  if (!voices.length) return
  voicesLoaded = true
  const bg = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('bg'))
  // Prefer enhanced/premium voices when the phone has them downloaded.
  voice = bg.find((v) => /enhanced|premium|neural/i.test(v.name)) ?? bg[0] ?? null
}
if (typeof speechSynthesis !== 'undefined') {
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

/** True if a Bulgarian voice is installed on this device. Null while unknown. */
export function hasBulgarianVoice(): boolean | null {
  if (typeof speechSynthesis === 'undefined') return false
  if (!voicesLoaded) pickVoice()
  return voicesLoaded ? !!voice : null
}

let currentAudio: HTMLAudioElement | null = null
const urlCache = new Map<string, string>()

/** Say something in Bulgarian. Uses a recording for that item if one exists (e.g. his wife's voice). */
export async function speak(text: string, opts: { slow?: boolean; itemId?: string } = {}): Promise<void> {
  stopSpeaking()
  if (opts.itemId) {
    const rec = await db.recordings.get(opts.itemId).catch(() => undefined)
    if (rec) {
      let url = urlCache.get(opts.itemId)
      if (!url) {
        url = URL.createObjectURL(rec.blob)
        urlCache.set(opts.itemId, url)
      }
      const a = new Audio(url)
      a.playbackRate = opts.slow ? 0.75 : 1
      currentAudio = a
      return new Promise((resolve) => {
        a.onended = () => resolve()
        a.onerror = () => resolve()
        a.play().catch(() => resolve())
      })
    }
  }
  if (typeof speechSynthesis === 'undefined') return
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'bg-BG'
    if (voice) u.voice = voice
    u.rate = opts.slow ? 0.55 : 0.9
    u.onend = () => resolve()
    u.onerror = () => resolve()
    speechSynthesis.speak(u)
    // iOS sometimes never fires onend; don't hang the UI.
    setTimeout(resolve, 600 + text.length * (opts.slow ? 160 : 90))
  })
}

export function stopSpeaking() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
}

export const hasRecording = (itemId: string) => db.recordings.get(itemId).then((r) => !!r).catch(() => false)

export async function saveRecording(itemId: string, blob: Blob) {
  urlCache.delete(itemId)
  await db.recordings.put({ itemId, blob, mime: blob.type, createdAt: Date.now() })
}

export async function deleteRecording(itemId: string) {
  urlCache.delete(itemId)
  await db.recordings.delete(itemId)
}

// ------------------------------------------------------------- microphone
export interface Recorder {
  stop: () => Promise<Blob>
  cancel: () => void
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  rec.start()
  const release = () => stream.getTracks().forEach((t) => t.stop())
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          release()
          resolve(new Blob(chunks, { type: rec.mimeType || mime || 'audio/mp4' }))
        }
        rec.stop()
      }),
    cancel: () => {
      try {
        rec.stop()
      } catch {
        /* already stopped */
      }
      release()
    },
  }
}

export function playBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob)
  const a = new Audio(url)
  return new Promise((resolve) => {
    a.onended = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    a.play().catch(() => resolve())
  })
}

// ------------------------------------------------------------- sound effects (synthesised, no files)
let ctx: AudioContext | null = null
let sfxOn = true
export const setSfx = (on: boolean) => (sfxOn = on)

function ac() {
  if (!ctx) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctx()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.18) {
  const c = ac()
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, c.currentTime + start)
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.015)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur)
  o.connect(g).connect(c.destination)
  o.start(c.currentTime + start)
  o.stop(c.currentTime + start + dur + 0.05)
}

export const sfx = {
  correct() {
    if (!sfxOn) return
    tone(784, 0, 0.18, 'triangle')
    tone(1175, 0.09, 0.28, 'triangle')
  },
  wrong() {
    if (!sfxOn) return
    tone(220, 0, 0.22, 'sawtooth', 0.07)
    tone(196, 0.12, 0.3, 'sawtooth', 0.06)
  },
  tap() {
    if (!sfxOn) return
    tone(660, 0, 0.06, 'sine', 0.08)
  },
  complete() {
    if (!sfxOn) return
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.16))
  },
  combo() {
    if (!sfxOn) return
    tone(988, 0, 0.12, 'triangle', 0.12)
    tone(1319, 0.07, 0.2, 'triangle', 0.12)
  },
}
