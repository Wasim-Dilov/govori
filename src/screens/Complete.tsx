// The calm summary after every session: what you did, what it earned, what you met.
import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useApp } from '../lib/store.ts'
import { LEVEL_NAMES } from '../lib/progress.ts'
import { sfx, speak } from '../lib/audio.ts'
import type { StudyItem } from '../content/index.ts'
import { IconChat, IconCheck, IconFlame, IconSpeaker, IconStar, IconTarget } from '../components/Icons.tsx'
import { ShareProgress } from '../components/ShareProgress.tsx'
import './complete.css'

const TITLES: Record<string, { en: string; bg: string }> = {
  lesson: { en: 'Lesson complete', bg: 'Браво!' },
  letters: { en: 'Letters learned', bg: 'Браво!' },
  story: { en: 'Conversation complete', bg: 'Чудесно!' },
  practice: { en: 'Review done', bg: 'Добре!' },
  mistakes: { en: 'Mistakes fixed', bg: 'Готово!' },
  speed: { en: 'Speed round done', bg: 'Бързо!' },
}

const fmtTime = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const sayItem = (it: StudyItem) => speak(it.kind === 'letter' && it.letter ? it.letter.example.bg : it.bg, { itemId: it.id })

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
  const hasNews = result.goalReached || !!levelName || showStory || showLesson

  return (
    <div className={`done gv-tone-${result.trackId}`}>
      <div className="done__body flow__pad">
        <div className="gv-shevitsa done__band" aria-hidden="true" />

        <motion.header className="done__hero" {...fade(0)}>
          <span className="gv-ring-wrap done__mark">
            <svg className="gv-ring gv-ring--lg gv-tone-pine" viewBox="0 0 36 36" style={{ ['--value' as string]: 100 }} aria-hidden="true">
              <circle className="gv-ring__track" cx="18" cy="18" r="16" />
              <circle className="gv-ring__value" cx="18" cy="18" r="16" pathLength={100} />
            </svg>
            <span className="gv-ring__label done__check">
              <IconCheck />
            </span>
          </span>
          <h1 className="t-title1 done__title">{title.en}</h1>
          <p className="done__bg" lang="bg">
            {result.perfect ? 'Перфектно!' : title.bg}
          </p>
        </motion.header>

        <motion.div className="gv-statgrid done__stats" {...fade(1)}>
          <div className="gv-statcell">
            <span className="gv-statcell__label">Accuracy</span>
            <span className="gv-statcell__value">
              {accuracy}
              <span className="gv-statcell__unit">%</span>
            </span>
          </div>
          <div className="gv-statcell">
            <span className="gv-statcell__label">Time</span>
            <span className="gv-statcell__value">{fmtTime(result.ms)}</span>
          </div>
          <div className="gv-statcell">
            <span className="gv-statcell__label">XP</span>
            <span className="gv-statcell__value">+{result.xp}</span>
          </div>
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

      <div className="done__foot flow__pad">
        <ShareProgress result={result} />
        <button type="button" className="gv-btn gv-btn--block" onClick={() => go({ name: 'home' })}>
          Continue
        </button>
      </div>
    </div>
  )
}
