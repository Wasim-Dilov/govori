// First-run setup in the style of an Apple setup flow: one question per screen.
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BrandMark } from '../components/BrandMark.tsx'
import { Illustration } from '../components/Illustration.tsx'
import { InstallGuide } from '../components/InstallGuide.tsx'
import { TrackBadge } from '../components/FocusSheet.tsx'
import { IconBack, IconChat, IconCheck, IconHeart, IconPath } from '../components/Icons.tsx'
import { tracks } from '../content/index.ts'
import { PLAN } from '../content/plan.ts'
import type { TrackId } from '../content/types.ts'
import { sfx } from '../lib/audio.ts'
import { isStandalone } from '../lib/push.ts'
import { useApp } from '../lib/store.ts'
import { DEFAULT_GOAL, GOAL_OPTIONS } from '../lib/progress.ts'
import './onboarding.css'

type Step = 'welcome' | 'name' | 'address' | 'goal' | 'start' | 'install'

// Daily goals are honest about time: a lesson is roughly 3 minutes and 10 to 15 XP.
const NOTES: Record<number, string> = {
  5: 'One or two short lessons with your coffee',
  10: 'Two or three lessons, the sweet spot',
  15: 'Four or five lessons, for fast progress',
}
const GOALS = GOAL_OPTIONS.map((o) => ({ xp: o.xp, label: o.label, time: `${o.min} minutes a day`, note: NOTES[o.min] ?? '' }))

// iOS Settings-style tiles: one hue each, used sparingly.
const FEATURES = [
  { Icon: IconHeart, tone: 'gv-tone-love', title: 'Words that matter at home', text: 'Sweet words for her, what the kids need, and the in-laws at the table.' },
  { Icon: IconPath, tone: 'gv-tone-basics', title: 'A few minutes a day', text: 'A 12-week plan with short lessons that build on each other.' },
  { Icon: IconChat, tone: 'gv-tone-family', title: 'Real conversations', text: 'Practise each unit in a short dialogue with the family.' },
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
  // Short screens (iPhone SE and similar) get a smaller welcome illustration so nothing sits under the footer.
  const [short, setShort] = useState(() => typeof window !== 'undefined' && window.innerHeight <= 700)
  useEffect(() => {
    const onResize = () => setShort(window.innerHeight <= 700)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [dir, setDir] = useState(1)
  const [name, setName] = useState('')
  const [speaker, setSpeaker] = useState<'m' | 'f' | null>(null)
  const [goal, setGoal] = useState<number>(DEFAULT_GOAL)
  const [start, setStart] = useState<TrackId | 'plan'>('plan')
  const [saving, setSaving] = useState(false)

  const step = steps[i]
  const last = i === steps.length - 1
  const canNext = step !== 'address' || speaker !== null

  async function finish() {
    if (saving) return
    setSaving(true)
    sfx.welcome()
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
    initial: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 24 }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -24 }),
  }

  const pick = <T,>(set: (v: T) => void, v: T) => () => {
    sfx.tap()
    set(v)
  }

  return (
    <div className="flow ob">
      <header className="flow__pad ob-head">
        <button type="button" className="ob-back" onClick={back} aria-label="Back" disabled={i === 0} style={{ visibility: i === 0 ? 'hidden' : 'visible' }}>
          <IconBack />
          <span>Back</span>
        </button>
        <div className="ob-dots" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={i + 1} aria-label={`Step ${i + 1} of ${steps.length}`}>
          {steps.map((s, n) => (
            <span key={s} className={`ob-dot${n === i ? ' is-now' : ''}`} />
          ))}
        </div>
        <span className="ob-back ob-back--spacer" aria-hidden="true" />
      </header>

      <main className="flow__pad ob-body">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            className="ob-step"
            custom={dir}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: reduce ? 0 : 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {step === 'welcome' && (
              <div className="ob-welcome">
                <Illustration name="welcome" size={short ? 120 : 184} className="ob-welcome__halo">
                  <BrandMark size={short ? 58 : 88} className="ob-welcome__mark" />
                </Illustration>
                <h1 className="ob-welcome__title">
                  Welcome to <span lang="bg">Говори</span>
                </h1>
                <p className="ob-welcome__sub">Bulgarian for your family, a few minutes a day.</p>
                <ul className="ob-features">
                  {FEATURES.map(({ Icon, tone, title, text }) => (
                    <li key={title}>
                      <span className={`ob-features__icon ${tone}`} aria-hidden="true">
                        <Icon />
                      </span>
                      <span>
                        <strong>{title}</strong>
                        <span>{text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 'name' && (
              <div className="ob-q">
                <h1 className="ob-title">What should we call you?</h1>
                <p className="ob-lead">Used in your evening reminders. It never leaves your phone.</p>
                <div className="gv-list">
                  <label className="gv-row ob-field" htmlFor="ob-name">
                    <span className="sr-only">Your first name</span>
                    <input
                      id="ob-name"
                      className="ob-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && next()}
                      placeholder="First name"
                      autoComplete="given-name"
                      maxLength={30}
                      enterKeyHint="next"
                    />
                  </label>
                </div>
                <p className="gv-section-footer">Optional.</p>
              </div>
            )}

            {step === 'address' && (
              <div className="ob-q">
                <h1 className="ob-title">How should Bulgarian address you?</h1>
                <p className="ob-lead">
                  Some words change with who is speaking. A man says <strong lang="bg">уморен</strong>, a woman says <strong lang="bg">уморена</strong> (tired).
                </p>
                <div className="gv-list" role="radiogroup" aria-label="Address me as">
                  {(
                    [
                      ['m', 'As a man', 'Уморен съм.', 'umorén săm'],
                      ['f', 'As a woman', 'Уморена съм.', 'umoréna săm'],
                    ] as const
                  ).map(([v, label, bg, tr]) => (
                    <button key={v} type="button" role="radio" aria-checked={speaker === v} className={`gv-row ob-option${speaker === v ? ' is-current' : ''}`} onClick={pick(setSpeaker, v)}>
                      <span className="gv-row__body">
                        <span className="gv-row__title">{label}</span>
                        <span className="gv-row__subtitle">
                          <span lang="bg">{bg}</span> · {tr}
                        </span>
                      </span>
                      {speaker === v ? <IconCheck className="ob-check" /> : <span className="ob-check" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'goal' && (
              <div className="ob-q">
                <h1 className="ob-title">Set a daily goal</h1>
                <p className="ob-lead">Little and often beats long and rare. You can change this any time.</p>
                <div className="gv-list" role="radiogroup" aria-label="Daily goal">
                  {GOALS.map((g) => (
                    <button key={g.xp} type="button" role="radio" aria-checked={goal === g.xp} className={`gv-row ob-option${goal === g.xp ? ' is-current' : ''}`} onClick={pick(setGoal, g.xp)}>
                      <span className="gv-row__body">
                        <span className="gv-row__title">
                          {g.label} · {g.time}
                        </span>
                        <span className="gv-row__subtitle">{g.note}</span>
                      </span>
                      <span className="gv-row__accessory">{g.xp} XP</span>
                      {goal === g.xp ? <IconCheck className="ob-check" /> : <span className="ob-check" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'start' && (
              <div className="ob-q">
                <h1 className="ob-title">Where do you want to start?</h1>
                <p className="ob-lead">The plan starts with the alphabet and changes focus each week.</p>
                <div className="gv-list" role="radiogroup" aria-label="Start with">
                  <button type="button" role="radio" aria-checked={start === 'plan'} className={`gv-row ob-option${start === 'plan' ? ' is-current' : ''}`} onClick={pick(setStart, 'plan' as const)}>
                    <span className="gv-row__icon badge-slot">
                      <TrackBadge track="plan" size={32} />
                    </span>
                    <span className="gv-row__body">
                      <span className="gv-row__title">The 12-week plan</span>
                      <span className="gv-row__subtitle">Recommended · Week 1: {PLAN[0].title.toLowerCase()}</span>
                    </span>
                    {start === 'plan' ? <IconCheck className="ob-check" /> : <span className="ob-check" aria-hidden="true" />}
                  </button>
                </div>
                <p className="sheet-section-title ob-sub">Or pick a track</p>
                <div className="gv-list" role="radiogroup" aria-label="Or pick a track">
                  {tracks.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={start === t.id} className={`gv-row ob-option${start === t.id ? ' is-current' : ''}`} onClick={pick(setStart, t.id)}>
                      <span className="gv-row__icon badge-slot">
                        <TrackBadge track={t.id} size={32} />
                      </span>
                      <span className="gv-row__body">
                        <span className="gv-row__title">{t.title}</span>
                        <span className="gv-row__subtitle" lang="bg">
                          {t.titleBg}
                        </span>
                      </span>
                      {start === t.id ? <IconCheck className="ob-check" /> : <span className="ob-check" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 'install' && (
              <div className="ob-q">
                <h1 className="ob-title">Add Govori to your Home Screen</h1>
                <p className="ob-lead">It then opens like an app, works offline and can remind you in the evening.</p>
                <InstallGuide />
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="flow__pad ob-foot">
        <button type="button" className="gv-btn gv-btn--block" onClick={next} disabled={!canNext || saving}>
          {step === 'welcome' ? 'Get started' : last ? (step === 'install' ? 'Start learning' : 'Start learning') : 'Continue'}
        </button>
        {step === 'install' && (
          <button type="button" className="gv-btn gv-btn--plain gv-btn--block" onClick={() => void finish()} disabled={saving}>
            I'll do it later
          </button>
        )}
        {step === 'name' && !name.trim() && (
          <button type="button" className="gv-btn gv-btn--plain gv-btn--block" onClick={next}>
            Skip
          </button>
        )}
      </footer>
    </div>
  )
}
