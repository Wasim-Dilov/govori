// App-wide state and navigation. Screens read from here and call these actions.
import { create } from 'zustand'
import { trackById, type Speaker } from '../content/index.ts'
import type { TrackId } from '../content/types.ts'
import { planWeek } from '../content/plan.ts'
import { bulgarianVoiceStatus, setSfx, unlockAudio } from './audio.ts'
import { getKV, localDay, setKV, type LessonProgress, type Summary } from './db.ts'
import { buildLesson, buildMistakes, buildPractice, buildSpeedRound, type BuildEnv, type LessonPlan } from './engine.ts'
import {
  DEFAULT_SUMMARY,
  allLessonProgress,
  dueItems,
  finishSession as persistFinish,
  getSummary,
  learnedCount,
  learnedWordIds,
  newSessionId,
  recentMistakes,
  reviewPool,
  saveSummary,
  type SessionResult,
} from './progress.ts'
import type { StudyItem } from '../content/index.ts'
import { clearBadge } from './push.ts'
import { weakTypes } from './insights.ts'
import { db } from './db.ts'

export interface Profile {
  name: string
  /** Bulgarian changes some words by the speaker's gender ("уморен" / "уморена"). */
  speaker: Speaker
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
  | { name: 'session'; plan: LessonPlan; trackId: TrackId; sessionId: string; start: number }
  | { name: 'complete'; result: SessionResult }

export type Tab = 'home' | 'letters' | 'stats' | 'me'

const DEFAULT_PROFILE: Profile = {
  name: '',
  speaker: 'm',
  dailyGoal: 30,
  onboarded: false,
  theme: 'system',
  sfx: true,
  translit: true,
  speaking: true,
  startedAt: Date.now(),
}

const DEFAULT_FOCUS: Focus = { track: 'plan', scope: 'week', until: '9999-12-31' }

interface State {
  ready: boolean
  profile: Profile
  summary: Summary
  focus: Focus
  progress: Record<string, LessonProgress>
  learned: number
  dueCount: number
  mistakesCount: number
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

export const useApp = create<State>((set, get) => ({
  ready: false,
  profile: DEFAULT_PROFILE,
  summary: DEFAULT_SUMMARY,
  focus: DEFAULT_FOCUS,
  progress: {},
  learned: 0,
  dueCount: 0,
  mistakesCount: 0,
  screen: { name: 'home' },
  viewTrack: 'azbuka',
  toast: null,
  voice: null,

  async checkVoice() {
    const voice = await bulgarianVoiceStatus()
    set({ voice })
    return voice
  },

  async init() {
    const profile = { ...DEFAULT_PROFILE, ...(await getKV<Partial<Profile>>('profile', {})) }
    let focus = await getKV<Focus>('focus', DEFAULT_FOCUS)
    if (focus.until < localDay()) focus = DEFAULT_FOCUS
    applyTheme(profile.theme)
    setSfx(profile.sfx)
    set({ profile, focus })
    void get().checkVoice()
    await get().refresh()
    set({ ready: true, viewTrack: get().focusTrack(), screen: profile.onboarded ? { name: 'home' } : { name: 'onboarding' } })
  },

  async refresh() {
    const [summary, progress, learned, due, mistakes] = await Promise.all([getSummary(), allLessonProgress(), learnedCount(), dueItems(50), recentMistakes(50)])
    set({ summary, progress, learned, dueCount: due.length, mistakesCount: mistakes.length })
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
    set({ profile })
    applyTheme(profile.theme)
    setSfx(profile.sfx)
    await setKV('profile', profile)
    if (p.name !== undefined || p.dailyGoal !== undefined) {
      const s = { ...get().summary, name: profile.name, dailyGoal: profile.dailyGoal }
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
    const review = await reviewPool(trackId === 'azbuka' ? null : trackId, [], 3)
    let plan: LessonPlan
    try {
      plan = buildLesson(lessonId, level, profile.speaker, review, await buildEnv())
    } catch {
      return get().showToast("That lesson couldn't be opened. Try another one.")
    }
    startPlan(plan, trackId, "That lesson has nothing to practise yet.")
  },

  async startPractice() {
    unlockAudio()
    const ids = await dueItems(12)
    const fallback = ids.length >= 4 ? ids : [...new Set([...ids, ...(await learnedWordIds())])].slice(0, 12)
    if (!fallback.length) return get().showToast('Nothing to review yet. Finish a lesson first.')
    // Lean on the skills the learner finds hardest.
    const weak = weakTypes(await db.events.where('ts').above(Date.now() - 30 * 86_400_000).toArray())
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
    clearBadge()
    await get().refresh()
    get().go({ name: 'complete', result })
  },

  quitSession() {
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

/** What the engine needs to pick fair options and avoid exercises this phone can't play. */
async function buildEnv(): Promise<BuildEnv> {
  const [known, recorded] = await Promise.all([
    db.memory.toCollection().primaryKeys().catch(() => [] as string[]),
    db.recordings.toCollection().primaryKeys().catch(() => [] as string[]),
  ])
  const cached = useApp.getState().voice
  const voice = cached ?? (await useApp.getState().checkVoice())
  return { known: new Set(known as string[]), recorded: new Set(recorded as string[]), voice }
}

/** Open a session, or explain why there is nothing to do instead of showing an empty screen. */
function startPlan(plan: LessonPlan, trackId: TrackId, emptyMessage: string) {
  const { go, showToast } = useApp.getState()
  if (!plan.exercises.length) return showToast(emptyMessage)
  go({ name: 'session', plan, trackId, sessionId: newSessionId(), start: Date.now() })
}

/** Track metadata helper for screens. */
export const trackMeta = (id: TrackId) => trackById.get(id)!
