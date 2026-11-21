// Streaks, XP, levels, spaced repetition and the answer log.
import { allItemIds, lessonById, maxLevel, study, trackById, type Speaker, type StudyItem, type TrackView } from '../content/index.ts'
import type { TrackId } from '../content/types.ts'
import { db, getKV, localDay, setKV, type AnswerEvent, type ExerciseType, type LessonProgress, type Memory, type SessionRecord, type Summary } from './db.ts'

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
}

export const getSummary = () => getKV<Summary>('summary', DEFAULT_SUMMARY).then((s) => ({ ...DEFAULT_SUMMARY, ...s }))
export const saveSummary = (s: Summary) => setKV('summary', s)

const dayMs = 86_400_000
export const yesterday = () => localDay(new Date(Date.now() - dayMs))

/** The streak as it stands today: it survives until the end of the day after the last practice. */
export function liveStreak(s: Summary): number {
  if (!s.lastPracticeDay) return 0
  if (s.lastPracticeDay === localDay() || s.lastPracticeDay === yesterday()) return s.streak
  return 0
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

const isWord = (id: string) => {
  const k = study(id)?.kind
  return k === 'word' || k === 'phrase'
}

/** Words and phrases met so far (letters, reading words and conversation lines don't count). */
export async function learnedCount(): Promise<number> {
  const ids = (await db.memory.toCollection().primaryKeys()) as string[]
  return ids.filter(isWord).length
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
  const base = input.kind === 'lesson' || input.kind === 'letters' ? 10 + (input.level - 1) * 2 : input.kind === 'story' ? 15 : 10
  const xp = base + (perfect ? 5 : 0)

  const s = await getSummary()
  const before = learnerLevel(s.totalXp).level
  const live = liveStreak(s)
  const already = s.lastPracticeDay === today
  const streak = already ? live : live + 1
  const prevToday = xpToday(s)
  const next: Summary = {
    ...s,
    streak,
    longestStreak: Math.max(s.longestStreak, streak),
    lastPracticeDay: today,
    xpToday: prevToday + xp,
    xpDay: today,
    totalXp: s.totalXp + xp,
  }
  next.wordOfDay = await pickWordOfDay(input.speaker)
  await saveSummary(next)
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
    streakIncreased: !already,
    goalReached: prevToday < s.dailyGoal && prevToday + xp >= s.dailyGoal,
    levelUp: after > before ? { from: before, to: after } : null,
    lessonLevelUp,
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

export type { ExerciseType }
