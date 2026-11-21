// Moments worth marking: streak days, words learned, units finished, and a weekly summary.
// Each milestone is returned once (remembered in kv "milestones").
import { lessonById, study, unitById } from '../content/index.ts'
import { db, getKV, localDay, setKV } from './db.ts'
import { allLessonProgress, getSummary, learnedCount, type SessionResult } from './progress.ts'
import { streakStatusOf } from './streak.ts'

export type MilestoneKind = 'streak' | 'words' | 'unit'

export interface Milestone {
  /** Stable id, e.g. "streak-30", "words-100", "unit-love.u2". */
  id: string
  kind: MilestoneKind
  value: number
  title: string
  subtitle: string
  /** For unit milestones: the can-do line ("You can greet your тъща and ask how she is"). */
  canDo?: string
  unitId?: string
  trackId?: string
  /** A Bulgarian proverb to put on the milestone sheet or share card. */
  proverb: { bg: string; tr: string; en: string }
}

const STREAKS = [7, 30, 50, 100]
const WORDS = [100, 250, 500]

const PROVERBS = [
  { bg: 'Капка по капка вир става.', tr: 'kápka po kápka vir stáva', en: 'Drop by drop, a pond fills.' },
  { bg: 'Бавно, но славно.', tr: 'bávno, no slávno', en: 'Slowly, but gloriously.' },
  { bg: 'Който търси, намира.', tr: 'kóyto tărsi, namíra', en: 'Whoever seeks, finds.' },
]
const proverbFor = (id: string) => PROVERBS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % PROVERBS.length]

const STREAK_TEXT: Record<number, string> = {
  7: 'Една седмица! A whole week of Bulgarian.',
  30: 'Цял месец! A month without missing a day.',
  50: 'Петдесет дни. Fifty days of showing up.',
  100: 'Сто дни! One hundred days. Браво.',
}
const WORD_TEXT: Record<number, string> = {
  100: 'Сто думи. You know a hundred words.',
  250: 'Двеста и петдесет думи. That is real conversation material.',
  500: 'Петстотин думи! Enough for most of a day at home.',
}

/**
 * Milestones newly reached by this session. Only the highest new streak or word milestone is
 * returned (lower ones are marked as reached quietly), plus a finished unit.
 */
export async function checkMilestones(result: SessionResult): Promise<Milestone[]> {
  const reached = new Set(await getKV<string[]>('milestones', []))
  const out: Milestone[] = []
  const mark = (id: string) => reached.add(id)

  const streakHits = STREAKS.filter((n) => result.streak >= n && !reached.has(`streak-${n}`))
  streakHits.forEach((n) => mark(`streak-${n}`))
  const s = streakHits[streakHits.length - 1]
  if (s) out.push({ id: `streak-${s}`, kind: 'streak', value: s, title: `${s} days in a row`, subtitle: STREAK_TEXT[s], proverb: proverbFor(`streak-${s}`) })

  const words = await learnedCount()
  const wordHits = WORDS.filter((n) => words >= n && !reached.has(`words-${n}`))
  wordHits.forEach((n) => mark(`words-${n}`))
  const w = wordHits[wordHits.length - 1]
  if (w) out.push({ id: `words-${w}`, kind: 'words', value: w, title: `${w} words`, subtitle: WORD_TEXT[w], proverb: proverbFor(`words-${w}`) })

  const lesson = result.lessonId ? lessonById.get(result.lessonId) : undefined
  const unit = lesson ? unitById.get(lesson.unitId) : undefined
  if (unit && !reached.has(`unit-${unit.id}`)) {
    const progress = await allLessonProgress()
    if (unit.lessons.every((l) => (progress[l.id]?.level ?? 0) >= 1)) {
      mark(`unit-${unit.id}`)
      out.push({
        id: `unit-${unit.id}`,
        kind: 'unit',
        value: unit.index + 1,
        title: `Unit ${unit.index + 1} done: ${unit.title}`,
        subtitle: unit.canDo ?? unit.description,
        canDo: unit.canDo,
        unitId: unit.id,
        trackId: unit.trackId,
        proverb: proverbFor(`unit-${unit.id}`),
      })
    }
  }
  if (out.length || streakHits.length || wordHits.length) await setKV('milestones', [...reached])
  return out
}

/** Every can-do line he has earned so far (units with all lessons at level 1+), for an "I can..." list. */
export async function earnedCanDos(): Promise<{ unitId: string; trackId: string; title: string; canDo: string }[]> {
  const progress = await allLessonProgress()
  const out: { unitId: string; trackId: string; title: string; canDo: string }[] = []
  for (const u of unitById.values())
    if (u.canDo && u.lessons.length && u.lessons.every((l) => (progress[l.id]?.level ?? 0) >= 1)) out.push({ unitId: u.id, trackId: u.trackId, title: u.title, canDo: u.canDo })
  return out
}

// ------------------------------------------------------------- the week
export interface WeekSummary {
  /** First and last local day of the 7-day window. */
  from: string
  to: string
  sessions: number
  lessons: number
  minutes: number
  daysPracticed: number
  xp: number
  newWords: number
  /** "Say it to her" missions done this week. */
  missions: number
  streak: number
  bestStreak: number
}

const DAY = 86_400_000

/** The last 7 days (today included), for a Sunday "Your week" card or shareWeek(). */
export async function weekSummary(now = Date.now()): Promise<WeekSummary> {
  const to = localDay(new Date(now))
  const from = localDay(new Date(now - 6 * DAY))
  const [sessions, memory, events, summary] = await Promise.all([
    db.sessions.where('day').between(from, to, true, true).toArray(),
    db.memory.toArray(),
    db.events.where('day').between(from, to, true, true).toArray(),
    getSummary(),
  ])
  const done = sessions.filter((s) => s.completed)
  const startMs = new Date(now - 6 * DAY).setHours(0, 0, 0, 0)
  const st = streakStatusOf(summary, to, now)
  return {
    from,
    to,
    sessions: done.length,
    lessons: done.filter((s) => s.kind === 'lesson' || s.kind === 'letters' || s.kind === 'story').length,
    minutes: Math.round(done.reduce((a, s) => a + Math.max(0, (s.end ?? s.start) - s.start), 0) / 60_000),
    daysPracticed: new Set(done.map((s) => s.day)).size,
    xp: done.reduce((a, s) => a + s.xp, 0),
    newWords: memory.filter((m) => m.learnedAt >= startMs && ['word', 'phrase'].includes(study(m.itemId)?.kind ?? '')).length,
    missions: events.filter((e) => e.source === 'mission').length,
    streak: st.streak,
    bestStreak: st.best,
  }
}

/** Monday-based week key, e.g. "2026-11-16". */
const weekKey = (d = new Date()) => {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return localDay(x)
}

/** Show the "Your week" card on Sunday (or on Monday if Sunday was missed), once per week. */
export async function weekCardDue(now = new Date()): Promise<boolean> {
  const dow = now.getDay()
  if (dow !== 0 && dow !== 1) return false
  const week = dow === 1 ? weekKey(new Date(now.getTime() - DAY)) : weekKey(now)
  return (await getKV<string | null>('weekShown', null)) !== week
}

export async function markWeekShown(now = new Date()) {
  const week = now.getDay() === 1 ? weekKey(new Date(now.getTime() - DAY)) : weekKey(now)
  await setKV('weekShown', week)
}
