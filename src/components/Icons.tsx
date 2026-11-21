// Govori icons: SF Symbols-style line icons on a 24px grid, 1.75px strokes, rounded joins.
// Pass `filled` for the filled variant (used for the active tab and emphasis).
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { filled?: boolean }

function base({ filled: _filled, ...p }: P, strokeWidth = 1.75) {
  return {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...p,
  }
}
const fillIf = (p: P) => (p.filled ? 'currentColor' : 'none')

export const IconSpeaker = (p: P) => (
  <svg {...base(p)}>
    <path d="M4.5 9.25h2.75L11.5 5.5v13l-4.25-3.75H4.5a1 1 0 0 1-1-1v-3.5a1 1 0 0 1 1-1z" fill={fillIf(p)} />
    <path d="M15 9.25a4 4 0 0 1 0 5.5M17.75 6.75a7.5 7.5 0 0 1 0 10.5" />
  </svg>
)
export const IconTurtle = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 15.5a7 7 0 0 1 14 0z" fill={fillIf(p)} />
    <path d="M18 14h1.25a1.75 1.75 0 0 0 0-3.5H18M6.5 15.5v2.25M15.5 15.5v2.25M8 12l3-3.25L14 12" />
  </svg>
)
export const IconClose = (p: P) => (
  <svg {...base(p, 2)}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
)
export const IconCheck = (p: P) => (
  <svg {...base(p, 2.25)}>
    <path d="M5.5 12.5l4.25 4.25L18.5 7.5" />
  </svg>
)
export const IconX = (p: P) => (
  <svg {...base(p, 2.25)}>
    <path d="M7 7l10 10M17 7L7 17" />
  </svg>
)
export const IconFlame = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3c.6 3 4.75 5 4.75 9.75A4.75 4.75 0 0 1 12 17.5a4.75 4.75 0 0 1-4.75-4.75c0-2.1 1.05-3.6 2-4.6.25 1.5.9 2.4 1.8 2.8C11 8 11.25 5.5 12 3z" fill={fillIf(p)} />
  </svg>
)
export const IconFlameOff = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3c.6 3 4.75 5 4.75 9.75A4.75 4.75 0 0 1 12 17.5a4.75 4.75 0 0 1-4.75-4.75c0-2.1 1.05-3.6 2-4.6.25 1.5.9 2.4 1.8 2.8C11 8 11.25 5.5 12 3z" />
  </svg>
)
/** The eight-pointed star of Bulgarian embroidery (осмолъчка), drawn as two overlapping squares. */
export const IconStar = (p: P) => (
  <svg {...base(p)}>
    <rect x="6" y="6" width="12" height="12" rx="1" fill={fillIf(p)} />
    <rect x="6" y="6" width="12" height="12" rx="1" transform="rotate(45 12 12)" fill={fillIf(p)} />
  </svg>
)
export const IconBolt = (p: P) => (
  <svg {...base(p)}>
    <path d="M13.25 3L5.5 13.25h5.75L10.75 21l7.75-10.25h-5.75z" fill={fillIf(p)} />
  </svg>
)
/** Learn: a short path of three steps. */
export const IconPath = (p: P) => (
  <svg {...base(p)}>
    <circle cx="6.5" cy="6" r="2.25" fill={fillIf(p)} />
    <circle cx="17.5" cy="12" r="2.25" fill={fillIf(p)} />
    <circle cx="6.5" cy="18" r="2.25" fill={fillIf(p)} />
    <path d="M8.5 7.1l7 3.8M15.5 13.1l-7 3.8" />
  </svg>
)
export const IconLetters = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <text x="12" y="17.25" textAnchor="middle" fontSize="15" fontWeight={p.filled ? 700 : 500} fontFamily="var(--font-text)" fill="currentColor">
      Аа
    </text>
  </svg>
)
export const IconChart = (p: P) => (
  <svg {...base(p)}>
    <rect x="4" y="12" width="4" height="8" rx="1.25" fill={fillIf(p)} />
    <rect x="10" y="4" width="4" height="16" rx="1.25" fill={fillIf(p)} />
    <rect x="16" y="8.5" width="4" height="11.5" rx="1.25" fill={fillIf(p)} />
  </svg>
)
export const IconUser = (p: P) =>
  p.filled ? (
    <svg {...base({ stroke: 'none', ...p })}>
      <path d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5zm0 4a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5zm0 12.75a7.2 7.2 0 0 1-5.4-2.45c.9-1.7 3-2.8 5.4-2.8s4.5 1.1 5.4 2.8A7.2 7.2 0 0 1 12 19.5z" fill="currentColor" />
    </svg>
  ) : (
    <svg {...base(p)}>
      <circle cx="12" cy="12" r="9.25" />
      <circle cx="12" cy="10" r="3.25" />
      <path d="M6.6 17.6c.9-1.75 3-2.85 5.4-2.85s4.5 1.1 5.4 2.85" />
    </svg>
  )
export const IconLock = (p: P) => (
  <svg {...base(p)}>
    <rect x="5.5" y="10.5" width="13" height="10" rx="2.25" fill={fillIf(p)} />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </svg>
)
export const IconMic = (p: P) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" fill={fillIf(p)} />
    <path d="M5.75 11a6.25 6.25 0 0 0 12.5 0M12 17.25V21M9 21h6" />
  </svg>
)
export const IconStop = (p: P) => (
  <svg {...base({ stroke: 'none', ...p })}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor" />
  </svg>
)
export const IconPlay = (p: P) => (
  <svg {...base({ strokeWidth: 1.5, ...p })}>
    <path d="M8 5.75v12.5a.75.75 0 0 0 1.14.64l10-6.25a.75.75 0 0 0 0-1.28l-10-6.25A.75.75 0 0 0 8 5.75z" fill="currentColor" />
  </svg>
)
export const IconBook = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 6.5C10.5 5 8.25 4.5 4.5 4.5v13c3.75 0 6 .5 7.5 2 1.5-1.5 3.75-2 7.5-2v-13c-3.75 0-6 .5-7.5 2z" fill={fillIf(p)} />
    <path d="M12 6.5v13" stroke={p.filled ? 'var(--linen-raised)' : 'currentColor'} />
  </svg>
)
export const IconChat = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4C7.3 4 3.75 7 3.75 10.75c0 2.05 1.05 3.85 2.75 5.1L5.75 19.5l3.9-2.05c.75.2 1.55.3 2.35.3 4.7 0 8.25-3 8.25-6.75S16.7 4 12 4z" fill={fillIf(p)} />
  </svg>
)
export const IconRefresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M19.25 12A7.25 7.25 0 1 1 17 6.75M19.25 4v4.5h-4.5" />
  </svg>
)
export const IconTarget = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.75" />
    <circle cx="12" cy="12" r="4.75" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
  </svg>
)
export const IconBell = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.25 16.75v-5.5a5.75 5.75 0 0 1 11.5 0v5.5l1.5 1.75H4.75z" fill={fillIf(p)} />
    <path d="M10 21h4" />
  </svg>
)
export const IconChevron = (p: P) => (
  <svg {...base(p, 2)}>
    <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
  </svg>
)
export const IconBack = (p: P) => (
  <svg {...base(p, 2)}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </svg>
)
export const IconShare = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5v11M8 7.25l4-3.75 4 3.75M8.5 10.5H6.75a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10.5a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H15.5" />
  </svg>
)
export const IconHeart = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 19.75s-7.75-4.5-7.75-10A4.25 4.25 0 0 1 12 7.25a4.25 4.25 0 0 1 7.75 2.5c0 5.5-7.75 10-7.75 10z" fill={fillIf(p)} />
  </svg>
)
