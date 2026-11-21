// Record, play and replace one item's audio (e.g. in his wife's voice). 10-second cap.
import { useEffect, useRef, useState } from 'react'
import { deleteRecording, playBlob, saveRecording, startRecording, type Recorder as Rec } from '../lib/audio.ts'
import { db } from '../lib/db.ts'
import { IconMic, IconPlay, IconStop, IconX } from './Icons.tsx'
import '../screens/me.css'

const CAP_MS = 10_000

export function Recorder({ itemId, label, onChange }: { itemId: string; label: string; onChange?: (has: boolean) => void }) {
  const [has, setHas] = useState(false)
  const [state, setState] = useState<'idle' | 'recording' | 'saving' | 'playing'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const rec = useRef<Rec | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const started = useRef(0)

  useEffect(() => {
    let alive = true
    db.recordings
      .get(itemId)
      .then((r) => alive && setHas(!!r))
      .catch(() => {})
    return () => {
      alive = false
      window.clearInterval(timer.current)
      rec.current?.cancel()
    }
  }, [itemId])

  async function stop() {
    window.clearInterval(timer.current)
    const r = rec.current
    rec.current = null
    if (!r) return
    setState('saving')
    try {
      const blob = await r.stop()
      if (blob.size > 0) {
        await saveRecording(itemId, blob)
        setHas(true)
        onChange?.(true)
      }
    } finally {
      setState('idle')
      setElapsed(0)
    }
  }

  async function start() {
    setError('')
    try {
      rec.current = await startRecording()
      started.current = Date.now()
      setState('recording')
      setElapsed(0)
      timer.current = window.setInterval(() => {
        const ms = Date.now() - started.current
        setElapsed(ms)
        if (ms >= CAP_MS) void stop()
      }, 200)
    } catch {
      setError('The microphone is blocked. Allow it for Govori in the iPhone Settings app.')
      setState('idle')
    }
  }

  async function play() {
    const r = await db.recordings.get(itemId)
    if (!r) return
    setState('playing')
    await playBlob(r.blob)
    setState('idle')
  }

  async function remove() {
    await deleteRecording(itemId)
    setHas(false)
    onChange?.(false)
  }

  const secs = Math.min(10, Math.floor(elapsed / 1000))

  return (
    <div className="rec">
      {state === 'recording' ? (
        <>
          <span className="rec-live" role="status">
            <span className="rec-dot" aria-hidden="true" />
            0:{String(secs).padStart(2, '0')}
            <span className="rec-cap">/ 0:10</span>
          </span>
          <button type="button" className="gv-iconbtn gv-iconbtn--sm gv-tone-rose rec-btn" onClick={() => void stop()} aria-label={`Stop recording ${label}`}>
            <IconStop />
          </button>
        </>
      ) : has ? (
        <>
          <button
            type="button"
            className={`gv-iconbtn gv-iconbtn--sm gv-tone-pick rec-btn ${state === 'playing' ? 'is-playing' : ''}`}
            onClick={() => void play()}
            aria-label={`Play her recording of ${label}`}
            disabled={state !== 'idle'}
          >
            <IconPlay />
          </button>
          <button type="button" className="gv-iconbtn gv-iconbtn--sm gv-tone-rose rec-btn" onClick={() => void start()} aria-label={`Record ${label} again`} disabled={state !== 'idle'}>
            <IconMic />
          </button>
          <button type="button" className="rec-del" onClick={() => void remove()} aria-label={`Delete recording of ${label}`} disabled={state !== 'idle'}>
            <IconX />
          </button>
        </>
      ) : (
        <button type="button" className="gv-iconbtn gv-iconbtn--sm gv-tone-rose rec-btn" onClick={() => void start()} aria-label={`Record ${label}`} disabled={state !== 'idle'}>
          <IconMic />
        </button>
      )}
      {error && (
        <p className="rec-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default Recorder
