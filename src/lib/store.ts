// App-wide state and navigation. Screens read from here and call these actions.
import { create } from 'zustand'
import { trackById, type Speaker } from '../content/index.ts'
import type { TrackId } from '../content/types.ts'
import { planWeek } from '../content/plan.ts'
import { setSfx } from './audio.ts'
import { getKV, localDay, setKV, type LessonProgress, type Summary } from './db.ts'
import { buildLesson, buildMistakes, buildPractice, buildSpeedRound, type LessonPlan } from './engine.ts'
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

  async init() {
    const profile = { ...DEFAULT_PROFILE, ...(await getKV<Partial<Profile>>('profile', {})) }
    let focus = await getKV<Focus>('focus', DEFAULT_FOCUS)
    if (focus.until < localDay()) focus = DEFAULT_FOCUS
    applyTheme(profile.theme)
    setSfx(profile.sfx)
    set({ profile, focus })
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
    const { profile } = get()
    const trackId = lessonId.split('.')[0] as TrackId
    const review = await reviewPool(trackId === 'azbuka' ? null : trackId, [], 3)
    const plan = buildLesson(lessonId, level, profile.speaker, review)
    get().go({ name: 'session', plan, trackId, sessionId: newSessionId(), start: Date.now() })
  },

  async startPractice() {
    const ids = await dueItems(12)
    const fallback = ids.length >= 4 ? ids : [...ids, ...(await learnedWordIds())].slice(0, 12)
    if (!fallback.length) return
    // Lean on the skills the learner finds hardest.
    const weak = weakTypes(await db.events.where('ts').above(Date.now() - 30 * 86_400_000).toArray())
    get().go({ name: 'session', plan: buildPractice(fallback, get().profile.speaker, weak), trackId: get().viewTrack, sessionId: newSessionId(), start: Date.now() })
  },

  async startMistakes() {
    const ids = await recentMistakes(12)
    if (!ids.length) return
    get().go({ name: 'session', plan: buildMistakes(ids, get().profile.speaker), trackId: get().viewTrack, sessionId: newSessionId(), start: Date.now() })
  },

  async startSpeedRound() {
    const ids = await learnedWordIds()
    if (ids.length < 5) return
    get().go({ name: 'session', plan: buildSpeedRound(ids, get().profile.speaker), trackId: get().viewTrack, sessionId: newSessionId(), start: Date.now() })
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
}))

/** Track metadata helper for screens. */
export const trackMeta = (id: TrackId) => trackById.get(id)!
