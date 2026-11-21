// "Say it to her today": one learned love or family phrase a day to use for real.
// Stable for the day, not repeated within a week, logged as speaking when done.
import { study, trackById, type Speaker, type StudyItem } from '../content/index.ts'
import { db, getKV, localDay, setKV } from './db.ts'
import { addXp, logAnswer, updateMemory } from './progress.ts'
import { addDays } from './streak.ts'

export interface Mission {
  day: string
  item: StudyItem
  done: boolean
  /** True when he has no love or family phrase yet and this is the starter phrase. */
  starter: boolean
}

interface MissionLog {
  day: string
  itemId: string
  done: boolean
  doneAt?: number
}

export const MISSION_XP = 5
const KEY = 'missions'

const isMissionPhrase = (id: string) => (id.startsWith('love.') || id.startsWith('family.') || id.startsWith('our.')) && study(id)?.kind === 'phrase'

/** The first phrase of the love track: the starter mission before anything is learned. */
function starterId(): string | null {
  for (const l of trackById.get('love')?.lessons ?? []) for (const id of l.itemIds) if (study(id)?.kind === 'phrase') return id
  return null
}

/** Today's mission, picking and remembering one if needed. Null only if the content has no phrases at all. */
export async function todayMission(speaker: Speaker = 'm'): Promise<Mission | null> {
  const day = localDay()
  const log = await getKV<MissionLog[]>(KEY, [])
  const existing = log.find((m) => m.day === day)
  if (existing) {
    const item = study(existing.itemId, speaker)
    if (item) return { day, item, done: existing.done, starter: !isLearned(await learnedIds(), existing.itemId) }
  }
  const learned = (await learnedIds()).filter(isMissionPhrase)
  const weekAgo = addDays(day, -7)
  const recent = new Set(log.filter((m) => m.day > weekAgo).map((m) => m.itemId))
  const fresh = learned.filter((id) => !recent.has(id))
  const pool = fresh.length ? fresh : learned
  const seed = [...day].reduce((a, c) => a + c.charCodeAt(0), 0)
  const itemId = pool.length ? pool[seed % pool.length] : starterId()
  if (!itemId) return null
  await setKV(KEY, [...log.filter((m) => m.day !== day), { day, itemId, done: false }].slice(-30))
  const item = study(itemId, speaker)
  return item ? { day, item, done: false, starter: !pool.length } : null
}

const learnedIds = async () => (await db.memory.toCollection().primaryKeys()) as string[]
const isLearned = (ids: string[], id: string) => ids.includes(id)

/**
 * He said today's phrase to her. Logs it as speaking (source "mission"), strengthens the item
 * and adds MISSION_XP. Returns null if there is no mission or it was already done.
 */
export async function completeMission(speaker: Speaker = 'm') {
  const mission = await todayMission(speaker)
  if (!mission || mission.done) return null
  const log = await getKV<MissionLog[]>(KEY, [])
  await setKV(
    KEY,
    log.map((m) => (m.day === mission.day ? { ...m, done: true, doneAt: Date.now() } : m)),
  )
  await logAnswer({
    sessionId: `mission-${mission.day}`,
    trackId: mission.item.trackId,
    lessonId: 'mission',
    itemId: mission.item.id,
    exType: 'speak',
    correct: true,
    ms: 0,
    attempt: 1,
    answer: 'said it to her',
    level: 0,
    source: 'mission',
  })
  await updateMemory(mission.item.id, true, true)
  const xp = await addXp(MISSION_XP)
  return { mission: { ...mission, done: true }, xp: MISSION_XP, goalReached: xp.goalReached, earnedFreeze: xp.earnedFreeze }
}

/** The phrase he said to her today, for the share card ("Tonight I said: ..."), or null. */
export async function missionSaidToday(speaker: Speaker = 'm'): Promise<StudyItem | null> {
  const day = localDay()
  const m = (await getKV<MissionLog[]>(KEY, [])).find((x) => x.day === day && x.done)
  return m ? (study(m.itemId, speaker) ?? null) : null
}

/** Missions completed in the last n days (for stats). */
export async function missionsDone(days = 7): Promise<number> {
  const since = addDays(localDay(), -(days - 1))
  return (await getKV<MissionLog[]>(KEY, [])).filter((m) => m.done && m.day >= since).length
}
