// Say it out loud: hear the model, record yourself, compare, then rate honestly.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { playBlob, speak, startRecording, stopSpeaking, type Recorder } from '../lib/audio.ts'
import { IconMic, IconPlay, IconSpeaker, IconStop, IconTurtle } from '../components/Icons.tsx'
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
      <h2 className="t-prompt">Say this out loud</h2>

      <div className="spk-card gv-card">
        <div className="spk-card__words">
          <span className="spk-card__emoji" aria-hidden="true">
            {item.emoji}
          </span>
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
          <button type="button" className="gv-iconbtn gv-iconbtn--sm" onClick={() => void playModel(true)} aria-label="Listen slowly">
            <IconTurtle />
          </button>
        </div>
      </div>

      <div className="spk-stage">
        <AnimatePresence mode="wait">
          {phase !== 'nomic' && phase !== 'recorded' && (
            <motion.div key="rec" className="spk-rec" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
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
              <p className="spk-rec__label">{phase === 'recording' ? `Listening… ${Math.ceil((CAP_MS - elapsed) / 1000)}s` : 'Tap and say it'}</p>
            </motion.div>
          )}

          {phase === 'recorded' && (
            <motion.div key="compare" className="spk-compare" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <button type="button" className={`spk-compare__btn gv-tone-pick ${modelPlaying ? 'is-playing' : ''}`} onClick={() => void playModel()}>
                <IconSpeaker />
                <span>Model</span>
              </button>
              <button type="button" className={`spk-compare__btn gv-tone-rose ${mePlaying ? 'is-playing' : ''}`} onClick={() => void playMine()}>
                <IconPlay />
                <span>You</span>
              </button>
              <button type="button" className="gv-btn gv-btn--ghost gv-btn--sm spk-compare__again" onClick={() => void startRec()}>
                Record again
              </button>
            </motion.div>
          )}

          {phase === 'nomic' && (
            <motion.div key="nomic" className="spk-nomic gv-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="t-body-strong">The microphone isn't available.</p>
              <p className="muted">
                You can allow it in the iPhone Settings app under Safari, Microphone. For now, say it out loud and rate yourself honestly.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="spk-actions">
        {(phase === 'recorded' || phase === 'nomic') && (
          <motion.div className="spk-rate" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <button type="button" className="gv-btn gv-btn--block gv-tone-pine" onClick={() => rate(true)}>
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
