import Dexie, { type EntityTable } from 'dexie'

// Everything Govori remembers lives on the phone in IndexedDB database "govori".
// The service worker reads the `kv` store directly (key "summary") to word
// the evening reminder, so keep that record's shape in sync with sw.ts.

export type ExerciseType =
  | 'intro'
  | 'mc_bg_en'
  | 'mc_en_bg'
  | 'listen_mc'
  | 'match'
  | 'build'
  | 'type_bg'
  | 'listen_type'
  | 'speak'
  | 'letter_sound'
  | 'sound_letter'
  | 'read_word'
  | 'dialogue'

/** One answered exercise. This is the raw log used for statistics and later analysis. */
export interface AnswerEvent {
  id?: number
  ts: number
  /** Local calendar day, YYYY-MM-DD. */
  day: string
  /** 0-23 local hour. */
  hour: number
  /** 0 = Sunday. */
  weekday: number
  sessionId: string
  trackId: string
  lessonId: string
  itemId: string
  exType: ExerciseType
  correct: boolean
  /** Milliseconds from the exercise appearing to the answer being checked. */
  ms: number
  /** 1 for the first try at this exercise in the session, 2+ for re-queued retries. */
  attempt: number
  /** What the learner gave, for later analysis of typical mistakes. */
  answer?: string
  /** Lesson level (1-3) the exercise came from; 0 for practice sessions. */
  level: number
}

export interface SessionRecord {
  id: string
  start: number
  end?: number
  day: string
  trackId: string
  lessonId: string
  kind: 'lesson' | 'practice' | 'letters' | 'story' | 'speed' | 'mistakes'
  level: number
  xp: number
  correct: number
  total: number
  completed: boolean
}

/** Spaced-repetition memory for one item or letter (Leitner boxes). */
export interface Memory {
  itemId: string
  box: number // 0..6
  due: number // timestamp
  seen: number
  correct: number
  wrong: number
  lastSeen: number
  learnedAt: number
}

/** Lesson progress: highest level completed (0-3). */
export interface LessonProgress {
  lessonId: string
  level: number
  bestAccuracy: number
  completedAt: number
}

export interface KV {
  key: string
  value: unknown
}

export interface Recording {
  itemId: string
  blob: Blob
  mime: string
  createdAt: number
}

/** Shape of kv["summary"], read by the service worker. */
export interface Summary {
  streak: number
  longestStreak: number
  /** Local day (YYYY-MM-DD) of the last completed session. */
  lastPracticeDay: string | null
  dailyGoal: number
  xpToday: number
  xpDay: string | null
  totalXp: number
  name: string
  /** Picked each day from learned items, used in notifications. */
  wordOfDay: { bg: string; tr: string; en: string; emoji: string } | null
}

export const db = new Dexie('govori') as Dexie & {
  kv: EntityTable<KV, 'key'>
  memory: EntityTable<Memory, 'itemId'>
  lessons: EntityTable<LessonProgress, 'lessonId'>
  events: EntityTable<AnswerEvent, 'id'>
  sessions: EntityTable<SessionRecord, 'id'>
  recordings: EntityTable<Recording, 'itemId'>
}

db.version(1).stores({
  kv: '&key',
  memory: '&itemId, due, box',
  lessons: '&lessonId',
  events: '++id, ts, day, itemId, exType, sessionId, trackId',
  sessions: '&id, start, day',
  recordings: '&itemId',
})

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.kv.get(key)
    return row ? (row.value as T) : fallback
  } catch {
    return fallback
  }
}

export async function setKV(key: string, value: unknown) {
  await db.kv.put({ key, value })
}

export const localDay = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
