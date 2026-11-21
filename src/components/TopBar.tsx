import { useState, type ReactNode } from 'react'
import { useApp, trackMeta } from '../lib/store.ts'
import { liveStreak, practicedToday, xpToday } from '../lib/progress.ts'
import { FocusSheet } from './FocusSheet.tsx'
import { IconBook, IconCheck, IconChevron, IconFlame, IconFlameOff } from './Icons.tsx'
import '../screens/home.css'

/** A ring that fills with today's XP toward the daily goal. */
export function GoalRing({ value, goal, size = 30, stroke = 4, children, label }: { value: number; goal: number; size?: number; stroke?: number; children?: ReactNode; label?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = goal > 0 ? Math.min(1, value / goal) : 0
  const reached = ratio >= 1
  return (
    <span className={`goal-ring${reached ? ' is-reached' : ''}`} style={{ width: size, height: size }} role="img" aria-label={label ?? `${value} of ${goal} XP today`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="goal-ring__track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="goal-ring__fill"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="goal-ring__inner">{children ?? (reached ? <IconCheck /> : null)}</span>
    </span>
  )
}

export function TopBar({ onOpenFocus }: { onOpenFocus?: () => void }) {
  const summary = useApp((s) => s.summary)
  const learned = useApp((s) => s.learned + s.lettersLearned)
  const viewTrack = useApp((s) => s.viewTrack)
  const goal = useApp((s) => s.profile.dailyGoal)
  const [open, setOpen] = useState(false)
  const track = trackMeta(viewTrack)
  const streak = liveStreak(summary)
  const today = practicedToday(summary)
  const xp = xpToday(summary)

  return (
    <header className="topbar">
      <div className="topbar__row">
        <button type="button" className={`topbar__track gv-tone-${track.id}`} onClick={() => (onOpenFocus ? onOpenFocus() : setOpen(true))} aria-label={`Track: ${track.title}. Change what you learn`}>
          <span className="topbar__emoji" aria-hidden="true">
            {track.emoji}
          </span>
          <span className="topbar__name">{track.title}</span>
          <IconChevron className="topbar__chev" />
        </button>
        <div className="topbar__stats">
          <span className={`gv-stat ${today ? 'gv-stat--streak' : 'gv-stat--muted'}`} aria-label={`${streak} day streak${today ? '' : ', not practised yet today'}`}>
            {today ? <IconFlame /> : <IconFlameOff />}
            <span>{streak}</span>
          </span>
          <span className="gv-stat gv-stat--xp topbar__xp">
            <GoalRing value={xp} goal={goal} size={26} stroke={4} />
            <span aria-hidden="true">{xp}</span>
          </span>
          <span className="gv-stat topbar__words" aria-label={`${learned} words and letters learned`}>
            <IconBook />
            <span aria-hidden="true">{learned}</span>
          </span>
        </div>
      </div>
      {!onOpenFocus && <FocusSheet open={open} onClose={() => setOpen(false)} />}
    </header>
  )
}
