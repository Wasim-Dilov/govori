import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useApp } from '../lib/store.ts'
import { liveStreak, practicedToday, xpToday } from '../lib/progress.ts'
import { IconCheck, IconFlame } from './Icons.tsx'
import './chrome.css'

/** True once the page has scrolled past the large title, so the compact navbar takes over. */
export function useScrolled(threshold = 44) {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [threshold])
  return scrolled
}

/** A thin Apple-Fitness-style ring that fills with today's XP toward the daily goal. */
export function GoalRing({ value, goal, size = 28, width = 3.5, children, label }: { value: number; goal: number; size?: number; width?: number; children?: ReactNode; label?: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const reached = pct >= 100
  const style = { '--value': pct, '--ring-size': `${size}px`, '--ring-width': width } as CSSProperties
  return (
    <span className={`gv-ring-wrap goal-ring${reached ? ' is-reached' : ''}`} role="img" aria-label={label ?? `${value} of ${goal} XP today`}>
      <svg className="gv-ring" viewBox="0 0 36 36" style={style} aria-hidden="true">
        <circle className="gv-ring__track" cx="18" cy="18" r="16" />
        <circle className="gv-ring__value" cx="18" cy="18" r="16" pathLength={100} />
      </svg>
      {children !== undefined ? (
        <span className="gv-ring__label" aria-hidden="true">
          {children}
        </span>
      ) : reached ? (
        <span className="gv-ring__label goal-ring__check" aria-hidden="true">
          <IconCheck />
        </span>
      ) : null}
    </span>
  )
}

/** Flame and day count; rose once today's practice is done. */
export function Streak() {
  const summary = useApp((s) => s.summary)
  const streak = liveStreak(summary)
  const today = practicedToday(summary)
  return (
    <span className={`nav-streak${today ? ' is-on' : ''}`} aria-label={`${streak} day streak${today ? '' : ', not practised yet today'}`}>
      <IconFlame filled={today} />
      <span aria-hidden="true">{streak}</span>
    </span>
  )
}

/** Compact translucent bar: its title fades in once the large title has scrolled away. */
export function NavBar({ title, leading, trailing }: { title: string; leading?: ReactNode; trailing?: ReactNode }) {
  const scrolled = useScrolled(44)
  return (
    <header className={`gv-navbar app-nav${scrolled ? ' is-scrolled' : ''}`}>
      {leading && <div className="gv-navbar__leading">{leading}</div>}
      <span className="gv-navbar__title" aria-hidden={!scrolled}>
        {title}
      </span>
      {trailing && <div className="gv-navbar__trailing">{trailing}</div>}
    </header>
  )
}

/** The large title that sits under the navbar at the top of a tab screen. */
export function LargeTitle({ children, sub, subLang }: { children: ReactNode; sub?: ReactNode; subLang?: string }) {
  return (
    <div className="app-largetitle">
      <h1 className="gv-largetitle">{children}</h1>
      {sub && (
        <p className="app-largetitle__sub" lang={subLang}>
          {sub}
        </p>
      )}
    </div>
  )
}

/** Home's navigation bar: "Learn", with the streak and today's goal ring on the right. */
export function TopBar() {
  const summary = useApp((s) => s.summary)
  const goal = useApp((s) => s.profile.dailyGoal)
  const xp = xpToday(summary)
  return (
    <NavBar
      title="Learn"
      trailing={
        <>
          <Streak />
          <GoalRing value={xp} goal={goal} size={26} label={`${xp} of ${goal} XP today`} />
        </>
      }
    />
  )
}
