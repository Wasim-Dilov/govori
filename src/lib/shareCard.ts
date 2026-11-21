// "Share with her": a 1080x1350 progress card drawn on a canvas, plus the text
// version, so he can send his wife proof that he is practising. No libraries,
// no network. The card is always light (it is sent to someone else).
import { lessonById, study, type Speaker, type StudyItem } from '../content/index.ts'
import { db, getKV, localDay, setKV } from './db.ts'
import { getSummary, learnedCount, type SessionResult } from './progress.ts'

// ------------------------------------------------------------- data

export interface Partner {
  /** Her name, optional. */
  name: string
  /** How he signs off, defaults to his profile name. */
  from: string
}

export const getPartner = () => getKV<Partner | null>('partner', null)
export const savePartner = (p: Partner) => setKV('partner', { name: p.name.trim(), from: p.from.trim() })

export interface CardWord {
  bg: string
  tr: string
  en: string
}

export interface CardData {
  kind: 'session' | 'week'
  eyebrow: string
  headline: string
  subtitle: string
  date: string
  message: string
  words: CardWord[]
  stats: { value: string; label: string }[]
  closing: CardWord
  signature: string
  /** Her name, used in the closing line. */
  partnerName: string
}

const KIND_LABEL: Record<SessionResult['kind'], string> = {
  lesson: 'Lesson',
  letters: 'Alphabet lesson',
  story: 'Conversation',
  practice: 'Review',
  mistakes: 'Fixing mistakes',
  speed: 'Speed round',
}

const DEFAULT_MESSAGES = ['Quiz me tonight?', 'Ask me something in Bulgarian at dinner.', 'One step closer to talking with your family.', 'Practised again today, for you.']

/** A suggested message line, stable for the day so it doesn't change while editing. */
export function suggestedMessage(): string {
  const seed = [...localDay()].reduce((a, c) => a + c.charCodeAt(0), 0)
  return DEFAULT_MESSAGES[seed % DEFAULT_MESSAGES.length]
}

const toWord = (it: StudyItem): CardWord =>
  it.letter
    ? { bg: `${it.letter.upper}${it.letter.lower}`, tr: `"${it.letter.tr}"`, en: `as in ${it.letter.example.bg} (${it.letter.example.en})` }
    : { bg: it.bg, tr: it.tr, en: it.en }

/** Words for the card: the new ones first, then what he got right this session. */
async function sessionWords(result: SessionResult, speaker: Speaker): Promise<CardWord[]> {
  const seen = new Set<string>()
  const out: StudyItem[] = []
  for (const it of result.newItems) {
    if (it.kind === 'reading' || seen.has(it.id)) continue
    seen.add(it.id)
    out.push(it)
  }
  if (out.length < 5) {
    const events = await db.events.where('sessionId').equals(result.sessionId).toArray().catch(() => [])
    for (const e of events) {
      if (!e.correct || seen.has(e.itemId)) continue
      const it = study(e.itemId, speaker)
      if (!it || it.kind === 'reading') continue
      seen.add(e.itemId)
      out.push(it)
    }
  }
  // Prefer short, sweet lines: phrases under ~26 characters read best on the card.
  return out
    .sort((a, b) => Number(b.bg.length <= 26) - Number(a.bg.length <= 26))
    .slice(0, 5)
    .map(toWord)
}

/** A sweet closing line from the love phrases he has learned, else "Обичам те." */
async function closingLine(speaker: Speaker): Promise<CardWord> {
  const fallback = { bg: 'Обичам те.', tr: 'obícham te', en: 'I love you.' }
  const learned = (await db.memory.toCollection().primaryKeys().catch(() => [])) as string[]
  const phrases = learned
    .filter((id) => id.startsWith('love.'))
    .map((id) => study(id, speaker))
    .filter((it): it is StudyItem => !!it && it.kind === 'phrase' && it.bg.length <= 26)
  if (!phrases.length) return fallback
  const seed = [...localDay()].reduce((a, c) => a + c.charCodeAt(0), 0)
  const it = phrases[seed % phrases.length]
  return { bg: it.bg, tr: it.tr, en: it.en }
}

const longDate = (d = new Date()) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

function headlineFor(partner: string, from: string, practised: string) {
  if (partner) return `${partner}, I ${practised}`
  if (from) return `${from} ${practised}`
  return `I ${practised}`
}

export async function buildSessionCard(result: SessionResult, opts: { partner: string; from: string; message: string; speaker?: Speaker }): Promise<CardData> {
  const speaker = opts.speaker ?? 'm'
  const [words, closing, total] = await Promise.all([sessionWords(result, speaker), closingLine(speaker), learnedCount().catch(() => 0)])
  const lesson = result.lessonId ? lessonById.get(result.lessonId) : undefined
  const parts = [KIND_LABEL[result.kind] ?? 'Practice', lesson?.title].filter(Boolean)
  if ((result.kind === 'lesson' || result.kind === 'letters') && result.level > 1) parts.push(`Level ${result.level}`)
  const minutes = Math.max(1, Math.round(result.ms / 60000))
  return {
    kind: 'session',
    eyebrow: result.streak > 1 ? `Day ${result.streak} of my streak` : 'Practised today',
    headline: headlineFor(opts.partner, opts.from, 'practised Bulgarian today'),
    subtitle: parts.join(' · '),
    date: longDate(),
    message: opts.message.trim(),
    words,
    stats: [
      { value: `${minutes}`, label: 'min' },
      { value: `${Math.round(result.accuracy * 100)}%`, label: 'right' },
      { value: `${result.streak}`, label: result.streak === 1 ? 'day streak' : 'days in a row' },
      { value: `${total}`, label: 'words' },
    ],
    closing,
    signature: opts.from,
    partnerName: opts.partner,
  }
}

/** The same card for the last 7 days: sessions, minutes, new words, best streak. */
export async function buildWeekCard(opts: { partner: string; from: string; message: string; speaker?: Speaker }): Promise<CardData> {
  const speaker = opts.speaker ?? 'm'
  const since = Date.now() - 7 * 86_400_000
  const [sessions, memory, summary, closing] = await Promise.all([
    db.sessions.where('start').above(since).toArray().catch(() => []),
    db.memory.toArray().catch(() => []),
    getSummary(),
    closingLine(speaker),
  ])
  const done = sessions.filter((s) => s.completed)
  const minutes = Math.max(0, Math.round(done.reduce((a, s) => a + Math.max(0, (s.end ?? s.start) - s.start), 0) / 60000))
  const fresh = memory
    .filter((m) => m.learnedAt >= since)
    .sort((a, b) => b.learnedAt - a.learnedAt)
    .map((m) => study(m.itemId, speaker))
    .filter((it): it is StudyItem => !!it && it.kind !== 'reading')
  const start = new Date(since + 86_400_000)
  const range = `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} to ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
  return {
    kind: 'week',
    eyebrow: summary.streak > 1 ? `Day ${summary.streak} of my streak` : 'My week of Bulgarian',
    headline: headlineFor(opts.partner, opts.from, 'kept learning Bulgarian this week'),
    subtitle: range,
    date: longDate(),
    message: opts.message.trim(),
    words: fresh.slice(0, 5).map(toWord),
    stats: [
      { value: `${done.length}`, label: done.length === 1 ? 'session' : 'sessions' },
      { value: `${minutes}`, label: 'min' },
      { value: `${fresh.length}`, label: 'new words' },
      ...(summary.longestStreak > 1 ? [{ value: `${summary.longestStreak}`, label: 'best streak' }] : []),
    ].filter((s, i, all) => s.value !== '0' || all.every((x) => x.value === '0') && i === 0),
    closing,
    signature: opts.from,
    partnerName: opts.partner,
  }
}

// ------------------------------------------------------------- text version

export function cardText(d: CardData): string {
  const lines: string[] = ['Говоря български!']
  if (d.message) lines.push(d.message)
  const words = d.words.slice(0, 4).map((w) => `${w.bg.replace(/[.!?]$/, '')} (${w.en.replace(/[.!?]$/, '')})`)
  if (d.kind === 'session') {
    lines.push(words.length ? `Today I learned: ${words.join(', ')}.` : `Today: ${d.subtitle}.`)
  } else {
    lines.push(`This week: ${d.stats.filter((s) => s.value !== '0').map((s) => `${s.value} ${s.label === 'min' ? 'minutes' : s.label}`).join(', ')}.`)
    if (words.length) lines.push(`New words: ${words.join(', ')}.`)
  }
  const streak = d.eyebrow.match(/^Day (\d+)/)?.[1]
  if (streak) lines.push(`${streak}-day streak.`)
  const closing = d.closing.bg.replace(/[.!]$/, '')
  lines.push(d.partnerName ? `${closing}, ${d.partnerName}.` : `${closing}.`)
  lines.push(d.signature ? `${d.signature}, via Govori` : 'Sent from Govori')
  return lines.join(' ')
}

// ------------------------------------------------------------- drawing

export const CARD_W = 1080
export const CARD_H = 1350

const C = {
  ground: '#f2f2f7',
  card: '#ffffff',
  ink: '#000000',
  muted: '#69696e',
  tertiary: '#aeaeb2',
  line: '#e3e3e8',
  panel: '#f2f2f7',
  rose: '#c8234f',
  roseSoft: '#fbe8ee',
  roseInk: '#a51b40',
}

const FONT = '-apple-system, "SF Pro Display", "SF Pro Text", "Inter Variable", system-ui, sans-serif'
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`

// The Г monogram from BrandMark.tsx (viewBox 0 0 1024 1024).
const GAMMA = 'M332 236 H688 Q706 236 706 254 V354 Q706 372 688 372 H450 V770 Q450 788 432 788 H332 Q314 788 314 770 V254 Q314 236 332 236 Z'
const STITCH = 'M638 616 L724 702 L638 788 L552 702 Z'
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="230" fill="${C.rose}"/><path d="${GAMMA}" fill="#fff"/><path d="${STITCH}" fill="#fff"/></svg>`

let markImage: Promise<HTMLImageElement | null> | null = null
function loadMark(): Promise<HTMLImageElement | null> {
  markImage ??= new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markSvg)}`
  })
  return markImage
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawMark(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, size: number) {
  if (img) return ctx.drawImage(img, x, y, size, size)
  // Fallback: the same shapes as paths.
  const s = size / 1024
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  roundRect(ctx, 0, 0, 1024, 1024, 230)
  ctx.fillStyle = C.rose
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fill(new Path2D(GAMMA))
  ctx.fill(new Path2D(STITCH))
  ctx.restore()
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

/** Break text into at most `max` lines that fit `width`, ellipsising the last. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= width || !line) line = next
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  if (lines.length <= max) return lines
  const kept = lines.slice(0, max)
  kept[max - 1] = ellipsis(ctx, `${kept[max - 1]} ${lines.slice(max).join(' ')}`, width)
  return kept
}

/** Two balanced lines (like text-wrap: balance) when the text needs more than one. */
function balance(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  if (ctx.measureText(text).width <= width) return [text]
  const words = text.split(/\s+/)
  let best: string[] | null = null
  let bestMax = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const wa = ctx.measureText(a).width
    const wb = ctx.measureText(b).width
    if (wa > width || wb > width) continue
    const m = Math.max(wa, wb)
    if (m < bestMax) {
      bestMax = m
      best = [a, b]
    }
  }
  return best ?? wrap(ctx, text, width, 2)
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

/** The fine-line шевица band: outlined rhombi with a centre stitch, at low contrast. */
function drawBand(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const unit = 48 // two rhombi per unit, 24px tall
  ctx.save()
  ctx.globalAlpha = 0.38
  ctx.strokeStyle = C.rose
  ctx.fillStyle = C.rose
  ctx.lineWidth = 2
  const count = Math.floor(w / unit)
  const start = x + (w - count * unit) / 2
  for (let i = 0; i < count; i++) {
    for (const ox of [0, 24]) {
      const cx = start + i * unit + ox + 12
      const cy = y + 12
      ctx.beginPath()
      ctx.moveTo(cx - 10.5, cy)
      ctx.lineTo(cx, cy - 10.5)
      ctx.lineTo(cx + 10.5, cy)
      ctx.lineTo(cx, cy + 10.5)
      ctx.closePath()
      ctx.stroke()
      ctx.fillRect(cx - 1.8, cy - 1.8, 3.6, 3.6)
    }
  }
  ctx.restore()
}

/** Draw the card and return it as a PNG blob. */
export async function renderCard(d: CardData): Promise<Blob> {
  await document.fonts?.ready.catch(() => undefined)
  const img = await loadMark()
  try {
    return await draw(d, img)
  } catch {
    // A tainted canvas (an old WebKit with SVG images): redraw the mark as paths.
    return draw(d, null)
  }
}

async function draw(d: CardData, img: HTMLImageElement | null): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'

  // Ground and card.
  ctx.fillStyle = C.ground
  ctx.fillRect(0, 0, CARD_W, CARD_H)
  const cx = 56,
    cy = 56,
    cw = CARD_W - 112,
    ch = CARD_H - 112
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.07)'
  ctx.shadowBlur = 48
  ctx.shadowOffsetY = 12
  roundRect(ctx, cx, cy, cw, ch, 56)
  ctx.fillStyle = C.card
  ctx.fill()
  ctx.restore()

  const pad = 72
  const left = cx + pad
  const right = cx + cw - pad
  const width = right - left
  const bottom = cy + ch - pad

  // Header: brand tile, wordmark, date.
  let y = cy + pad
  drawMark(ctx, img, left, y, 76)
  ctx.fillStyle = C.ink
  ctx.font = font(700, 38)
  setSpacing(ctx, -0.5)
  ctx.fillText('Govori', left + 76 + 20, y + 51)
  setSpacing(ctx, 0)
  ctx.fillStyle = C.muted
  ctx.font = font(400, 29)
  ctx.textAlign = 'right'
  ctx.fillText(d.date, right, y + 49)
  ctx.textAlign = 'left'
  y += 76 + 66

  // Eyebrow and headline.
  ctx.fillStyle = C.rose
  ctx.font = font(600, 30)
  ctx.fillText(d.eyebrow, left, y)
  ctx.fillStyle = C.ink
  ctx.font = font(700, 62)
  setSpacing(ctx, -1.5)
  for (const line of balance(ctx, d.headline, width)) {
    y += 72
    ctx.fillText(line, left, y)
  }
  setSpacing(ctx, 0)
  if (d.subtitle) {
    y += 48
    ctx.fillStyle = C.muted
    ctx.font = font(400, 30)
    ctx.fillText(ellipsis(ctx, d.subtitle, width), left, y)
  }

  // Stats as a row of quiet pills: bold value, regular label.
  y += 30
  {
    const h = 58
    let x = left
    for (const st of d.stats) {
      ctx.font = font(700, 27)
      const vw = ctx.measureText(st.value).width
      ctx.font = font(400, 27)
      const lw = ctx.measureText(` ${st.label}`).width
      const w = vw + lw + 44
      if (x + w > right + 1) break
      roundRect(ctx, x, y, w, h, h / 2)
      ctx.fillStyle = C.panel
      ctx.fill()
      ctx.fillStyle = C.ink
      ctx.font = font(700, 27)
      ctx.fillText(st.value, x + 22, y + 39)
      ctx.fillStyle = C.muted
      ctx.font = font(400, 27)
      ctx.fillText(` ${st.label}`, x + 22 + vw, y + 39)
      x += w + 12
    }
    y += h
  }

  // Message, as a soft rose bubble.
  if (d.message) {
    ctx.font = font(500, 31)
    const lines = wrap(ctx, d.message, width - 64, 2)
    const h = 30 + lines.length * 40
    y += 22
    roundRect(ctx, left, y, Math.min(width, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 60), h, 26)
    ctx.fillStyle = C.roseSoft
    ctx.fill()
    ctx.fillStyle = C.roseInk
    lines.forEach((l, i) => ctx.fillText(l, left + 30, y + 46 + i * 40))
    y += h
  }

  // Bottom block from the bottom up: band, then the closing line and signature.
  const bandY = bottom - 22
  const closingEnY = bandY - 38
  const closingBgY = closingEnY - 46

  // Words: as many rows (up to 5) as fit between the top block and the closing line.
  const rowH = 106
  const labelY = y + 56
  const rowsTop = labelY + 6
  const room = closingBgY - 44 - 36 - rowsTop
  const rows = d.words.slice(0, Math.max(0, Math.min(5, Math.floor((room + 12) / rowH))))
  if (rows.length) {
    ctx.fillStyle = C.muted
    ctx.font = font(600, 24)
    ctx.fillText(d.kind === 'week' ? 'New this week' : 'Today I learned', left, labelY)
    let ry = rowsTop
    rows.forEach((w, i) => {
      if (i > 0) {
        ctx.fillStyle = C.line
        ctx.fillRect(left, ry - 2, width, 2)
      }
      ctx.fillStyle = C.ink
      ctx.font = font(600, 44)
      ctx.fillText(ellipsis(ctx, w.bg, width), left, ry + 52)
      ctx.font = font(400, 26)
      ctx.fillStyle = C.muted
      const tr = w.tr ? `${w.tr}  ·  ` : ''
      ctx.fillText(ellipsis(ctx, `${tr}${w.en}`, width), left, ry + 88)
      ry += rowH
    })
  }

  // A hairline above the closing.
  ctx.fillStyle = C.line
  ctx.fillRect(left, closingBgY - 72, width, 2)

  // Closing line in Bulgarian, the English beneath, and the signature.
  const closing = d.partnerName ? `${d.closing.bg.replace(/[.!]$/, '')}, ${d.partnerName}.` : d.closing.bg
  ctx.fillStyle = C.rose
  ctx.font = font(700, 46)
  ctx.fillText(ellipsis(ctx, closing, width * 0.68), left, closingBgY)
  ctx.fillStyle = C.muted
  ctx.font = font(400, 27)
  ctx.fillText(ellipsis(ctx, d.closing.en, width * 0.62), left, closingEnY)
  if (d.signature) {
    ctx.textAlign = 'right'
    ctx.fillStyle = C.ink
    ctx.font = font(600, 34)
    ctx.fillText(ellipsis(ctx, d.signature, width * 0.3), right, closingBgY)
    ctx.fillStyle = C.tertiary
    ctx.font = font(400, 25)
    ctx.fillText('via Govori', right, closingEnY)
    ctx.textAlign = 'left'
  }

  drawBand(ctx, left, bandY, width)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render the card'))), 'image/png'))
}

// ------------------------------------------------------------- sharing

export type ShareOutcome = 'shared' | 'shared-text' | 'downloaded' | 'cancelled'

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

/** Share the card as an image (with the text), else the text, else download + copy. */
export async function shareCard(d: CardData, png?: Blob): Promise<ShareOutcome> {
  const blob = png ?? (await renderCard(d))
  const text = cardText(d)
  const title = d.kind === 'week' ? 'My week of Bulgarian' : 'I practised Bulgarian today'
  const file = new File([blob], d.kind === 'week' ? 'govori-week.png' : 'govori-today.png', { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text, title })
      return 'shared'
    }
    if (navigator.share) {
      await navigator.share({ text, title })
      return 'shared-text'
    }
  } catch (e) {
    if (isAbort(e)) return 'cancelled'
    // Fall through to download on any other share failure.
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  await copyText(text)
  return 'downloaded'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/** Build and share a card for the last 7 days (for a future "Share my week" button). */
export async function shareWeek(opts?: { message?: string; speaker?: Speaker; from?: string }): Promise<ShareOutcome> {
  const partner = await getPartner()
  const d = await buildWeekCard({
    partner: partner?.name ?? '',
    from: partner?.from || opts?.from || '',
    message: opts?.message ?? '',
    speaker: opts?.speaker,
  })
  return shareCard(d)
}
