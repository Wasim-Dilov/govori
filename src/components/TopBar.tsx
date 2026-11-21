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
export function GoalRing({ value, goal, size = 28, width = 3, children, label }: { value: number; goal: number; size?: number; width?: number; children?: ReactNode; label?: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const reached = pct >= 100
  // Start empty and sweep to the value, so the ring closes visibly (600ms ease-out in CSS).
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  const style = { '--value': shown, '--ring-size': `${size}px`, '--ring-width': width } as CSSProperties
  return (
    <span className={`gv-ring-wrap goal-ring${reached ? ' is-reached' : ''}${shown <= 0 ? ' is-zero' : ''}`} role="img" aria-label={label ?? `${value} of ${goal} XP today`}>
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
 * Flame and day count, rose once today's practice is done, with the freezes in hand as one quiet capsule.
 * A broken streak never shows a bare 0: a repairable one shows the old number muted, otherwise just the flame.
 */
export function Streak() {
  const st = useApp((s) => s.streak)
  const done = st.state === 'done'
  const shown = st.streak > 0 ? st.streak : st.repairable ? st.repairFrom : null
  return (
    <span className={`nav-streak${done ? ' is-on' : ''}${st.streak === 0 ? ' is-off' : ''}`}>
      <IconFlame filled={done} />
      {shown !== null && <span>{shown}</span>}
      {st.freezes > 0 && (
        <span className="nav-streak__freezes">
          <IconSnowflake />
          {st.freezes > 1 && <span>{st.freezes}</span>}
        </span>
      )}
    </span>
  )
}

/** The streak in one sentence, for the navbar tip and screen readers. */
export function streakText(st: StreakStatus): string {
  const freezes = st.freezes > 0 ? ` · ${st.freezes} ${st.freezes === 1 ? 'freeze' : 'freezes'} saved` : st.goalDays > 0 && st.streak > 0 ? ` · ${st.goalDays} of ${GOAL_DAYS_PER_FREEZE} days to a freeze` : ''
  if (st.repairable) return `Your ${st.repairFrom}-day streak can still be repaired`
  if (st.frozenToday) return `A freeze saved your ${st.streak}-day streak`
  if (st.state === 'frozen') return `A freeze covers yesterday · practise today${freezes}`
  if (st.state === 'done') return `${st.streak}-day streak · done today${freezes}`
  if (st.state === 'alive') return `${st.streak}-day streak · practise today${freezes}`
  if (st.best > 0) return `Best run: ${st.best} days · a new one starts today`
  return 'Practise today to start a streak'
}

/** "Tue 18:00", or "the end of Sunday" for a midnight deadline. */
const deadlineText = (ms: number) => {
  const d = new Date(ms)
  if (d.getHours() === 0 && d.getMinutes() === 0) return `the end of ${new Date(ms - 60_000).toLocaleDateString('en-GB', { weekday: 'long' })}`
  return d.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '')
}

/**
 * Under the large title Home shows only what needs action: a streak that can still be repaired.
 * The everyday streak status lives in the navbar (tap it for the sentence).
 */
export function StreakStatusBlock() {
  const st = useApp((s) => s.streak)
  if (st.repairable) return <RepairNotice st={st} />
  return null
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

/** Home's navigation bar: "Learn", with the streak and today's goal ring on the right. Tap either for a one-line tip. */
export function TopBar() {
  const summary = useApp((s) => s.summary)
  const goal = useApp((s) => s.profile.dailyGoal)
  const st = useApp((s) => s.streak)
  const xp = xpToday(summary)
  const [tip, setTip] = useState<string | null>(null)
  useEffect(() => {
    if (!tip) return
    const t = setTimeout(() => setTip(null), 2600)
    return () => clearTimeout(t)
  }, [tip])
  const ringLabel = xp >= goal ? `Goal reached · ${xp} XP today` : `${xp} of ${goal} XP today`
  return (
    <>
      <NavBar
        title="Learn"
        trailing={
          <>
            <button type="button" className="nav-tap" onClick={() => setTip((t) => (t === 'streak' ? null : 'streak'))} aria-label={streakText(st)}>
              <Streak />
            </button>
            <button type="button" className="nav-tap" onClick={() => setTip((t) => (t === 'ring' ? null : 'ring'))} aria-label={ringLabel}>
              <GoalRing value={xp} goal={goal} label={ringLabel} />
            </button>
          </>
        }
      />
      {/* A zero-height sticky layer: the tip floats over the page instead of pushing it down. */}
      <div className="nav-tip-layer">
        {tip && (
          <p className="nav-tip" role="status" onClick={() => setTip(null)}>
            {tip === 'ring' ? ringLabel : streakText(st)}
          </p>
        )}
      </div>
    </>
  )
}
