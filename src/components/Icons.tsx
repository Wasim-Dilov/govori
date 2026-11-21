// Govori's icon set: chunky 2.5px strokes with round caps, drawn on a 24px grid.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = (p: P) => ({ width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p })

export const IconSpeaker = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
)
export const IconTurtle = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 15c0-4 3-7 7-7s7 3 7 7z" fill="currentColor" stroke="none" />
    <path d="M18 13.5h1.5a1.5 1.5 0 0 0 0-3H18M6 15v2.5M15.5 15v2.5M3 15h16" />
  </svg>
)
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const IconCheck = (p: P) => (
  <svg {...base({ strokeWidth: 3, ...p })}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)
export const IconX = (p: P) => (
  <svg {...base({ strokeWidth: 3, ...p })}>
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
)
export const IconFlame = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <path d="M12 2.5c1 3.2 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.3 2.4-5.4.2 1.6 1 2.6 2 3 0-3.6.2-6 1.1-8.6z" fill="var(--gold)" />
    <path d="M12 12.5c.6 1.4 2.5 2.4 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1.6 1-2.6 2.5-4.6z" fill="var(--gold-deep)" />
  </svg>
)
export const IconFlameOff = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <path d="M12 2.5c1 3.2 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.3 2.4-5.4.2 1.6 1 2.6 2 3 0-3.6.2-6 1.1-8.6z" fill="var(--line-strong)" />
  </svg>
)
/** The eight-pointed embroidered star (осмолъчка), used for XP and stars. */
export const IconStar = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <path d="M12 1.5l3 4.2 5.2-.9-.9 5.2 4.2 3-4.2 3 .9 5.2-5.2-.9-3 4.2-3-4.2-5.2.9.9-5.2L.5 13l4.2-3-.9-5.2 5.2.9z" fill="currentColor" />
    <rect x="9.6" y="10.6" width="4.8" height="4.8" transform="rotate(45 12 13)" fill="var(--linen-raised)" />
  </svg>
)
export const IconBolt = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <path d="M13.5 2L5 13.5h6L10 22l9-12h-6z" fill="currentColor" />
  </svg>
)
export const IconPath = (p: P) => (
  <svg {...base(p)}>
    <circle cx="7" cy="6" r="2.6" fill="currentColor" stroke="none" />
    <circle cx="17" cy="12" r="2.6" fill="currentColor" stroke="none" />
    <circle cx="8" cy="19" r="2.6" fill="currentColor" stroke="none" />
    <path d="M9.4 7.3l5.3 3.4M14.8 13.6l-4.6 3.9" />
  </svg>
)
export const IconLetters = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <text x="1" y="18.5" fontSize="15" fontWeight="800" fontFamily="var(--font-text)" fill="currentColor">
      Аа
    </text>
  </svg>
)
export const IconChart = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
  </svg>
)
export const IconUser = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
)
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" stroke="none" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
)
export const IconMic = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
)
export const IconStop = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
  </svg>
)
export const IconPlay = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
)
export const IconBook = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
  </svg>
)
export const IconChat = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5h16v11H10l-4.5 4v-4H4z" fill="currentColor" stroke="none" />
    <path d="M8 9.5h8M8 12.5h5" stroke="var(--linen-raised)" />
  </svg>
)
export const IconRefresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5" />
  </svg>
)
export const IconTarget = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
  </svg>
)
export const IconBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" fill="currentColor" stroke="none" />
    <path d="M10 21h4" />
  </svg>
)
export const IconChevron = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)
export const IconBack = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const IconShare = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5M5 12v7.5h14V12" />
  </svg>
)
export const IconHeart = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <path d="M12 20.5s-8-4.6-8-10.4A4.6 4.6 0 0 1 12 7.3a4.6 4.6 0 0 1 8 2.8c0 5.8-8 10.4-8 10.4z" fill="currentColor" />
  </svg>
)
