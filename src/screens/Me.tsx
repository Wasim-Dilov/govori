// The "Me" tab: profile, settings, reminders, her voice, data.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Mascot } from '../components/Mascot.tsx'
import { InstallGuide } from '../components/InstallGuide.tsx'
import { Recorder } from '../components/Recorder.tsx'
import { IconBell, IconFlame, IconHeart, IconMic, IconSpeaker, IconStar, IconTarget, IconUser } from '../components/Icons.tsx'
import { allItemIds, study, trackById, tracks } from '../content/index.ts'
import { planWeek } from '../content/plan.ts'
import type { TrackId } from '../content/types.ts'
import { hasBulgarianVoice, sfx, speak } from '../lib/audio.ts'
import { db } from '../lib/db.ts'
import { learnerLevel, liveStreak } from '../lib/progress.ts'
import { GITHUB_ACTION_URL, GITHUB_SECRET_URL, disableReminders, enableReminders, getReminderCode, reminderStatus, type ReminderStatus } from '../lib/push.ts'
import { useApp, type Profile } from '../lib/store.ts'
import './me.css'

// exportData lives in another module that may land later; load it lazily and tolerate its absence.
const exporters = import.meta.glob<{ exportData: () => Promise<unknown> }>('../lib/exportData.ts')

const GOALS = [
  { xp: 20, label: '5 min' },
  { xp: 40, label: '10 min' },
  { xp: 60, label: '15 min' },
]

// ------------------------------------------------------------- small building blocks

function Section({ icon, tone, title, children }: { icon: ReactNode; tone: string; title: string; children: ReactNode }) {
  return (
    <section className="gv-card me-card" aria-label={title}>
      <h2 className="me-card-head">
        <span className={`me-card-icon gv-tone-${tone}`} aria-hidden="true">
          {icon}
        </span>
        <span className="t-card-title">{title}</span>
      </h2>
      <div className="me-rows">{children}</div>
    </section>
  )
}

function Row({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="me-row">
      <div className="me-row-text">
        <span className="me-row-label">{label}</span>
        {hint && <span className="me-row-hint">{hint}</span>}
      </div>
      {children && <div className="me-row-ctrl">{children}</div>}
    </div>
  )
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="me-row me-toggle"
      onClick={() => {
        sfx.tap()
        onChange(!on)
      }}
    >
      <span className="me-row-text">
        <span className="me-row-label">{label}</span>
        {hint && <span className="me-row-hint">{hint}</span>}
      </span>
      <span className="me-switch" aria-hidden="true" />
    </button>
  )
}

function Chips<T extends string | number>({ label, value, options, onPick }: { label: string; value: T; options: { v: T; label: string }[]; onPick: (v: T) => void }) {
  return (
    <div className="gv-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          className="gv-chip"
          aria-pressed={value === o.v}
          onClick={() => {
            sfx.tap()
            onPick(o.v)
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- sections

function ProfileHeader() {
  const profile = useApp((s) => s.profile)
  const summary = useApp((s) => s.summary)
  const learned = useApp((s) => s.learned)
  const reduce = useReducedMotion()
  const lvl = learnerLevel(summary.totalXp)
  const streak = liveStreak(summary)
  return (
    <header className="me-hero">
      <div className="me-hero-top">
        <Mascot mood={streak > 0 ? 'happy' : 'idle'} size={96} />
        <div className="me-hero-id">
          <h1 className="t-screen-title">{profile.name || 'You'}</h1>
          <p className="me-level">
            Level {lvl.level} · <span lang="bg">{lvl.name.bg}</span>
          </p>
          <p className="me-level-en">{lvl.name.en}</p>
        </div>
      </div>
      <div className="me-xpbar">
        <div className="gv-progress gv-tone-gold" aria-label={`${summary.totalXp - lvl.floor} of ${lvl.next - lvl.floor} XP to level ${lvl.level + 1}`}>
          <motion.div
            className="gv-progress__fill"
            initial={reduce ? false : { width: '0%' }}
            animate={{ width: `${Math.max(4, Math.round(lvl.progress * 100))}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
        </div>
        <span className="me-xpbar-note">
          {lvl.next - summary.totalXp} XP to level {lvl.level + 1}
        </span>
      </div>
      <div className="me-stats">
        <div className="me-stat">
          <IconFlame />
          <span className="t-stat">{streak}</span>
          <span className="me-stat-label">day streak</span>
        </div>
        <div className="me-stat">
          <IconStar className="me-stat-star" />
          <span className="t-stat">{summary.totalXp}</span>
          <span className="me-stat-label">total XP</span>
        </div>
        <div className="me-stat">
          <IconHeart className="me-stat-heart" />
          <span className="t-stat">{learned}</span>
          <span className="me-stat-label">words met</span>
        </div>
      </div>
      <div className="gv-shevitsa gv-shevitsa--sm gv-tone-rose me-band" aria-hidden="true" />
    </header>
  )
}

function LearningSection() {
  const profile = useApp((s) => s.profile)
  const focus = useApp((s) => s.focus)
  const setProfile = useApp((s) => s.setProfile)
  const setFocus = useApp((s) => s.setFocus)
  const [picking, setPicking] = useState(false)
  const [scope, setScope] = useState<'day' | 'week'>(focus.scope === 'day' ? 'day' : 'week')
  const week = planWeek(profile.startedAt)
  const focusLabel =
    focus.track === 'plan' ? `Week ${week.week} of the plan: ${week.title}` : `${trackById.get(focus.track)?.title ?? focus.track}, ${focus.scope === 'day' ? 'today' : 'this week'}`

  return (
    <Section icon={<IconTarget />} tone="pick" title="Learning">
      <Row label="Focus" hint={focusLabel}>
        <button type="button" className="gv-btn gv-btn--quiet gv-btn--sm" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
          {picking ? 'Done' : 'Change'}
        </button>
      </Row>
      {picking && (
        <div className="me-focus">
          <Chips
            label="Focus for"
            value={scope}
            options={[
              { v: 'day', label: 'Today' },
              { v: 'week', label: 'This week' },
            ]}
            onPick={setScope}
          />
          <div className="me-focus-grid">
            <button type="button" className={`me-focus-opt gv-tone-rose ${focus.track === 'plan' ? 'is-active' : ''}`} aria-pressed={focus.track === 'plan'} onClick={() => void setFocus('plan', 'week')}>
              <span aria-hidden="true">🗓️</span> 12-week plan
            </button>
            {tracks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`me-focus-opt gv-tone-${t.id} ${focus.track === t.id ? 'is-active' : ''}`}
                aria-pressed={focus.track === t.id}
                onClick={() => {
                  sfx.tap()
                  void setFocus(t.id as TrackId, scope)
                }}
              >
                <span aria-hidden="true">{t.emoji}</span> {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <Row label="Daily goal" hint={`${profile.dailyGoal} XP a day`}>
        <Chips label="Daily goal" value={profile.dailyGoal} options={GOALS.map((g) => ({ v: g.xp, label: g.label }))} onPick={(v) => void setProfile({ dailyGoal: v })} />
      </Row>
      <Row
        label="Address me as"
        hint={
          <>
            Changes forms like <span lang="bg">{profile.speaker === 'f' ? 'уморена' : 'уморен'}</span>
          </>
        }
      >
        <Chips
          label="Address me as"
          value={profile.speaker}
          options={[
            { v: 'm', label: 'A man' },
            { v: 'f', label: 'A woman' },
          ]}
          onPick={(v) => void setProfile({ speaker: v })}
        />
      </Row>
      <Toggle label="Show transliteration" hint="Latin letters under the Bulgarian, like obícham te" on={profile.translit} onChange={(v) => void setProfile({ translit: v })} />
      <Toggle label="Speaking exercises" hint="Say words out loud and hear yourself back" on={profile.speaking} onChange={(v) => void setProfile({ speaking: v })} />
    </Section>
  )
}

function SoundSection() {
  const profile = useApp((s) => s.profile)
  const setProfile = useApp((s) => s.setProfile)
  const [voice, setVoice] = useState<boolean | null>(hasBulgarianVoice())
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (voice !== null) return
    const t = window.setInterval(() => {
      const v = hasBulgarianVoice()
      if (v !== null) {
        setVoice(v)
        window.clearInterval(t)
      }
    }, 500)
    const stop = window.setTimeout(() => {
      window.clearInterval(t)
      setVoice((v) => v ?? false)
    }, 4000)
    return () => {
      window.clearInterval(t)
      window.clearTimeout(stop)
    }
  }, [voice])

  async function test() {
    setTesting(true)
    await speak('Здравей! Как си?')
    setTesting(false)
  }

  return (
    <Section icon={<IconSpeaker />} tone="basics" title="Sound">
      <Toggle label="Sound effects" hint="Chimes for right and wrong answers" on={profile.sfx} onChange={(v) => void setProfile({ sfx: v })} />
      <Row
        label="Bulgarian voice"
        hint={voice === null ? 'Checking this phone…' : voice ? 'Ready on this phone' : 'Not found on this phone yet'}
      >
        <button type="button" className={`gv-iconbtn gv-iconbtn--sm me-iconbtn ${testing ? 'is-playing' : ''}`} onClick={() => void test()} aria-label="Play a test sentence: Здравей! Как си?">
          <IconSpeaker />
        </button>
      </Row>
      {voice === false && (
        <div className="me-note">
          <p className="me-note-title">Get the Bulgarian voice (free)</p>
          <ol className="me-steps">
            <li>Open the iPhone <strong>Settings</strong> app.</li>
            <li>
              Go to <strong>Accessibility</strong>, <strong>Spoken Content</strong>, <strong>Voices</strong>.
            </li>
            <li>
              Tap <strong>Bulgarian</strong> and download the voice.
            </li>
            <li>Come back and tap the speaker to test it.</li>
          </ol>
        </div>
      )}
    </Section>
  )
}

function RemindersSection() {
  const [status, setStatus] = useState<ReminderStatus | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const check = async () => {
    const s = await reminderStatus()
    setStatus(s)
    if (s.enabled) setCode(await getReminderCode())
  }
  useEffect(() => {
    void check()
  }, [])

  async function turnOn() {
    // Must run straight from the tap: iOS only asks for permission from a user gesture.
    setError('')
    setBusy(true)
    try {
      const c = await enableReminders()
      setCode(c)
      await check()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn on reminders.')
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    await disableReminders()
    setCode(null)
    await check()
    setBusy(false)
  }

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      const el = document.getElementById('me-code')
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }

  const onState = status?.enabled
  return (
    <Section icon={<IconBell />} tone="gold" title="Reminders">
      <Row
        label="Evening reminder"
        hint={!status ? 'Checking…' : onState ? 'On. A nudge around 19:30 Sofia time, or a word of the day if you already practised.' : 'Off'}
      >
        {status && (
          <span className={`me-pill ${onState ? 'is-on' : ''}`}>{onState ? 'On' : 'Off'}</span>
        )}
      </Row>

      {status && !status.standalone ? (
        <div className="me-sub">
          <p className="me-row-hint">Reminders work when Govori runs from your Home Screen (iOS 16.4 or newer). Add it in three taps:</p>
          <InstallGuide compact />
          <button type="button" className="gv-btn gv-btn--quiet gv-btn--sm" onClick={() => void check()}>
            I've added it, check again
          </button>
        </div>
      ) : status && !status.supported ? (
        <p className="me-row-hint me-sub">{status.reason}</p>
      ) : status ? (
        <div className="me-sub">
          {status.reason && !onState && <p className="me-row-hint">{status.reason}</p>}
          {!onState && !code && status.permission !== 'denied' && (
            <button type="button" className="gv-btn gv-btn--block gv-tone-gold" onClick={() => void turnOn()} disabled={busy}>
              {busy ? 'Turning on…' : 'Turn on reminders'}
            </button>
          )}
          {!onState && status.permission === 'denied' && (
            <button type="button" className="gv-btn gv-btn--quiet gv-btn--sm" onClick={() => void check()}>
              I've allowed them, check again
            </button>
          )}
          {code && (
            <ol className="me-setup">
              <li>
                <p className="me-setup-title">Copy your setup code</p>
                <p className="me-row-hint">It belongs to this phone only. Don't share it.</p>
                <code id="me-code" className="me-code">
                  {code}
                </code>
                <button type="button" className="gv-btn gv-btn--sm gv-tone-pine" onClick={() => void copy()}>
                  {copied ? 'Copied' : 'Copy setup code'}
                </button>
              </li>
              <li>
                <p className="me-setup-title">Give it to GitHub</p>
                <p className="me-row-hint">
                  Name the secret <strong className="me-mono">GOVORI_PUSH</strong>, paste the code, tap Add secret.
                </p>
                <a className="gv-btn gv-btn--quiet gv-btn--sm me-link" href={GITHUB_SECRET_URL} target="_blank" rel="noreferrer">
                  Open GitHub secrets
                </a>
              </li>
              <li>
                <p className="me-setup-title">Send a test</p>
                <p className="me-row-hint">Tap Run workflow. A notification should arrive within a minute.</p>
                <a className="gv-btn gv-btn--quiet gv-btn--sm me-link" href={GITHUB_ACTION_URL} target="_blank" rel="noreferrer">
                  Open the reminder workflow
                </a>
              </li>
            </ol>
          )}
          {onState && (
            <button type="button" className="gv-btn gv-btn--ghost gv-btn--sm me-off" onClick={() => void turnOff()} disabled={busy}>
              Turn off reminders
            </button>
          )}
          {error && (
            <p className="me-error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : null}
    </Section>
  )
}

function HerVoiceSection() {
  const speaker = useApp((s) => s.profile.speaker)
  const [learnedIds, setLearnedIds] = useState<string[]>([])
  const [recorded, setRecorded] = useState<Set<string>>(new Set())
  const [scope, setScope] = useState<'learned' | 'all'>('learned')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(20)

  useEffect(() => {
    void (async () => {
      const mem = await db.memory.toArray()
      setLearnedIds(mem.sort((a, b) => b.lastSeen - a.lastSeen).map((m) => m.itemId))
      const recs = await db.recordings.toCollection().primaryKeys()
      setRecorded(new Set(recs as string[]))
    })()
  }, [])

  const items = useMemo(() => {
    const ids = scope === 'learned' ? learnedIds : allItemIds
    const q = query.trim().toLowerCase()
    return ids
      .map((id) => study(id, speaker))
      .filter((it): it is NonNullable<typeof it> => !!it && it.kind !== 'letter')
      .filter((it) => !q || it.bg.toLowerCase().includes(q) || it.en.toLowerCase().includes(q) || it.tr.toLowerCase().includes(q))
  }, [scope, learnedIds, query, speaker])

  const shown = items.slice(0, limit)

  return (
    <Section icon={<IconMic />} tone="love" title="Her voice">
      <p className="me-row-hint me-sub">
        Ask your wife to record words in her voice. Govori will play her recordings instead of the robot voice.
      </p>
      <div className="me-voice-bar">
        <span className="me-count">
          <strong>{recorded.size}</strong> recorded
        </span>
        <Chips
          label="Which words"
          value={scope}
          options={[
            { v: 'learned', label: 'Learned' },
            { v: 'all', label: 'All words' },
          ]}
          onPick={(v) => {
            setScope(v)
            setLimit(20)
          }}
        />
      </div>
      <label className="sr-only" htmlFor="me-voice-search">
        Search words
      </label>
      <input id="me-voice-search" className="me-search" type="search" placeholder="Search Bulgarian or English" value={query} onChange={(e) => setQuery(e.target.value)} />
      {shown.length === 0 ? (
        <p className="me-empty">{scope === 'learned' && !query ? 'Finish a lesson and its words show up here, ready for her to record.' : 'No words match that search.'}</p>
      ) : (
        <ul className="me-voice-list">
          {shown.map((it) => (
            <li key={it.id} className="me-voice-item">
              <span className="me-voice-emoji" aria-hidden="true">
                {it.emoji}
              </span>
              <span className="me-voice-text">
                <span lang="bg" className="me-voice-bg">
                  {it.bg}
                </span>
                <span className="me-voice-en">
                  {it.tr} · {it.en}
                </span>
              </span>
              <Recorder
                itemId={it.id}
                label={it.bg}
                onChange={(has) =>
                  setRecorded((prev) => {
                    const n = new Set(prev)
                    if (has) n.add(it.id)
                    else n.delete(it.id)
                    return n
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
      {items.length > shown.length && (
        <button type="button" className="gv-btn gv-btn--quiet gv-btn--sm me-more" onClick={() => setLimit((l) => l + 30)}>
          Show more ({items.length - shown.length} left)
        </button>
      )}
    </Section>
  )
}

function AppearanceSection() {
  const theme = useApp((s) => s.profile.theme)
  const setProfile = useApp((s) => s.setProfile)
  return (
    <Section icon={<IconStar />} tone="azbuka" title="Appearance">
      <Row label="Theme">
        <Chips<Profile['theme']>
          label="Theme"
          value={theme}
          options={[
            { v: 'system', label: 'System' },
            { v: 'light', label: 'Light' },
            { v: 'dark', label: 'Dark' },
          ]}
          onPick={(v) => void setProfile({ theme: v })}
        />
      </Row>
    </Section>
  )
}

function DataSection() {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const loadExport = exporters['../lib/exportData.ts']

  async function doExport() {
    setMsg('')
    if (!loadExport) return setMsg('Export is not available yet.')
    try {
      const mod = await loadExport()
      await mod.exportData()
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setMsg('Could not export. Try again.')
    }
  }

  async function reset() {
    setBusy(true)
    await Promise.all([db.kv.clear(), db.memory.clear(), db.lessons.clear(), db.events.clear(), db.sessions.clear()])
    window.location.reload()
  }

  return (
    <Section icon={<IconUser />} tone="home" title="Your data">
      <Row label="Export everything" hint="Every answer, session and setting as a JSON file, for backups or analysis">
        <button type="button" className="gv-btn gv-btn--quiet gv-btn--sm" onClick={() => void doExport()}>
          Export
        </button>
      </Row>
      {msg && <p className="me-error">{msg}</p>}
      {!confirm ? (
        <Row label="Reset progress" hint="Start again from zero. Her recordings stay.">
          <button type="button" className="gv-btn gv-btn--ghost gv-btn--sm" onClick={() => setConfirm(true)}>
            Reset
          </button>
        </Row>
      ) : (
        <div className="me-danger" role="alert">
          <p className="me-setup-title">Delete your streak, XP and all progress?</p>
          <p className="me-row-hint">This can't be undone. Export first if you want a copy. Recordings are kept.</p>
          <div className="me-danger-actions">
            <button type="button" className="gv-btn gv-btn--sm" onClick={() => void reset()} disabled={busy}>
              {busy ? 'Deleting…' : 'Yes, delete everything'}
            </button>
            <button type="button" className="gv-btn gv-btn--quiet gv-btn--sm" onClick={() => setConfirm(false)} disabled={busy}>
              Keep my progress
            </button>
          </div>
        </div>
      )}
    </Section>
  )
}

function About() {
  return (
    <footer className="me-about">
      <div className="gv-star me-about-star gv-tone-rose" aria-hidden="true" />
      <p className="me-about-name">
        Govori <span lang="bg">· Говори</span>
      </p>
      <p className="muted">Version 1.0. Made for learning my wife's language.</p>
      <a href="https://github.com/Wasim-Dilov/govori" target="_blank" rel="noreferrer" className="me-about-link">
        github.com/Wasim-Dilov/govori
      </a>
    </footer>
  )
}

export function MeScreen() {
  const reduce = useReducedMotion()
  const sections = [ProfileHeader, LearningSection, SoundSection, RemindersSection, HerVoiceSection, AppearanceSection, DataSection, About]
  return (
    <main className="screen me">
      {sections.map((S, n) => (
        <motion.div key={n} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n, 4) * 0.05, type: 'spring', stiffness: 300, damping: 30 }}>
          <S />
        </motion.div>
      ))}
    </main>
  )
}
