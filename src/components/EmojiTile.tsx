import type { CSSProperties } from 'react'
import './emoji-tile.css'

/**
 * One consistent frame for vocabulary emoji: a rounded square (22% radius) tinted with the
 * item's track colour in light mode and the secondary fill in dark mode. The emoji fills 60%.
 * Sizes: 44 in list cells, 64 on cards, 96 on the new-word intro.
 */
export function EmojiTile({ emoji, size = 44, track, className = '' }: { emoji: string; size?: number; track?: string; className?: string }) {
  const style = {
    '--tile': `${size}px`,
    ...(track ? { '--tile-tint': `var(--trk-${track}-soft)` } : {}),
  } as CSSProperties
  return (
    <span className={`emoji-tile ${className}`} style={style} aria-hidden="true">
      {emoji}
    </span>
  )
}
