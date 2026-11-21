// Streaks, XP, levels, spaced repetition and the answer log.
import { allItemIds, lessonById, maxLevel, study, trackById, type Speaker, type StudyItem, type TrackView } from '../content/index.ts'
import type { TrackId } from '../content/types.ts'
import { db, getKV, localDay, setKV, type AnswerEvent, type ExerciseType, type LessonProgress, type Memory, type SessionRecord, type Summary } from './db.ts'
import { applyGoalDay, applySession, streakStatusOf, type StreakStatus } from './streak.ts'
import type { Milestone } from './milestones.ts'

export const DEFAULT_SUMMARY: Summary = {
  streak: 0,
  longestStreak: 0,
  lastPracticeDay: null,
  dailyGoal: 30,
  xpToday: 0,
  xpDay: null,
  totalXp: 0,
  name: '',
  wordOfDay: null,
  freezes: 0,
  goalDays: 0,
  goalDay: null,
  frozenDays: [],
  repair: null,
}

export const getSummary = () => getKV<Summary>('summary', DEFAULT_SUMMARY).then((s) => ({ ...DEFAULT_SUMMARY, ...s }))
export const saveSummary = (s: Summary) => setKV('summary', s)

const dayMs = 86_400_000
export const yesterday = () => localDay(new Date(Date.now() - dayMs))

/** The streak as it stands today: it survives until the end of the day after the last practice, or longer with a freeze. */
export function liveStreak(s: Summary): number {
  return streakStatusOf(s, localDay()).streak
}

/** Streak, freezes and repair state for the Today card and Stats. */
export async function streakStatus(): Promise<StreakStatus> {
  return streakStatusOf(await getSummary(), localDay())
}

// ------------------------------------------------------------- daily goal
/** Daily goal choices: honest minutes for the XP they ask (a lesson is about 10 to 15 XP and 3 to 4 minutes). */
export const GOAL_OPTIONS = [
  { min: 5, xp: 15, label: 'Easy' },
  { min: 10, xp: 30, label: 'Regular' },
  { min: 15, xp: 45, label: 'Serious' },
] as const
export const DEFAULT_GOAL = 30

/** Map an old goal (20/40/60 XP) or any other value to the nearest current option. */
export function migrateGoal(xp: number | undefined): number {
  const old: Record<number, number> = { 20: 15, 40: 30, 60: 45 }
  if (xp == null || !Number.isFinite(xp)) return DEFAULT_GOAL
  if (GOAL_OPTIONS.some((o) => o.xp === xp)) return xp
  if (old[xp]) return old[xp]
  return GOAL_OPTIONS.reduce((best, o) => (Math.abs(o.xp - xp) < Math.abs(best - xp) ? o.xp : best), DEFAULT_GOAL as number)
}

/**
 * Add XP outside a session (e.g. the "Say it to her" mission). Counts toward the daily goal and
 * toward freezes, but does not extend the streak: only a real session does that.
 */
export async function addXp(xp: number): Promise<{ summary: Summary; goalReached: boolean; earnedFreeze: boolean }> {
  const today = localDay()
  const s = await getSummary()
  const prevToday = xpToday(s)
  const next: Summary = { ...s, xpToday: prevToday + xp, xpDay: today, totalXp: s.totalXp + xp }
  let earnedFreeze = false
  const goalReached = prevToday < s.dailyGoal && prevToday + xp >= s.dailyGoal
  if (goalReached) {
    const g = applyGoalDay(next, today)
    Object.assign(next, { goalDays: g.goalDays, goalDay: g.goalDay, freezes: g.freezes })
    earnedFreeze = g.earnedFreeze
  }
  next.streakForReminder = streakStatusOf(next, today).streak
  await saveSummary(next)
  return { summary: next, goalReached, earnedFreeze }
}
export const practicedToday = (s: Summary) => s.lastPracticeDay === localDay()
export const xpToday = (s: Summary) => (s.xpDay === localDay() ? s.xpToday : 0)

// ------------------------------------------------------------- learner levels
export const LEVEL_NAMES = [
  { bg: 'Новак', en: 'Newcomer' },
  { bg: 'Ученик', en: 'Student' },
  { bg: 'Любознател', en: 'Curious mind' },
  { bg: 'Събеседник', en: 'Conversationalist' },
  { bg: 'Душа на компанията', en: 'Life of the party' },
  { bg: 'Почти българин', en: 'Almost Bulgarian' },
  { bg: 'Българин по сърце', en: 'Bulgarian at heart' },
]
/** XP needed to reach level n (1-based): 0, 100, 250, 450, 700, 1000, 1400, then +450 each. */
export function levelFloor(n: number): number {
  const table = [0, 0, 100, 250, 450, 700, 1000, 1400]
  return n < table.length ? table[n] : 1400 + (n - 7) * 450
}
export function learnerLevel(totalXp: number) {
  let n = 1
  while (totalXp >= levelFloor(n + 1)) n++
  const floor = levelFloor(n)
  const next = levelFloor(n + 1)
  const name = LEVEL_NAMES[Math.min(n - 1, LEVEL_NAMES.length - 1)]
  return { level: n, name, floor, next, progress: (totalXp - floor) / (next - floor) }
}

// ------------------------------------------------------------- spaced repetition (Leitner)
const BOX_DAYS = [0, 1, 2, 4, 7, 15, 30]

/** Memory with the day it was last promoted, so a word climbs at most one box per day. */
type Mem = Memory & { lastPromotedDay?: string }

/** True if an id is something Govori can teach again (a word, phrase, letter or reading word). */
const schedulable = (id: string) => !id.includes('+') && !!study(id)

export async function updateMemory(itemId: string, correct: boolean, firstTry: boolean) {
  // Match rounds and conversation lines are logged, not scheduled.
  if (!schedulable(itemId)) return
  const now = Date.now()
  const today = localDay()
  const m: Mem = (await db.memory.get(itemId)) ?? { itemId, box: 0, due: now, seen: 0, correct: 0, wrong: 0, lastSeen: now, learnedAt: now }
  m.seen++
  m.lastSeen = now
  if (correct) {
    m.correct++
    // Promote only when the item was due and not already promoted today; drilling it
    // five times in one lesson must not hide it for a month.
    if (firstTry && m.due <= now && m.lastPromotedDay !== today) {
      m.box = Math.min(6, m.box + 1)
      m.lastPromotedDay = today
      m.due = now + BOX_DAYS[m.box] * dayMs
    }
  } else {
    m.wrong++
    m.box = Math.max(0, m.box - 2)
    m.due = now + BOX_DAYS[m.box] * dayMs
  }
  await db.memory.put(m)
}

/** Ids due for review, weakest and most overdue first. */
export async function dueItems(limit = 12, filter?: (id: string) => boolean): Promise<string[]> {
  const all = await db.memory.toArray()
  const now = Date.now()
  return all
    .filter((m) => schedulable(m.itemId) && (!filter || filter(m.itemId)) && (m.due <= now || m.wrong > m.correct))
    .sort((a, b) => a.box - b.box || a.due - b.due)
    .slice(0, limit)
    .map((m) => m.itemId)
}

/** Item ids the learner has met, for review mixed into lessons. */
export async function reviewPool(trackId: TrackId | null, exclude: string[], limit = 3): Promise<string[]> {
  const ids = await dueItems(40, (id) => !exclude.includes(id) && !id.startsWith('az.') && (!trackId || id.startsWith(trackId + '.')))
  return ids.slice(0, limit)
}

/**
 * Review woven into a lesson: up to two due items from the same track plus one from another
 * track (interleaving), topped up from either when one side has none.
 */
export async function lessonReview(trackId: TrackId | null, exclude: string[] = [], limit = 3): Promise<string[]> {
  const due = await dueItems(60, (id) => !exclude.includes(id) && !id.startsWith('az.'))
  const same = trackId ? due.filter((id) => id.startsWith(trackId + '.')) : due
  const other = trackId ? due.filter((id) => !id.startsWith(trackId + '.')) : []
  const pick = [...same.slice(0, limit - 1), ...other.slice(0, 1)]
  for (const id of [...same, ...other]) if (pick.length < limit && !pick.includes(id)) pick.push(id)
  return pick.slice(0, limit)
}

/** At most this many due items are reviewed per day, so a backlog never becomes a wall. */
export const DAILY_REVIEW_CAP = 15
/** Roughly how long one review item takes. */
const SECONDS_PER_REVIEW = 12
/** Sessions that count as review (their events carry the kind as lessonId). */
const REVIEW_KINDS = new Set(['practice', 'warmup', 'quick', 'welcome', 'mistakes'])

/** Distinct items already reviewed today in review sessions. */
export async function reviewedTodayCount(): Promise<number> {
  const events = await db.events.where('day').equals(localDay()).toArray()
  return new Set(events.filter((e) => REVIEW_KINDS.has(e.lessonId) && !e.itemId.includes('+')).map((e) => e.itemId)).size
}

/** Today's review, bounded: what to show instead of the raw backlog. */
export async function todayReview(): Promise<{ count: number; minutes: number; backlog: number }> {
  const [due, done] = await Promise.all([dueItems(500), reviewedTodayCount()])
  const count = Math.max(0, Math.min(due.length, DAILY_REVIEW_CAP - done))
  return { count, minutes: Math.max(1, Math.round((count * SECONDS_PER_REVIEW) / 60)), backlog: due.length }
}

/** Ids for today's bounded review (weakest and most overdue first). */
export async function todayReviewIds(limit = DAILY_REVIEW_CAP): Promise<string[]> {
  const { count } = await todayReview()
  return dueItems(Math.min(limit, count))
}

/** Words he knows best (highest box, most often right), for a confidence-building review. */
export async function strongestItemIds(limit = 8): Promise<string[]> {
  const mem = (await db.memory.toArray()).filter((m) => isWord(m.itemId))
  return mem
    .sort((a, b) => b.box - a.box || b.correct / Math.max(1, b.seen) - a.correct / Math.max(1, a.seen) || b.lastSeen - a.lastSeen)
    .slice(0, limit)
    .map((m) => m.itemId)
}

const isWord = (id: string) => {
  const k = study(id)?.kind
  return k === 'word' || k === 'phrase'
}

/** Words and phrases met so far (letters, reading words and conversation lines don't count). */
export async function learnedCount(): Promise<number> {
  const ids = (await db.memory.toCollection().primaryKeys()) as string[]
  return ids.filter(isWord).length
}

/** Cyrillic letters met so far. */
export async function lettersLearnedCount(): Promise<number> {
  const ids = (await db.memory.toCollection().primaryKeys()) as string[]
  return ids.filter((id) => study(id)?.kind === 'letter').length
}

/** Items answered wrongly in the last 14 days that have not been answered right since. */
export async function recentMistakes(limit = 12): Promise<string[]> {
  const since = Date.now() - 14 * dayMs
  const events = await db.events.where('ts').above(since).toArray()
  const last = new Map<string, boolean>()
  for (const e of events.sort((a, b) => a.ts - b.ts)) if (!e.itemId.includes('+') && e.exType !== 'dialogue') last.set(e.itemId, e.correct)
  return [...last.entries()].filter(([id, ok]) => !ok && schedulable(id)).map(([id]) => id).slice(-limit)
}

/** Ids of everything learned (words and phrases), for the speed round. */
export async function learnedWordIds(): Promise<string[]> {
  return ((await db.memory.toCollection().primaryKeys()) as string[]).filter(isWord)
}

// ------------------------------------------------------------- lesson progress
export async function allLessonProgress(): Promise<Record<string, LessonProgress>> {
  const rows = await db.lessons.toArray()
  return Object.fromEntries(rows.map((r) => [r.lessonId, r]))
}

export const MAX_LEVEL = 3

export type NodeState = 'done' | 'current' | 'open' | 'locked'

/** State of each lesson in a track: lessons unlock in order once the previous has at least level 1. */
export function lessonStates(track: TrackView, progress: Record<string, LessonProgress>): Record<string, NodeState> {
  const out: Record<string, NodeState> = {}
  let currentAssigned = false
  for (const l of track.lessons) {
    const lvl = progress[l.id]?.level ?? 0
    if (lvl >= maxLevel(l)) out[l.id] = 'done'
    else if (lvl > 0) out[l.id] = 'open'
    else if (!currentAssigned) {
      out[l.id] = 'current'
      currentAssigned = true
    } else out[l.id] = 'locked'
  }
  // If every lesson has been started, highlight the first one that isn't maxed.
  if (!currentAssigned) {
    const firstOpen = track.lessons.find((l) => out[l.id] === 'open')
    if (firstOpen) out[firstOpen.id] = 'current'
  }
  return out
}

/** The lesson to suggest next in a track, and at which level. */
export function nextLesson(track: TrackView, progress: Record<string, LessonProgress>) {
  const states = lessonStates(track, progress)
  const l = track.lessons.find((x) => states[x.id] === 'current')
  if (!l) return null
  return { lesson: l, level: Math.min(maxLevel(l), (progress[l.id]?.level ?? 0) + 1) }
}

export function trackCompletion(track: TrackView, progress: Record<string, LessonProgress>) {
  const total = track.lessons.reduce((s, l) => s + maxLevel(l), 0)
  const done = track.lessons.reduce((s, l) => s + Math.min(maxLevel(l), progress[l.id]?.level ?? 0), 0)
  return { done, total, ratio: total ? done / total : 0, started: track.lessons.filter((l) => progress[l.id]).length }
}

// ------------------------------------------------------------- logging & finishing
export function newSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export async function logAnswer(e: Omit<AnswerEvent, 'id' | 'day' | 'hour' | 'weekday' | 'ts'>) {
  const now = new Date()
  await db.events.add({ ...e, ts: now.getTime(), day: localDay(now), hour: now.getHours(), weekday: now.getDay() })
}

export interface SessionResult {
  sessionId: string
  kind: SessionRecord['kind']
  lessonId: string
  trackId: string
  level: number
  xp: number
  correct: number
  total: number
  accuracy: number
  ms: number
  perfect: boolean
  newItems: StudyItem[]
  streak: number
  streakIncreased: boolean
  goalReached: boolean
  levelUp: { from: number; to: number } | null
  lessonLevelUp: boolean
  /** A freeze covered yesterday and kept the streak. */
  usedFreeze?: boolean
  /** Two sessions after a break brought the old streak back. */
  repaired?: boolean
  /** Meeting today's goal earned a new freeze. */
  earnedFreeze?: boolean
  /** Milestones reached by this session (filled in by the store). */
  milestones?: Milestone[]
}

export async function finishSession(input: {
  sessionId: string
  kind: SessionRecord['kind']
  lessonId: string
  trackId: string
  level: number
  start: number
  correct: number
  total: number
  newItems: StudyItem[]
  speaker: Speaker
}): Promise<SessionResult> {
  const today = localDay()
  const accuracy = input.total ? input.correct / input.total : 1
  const perfect = input.correct === input.total
  const base = input.kind === 'lesson' || input.kind === 'letters' ? 10 + (input.level - 1) * 2 : input.kind === 'story' ? 15 : input.kind === 'quick' ? 5 : 10
  const xp = base + (perfect ? 5 : 0)

  const s = await getSummary()
  const before = learnerLevel(s.totalXp).level
  const st = applySession(s, today, Date.now(), input.kind)
  const prevToday = xpToday(s)
  const next: Summary = {
    ...s,
    ...st.fields,
    xpToday: prevToday + xp,
    xpDay: today,
    totalXp: s.totalXp + xp,
  }
  const goalReached = prevToday < s.dailyGoal && prevToday + xp >= s.dailyGoal
  let earnedFreeze = false
  if (goalReached) {
    const g = applyGoalDay(next, today)
    Object.assign(next, { goalDays: g.goalDays, goalDay: g.goalDay, freezes: g.freezes })
    earnedFreeze = g.earnedFreeze
  }
  next.streakForReminder = streakStatusOf(next, today).streak
  next.wordOfDay = await pickWordOfDay(input.speaker)
  await saveSummary(next)
  const streak = st.streak
  const after = learnerLevel(next.totalXp).level

  let lessonLevelUp = false
  if ((input.kind === 'lesson' || input.kind === 'letters' || input.kind === 'story') && input.lessonId) {
    const prev = await db.lessons.get(input.lessonId)
    if (!prev || input.level > prev.level) lessonLevelUp = true
    await db.lessons.put({
      lessonId: input.lessonId,
      level: Math.max(prev?.level ?? 0, input.level),
      bestAccuracy: Math.max(prev?.bestAccuracy ?? 0, accuracy),
      completedAt: Date.now(),
    })
  }
  await db.sessions.put({
    id: input.sessionId,
    start: input.start,
    end: Date.now(),
    day: today,
    trackId: input.trackId,
    lessonId: input.lessonId,
    kind: input.kind,
    level: input.level,
    xp,
    correct: input.correct,
    total: input.total,
    completed: true,
  })
  return {
    sessionId: input.sessionId,
    kind: input.kind,
    lessonId: input.lessonId,
    trackId: input.trackId,
    level: input.level,
    xp,
    correct: input.correct,
    total: input.total,
    accuracy,
    ms: Date.now() - input.start,
    perfect,
    newItems: input.newItems,
    streak,
    streakIncreased: st.increased,
    goalReached,
    levelUp: after > before ? { from: before, to: after } : null,
    lessonLevelUp,
    usedFreeze: st.usedFreeze,
    repaired: st.repaired,
    earnedFreeze,
  }
}

/** A learned word for today's notification, stable for the day. */
async function pickWordOfDay(speaker: Speaker) {
  const learned = (await db.memory.toArray()).map((m) => m.itemId).filter((id) => !id.startsWith('az.'))
  const pool = learned.length ? learned : allItemIds.filter((id) => id.startsWith('love.'))
  const seed = [...localDay()].reduce((a, c) => a + c.charCodeAt(0), 0)
  const it = study(pool[seed % pool.length], speaker)
  return it ? { bg: it.bg, tr: it.tr, en: it.en, emoji: it.emoji } : null
}

export const trackOfLesson = (lessonId: string) => trackById.get(lessonById.get(lessonId)?.trackId ?? 'basics')

/** True when at least one unit of the track has every lesson done at level 1 or more (conversations aside). */
export function hasUnitDone(track: TrackId, progress: Record<string, LessonProgress>): boolean {
  const t = trackById.get(track)
  if (!t) return false
  return t.units.some((u) => {
    const lessons = u.lessons.filter((l) => l.kind !== 'story')
    return lessons.length > 0 && lessons.every((l) => (progress[l.id]?.level ?? 0) >= 1)
  })
}

export type { ExerciseType }
