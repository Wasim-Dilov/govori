import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { useApp } from '../lib/store.ts'
import { db, localDay, type AnswerEvent, type Memory, type SessionRecord } from '../lib/db.ts'
import { learnerLevel, liveStreak } from '../lib/progress.ts'
import { alphabet, totalItems } from '../content/index.ts'
import { speak } from '../lib/audio.ts'
import { exportAll, type ExportOutcome } from '../lib/exportData.ts'
import {
  byTimeOfDay,
  bySkill,
  byWeekday,
  calendarWeeks,
  insights,
  practiceDays,
  scored,
  toughest,
  weeklyTrend,
  type DayActivity,
  type Rate,
} from '../lib/insights.ts'
import { IconChart, IconCheck, IconHeart, IconShare, IconSpeaker, IconStar, IconTarget } from '../components/Icons.tsx'
import { earnedCanDos } from '../lib/milestones.ts'
import { missionsDone } from '../lib/missions.ts'
import './stats.css'

interface Data {
  events: AnswerEvent[]
  sessions: SessionRecord[]
  memory: Memory[]
}

const pct = (r: Rate) => (r.n ? `${Math.round(r.accuracy * 100)}%` : 'n/a')
const fmt = (n: number) => n.toLocaleString('en-GB')
const dateLabel = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', opts)

const enter = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] as const } },
}

/** True once the page has scrolled past the large title, so the compact bar can take over. */
function useScrolled(threshold = 44) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [threshold])
  return scrolled
}

export function StatsScreen() {
  const summary = useApp((s) => s.summary)
  const profile = useApp((s) => s.profile)
  const mistakesCount = useApp((s) => s.mistakesCount)
  const startMistakes = useApp((s) => s.startMistakes)
  const goTab = useApp((s) => s.goTab)
  const [data, setData] = useState<Data | null>(null)
  const scrolled = useScrolled()

  useEffect(() => {
    let alive = true
    Promise.all([db.events.toArray(), db.sessions.toArray(), db.memory.toArray()])
      .then(([events, sessions, memory]) => alive && setData({ events, sessions, memory }))
      .catch(() => alive && setData({ events: [], sessions: [], memory: [] }))
    return () => {
      alive = false
    }
  }, [])

  const level = learnerLevel(summary.totalXp)
  const empty = data !== null && scored(data.events).length === 0 && data.sessions.length === 0

  return (
    <MotionConfig reducedMotion="user">
      <div className="screen st-root">
        <header className={`gv-navbar ${scrolled ? 'is-scrolled' : ''}`}>
          <span className="gv-navbar__title" aria-hidden="true">
            Stats
          </span>
        </header>
        <h1 className="gv-largetitle">Stats</h1>

        {data === null ? null : empty ? (
          <motion.section initial="hidden" animate="show" variants={enter} className="st-empty" aria-labelledby="st-empty-t">
            <span className="st-empty__icon" aria-hidden="true">
              <IconChart />
            </span>
            <h2 id="st-empty-t" className="t-title3">
              No stats yet
            </h2>
            <p className="t-callout muted">Finish your first lesson to see your streak, the time of day you learn best and the words that trip you up.</p>
            <button className="gv-btn" onClick={() => goTab('home')}>
              Start learning
            </button>
          </motion.section>
        ) : (
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
            <Filled
              data={data}
              summaryStreak={liveStreak(summary)}
              longest={summary.longestStreak}
              totalXp={summary.totalXp}
              goal={summary.dailyGoal}
              level={level}
              speaker={profile.speaker}
              translit={profile.translit}
              mistakesCount={mistakesCount}
              onPractise={() => void startMistakes()}
            />
          </motion.div>
        )}
      </div>
    </MotionConfig>
  )
}

// ------------------------------------------------------------- filled state

function Filled(props: {
  data: Data
  summaryStreak: number
  longest: number
  totalXp: number
  goal: number
  level: ReturnType<typeof learnerLevel>
  speaker: 'm' | 'f'
  translit: boolean
  mistakesCount: number
  onPractise: () => void
}) {
  const { data, level } = props
  const words = data.memory.filter((m) => !m.itemId.startsWith('az.')).length
  const letters = data.memory.filter((m) => m.itemId.startsWith('az.') && !m.itemId.includes('.r')).length
  const info = useMemo(() => insights(data.events), [data.events])
  const skills = useMemo(() => bySkill(data.events), [data.events])
  const parts = useMemo(() => byTimeOfDay(data.events), [data.events])
  const days = useMemo(() => byWeekday(data.events), [data.events])
  const trend = useMemo(() => weeklyTrend(data.events), [data.events])
  const tough = useMemo(() => toughest(data.events, props.speaker), [data.events, props.speaker])
  const activity = useMemo(() => practiceDays(data.events, data.sessions), [data.events, data.sessions])

  return (
    <>
      <motion.section variants={enter} className="gv-section" aria-label="Summary">
        <div className="gv-statgrid st-grid">
          <Cell label="Streak" value={fmt(props.summaryStreak)} unit={props.summaryStreak === 1 ? 'day' : 'days'} accent={props.summaryStreak > 0} />
          <Cell label="Longest streak" value={fmt(props.longest)} unit={props.longest === 1 ? 'day' : 'days'} />
          <Cell label="Words learned" value={fmt(words)} unit={`of ${fmt(totalItems)}`} />
          <Cell label="Total XP" value={fmt(props.totalXp)} unit="XP" />
        </div>
        {letters > 0 && (
          <p className="gv-section-footer">
            Plus {letters} of {alphabet.letters.length} Cyrillic letters.
          </p>
        )}
      </motion.section>

      <motion.section variants={enter} className="gv-section" aria-labelledby="st-level-t">
        <h2 id="st-level-t" className="gv-section-header">
          Level
        </h2>
        <div className="gv-list">
          <div className="gv-row st-level">
            <span className="gv-row__icon st-level__num" aria-hidden="true">
              {level.level}
            </span>
            <div className="gv-row__body">
              <span className="gv-row__title">
                <span lang="bg">{level.name.bg}</span>
              </span>
              <span className="gv-row__subtitle">{level.name.en}</span>
              <div className="gv-progress st-level__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)} aria-label="XP towards the next level">
                <motion.div className="gv-progress__fill" initial={{ width: 0 }} animate={{ width: `${Math.max(3, level.progress * 100)}%` }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
              </div>
            </div>
            <span className="gv-row__accessory st-level__xp">
              {fmt(props.totalXp - level.floor)}/{fmt(level.next - level.floor)}
            </span>
          </div>
        </div>
        <p className="gv-section-footer">
          {fmt(level.next - props.totalXp)} XP to level {level.level + 1}.
        </p>
      </motion.section>

      <CanDoSection />

      <TogetherSection sessions={data.sessions} />

      <motion.section variants={enter} className="gv-section" aria-labelledby="st-hl-t">
        <h2 id="st-hl-t" className="gv-section-header">
          Highlights
        </h2>
        <ul className="gv-list st-plain">
          {info.needMore > 0 ? (
            <li className="gv-row">
              <span className="gv-row__icon" aria-hidden="true">
                <IconChart />
              </span>
              <span className="gv-row__body">
                <span className="gv-row__title st-wrap">
                  Answer {info.needMore} more {info.needMore === 1 ? 'question' : 'questions'} to see your patterns: when you learn best and which skills need work.
                </span>
              </span>
            </li>
          ) : info.sentences.length ? (
            info.sentences.map((s) => (
              <li key={s} className="gv-row">
                <span className="gv-row__icon" aria-hidden="true">
                  {insightIcon(s)}
                </span>
                <span className="gv-row__body">
                  <span className="gv-row__title st-wrap">{s}</span>
                </span>
              </li>
            ))
          ) : (
            <li className="gv-row">
              <span className="gv-row__icon" aria-hidden="true">
                <IconStar />
              </span>
              <span className="gv-row__body">
                <span className="gv-row__title st-wrap">You're steady across the board. No skill or time of day stands out yet.</span>
              </span>
            </li>
          )}
        </ul>
      </motion.section>

      <motion.div variants={enter}>
        <Heatmap activity={activity} goal={props.goal} />
      </motion.div>

      {skills.length > 0 && (
        <motion.div variants={enter}>
          <SkillBars skills={skills} />
        </motion.div>
      )}

      <motion.div variants={enter}>
        <WhenBest parts={parts} days={days} />
      </motion.div>

      {trend.length >= 2 && (
        <motion.div variants={enter}>
          <TrendLine trend={trend} />
        </motion.div>
      )}

      <motion.section variants={enter} className="gv-section" aria-labelledby="st-tough-title">
        <h2 id="st-tough-title" className="gv-section-header">
          Words that trip you up
        </h2>
        {tough.length ? (
          <>
            <ul className="gv-list st-plain">
              {tough.map((t) => (
                <li key={t.id} className="gv-row st-tough">
                  <button className="gv-iconbtn gv-iconbtn--sm" aria-label={`Hear ${t.item.bg}`} onClick={() => void speak(t.item.bg, { itemId: t.id })}>
                    <IconSpeaker />
                  </button>
                  <span className="gv-row__body">
                    <span className="gv-row__title" lang="bg">
                      {t.item.bg}
                    </span>
                    <span className="gv-row__subtitle">{props.translit ? `${t.item.tr} · ${t.item.en}` : t.item.en}</span>
                  </span>
                  <span className="gv-row__accessory st-tough__score">
                    {t.n - t.wrong}/{t.n}
                    <span className="st-tough__right">right</span>
                  </span>
                </li>
              ))}
            </ul>
            <button className="gv-btn gv-btn--tinted gv-btn--block st-practise" disabled={props.mistakesCount === 0} onClick={props.onPractise}>
              <IconTarget /> {props.mistakesCount ? 'Practise these' : 'All fixed for now'}
            </button>
          </>
        ) : (
          <div className="gv-list">
            <p className="gv-row st-wrap muted">Nothing keeps tripping you up yet. Words show up here after three tries with at least one miss.</p>
          </div>
        )}
      </motion.section>

      <motion.div variants={enter}>
        <ExportSection />
      </motion.div>
    </>
  )
}

/** "I can…": the capability lines of every unit he has finished. */
function CanDoSection() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof earnedCanDos>> | null>(null)
  useEffect(() => {
    let alive = true
    earnedCanDos()
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [])
  if (items === null) return null
  return (
    <motion.section variants={enter} className="gv-section" aria-labelledby="st-cando-t">
      <h2 id="st-cando-t" className="gv-section-header">
        I can…
      </h2>
      <ul className="gv-list st-plain">
        {items.length ? (
          items.map((c) => (
            <li key={c.unitId} className="gv-row st-cando">
              <span className="st-cando__check" aria-hidden="true">
                <IconCheck />
              </span>
              <span className="gv-row__body">
                <span className="gv-row__title st-wrap">{c.canDo.replace(/^You can /, '')}</span>
                <span className="gv-row__subtitle">{c.title}</span>
              </span>
            </li>
          ))
        ) : (
          <li className="gv-row">
            <span className="st-cando__check is-empty" aria-hidden="true">
              <IconCheck />
            </span>
            <span className="gv-row__body">
              <span className="gv-row__title st-wrap muted">Finish a unit to unlock your first I can</span>
            </span>
          </li>
        )}
      </ul>
      {items.length > 0 && (
        <p className="gv-section-footer">
          {items.length} of the things you can now do in Bulgarian.
        </p>
      )}
    </motion.section>
  )
}

/** Using it for real: "Say it to her today" missions and "Quiz me" rounds this week. */
function TogetherSection({ sessions }: { sessions: SessionRecord[] }) {
  const [missions, setMissions] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    missionsDone(7)
      .then((n) => alive && setMissions(n))
      .catch(() => alive && setMissions(0))
    return () => {
      alive = false
    }
  }, [])
  const weekAgo = Date.now() - 7 * 86_400_000
  const quizzes = sessions.filter((s) => s.kind === 'quiz' && s.start >= weekAgo).length
  if (missions === null) return null
  return (
    <motion.section variants={enter} className="gv-section" aria-labelledby="st-together-t">
      <h2 id="st-together-t" className="gv-section-header">
        With her this week
      </h2>
      <div className="gv-list">
        <div className="gv-row">
          <span className="gv-row__icon st-together__icon" aria-hidden="true">
            <IconHeart />
          </span>
          <span className="gv-row__body">
            <span className="gv-row__title">Said it to her</span>
            <span className="gv-row__subtitle">{missions ? 'Phrases from "Say it to her today"' : 'Try today\'s phrase on Home'}</span>
          </span>
          <span className="gv-row__accessory st-together__n">{missions}</span>
        </div>
        <div className="gv-row">
          <span className="gv-row__icon st-together__icon" aria-hidden="true">
            <IconCheck />
          </span>
          <span className="gv-row__body">
            <span className="gv-row__title">Quiz me rounds</span>
            <span className="gv-row__subtitle">{quizzes ? 'She checked your speaking' : 'Start one from Me, Practise together'}</span>
          </span>
          <span className="gv-row__accessory st-together__n">{quizzes}</span>
        </div>
      </div>
    </motion.section>
  )
}

function insightIcon(s: string) {
  if (/morning|afternoon|evening|night|day|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i.test(s)) return <IconChart />
  if (/weak|skill|listen|typ|speak|build|recog|letter|conversation/i.test(s)) return <IconTarget />
  return <IconStar />
}

function Cell({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: boolean }) {
  return (
    <div className="gv-statcell">
      <span className="gv-statcell__label">{label}</span>
      <span className={`gv-statcell__value${accent ? ' st-accent' : ''}`}>
        {value}
        <span className="gv-statcell__unit">{unit}</span>
      </span>
    </div>
  )
}

// ------------------------------------------------------------- chart section with table view and tooltip

interface Tip {
  x: number
  y: number
  value: string
  label: string
  /** Which edge of the tooltip sits on the mark, so it never runs off the card. */
  align: 'start' | 'center' | 'end'
}

function ChartCard({ title, subtitle, table, children, id }: { title: string; subtitle?: string; id: string; table: { head: string[]; rows: (string | number)[][] }; children: (show: (e: { currentTarget: Element }, value: string, label: string) => void, hide: () => void) => ReactNode }) {
  const [asTable, setAsTable] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const show = (e: { currentTarget: Element }, value: string, label: string) => {
    const host = box.current?.getBoundingClientRect()
    const r = e.currentTarget.getBoundingClientRect()
    if (!host) return
    const x = r.left + r.width / 2 - host.left
    const align = x < host.width * 0.3 ? 'start' : x > host.width * 0.7 ? 'end' : 'center'
    setTip({ x: align === 'start' ? Math.max(0, x - 16) : align === 'end' ? Math.min(host.width, x + 16) : x, y: r.top - host.top, value, label, align })
  }
  const hide = () => setTip(null)

  return (
    <section className="gv-section" aria-labelledby={`${id}-t`}>
      <div className="gv-section-header">
        <h2 id={`${id}-t`} className="st-sechead">
          {title}
        </h2>
        <button className="gv-section-header__action" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      <div className="gv-card st-chart">
        {asTable ? (
          <div className="st-table-wrap">
            <table className="st-table">
              <thead>
                <tr>
                  {table.head.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="st-chart__plot" ref={box} onPointerLeave={hide}>
            {children(show, hide)}
            {tip && (
              <div className={`st-tip st-tip--${tip.align}`} role="status" style={{ left: tip.x, top: tip.y }}>
                <strong>{tip.value}</strong>
                <span>{tip.label}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {subtitle && <p className="gv-section-footer">{subtitle}</p>}
    </section>
  )
}

// ------------------------------------------------------------- 12-week activity calendar

const CELL = 20
const GAP = 4
const STEP = CELL + GAP
const LABEL_W = 30
const TOP = 18

function heatLevel(a: DayActivity | undefined, goal: number) {
  if (!a || (a.sessions === 0 && a.answers === 0)) return 0
  if (a.xp >= goal) return 3
  if (a.xp >= goal / 2) return 2
  return 1
}
const HEAT_NAMES = ['No practice', 'Started', 'Halfway to goal', 'Goal met']

function Heatmap({ activity, goal }: { activity: Map<string, DayActivity>; goal: number }) {
  const today = localDay()
  const weeks = useMemo(() => calendarWeeks(12), [])
  const daysPractised = weeks.flat().filter((d) => heatLevel(activity.get(d), goal) > 0).length
  const width = LABEL_W + weeks.length * STEP
  const height = TOP + 7 * STEP
  // Label a column when its week starts a new month, keeping labels at least two columns apart.
  const monthCols = useMemo(() => {
    const cols: number[] = []
    weeks.forEach((col, w) => {
      const m = col[0].slice(5, 7)
      const prevM = w > 0 ? weeks[w - 1][0].slice(5, 7) : ''
      if (w > 0 && m === prevM) return
      if (cols.length && w - cols[cols.length - 1] < 2) {
        if (w > 0) cols[cols.length - 1] = w
        return
      }
      cols.push(w)
    })
    return cols
  }, [weeks])
  const rows = weeks
    .flat()
    .filter((d) => d <= today && activity.get(d))
    .reverse()
    .map((d) => {
      const a = activity.get(d)!
      return [dateLabel(d), Math.round(a.minutes), a.xp, a.answers, HEAT_NAMES[heatLevel(a, goal)]]
    })

  return (
    <ChartCard
      id="st-cal"
      title="Activity"
      subtitle={`${daysPractised} ${daysPractised === 1 ? 'day' : 'days'} practised in the last 12 weeks. Full-colour squares are days you reached your ${goal} XP goal.`}
      table={{ head: ['Day', 'Minutes', 'XP', 'Answers', 'Result'], rows: rows.length ? rows : [['No practice yet', '', '', '', '']] }}
    >
      {(show, hide) => (
        <>
          <svg className="st-cal" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Practice calendar for the last 12 weeks: ${daysPractised} days practised.`}>
            {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((l, i) =>
              l ? (
                <text key={i} x={0} y={TOP + i * STEP + CELL * 0.7} className="st-axis">
                  {l}
                </text>
              ) : null,
            )}
            {weeks.map((col, w) => {
              const first = col[0]
              const newMonth = monthCols.includes(w)
              return (
                <g key={first}>
                  {newMonth && (
                    <text x={LABEL_W + w * STEP} y={11} className="st-axis">
                      {dateLabel(first, { month: 'short' })}
                    </text>
                  )}
                  {col.map((d, i) => {
                    if (d > today) return null
                    const a = activity.get(d)
                    const lv = heatLevel(a, goal)
                    const label = a ? `${Math.round(a.minutes)} min · ${a.xp} XP · ${a.answers} answers` : 'No practice'
                    return (
                      <rect
                        key={d}
                        x={LABEL_W + w * STEP}
                        y={TOP + i * STEP}
                        width={CELL}
                        height={CELL}
                        rx={5}
                        className={`st-heat st-heat--${lv}${d === today ? ' is-today' : ''}`}
                        onPointerEnter={(e) => show(e, dateLabel(d), `${HEAT_NAMES[lv]} · ${label}`)}
                        onClick={(e) => show(e, dateLabel(d), `${HEAT_NAMES[lv]} · ${label}`)}
                        onPointerLeave={hide}
                      >
                        <title>{`${dateLabel(d)}: ${HEAT_NAMES[lv]}, ${label}`}</title>
                      </rect>
                    )
                  })}
                </g>
              )
            })}
          </svg>
          <div className="st-legend" aria-hidden="true">
            <span>Less</span>
            {[0, 1, 2, 3].map((l) => (
              <i key={l} className={`st-heat-swatch st-heat--${l}`} />
            ))}
            <span>Goal met</span>
          </div>
        </>
      )}
    </ChartCard>
  )
}

// ------------------------------------------------------------- accuracy by skill

function Meter({ label, extra, value, rate, show, hide, flag }: { label: string; extra?: string; value: string; rate: Rate; show: (e: { currentTarget: Element }, value: string, label: string) => void; hide: () => void; flag?: ReactNode }) {
  const tipLabel = `${label} · ${rate.n} answers`
  return (
    <li className="st-meter">
      <div className="st-meter__top">
        <span className="st-meter__label">{label}</span>
        {extra && <span className="st-meter__extra">{extra}</span>}
        {flag}
        <span className="st-meter__val">{value}</span>
      </div>
      <button
        className="st-meter__track"
        aria-label={`${label}: ${value} right from ${rate.n} answers`}
        onPointerEnter={(e) => show(e, value, tipLabel)}
        onFocus={(e) => show(e, value, tipLabel)}
        onBlur={hide}
        onClick={(e) => show(e, value, tipLabel)}
      >
        <motion.span className="st-meter__fill" initial={{ scaleX: 0 }} animate={{ scaleX: rate.accuracy }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
      </button>
    </li>
  )
}

function SkillBars({ skills }: { skills: ReturnType<typeof bySkill> }) {
  const enough = skills.filter((s) => s.rate.n >= 8)
  const weakest = enough.length >= 2 ? [...enough].sort((a, b) => a.rate.accuracy - b.rate.accuracy)[0].id : null
  const sorted = [...skills].sort((a, b) => b.rate.accuracy - a.rate.accuracy)
  return (
    <ChartCard
      id="st-skill"
      title="Accuracy by skill"
      subtitle="Share of answers you got right in each kind of exercise."
      table={{ head: ['Skill', 'Right', 'Answers', 'Avg time'], rows: sorted.map((s) => [s.label, pct(s.rate), s.rate.n, Number.isFinite(s.rate.avgMs) ? `${(s.rate.avgMs / 1000).toFixed(1)} s` : 'n/a']) }}
    >
      {(show, hide) => (
        <ul className="st-meters">
          {sorted.map((s) => (
            <Meter
              key={s.id}
              label={s.label}
              extra={`${fmt(s.rate.n)} answers`}
              value={pct(s.rate)}
              rate={s.rate}
              show={show}
              hide={hide}
              flag={s.id === weakest ? <span className="gv-badge st-flag">Focus here</span> : undefined}
            />
          ))}
        </ul>
      )}
    </ChartCard>
  )
}

// ------------------------------------------------------------- when you learn best

/** Answers a time bucket needs before its bar is drawn, and before it can be called the best. */
const PART_MIN = 10
const BEST_MIN = 15

function WhenBest({ parts, days }: { parts: ReturnType<typeof byTimeOfDay>; days: ReturnType<typeof byWeekday> }) {
  const okParts = parts.filter((p) => p.rate.n >= BEST_MIN)
  const bestPart = okParts.length >= 2 ? [...okParts].sort((a, b) => b.rate.accuracy - a.rate.accuracy)[0].id : null
  const okDays = days.filter((d) => d.rate.n >= BEST_MIN)
  const bestDay = okDays.length >= 2 ? [...okDays].sort((a, b) => b.rate.accuracy - a.rate.accuracy)[0].index : null

  const W = 300
  const H = 112
  const base = 86
  const colStep = W / 7
  const barW = 18

  return (
    <ChartCard
      id="st-when"
      title="When you learn best"
      subtitle="Accuracy by time of day and by weekday. A time needs at least 15 answers before it can be called the best."
      table={{
        head: ['When', 'Right', 'Answers'],
        rows: [...parts.map((p) => [`${p.label} (${p.hours})`, p.rate.n ? pct(p.rate) : 'n/a', p.rate.n]), ...days.map((d) => [d.long, d.rate.n ? pct(d.rate) : 'n/a', d.rate.n])],
      }}
    >
      {(show, hide) => (
        <div className="st-when">
          <ul className="st-meters">
            {parts.map((p) =>
              p.rate.n >= PART_MIN ? (
                <Meter
                  key={p.id}
                  label={p.label}
                  extra={p.hours}
                  value={pct(p.rate)}
                  rate={p.rate}
                  show={show}
                  hide={hide}
                  flag={p.id === bestPart ? <span className="gv-badge gv-badge--accent st-flag">Best</span> : undefined}
                />
              ) : (
                <li key={p.id} className="st-meter">
                  <div className="st-meter__top">
                    <span className="st-meter__label">{p.label}</span>
                    <span className="st-meter__extra">{p.hours}</span>
                    <span className="st-meter__val st-meter__val--na">{p.rate.n ? `${p.rate.n} answers` : 'No answers'}</span>
                  </div>
                </li>
              ),
            )}
          </ul>

          <svg className="st-cols" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Accuracy by weekday">
            <line x1={0} x2={W} y1={base} y2={base} className="st-grid" />
            {days.map((d, i) => {
              const cx = i * colStep + colStep / 2
              const ok = d.rate.n >= PART_MIN
              const h = ok ? Math.max(3, d.rate.accuracy * (base - 16)) : 0
              const y = base - h
              return (
                <g key={d.index}>
                  {ok && <path d={`M${cx - barW / 2} ${base} V${y + 4} a4 4 0 0 1 4 -4 H${cx + barW / 2 - 4} a4 4 0 0 1 4 4 V${base} Z`} className={`st-col${d.index === bestDay ? ' is-best' : ''}`} />}
                  {ok && d.index === bestDay && (
                    <text x={cx} y={y - 5} textAnchor="middle" className="st-col-val">
                      {pct(d.rate)}
                    </text>
                  )}
                  <rect
                    x={cx - colStep / 2}
                    y={0}
                    width={colStep}
                    height={H}
                    className="st-hit"
                    tabIndex={0}
                    aria-label={`${d.long}: ${ok ? pct(d.rate) : 'not enough answers'}`}
                    onPointerEnter={(e) => show(e, ok ? pct(d.rate) : 'n/a', `${d.long} · ${d.rate.n} answers`)}
                    onFocus={(e) => show(e, ok ? pct(d.rate) : 'n/a', `${d.long} · ${d.rate.n} answers`)}
                    onBlur={hide}
                    onClick={(e) => show(e, ok ? pct(d.rate) : 'n/a', `${d.long} · ${d.rate.n} answers`)}
                  />
                  <text x={cx} y={base + 18} textAnchor="middle" className={`st-axis${d.index === bestDay ? ' st-axis--strong' : ''}`}>
                    {d.short}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </ChartCard>
  )
}

// ------------------------------------------------------------- first-try trend

function TrendLine({ trend }: { trend: ReturnType<typeof weeklyTrend> }) {
  const W = 300
  const H = 132
  const L = 34
  const R = 36
  const T = 10
  const B = 22
  const pw = W - L - R
  const ph = H - T - B
  const x = (i: number) => L + (trend.length === 1 ? pw / 2 : (i * pw) / (trend.length - 1))
  const y = (v: number) => T + ph * (1 - v)
  const pts = trend.map((w, i) => [x(i), y(w.rate.accuracy)] as const)
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  const last = trend[trend.length - 1]
  const [cross, setCross] = useState<number | null>(null)

  return (
    <ChartCard
      id="st-trend"
      title="First-try accuracy"
      subtitle="Per week, answers you got right on the first attempt."
      table={{ head: ['Week of', 'First try', 'Answers'], rows: trend.map((w) => [dateLabel(w.week, { day: 'numeric', month: 'short' }), pct(w.rate), w.rate.n]) }}
    >
      {(show, hide) => (
        <svg className="st-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`First-try accuracy over ${trend.length} weeks, latest ${pct(last.rate)}`} onPointerLeave={() => setCross(null)}>
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="st-grid" />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="st-axis st-num">
                {Math.round(v * 100)}%
              </text>
            </g>
          ))}
          <path d={line} className="st-line" />
          {cross !== null && <line x1={pts[cross][0]} x2={pts[cross][0]} y1={T} y2={y(0)} className="st-cross" />}
          {pts.map(([px, py], i) => (
            <g key={trend[i].week}>
              {(i === pts.length - 1 || i === cross) && <circle cx={px} cy={py} r={3.5} className="st-dot" />}
              <rect
                x={px - Math.max(12, pw / Math.max(1, trend.length - 1) / 2)}
                y={T}
                width={Math.max(24, pw / Math.max(1, trend.length - 1))}
                height={ph}
                className="st-hit"
                tabIndex={0}
                aria-label={`Week of ${dateLabel(trend[i].week, { day: 'numeric', month: 'short' })}: ${pct(trend[i].rate)}`}
                onPointerEnter={(e) => {
                  setCross(i)
                  show(e, pct(trend[i].rate), `Week of ${dateLabel(trend[i].week, { day: 'numeric', month: 'short' })} · ${trend[i].rate.n} answers`)
                }}
                onFocus={(e) => {
                  setCross(i)
                  show(e, pct(trend[i].rate), `Week of ${dateLabel(trend[i].week, { day: 'numeric', month: 'short' })} · ${trend[i].rate.n} answers`)
                }}
                onBlur={() => {
                  setCross(null)
                  hide()
                }}
              />
            </g>
          ))}
          <text x={pts[pts.length - 1][0] + 8} y={pts[pts.length - 1][1] + 4} className="st-end-val">
            {pct(last.rate)}
          </text>
          <text x={L} y={H - 4} className="st-axis">
            {dateLabel(trend[0].week, { day: 'numeric', month: 'short' })}
          </text>
          <text x={W - R} y={H - 4} textAnchor="end" className="st-axis">
            {dateLabel(last.week, { day: 'numeric', month: 'short' })}
          </text>
        </svg>
      )}
    </ChartCard>
  )
}

// ------------------------------------------------------------- export

function ExportSection() {
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<ExportOutcome | 'error' | null>(null)
  const run = async () => {
    setBusy(true)
    try {
      setOutcome(await exportAll())
    } catch {
      setOutcome('error')
    } finally {
      setBusy(false)
    }
  }
  const message =
    outcome === 'shared'
      ? 'Shared. Keep the file somewhere safe.'
      : outcome === 'downloaded'
        ? 'Saved as a JSON file in your downloads.'
        : outcome === 'error'
          ? "Couldn't export just now. Try again in a moment."
          : 'Every answer you give is logged on this phone, with the time it took. Export it to back it up or analyse it later.'
  return (
    <section className="gv-section" aria-labelledby="st-export-t">
      <h2 id="st-export-t" className="gv-section-header">
        Your data
      </h2>
      <div className="gv-list">
        <button className="gv-row" onClick={() => void run()} disabled={busy}>
          <span className="gv-row__icon" aria-hidden="true">
            <IconShare />
          </span>
          <span className="gv-row__body">
            <span className="gv-row__title st-action">{busy ? 'Preparing…' : 'Export my data'}</span>
          </span>
        </button>
      </div>
      <p className="gv-section-footer" aria-live="polite">
        {message}
      </p>
    </section>
  )
}
