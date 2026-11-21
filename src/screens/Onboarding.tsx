// First-run flow: one question per step, the stork reacting to each answer.
import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Mascot, type MascotMood } from '../components/Mascot.tsx'
import { InstallGuide } from '../components/InstallGuide.tsx'
import { IconBack, IconCheck } from '../components/Icons.tsx'
import { tracks } from '../content/index.ts'
import { PLAN } from '../content/plan.ts'
import type { TrackId } from '../content/types.ts'
import { sfx } from '../lib/audio.ts'
import { isStandalone } from '../lib/push.ts'
import { useApp } from '../lib/store.ts'
import './onboarding.css'

type Step = 'welcome' | 'name' | 'address' | 'goal' | 'start' | 'install'

const GOALS = [
  { xp: 20, label: 'Easy', time: '5 min a day', note: 'One lesson with your coffee' },
  { xp: 40, label: 'Regular', time: '10 min a day', note: 'Two or three lessons' },
  { xp: 60, label: 'Serious', time: '15 min a day', note: 'For fast progress' },
]

export function OnboardingScreen() {
  const setProfile = useApp((s) => s.setProfile)
  const setFocus = useApp((s) => s.setFocus)
  const go = useApp((s) => s.go)
  const reduce = useReducedMotion()

  const steps = useMemo<Step[]>(() => {
    const base: Step[] = ['welcome', 'name', 'address', 'goal', 'start']
    return isStandalone() ? base : [...base, 'install']
  }, [])

  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [name, setName] = useState('')
  const [speaker, setSpeaker] = useState<'m' | 'f' | null>(null)
  const [goal, setGoal] = useState(40)
  const [start, setStart] = useState<TrackId | 'plan'>('plan')
  const [saving, setSaving] = useState(false)

  const step = steps[i]
  const last = i === steps.length - 1

  const mood: MascotMood =
    step === 'welcome' ? 'cheer' : step === 'name' ? (name.trim() ? 'happy' : 'idle') : step === 'address' ? (speaker ? 'happy' : 'think') : step === 'goal' ? (goal >= 60 ? 'cheer' : 'happy') : step === 'start' ? 'happy' : 'idle'

  const canNext = step !== 'address' || speaker !== null

  async function finish() {
    if (saving) return
    setSaving(true)
    sfx.complete()
    await setProfile({ name: name.trim(), speaker: speaker ?? 'm', dailyGoal: goal, onboarded: true, startedAt: Date.now() })
    await setFocus(start, 'week')
    go({ name: 'home' })
  }

  function next() {
    if (!canNext) return
    sfx.tap()
    if (last) return void finish()
    setDir(1)
    setI((n) => n + 1)
  }

  function back() {
    if (i === 0) return
    setDir(-1)
    setI((n) => n - 1)
  }

  const slide = {
    initial: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 48 }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -48 }),
  }

  // What the stork says on each step: Bulgarian first, English underneath.
  const say: Record<Step, [string, string] | null> = {
    welcome: null,
    name: name.trim() ? [`Здравей, ${name.trim()}!`, `Hello, ${name.trim()}!`] : ['Как се казваш?', "What's your name?"],
    address: speaker ? ['Ясно!', 'Got it!'] : ['Кой говори?', "Who's speaking?"],
    goal: ['Малко, но всеки ден.', 'A little, but every day.'],
    start: ['Откъде да започнем?', 'Where shall we start?'],
    install: ['Почти сме готови!', "We're almost ready!"],
  }
  const line = say[step]

  return (
    <div className="flow ob">
      <header className="flow__pad ob-head">
        <button type="button" className="ob-back" onClick={back} aria-label="Back" disabled={i === 0} style={{ visibility: i === 0 ? 'hidden' : 'visible' }}>
          <IconBack />
        </button>
        <div className="ob-dots" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1} aria-label={`Step ${i + 1} of ${steps.length}`}>
          {steps.map((s, n) => (
            <span key={s} className={`ob-dot ${n < i ? 'is-done' : ''} ${n === i ? 'is-now' : ''}`} />
          ))}
        </div>
        <span className="ob-back" aria-hidden="true" />
      </header>

      <main className="flow__pad ob-body">
        <div className={`ob-mascot ${step === 'welcome' ? 'ob-mascot--big' : ''}`}>
          <Mascot mood={mood} size={step === 'welcome' ? 200 : 112} />
          <AnimatePresence mode="wait">
            {line && (
              <motion.p
                key={line[0]}
                className="ob-say"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              >
                <span lang="bg" className="ob-say-bg">
                  {line[0]}
                </span>
                <span className="ob-say-en">{line[1]}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            className="ob-step"
            custom={dir}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            {step === 'welcome' && (
              <div className="ob-welcome">
                <h1 className="ob-hello" lang="bg">
                  Говори!
                </h1>
                <p className="ob-sub">Let's get you speaking Bulgarian.</p>
                <p className="ob-small">A few minutes a day: sweet words for her, what the kids need, and how to win over your тъща.</p>
                <div className="gv-shevitsa ob-band gv-tone-rose" aria-hidden="true" />
              </div>
            )}

            {step === 'name' && (
              <div className="stack ob-q">
                <h2 className="t-screen-title">What should we call you?</h2>
                <label className="ob-label" htmlFor="ob-name">
                  Your first name
                </label>
                <input
                  id="ob-name"
                  className="ob-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && next()}
                  placeholder="e.g. Alex"
                  autoComplete="given-name"
                  maxLength={30}
                  enterKeyHint="next"
                />
                <p className="muted ob-hint">Optional. Used in your evening reminders, and it never leaves your phone.</p>
              </div>
            )}

            {step === 'address' && (
              <div className="stack ob-q">
                <h2 className="t-screen-title">How should Bulgarian address you?</h2>
                <p className="muted">
                  Some words change with who is speaking: a man says <strong lang="bg">уморен</strong>, a woman says <strong lang="bg">уморена</strong> (tired).
                </p>
                <div className="ob-pair" role="radiogroup" aria-label="Address me as">
                  {(
                    [
                      ['m', 'A man', 'Уморен съм.', 'umorén săm'],
                      ['f', 'A woman', 'Уморена съм.', 'umoréna săm'],
                    ] as const
                  ).map(([v, label, bg, tr]) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={speaker === v}
                      className={`gv-choice gv-choice--card ob-card ${speaker === v ? 'is-selected' : ''}`}
                      onClick={() => {
                        sfx.tap()
                        setSpeaker(v)
                      }}
                    >
                      <span className="ob-card-title">{label}</span>
                      <span className="gv-choice__text">
                        <span lang="bg" className="ob-card-bg">
                          {bg}
                        </span>
                        <span className="gv-choice__sub">{tr}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'goal' && (
              <div className="stack ob-q">
                <h2 className="t-screen-title">Pick a daily goal</h2>
                <p className="muted">Little and often beats long and rare. You can change this any time.</p>
                <div className="stack" role="radiogroup" aria-label="Daily goal">
                  {GOALS.map((g) => (
                    <button
                      key={g.xp}
                      type="button"
                      role="radio"
                      aria-checked={goal === g.xp}
                      className={`gv-choice ob-goal ${goal === g.xp ? 'is-selected' : ''}`}
                      onClick={() => {
                        sfx.tap()
                        setGoal(g.xp)
                      }}
                    >
                      <span className="gv-choice__text">
                        <span>
                          {g.label} · {g.time}
                        </span>
                        <span className="gv-choice__sub">{g.note}</span>
                      </span>
                      <span className="ob-xp">{g.xp} XP</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'start' && (
              <div className="stack ob-q">
                <h2 className="t-screen-title">Where do you want to start?</h2>
                <button
                  type="button"
                  className={`gv-trackcard gv-tone-rose ob-plan ${start === 'plan' ? 'is-active' : ''}`}
                  aria-pressed={start === 'plan'}
                  onClick={() => {
                    sfx.tap()
                    setStart('plan')
                  }}
                >
                  <span className="gv-trackcard__icon" aria-hidden="true">
                    🗓️
                  </span>
                  <span>
                    <span className="ob-badge">Recommended</span>
                    <span className="gv-trackcard__title">The 12-week plan</span>
                    <span className="gv-trackcard__meta">Week 1: {PLAN[0].title.toLowerCase()}. Starts with the alphabet.</span>
                  </span>
                  {start === 'plan' && <IconCheck className="ob-tick" />}
                </button>
                <p className="ob-or">or pick a track</p>
                <div className="ob-tracks">
                  {tracks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`gv-trackcard gv-tone-${t.id} ${start === t.id ? 'is-active' : ''}`}
                      aria-pressed={start === t.id}
                      onClick={() => {
                        sfx.tap()
                        setStart(t.id)
                      }}
                    >
                      <span className="gv-trackcard__icon" aria-hidden="true">
                        {t.emoji}
                      </span>
                      <span>
                        <span className="gv-trackcard__title">{t.title}</span>
                        <span className="gv-trackcard__bg" lang="bg">
                          {t.titleBg}
                        </span>
                      </span>
                      {start === t.id && <IconCheck className="ob-tick" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'install' && (
              <div className="stack ob-q">
                <h2 className="t-screen-title">Put Govori on your Home Screen</h2>
                <p className="muted">It then opens like an app, works offline and can remind you in the evening.</p>
                <InstallGuide />
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="flow__pad ob-foot">
        <button type="button" className="gv-btn gv-btn--block" onClick={next} disabled={!canNext || saving}>
          {step === 'welcome' ? 'Хайде! Let’s go' : last ? (step === 'install' ? 'Done, start learning' : 'Start learning') : 'Continue'}
        </button>
        {step === 'install' && (
          <button type="button" className="gv-btn gv-btn--ghost gv-btn--block ob-later" onClick={() => void finish()} disabled={saving}>
            I'll do it later
          </button>
        )}
        {step === 'name' && !name.trim() && (
          <button type="button" className="gv-btn gv-btn--ghost gv-btn--block ob-later" onClick={next}>
            Skip
          </button>
        )}
      </footer>
    </div>
  )
}
