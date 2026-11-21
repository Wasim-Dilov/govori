// Turns the answer log into statistics and a few honest, plain-English insights.
// Everything here is a pure function of AnswerEvent[] and SessionRecord[] so it can
// be reused later (adaptive practice, exports, a smarter coach).
import { study, trackById, type Speaker, type StudyItem } from '../content/index.ts'
import type { TrackId } from '../content/types.ts'
import { localDay, type AnswerEvent, type ExerciseType, type SessionRecord } from './db.ts'

export interface Rate {
  n: number
  correct: number
  /** 0..1, or NaN when n is 0. */
  accuracy: number
  /** Mean response time in ms (NaN when n is 0). */
  avgMs: number
}

/** Answers that count towards accuracy (intro cards are not graded). */
export const scored = (events: AnswerEvent[]) => events.filter((e) => e.exType !== 'intro')

export function rate(events: AnswerEvent[]): Rate {
  const n = events.length
  let correct = 0
  let ms = 0
  let timed = 0
  for (const e of events) {
    if (e.correct) correct++
    // Ignore implausible timings (left the phone on the table) so means stay meaningful.
    if (e.ms > 0 && e.ms < 120_000) {
      ms += e.ms
      timed++
    }
  }
  return { n, correct, accuracy: n ? correct / n : NaN, avgMs: timed ? ms / timed : NaN }
}

function groupBy<K>(events: AnswerEvent[], key: (e: AnswerEvent) => K): Map<K, AnswerEvent[]> {
  const m = new Map<K, AnswerEvent[]>()
  for (const e of events) {
    const k = key(e)
    const list = m.get(k)
    if (list) list.push(e)
    else m.set(k, [e])
  }
  return m
}

// ------------------------------------------------------------- by exercise type and skill

export function byType(events: AnswerEvent[]): Map<ExerciseType, Rate> {
  const out = new Map<ExerciseType, Rate>()
  for (const [k, list] of groupBy(scored(events), (e) => e.exType)) out.set(k, rate(list))
  return out
}

export function avgMsByType(events: AnswerEvent[]): Map<ExerciseType, number> {
  const out = new Map<ExerciseType, number>()
  for (const [k, r] of byType(events)) out.set(k, r.avgMs)
  return out
}

export type SkillId = 'recognise' | 'listen' | 'build' | 'type' | 'speak' | 'letters' | 'dialogue'

export const SKILLS: { id: SkillId; label: string; gerund: string; types: ExerciseType[] }[] = [
  { id: 'recognise', label: 'Recognise', gerund: 'Recognising words', types: ['mc_bg_en', 'mc_en_bg', 'match'] },
  { id: 'listen', label: 'Listen', gerund: 'Listening', types: ['listen_mc', 'listen_type'] },
  { id: 'build', label: 'Build sentences', gerund: 'Building sentences', types: ['build', 'cloze'] },
  { id: 'type', label: 'Type', gerund: 'Typing in Bulgarian', types: ['type_bg'] },
  // Missions ("Say it to her today") and "Quiz me" answers are logged as 'speak', so they count here too.
  { id: 'speak', label: 'Speak', gerund: 'Speaking', types: ['speak'] },
  { id: 'letters', label: 'Letters', gerund: 'Reading letters', types: ['letter_sound', 'sound_letter', 'read_word'] },
  { id: 'dialogue', label: 'Conversations', gerund: 'Conversations', types: ['dialogue'] },
]

export interface SkillRate {
  id: SkillId
  label: string
  gerund: string
  rate: Rate
}

/** Accuracy per skill family, only for skills the learner has practised. */
export function bySkill(events: AnswerEvent[]): SkillRate[] {
  const s = scored(events)
  return SKILLS.map((sk) => ({ id: sk.id, label: sk.label, gerund: sk.gerund, rate: rate(s.filter((e) => sk.types.includes(e.exType))) })).filter((x) => x.rate.n > 0)
}

// ------------------------------------------------------------- by time

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night'
export const DAY_PARTS: { id: DayPart; label: string; hours: string }[] = [
  { id: 'morning', label: 'Morning', hours: '5 to 11' },
  { id: 'afternoon', label: 'Afternoon', hours: '12 to 17' },
  { id: 'evening', label: 'Evening', hours: '18 to 22' },
  { id: 'night', label: 'Night', hours: '23 to 4' },
]

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour <= 11) return 'morning'
  if (hour >= 12 && hour <= 17) return 'afternoon'
  if (hour >= 18 && hour <= 22) return 'evening'
  return 'night'
}

export function byTimeOfDay(events: AnswerEvent[]): { id: DayPart; label: string; hours: string; rate: Rate }[] {
  const g = groupBy(scored(events), (e) => dayPart(e.hour))
  return DAY_PARTS.map((p) => ({ ...p, rate: rate(g.get(p.id) ?? []) }))
}

/** Monday-first, which is how Bulgarian calendars are drawn. */
export const WEEKDAYS: { index: number; short: string; long: string; bg: string }[] = [
  { index: 1, short: 'Mon', long: 'Monday', bg: 'пн' },
  { index: 2, short: 'Tue', long: 'Tuesday', bg: 'вт' },
  { index: 3, short: 'Wed', long: 'Wednesday', bg: 'ср' },
  { index: 4, short: 'Thu', long: 'Thursday', bg: 'чт' },
  { index: 5, short: 'Fri', long: 'Friday', bg: 'пт' },
  { index: 6, short: 'Sat', long: 'Saturday', bg: 'сб' },
  { index: 0, short: 'Sun', long: 'Sunday', bg: 'нд' },
]

export function byWeekday(events: AnswerEvent[]): { index: number; short: string; long: string; bg: string; rate: Rate }[] {
  const g = groupBy(scored(events), (e) => e.weekday)
  return WEEKDAYS.map((d) => ({ ...d, rate: rate(g.get(d.index) ?? []) }))
}

export function byTrack(events: AnswerEvent[]): { id: TrackId; title: string; rate: Rate }[] {
  const g = groupBy(scored(events), (e) => e.trackId as TrackId)
  return [...g.entries()]
    .filter(([id]) => trackById.has(id))
    .map(([id, list]) => ({ id, title: trackById.get(id)!.title, rate: rate(list) }))
}

// ------------------------------------------------------------- trends

const DAY = 86_400_000

/** Local Monday (YYYY-MM-DD) of the week containing ts. */
export function weekStart(ts: number): string {
  const d = new Date(ts)
  d.setHours(12, 0, 0, 0)
  const back = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - back)
  return localDay(d)
}

/** First-try accuracy per week, oldest first, for the last `weeks` weeks that have answers. */
export function weeklyTrend(events: AnswerEvent[], weeks = 12): { week: string; rate: Rate }[] {
  const first = scored(events).filter((e) => e.attempt === 1)
  const g = groupBy(first, (e) => weekStart(e.ts))
  return [...g.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-weeks)
    .map(([week, list]) => ({ week, rate: rate(list) }))
}

// ------------------------------------------------------------- toughest items

export interface ToughItem {
  id: string
  item: StudyItem
  n: number
  wrong: number
  accuracy: number
}

/** Items most often answered wrongly (at least `minAttempts` tries), resolved for display. */
export function toughest(events: AnswerEvent[], speaker: Speaker, limit = 5, minAttempts = 3): ToughItem[] {
  const g = groupBy(
    scored(events).filter((e) => !e.itemId.includes('+') && e.exType !== 'dialogue'),
    (e) => e.itemId,
  )
  const out: ToughItem[] = []
  for (const [id, list] of g) {
    if (list.length < minAttempts) continue
    const r = rate(list)
    const wrong = r.n - r.correct
    if (!wrong) continue
    const item = study(id, speaker)
    if (!item) continue
    out.push({ id, item, n: r.n, wrong, accuracy: r.accuracy })
  }
  return out.sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy).slice(0, limit)
}

// ------------------------------------------------------------- calendar

export interface DayActivity {
  day: string
  answers: number
  correct: number
  xp: number
  minutes: number
  sessions: number
}

/** Minutes practised per local day, from completed sessions (each capped at 30 minutes). */
export function minutesPerDay(sessions: SessionRecord[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of sessions) {
    if (!s.end) continue
    const mins = Math.min(30, Math.max(0, (s.end - s.start) / 60_000))
    m.set(s.day, (m.get(s.day) ?? 0) + mins)
  }
  return m
}

/** Activity per day (answers, XP, minutes) for the streak calendar. */
export function practiceDays(events: AnswerEvent[], sessions: SessionRecord[]): Map<string, DayActivity> {
  const m = new Map<string, DayActivity>()
  const get = (day: string) => {
    let a = m.get(day)
    if (!a) {
      a = { day, answers: 0, correct: 0, xp: 0, minutes: 0, sessions: 0 }
      m.set(day, a)
    }
    return a
  }
  for (const e of scored(events)) {
    const a = get(e.day)
    a.answers++
    if (e.correct) a.correct++
  }
  for (const s of sessions) {
    if (!s.completed) continue
    const a = get(s.day)
    a.xp += s.xp
    a.sessions++
  }
  for (const [day, mins] of minutesPerDay(sessions)) get(day).minutes = mins
  return m
}

/** The last `weeks` weeks as columns of 7 days (Mon to Sun), ending with the current week. */
export function calendarWeeks(weeks = 12, today = new Date()): string[][] {
  const end = new Date(today)
  end.setHours(12, 0, 0, 0)
  const monday = new Date(end)
  monday.setDate(end.getDate() - ((end.getDay() + 6) % 7))
  const cols: string[][] = []
  for (let w = weeks - 1; w >= 0; w--) {
    const col: string[] = []
    for (let d = 0; d < 7; d++) {
      const x = new Date(monday)
      x.setDate(monday.getDate() - w * 7 + d)
      col.push(localDay(x))
    }
    cols.push(col)
  }
  return cols
}

// ------------------------------------------------------------- insights

/** Answers needed before any pattern is reported. */
export const MIN_ANSWERS = 40
/** Answers a group needs before it is compared with another. */
const MIN_GROUP = 15
/** Smallest accuracy gap (percentage points) worth mentioning. */
const MIN_GAP = 0.08

const pct = (x: number) => `${Math.round(x * 100)}%`
const pts = (x: number) => Math.round(x * 100)

export interface Insights {
  sentences: string[]
  /** How many more answers are needed before patterns show, when the data is still thin. */
  needMore: number
  total: number
}

export function insights(events: AnswerEvent[], now = Date.now()): Insights {
  const s = scored(events)
  const total = s.length
  if (total < MIN_ANSWERS) return { sentences: [], needMore: MIN_ANSWERS - total, total }
  const overall = rate(s)
  const out: string[] = []

  // 1. Time of day: best versus worst part of the day.
  const parts = byTimeOfDay(s).filter((p) => p.rate.n >= MIN_GROUP)
  if (parts.length >= 2) {
    const sorted = [...parts].sort((a, b) => b.rate.accuracy - a.rate.accuracy)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]
    const gap = best.rate.accuracy - worst.rate.accuracy
    if (gap >= MIN_GAP)
      out.push(
        `You're ${pts(gap)} points more accurate in the ${best.label.toLowerCase()} (${pct(best.rate.accuracy)}) than in the ${worst.label.toLowerCase()} (${pct(worst.rate.accuracy)}).`,
      )
  }

  // 2. Weakest skill compared with overall.
  const skills = bySkill(s).filter((k) => k.rate.n >= MIN_GROUP)
  if (skills.length >= 2) {
    const weakest = [...skills].sort((a, b) => a.rate.accuracy - b.rate.accuracy)[0]
    if (overall.accuracy - weakest.rate.accuracy >= MIN_GAP)
      out.push(`${weakest.gerund} is your weakest skill: ${pct(weakest.rate.accuracy)} against ${pct(overall.accuracy)} overall.`)
    const strongest = [...skills].sort((a, b) => b.rate.accuracy - a.rate.accuracy)[0]
    if (strongest.id !== weakest.id && strongest.rate.accuracy - overall.accuracy >= MIN_GAP / 2 && out.length < 2)
      out.push(`${strongest.gerund} is your strongest skill at ${pct(strongest.rate.accuracy)}.`)
  }

  // 3. Best weekday.
  const days = byWeekday(s).filter((d) => d.rate.n >= MIN_GROUP)
  if (days.length >= 3) {
    const best = [...days].sort((a, b) => b.rate.accuracy - a.rate.accuracy)[0]
    if (best.rate.accuracy - overall.accuracy >= MIN_GAP / 2) out.push(`Your best day is ${best.long}, with ${pct(best.rate.accuracy)} right.`)
  }

  // 4. Progress over time: first-try accuracy, first week against the latest week.
  const trend = weeklyTrend(s).filter((w) => w.rate.n >= MIN_GROUP)
  if (trend.length >= 2) {
    const a = trend[0].rate.accuracy
    const b = trend[trend.length - 1].rate.accuracy
    if (b - a >= 0.05) out.push(`Your first-try accuracy is up from ${pct(a)} to ${pct(b)} since your first week.`)
  }

  // 5. Speed: the last 7 days against the 7 before.
  const recent = rate(s.filter((e) => e.ts > now - 7 * DAY))
  const before = rate(s.filter((e) => e.ts <= now - 7 * DAY && e.ts > now - 14 * DAY))
  if (recent.n >= MIN_GROUP && before.n >= MIN_GROUP && before.avgMs > 0) {
    const faster = 1 - recent.avgMs / before.avgMs
    if (faster >= 0.15) out.push(`You're answering ${pct(faster)} faster than the week before.`)
  }

  return { sentences: out.slice(0, 4), needMore: 0, total }
}

/** The two weakest exercise types (with enough answers), so practice can lean on them. */
export function weakTypes(events: AnswerEvent[], n = 2, minAnswers = 8): ExerciseType[] {
  const skip: ExerciseType[] = ['intro', 'match', 'dialogue']
  return [...byType(events).entries()]
    .filter(([t, r]) => !skip.includes(t) && r.n >= minAnswers)
    .sort(([, a], [, b]) => a.accuracy - b.accuracy)
    .slice(0, n)
    .map(([t]) => t)
}
