// Say it out loud: hear the model, record yourself, compare, then rate honestly.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { playBlob, speak, startRecording, stopSpeaking, type Recorder } from '../lib/audio.ts'
import { IconMic, IconPlay, IconSpeaker, IconStop, IconTurtle } from '../components/Icons.tsx'
import { EmojiTile } from '../components/EmojiTile.tsx'
import type { ExerciseProps } from './types.ts'
import './exercises-d.css'

const CAP_MS = 8000

type Phase = 'idle' | 'recording' | 'recorded' | 'nomic'

export function SpeakExercise({ ex, complete, translit: showTr }: ExerciseProps<'speak'>) {
  const item = ex.item
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [modelPlaying, setModelPlaying] = useState(false)
  const [mePlaying, setMePlaying] = useState(false)
  const rec = useRef<Recorder | null>(null)
  const blob = useRef<Blob | null>(null)
  const timer = useRef<number | null>(null)
  const startedAt = useRef(0)
  const finished = useRef(false)

  const playModel = async (slow = false) => {
    setModelPlaying(true)
    await speak(item.bg, { itemId: item.id, slow })
    setModelPlaying(false)
  }

  // Play the model once when the exercise appears.
  useEffect(() => {
    const t = setTimeout(() => void playModel(), 350)
    return () => {
      clearTimeout(t)
      stopSpeaking()
      rec.current?.cancel()
      if (timer.current) cancelAnimationFrame(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id])

  async function startRec() {
    stopSpeaking()
    try {
      rec.current = await startRecording()
    } catch {
      setPhase('nomic')
      return
    }
    setPhase('recording')
    startedAt.current = performance.now()
    const tick = () => {
      const ms = performance.now() - startedAt.current
      setElapsed(ms)
      if (ms >= CAP_MS) void stopRec()
      else timer.current = requestAnimationFrame(tick)
    }
    timer.current = requestAnimationFrame(tick)
  }

  async function stopRec() {
    if (timer.current) cancelAnimationFrame(timer.current)
    timer.current = null
    const r = rec.current
    rec.current = null
    if (!r) return
    blob.current = await r.stop()
    setPhase('recorded')
    void playMine()
  }

  async function playMine() {
    if (!blob.current) return
    setMePlaying(true)
    await playBlob(blob.current)
    setMePlaying(false)
  }

  function rate(ok: boolean | null) {
    if (finished.current) return
    finished.current = true
    stopSpeaking()
    rec.current?.cancel()
    complete(ok, { answer: ok === null ? 'skipped' : 'self-rated' })
  }

  const ring = Math.min(1, elapsed / CAP_MS)
  const C = 2 * Math.PI * 54

  return (
    <div className="spk">
      <h2 className="t-title3 spk-prompt">Say this out loud</h2>

      <div className="spk-card gv-card">
        <EmojiTile emoji={item.emoji} size={64} track={item.trackId} />
        <div className="spk-card__words">
          <p className="t-bg-word spk-card__bg" lang="bg">
            {item.bg}
          </p>
          {showTr && <p className="spk-card__tr">{item.tr}</p>}
          <p className="spk-card__en">{item.en}</p>
        </div>
        <div className="spk-card__listen">
          <button type="button" className={`gv-iconbtn ${modelPlaying ? 'is-playing' : ''}`} onClick={() => void playModel()} aria-label="Listen">
            <IconSpeaker />
          </button>
          <button type="button" className="gv-iconbtn gv-iconbtn--sm ex-slow" onClick={() => void playModel(true)} aria-label="Listen slowly">
            <IconTurtle />
          </button>
        </div>
      </div>

      <div className="spk-stage">
        <AnimatePresence mode="wait">
          {phase !== 'nomic' && phase !== 'recorded' && (
            <motion.div key="rec" className="spk-rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className={`spk-rec__wrap ${phase === 'recording' ? 'is-live' : ''}`}>
                <svg className="spk-rec__ring" viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r="54" className="spk-rec__track" />
                  <circle cx="60" cy="60" r="54" className="spk-rec__fill" strokeDasharray={C} strokeDashoffset={C * (1 - ring)} />
                </svg>
                <button
                  type="button"
                  className="spk-rec__btn"
                  onClick={() => (phase === 'recording' ? void stopRec() : void startRec())}
                  aria-label={phase === 'recording' ? 'Stop recording' : 'Record yourself'}
                >
                  {phase === 'recording' ? <IconStop /> : <IconMic />}
                </button>
              </div>
              <p className="spk-rec__label">{phase === 'recording' ? `Recording · ${Math.ceil((CAP_MS - elapsed) / 1000)}s` : 'Tap to record yourself'}</p>
            </motion.div>
          )}

          {phase === 'recorded' && (
            <motion.div key="compare" className="spk-compare" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <div className="gv-list">
                <button type="button" className={`gv-row spk-play ${modelPlaying ? 'is-playing' : ''}`} onClick={() => void playModel()}>
                  <span className="gv-row__icon">
                    <IconSpeaker />
                  </span>
                  <span className="gv-row__body">
                    <span className="gv-row__title">Model</span>
                    <span className="gv-row__subtitle">How it should sound</span>
                  </span>
                </button>
                <button type="button" className={`gv-row spk-play ${mePlaying ? 'is-playing' : ''}`} onClick={() => void playMine()}>
                  <span className="gv-row__icon">
                    <IconPlay />
                  </span>
                  <span className="gv-row__body">
                    <span className="gv-row__title">Your recording</span>
                    <span className="gv-row__subtitle">Compare the two</span>
                  </span>
                </button>
              </div>
              <button type="button" className="spk-again" onClick={() => void startRec()}>
                Record again
              </button>
            </motion.div>
          )}

          {phase === 'nomic' && (
            <motion.div key="nomic" className="spk-nomic gv-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="t-headline">The microphone isn't available</p>
              <p className="muted">
                You can allow it in the iPhone Settings app under Safari, Microphone. For now, say it out loud and rate yourself honestly.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="spk-actions ex-answers">
        {(phase === 'recorded' || phase === 'nomic') && (
          <motion.div className="spk-rate" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <button type="button" className="gv-btn gv-btn--block" onClick={() => rate(true)}>
              I said it right
            </button>
            <button type="button" className="gv-btn gv-btn--block gv-btn--quiet" onClick={() => rate(false)}>
              Not quite yet
            </button>
          </motion.div>
        )}
        <button type="button" className="spk-skip" onClick={() => rate(null)}>
          Can't speak now
        </button>
      </div>
    </div>
  )
}
