import { useEffect, useMemo, useRef, useState, type Ref } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useApp, trackMeta } from '../lib/store.ts'
import { learnedWordIds, lessonStates, nextLesson, practicedToday, trackCompletion, xpToday, yesterday, type NodeState } from '../lib/progress.ts'
import { dialogueById, maxLevel, study, tracks, unitById, type LessonView, type TrackView } from '../content/index.ts'
import { planWeek } from '../content/plan.ts'
import { TopBar, GoalRing } from '../components/TopBar.tsx'
import { BottomSheet, FocusSheet } from '../components/FocusSheet.tsx'
import { Mascot } from '../components/Mascot.tsx'
import { IconBolt, IconChat, IconCheck, IconLock, IconRefresh, IconStar, IconTarget } from '../components/Icons.tsx'
import { sfx } from '../lib/audio.ts'
import './home.css'

/** Horizontal offsets (px) for nodes within a unit: a gentle wave. */
const OFFS = [0, 56, 84, 56, 0, -56, -84, -56]

export function HomeScreen() {
  const viewTrack = useApp((s) => s.viewTrack)
  const [focusOpen, setFocusOpen] = useState(false)
  const [sheetLesson, setSheetLesson] = useState<LessonView | null>(null)
  const track = trackMeta(viewTrack)

  return (
    <div className="screen home">
      <TopBar onOpenFocus={() => setFocusOpen(true)} />
      <TodayCard onChangeFocus={() => setFocusOpen(true)} />
      <PracticeRow />
      <TrackChips />
      <Path track={track} onOpen={setSheetLesson} />
      <FocusSheet open={focusOpen} onClose={() => setFocusOpen(false)} />
      <NodeSheet lesson={sheetLesson} onClose={() => setSheetLesson(null)} />
    </div>
  )
}

// ------------------------------------------------------------- Today

function TodayCard({ onChangeFocus }: { onChangeFocus: () => void }) {
  const profile = useApp((s) => s.profile)
  const focus = useApp((s) => s.focus)
  const summary = useApp((s) => s.summary)
  const progress = useApp((s) => s.progress)
  const startLesson = useApp((s) => s.startLesson)
  const startPractice = useApp((s) => s.startPractice)
  const setViewTrack = useApp((s) => s.setViewTrack)
  const reduce = useReducedMotion()

  const week = planWeek(profile.startedAt)
  const plan = focus.track === 'plan'
  const trackId = focus.track === 'plan' ? week.focus : focus.track
  const track = trackMeta(trackId)
  const next = nextLesson(track, progress)
  const xp = xpToday(summary)
  const goal = profile.dailyGoal
  const started = next ? (progress[next.lesson.id]?.level ?? 0) > 0 : false
  const label = !next ? 'Review this track' : next.lesson.kind === 'story' ? 'Play the conversation' : started ? `Continue · level ${next.level}` : 'Start next lesson'
  const eyebrow = plan ? `Week ${week.week} of 12` : focus.scope === 'day' ? 'Your focus today' : 'Your focus this week'
  const also = plan && week.also ? trackMeta(week.also) : null

  const go = () => {
    sfx.tap()
    if (next) void startLesson(next.lesson.id, next.level)
    else void startPractice()
  }

  return (
    <motion.section
      className={`home-today gv-tone-${trackId}`}
      aria-labelledby="today-title"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
    >
      <div className="gv-shevitsa gv-shevitsa--sm home-today__band" aria-hidden="true" />
      <div className="home-today__top">
        <div className="home-today__text">
          <p className="home-eyebrow">{eyebrow}</p>
          <h1 id="today-title" className="home-today__title">
            {plan ? week.title : track.title}
          </h1>
          <p lang="bg" className="home-today__bg">
            {plan ? week.titleBg : track.titleBg}
          </p>
        </div>
        <GoalRing value={xp} goal={goal} size={76} stroke={8} label={`${xp} of ${goal} XP today`}>
          <span className="home-today__xp">
            <strong>{xp}</strong>
            <span>/ {goal} XP</span>
          </span>
        </GoalRing>
      </div>
      <p className="home-today__goal">{plan ? week.goal : track.tagline}</p>
      {next && (
        <p className="home-today__next">
          <span className="home-today__chip" aria-hidden="true">
            {track.emoji}
          </span>
          <span>
            Next up: <strong>{next.lesson.title}</strong>
          </span>
        </p>
      )}
      <button type="button" className="gv-btn gv-btn--block home-today__go" onClick={go}>
        {label}
      </button>
      <div className="home-today__foot">
        {also && (
          <button type="button" className="home-link" onClick={() => setViewTrack(also.id)}>
            Also this week: {also.emoji} {also.title}
          </button>
        )}
        <button type="button" className="home-link" onClick={onChangeFocus}>
          Change focus
        </button>
      </div>
    </motion.section>
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

  const tiles = [
    {
      key: 'review',
      title: 'Review',
      tone: 'pick',
      Icon: IconRefresh,
      meta: dueCount > 0 ? 'Words due today' : learned > 0 ? 'Keep them fresh' : 'Learn a few words first',
      badge: dueCount > 0 ? dueCount : null,
      disabled: learned === 0,
      run: startPractice,
    },
    {
      key: 'mistakes',
      title: 'Fix mistakes',
      tone: 'rose',
      Icon: IconTarget,
      meta: mistakesCount > 0 ? 'Recent slips' : 'All clear',
      badge: mistakesCount > 0 ? mistakesCount : null,
      disabled: mistakesCount === 0,
      run: startMistakes,
    },
    {
      key: 'speed',
      title: 'Speed round',
      tone: 'gold',
      Icon: IconBolt,
      meta: words >= 5 ? '3 quick rounds' : `Learn ${5 - words} more words`,
      badge: null,
      disabled: words < 5,
      run: startSpeedRound,
    },
  ]

  return (
    <section className="home-practice" aria-label="Practice">
      {tiles.map(({ key, title, tone, Icon, meta, badge, disabled, run }) => (
        <button
          key={key}
          type="button"
          className={`home-ptile gv-tone-${tone}`}
          disabled={disabled}
          onClick={() => {
            sfx.tap()
            void run()
          }}
        >
          <span className="home-ptile__icon" aria-hidden="true">
            <Icon />
            {badge !== null && <span className="home-ptile__badge">{badge > 99 ? '99+' : badge}</span>}
          </span>
          <span className="home-ptile__title">{title}</span>
          <span className="home-ptile__meta">{meta}</span>
        </button>
      ))}
    </section>
  )
}

// ------------------------------------------------------------- track chips

function TrackChips() {
  const viewTrack = useApp((s) => s.viewTrack)
  const setViewTrack = useApp((s) => s.setViewTrack)
  return (
    <div className="home-chips-wrap">
      <h2 className="home-section-title">Your path</h2>
      <div className="home-chips" role="group" aria-label="Show the path for">
        {tracks.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`home-trackchip gv-tone-${t.id}`}
            aria-pressed={viewTrack === t.id}
            onClick={() => {
              if (viewTrack !== t.id) sfx.tap()
              setViewTrack(t.id)
            }}
          >
            <span aria-hidden="true">{t.emoji}</span>
            <span>{t.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- path

function Path({ track, onOpen }: { track: TrackView; onOpen: (l: LessonView) => void }) {
  const progress = useApp((s) => s.progress)
  const summary = useApp((s) => s.summary)
  const reduce = useReducedMotion()
  const states = useMemo(() => lessonStates(track, progress), [track, progress])
  const currentRef = useRef<HTMLLIElement>(null)
  const firstRun = useRef(true)
  const sleepy = summary.lastPracticeDay !== null && summary.lastPracticeDay < yesterday()
  const doneToday = practicedToday(summary)
  const completion = trackCompletion(track, progress)
  const currentIndex = track.lessons.findIndex((l) => states[l.id] === 'current')

  useEffect(() => {
    const el = currentRef.current
    if (!el) return
    if (firstRun.current) {
      firstRun.current = false
      // On first open the Today card leads. Once today's practice has started (or the current
      // node is far down a track they've been working through after a session), bring the path to them.
      if (!doneToday || currentIndex < 4) return
    }
    el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.id])

  return (
    <div className={`home-path gv-tone-${track.id}`}>
      <div className="home-path__head">
        <span className="home-path__emoji" aria-hidden="true">
          {track.emoji}
        </span>
        <div className="home-path__title">
          <p className="t-card-title">{track.title}</p>
          <p lang="bg" className="home-path__bg">
            {track.titleBg}
          </p>
        </div>
        <div className="home-path__pct" aria-label={`${Math.round(completion.ratio * 100)} percent complete`}>
          {Math.round(completion.ratio * 100)}%
        </div>
        <div className="gv-progress home-path__bar" aria-hidden="true">
          <div className="gv-progress__fill" style={{ width: `${Math.max(4, completion.ratio * 100)}%` }} />
        </div>
      </div>

      {track.units.map((u, ui) => {
        const lessonCount = u.lessons.filter((l) => l.kind !== 'story').length
        let lessonNo = 0
        return (
          <section key={u.id} className="home-unit" aria-label={`Unit ${ui + 1}: ${u.title}`}>
            {ui > 0 && <div className="gv-shevitsa home-band" aria-hidden="true" />}
            <div className="gv-unit">
              <div>
                <p className="gv-unit__eyebrow">
                  Unit {ui + 1} · {lessonCount} lessons{u.lessons.length > lessonCount ? ' + talk' : ''}
                </p>
                <h3 className="gv-unit__title">{u.title}</h3>
                <p lang="bg" className="home-unit__bg">
                  {u.titleBg}
                </p>
                <p className="gv-unit__desc">{u.description}</p>
              </div>
              <div className="home-unit__badge" aria-hidden="true">
                <div className="gv-unit__motif" />
                <span>{u.emoji}</span>
              </div>
            </div>
            <ol className="home-nodes">
              {u.lessons.map((l, li) => {
                if (l.kind !== 'story') lessonNo++
                const state = states[l.id]
                const off = OFFS[li % OFFS.length]
                return (
                  <NodeRow
                    key={l.id}
                    lesson={l}
                    state={state}
                    offset={off}
                    level={progress[l.id]?.level ?? 0}
                    number={lessonNo}
                    sleepy={sleepy}
                    rowRef={state === 'current' ? currentRef : undefined}
                    onOpen={onOpen}
                  />
                )
              })}
            </ol>
          </section>
        )
      })}
      <div className="home-path__end">
        <div className="gv-shevitsa" aria-hidden="true" />
        <p className="muted t-caption">More units arrive as you grow. Браво!</p>
      </div>
    </div>
  )
}

function nodeIcon(lesson: LessonView, state: NodeState) {
  if (state === 'locked') return <IconLock />
  if (lesson.kind === 'story') return <IconChat />
  if (state === 'done') return <IconCheck />
  if (lesson.kind === 'letters') {
    const first = lesson.itemIds.map((id) => study(id)).find((s) => s?.kind === 'letter')
    if (first?.letter)
      return (
        <span className="home-node__glyph" lang="bg">
          {first.letter.upper}
        </span>
      )
  }
  return <IconStar />
}

function NodeRow({
  lesson,
  state,
  offset,
  level,
  number,
  sleepy,
  rowRef,
  onOpen,
}: {
  lesson: LessonView
  state: NodeState
  offset: number
  level: number
  number: number
  sleepy: boolean
  rowRef?: Ref<HTMLLIElement>
  onOpen: (l: LessonView) => void
}) {
  const story = lesson.kind === 'story'
  const max = maxLevel(lesson)
  const bubble = story ? 'Talk' : level === 0 ? 'Start' : `Level ${Math.min(max, level + 1)}`
  const stateText = state === 'locked' ? 'locked' : state === 'done' ? 'complete' : story ? 'ready' : `level ${level} of ${max} done`
  return (
    <li className={`home-noderow${story ? ' is-story' : ''}${state === 'current' ? ' has-bubble' : ''}`} ref={rowRef}>
      <div className="home-nodewrap" style={{ transform: `translateX(${offset}px)` }}>
        {state === 'current' && (
          <span className="home-bubble-anchor">
            <span className="gv-bubble home-bubble">{bubble}</span>
          </span>
        )}
        <button
          type="button"
          className={`gv-node gv-tone-${lesson.trackId}${story ? ' home-node--story' : ''}${state === 'locked' ? ' is-locked' : ''}${state === 'current' ? ' is-current' : ''}${state === 'done' ? ' is-done' : ''}`}
          onClick={() => {
            sfx.tap()
            onOpen(lesson)
          }}
          aria-label={`${story ? 'Conversation' : `Lesson ${number}`}: ${lesson.title}, ${stateText}`}
        >
          {nodeIcon(lesson, state)}
          {!story && (
            <span className="gv-node__stars" aria-hidden="true">
              {[1, 2, 3].map((n) => (
                <i key={n} className={level >= n ? 'on' : ''} />
              ))}
            </span>
          )}
        </button>
        {story && <span className="home-node__label">Conversation</span>}
      </div>
      {state === 'current' && (
        <div className={`home-mascot ${offset >= 0 ? 'is-left' : 'is-right'}`} aria-hidden="true">
          <Mascot mood={sleepy ? 'sleep' : 'idle'} size={84} />
        </div>
      )}
    </li>
  )
}

// ------------------------------------------------------------- node sheet

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
  const preview = lesson.itemIds
    .map((id) => study(id, speaker))
    .filter((s): s is NonNullable<typeof s> => !!s && s.kind !== 'reading')
    .slice(0, 6)

  let cta = 'Start'
  let level = Math.min(max, lvl + 1)
  if (story) cta = lvl > 0 ? 'Play again' : 'Play the conversation'
  else if (state === 'done') {
    cta = 'Practise again'
    level = max
  } else if (lvl > 0) cta = `Start level ${level}`

  return (
    <div className={`node-sheet gv-tone-${track.id}`}>
      <p className="home-eyebrow">
        Unit {unitNo} · {story ? 'Conversation' : `Lesson ${lessonNo}`}
      </p>
      <h2 id="node-sheet-title" className="t-card-title">
        {lesson.title}
      </h2>
      <p lang="bg" className="node-sheet__bg">
        {lesson.titleBg}
      </p>

      {dialogue ? (
        <p className="node-sheet__scene">
          <span aria-hidden="true">{dialogue.emoji}</span> {dialogue.scene}
        </p>
      ) : (
        <ul className="node-sheet__preview" aria-label="In this lesson">
          {preview.map((p) => (
            <li key={p.id} className={p.kind === 'letter' ? 'is-letter' : ''}>
              {p.kind === 'letter' && p.letter ? (
                <span lang="bg" className="node-sheet__glyph">
                  {p.letter.upper}
                  {p.letter.lower}
                </span>
              ) : (
                <>
                  <span aria-hidden="true">{p.emoji}</span>
                  <span lang="bg">{p.bg}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!story && (
        <div className="node-sheet__levels">
          <span className="node-sheet__stars" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`gv-star${lvl >= n ? ' is-on' : ''}`} />
            ))}
          </span>
          <span className="t-caption muted">{lvl === 0 ? 'Not started yet' : lvl >= max ? 'All three levels done' : `Level ${lvl} of ${max} done`}</span>
        </div>
      )}
      {!story && <p className="node-sheet__hint">Level 1 recognise · Level 2 recall · Level 3 say and type it</p>}

      {state === 'locked' ? (
        <>
          <p className="node-sheet__locked">
            <IconLock />
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
