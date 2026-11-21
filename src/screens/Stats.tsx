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
import { Mascot } from '../components/Mascot.tsx'
import { IconFlame, IconFlameOff, IconShare, IconSpeaker, IconStar, IconTarget, IconBook, IconBolt } from '../components/Icons.tsx'
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
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 26 } },
}

export function StatsScreen() {
  const summary = useApp((s) => s.summary)
  const profile = useApp((s) => s.profile)
  const mistakesCount = useApp((s) => s.mistakesCount)
  const startMistakes = useApp((s) => s.startMistakes)
  const goTab = useApp((s) => s.goTab)
  const [data, setData] = useState<Data | null>(null)

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
        <header className="st-head">
          <h1 className="t-screen-title">Your progress</h1>
          <p className="st-head__bg muted" lang="bg">
            Напредък
          </p>
        </header>

        <motion.div className="st-stack" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
          <motion.section variants={enter} className="gv-card st-level" aria-label="Your level">
            <div className="st-level__badge gv-tone-gold" aria-hidden="true">
              <span className="gv-star st-level__star" />
              <span className="st-level__num">{level.level}</span>
            </div>
            <div className="st-level__text">
              <p className="t-caption muted">Level {level.level}</p>
              <p className="st-level__name" lang="bg">
                {level.name.bg}
              </p>
              <p className="t-caption muted">{level.name.en}</p>
            </div>
            <div className="st-level__bar">
              <div className="gv-progress gv-tone-gold" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level.progress * 100)} aria-label="XP towards next level">
                <motion.div className="gv-progress__fill" initial={{ width: 0 }} animate={{ width: `${Math.max(4, level.progress * 100)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
              </div>
              <p className="t-caption muted">
                {fmt(summary.totalXp - level.floor)} of {fmt(level.next - level.floor)} XP to level {level.level + 1}
              </p>
            </div>
          </motion.section>

          {data === null ? null : empty ? (
            <motion.section variants={enter} className="gv-card st-empty">
              <Mascot mood="sleep" size={128} />
              <h2 className="t-card-title">No stats yet</h2>
              <p className="muted">Finish your first lesson to see your stats here: your streak, your best time of day and the words that trip you up.</p>
              <button className="gv-btn gv-btn--block" onClick={() => goTab('home')}>
                Start learning
              </button>
            </motion.section>
          ) : (
            <Filled data={data} summaryStreak={liveStreak(summary)} longest={summary.longestStreak} totalXp={summary.totalXp} goal={summary.dailyGoal} speaker={profile.speaker} translit={profile.translit} mistakesCount={mistakesCount} onPractise={() => void startMistakes()} />
          )}
        </motion.div>
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
  speaker: 'm' | 'f'
  translit: boolean
  mistakesCount: number
  onPractise: () => void
}) {
  const { data } = props
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
      <motion.section variants={enter} className="st-tiles" aria-label="Totals">
        <Tile icon={props.summaryStreak > 0 ? <IconFlame /> : <IconFlameOff />} value={fmt(props.summaryStreak)} unit={props.summaryStreak === 1 ? 'day' : 'days'} label="Current streak" />
        <Tile icon={<IconBolt className="st-ico-gold" />} value={fmt(props.longest)} unit={props.longest === 1 ? 'day' : 'days'} label="Longest streak" />
        <Tile icon={<IconBook className="st-ico-pick" />} value={fmt(words)} unit={`of ${fmt(totalItems)}`} label={`Words learned${letters ? `, ${letters} of ${alphabet.letters.length} letters` : ''}`} />
        <Tile icon={<IconStar className="st-ico-gold" />} value={fmt(props.totalXp)} unit="XP" label="Total earned" />
      </motion.section>

      <motion.section variants={enter} className="gv-card st-insight" aria-label="What Щърко noticed">
        <Mascot mood="think" size={84} className="st-insight__mascot" />
        <div className="st-insight__body">
          <h2 className="t-card-title">What I noticed</h2>
          {info.needMore > 0 ? (
            <p>
              Answer {info.needMore} more {info.needMore === 1 ? 'question' : 'questions'} and I'll start spotting your patterns: when you learn best and which skills need love.
            </p>
          ) : info.sentences.length ? (
            <ul className="st-insight__list">
              {info.sentences.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p>You're steady across the board. No skill or time of day stands out yet.</p>
          )}
        </div>
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

      <motion.section variants={enter} className="gv-card st-tough" aria-labelledby="st-tough-title">
        <h2 id="st-tough-title" className="t-card-title">
          Words that trip you up
        </h2>
        {tough.length ? (
          <>
            <ul className="st-tough__list">
              {tough.map((t) => (
                <li key={t.id} className="st-tough__row">
                  <button className="gv-iconbtn gv-iconbtn--sm" aria-label={`Hear ${t.item.bg}`} onClick={() => void speak(t.item.bg, { itemId: t.id })}>
                    <IconSpeaker />
                  </button>
                  <div className="st-tough__text">
                    <span className="st-tough__emoji" aria-hidden="true">
                      {t.item.emoji}
                    </span>
                    <span className="t-body-strong" lang="bg">
                      {t.item.bg}
                    </span>
                    {props.translit && <span className="t-caption muted">{t.item.tr}</span>}
                    <span className="t-caption">{t.item.en}</span>
                  </div>
                  <div className="st-tough__score">
                    <span className="t-body-strong">
                      {t.n - t.wrong}/{t.n}
                    </span>
                    <span className="t-caption muted">right</span>
                  </div>
                </li>
              ))}
            </ul>
            <button className="gv-btn gv-btn--block" disabled={props.mistakesCount === 0} onClick={props.onPractise}>
              <IconTarget width={20} height={20} /> {props.mistakesCount ? 'Practise these' : 'All fixed for now'}
            </button>
          </>
        ) : (
          <p className="muted">Nothing keeps tripping you up yet. Words show up here after three tries with at least one miss.</p>
        )}
      </motion.section>

      <motion.div variants={enter}>
        <ExportCard />
      </motion.div>
    </>
  )
}

function Tile({ icon, value, unit, label }: { icon: ReactNode; value: string; unit: string; label: string }) {
  return (
    <div className="gv-card st-tile">
      <span className="st-tile__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="st-tile__value">
        {value} <span className="st-tile__unit">{unit}</span>
      </p>
      <p className="t-caption muted">{label}</p>
    </div>
  )
}

// ------------------------------------------------------------- chart card with table view and tooltip

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
    <section className="gv-card st-chart" aria-labelledby={`${id}-t`}>
      <div className="st-chart__head">
        <div>
          <h2 id={`${id}-t`} className="t-card-title">
            {title}
          </h2>
          {subtitle && <p className="t-caption muted">{subtitle}</p>}
        </div>
        <button className="st-toggle" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>
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
    </section>
  )
}

// ------------------------------------------------------------- 12-week streak calendar

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
    <ChartCard id="st-cal" title="Last 12 weeks" subtitle={`${daysPractised} ${daysPractised === 1 ? 'day' : 'days'} practised · darkest means you hit your ${goal} XP goal`} table={{ head: ['Day', 'Minutes', 'XP', 'Answers', 'Result'], rows: rows.length ? rows : [['No practice yet', '', '', '', '']] }}>
      {(show, hide) => (
        <>
          <svg className="st-cal" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Practice calendar for the last 12 weeks: ${daysPractised} days practised.`}>
            {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((l, i) =>
              l ? (
                <text key={i} x={0} y={TOP + i * STEP + CELL * 0.72} className="st-axis">
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
            <span className="t-caption muted">None</span>
            {[0, 1, 2, 3].map((l) => (
              <i key={l} className={`st-heat-swatch st-heat--${l}`} />
            ))}
            <span className="t-caption muted">Goal met</span>
          </div>
        </>
      )}
    </ChartCard>
  )
}

// ------------------------------------------------------------- accuracy by skill (meter list)

function SkillBars({ skills }: { skills: ReturnType<typeof bySkill> }) {
  const enough = skills.filter((s) => s.rate.n >= 8)
  const weakest = enough.length >= 2 ? [...enough].sort((a, b) => a.rate.accuracy - b.rate.accuracy)[0].id : null
  const sorted = [...skills].sort((a, b) => b.rate.accuracy - a.rate.accuracy)
  return (
    <ChartCard id="st-skill" title="Accuracy by skill" subtitle="Share of answers you got right" table={{ head: ['Skill', 'Right', 'Answers', 'Avg time'], rows: sorted.map((s) => [s.label, pct(s.rate), s.rate.n, Number.isFinite(s.rate.avgMs) ? `${(s.rate.avgMs / 1000).toFixed(1)} s` : 'n/a']) }}>
      {(show, hide) => (
        <ul className="st-meters">
          {sorted.map((s) => (
            <li key={s.id} className="st-meter">
              <div className="st-meter__top">
                <span className="t-body-strong">{s.label}</span>
                {s.id === weakest && (
                  <span className="st-flag">
                    <IconTarget width={14} height={14} /> Focus here
                  </span>
                )}
                <span className="st-meter__val">{pct(s.rate)}</span>
              </div>
              <button
                className="st-meter__track"
                aria-label={`${s.label}: ${pct(s.rate)} right from ${s.rate.n} answers`}
                onPointerEnter={(e) => show(e, pct(s.rate), `${s.label} · ${s.rate.n} answers`)}
                onFocus={(e) => show(e, pct(s.rate), `${s.label} · ${s.rate.n} answers`)}
                onBlur={hide}
                onClick={(e) => show(e, pct(s.rate), `${s.label} · ${s.rate.n} answers`)}
              >
                <motion.span className="st-meter__fill" initial={{ scaleX: 0 }} animate={{ scaleX: s.rate.accuracy }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
              </button>
              <span className="t-caption muted">{fmt(s.rate.n)} answers</span>
            </li>
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
  const H = 128
  const base = 100
  const colStep = W / 7
  const barW = 22

  return (
    <ChartCard
      id="st-when"
      title="When you learn best"
      subtitle="Accuracy by time of day and by weekday"
      table={{
        head: ['When', 'Right', 'Answers'],
        rows: [...parts.map((p) => [`${p.label} (${p.hours})`, p.rate.n ? pct(p.rate) : 'n/a', p.rate.n]), ...days.map((d) => [d.long, d.rate.n ? pct(d.rate) : 'n/a', d.rate.n])],
      }}
    >
      {(show, hide) => (
        <div className="st-when">
          <ul className="st-meters">
            {parts.map((p) => (
              <li key={p.id} className="st-meter">
                <div className="st-meter__top">
                  <span className="t-body-strong">{p.label}</span>
                  <span className="t-caption muted">{p.hours}</span>
                  {p.id === bestPart && (
                    <span className="st-flag st-flag--best">
                      <IconStar width={14} height={14} /> Best
                    </span>
                  )}
                  <span className="st-meter__val">{p.rate.n >= PART_MIN ? pct(p.rate) : 'n/a'}</span>
                </div>
                {p.rate.n >= PART_MIN ? (
                  <button
                    className="st-meter__track"
                    aria-label={`${p.label}: ${pct(p.rate)} right from ${p.rate.n} answers`}
                    onPointerEnter={(e) => show(e, pct(p.rate), `${p.label} · ${p.rate.n} answers`)}
                    onFocus={(e) => show(e, pct(p.rate), `${p.label} · ${p.rate.n} answers`)}
                    onBlur={hide}
                    onClick={(e) => show(e, pct(p.rate), `${p.label} · ${p.rate.n} answers`)}
                  >
                    <motion.span className="st-meter__fill" initial={{ scaleX: 0 }} animate={{ scaleX: p.rate.accuracy }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
                  </button>
                ) : null}
                {p.rate.n >= PART_MIN ? (
                  <span className="t-caption muted">{fmt(p.rate.n)} answers</span>
                ) : (
                  <span className="t-caption muted">{p.rate.n ? `Only ${p.rate.n} answers so far` : 'No answers yet'}</span>
                )}
              </li>
            ))}
          </ul>

          <svg className="st-cols" viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label="Accuracy by weekday">
            <line x1={0} x2={W} y1={base + 4} y2={base + 4} className="st-grid" />
            {days.map((d, i) => {
              const cx = i * colStep + colStep / 2
              const ok = d.rate.n >= PART_MIN
              const h = ok ? Math.max(4, d.rate.accuracy * (base - 14)) : 0
              const y = base + 4 - h
              return (
                <g key={d.index}>
                  {ok && (
                    <path
                      d={`M${cx - barW / 2} ${base + 4} V${y + 4} a4 4 0 0 1 4 -4 H${cx + barW / 2 - 4} a4 4 0 0 1 4 4 V${base + 4} Z`}
                      className="st-col"
                    />
                  )}
                  {ok && d.index === bestDay && (
                    <text x={cx} y={y - 6} textAnchor="middle" className="st-col-val">
                      {pct(d.rate)}
                    </text>
                  )}
                  <rect
                    x={cx - colStep / 2}
                    y={0}
                    width={colStep}
                    height={base + 22}
                    className="st-hit"
                    tabIndex={0}
                    aria-label={`${d.long}: ${ok ? pct(d.rate) : 'not enough answers'}`}
                    onPointerEnter={(e) => show(e, ok ? pct(d.rate) : 'n/a', `${d.long} · ${d.rate.n} answers`)}
                    onFocus={(e) => show(e, ok ? pct(d.rate) : 'n/a', `${d.long} · ${d.rate.n} answers`)}
                    onBlur={hide}
                    onClick={(e) => show(e, ok ? pct(d.rate) : 'n/a', `${d.long} · ${d.rate.n} answers`)}
                  />
                  <text x={cx} y={base + 22} textAnchor="middle" className={`st-axis${d.index === bestDay ? ' st-axis--strong' : ''}`}>
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
  const H = 140
  const L = 34
  const R = 36
  const T = 12
  const B = 24
  const pw = W - L - R
  const ph = H - T - B
  const x = (i: number) => L + (trend.length === 1 ? pw / 2 : (i * pw) / (trend.length - 1))
  const y = (v: number) => T + ph * (1 - v)
  const pts = trend.map((w, i) => [x(i), y(w.rate.accuracy)] as const)
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${y(0)} L${pts[0][0].toFixed(1)} ${y(0)} Z`
  const last = trend[trend.length - 1]
  const [cross, setCross] = useState<number | null>(null)

  return (
    <ChartCard id="st-trend" title="First-try accuracy" subtitle="Per week, right on the first attempt" table={{ head: ['Week of', 'First try', 'Answers'], rows: trend.map((w) => [dateLabel(w.week, { day: 'numeric', month: 'short' }), pct(w.rate), w.rate.n]) }}>
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
          <path d={area} className="st-area" />
          <path d={line} className="st-line" />
          {cross !== null && <line x1={pts[cross][0]} x2={pts[cross][0]} y1={T} y2={y(0)} className="st-cross" />}
          {pts.map(([px, py], i) => (
            <g key={trend[i].week}>
              {(i === pts.length - 1 || i === cross) && <circle cx={px} cy={py} r={4} className="st-dot" />}
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
          <text x={L} y={H - 6} className="st-axis">
            {dateLabel(trend[0].week, { day: 'numeric', month: 'short' })}
          </text>
          <text x={W - R} y={H - 6} textAnchor="end" className="st-axis">
            {dateLabel(last.week, { day: 'numeric', month: 'short' })}
          </text>
        </svg>
      )}
    </ChartCard>
  )
}

// ------------------------------------------------------------- export

function ExportCard() {
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
          : ''
  return (
    <section className="gv-card st-export" aria-labelledby="st-export-t">
      <div className="gv-shevitsa gv-shevitsa--sm gv-tone-rose st-export__band" aria-hidden="true" />
      <h2 id="st-export-t" className="t-card-title">
        Your data
      </h2>
      <p className="muted">Every answer you give is logged on this phone, with the time it took. Export it any time to back it up or analyse it later.</p>
      <button className="gv-btn gv-btn--quiet gv-btn--block" onClick={() => void run()} disabled={busy}>
        <IconShare width={20} height={20} /> {busy ? 'Preparing' : 'Export my data'}
      </button>
      <p className="t-caption muted st-export__msg" aria-live="polite">
        {message}
      </p>
    </section>
  )
}
