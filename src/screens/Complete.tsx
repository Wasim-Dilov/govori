// The calm summary after every session: what you did, what it earned, what you met.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import { useApp } from '../lib/store.ts'
import { LEVEL_NAMES } from '../lib/progress.ts'
import { sfx, speak } from '../lib/audio.ts'
import type { StudyItem } from '../content/index.ts'
import { IconChat, IconCheck, IconFlame, IconSpeaker, IconStar, IconTarget } from '../components/Icons.tsx'
import { ShareProgress } from '../components/ShareProgress.tsx'
import { IconSnowflake } from '../components/TopBar.tsx'
import type { Milestone } from '../lib/milestones.ts'
import type { SessionResult } from '../lib/progress.ts'
import './complete.css'

const TITLES: Record<string, { en: string; bg: string }> = {
  lesson: { en: 'Lesson complete', bg: 'Браво!' },
  letters: { en: 'Letters learned', bg: 'Браво!' },
  story: { en: 'Conversation complete', bg: 'Чудесно!' },
  practice: { en: 'Review done', bg: 'Добре!' },
  mistakes: { en: 'Mistakes fixed', bg: 'Готово!' },
  speed: { en: 'Speed round done', bg: 'Бързо!' },
  warmup: { en: 'Warm-up done', bg: 'Загрявката е готова.' },
  quick: { en: 'One minute, done', bg: 'Една минута. Браво!' },
  welcome: { en: 'Welcome back', bg: 'Радвам се, че се върна.' },
  quiz: { en: 'Quiz done', bg: 'Благодаря, че ме изпита!' },
}

const fmtTime = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const sayItem = (it: StudyItem) => speak(it.kind === 'letter' && it.letter ? it.letter.example.bg : it.bg, { itemId: it.id })

/** Counts a number up from zero (tabular figures do the rest); instant under reduced motion. */
function useCountUp(target: number, ms: number, delay = 0) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? target : 0)
  useEffect(() => {
    if (reduce) return setN(target)
    const c = animate(0, target, { duration: ms / 1000, delay: delay / 1000, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setN(Math.round(v)) })
    return () => c.stop()
  }, [target, ms, delay, reduce])
  return n
}

/** A ring that draws itself closed (CSS transition on stroke-dashoffset), with a check inside. */
function DrawnCheck({ className = '', ms = 500 }: { className?: string; ms?: number }) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setValue(100))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <span className={`gv-ring-wrap ${className}`}>
      <svg className="gv-ring gv-ring--lg gv-tone-pine done__ring" viewBox="0 0 36 36" style={{ ['--value' as string]: value, ['--draw-ms' as string]: `${ms}ms` }} aria-hidden="true">
        <circle className="gv-ring__track" cx="18" cy="18" r="16" />
        <circle className="gv-ring__value" cx="18" cy="18" r="16" pathLength={100} />
      </svg>
      <span className={`gv-ring__label done__check${value ? ' is-on' : ''}`}>
        <IconCheck />
      </span>
    </span>
  )
}

/** Points of an eight-pointed star (the шевица осмолъчка) around (c, c). */
function starPath(c: number, outer: number, rot = 0) {
  const inner = outer * (Math.cos(Math.PI / 4) / Math.cos(Math.PI / 8))
  const pts: string[] = []
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = rot + (i * Math.PI) / 8 - Math.PI / 2
    pts.push(`${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

/** The milestone mark: a fine-line star stitched on around a rose numeral or a check. */
function StarMark({ children }: { children: ReactNode }) {
  return (
    <span className="milestone__star">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path className="milestone__star-back" d={starPath(100, 78, Math.PI / 8)} pathLength={1} />
        <path className="milestone__star-line" d={starPath(100, 94)} pathLength={1} />
      </svg>
      <span className="milestone__star-in">{children}</span>
    </span>
  )
}

const fade = (i: number) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number], delay: 0.06 * i },
})

export function CompleteScreen() {
  const screen = useApp((s) => s.screen)
  const go = useApp((s) => s.go)
  const result = screen.name === 'complete' ? screen.result : null
  const played = useRef(false)
  // Milestones come first, one sheet each, then the summary.
  const [shown, setShown] = useState(0)

  // A short chime once per result.
  useEffect(() => {
    if (!result || played.current) return
    played.current = true
    sfx.complete()
  }, [result])

  if (!result) return null

  const title = TITLES[result.kind] ?? TITLES.lesson
  const accuracy = Math.round(result.accuracy * 100)
  const isLessonKind = result.kind === 'lesson' || result.kind === 'letters'
  const levelName = result.levelUp ? LEVEL_NAMES[Math.min(result.levelUp.to - 1, LEVEL_NAMES.length - 1)] : null
  const words = result.newItems.slice(0, 8)
  const showStory = result.lessonLevelUp && result.kind === 'story'
  const showLesson = result.lessonLevelUp && isLessonKind
  const milestones = result.milestones ?? []
  const unitDone = milestones.find((m) => m.kind === 'unit' && m.canDo)
  const hasNews = result.goalReached || !!levelName || showStory || showLesson || !!unitDone || !!result.usedFreeze || !!result.repaired || !!result.earnedFreeze
  const milestone = shown < milestones.length ? milestones[shown] : null

  return (
    <div className={`done gv-tone-${result.trackId}`}>
      <div className="done__body flow__pad" inert={!!milestone}>
        <div className="gv-shevitsa done__band" aria-hidden="true" />

        <motion.header className="done__hero" {...fade(0)}>
          <DrawnCheck className="done__mark" />
          <h1 className="t-title1 done__title">{title.en}</h1>
          <p className="done__bg" lang="bg">
            {result.perfect ? 'Перфектно!' : title.bg}
          </p>
        </motion.header>

        <motion.div className="gv-statgrid done__stats" {...fade(1)}>
          <Stats accuracy={accuracy} ms={result.ms} xp={result.xp} />
        </motion.div>

        <motion.p className="done__streak" {...fade(2)}>
          <IconFlame className="done__flame" />
          <span>
            <strong>{result.streak}-day streak</strong>
            {result.streakIncreased && <span className="done__streak-new"> · +1 today</span>}
          </span>
          {result.perfect && <span className="done__perfect">Perfect · +5 XP</span>}
        </motion.p>

        {hasNews && (
          <motion.div className="gv-list done__news" {...fade(3)}>
            {unitDone && (
              <div className="gv-row done__cando">
                <span className="gv-row__icon">
                  <IconStar />
                </span>
                <span className="gv-row__body">
                  <span className="gv-row__title">{unitDone.canDo}</span>
                  <span className="gv-row__subtitle">{unitDone.title}</span>
                </span>
              </div>
            )}
            {(result.usedFreeze || result.repaired || result.earnedFreeze) && <StreakNews result={result} />}
            {result.goalReached && (
              <div className="gv-row gv-tone-gold">
                <span className="gv-row__icon">
                  <IconTarget />
                </span>
                <span className="gv-row__body">
                  <span className="gv-row__title">Daily goal reached</span>
                  <span className="gv-row__subtitle">
                    <span lang="bg">Цел постигната.</span> Same time tomorrow?
                  </span>
                </span>
              </div>
            )}
            {result.levelUp && levelName && (
              <div className="gv-row gv-tone-azbuka">
                <span className="gv-row__icon">
                  <IconStar />
                </span>
                <span className="gv-row__body">
                  <span className="gv-row__title">
                    Level {result.levelUp.to}: {levelName.en}
                  </span>
                  <span className="gv-row__subtitle" lang="bg">
                    {levelName.bg}
                  </span>
                </span>
              </div>
            )}
            {showLesson && (
              <div className="gv-row">
                <span className="gv-row__icon done__dots" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <i key={n} className={n <= result.level ? 'on' : ''} />
                  ))}
                </span>
                <span className="gv-row__body">
                  <span className="gv-row__title">Level {result.level} of 3 complete</span>
                  <span className="gv-row__subtitle">{result.level < 3 ? `Level ${result.level + 1} unlocked: harder exercises, same words.` : 'You have mastered this lesson.'}</span>
                </span>
              </div>
            )}
            {showStory && (
              <div className="gv-row">
                <span className="gv-row__icon">
                  <IconChat />
                </span>
                <span className="gv-row__body">
                  <span className="gv-row__title">Next unit unlocked</span>
                  <span className="gv-row__subtitle">Replay this conversation any time from the path.</span>
                </span>
              </div>
            )}
          </motion.div>
        )}

        {words.length > 0 && (
          <motion.section className="gv-section done__words" {...fade(4)}>
            <h2 className="gv-section-header">{result.kind === 'letters' ? 'New letters' : 'New words'}</h2>
            <div className="gv-list">
              {words.map((w) => (
                <button key={w.id} type="button" className="gv-row done__word" onClick={() => void sayItem(w)} aria-label={`Play ${w.bg}`}>
                  <span className="gv-row__body">
                    <span className="gv-row__title" lang="bg">
                      {w.kind === 'letter' && w.letter ? `${w.letter.upper} ${w.letter.lower}` : w.bg}
                    </span>
                    <span className="gv-row__subtitle">{w.kind === 'letter' ? w.tr : `${w.tr} · ${w.en}`}</span>
                  </span>
                  <span className="done__play" aria-hidden="true">
                    <IconSpeaker />
                  </span>
                </button>
              ))}
            </div>
          </motion.section>
        )}
      </div>

      <div className="done__foot flow__pad" inert={!!milestone}>
        <ShareProgress result={result} />
        <button type="button" className="gv-btn gv-btn--block" onClick={() => go({ name: 'home' })}>
          Continue
        </button>
      </div>

      <AnimatePresence>{milestone && <MilestoneSheet key={milestone.id} milestone={milestone} result={result} onContinue={() => setShown((n) => n + 1)} />}</AnimatePresence>
    </div>
  )
}

/** Accuracy and XP count up from zero; time is shown as it was. */
function Stats({ accuracy, ms, xp }: { accuracy: number; ms: number; xp: number }) {
  const acc = useCountUp(accuracy, 400, 150)
  const gained = useCountUp(xp, 400, 250)
  return (
    <>
      <div className="gv-statcell">
        <span className="gv-statcell__label">Accuracy</span>
        <span className="gv-statcell__value">
          {acc}
          <span className="gv-statcell__unit">%</span>
        </span>
      </div>
      <div className="gv-statcell">
        <span className="gv-statcell__label">Time</span>
        <span className="gv-statcell__value">{fmtTime(ms)}</span>
      </div>
      <div className="gv-statcell">
        <span className="gv-statcell__label">XP</span>
        <span className="gv-statcell__value">+{gained}</span>
      </div>
    </>
  )
}

/** Freeze and repair news, as quiet rows in the summary list. */
function StreakNews({ result }: { result: SessionResult }) {
  const rows = [
    result.repaired && { title: 'Streak repaired', sub: `Your ${result.streak}-day streak is back.`, frost: false },
    result.usedFreeze && { title: 'A freeze kept your streak', sub: 'Yesterday is covered. Keep going today.', frost: true },
    result.earnedFreeze && { title: 'You earned a streak freeze', sub: 'Seven goal days. It covers one missed day.', frost: true },
  ].filter(Boolean) as { title: string; sub: string; frost: boolean }[]
  return (
    <>
      {rows.map((r) => (
        <div key={r.title} className="gv-row">
          <span className={`gv-row__icon${r.frost ? ' done__frost' : ''}`}>{r.frost ? <IconSnowflake /> : <IconFlame />}</span>
          <span className="gv-row__body">
            <span className="gv-row__title">{r.title}</span>
            <span className="gv-row__subtitle">{r.sub}</span>
          </span>
        </div>
      ))}
    </>
  )
}

/** A milestone, marked calmly: the stitch band, the moment, a Bulgarian proverb, and what he can now do. */
function MilestoneSheet({ milestone: m, result, onContinue }: { milestone: Milestone; result: SessionResult; onContinue: () => void }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [])
  const big = m.kind === 'unit' ? null : m.value
  const unit = m.kind === 'streak' ? (m.value === 1 ? 'day' : 'days') : m.kind === 'words' ? 'words' : ''
  const count = useCountUp(big ?? 0, 600, 250)
  return (
    <motion.div className="milestone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.25 }}>
      <motion.div
        ref={ref}
        className="milestone__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-title"
        tabIndex={-1}
        initial={reduce ? false : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="milestone__body flow__pad">
          <p className="milestone__eyebrow">{m.kind === 'unit' ? 'Unit complete' : m.kind === 'streak' ? 'Streak milestone' : 'Words milestone'}</p>
          <StarMark>
            {big !== null ? (
              <span className="milestone__num" aria-label={`${big} ${unit}`}>
                {count}
                <span>{unit}</span>
              </span>
            ) : (
              <span className="milestone__tick" aria-hidden="true">
                <IconCheck />
              </span>
            )}
          </StarMark>
          <h2 id="milestone-title" className="t-title1 milestone__title">
            {m.title}
          </h2>
          {m.kind !== 'unit' && <p className="milestone__subtitle">{m.subtitle}</p>}
          {m.canDo && (
            <p className="milestone__cando">
              <IconStar />
              <span>{m.canDo}</span>
            </p>
          )}
          <figure className="milestone__proverb">
            <blockquote lang="bg">„{m.proverb.bg}“</blockquote>
            <figcaption>
              <span>{m.proverb.tr}</span>
              <span>{m.proverb.en}</span>
            </figcaption>
          </figure>
        </div>
        <div className="done__foot flow__pad">
          <ShareProgress result={result} milestone={m} />
          <button type="button" className="gv-btn gv-btn--block" onClick={onContinue}>
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
