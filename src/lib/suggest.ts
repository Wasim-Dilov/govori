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
}

const LEVEL_UP_GAP_MS = 20 * 3_600_000

export function todayMeta(sessionsToday: SessionRecord[]): TodayMeta {
  const lessons = sessionsToday.filter((s) => s.completed && (s.kind === 'lesson' || s.kind === 'letters' || s.kind === 'story')).sort((a, b) => a.start - b.start)
  const last = lessons[lessons.length - 1]
  return { sessionsToday: lessons.length, lastWasNew: !!last && (last.kind === 'story' || last.level <= 1) }
}

/** A lesson in the current or previous unit that is due a level-up: level 1 or 2, last done 20+ hours ago. */
export function levelUpCandidate(track: TrackView, progress: Record<string, LessonProgress>, unitId: string | null, now = Date.now()): LessonView | null {
  const ui = unitId ? track.units.findIndex((u) => u.id === unitId) : track.units.length - 1
  const units = track.units.slice(Math.max(0, ui - 1), ui + 1)
  const pool = units
    .flatMap((u) => u.lessons)
    .filter((l) => {
      if (l.kind === 'story') return false
      const p = progress[l.id]
      return !!p && p.level >= 1 && p.level < maxLevel(l) && now - p.completedAt >= LEVEL_UP_GAP_MS
    })
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
    const c = levelUpCandidate(track, progress, base.lesson.unitId, now)
    if (c) return { lesson: c, level: progress[c.id].level + 1, reason: 'levelup' }
  }
  return { ...base, reason: base.lesson.kind === 'story' ? 'story' : 'new' }
}
