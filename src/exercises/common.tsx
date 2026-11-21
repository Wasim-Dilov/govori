import { useEffect, useState } from 'react'
import { IconSpeaker, IconTurtle } from '../components/Icons.tsx'
import { EmojiTile } from '../components/EmojiTile.tsx'
import { speak } from '../lib/audio.ts'

/**
 * Plays Bulgarian; the icon pulses while speaking. Slow is a quiet gray button.
 * Sizes: sm 36, md 44, lg 88 (listening), hero 64 (the rose play circle on the new-word intro).
 */
export function SpeakButton({ text, itemId, size = 'md', slow = false, auto = false, label }: { text: string; itemId?: string; size?: 'sm' | 'md' | 'lg' | 'hero'; slow?: boolean; auto?: boolean; label?: string }) {
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
  const sizeCls = size === 'lg' ? 'gv-iconbtn--lg' : size === 'sm' ? 'gv-iconbtn--sm' : size === 'hero' ? 'ex-play-hero' : ''
  const cls = `gv-iconbtn ${sizeCls} ${slow ? 'ex-slow' : ''} ${playing ? 'is-playing' : ''}`
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

/** The English (or picture) cue for production exercises: a framed emoji tile and the meaning. */
export function Cue({ emoji, text, track }: { emoji?: string; text: string; track?: string }) {
  return (
    <div className="ex-cue">
      {emoji ? <EmojiTile emoji={emoji} size={64} track={track} /> : null}
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

/** Scale a Bulgarian hero line down as it gets longer, so phrases never wrap into a wall. */
export const heroSize = (text: string): 'xl' | 'lg' | 'md' => (text.length <= 14 ? 'xl' : text.length <= 26 ? 'lg' : 'md')

/** Typographic quotes for English copy that arrives with straight ones (e.g. letter sound hints). */
export const curly = (s: string) => s.replace(/"([^"]*)"/g, '\u201c$1\u201d')
