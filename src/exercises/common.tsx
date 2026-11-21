import { useEffect, useState } from 'react'
import { IconSpeaker, IconTurtle } from '../components/Icons.tsx'
import { speak } from '../lib/audio.ts'

/** Plays Bulgarian; shows a pulse while speaking. */
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
  const cls = `gv-iconbtn ${size === 'lg' ? 'gv-iconbtn--lg' : size === 'sm' ? 'gv-iconbtn--sm' : ''} ${slow ? 'gv-tone-pine' : ''} ${playing ? 'is-playing' : ''}`
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
  return <h2 className="t-prompt ex-prompt">{children}</h2>
}
