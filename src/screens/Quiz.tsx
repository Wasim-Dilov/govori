import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { StudyItem } from '../content/index.ts'
import { IconCheck, IconClose, IconSpeaker, IconX } from '../components/Icons.tsx'
import { Illustration } from '../components/Illustration.tsx'
import { sfx, speak, stopSpeaking, unlockAudio } from '../lib/audio.ts'
import { logQuiz, quizMeDeck } from '../lib/custom.ts'
import { newSessionId } from '../lib/progress.ts'
import { getPartner } from '../lib/shareCard.ts'
import { useApp } from '../lib/store.ts'
import './quiz.css'

type Phase = 'loading' | 'intro' | 'card' | 'empty'

/**
 * "Quiz me": the couple mode. He hands her the phone; she sees each word in English and
 * Bulgarian, he says it aloud, and she taps whether he got it. Logged as speaking practice.
 */
export function QuizScreen() {
  const speaker = useApp((s) => s.profile.speaker)
  const translit = useApp((s) => s.profile.translit)
  const finishQuiz = useApp((s) => s.finishQuiz)
  const go = useApp((s) => s.go)
  const [phase, setPhase] = useState<Phase>('loading')
  const [deck, setDeck] = useState<StudyItem[]>([])
  const [partner, setPartner] = useState('')
  const [idx, setIdx] = useState(0)
  const score = useRef({ correct: 0, total: 0 })
  const session = useRef({ id: newSessionId(), start: Date.now() })
  const cardStart = useRef(Date.now())
  const finishing = useRef(false)

  useEffect(() => {
    let live = true
    void Promise.all([quizMeDeck(speaker, 10), getPartner()]).then(([d, p]) => {
      if (!live) return
      setDeck(d)
      setPartner(p?.name?.trim() ?? '')
      setPhase(d.length ? 'intro' : 'empty')
    })
    return () => {
      live = false
      stopSpeaking()
    }
  }, [speaker])

  const card = deck[idx]
  const her = partner || 'her'
  const She = partner || 'She'

  const start = () => {
    unlockAudio()
    session.current = { id: newSessionId(), start: Date.now() }
    cardStart.current = Date.now()
    setPhase('card')
  }

  const answer = async (correct: boolean) => {
    if (!card || finishing.current) return
    stopSpeaking()
    if (correct) sfx.correct()
    else sfx.wrong()
    score.current.total++
    if (correct) score.current.correct++
    await logQuiz(card.id, correct, session.current.id, Date.now() - cardStart.current)
    if (idx + 1 < deck.length) {
      setIdx(idx + 1)
      cardStart.current = Date.now()
      return
    }
    finishing.current = true
    await finishQuiz({ sessionId: session.current.id, start: session.current.start, correct: score.current.correct, total: score.current.total })
  }

  const leave = () => {
    stopSpeaking()
    go({ name: 'me' })
  }

  return (
    <div className="flow quiz">
      <header className="quiz__head flow__pad">
        <button type="button" className="quiz__close" onClick={leave} aria-label="Close quiz">
          <IconClose />
        </button>
        {phase === 'card' ? (
          <div className="gv-progress quiz__progress" role="progressbar" aria-valuemin={0} aria-valuemax={deck.length} aria-valuenow={idx}>
            <div className="gv-progress__fill" style={{ width: `${Math.max(4, (idx / deck.length) * 100)}%` }} />
          </div>
        ) : (
          <p className="quiz__title t-headline">Quiz me</p>
        )}
        {phase === 'card' && <span className="quiz__count t-footnote">{idx + 1} of {deck.length}</span>}
      </header>

      <main className="quiz__body flow__pad">
        <AnimatePresence mode="wait">
          {phase === 'loading' && <div key="l" className="quiz__center" aria-busy="true" />}

          {phase === 'empty' && (
            <motion.div key="e" className="quiz__center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Illustration name="phrases" size={112} />
              <h1 className="t-title2">Nothing to quiz yet</h1>
              <p className="muted quiz__lead">Finish a lesson or two first. Then {her} can quiz you on what you have learned.</p>
              <button type="button" className="gv-btn gv-btn--block" onClick={() => go({ name: 'home' })}>
                Start learning
              </button>
            </motion.div>
          )}

          {phase === 'intro' && (
            <motion.div key="i" className="quiz__center" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}>
              <Illustration name="quiz" size={128} />
              <h1 className="t-title1 quiz__headline">Hand the phone to {her}</h1>
              <p className="quiz__lead muted">
                {She} sees {deck.length} words and phrases you have learned. You say each one out loud in Bulgarian. {She} taps whether you got it.
              </p>
              <ol className="gv-list quiz__steps">
                <li className="gv-row">
                  <span className="quiz__num">1</span>
                  <span className="gv-row__body">
                    <span className="gv-row__title">{She} reads the English to you</span>
                  </span>
                </li>
                <li className="gv-row">
                  <span className="quiz__num">2</span>
                  <span className="gv-row__body">
                    <span className="gv-row__title">You say it in Bulgarian</span>
                  </span>
                </li>
                <li className="gv-row">
                  <span className="quiz__num">3</span>
                  <span className="gv-row__body">
                    <span className="gv-row__title">{She} taps “Said it right” or “Not yet”</span>
                  </span>
                </li>
              </ol>
              <button type="button" className="gv-btn gv-btn--block quiz__go" onClick={start}>
                Start the quiz
              </button>
            </motion.div>
          )}

          {phase === 'card' && card && (
            <motion.section key={card.id + idx} className="quiz__card-wrap" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
              <p className="t-footnote quiz__ask">Ask him: how do you say</p>
              <div className="gv-card quiz__card">
                {card.emoji && (
                  <span className="quiz__emoji" aria-hidden="true">
                    {card.emoji}
                  </span>
                )}
                <p className="quiz__en t-title2">{card.en}</p>
                <div className="quiz__answer">
                  <p className="quiz__bg" lang="bg">
                    {card.bg}
                  </p>
                  {translit && <p className="quiz__tr">{card.tr}</p>}
                  <button type="button" className="gv-btn gv-btn--tinted gv-btn--sm quiz__play" onClick={() => void speak(card.bg, { itemId: card.id })}>
                    <IconSpeaker /> Play
                  </button>
                </div>
              </div>
              <p className="t-footnote muted quiz__hint">Keep the screen turned towards you, so he answers from memory.</p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {phase === 'card' && card && (
        <footer className="quiz__foot flow__pad">
          <button type="button" className="quiz__judge quiz__judge--no" onClick={() => void answer(false)}>
            <span className="quiz__judge-icon" aria-hidden="true">
              <IconX />
            </span>
            Not yet
          </button>
          <button type="button" className="quiz__judge quiz__judge--yes" onClick={() => void answer(true)}>
            <span className="quiz__judge-icon" aria-hidden="true">
              <IconCheck />
            </span>
            Said it right
          </button>
        </footer>
      )}
    </div>
  )
}
