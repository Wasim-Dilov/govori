import { useEffect, useState, type CSSProperties, type ReactNode, type SVGProps } from 'react'
import { useApp } from '../lib/store.ts'
import { xpToday } from '../lib/progress.ts'
import { GOAL_DAYS_PER_FREEZE, type StreakStatus } from '../lib/streak.ts'
import { IconCheck, IconFlame } from './Icons.tsx'
import './chrome.css'

/** A streak freeze: an SF-style snowflake line icon. */
export const IconSnowflake = (p: SVGProps<SVGSVGElement>) => (
  <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {[0, 60, -60].map((r) => (
      <path key={r} transform={`rotate(${r} 12 12)`} d="M12 3v18M9.6 4.6 12 7l2.4-2.4M9.6 19.4 12 17l2.4 2.4" />
    ))}
  </svg>
)

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

/**
 * Flame and day count, rose once today's practice is done, with a snowflake per freeze in hand.
 * A broken streak never shows a bare 0: a repairable one shows the old number muted, otherwise just the flame.
 */
export function Streak() {
  const st = useApp((s) => s.streak)
  const done = st.state === 'done'
  const shown = st.streak > 0 ? st.streak : st.repairable ? st.repairFrom : null
  const label =
    st.streak > 0
      ? `${st.streak} day streak${done ? '' : ', not practised yet today'}${st.freezes ? `, ${st.freezes} ${st.freezes === 1 ? 'freeze' : 'freezes'}` : ''}`
      : st.repairable
        ? `Your ${st.repairFrom} day streak can still be repaired`
        : 'Start a streak today'
  return (
    <span className={`nav-streak${done ? ' is-on' : ''}${st.streak === 0 ? ' is-off' : ''}`} aria-label={label}>
      <IconFlame filled={done} />
      {shown !== null && <span aria-hidden="true">{shown}</span>}
      {st.freezes > 0 && (
        <span className="nav-streak__freezes" aria-hidden="true">
          {Array.from({ length: st.freezes }, (_, i) => (
            <IconSnowflake key={i} />
          ))}
        </span>
      )}
    </span>
  )
}

/** "Tue 18:00", or "the end of Sunday" for a midnight deadline. */
const deadlineText = (ms: number) => {
  const d = new Date(ms)
  if (d.getHours() === 0 && d.getMinutes() === 0) return `the end of ${new Date(ms - 60_000).toLocaleDateString('en-GB', { weekday: 'long' })}`
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '')
}

/**
 * The streak in one calm line under the large title: freezes, a freeze that saved the streak,
 * a repair in progress, or the best run after a lapse. Never a bare broken "0".
 */
export function StreakStatusBlock() {
  const st = useApp((s) => s.streak)
  if (st.repairable) return <RepairNotice st={st} />
  const freezeNote = st.freezes > 0 ? `${st.freezes} ${st.freezes === 1 ? 'freeze' : 'freezes'}` : st.goalDays > 0 && st.streak > 0 ? `${st.goalDays}/${GOAL_DAYS_PER_FREEZE} to a freeze` : ''
  let text: ReactNode = null
  if (st.frozenToday) text = <>Streak saved with a freeze · {st.streak} days</>
  else if (st.state === 'frozen') text = <>A freeze covers yesterday · practise today</>
  else if (st.state === 'done') text = <>{st.streak}-day streak · done today</>
  else if (st.state === 'alive') text = <>{st.streak}-day streak · practise today</>
  else if (st.best > 0) text = <>Best: {st.best} days · a new run starts today</>
  if (!text) return null
  return (
    <p className={`streak-line${st.state === 'done' ? ' is-done' : ''}`}>
      {st.frozenToday || st.state === 'frozen' ? <IconSnowflake className="streak-line__icon is-frost" /> : <IconFlame className="streak-line__icon" filled={st.state === 'done'} />}
      <span className="streak-line__text">{text}</span>
      {freezeNote && st.state !== 'none' && (
        <span className={`streak-line__freeze${st.freezes > 0 ? ' has-freeze' : ''}`}>
          {st.freezes > 0 && <IconSnowflake className="streak-line__chip" />}
          {freezeNote}
        </span>
      )}
    </p>
  )
}

function RepairNotice({ st }: { st: StreakStatus }) {
  const doneCount = 2 - st.repairSessionsLeft
  return (
    <section className="streak-repair" aria-labelledby="repair-title">
      <div className="streak-repair__head">
        <span className="gv-row__icon streak-repair__icon" aria-hidden="true">
          <IconFlame />
        </span>
        <div className="streak-repair__text">
          <p id="repair-title" className="streak-repair__title">
            Repair your {st.repairFrom}-day streak
          </p>
          <p className="streak-repair__body">
            Do {st.repairSessionsLeft === 1 ? (st.repairNeedsFull ? 'one lesson or review' : 'one more session') : `${st.repairSessionsLeft} sessions`}
            {st.repairDeadline ? ` before ${deadlineText(st.repairDeadline)}` : ''} to bring it back.
          </p>
        </div>
      </div>
      <div className="streak-repair__dots" role="img" aria-label={`${doneCount} of 2 repair sessions done`}>
        {[0, 1].map((i) => (
          <i key={i} className={i < doneCount ? 'on' : ''} />
        ))}
      </div>
    </section>
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
