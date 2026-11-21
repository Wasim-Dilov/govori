// The reward after every session: confetti, XP count-up, stats and what you unlocked.
import { useEffect, useRef, useState } from 'react'
import { animate, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { useApp } from '../lib/store.ts'
import { LEVEL_NAMES } from '../lib/progress.ts'
import { sfx, speak } from '../lib/audio.ts'
import type { StudyItem } from '../content/index.ts'
import { Mascot } from '../components/Mascot.tsx'
import { IconFlame, IconSpeaker, IconStar, IconTarget } from '../components/Icons.tsx'
import './complete.css'

const TITLES: Record<string, { en: string; bg: string }> = {
  lesson: { en: 'Lesson complete', bg: 'Браво!' },
  letters: { en: 'Letters learned', bg: 'Браво!' },
  story: { en: 'Conversation complete', bg: 'Чудесно!' },
  practice: { en: 'Review done', bg: 'Добре!' },
  mistakes: { en: 'Mistakes fixed', bg: 'Готово!' },
  speed: { en: 'Speed round', bg: 'Бързо!' },
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function tokenColors(): string[] {
  const css = getComputedStyle(document.documentElement)
  return ['--rose', '--gold', '--pine', '--pick', '--trk-azbuka', '--linen-raised']
    .map((v) => css.getPropertyValue(v).trim())
    .filter((c) => /^#[0-9a-f]{3,8}$/i.test(c))
}

const fmtTime = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const sayItem = (it: StudyItem) => speak(it.kind === 'letter' && it.letter ? it.letter.example.bg : it.bg, { itemId: it.id })

export function CompleteScreen() {
  const screen = useApp((s) => s.screen)
  const go = useApp((s) => s.go)
  const result = screen.name === 'complete' ? screen.result : null
  const [xp, setXp] = useState(0)
  const fired = useRef(false)

  // Count the XP up (re-runs safely under StrictMode).
  useEffect(() => {
    if (!result) return
    const controls = animate(0, result.xp, { duration: reduceMotion() ? 0 : 1.1, delay: 0.25, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => setXp(Math.round(v)) })
    return () => {
      controls.stop()
      setXp(result.xp)
    }
  }, [result])

  // Sound and confetti once per result.
  useEffect(() => {
    if (!result || fired.current) return
    fired.current = true
    sfx.complete()
    if (reduceMotion()) return
    const colors = tokenColors()
    const shoot = (x: number, angle: number) =>
      confetti({ particleCount: 70, spread: 70, angle, startVelocity: 52, origin: { x, y: 0.62 }, colors, shapes: ['square'], scalar: 1.1, ticks: 220, disableForReducedMotion: true })
    shoot(0.1, 60)
    shoot(0.9, 120)
    if (result.perfect) setTimeout(() => confetti({ particleCount: 120, spread: 110, origin: { y: 0.35 }, colors, shapes: ['square', 'circle'], disableForReducedMotion: true }), 450)
  }, [result])

  if (!result) return null

  const title = TITLES[result.kind] ?? TITLES.lesson
  const accuracy = Math.round(result.accuracy * 100)
  const isLessonKind = result.kind === 'lesson' || result.kind === 'letters'
  const levelName = result.levelUp ? LEVEL_NAMES[Math.min(result.levelUp.to - 1, LEVEL_NAMES.length - 1)] : null
  const words = result.newItems.slice(0, 8)

  const tile = (i: number) => ({
    initial: { opacity: 0, y: 18, scale: 0.85 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { type: 'spring' as const, stiffness: 380, damping: 22, delay: 0.55 + i * 0.12 },
  })

  return (
    <div className={`done gv-tone-${result.trackId}`}>
      <div className="done__body flow__pad">
        <motion.div className="done__mascot" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
          <Mascot mood={result.perfect ? 'cheer' : 'happy'} size={132} />
        </motion.div>

        <div className="done__head">
          <p className="done__bg" lang="bg">
            {result.perfect ? 'Перфектно!' : title.bg}
          </p>
          <h1 className="t-screen-title">{title.en}</h1>
        </div>

        <motion.div className="done__xp" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.2 }} aria-label={`${result.xp} XP earned`}>
          <IconStar className="done__xp-star" />
          <span className="t-hero">+{xp}</span>
          <span className="done__xp-unit">XP</span>
          {result.perfect && <span className="done__perfect">+5 perfect bonus</span>}
        </motion.div>

        <div className="done__tiles">
          <motion.div className="done-tile gv-tone-pine" {...tile(0)}>
            <span className="done-tile__label">Accuracy</span>
            <span className="done-tile__value">{accuracy}%</span>
          </motion.div>
          <motion.div className="done-tile gv-tone-pick" {...tile(1)}>
            <span className="done-tile__label">Time</span>
            <span className="done-tile__value">{fmtTime(result.ms)}</span>
          </motion.div>
          <motion.div className="done-tile gv-tone-gold" {...tile(2)}>
            <span className="done-tile__label">Streak</span>
            <span className="done-tile__value">
              <IconFlame className={`done-tile__flame ${result.streakIncreased ? 'is-new' : ''}`} />
              {result.streak}
            </span>
            {result.streakIncreased && (
              <motion.span className="done-tile__plus" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.1 }}>
                +1
              </motion.span>
            )}
          </motion.div>
        </div>

        <div className="done__banners">
          {result.goalReached && (
            <motion.div className="done-banner gv-tone-gold" {...tile(3)}>
              <IconTarget className="done-banner__icon" />
              <div>
                <p className="done-banner__title">Daily goal reached</p>
                <p className="done-banner__sub">
                  <span lang="bg">Цел постигната.</span> Same time tomorrow?
                </p>
              </div>
            </motion.div>
          )}
          {result.levelUp && levelName && (
            <motion.div className="done-banner gv-tone-azbuka" {...tile(4)}>
              <span className="done-banner__badge">{result.levelUp.to}</span>
              <div>
                <p className="done-banner__title">Level up: {levelName.en}</p>
                <p className="done-banner__sub" lang="bg">
                  {levelName.bg}
                </p>
              </div>
            </motion.div>
          )}
          {result.lessonLevelUp && isLessonKind && (
            <motion.div className="done-banner gv-tone-rose" {...tile(5)}>
              <span className="done-banner__stars" aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <motion.i key={n} className={n <= result.level ? 'on' : ''} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 1.2 + n * 0.15 }} />
                ))}
              </span>
              <div>
                <p className="done-banner__title">Level {result.level} of 3 complete</p>
                <p className="done-banner__sub">{result.level < 3 ? `Level ${result.level + 1} is unlocked: harder exercises, same words.` : 'You mastered this lesson.'}</p>
              </div>
            </motion.div>
          )}
          {result.lessonLevelUp && result.kind === 'story' && (
            <motion.div className="done-banner gv-tone-rose" {...tile(5)}>
              <span className="done-banner__badge" aria-hidden="true">
                💬
              </span>
              <div>
                <p className="done-banner__title">Conversation unlocked the next unit</p>
                <p className="done-banner__sub">Replay it any time from the path.</p>
              </div>
            </motion.div>
          )}
        </div>

        {words.length > 0 && (
          <motion.section className="done__words" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
            <h2 className="done__words-title">{result.kind === 'letters' ? 'New letters' : 'New words'}</h2>
            <ul className="done__chips">
              {words.map((w) => (
                <li key={w.id}>
                  <button type="button" className="done-chip" onClick={() => void sayItem(w)}>
                    <span className="done-chip__emoji" aria-hidden="true">
                      {w.emoji}
                    </span>
                    <span className="done-chip__text">
                      <span className="done-chip__bg" lang="bg">
                        {w.kind === 'letter' && w.letter ? `${w.letter.upper} ${w.letter.lower}` : w.bg}
                      </span>
                      <span className="done-chip__en">{w.kind === 'letter' ? w.tr : w.en}</span>
                    </span>
                    <IconSpeaker className="done-chip__icon" />
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}
      </div>

      <div className="done__foot flow__pad">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <button type="button" className="gv-btn gv-btn--block" onClick={() => go({ name: 'home' })}>
            Continue
          </button>
        </motion.div>
      </div>
    </div>
  )
}
