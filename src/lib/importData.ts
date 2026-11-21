// Restores a Govori backup made with exportData.ts. Recordings (her voice) and this
// phone's reminder keys are never in a backup, so they are kept as they are.
import { db, type AnswerEvent, type LessonProgress, type Memory, type SessionRecord } from './db.ts'

/** kv keys that belong to this phone, not to the learner's progress. */
const DEVICE_KV = new Set(['push', 'persist'])

export interface Backup {
  exportedAt: string
  settings: Record<string, unknown>
  lessons: LessonProgress[]
  memory: Memory[]
  events: AnswerEvent[]
  sessions: SessionRecord[]
}

export interface BackupSummary {
  exportedAt: Date
  lessons: number
  memory: number
  events: number
  sessions: number
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const arr = (v: unknown, name: string) => {
  if (!Array.isArray(v)) throw new Error(`This backup is missing its ${name}.`)
  return v as Record<string, unknown>[]
}
const check = (rows: Record<string, unknown>[], name: string, ok: (r: Record<string, unknown>) => boolean) => {
  const bad = rows.findIndex((r) => !isObj(r) || !ok(r))
  if (bad !== -1) throw new Error(`Row ${bad + 1} of the ${name} in this backup looks damaged.`)
}

/** Read and validate a backup file. Throws an Error with a plain-English message if it isn't one. */
export async function readBackup(file: File): Promise<{ backup: Backup; summary: BackupSummary }> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't a Govori backup (it isn't valid JSON).")
  }
  if (!isObj(raw) || raw.app !== 'govori') throw new Error("That file isn't a Govori backup.")
  if (raw.format !== 1) throw new Error('This backup comes from a newer version of Govori. Update the app and try again.')

  const lessons = arr(raw.lessons, 'lessons')
  const memory = arr(raw.memory, 'word memory')
  const events = arr(raw.events, 'answer log')
  const sessions = arr(raw.sessions, 'sessions')
  check(lessons, 'lessons', (r) => typeof r.lessonId === 'string' && typeof r.level === 'number')
  check(memory, 'word memory', (r) => typeof r.itemId === 'string' && typeof r.box === 'number' && typeof r.due === 'number')
  check(events, 'answer log', (r) => typeof r.ts === 'number' && typeof r.itemId === 'string' && typeof r.correct === 'boolean')
  check(sessions, 'sessions', (r) => typeof r.id === 'string' && typeof r.start === 'number')

  const settings = isObj(raw.settings) ? { ...raw.settings } : {}
  if (raw.profile && !settings.profile) settings.profile = raw.profile
  if (raw.summary && !settings.summary) settings.summary = raw.summary
  for (const k of DEVICE_KV) delete settings[k]
  if (!isObj(settings.profile)) throw new Error('This backup has no profile in it.')

  const exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString()
  const backup: Backup = {
    exportedAt,
    settings,
    lessons: lessons as unknown as LessonProgress[],
    memory: memory as unknown as Memory[],
    events: events as unknown as AnswerEvent[],
    sessions: sessions as unknown as SessionRecord[],
  }
  return {
    backup,
    summary: { exportedAt: new Date(exportedAt), lessons: lessons.length, memory: memory.length, events: events.length, sessions: sessions.length },
  }
}

/** Replace progress on this phone with the backup, in one transaction. */
export async function restoreBackup(backup: Backup) {
  await db.transaction('rw', [db.kv, db.lessons, db.memory, db.events, db.sessions], async () => {
    const keep = (await db.kv.toArray()).filter((r) => DEVICE_KV.has(r.key))
    await Promise.all([db.kv.clear(), db.lessons.clear(), db.memory.clear(), db.events.clear(), db.sessions.clear()])
    await db.kv.bulkPut([...keep, ...Object.entries(backup.settings).map(([key, value]) => ({ key, value }))])
    await db.lessons.bulkPut(backup.lessons)
    await db.memory.bulkPut(backup.memory)
    await db.events.bulkPut(backup.events)
    await db.sessions.bulkPut(backup.sessions)
  })
}

/** Read, validate and restore in one go. */
export async function importBackup(file: File): Promise<BackupSummary> {
  const { backup, summary } = await readBackup(file)
  await restoreBackup(backup)
  return summary
}
