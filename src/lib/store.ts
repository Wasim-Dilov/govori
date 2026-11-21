// App-wide state and navigation. Screens read from here and call these actions.
import { create } from 'zustand'
import { lessonById, trackById, type Speaker } from '../content/index.ts'
import type { TrackId } from '../content/types.ts'
import { planWeek, setPlanProgressCheck } from '../content/plan.ts'
import { bulgarianVoiceStatus, hasClip, manifestReady, setSfx, unlockAudio } from './audio.ts'
import { getKV, localDay, setKV, type LessonProgress, type Summary } from './db.ts'
import { buildLesson, buildMistakes, buildPractice, buildReview, buildSpeedRound, type BuildEnv, type LessonPlan } from './engine.ts'
import {
  DEFAULT_GOAL,
  DEFAULT_SUMMARY,
  allLessonProgress,
  dueItems,
  finishSession as persistFinish,
  getSummary,
  learnedCount,
  lettersLearnedCount,
  learnedWordIds,
  lessonReview,
  migrateGoal,
  newSessionId,
  nextLesson,
  recentMistakes,
  saveSummary,
  strongestItemIds,
  todayReview,
  todayReviewIds,
  type SessionResult,
  hasUnitDone,
} from './progress.ts'
import { dayDiff, streakStatusOf, type StreakStatus } from './streak.ts'
import type { StudyItem } from '../content/index.ts'
import { clearBadge } from './push.ts'
import { weakTypes } from './insights.ts'
import { db } from './db.ts'
import { checkMilestones } from './milestones.ts'
import { completeMission as persistMission, todayMission, type Mission } from './missions.ts'
import { addOurPhrase as persistOurPhrase, loadOurPhrases, removeOurPhrase as deleteOurPhrase, type NewPhrase } from './custom.ts'
import { WARMUP_MAX } from './suggest.ts'

export interface Profile {
  name: string
  /** Bulgarian changes some words by the speaker's gender ("уморен" / "уморена"). */
  speaker: Speaker
  /** XP a day; one of GOAL_OPTIONS in progress.ts (15, 30 or 45). */
  dailyGoal: number
  onboarded: boolean
  theme: 'system' | 'light' | 'dark'
  sfx: boolean
  /** Show Latin transliteration under Bulgarian. */
  translit: boolean
  /** Allow speaking exercises (microphone). */
  speaking: boolean
  startedAt: number
}

/** What to learn: one track, or follow the 12-week plan, for today or for this week. */
export interface Focus {
  track: TrackId | 'plan'
  scope: 'day' | 'week'
  /** Last local day (YYYY-MM-DD) this focus applies to. After it, focus returns to the plan. */
  until: string
}

export type Screen =
  | { name: 'home' }
  | { name: 'letters' }
  | { name: 'stats' }
  | { name: 'me' }
  | { name: 'onboarding' }
  /** "Quiz me": she runs it with his phone. */
  | { name: 'quiz' }
  | { name: 'session'; plan: LessonPlan; trackId: TrackId; sessionId: string; start: number }
  | { name: 'complete'; result: SessionResult }

export type Tab = 'home' | 'letters' | 'stats' | 'me'

/** Shown once after he has been away 3+ days. */
export interface WelcomeBack {
  daysAway: number
  bestStreak: number
  /** The track he was last working in (focus is moved back to it). */
  lastTrackId: TrackId | null
  /** Words he knows best: the 2-minute welcome-back review uses these. */
  strongestItemIds: string[]
}

const DEFAULT_PROFILE: Profile = {
  name: '',
  speaker: 'm',
  dailyGoal: DEFAULT_GOAL,
  onboarded: false,
  theme: 'system',
  sfx: true,
  translit: true,
  speaking: true,
  startedAt: Date.now(),
}

const DEFAULT_FOCUS: Focus = { track: 'plan', scope: 'week', until: '9999-12-31' }
const DAY = 86_400_000

interface State {
  ready: boolean
  profile: Profile
  summary: Summary
  focus: Focus
  progress: Record<string, LessonProgress>
  learned: number
  /** Cyrillic letters met so far. */
  lettersLearned: number
  /** Today's review, bounded (at most 15 a day). Show this, never the raw backlog. Same as reviewToday. */
  dueCount: number
  /** Today's review left, bounded (at most 15 a day). */
  reviewToday: number
  /** Rough minutes for today's review. */
  reviewMinutes: number
  mistakesCount: number
  /** Streak, freezes and repair state. */
  streak: StreakStatus
  /** Set after a lapse of 3+ days until he starts or dismisses the welcome back. */
  welcome: WelcomeBack | null
  /** Today's "Say it to her" mission. */
  mission: Mission | null
  screen: Screen
  /** The track shown on the home path. */
  viewTrack: TrackId
  /** A short message shown at the bottom of the screen for a few seconds. */
  toast: { id: number; text: string } | null
  /** Whether the phone can speak Bulgarian (null until checked). */
  voice: boolean | null

  /** Re-check the Bulgarian voice (e.g. after he downloads it). */
  checkVoice(): Promise<boolean>

  init(): Promise<void>
  refresh(): Promise<void>
  go(screen: Screen): void
  goTab(tab: Tab): void
  setProfile(p: Partial<Profile>): Promise<void>
  setFocus(track: TrackId | 'plan', scope: 'day' | 'week'): Promise<void>
  setViewTrack(t: TrackId): void
  /** The track the learner should be on today (focus, else the plan week). */
  focusTrack(): TrackId
  startLesson(lessonId: string, level: number): Promise<void>
  startPractice(): Promise<void>
  startMistakes(): Promise<void>
  startSpeedRound(): Promise<void>
  /** A short review (at most 10 due items, about 2 minutes) that continues straight into `then`. */
  startWarmup(then?: { lessonId: string; level: number } | null): Promise<void>
  /** The one-minute session from a reminder: 5 due items, or one speed round. Counts for the streak. */
  startQuick(): Promise<void>
  /** The 2-minute review of his strongest words after a lapse. */
  startWelcomeBack(): Promise<void>
  dismissWelcome(): Promise<void>
  /** He said today's phrase to her: +5 XP, logged as speaking. */
  completeMission(): Promise<void>
  /** Record a finished "Quiz me" round as a session (counts for the streak) and show the summary. */
  finishQuiz(stats: { sessionId: string; start: number; correct: number; total: number }): Promise<SessionResult | null>
  addOurPhrase(p: NewPhrase): Promise<StudyItem | null>
  removeOurPhrase(id: string): Promise<void>
  finish(stats: { correct: number; total: number }): Promise<void>
  quitSession(): void
  showToast(text: string): void
}

function applyTheme(theme: Profile['theme']) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

const endOfWeek = () => {
  const d = new Date()
  const toSunday = (7 - d.getDay()) % 7
  d.setDate(d.getDate() + toSunday)
  return localDay(d)
}

/** A warm-up continues into this lesson when it finishes; its result is folded into the lesson's. */
let chain: { lessonId: string; level: number } | null = null
let carry: Pick<SessionResult, 'streakIncreased' | 'goalReached' | 'usedFreeze' | 'repaired' | 'earnedFreeze' | 'milestones' | 'xp'> | null = null
let listening = false
/** init() runs once even if called twice (React StrictMode calls effects twice in development). */
let initOnce: Promise<void> | null = null

export const useApp = create<State>((set, get) => ({
  ready: false,
  profile: DEFAULT_PROFILE,
  summary: DEFAULT_SUMMARY,
  focus: DEFAULT_FOCUS,
  progress: {},
  learned: 0,
  lettersLearned: 0,
  dueCount: 0,
  reviewToday: 0,
  reviewMinutes: 0,
  mistakesCount: 0,
  streak: streakStatusOf(DEFAULT_SUMMARY, localDay()),
  welcome: null,
  mission: null,
  screen: { name: 'home' },
  viewTrack: 'azbuka',
  toast: null,
  voice: null,

  async checkVoice() {
    const voice = await bulgarianVoiceStatus()
    set({ voice })
    return voice
  },

  init() {
    initOnce ??= initApp()
    return initOnce
  },

  async refresh() {
    const [summary, progress, learned, letters, review, mistakes] = await Promise.all([getSummary(), allLessonProgress(), learnedCount(), lettersLearnedCount(), todayReview(), recentMistakes(50)])
    const mission = get().profile.onboarded ? await todayMission(get().profile.speaker).catch(() => null) : null
    // The 12-week plan only moves on once the current week's track has a finished unit.
    setPlanProgressCheck((t) => hasUnitDone(t, progress))
    set({
      summary,
      progress,
      learned,
      lettersLearned: letters,
      dueCount: review.count,
      reviewToday: review.count,
      reviewMinutes: review.minutes,
      mistakesCount: mistakes.length,
      streak: streakStatusOf(summary, localDay()),
      mission,
    })
  },

  go(screen) {
    set({ screen })
    window.scrollTo({ top: 0 })
  },

  goTab(tab) {
    get().go({ name: tab } as Screen)
  },

  async setProfile(p) {
    const profile = { ...get().profile, ...p }
    // Older screens may still offer 20/40/60 XP: map them to 15/30/45.
    if (p.dailyGoal !== undefined) profile.dailyGoal = migrateGoal(p.dailyGoal)
    set({ profile })
    applyTheme(profile.theme)
    setSfx(profile.sfx)
    await setKV('profile', profile)
    if (p.name !== undefined || p.dailyGoal !== undefined) {
      const s = { ...(await getSummary()), name: profile.name, dailyGoal: profile.dailyGoal }
      set({ summary: s })
      await saveSummary(s)
    }
  },

  async setFocus(track, scope) {
    const focus: Focus = { track, scope, until: track === 'plan' ? '9999-12-31' : scope === 'day' ? localDay() : endOfWeek() }
    set({ focus, viewTrack: track === 'plan' ? planWeek(get().profile.startedAt).focus : track })
    await setKV('focus', focus)
  },

  setViewTrack(t) {
    set({ viewTrack: t })
  },

  focusTrack() {
    const { focus, profile } = get()
    return focus.track === 'plan' ? planWeek(profile.startedAt).focus : focus.track
  },

  async startLesson(lessonId, level) {
    unlockAudio()
    const { profile } = get()
    const trackId = lessonId.split('.')[0] as TrackId
    // Two due items from this track and one from another (interleaving).
    const review = await lessonReview(trackId === 'azbuka' ? null : trackId, [], 3)
    let plan: LessonPlan
    try {
      plan = buildLesson(lessonId, level, profile.speaker, review, await buildEnv())
    } catch {
      return get().showToast("That lesson couldn't be opened. Try another one.")
    }
    startPlan(plan, trackId, 'That lesson has nothing to practise yet.')
  },

  async startPractice() {
    unlockAudio()
    // Today's bounded review first; if he asks for more, more due items; then anything learned.
    const today = await todayReviewIds(12)
    const ids = today.length ? today : await dueItems(12)
    const fallback = ids.length >= 4 ? ids : [...new Set([...ids, ...(await learnedWordIds())])].slice(0, 12)
    if (!fallback.length) return get().showToast('Nothing to review yet. Finish a lesson first.')
    // Lean on the skills the learner finds hardest.
    const weak = weakTypes(await db.events.where('ts').above(Date.now() - 30 * DAY).toArray())
    startPlan(buildPractice(fallback, get().profile.speaker, weak, await buildEnv()), get().viewTrack, 'Nothing to review yet. Finish a lesson first.')
  },

  async startMistakes() {
    unlockAudio()
    const ids = await recentMistakes(12)
    if (!ids.length) return get().showToast('No mistakes to fix. Nice work.')
    startPlan(buildMistakes(ids, get().profile.speaker, await buildEnv()), get().viewTrack, 'No mistakes to fix. Nice work.')
  },

  async startSpeedRound() {
    unlockAudio()
    const ids = await learnedWordIds()
    if (ids.length < 5) return get().showToast('Learn at least 5 words to unlock the speed round.')
    startPlan(buildSpeedRound(ids, get().profile.speaker), get().viewTrack, 'Learn at least 5 words to unlock the speed round.')
  },

  async startWarmup(then) {
    unlockAudio()
    const ids = await todayReviewIds(WARMUP_MAX)
    if (!ids.length) {
      // Nothing due after all: go straight to the lesson.
      if (then) return get().startLesson(then.lessonId, then.level)
      return get().showToast('Nothing to warm up today. Straight to the lesson.')
    }
    chain = then ?? null
    const plan = buildReview(ids, get().profile.speaker, { kind: 'warmup', max: WARMUP_MAX, match: false }, await buildEnv())
    startPlan(plan, then ? (then.lessonId.split('.')[0] as TrackId) : get().viewTrack, 'Nothing to warm up today.')
  },

  async startQuick() {
    unlockAudio()
    const { profile } = get()
    const env = await buildEnv()
    const due = await todayReviewIds(5)
    if (due.length >= 5) return startPlan(buildReview(due, profile.speaker, { kind: 'quick', max: 5, match: false }, env), get().viewTrack, '')
    const learned = await learnedWordIds()
    if (learned.length >= 5) {
      const speed = buildSpeedRound(learned, profile.speaker)
      return startPlan({ ...speed, kind: 'quick', exercises: speed.exercises.slice(0, 1) }, get().viewTrack, '')
    }
    const few = [...new Set([...due, ...learned])]
    if (few.length) return startPlan(buildReview(few, profile.speaker, { kind: 'quick', max: 5, match: false }, env), get().viewTrack, '')
    // Brand new: the first lesson of the focus track is the one-minute start.
    const next = nextLesson(trackById.get(get().focusTrack())!, get().progress)
    if (next) return get().startLesson(next.lesson.id, next.level)
    get().showToast('Pick a lesson to start.')
  },

  async startWelcomeBack() {
    unlockAudio()
    const w = get().welcome
    await setKV('welcomeSeen', localDay())
    set({ welcome: null })
    const ids = w?.strongestItemIds.length ? w.strongestItemIds : (await learnedWordIds()).slice(0, 8)
    if (!ids.length) return
    startPlan(
      buildReview(ids, get().profile.speaker, { kind: 'welcome', max: 8, match: false, prefer: ['mc_bg_en', 'mc_en_bg', 'listen_mc'] }, await buildEnv()),
      w?.lastTrackId ?? get().viewTrack,
      'Nothing to review yet.',
    )
  },

  async dismissWelcome() {
    await setKV('welcomeSeen', localDay())
    set({ welcome: null })
  },

  async completeMission() {
    const done = await persistMission(get().profile.speaker)
    if (!done) return
    await get().refresh()
    get().showToast(done.earnedFreeze ? `+${done.xp} XP. You earned a streak freeze.` : `+${done.xp} XP. Браво!`)
  },

  async finishQuiz({ sessionId, start, correct, total }) {
    if (!total) return null
    const result = await persistFinish({ sessionId, kind: 'quiz', lessonId: '', trackId: 'love', level: 0, start, correct, total, newItems: [], speaker: get().profile.speaker })
    result.milestones = await checkMilestones(result)
    clearBadge()
    await get().refresh()
    get().go({ name: 'complete', result })
    return result
  },

  async addOurPhrase(p) {
    try {
      const item = await persistOurPhrase(p)
      await get().refresh()
      return item
    } catch (e) {
      get().showToast(e instanceof Error ? e.message : 'That phrase could not be saved.')
      return null
    }
  },

  async removeOurPhrase(id) {
    await deleteOurPhrase(id)
    await get().refresh()
  },

  async finish({ correct, total }) {
    const s = get().screen
    if (s.name !== 'session') return
    const result = await persistFinish({
      sessionId: s.sessionId,
      kind: s.plan.kind,
      lessonId: s.plan.lesson?.id ?? '',
      trackId: s.trackId,
      level: s.plan.level,
      start: s.start,
      correct,
      total,
      newItems: s.plan.newItems as StudyItem[],
      speaker: get().profile.speaker,
    })
    result.milestones = await checkMilestones(result)
    clearBadge()
    await get().refresh()

    // A warm-up rolls straight into the lesson it was for; its gains show on that lesson's summary.
    if (s.plan.kind === 'warmup' && chain) {
      const next = chain
      chain = null
      carry = {
        streakIncreased: result.streakIncreased,
        goalReached: result.goalReached,
        usedFreeze: result.usedFreeze,
        repaired: result.repaired,
        earnedFreeze: result.earnedFreeze,
        milestones: result.milestones,
        xp: result.xp,
      }
      await get().startLesson(next.lessonId, next.level)
      if (get().screen.name === 'session') return
      carry = null
    }
    if (carry) {
      result.streakIncreased ||= carry.streakIncreased
      result.goalReached ||= carry.goalReached
      result.usedFreeze ||= carry.usedFreeze
      result.repaired ||= carry.repaired
      result.earnedFreeze ||= carry.earnedFreeze
      result.milestones = [...(carry.milestones ?? []), ...(result.milestones ?? [])]
      result.xp += carry.xp
      carry = null
    }
    get().go({ name: 'complete', result })
  },

  quitSession() {
    chain = null
    carry = null
    void get().refresh()
    get().go({ name: 'home' })
  },

  showToast(text) {
    const id = Date.now()
    set({ toast: { id, text } })
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null })
    }, 3200)
  },
}))

/** Startup: profile, goal migration, custom phrases, lapse handling, then the first screen. */
async function initApp() {
  const get = useApp.getState
  const set = useApp.setState
  // A reminder opened the app with ?quick=1: remember it and clean the address at once.
  const params = new URLSearchParams(window.location.search)
  const quick = params.get('quick') === '1'
  if (quick) {
    params.delete('quick')
    const q = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash)
  }

  const stored = await getKV<Partial<Profile>>('profile', {})
  const profile = { ...DEFAULT_PROFILE, ...stored }
  // Goals moved from 20/40/60 to 15/30/45 XP so the minutes are honest.
  const goal = migrateGoal(profile.dailyGoal)
  if (stored.dailyGoal !== undefined && goal !== stored.dailyGoal) {
    profile.dailyGoal = goal
    await setKV('profile', profile)
  }
  const sum = await getSummary()
  if (sum.dailyGoal !== profile.dailyGoal) await saveSummary({ ...sum, dailyGoal: profile.dailyGoal })
  let focus = await getKV<Focus>('focus', DEFAULT_FOCUS)
  if (focus.until < localDay()) focus = DEFAULT_FOCUS
  applyTheme(profile.theme)
  setSfx(profile.sfx)
  set({ profile, focus })
  await loadOurPhrases()
  void get().checkVoice()

  if (profile.onboarded) await handleLapse()
  await get().refresh()
  const quickFirst = quick && get().profile.onboarded
  if (quickFirst) {
    // Opened from a reminder: stay on the loading mark until the quick session is ready, so Home never flashes.
    set({ viewTrack: get().focusTrack() })
    try {
      await get().startQuick()
    } catch {
      // Fall through to Home.
    }
    set({ ready: true, ...(get().screen.name === 'session' ? {} : { screen: { name: 'home' as const } }) })
  } else set({ ready: true, viewTrack: get().focusTrack(), screen: get().profile.onboarded ? { name: 'home' } : { name: 'onboarding' } })

  // Reminders: the service worker posts this when the app is already open.
  if (!listening && 'serviceWorker' in navigator) {
    listening = true
    navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
      const st = get()
      if (e.data?.type === 'govori-quick' && st.ready && st.profile.onboarded && st.screen.name !== 'session' && st.screen.name !== 'onboarding') void st.startQuick()
    })
  }
}

/**
 * After 3+ days away: offer a welcome back, pause the 12-week plan for the time away (so he
 * resumes his week rather than skipping ahead), and put the focus back on the track he was in.
 * Runs at most once per lapse (kv "lapseHandled" holds the last practice day it handled).
 */
async function handleLapse() {
  const summary = await getSummary()
  const last = summary.lastPracticeDay
  if (!last) return
  const today = localDay()
  const daysAway = dayDiff(last, today)
  if (daysAway < 3) return
  const { profile, focus } = useApp.getState()
  const lastSession = (await db.sessions.orderBy('start').reverse().limit(20).toArray()).find((s) => s.completed && (s.kind === 'lesson' || s.kind === 'letters' || s.kind === 'story'))
  const lastTrackId = (lastSession ? lessonById.get(lastSession.lessonId)?.trackId : null) ?? null

  if ((await getKV<string | null>('lapseHandled', null)) !== last) {
    await setKV('lapseHandled', last)
    // Pause the plan: the days away don't count toward the 12 weeks.
    const startedAt = profile.startedAt + (daysAway - 1) * DAY
    useApp.setState({ profile: { ...profile, startedAt } })
    await setKV('profile', { ...profile, startedAt })
    if (lastTrackId && focus.track === 'plan' && planWeek(startedAt).focus !== lastTrackId) await useApp.getState().setFocus(lastTrackId, 'week')
  }
  if ((await getKV<string | null>('welcomeSeen', null)) === today) return
  const welcome: WelcomeBack = {
    daysAway,
    bestStreak: Math.max(summary.longestStreak, summary.streak),
    lastTrackId,
    strongestItemIds: await strongestItemIds(8),
  }
  useApp.setState({ welcome })
}

/** Exported for the Home screen: whether the welcome back applies now (same rule the store uses). */
export function welcomeBack(): WelcomeBack | null {
  return useApp.getState().welcome
}

/** What the engine needs to pick fair options and avoid exercises this phone can't play. */
async function buildEnv(): Promise<BuildEnv> {
  const [known, recorded] = await Promise.all([
    db.memory.toCollection().primaryKeys().catch(() => [] as string[]),
    db.recordings.toCollection().primaryKeys().catch(() => [] as string[]),
  ])
  const cached = useApp.getState().voice
  const voice = cached ?? (await useApp.getState().checkVoice())
  await manifestReady()
  return {
    known: new Set(known as string[]),
    recorded: new Set(recorded as string[]),
    voice,
    hasClip: (text: string) => hasClip(text),
    speaking: useApp.getState().profile.speaking,
  }
}

/** Open a session, or explain why there is nothing to do instead of showing an empty screen. */
function startPlan(plan: LessonPlan, trackId: TrackId, emptyMessage: string): void {
  const { go, showToast } = useApp.getState()
  if (!plan.exercises.length) {
    chain = null
    return showToast(emptyMessage || 'Nothing to practise right now.')
  }
  go({ name: 'session', plan, trackId, sessionId: newSessionId(), start: Date.now() })
}

/** Track metadata helper for screens. */
export const trackMeta = (id: TrackId) => trackById.get(id)!

export type { Summary }
