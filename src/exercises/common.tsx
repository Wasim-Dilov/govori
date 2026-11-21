import { useEffect, useState } from 'react'
import { IconSpeaker, IconTurtle } from '../components/Icons.tsx'
import { speak } from '../lib/audio.ts'

/** Plays Bulgarian; the icon pulses while speaking. Slow is a quiet gray button. */
export function SpeakButton({ text, itemId, size = 'md', slow = false, auto = false, label }: { text: string; itemId?: string; size?: 'sm' | 'md' | 'lg'; slow?: boolean; auto?: boolean; label?: string }) {
  const [playing, setPlaying] = useState(false)
  const play = async () => {
    setPlaying(true)
    await speak(text, { slow, itemId })
    setPlaying(false)
  }
  useEffect(() => {
    if (auto) void play()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, text])
  const cls = `gv-iconbtn ${size === 'lg' ? 'gv-iconbtn--lg' : size === 'sm' ? 'gv-iconbtn--sm' : ''} ${slow ? 'ex-slow' : ''} ${playing ? 'is-playing' : ''}`
  return (
    <button type="button" className={cls} onClick={play} aria-label={label ?? (slow ? 'Play slowly' : 'Play')}>
      {slow ? <IconTurtle /> : <IconSpeaker />}
    </button>
  )
}

/** Bulgarian text with optional transliteration underneath. */
export function Bg({ text, tr, showTr, className = '' }: { text: string; tr?: string; showTr?: boolean; className?: string }) {
  return (
    <span className={`ex-bg ${className}`}>
      <span lang="bg">{text}</span>
      {showTr && tr ? <span className="ex-tr">{tr}</span> : null}
    </span>
  )
}

export function Prompt({ children }: { children: React.ReactNode }) {
  return <h2 className="t-title3 ex-prompt">{children}</h2>
}

/** The English (or picture) cue for production exercises: a modest emoji tile and the meaning. */
export function Cue({ emoji, text }: { emoji?: string; text: string }) {
  return (
    <div className="ex-cue">
      {emoji ? (
        <span className="ex-cue__emoji" aria-hidden="true">
          {emoji}
        </span>
      ) : null}
      <span className="ex-cue__text">{text}</span>
    </div>
  )
}

/** Subtle entrance for lists of answers: a short fade, no bounce. */
export const fadeIn = (i: number) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number], delay: 0.03 * i },
})
