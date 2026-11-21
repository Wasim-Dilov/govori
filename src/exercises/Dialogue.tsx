// A short conversation played like a chat. The learner picks their own lines,
// then answers one or two comprehension questions.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { DialogueLine, Who } from '../content/types.ts'
import { shuffle, translit } from '../lib/engine.ts'
import { sfx, speak, stopSpeaking, voiceForWho } from '../lib/audio.ts'
import { useApp } from '../lib/store.ts'
import { IconCheck, IconSpeaker } from '../components/Icons.tsx'
import type { ExerciseProps } from './types.ts'
import './exercises-d.css'

const CAST: Record<Who, { emoji: string; name: string; bg?: boolean }> = {
  me: { emoji: '🙂', name: 'You' },
  wife: { emoji: '👩', name: 'Your wife' },
  son: { emoji: '👦', name: 'Your son' },
  daughter: { emoji: '👧', name: 'Your daughter' },
  mil: { emoji: '👵', name: 'Тъща', bg: true },
  fil: { emoji: '👴', name: 'Тъст', bg: true },
  grandma: { emoji: '👵', name: 'Баба', bg: true },
  friend: { emoji: '🧑', name: 'A friend' },
  waiter: { emoji: '🧑‍🍳', name: 'Waiter' },
  seller: { emoji: '🧑‍🌾', name: 'Seller' },
  neighbour: { emoji: '🙋', name: 'Neighbour' },
}

type Step = { kind: 'line'; index: number } | { kind: 'question'; index: number }
type LogStep = { itemId: string; correct: boolean; answer: string; ms: number }


export function DialogueExercise({ ex, complete, translit: showTr }: ExerciseProps<'dialogue'>) {
  const d = ex.dialogue
  const speaker = useApp((s) => s.profile.speaker)
  const steps = useMemo<Step[]>(
    () => [...d.lines.map((_, index) => ({ kind: 'line' as const, index })), ...d.questions.map((_, index) => ({ kind: 'question' as const, index }))],
    [d],
  )

  /** The learner's version of a line (woman's form when it applies). */
  const say = (l: DialogueLine) => (l.who === 'me' && speaker === 'f' && l.f ? l.f : { bg: l.bg, tr: l.tr })

  // Options for each "me" line, shuffled once.
  const options = useMemo(() => {
    const out: Record<number, { text: string; right: boolean }[]> = {}
    d.lines.forEach((l, i) => {
      if (l.who !== 'me') return
      out[i] = shuffle([{ text: say(l).bg, right: true }, ...(l.wrong ?? []).slice(0, 2).map((text) => ({ text, right: false }))])
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, speaker])

  const [pos, setPos] = useState(0)
  const [revealed, setRevealed] = useState<number[]>([])
  const [typing, setTyping] = useState<Who | null>(null)
  const [ready, setReady] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<number[]>([])
  const [rightPick, setRightPick] = useState<number | null>(null)
  const [hint, setHint] = useState(false)
  const [english, setEnglish] = useState<number[]>([])
  const [playing, setPlaying] = useState<number | null>(null)

  const log = useRef<LogStep[]>([])
  const shownAt = useRef(Date.now())
  const firstPick = useRef<string | null>(null)
  const run = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)
  const dock = useRef<HTMLDivElement>(null)
  const done = useRef(false)

  const step = steps[pos]
  const line = step?.kind === 'line' ? d.lines[step.index] : null
  const question = step?.kind === 'question' ? d.questions[step.index] : null
  const isMe = line?.who === 'me'

  // Play each step as it arrives.
  useEffect(() => {
    if (!step) return
    const id = ++run.current
    setReady(false)
    setWrongPicks([])
    setRightPick(null)
    setHint(false)
    firstPick.current = null
    shownAt.current = Date.now()
    if (step.kind === 'line' && d.lines[step.index].who !== 'me') {
      const l = d.lines[step.index]
      setTyping(l.who)
      const t = setTimeout(async () => {
        if (id !== run.current) return
        setTyping(null)
        setRevealed((r) => (r.includes(step.index) ? r : [...r, step.index]))
        setReady(true)
        setPlaying(step.index)
        await speak(l.bg, { voice: voiceForWho(l.who, speaker) })
        if (id === run.current) setPlaying(null)
      }, 700)
      return () => {
        clearTimeout(t)
      }
    }
    return undefined
  }, [pos, step, d])

  useEffect(() => () => stopSpeaking(), [])

  // Keep the newest bubble visible above the sticky dock, whatever its height.
  useEffect(() => {
    const el = dock.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (bottom.current) bottom.current.style.scrollMarginBottom = `${el.offsetHeight + 12}px`
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60)
    return () => clearTimeout(t)
  }, [revealed.length, typing, pos, rightPick, wrongPicks.length])

  function pickLine(i: number) {
    if (!line || rightPick !== null) return
    const opt = options[step.index][i]
    if (firstPick.current === null) firstPick.current = (hint ? 'hint+' : '') + opt.text
    if (!opt.right) {
      sfx.wrong()
      setWrongPicks((w) => [...w, i])
      return
    }
    sfx.correct()
    setRightPick(i)
    log.current.push({
      itemId: `${d.id}.${step.index}`,
      correct: wrongPicks.length === 0,
      answer: firstPick.current,
      ms: Date.now() - shownAt.current,
    })
    const id = run.current
    setTimeout(async () => {
      if (id !== run.current) return
      setRevealed((r) => [...r, step.index])
      setReady(true)
      setPlaying(step.index)
      await speak(say(line).bg, { voice: voiceForWho(line.who, speaker) })
      if (id === run.current) setPlaying(null)
    }, 450)
  }

  function pickAnswer(i: number) {
    if (!question || rightPick !== null) return
    if (firstPick.current === null) firstPick.current = question.options[i]
    if (i !== question.answer) {
      sfx.wrong()
      setWrongPicks((w) => [...w, i])
      return
    }
    sfx.correct()
    setRightPick(i)
    log.current.push({ itemId: `${d.id}.q${step.index}`, correct: wrongPicks.length === 0, answer: firstPick.current, ms: Date.now() - shownAt.current })
    setReady(true)
  }

  function next() {
    stopSpeaking()
    setPlaying(null)
    if (pos < steps.length - 1) {
      sfx.tap()
      setPos(pos + 1)
      return
    }
    if (done.current) return
    done.current = true
    const total = log.current.length || 1
    const score = log.current.filter((s) => s.correct).length / total
    complete(score >= 0.6, { steps: log.current })
  }

  async function replay(i: number) {
    const l = d.lines[i]
    setPlaying(i)
    await speak(say(l).bg, { voice: voiceForWho(l.who, speaker) })
    setPlaying((p) => (p === i ? null : p))
  }

  const toggleEnglish = (i: number) => setEnglish((e) => (e.includes(i) ? e.filter((x) => x !== i) : [...e, i]))
  const progress = steps.length ? (pos + (ready ? 1 : 0)) / steps.length : 0

  return (
    <div className="dlg">
      <div className="dlg__scroll">
        <header className="dlg-scene">
          <div className="dlg-scene__emoji" aria-hidden="true">
            {d.emoji}
          </div>
          <div className="dlg-scene__text">
            <span className="dlg-scene__eyebrow">Conversation</span>
            <h2 className="dlg-scene__title">{d.title}</h2>
            <p className="dlg-scene__bg" lang="bg">
              {d.titleBg}
            </p>
            <p className="dlg-scene__setting">{d.scene}</p>
          </div>
        </header>

        <ol className="dlg-chat" aria-live="polite">
          {revealed.map((i) => {
            const l = d.lines[i]
            const me = l.who === 'me'
            const cast = CAST[l.who]
            const words = say(l)
            const showEn = english.includes(i)
            return (
              <motion.li
                key={i}
                className={`dlg-line ${me ? 'dlg-line--me' : ''}`}
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              >
                {!me && (
                  <span className="dlg-avatar" aria-hidden="true">
                    {cast.emoji}
                  </span>
                )}
                <div className="dlg-line__body">
                  {!me && (
                    <span className="dlg-line__who" lang={cast.bg ? 'bg' : undefined}>
                      {cast.name}
                    </span>
                  )}
                  <button
                    type="button"
                    className={`dlg-bubble ${me ? 'dlg-bubble--me' : ''} ${playing === i ? 'is-playing' : ''}`}
                    onClick={() => toggleEnglish(i)}
                    aria-expanded={showEn}
                    aria-label={`${words.bg}. Tap to ${showEn ? 'hide' : 'show'} the English.`}
                  >
                    <span className="dlg-bubble__bg" lang="bg">
                      {words.bg}
                    </span>
                    {showTr && <span className="dlg-bubble__tr">{words.tr}</span>}
                    <AnimatePresence initial={false}>
                      {showEn && (
                        <motion.span
                          className="dlg-bubble__en"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          {l.en}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
                <button type="button" className="dlg-replay" onClick={() => void replay(i)} aria-label="Play this line again">
                  <IconSpeaker />
                </button>
              </motion.li>
            )
          })}
          <AnimatePresence>
            {typing && (
              <motion.li
                key="typing"
                className="dlg-line"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <span className="dlg-avatar" aria-hidden="true">
                  {CAST[typing].emoji}
                </span>
                <div className="dlg-bubble dlg-bubble--typing" aria-label={`${CAST[typing].name} is typing`}>
                  <i />
                  <i />
                  <i />
                </div>
              </motion.li>
            )}
          </AnimatePresence>
        </ol>
        {revealed.length > 0 && !question && <p className="dlg-tip">Tap a bubble to see the English.</p>}
        <div ref={bottom} />
      </div>

      <div className="dlg-dock" ref={dock}>
        <div className="dlg-progress" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        <AnimatePresence mode="wait">
          {isMe && rightPick === null && line && (
            <motion.div key={`me-${pos}`} className="dlg-ask" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
              <div className="dlg-ask__head">
                <span className="t-prompt">What do you say?</span>
                {!hint ? (
                  <button type="button" className="dlg-hint" onClick={() => setHint(true)}>
                    Show a hint
                  </button>
                ) : (
                  <span className="dlg-hint__text">“{line.en}”</span>
                )}
              </div>
              <div className="dlg-options">
                {options[step.index].map((o, i) => {
                  const wrong = wrongPicks.includes(i)
                  return (
                    <button key={o.text} type="button" className={`gv-choice ${wrong ? 'is-wrong is-dim' : ''}`} disabled={wrong} onClick={() => pickLine(i)}>
                      <span className="gv-choice__key" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="gv-choice__text">
                        <span lang="bg">{o.text}</span>
                        {showTr && <span className="gv-choice__sub">{translit(o.text, 'ă')}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}

          {question && (
            <motion.div key={`q-${pos}`} className="dlg-ask" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
              <div className="dlg-ask__head">
                <span className="dlg-ask__eyebrow">Quick check</span>
                <span className="t-prompt">{question.q}</span>
              </div>
              <div className="dlg-options">
                {question.options.map((o, i) => {
                  const wrong = wrongPicks.includes(i)
                  const right = rightPick === i
                  return (
                    <button
                      key={o}
                      type="button"
                      className={`gv-choice ${wrong ? 'is-wrong is-dim' : ''} ${right ? 'is-correct' : ''} ${rightPick !== null && !right ? 'is-dim' : ''}`}
                      disabled={wrong || rightPick !== null}
                      onClick={() => pickAnswer(i)}
                    >
                      <span className="gv-choice__key" aria-hidden="true">
                        {right ? <IconCheck width={14} height={14} /> : i + 1}
                      </span>
                      <span className="gv-choice__text">{o}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {(ready || (isMe && rightPick !== null)) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="dlg-continue">
            <button
              type="button"
              className={`gv-btn gv-btn--block ${(isMe || question) && rightPick !== null ? 'gv-tone-pine' : ''}`}
              onClick={next}
              disabled={!ready}
            >
              {pos < steps.length - 1 ? 'Continue' : 'Finish'}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
