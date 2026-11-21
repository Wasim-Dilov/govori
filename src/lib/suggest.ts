// Chooses what the Today card offers next: a new lesson, a level-up of an older
// lesson, the unit's conversation, or (when the track is finished) a review.
// Alternating new lessons with level-ups is what gets the learner to levels 2
// and 3, where typing, listening and speaking happen.
import { maxLevel, type LessonView, type TrackView } from '../content/index.ts'
import type { LessonProgress, SessionRecord } from './db.ts'
import { nextLesson } from './progress.ts'

export type SuggestReason = 'new' | 'levelup' | 'story' | 'review'

export interface Suggestion {
  lesson: LessonView
  level: number
  reason: Exclude<SuggestReason, 'review'>
}

/** What has happened today, from the session log. */
export interface TodayMeta {
  /** Lesson, letter and conversation sessions completed today. */
  sessionsToday: number
  /** Whether the latest of those taught new material (level 1 or a conversation). */
  lastWasNew: boolean
  /** A review of any kind (warm-up, quick, welcome back, Review) was done today. Optional for older callers. */
  warmupDone?: boolean
}

const LEVEL_UP_GAP_MS = 20 * 3_600_000

export function todayMeta(sessionsToday: SessionRecord[]): TodayMeta {
  const lessons = sessionsToday.filter((s) => s.completed && (s.kind === 'lesson' || s.kind === 'letters' || s.kind === 'story')).sort((a, b) => a.start - b.start)
  const last = lessons[lessons.length - 1]
  const reviewed = sessionsToday.some((s) => s.completed && (s.kind === 'warmup' || s.kind === 'quick' || s.kind === 'welcome' || s.kind === 'practice'))
  return { sessionsToday: lessons.length, lastWasNew: !!last && (last.kind === 'story' || last.level <= 1), warmupDone: reviewed }
}

/**
 * A lesson due a level-up: level 1 or 2, last done 20+ hours ago. Looks in the current and
 * previous unit first (lowest level, then oldest); with `anywhere` (or no unit), the oldest
 * eligible lesson in the whole track, so early units are not forgotten when he comes back.
 */
export function levelUpCandidate(track: TrackView, progress: Record<string, LessonProgress>, unitId: string | null, now = Date.now(), anywhere = false): LessonView | null {
  const eligible = (l: LessonView) => {
    if (l.kind === 'story') return false
    const p = progress[l.id]
    return !!p && p.level >= 1 && p.level < maxLevel(l) && now - p.completedAt >= LEVEL_UP_GAP_MS
  }
  if (anywhere || !unitId) {
    const pool = track.lessons.filter(eligible).sort((a, b) => progress[a.id].completedAt - progress[b.id].completedAt)
    return pool[0] ?? null
  }
  const ui = track.units.findIndex((u) => u.id === unitId)
  const units = track.units.slice(Math.max(0, ui - 1), ui + 1)
  const pool = units
    .flatMap((u) => u.lessons)
    .filter(eligible)
    .sort((a, b) => progress[a.id].level - progress[b.id].level || progress[a.id].completedAt - progress[b.id].completedAt)
  return pool[0] ?? null
}

/**
 * The next thing to do in a track. Null means the track is finished: offer a review instead.
 * First session of the day: something new. After a new lesson: level up an older one when one is due.
 */
export function suggestNext(track: TrackView, progress: Record<string, LessonProgress>, today: TodayMeta, now = Date.now()): Suggestion | null {
  const base = nextLesson(track, progress)
  if (!base) {
    // Everything has been started; catch anything still below its top level.
    const any = levelUpCandidate(track, progress, null, now)
    return any ? { lesson: any, level: (progress[any.id]?.level ?? 0) + 1, reason: 'levelup' } : null
  }
  const isNew = (progress[base.lesson.id]?.level ?? 0) === 0
  if (!isNew) return { ...base, reason: 'levelup' }

  if (today.sessionsToday >= 1 && today.lastWasNew) {
    const c = levelUpCandidate(track, progress, base.lesson.unitId, now) ?? levelUpCandidate(track, progress, null, now, true)
    if (c) return { lesson: c, level: progress[c.id].level + 1, reason: 'levelup' }
  }
  return { ...base, reason: base.lesson.kind === 'story' ? 'story' : 'new' }
}

// ------------------------------------------------------------- the day's plan

/** A warm-up is offered when at least this many items are due. */
export const WARMUP_MIN_DUE = 8
/** A warm-up reviews at most this many items (about two minutes). */
export const WARMUP_MAX = 10

export interface TodayPlan {
  /** Review first, then continue into `next`. Null when nothing much is due or a review was done today. */
  warmup: { count: number; minutes: number } | null
  /** The lesson to do (after the warm-up, if any). Null when the track is finished. */
  next: Suggestion | null
}

/**
 * What the Today button should do: a short warm-up review when 8+ items are due (retrieval
 * before new input), chained into the next lesson; otherwise the next lesson straight away.
 * `review.count` is today's bounded review (todayReview() in progress.ts), never the raw backlog.
 */
export function todayPlan(track: TrackView, progress: Record<string, LessonProgress>, today: TodayMeta, review: { count: number }, now = Date.now()): TodayPlan {
  const next = suggestNext(track, progress, today, now)
  const count = Math.min(WARMUP_MAX, review.count)
  const warmup = !today.warmupDone && review.count >= WARMUP_MIN_DUE ? { count, minutes: Math.max(1, Math.round((count * 12) / 60)) } : null
  return { warmup, next }
}
