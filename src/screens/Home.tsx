import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useApp, trackMeta } from '../lib/store.ts'
import { learnedWordIds, lessonStates, practicedToday, trackCompletion, xpToday, type NodeState } from '../lib/progress.ts'
import { suggestNext, todayMeta, type TodayMeta } from '../lib/suggest.ts'
import { db, getKV, localDay, setKV } from '../lib/db.ts'
import { dialogueById, maxLevel, study, tracks, unitById, type LessonView, type TrackView } from '../content/index.ts'
import { planWeek } from '../content/plan.ts'
import { TopBar, GoalRing, LargeTitle } from '../components/TopBar.tsx'
import { BottomSheet, FocusSheet, TrackBadge, lessonsDone } from '../components/FocusSheet.tsx'
import { IconChat, IconCheck, IconLock, IconSpeaker } from '../components/Icons.tsx'
import { clipCount, manifestReady, sfx, speak } from '../lib/audio.ts'
import { speedRounds } from '../lib/engine.ts'
import './home.css'

export function HomeScreen() {
  const viewTrack = useApp((s) => s.viewTrack)
  const [focusOpen, setFocusOpen] = useState(false)
  const [sheetLesson, setSheetLesson] = useState<LessonView | null>(null)
  const track = trackMeta(viewTrack)

  useEffect(() => {
    void protectStorage()
  }, [])

  return (
    <div className="screen has-navbar home">
      <TopBar />
      <LargeTitle>Learn</LargeTitle>
      <TodayCard onChangeFocus={() => setFocusOpen(true)} />
      <VoiceCard />
      <PracticeRow />
      <TrackChips onAll={() => setFocusOpen(true)} />
      <Path track={track} onOpen={setSheetLesson} />
      <FocusSheet open={focusOpen} onClose={() => setFocusOpen(false)} />
      <NodeSheet lesson={sheetLesson} onClose={() => setSheetLesson(null)} />
    </div>
  )
}

/**
 * Ask iOS to keep Govori's data even when the phone runs low on space. Asked once on first
 * launch; if it was refused, asked again after a week. The answer is kept in kv "persist".
 */
async function protectStorage() {
  try {
    if (!navigator.storage?.persist) return
    const prev = await getKV<{ granted: boolean; at: number } | null>('persist', null)
    if (prev && (prev.granted || Date.now() - prev.at < 7 * 86_400_000)) return
    const granted = (await navigator.storage.persisted?.()) || (await navigator.storage.persist())
    await setKV('persist', { granted, at: Date.now() })
  } catch {
    /* storage API unavailable: nothing to do */
  }
}

// ------------------------------------------------------------- Bulgarian voice

/**
 * Shown once when the phone has no Bulgarian voice: listening exercises are swapped for
 * reading ones until he downloads it. Dismissal is remembered in kv "voiceCard".
 */
function VoiceCard() {
  const voice = useApp((s) => s.voice)
  const checkVoice = useApp((s) => s.checkVoice)
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  const [testing, setTesting] = useState(false)
  const [found, setFound] = useState(false)
  // Microsoft voice clips make the phone's own Bulgarian voice unnecessary.
  const [clips, setClips] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    void manifestReady().then(() => live && setClips(clipCount()))
    getKV<string | null>('voiceCard', null).then((v) => live && setDismissed(v === 'dismissed'))
    // He may leave for Settings and come back with the voice downloaded.
    const onVisible = () => document.visibilityState === 'visible' && void checkVoice()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [checkVoice])

  // Only celebrate a voice that was missing and has now appeared.
  const wasMissing = useRef(false)
  useEffect(() => {
    if (voice === false) wasMissing.current = true
    else if (voice && wasMissing.current && dismissed === false) setFound(true)
  }, [voice, dismissed])

  if (clips !== 0 || dismissed !== false || (voice !== false && !found)) return null

  const dismiss = () => {
    setDismissed(true)
    void setKV('voiceCard', 'dismissed')
  }
  const test = async () => {
    setTesting(true)
    await speak('Здравей! Как си?')
    const ok = await checkVoice()
    setTesting(false)
    if (ok) setFound(true)
  }

  if (found)
    return (
      <section className="home-notice home-notice--ok gv-tone-pine" aria-live="polite">
        <div className="home-notice__head">
          <span className="gv-row__icon" aria-hidden="true">
            <IconCheck />
          </span>
          <div className="home-notice__text">
            <p className="home-notice__title">Bulgarian voice found</p>
            <p className="home-notice__body">Listening exercises are back on.</p>
          </div>
        </div>
        <div className="home-notice__actions">
          <button type="button" className="gv-btn gv-btn--sm gv-btn--tinted" onClick={dismiss}>
            Done
          </button>
        </div>
      </section>
    )

  return (
    <section className="home-notice" aria-labelledby="voice-title">
      <div className="home-notice__head">
        <span className="gv-row__icon" aria-hidden="true">
          <IconSpeaker />
        </span>
        <div className="home-notice__text">
          <p id="voice-title" className="home-notice__title">
            Add the Bulgarian voice
          </p>
          <p className="home-notice__body">Your iPhone needs it to read words out loud. Until then, listening exercises are swapped for reading ones.</p>
        </div>
      </div>
      <ol className="home-notice__steps">
        <li>Open the Settings app</li>
        <li>Accessibility, then Spoken Content, then Voices</li>
        <li>Choose Bulgarian and download a voice</li>
      </ol>
      <p className="home-notice__alt">Or ask your wife to record words for you in Me, under Her voice.</p>
      <div className="home-notice__actions">
        <button type="button" className="gv-btn gv-btn--sm gv-btn--tinted" onClick={() => void test()} disabled={testing}>
          {testing ? 'Listening…' : 'Test voice'}
        </button>
        <button type="button" className="gv-btn gv-btn--sm gv-btn--plain" onClick={dismiss}>
          Not now
        </button>
      </div>
    </section>
  )
}

// ------------------------------------------------------------- Today

function TodayCard({ onChangeFocus }: { onChangeFocus: () => void }) {
  const profile = useApp((s) => s.profile)
  const focus = useApp((s) => s.focus)
  const summary = useApp((s) => s.summary)
  const progress = useApp((s) => s.progress)
  const dueCount = useApp((s) => s.dueCount)
  const mistakesCount = useApp((s) => s.mistakesCount)
  const learned = useApp((s) => s.learned)
  const startLesson = useApp((s) => s.startLesson)
  const startPractice = useApp((s) => s.startPractice)
  const startMistakes = useApp((s) => s.startMistakes)
  const startSpeedRound = useApp((s) => s.startSpeedRound)
  const setViewTrack = useApp((s) => s.setViewTrack)
  const reduce = useReducedMotion()
  const [today, setToday] = useState<TodayMeta>({ sessionsToday: 0, lastWasNew: false })
  const [words, setWords] = useState(0)

  // What happened today decides whether to offer something new or a level-up.
  useEffect(() => {
    let live = true
    db.sessions
      .where('day')
      .equals(localDay())
      .toArray()
      .then((rows) => live && setToday(todayMeta(rows)))
      .catch(() => {})
    learnedWordIds().then((ids) => live && setWords(ids.length))
    return () => {
      live = false
    }
  }, [progress, learned])

  const week = planWeek(profile.startedAt)
  const plan = focus.track === 'plan'
  const trackId = focus.track === 'plan' ? week.focus : focus.track
  const track = trackMeta(trackId)
  const next = suggestNext(track, progress, today)
  const xp = xpToday(summary)
  const goal = profile.dailyGoal
  const eyebrow = plan ? `Week ${week.week} · ${week.title}` : `${focus.scope === 'day' ? 'Focus today' : 'Focus this week'} · ${track.title}`
  const also = plan && week.also ? trackMeta(week.also) : null

  // When the track is finished: review what's due, else a speed round, else fix mistakes.
  const review = !next ? (dueCount > 0 ? 'practice' : words >= 5 ? 'speed' : mistakesCount > 0 ? 'mistakes' : null) : null
  const label = next
    ? next.reason === 'levelup'
      ? `Start level ${next.level}`
      : next.reason === 'story'
        ? 'Play conversation'
        : (progress[next.lesson.id]?.level ?? 0) > 0
          ? `Continue · level ${next.level}`
          : 'Start lesson'
    : review === 'practice'
      ? 'Review this track'
      : review === 'speed'
        ? 'Play a speed round'
        : review === 'mistakes'
          ? 'Fix my mistakes'
          : 'Choose another track'

  const headline = next
    ? next.reason === 'levelup'
      ? `Level up: ${next.lesson.title}`
      : next.reason === 'story'
        ? `Conversation: ${next.lesson.title}`
        : `Next up: ${next.lesson.title}`
    : review
      ? `${track.title} is complete`
      : 'All caught up here'
  const subtitle = next ? next.lesson.titleBg : track.titleBg
  const detail = next
    ? next.reason === 'levelup'
      ? `Level ${next.level} of 3: same words, harder exercises.`
      : next.reason === 'story'
        ? (dialogueById.get(next.lesson.dialogueId ?? '')?.scene ?? 'Put this unit to work in a short conversation.')
        : plan
          ? week.goal
          : track.tagline
    : review
      ? 'Keep it fresh with a quick review.'
      : 'Pick another track to keep going.'

  const go = () => {
    sfx.tap()
    if (next) return void startLesson(next.lesson.id, next.level)
    if (review === 'practice') return void startPractice()
    if (review === 'speed') return void startSpeedRound()
    if (review === 'mistakes') return void startMistakes()
  }

  return (
    <motion.section
      className={`gv-card home-today gv-tone-${trackId}`}
      aria-labelledby="today-title"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <div className="home-today__top">
        <div className="home-today__text">
          <p className="home-today__eyebrow">{eyebrow}</p>
          <h2 id="today-title" className="home-today__title">
            {headline}
          </h2>
          <p lang="bg" className="home-today__bg">
            {subtitle}
          </p>
        </div>
        <div className="home-today__goal">
          <GoalRing value={xp} goal={goal} size={60} width={3} label={`${xp} of ${goal} XP today`}>
            <span className="home-today__xp">{xp}</span>
          </GoalRing>
          <span className="home-today__goalcap">of {goal} XP</span>
        </div>
      </div>
      {next?.reason === 'levelup' ? (
        <p className="home-today__detail">
          <LevelDots level={next.level - 1} />
          <span>{detail}</span>
        </p>
      ) : (
        <p className="home-today__detail">{detail}</p>
      )}
      <button type="button" className="gv-btn gv-btn--block" onClick={next || review ? go : onChangeFocus}>
        {label}
      </button>
      <div className="home-today__foot">
        {also ? (
          <button type="button" className="gv-btn gv-btn--plain gv-btn--sm gv-tone-rose" onClick={() => setViewTrack(also.id)}>
            <span className="home-today__also">Also: {also.title}</span>
          </button>
        ) : (
          <span />
        )}
        <button type="button" className="gv-btn gv-btn--plain gv-btn--sm gv-tone-rose" onClick={onChangeFocus}>
          Change focus
        </button>
      </div>
    </motion.section>
  )
}

function LevelDots({ level }: { level: number }) {
  return (
    <span className="home-dots" role="img" aria-label={`${level} of 3 levels done`}>
      {[1, 2, 3].map((n) => (
        <i key={n} className={n <= level ? 'on' : ''} />
      ))}
    </span>
  )
}

// ------------------------------------------------------------- practice tiles

function PracticeRow() {
  const dueCount = useApp((s) => s.dueCount)
  const mistakesCount = useApp((s) => s.mistakesCount)
  const learned = useApp((s) => s.learned)
  const startPractice = useApp((s) => s.startPractice)
  const startMistakes = useApp((s) => s.startMistakes)
  const startSpeedRound = useApp((s) => s.startSpeedRound)
  const [words, setWords] = useState(0)

  useEffect(() => {
    let live = true
    learnedWordIds().then((ids) => live && setWords(ids.length))
    return () => {
      live = false
    }
  }, [learned])

  const rounds = speedRounds(words)
  const cells = [
    { key: 'review', label: 'Review', value: dueCount, unit: 'due', disabled: learned === 0, run: startPractice },
    { key: 'mistakes', label: 'Mistakes', value: mistakesCount, unit: 'to fix', disabled: mistakesCount === 0, run: startMistakes },
    { key: 'speed', label: 'Speed round', value: words >= 5 ? rounds : 0, unit: rounds === 1 ? 'round' : 'rounds', disabled: words < 5, run: startSpeedRound },
  ]

  // One calm line explaining whatever is switched off.
  const notes: string[] = []
  if (learned === 0) notes.push('Review opens after your first lesson.')
  if (learned > 0 && mistakesCount === 0) notes.push('No mistakes to fix right now.')
  if (words < 5) notes.push(`Speed round opens after ${5 - words} more ${5 - words === 1 ? 'word' : 'words'}.`)

  return (
    <section className="home-practice" aria-labelledby="practice-title">
      <h2 id="practice-title" className="gv-section-header home-sectionhead">
        <span className="gv-section-header__title">Practice</span>
      </h2>
      <div className="home-practice__grid">
        {cells.map(({ key, label, value, unit, disabled, run }) => (
          <button
            key={key}
            type="button"
            className="gv-statcell home-pcell"
            disabled={disabled}
            onClick={() => {
              sfx.tap()
              void run()
            }}
            aria-label={`${label}${disabled ? '' : `, ${value} ${unit}`}`}
          >
            <span className="gv-statcell__label">{label}</span>
            <span className="gv-statcell__value">
              {disabled ? '–' : value > 99 ? '99+' : value}
              {!disabled && <span className="gv-statcell__unit">{unit}</span>}
            </span>
          </button>
        ))}
      </div>
      {notes.length > 0 && <p className="gv-section-footer">{notes.join(' ')}</p>}
    </section>
  )
}

// ------------------------------------------------------------- track chips

function TrackChips({ onAll }: { onAll: () => void }) {
  const viewTrack = useApp((s) => s.viewTrack)
  const setViewTrack = useApp((s) => s.setViewTrack)
  return (
    <section className="home-tracks" aria-labelledby="path-title">
      <div className="gv-section-header home-sectionhead">
        <h2 id="path-title" className="gv-section-header__title">
          Your path
        </h2>
        <button type="button" className="gv-section-header__action" onClick={onAll}>
          All tracks
        </button>
      </div>
      <div className="home-chips" role="group" aria-label="Show the path for">
        {tracks.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`gv-chip home-chip gv-tone-${t.id}`}
            aria-pressed={viewTrack === t.id}
            onClick={() => {
              if (viewTrack !== t.id) sfx.tap()
              setViewTrack(t.id)
            }}
          >
            <span className="track-dot" aria-hidden="true" />
            <span>{t.title}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

// ------------------------------------------------------------- path

function Path({ track, onOpen }: { track: TrackView; onOpen: (l: LessonView) => void }) {
  const progress = useApp((s) => s.progress)
  const summary = useApp((s) => s.summary)
  const reduce = useReducedMotion()
  const states = useMemo(() => lessonStates(track, progress), [track, progress])
  const currentRef = useRef<HTMLButtonElement>(null)
  const doneToday = practicedToday(summary)
  const completion = trackCompletion(track, progress)
  const counts = lessonsDone(track, progress)
  const currentIndex = track.lessons.findIndex((l) => states[l.id] === 'current')

  useEffect(() => {
    const el = currentRef.current
    if (!el) return
    // The path scrolls to the current lesson only when the learner switches tracks. The last
    // track handled lives in sessionStorage, so StrictMode's double effect run and remounts
    // (coming back from a lesson) can't cause a jump. On first open the Today card leads,
    // unless today's practice has started and the current lesson is far down the track.
    const key = 'govori.path.track'
    let prev: string | null = null
    try {
      prev = sessionStorage.getItem(key)
      sessionStorage.setItem(key, track.id)
    } catch {
      /* private mode: fall through and treat as a first open */
    }
    if (prev === track.id) return
    if (prev === null && (!doneToday || currentIndex < 4)) return
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id])

  return (
    <div className={`home-path gv-tone-${track.id}`}>
      <div className="home-trackhead">
        <TrackBadge track={track.id} size={40} />
        <div className="home-trackhead__text">
          <p className="home-trackhead__title">{track.title}</p>
          <p lang="bg" className="home-trackhead__bg">
            {track.titleBg}
          </p>
        </div>
        <div className="home-trackhead__count" aria-label={`${counts.done} of ${counts.total} lessons started, ${Math.round(completion.ratio * 100)} percent complete`}>
          <span className="home-trackhead__num">
            {counts.done}
            <span>/{counts.total}</span>
          </span>
          <span className="home-trackhead__cap">lessons</span>
        </div>
        <div className="gv-progress home-trackhead__bar" aria-hidden="true">
          <div className="gv-progress__fill" style={{ width: `${completion.ratio * 100}%` }} />
        </div>
      </div>

      {track.units.map((u, ui) => {
        const lessonCount = u.lessons.filter((l) => l.kind !== 'story').length
        let lessonNo = 0
        return (
          <section key={u.id} className="gv-section home-unit" aria-labelledby={`unit-${u.id}`}>
            <div className="gv-section-header home-unit__head">
              <div className="home-unit__titles">
                <span className="home-unit__eyebrow">
                  Unit {ui + 1} · {lessonCount} lessons{u.lessons.length > lessonCount ? ' and a conversation' : ''}
                </span>
                <h3 id={`unit-${u.id}`} className="gv-section-header__title">
                  {u.title}
                </h3>
                <span lang="bg" className="home-unit__bg">
                  {u.titleBg}
                </span>
              </div>
            </div>
            <div className="gv-list">
              {u.lessons.map((l) => {
                if (l.kind !== 'story') lessonNo++
                const state = states[l.id]
                return (
                  <LessonRow
                    key={l.id}
                    lesson={l}
                    state={state}
                    level={progress[l.id]?.level ?? 0}
                    number={lessonNo}
                    rowRef={state === 'current' ? currentRef : undefined}
                    onOpen={onOpen}
                  />
                )
              })}
            </div>
            <p className="gv-section-footer">{u.description}</p>
          </section>
        )
      })}
      <p className="home-path__end">More units arrive as you grow.</p>
    </div>
  )
}

function LessonRow({
  lesson,
  state,
  level,
  number,
  rowRef,
  onOpen,
}: {
  lesson: LessonView
  state: NodeState
  level: number
  number: number
  rowRef?: Ref<HTMLButtonElement>
  onOpen: (l: LessonView) => void
}) {
  const story = lesson.kind === 'story'
  const max = maxLevel(lesson)
  const locked = state === 'locked'
  const done = state === 'done'
  const current = state === 'current'
  const stateText = locked ? 'locked' : done ? 'complete' : story ? 'ready' : `level ${level} of ${max} done`

  // The ring's centre: a check when done, the first letter for alphabet lessons, else the lesson number.
  let centre: ReactNode = number
  if (done) centre = <IconCheck />
  else if (lesson.kind === 'letters') {
    const first = lesson.itemIds.map((id) => study(id)).find((s) => s?.kind === 'letter')
    if (first?.letter) centre = <span lang="bg">{first.letter.upper}</span>
  }

  const accessory = locked ? (
    <IconLock className="home-row__lock" aria-hidden="true" />
  ) : done ? (
    <span className="gv-row__accessory">{story ? 'Played' : 'Done'}</span>
  ) : story ? (
    <span className="gv-row__accessory">{current ? 'Ready' : ''}</span>
  ) : (
    <span className="gv-row__accessory">{level === 0 ? (current ? 'Start' : '') : `Level ${level + 1} next`}</span>
  )

  return (
    <button
      ref={rowRef}
      type="button"
      className={`gv-row home-row${current ? ' is-current' : ''}${locked ? ' is-disabled' : ''}`}
      onClick={() => {
        sfx.tap()
        onOpen(lesson)
      }}
      aria-label={`${story ? 'Conversation' : `Lesson ${number}`}: ${lesson.title}, ${stateText}`}
    >
      {story ? (
        <span className="gv-row__icon home-row__chat" aria-hidden="true">
          {locked ? <IconLock /> : <IconChat />}
        </span>
      ) : (
        <span className={`gv-row__icon badge-slot home-row__ring${done ? ' is-done' : ''}${locked ? ' is-locked' : ''}`} aria-hidden="true">
          <svg className="gv-ring" viewBox="0 0 36 36" style={{ '--value': locked ? 0 : (level / max) * 100 } as CSSProperties}>
            <circle className="gv-ring__track" cx="18" cy="18" r="16" />
            <circle className="gv-ring__value" cx="18" cy="18" r="16" pathLength={100} />
          </svg>
          <span className="home-row__centre">{centre}</span>
        </span>
      )}
      <span className="gv-row__body">
        <span className="gv-row__title">{lesson.title}</span>
        <span className="gv-row__subtitle" lang="bg">
          {story ? `Разговор · ${lesson.titleBg}` : lesson.titleBg}
        </span>
      </span>
      {accessory}
      {!locked && <span className="gv-row__chevron" aria-hidden="true" />}
    </button>
  )
}

// ------------------------------------------------------------- lesson sheet

function NodeSheet({ lesson, onClose }: { lesson: LessonView | null; onClose: () => void }) {
  const progress = useApp((s) => s.progress)
  const speaker = useApp((s) => s.profile.speaker)
  const startLesson = useApp((s) => s.startLesson)
  const [shown, setShown] = useState<LessonView | null>(lesson)

  // Keep the last lesson rendered while the sheet animates out.
  useEffect(() => {
    if (lesson) setShown(lesson)
  }, [lesson])

  const l = lesson ?? shown
  return (
    <BottomSheet open={!!lesson} onClose={onClose} labelledBy="node-sheet-title">
      {l && <NodeSheetBody lesson={l} progress={progress} speaker={speaker} onStart={(lvl) => void startLesson(l.id, lvl)} />}
    </BottomSheet>
  )
}

function NodeSheetBody({
  lesson,
  progress,
  speaker,
  onStart,
}: {
  lesson: LessonView
  progress: ReturnType<typeof useApp.getState>['progress']
  speaker: 'm' | 'f'
  onStart: (level: number) => void
}) {
  const track = trackMeta(lesson.trackId)
  const unit = unitById.get(lesson.unitId)
  const unitNo = (unit?.index ?? 0) + 1
  const states = lessonStates(track, progress)
  const state = states[lesson.id]
  const lvl = progress[lesson.id]?.level ?? 0
  const max = maxLevel(lesson)
  const story = lesson.kind === 'story'
  const lessonNo = (unit?.lessons.filter((x) => x.kind !== 'story').findIndex((x) => x.id === lesson.id) ?? 0) + 1
  const current = track.lessons.find((x) => states[x.id] === 'current')
  const dialogue = story && lesson.dialogueId ? dialogueById.get(lesson.dialogueId) : undefined
  const all = lesson.itemIds.map((id) => study(id, speaker)).filter((s): s is NonNullable<typeof s> => !!s && s.kind !== 'reading')
  const letters = all.filter((s) => s.kind === 'letter')
  const words = all.filter((s) => s.kind !== 'letter')
  const preview = words.slice(0, 4)

  let cta = 'Start lesson'
  let level = Math.min(max, lvl + 1)
  if (story) cta = lvl > 0 ? 'Play again' : 'Play conversation'
  else if (state === 'done') {
    cta = 'Practise again'
    level = max
  } else if (lvl > 0) cta = `Start level ${level}`

  return (
    <div className={`node-sheet gv-tone-${track.id}`}>
      <p className="node-sheet__eyebrow">
        {track.title} · Unit {unitNo} · {story ? 'Conversation' : `Lesson ${lessonNo}`}
      </p>
      <h2 id="node-sheet-title" className="node-sheet__title">
        {lesson.title}
      </h2>
      <p lang="bg" className="node-sheet__bg">
        {lesson.titleBg}
      </p>

      {dialogue && <p className="node-sheet__scene">{dialogue.scene}</p>}

      {letters.length > 0 && (
        <div className="node-sheet__letters" aria-label="Letters in this lesson">
          {letters.map((p) => (
            <span key={p.id} lang="bg" className="node-sheet__glyph">
              {p.letter!.upper}
              {p.letter!.lower}
            </span>
          ))}
        </div>
      )}

      {preview.length > 0 && (
        <div className="node-sheet__words">
          <p className="sheet-section-title">In this lesson</p>
          <ul className="gv-list node-sheet__list">
            {preview.map((p) => (
              <li key={p.id} className="gv-row">
                <span className="gv-row__body">
                  <span className="gv-row__title" lang="bg">
                    {p.bg}
                  </span>
                  <span className="gv-row__subtitle">{p.en}</span>
                </span>
                <span className="node-sheet__emoji" aria-hidden="true">
                  {p.emoji}
                </span>
              </li>
            ))}
          </ul>
          {words.length > preview.length && <p className="gv-section-footer">and {words.length - preview.length} more</p>}
        </div>
      )}

      {!story && (
        <div className="node-sheet__levels">
          <LevelDots level={Math.min(lvl, max)} />
          <span>{lvl === 0 ? 'Not started yet' : lvl >= max ? 'All three levels done' : `Level ${lvl} of ${max} done`}</span>
        </div>
      )}
      {!story && <p className="node-sheet__hint">Level 1 recognise, level 2 recall, level 3 say and type it.</p>}

      {state === 'locked' ? (
        <>
          <p className="node-sheet__locked">
            <IconLock aria-hidden="true" />
            <span>
              Finish {current ? <strong>“{current.title}”</strong> : 'the lessons before this one'} to unlock this.
            </span>
          </p>
          <button type="button" className="gv-btn gv-btn--block" disabled>
            Locked
          </button>
        </>
      ) : (
        <button type="button" className="gv-btn gv-btn--block" onClick={() => onStart(level)}>
          {cta}
        </button>
      )}
    </div>
  )
}
