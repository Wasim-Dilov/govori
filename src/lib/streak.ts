// Streak rules, as pure functions with no imports, so the service worker and tests can use them too.
//
// - A streak survives until the end of the day after the last session.
// - Freezes: one is earned every 7 days the daily goal is met (hold at most 2). A freeze covers
//   exactly one missed day and is spent when he next practises (matching sw.ts, which reads
//   `summary.freezes`).
// - Repair: if the streak broke anyway, two sessions within 48 hours of the break restore it.
//   At least one of the two must be a real session (lesson, warm-up, review, conversation,
//   welcome or quiz); one-minute quick sessions and speed rounds alone do not repair.

/** The summary fields these rules read and write (a subset of Summary in db.ts). */
export interface StreakFields {
  streak: number
  longestStreak: number
  lastPracticeDay: string | null
  freezes?: number
  goalDays?: number
  goalDay?: string | null
  frozenDays?: string[]
  /** `full` counts the sessions that qualify for repair (missing on older records: all counted). */
  repair?: { oldStreak: number; deadline: number; sessions: number; full?: number } | null
}

/** Session kinds too light to repair a streak on their own. */
const LIGHT_KINDS = new Set(['quick', 'speed'])
/** True when a session of this kind can complete a streak repair. */
export const repairsStreak = (kind?: string) => !kind || !LIGHT_KINDS.has(kind)

type Repair = NonNullable<StreakFields['repair']>
const fullOf = (r: Repair) => r.full ?? r.sessions
/** A repair is complete after two sessions, at least one of them a full session. */
const repairDone = (r: Repair) => r.sessions >= 2 && fullOf(r) >= 1
/** Sessions still needed: two in total, and at least one full one. */
const repairLeft = (r: Repair) => Math.max(2 - r.sessions, fullOf(r) >= 1 ? 0 : 1)

export type StreakState =
  /** Practised today. */
  | 'done'
  /** Practised yesterday: alive, practise today to extend it. */
  | 'alive'
  /** One missed day, covered by a freeze when he practises today. */
  | 'frozen'
  /** Broken, but two sessions before `repairDeadline` restore it. */
  | 'repairable'
  /** Broken and past repair (or never started). */
  | 'none'

export interface StreakStatus {
  /** The streak to show now (0 when broken). */
  streak: number
  /** Longest streak ever. */
  best: number
  /** Freezes in hand (0-2). */
  freezes: number
  /** Goal days toward the next freeze (0-7). */
  goalDays: number
  /** A freeze covered yesterday (show "a freeze saved your streak"). */
  frozenToday: boolean
  /** The broken streak can still be repaired. */
  repairable: boolean
  /** When repair is no longer possible (ms), or null. */
  repairDeadline: number | null
  /** The streak a repair would bring back (0 when not repairable). */
  repairFrom: number
  /** Sessions still needed to repair (0, 1 or 2). */
  repairSessionsLeft: number
  /** The remaining repair session must be a full one (a quick session will not do). */
  repairNeedsFull: boolean
  state: StreakState
  /** Not yet practised today while a streak is running. */
  atRisk: boolean
}

export const MAX_FREEZES = 2
export const GOAL_DAYS_PER_FREEZE = 7
const DAY = 86_400_000

/** Local midnight of a YYYY-MM-DD day, in ms. */
export function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Whole days from a to b (b later is positive), robust to daylight saving. */
export function dayDiff(a: string, b: string): number {
  return Math.round((dayStart(b) - dayStart(a)) / DAY)
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(y, m - 1, d + n)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

/** Deadline for repairing a streak whose first uncovered missed day was `day`: 48 h after that day ends. */
const repairDeadlineFor = (firstUncoveredMissed: string) => dayStart(addDays(firstUncoveredMissed, 1)) + 2 * DAY

/** Where the streak stands on `today`, before any session today. */
export function streakStatusOf(s: StreakFields, today: string, now = Date.now()): StreakStatus {
  const freezes = Math.max(0, Math.min(MAX_FREEZES, s.freezes ?? 0))
  const best = Math.max(s.longestStreak ?? 0, s.streak ?? 0)
  const base = {
    best,
    freezes,
    goalDays: Math.min(GOAL_DAYS_PER_FREEZE, s.goalDays ?? 0),
    frozenToday: !!s.frozenDays?.includes(addDays(today, -1)),
  }
  const open = s.repair && s.repair.deadline > now && !repairDone(s.repair) ? s.repair : null
  const repairExtra = open
    ? { repairable: true, repairDeadline: open.deadline, repairFrom: open.oldStreak, repairSessionsLeft: repairLeft(open), repairNeedsFull: fullOf(open) < 1 && open.sessions >= 1 }
    : { repairable: false, repairDeadline: null, repairFrom: 0, repairSessionsLeft: 0, repairNeedsFull: false }

  const last = s.lastPracticeDay
  if (!last || !s.streak) return { ...base, ...repairExtra, streak: 0, state: open ? 'repairable' : 'none', atRisk: false }
  const missed = dayDiff(last, today) - 1
  if (missed < 0) return { ...base, ...repairExtra, streak: s.streak, state: open ? 'repairable' : 'done', atRisk: false }
  if (missed === 0) return { ...base, ...repairExtra, streak: s.streak, state: open ? 'repairable' : 'alive', atRisk: true }
  if (missed === 1 && freezes > 0) return { ...base, ...repairExtra, streak: s.streak, state: 'frozen', atRisk: true }

  // Broken. Repairable if within 48 h of the first missed day a freeze could not cover.
  const firstUncovered = addDays(last, freezes > 0 ? 2 : 1)
  const deadline = repairDeadlineFor(firstUncovered)
  if (s.streak >= 2 && now < deadline)
    return { ...base, streak: 0, state: 'repairable', atRisk: false, repairable: true, repairDeadline: deadline, repairFrom: s.streak, repairSessionsLeft: 2, repairNeedsFull: false }
  return { ...base, ...repairExtra, streak: 0, state: open ? 'repairable' : 'none', atRisk: false }
}

export interface SessionStreakUpdate {
  /** Fields to merge into the summary. */
  fields: Pick<StreakFields, 'streak' | 'longestStreak' | 'lastPracticeDay' | 'freezes' | 'frozenDays' | 'repair'>
  /** The streak after this session. */
  streak: number
  /** The streak grew today (first session of the day, or a repair). */
  increased: boolean
  usedFreeze: boolean
  repaired: boolean
}

/** Apply one completed session of `kind` on `today` to the streak. */
export function applySession(s: StreakFields, today: string, now = Date.now(), kind?: string): SessionStreakUpdate {
  const status = streakStatusOf(s, today, now)
  let freezes = status.freezes
  let frozenDays = [...(s.frozenDays ?? [])]
  let repair: Repair | null = s.repair && s.repair.deadline > now && !repairDone(s.repair) ? { ...s.repair, full: fullOf(s.repair) } : null
  let usedFreeze = false
  let repaired = false
  const already = s.lastPracticeDay === today
  let streak: number

  if (already) streak = s.streak
  else if (status.state === 'alive') streak = s.streak + 1
  else if (status.state === 'frozen') {
    freezes -= 1
    frozenDays = [...frozenDays, addDays(today, -1)].slice(-14)
    usedFreeze = true
    streak = s.streak + 1
  } else if (status.state === 'repairable' && !repair) {
    // First session after a repairable break: start a fresh streak and open the repair.
    if (freezes > 0 && s.lastPracticeDay && dayDiff(s.lastPracticeDay, today) >= 3) {
      freezes -= 1
      frozenDays = [...frozenDays, addDays(s.lastPracticeDay, 1)].slice(-14)
      usedFreeze = true
    }
    repair = { oldStreak: status.repairFrom, deadline: status.repairDeadline!, sessions: 0, full: 0 }
    streak = 1
  } else streak = s.lastPracticeDay === addDays(today, -1) ? s.streak + 1 : 1

  if (repair) {
    repair.sessions += 1
    if (repairsStreak(kind)) repair.full = fullOf(repair) + 1
    if (repairDone(repair)) {
      streak = repair.oldStreak + streak
      repair = null
      repaired = true
    }
  }
  return {
    fields: { streak, longestStreak: Math.max(s.longestStreak ?? 0, streak), lastPracticeDay: today, freezes, frozenDays, repair },
    streak,
    increased: !already || repaired,
    usedFreeze,
    repaired,
  }
}

/** Count today toward the next freeze when the daily goal is first met today. */
export function applyGoalDay(s: StreakFields, today: string): Pick<StreakFields, 'goalDays' | 'goalDay' | 'freezes'> & { earnedFreeze: boolean } {
  if (s.goalDay === today) return { goalDays: s.goalDays ?? 0, goalDay: s.goalDay, freezes: s.freezes ?? 0, earnedFreeze: false }
  let freezes = Math.min(MAX_FREEZES, s.freezes ?? 0)
  // Holding the maximum: nothing accumulates, so a spent freeze takes 7 fresh goal days to refill.
  if (freezes >= MAX_FREEZES) return { goalDays: 0, goalDay: today, freezes, earnedFreeze: false }
  let goalDays = Math.min(GOAL_DAYS_PER_FREEZE, (s.goalDays ?? 0) + 1)
  let earnedFreeze = false
  if (goalDays >= GOAL_DAYS_PER_FREEZE && freezes < MAX_FREEZES) {
    freezes += 1
    goalDays = 0
    earnedFreeze = true
  }
  return { goalDays, goalDay: today, freezes, earnedFreeze }
}

/** For reminders: the streak to mention tonight and how to word it. */
export function reminderStreak(s: StreakFields | null, today: string, now = Date.now()) {
  if (!s) return { streak: 0, state: 'none' as StreakState, best: 0, repairSessionsLeft: 0, repairDeadline: null as number | null, practisedToday: false }
  const st = streakStatusOf(s, today, now)
  return {
    streak: st.state === 'repairable' ? st.repairFrom : st.streak,
    state: st.state,
    best: st.best,
    repairSessionsLeft: st.repairSessionsLeft,
    repairDeadline: st.repairDeadline,
    practisedToday: s.lastPracticeDay === today,
  }
}
