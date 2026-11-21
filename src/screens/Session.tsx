import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { IconCheck, IconClose, IconFlame, IconX } from '../components/Icons.tsx'
import { Mascot } from '../components/Mascot.tsx'
import { sfx, speak, stopSpeaking } from '../lib/audio.ts'
import { exItemId, type Exercise } from '../lib/engine.ts'
import { logAnswer, updateMemory } from '../lib/progress.ts'
import { useApp } from '../lib/store.ts'
import { BuildExercise } from '../exercises/Build.tsx'
import { ChoiceExercise } from '../exercises/Choice.tsx'
import { DialogueExercise } from '../exercises/Dialogue.tsx'
import { IntroExercise } from '../exercises/Intro.tsx'
import { MatchExercise } from '../exercises/Match.tsx'
import { SpeakExercise } from '../exercises/Speak.tsx'
import { TypeExercise } from '../exercises/TypeAnswer.tsx'
import type { PendingAnswer } from '../exercises/types.ts'
import '../exercises/exercises.css'
import './session.css'

interface Step {
  ex: Exercise
  attempt: number
  key: string
}

const PRAISE = [
  { bg: 'Браво!', en: 'Well done' },
  { bg: 'Отлично!', en: 'Excellent' },
  { bg: 'Точно така!', en: 'Exactly right' },
  { bg: 'Супер!', en: 'Super' },
  { bg: 'Много добре!', en: 'Very good' },
]

const SELF_COMPLETING = new Set<Exercise['type']>(['intro', 'match', 'speak', 'dialogue'])

export function SessionScreen() {
  const screen = useApp((s) => s.screen)
  const profile = useApp((s) => s.profile)
  const finish = useApp((s) => s.finish)
  const quit = useApp((s) => s.quitSession)
  const session = screen.name === 'session' ? screen : null

  const [steps, setSteps] = useState<Step[]>(() => (session ? session.plan.exercises.map((ex, i) => ({ ex, attempt: 1, key: `s${i}` })) : []))
  const [idx, setIdx] = useState(0)
  const [pending, setPending] = useState<PendingAnswer | null>(null)
  const [checked, setChecked] = useState<null | (PendingAnswer & { praise: (typeof PRAISE)[number] })>(null)
  const [combo, setCombo] = useState(0)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const score = useRef({ correct: 0, total: 0 })
  const exStart = useRef(Date.now())
  const finishing = useRef(false)

  const step = steps[idx]
  const trackTone = session ? `gv-tone-${session.trackId}` : ''
  const isSpeed = session?.plan.kind === 'speed'

  useEffect(() => {
    exStart.current = Date.now()
    setPending(null)
    setChecked(null)
  }, [idx])

  useEffect(() => {
    if (!isSpeed) return
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [isSpeed])

  useEffect(() => () => stopSpeaking(), [])

  const advance = useCallback(async () => {
    stopSpeaking()
    if (idx + 1 < steps.length) {
      setIdx(idx + 1)
      return
    }
    if (finishing.current) return
    finishing.current = true
    await finish({ correct: score.current.correct, total: Math.max(score.current.total, 1) })
  }, [idx, steps.length, finish])

  const record = useCallback(
    async (itemId: string, correct: boolean, answer: string, attempt: number, type: Exercise['type'], ms?: number) => {
      if (!session) return
      await logAnswer({
        sessionId: session.sessionId,
        trackId: session.trackId,
        lessonId: session.plan.lesson?.id ?? session.plan.kind,
        itemId,
        exType: type,
        correct,
        ms: ms ?? Date.now() - exStart.current,
        attempt,
        answer,
        level: session.plan.level,
      })
      await updateMemory(itemId, correct, attempt === 1)
    },
    [session],
  )

  const onCheck = useCallback(async () => {
    if (!step || !pending || checked) return
    const praise = PRAISE[Math.floor(Math.random() * PRAISE.length)]
    setChecked({ ...pending, praise })
    if (step.attempt === 1) {
      score.current.total++
      if (pending.correct) score.current.correct++
    }
    if (pending.correct) {
      sfx.correct()
      const nextCombo = combo + 1
      setCombo(nextCombo)
      if (nextCombo > 0 && nextCombo % 5 === 0) setTimeout(() => sfx.combo(), 250)
      const it = 'item' in step.ex ? step.ex.item : null
      if (it && it.kind !== 'letter' && step.ex.type !== 'listen_mc' && step.ex.type !== 'listen_type') void speak(it.bg, { itemId: it.id })
    } else {
      sfx.wrong()
      setCombo(0)
      // One more go at the end of the lesson.
      if (step.attempt === 1) setSteps((s) => [...s, { ex: step.ex, attempt: 2, key: `${step.key}r` }])
    }
    await record(exItemId(step.ex), pending.correct, pending.answer, step.attempt, step.ex.type)
  }, [step, pending, checked, combo, record])

  const onComplete = useCallback(
    async (correct: boolean | null, detail?: { answer?: string; steps?: { itemId: string; correct: boolean; answer: string; ms: number }[] }) => {
      if (!step) return
      if (step.ex.type === 'intro') {
        // Meeting an item puts it into spaced repetition.
        await updateMemory(step.ex.item.id, true, false)
      } else if (correct !== null) {
        if (detail?.steps?.length) {
          for (const s of detail.steps) await record(s.itemId, s.correct, s.answer, 1, step.ex.type, s.ms)
          score.current.total += detail.steps.length
          score.current.correct += detail.steps.filter((s) => s.correct).length
        } else {
          if (step.attempt === 1) {
            score.current.total++
            if (correct) score.current.correct++
          }
          await record(exItemId(step.ex), correct, detail?.answer ?? '', step.attempt, step.ex.type)
        }
        setCombo((c) => (correct ? c + 1 : 0))
      }
      await advance()
    },
    [step, record, advance],
  )

  // Enter checks or continues (handy on a keyboard).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      if (step?.ex.type === 'intro') return void onComplete(true)
      if (checked) return void advance()
      if (pending) {
        e.preventDefault()
        void onCheck()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, checked, pending, onCheck, onComplete, advance])

  const progress = useMemo(() => (steps.length ? idx / steps.length : 0), [idx, steps.length])

  if (!session || !step) return null
  const common = { setAnswer: setPending, checked: checked ? { correct: checked.correct } : null, complete: onComplete, translit: profile.translit, speaking: profile.speaking }
  const selfCompleting = SELF_COMPLETING.has(step.ex.type)

  return (
    <div className={`flow session ${trackTone}`}>
      <header className="session__head flow__pad">
        <button type="button" className="session__close" onClick={() => setConfirmQuit(true)} aria-label="Leave lesson">
          <IconClose />
        </button>
        <div className="gv-progress session__progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="gv-progress__fill" style={{ width: `${Math.max(4, progress * 100)}%` }} />
        </div>
        {isSpeed ? (
          <span className="session__timer t-stat" aria-label="Time">
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          </span>
        ) : (
          <AnimatePresence>
            {combo >= 3 && (
              <motion.span key="combo" className="session__combo t-stat" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} aria-label={`${combo} in a row`}>
                <IconFlame />
                {combo}
              </motion.span>
            )}
          </AnimatePresence>
        )}
      </header>

      <main className="session__body flow__pad">
        <AnimatePresence mode="wait">
          <motion.div key={step.key + idx} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
            {step.attempt > 1 && <p className="session__retry t-caption">Let's try this one again</p>}
            <ExerciseView ex={step.ex} common={common} />
          </motion.div>
        </AnimatePresence>
      </main>

      {!(selfCompleting && step.ex.type !== 'intro') && (
        <footer className="session__foot">
          <AnimatePresence mode="wait">
            {checked ? (
              <motion.div key="fb" className={`gv-feedback ${checked.correct ? '' : 'gv-feedback--wrong'}`} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 32 }} role="status">
                <div className="gv-feedback__head">
                  <span className="gv-feedback__badge">{checked.correct ? <IconCheck /> : <IconX />}</span>
                  <div className="session__fbtext">
                    {checked.correct ? (
                      <>
                        <p className="gv-feedback__title">
                          <span lang="bg">{checked.praise.bg}</span> <span className="session__fben">{checked.praise.en}</span>
                        </p>
                        {checked.note === 'typo' && <p className="gv-feedback__tr">Watch the spelling: {checked.solution}</p>}
                        {checked.note === 'latin' && (
                          <p className="gv-feedback__tr">
                            In Cyrillic: <span lang="bg">{checked.solution}</span>
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="gv-feedback__title">Not quite</p>
                        <p className="gv-feedback__answer">
                          <span lang="bg">{checked.solution}</span>
                        </p>
                        {checked.solutionTr && <p className="gv-feedback__tr">{checked.solutionTr}</p>}
                      </>
                    )}
                  </div>
                  <Mascot mood={checked.correct ? 'happy' : 'sad'} size={64} className="session__mascot" />
                </div>
                <button type="button" className={`gv-btn gv-btn--block ${checked.correct ? 'gv-tone-pine' : 'gv-tone-rose'}`} onClick={() => void advance()}>
                  {checked.correct ? 'Continue' : 'Got it'}
                </button>
              </motion.div>
            ) : (
              <motion.div key="act" className="session__actions flow__pad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {step.ex.type === 'intro' ? (
                  <button type="button" className="gv-btn gv-btn--block" onClick={() => void onComplete(true)}>
                    Continue
                  </button>
                ) : (
                  <button type="button" className="gv-btn gv-btn--block" disabled={!pending} onClick={() => void onCheck()}>
                    Check
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </footer>
      )}

      <AnimatePresence>
        {confirmQuit && (
          <motion.div className="session__scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmQuit(false)}>
            <motion.div className="gv-sheet session__quit" initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} transition={{ type: 'spring', stiffness: 400, damping: 36 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="quit-title">
              <div className="gv-sheet__grip" />
              <Mascot mood="sad" size={96} />
              <h2 id="quit-title" className="t-card-title">
                Leave this lesson?
              </h2>
              <p className="muted">You'll lose the progress from this lesson. Two more minutes keeps the streak alive.</p>
              <button type="button" className="gv-btn gv-btn--block" onClick={() => setConfirmQuit(false)} autoFocus>
                Keep learning
              </button>
              <button type="button" className="gv-btn gv-btn--ghost gv-btn--block" onClick={quit}>
                Leave
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type Common = Omit<Parameters<typeof ChoiceExercise>[0], 'ex'>

function ExerciseView({ ex, common }: { ex: Exercise; common: Common }) {
  switch (ex.type) {
    case 'intro':
      return <IntroExercise ex={ex} {...common} />
    case 'match':
      return <MatchExercise ex={ex} {...common} />
    case 'build':
      return <BuildExercise ex={ex} {...common} />
    case 'type_bg':
    case 'listen_type':
      return <TypeExercise ex={ex} {...common} />
    case 'speak':
      return common.speaking ? <SpeakExercise ex={ex} {...common} /> : <SkipSpeak complete={common.complete} />
    case 'dialogue':
      return <DialogueExercise ex={ex} {...common} />
    default:
      return <ChoiceExercise ex={ex} {...common} />
  }
}

function SkipSpeak({ complete }: { complete: Common['complete'] }) {
  useEffect(() => {
    complete(null)
  }, [complete])
  return null
}
