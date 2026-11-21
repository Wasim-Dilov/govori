// The "Me" tab: profile, settings, reminders, her voice, data. Native iOS Settings layout.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { InstallGuide } from '../components/InstallGuide.tsx'
import { Recorder } from '../components/Recorder.tsx'
import { IconBell, IconBook, IconCheck, IconChevron, IconFlame, IconHeart, IconLetters, IconMic, IconPath, IconPlay, IconRefresh, IconShare, IconSpeaker, IconStar, IconTarget, IconUser, IconX } from '../components/Icons.tsx'
import { BrandMark } from '../components/BrandMark.tsx'
import { Illustration } from '../components/Illustration.tsx'
import { allItemIds, study, trackById, tracks } from '../content/index.ts'
import { planWeek } from '../content/plan.ts'
import type { TrackId } from '../content/types.ts'
import { clipCount, clipUrls, clipVoiceLabel, hasBulgarianVoice, manifestReady, sfx, speak } from '../lib/audio.ts'
import { db, getKV } from '../lib/db.ts'
import { exportAll } from '../lib/exportData.ts'
import { readBackup, restoreBackup, type Backup, type BackupSummary } from '../lib/importData.ts'
import { GOAL_OPTIONS, learnerLevel, liveStreak } from '../lib/progress.ts'
import { listOurPhrases } from '../lib/custom.ts'
import type { CustomItem } from '../lib/db.ts'
import { getPartner } from '../lib/shareCard.ts'
import { BottomSheet } from '../components/FocusSheet.tsx'
import { GITHUB_ACTION_URL, GITHUB_SECRET_URL, disableReminders, enableReminders, getReminderCode, reminderStatus, type ReminderStatus } from '../lib/push.ts'
import { useApp, type Profile } from '../lib/store.ts'
import './me.css'

const GOALS = GOAL_OPTIONS.map((g) => ({ xp: g.xp, label: `${g.min} min` }))

// ------------------------------------------------------------- small building blocks

const IconExternal = () => (
  <svg className="me-ext" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" />
  </svg>
)
const IconSearch = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
  </svg>
)

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

function Section({ title, footer, children, before }: { title?: string; footer?: ReactNode; children: ReactNode; before?: ReactNode }) {
  return (
    <section className="gv-section" aria-label={title}>
      {title && <h2 className="gv-section-header">{title}</h2>}
      {before}
      <div className="gv-list">{children}</div>
      {footer && <div className="gv-section-footer">{footer}</div>}
    </section>
  )
}

/** iOS Settings-style leading tile: neutral by default, a hue only where it means something. */
type Ico = { icon?: ReactNode; tone?: string }
function Tile({ icon, tone }: Ico) {
  if (!icon) return null
  return (
    <span className={`gv-row__icon me-ico ${tone ?? 'me-ico--plain'}`} aria-hidden="true">
      {icon}
    </span>
  )
}

function Row({ title, subtitle, accessory, children, className = '', icon, tone }: { title: ReactNode; subtitle?: ReactNode; accessory?: ReactNode; children?: ReactNode; className?: string } & Ico) {
  return (
    <div className={`gv-row ${className}`}>
      <Tile icon={icon} tone={tone} />
      <span className="gv-row__body">
        <span className="gv-row__title">{title}</span>
        {subtitle && <span className="gv-row__subtitle">{subtitle}</span>}
        {children}
      </span>
      {accessory && <span className="gv-row__accessory">{accessory}</span>}
    </div>
  )
}

/** A tappable row whose title is an action in the accent colour, like iOS Settings. */
function ActionRow({ label, subtitle, onClick, disabled, icon, tone }: { label: ReactNode; subtitle?: ReactNode; onClick: () => void; disabled?: boolean } & Ico) {
  return (
    <button type="button" className="gv-row me-action" onClick={onClick} disabled={disabled}>
      <Tile icon={icon} tone={tone} />
      <span className="gv-row__body">
        <span className="gv-row__title">{label}</span>
        {subtitle && <span className="gv-row__subtitle">{subtitle}</span>}
      </span>
    </button>
  )
}

function LinkRow({ href, title, subtitle, icon, tone }: { href: string; title: string; subtitle?: ReactNode } & Ico) {
  return (
    <a className="gv-row" href={href} target="_blank" rel="noreferrer">
      <Tile icon={icon} tone={tone} />
      <span className="gv-row__body">
        <span className="gv-row__title me-link-title">{title}</span>
        {subtitle && <span className="gv-row__subtitle">{subtitle}</span>}
      </span>
      <span className="gv-row__accessory">
        <IconExternal />
      </span>
    </a>
  )
}

function ToggleRow({ id, label, hint, on, onChange, icon, tone }: { id: string; label: string; hint?: string; on: boolean; onChange: (v: boolean) => void } & Ico) {
  return (
    <label className="gv-row me-toggle-row" htmlFor={id}>
      <Tile icon={icon} tone={tone} />
      <span className="gv-row__body">
        <span className="gv-row__title">{label}</span>
        {hint && <span className="gv-row__subtitle">{hint}</span>}
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="gv-toggle"
        checked={on}
        onChange={(e) => {
          sfx.tap()
          onChange(e.target.checked)
        }}
      />
    </label>
  )
}

function Segmented<T extends string | number>({ label, value, options, onPick, block }: { label: string; value: T; options: { v: T; label: string }[]; onPick: (v: T) => void; block?: boolean }) {
  return (
    <div className={`gv-segmented ${block ? 'gv-segmented--block' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
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

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

// ------------------------------------------------------------- sections

function ProfileHeader() {
  const profile = useApp((s) => s.profile)
  const summary = useApp((s) => s.summary)
  const learned = useApp((s) => s.learned)
  const lvl = learnerLevel(summary.totalXp)
  const streak = liveStreak(summary)
  const ini = initials(profile.name)
  return (
    <section className="gv-section me-profile" aria-label="Profile">
      <div className="gv-list">
        <div className="gv-row me-profile-row">
          <span className="me-avatar" aria-hidden="true">
            {ini || <IconUser />}
          </span>
          <span className="gv-row__body">
            <span className="gv-row__title me-name">{profile.name || 'You'}</span>
            <span className="gv-row__subtitle">
              Level {lvl.level} · <span lang="bg">{lvl.name.bg}</span> · {lvl.name.en}
            </span>
            <span className="gv-progress me-xp" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lvl.progress * 100)} aria-label={`${summary.totalXp - lvl.floor} of ${lvl.next - lvl.floor} XP to level ${lvl.level + 1}`}>
              <span className="gv-progress__fill" style={{ width: `${Math.max(3, Math.round(lvl.progress * 100))}%`, display: 'block' }} />
            </span>
          </span>
        </div>
      </div>
      <div className="gv-statgrid me-stats">
        <div className="gv-statcell">
          <span className="gv-statcell__label">Streak</span>
          <span className={`gv-statcell__value ${streak > 0 ? 'me-accent' : ''}`}>
            {streak}
            <span className="gv-statcell__unit">{streak === 1 ? 'day' : 'days'}</span>
          </span>
        </div>
        <div className="gv-statcell">
          <span className="gv-statcell__label">Total XP</span>
          <span className="gv-statcell__value">{summary.totalXp.toLocaleString('en-GB')}</span>
        </div>
        <div className="gv-statcell">
          <span className="gv-statcell__label">Words learned</span>
          <span className="gv-statcell__value">{learned.toLocaleString('en-GB')}</span>
        </div>
      </div>
      <p className="gv-section-footer">
        {(lvl.next - summary.totalXp).toLocaleString('en-GB')} XP to level {lvl.level + 1}.
      </p>
    </section>
  )
}

/** Freezes protect the streak; a broken streak can sometimes be repaired. */
function StreakSection() {
  const st = useApp((s) => s.streak)
  const toNext = Math.max(0, 7 - st.goalDays)
  const deadline = st.repairDeadline ? new Date(st.repairDeadline).toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : ''
  return (
    <Section
      title="Streak"
      footer={<>A freeze covers one missed day by itself. You earn one for every 7 days you reach your daily goal, and can hold up to 2.</>}
    >
      <Row icon={<IconFlame />} tone="gv-tone-gold" title="Current streak" subtitle={st.frozenToday ? 'A freeze saved your streak yesterday.' : `Best: ${st.best} ${st.best === 1 ? 'day' : 'days'}`} accessory={<span className="me-value">{st.streak} {st.streak === 1 ? 'day' : 'days'}</span>} />
      <Row
        icon={<IconStar />}
        title="Streak freezes"
        subtitle={st.freezes >= 2 ? 'You hold the maximum.' : `Next one in ${toNext} goal ${toNext === 1 ? 'day' : 'days'}.`}
        accessory={<span className="me-value">{st.freezes} of 2</span>}
      >
        <span className="gv-progress me-freeze-bar" aria-hidden="true">
          <span className="gv-progress__fill" style={{ width: `${Math.max(4, Math.round((Math.min(7, st.goalDays) / 7) * 100))}%`, display: 'block' }} />
        </span>
      </Row>
      {st.repairable && (
        <Row
          className="me-repair"
          icon={<IconRefresh />}
          tone="gv-tone-warn"
          title="Repair your streak"
          subtitle={`Finish ${st.repairSessionsLeft} more ${st.repairSessionsLeft === 1 ? 'session' : 'sessions'}${deadline ? ` by ${deadline}` : ''} to bring back your ${st.best}-day streak.`}
        />
      )}
    </Section>
  )
}

/** Practise together: "Quiz me" and the phrases the two of you add. */
function TogetherSection() {
  const go = useApp((s) => s.go)
  const addOurPhrase = useApp((s) => s.addOurPhrase)
  const removeOurPhrase = useApp((s) => s.removeOurPhrase)
  const showToast = useApp((s) => s.showToast)
  const [phrases, setPhrases] = useState<CustomItem[]>([])
  const [partner, setPartner] = useState('')
  const [adding, setAdding] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)

  const reload = () => void listOurPhrases().then(setPhrases)
  useEffect(() => {
    reload()
    void getPartner().then((p) => setPartner(p?.name?.trim() ?? ''))
  }, [])

  const her = partner || 'her'
  async function remove(id: string) {
    await removeOurPhrase(id)
    setConfirm(null)
    reload()
    showToast('Phrase removed')
  }

  return (
    <>
      <Section title="Practise together" footer={<>She reads the English, you say it in Bulgarian, and she taps whether you got it. Counts as speaking practice.</>}>
        <button type="button" className="gv-row me-nav-row" onClick={() => go({ name: 'quiz' })}>
          <Tile icon={<IconHeart />} tone="gv-tone-love" />
          <span className="gv-row__body">
            <span className="gv-row__title">Quiz me</span>
            <span className="gv-row__subtitle">Hand the phone to {her} for a 2-minute quiz</span>
          </span>
          <span className="gv-row__chevron" aria-hidden="true">
            <IconChevron />
          </span>
        </button>
      </Section>

      <Section title="Our phrases" footer={<>Phrases you add are practised like any other word.</>}>
        {phrases.map((p) => (
          <div key={p.id} className="gv-row me-phrase">
            {p.emoji && (
              <span className="me-phrase__emoji" aria-hidden="true">
                {p.emoji}
              </span>
            )}
            <span className="gv-row__body">
              <span className="gv-row__title" lang="bg">
                {p.bg}
              </span>
              <span className="gv-row__subtitle">
                {p.en}
                {p.tr ? ` · ${p.tr}` : ''} · added by {p.addedBy === 'her' ? her : 'you'}
              </span>
            </span>
            {confirm === p.id ? (
              <button type="button" className="me-phrase__confirm" onClick={() => void remove(p.id)}>
                Delete
              </button>
            ) : (
              <button type="button" className="me-phrase__del" onClick={() => setConfirm(p.id)} aria-label={`Delete ${p.bg}`}>
                <IconX width={16} height={16} />
              </button>
            )}
          </div>
        ))}
        {phrases.length === 0 && (
          <div className="gv-row me-empty">
            <Illustration name="phrases" size={88} />
            <span className="me-empty__text">
              <span className="gv-row__title">No phrases yet</span>
              <span className="gv-row__subtitle">Add the things you and {her} really say at home.</span>
            </span>
          </div>
        )}
        <ActionRow label="Add a phrase" onClick={() => setAdding(true)} />
      </Section>

      <AddPhraseSheet
        open={adding}
        her={her}
        onClose={() => setAdding(false)}
        onSave={async (p) => {
          const it = await addOurPhrase(p)
          if (!it) return false
          setAdding(false)
          reload()
          showToast('Added to Our phrases')
          return true
        }}
      />
    </>
  )
}

function AddPhraseSheet({ open, her, onClose, onSave }: { open: boolean; her: string; onClose: () => void; onSave: (p: { bg: string; en: string; tr?: string; emoji?: string; addedBy: 'her' | 'me' }) => Promise<boolean> }) {
  const [bg, setBg] = useState('')
  const [en, setEn] = useState('')
  const [tr, setTr] = useState('')
  const [emoji, setEmoji] = useState('')
  const [by, setBy] = useState<'her' | 'me'>('her')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    setBg('')
    setEn('')
    setTr('')
    setEmoji('')
    setError('')
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!/[\u0400-\u04FF]/.test(bg)) return setError('Write the Bulgarian in Cyrillic letters.')
    if (!en.trim()) return setError('Add what it means in English.')
    const ok = await onSave({ bg: bg.trim(), en: en.trim(), tr: tr.trim() || undefined, emoji: emoji.trim() || undefined, addedBy: by })
    if (!ok) setError('That phrase is already in the list.')
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Add a phrase">
      <form className="me-add" onSubmit={(e) => void submit(e)}>
        <div className="gv-list">
          <label className="gv-row me-field">
            <span className="me-field__label">Bulgarian</span>
            <input lang="bg" value={bg} onChange={(e) => setBg(e.target.value)} placeholder="Обичам те, слънчице." autoComplete="off" autoCorrect="off" spellCheck={false} />
          </label>
          <label className="gv-row me-field">
            <span className="me-field__label">English</span>
            <input value={en} onChange={(e) => setEn(e.target.value)} placeholder="I love you, sunshine." autoComplete="off" />
          </label>
          <label className="gv-row me-field">
            <span className="me-field__label">Sounds like</span>
            <input value={tr} onChange={(e) => setTr(e.target.value)} placeholder="Optional, e.g. obícham te" autoComplete="off" autoCorrect="off" spellCheck={false} />
          </label>
          <label className="gv-row me-field">
            <span className="me-field__label">Emoji</span>
            <input value={emoji} onChange={(e) => setEmoji(e.target.value.slice(0, 4))} placeholder="Optional" autoComplete="off" />
          </label>
        </div>
        <div className="me-add__by">
          <span className="gv-section-header">Added by</span>
          <Segmented block label="Added by" value={by} options={[{ v: 'her' as const, label: her === 'her' ? 'Her' : her }, { v: 'me' as const, label: 'Me' }]} onPick={setBy} />
        </div>
        {error && (
          <p className="me-add__error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="gv-btn gv-btn--block">
          Add phrase
        </button>
      </form>
    </BottomSheet>
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
  const focusShort = focus.track === 'plan' ? '12-week plan' : (trackById.get(focus.track)?.title ?? focus.track)
  const focusLong =
    focus.track === 'plan' ? `Week ${week.week}: ${week.title}` : `${trackById.get(focus.track)?.title ?? focus.track}, ${focus.scope === 'day' ? 'today' : 'this week'}`

  return (
    <Section title="Learning" footer="Focus decides what the Today card suggests. Bulgarian changes some words by who is speaking, so Govori uses the right form for you.">
      <button type="button" className="gv-row" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
        <Tile icon={<IconPath />} tone="gv-tone-basics" />
        <span className="gv-row__body">
          <span className="gv-row__title">Focus</span>
          <span className="gv-row__subtitle">{focusLong}</span>
        </span>
        <span className="gv-row__accessory">{focusShort}</span>
        <span className={`gv-row__chevron me-chevron ${picking ? 'is-open' : ''}`} aria-hidden="true" />
      </button>
      {picking && (
        <>
          <div className="gv-row me-sub-row">
            <Segmented
              label="Focus for"
              value={scope}
              block
              options={[
                { v: 'day', label: 'Today' },
                { v: 'week', label: 'This week' },
              ]}
              onPick={setScope}
            />
          </div>
          <button
            type="button"
            className="gv-row me-sub-row"
            aria-pressed={focus.track === 'plan'}
            onClick={() => {
              sfx.tap()
              void setFocus('plan', 'week')
            }}
          >
            <span className="gv-row__icon" aria-hidden="true">
              🗓️
            </span>
            <span className="gv-row__body">
              <span className="gv-row__title">12-week plan</span>
              <span className="gv-row__subtitle">This week: {week.title}</span>
            </span>
            {focus.track === 'plan' && (
              <span className="gv-row__accessory me-check">
                <IconCheck />
              </span>
            )}
          </button>
          {tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`gv-row me-sub-row gv-tone-${t.id}`}
              aria-pressed={focus.track === t.id}
              onClick={() => {
                sfx.tap()
                void setFocus(t.id as TrackId, scope)
              }}
            >
              <span className="gv-row__icon" aria-hidden="true">
                {t.emoji}
              </span>
              <span className="gv-row__body">
                <span className="gv-row__title">{t.title}</span>
                <span className="gv-row__subtitle" lang="bg">
                  {t.titleBg}
                </span>
              </span>
              {focus.track === t.id && (
                <span className="gv-row__accessory me-check">
                  <IconCheck />
                </span>
              )}
            </button>
          ))}
        </>
      )}
      <Row icon={<IconTarget />} title="Daily goal" subtitle={`${profile.dailyGoal} XP a day · a lesson is 10 to 15 XP`} accessory={<Segmented label="Daily goal" value={profile.dailyGoal} options={GOALS.map((g) => ({ v: g.xp, label: g.label }))} onPick={(v) => void setProfile({ dailyGoal: v })} />} />
      <Row
        icon={<IconUser />}
        title="Address me as"
        subtitle={
          <>
            Forms like <span lang="bg">{profile.speaker === 'f' ? 'уморена' : 'уморен'}</span>
          </>
        }
        accessory={
          <Segmented
            label="Address me as"
            value={profile.speaker}
            options={[
              { v: 'm', label: 'A man' },
              { v: 'f', label: 'A woman' },
            ]}
            onPick={(v) => void setProfile({ speaker: v })}
          />
        }
      />
      <ToggleRow id="me-translit" icon={<IconLetters />} label="Show transliteration" hint="Latin letters under the Bulgarian" on={profile.translit} onChange={(v) => void setProfile({ translit: v })} />
      <ToggleRow id="me-speaking" icon={<IconMic />} label="Speaking exercises" hint="Say words out loud and hear yourself" on={profile.speaking} onChange={(v) => void setProfile({ speaking: v })} />
    </Section>
  )
}

const VOICE_CACHE = 'govori-voices'

/** The neural voice clips: who voiced them, how many exist, how many are saved, and saving the rest. */
function VoiceClips({ count, label }: { count: number; label: string }) {
  const [saved, setSaved] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const canCache = typeof caches !== 'undefined'

  useEffect(() => {
    if (!canCache) return
    let live = true
    void caches
      .open(VOICE_CACHE)
      .then((c) => c.keys())
      .then((keys) => live && setSaved(keys.filter((r) => r.url.endsWith('.mp3')).length))
      .catch(() => live && setSaved(0))
    return () => {
      live = false
    }
  }, [canCache])

  async function saveAll() {
    setBusy(true)
    setError('')
    try {
      const cache = await caches.open(VOICE_CACHE)
      const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname))
      const todo = clipUrls().filter((u) => !have.has(new URL(u, location.href).pathname))
      let done = count - todo.length
      setSaved(done)
      let failed = 0
      const worker = async () => {
        while (todo.length) {
          const url = todo.shift()!
          try {
            const res = await fetch(url)
            if (res.ok) await cache.put(url, res)
            else failed++
          } catch {
            failed++
          }
          done++
          setSaved(done)
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
      const keys = await cache.keys()
      setSaved(keys.filter((r) => r.url.endsWith('.mp3')).length)
      if (failed) setError(`${failed} clips could not be saved. Check the connection and try again.`)
    } catch {
      setError('This phone would not let Govori save audio. Try again from the Home Screen app.')
    } finally {
      setBusy(false)
    }
  }

  const all = saved !== null && saved >= count
  const pct = Math.min(100, ((saved ?? 0) / count) * 100)
  return (
    <>
      <Row icon={<IconSpeaker />} title="Voice" accessory={label} />
      <Row icon={<IconPlay />} title="Bulgarian clips" accessory={count.toLocaleString('en-GB')} />
      {canCache && (
        <div className="gv-row me-offline">
          <Tile icon={<IconRefresh />} />
          <span className="gv-row__body">
            <span className="gv-row__title">Audio for offline</span>
            <span className="gv-row__subtitle">{saved === null ? 'Checking…' : `${Math.min(saved, count).toLocaleString('en-GB')} of ${count.toLocaleString('en-GB')} saved`}</span>
            <span className="gv-progress me-offline__bar" role="progressbar" aria-valuemin={0} aria-valuemax={count} aria-valuenow={saved ?? 0} aria-label="Audio saved for offline">
              <span className="gv-progress__fill" style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%`, display: 'block' }} />
            </span>
            {error && <span className="me-error">{error}</span>}
          </span>
          <span className="gv-row__accessory">
            <button type="button" className="gv-btn gv-btn--tinted gv-btn--sm" onClick={() => void saveAll()} disabled={busy || all}>
              {all ? 'Saved' : busy ? 'Saving…' : 'Save all'}
            </button>
          </span>
        </div>
      )}
    </>
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

  const [clips, setClips] = useState<number | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void manifestReady().then(() => {
      if (!live) return
      setClips(clipCount())
      setLabel(clipVoiceLabel())
    })
    return () => {
      live = false
    }
  }, [])

  async function test() {
    setTesting(true)
    await speak('Здравей! Как си?')
    setTesting(false)
  }

  return (
    <Section
      title="Sound"
      footer={
        clips && label ? (
          'Natural neural voices read every word and conversation. Her own recordings always play first.'
        ) : voice === false ? (
          <ol className="me-steps">
            <li>Open the iPhone Settings app.</li>
            <li>Go to Accessibility, Spoken Content, Voices.</li>
            <li>Tap Bulgarian and download the voice, then come back and test it.</li>
          </ol>
        ) : (
          'Govori uses the Bulgarian voice built into your iPhone until neural clips are available.'
        )
      }
    >
      <ToggleRow id="me-sfx" icon={<IconBell />} label="Sound effects" hint="Chimes for right and wrong answers" on={profile.sfx} onChange={(v) => void setProfile({ sfx: v })} />
      {clips && label ? (
        <VoiceClips count={clips} label={label} />
      ) : (
        <Row
          icon={<IconSpeaker />}
          title="iPhone voice"
          subtitle={voice === null ? 'Checking this phone…' : voice ? 'Bulgarian voice ready' : 'Bulgarian voice not found yet'}
          accessory={
            <button type="button" className={`gv-iconbtn gv-iconbtn--sm ${testing ? 'is-playing' : ''}`} onClick={() => void test()} aria-label="Play a test sentence: Здравей! Как си?">
              <IconSpeaker />
            </button>
          }
        />
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
  const footer = error ? (
    <span className="me-error" role="alert">
      {error}
    </span>
  ) : status && !status.standalone ? (
    'Once Govori is on your Home Screen, open it from there and come back to this page.'
  ) : status && !status.supported ? (
    status.reason
  ) : status?.reason && !onState ? (
    status.reason
  ) : (
    'A nudge around 19:30 Sofia time, or a word of the day if you already practised.'
  )

  return (
    <Section title="Reminders" footer={footer}>
      <div className="gv-row me-hero">
        <Illustration name="reminders" size={72} />
        <span className="gv-row__body">
          <span className="gv-row__title">Evening reminder</span>
          <span className="gv-row__subtitle">{!status ? 'Checking…' : onState ? 'Around 19:30 Sofia time' : 'A short nudge each evening'}</span>
        </span>
        {status && <span className={`me-pill ${onState ? 'is-on' : ''}`}>{onState ? 'On' : 'Off'}</span>}
      </div>

      {status && !status.standalone ? (
        <>
          <div className="gv-row me-block">
            <span className="gv-row__body">
              <span className="gv-row__subtitle">Reminders work when Govori runs from your Home Screen (iOS 16.4 or newer). Add it in three taps:</span>
              <InstallGuide compact />
            </span>
          </div>
          <ActionRow label="I've added it, check again" onClick={() => void check()} />
        </>
      ) : status && status.supported ? (
        <>
          {!onState && !code && status.permission !== 'denied' && <ActionRow label={busy ? 'Turning on…' : 'Turn on reminders'} onClick={() => void turnOn()} disabled={busy} />}
          {!onState && status.permission === 'denied' && <ActionRow label="I've allowed them, check again" onClick={() => void check()} />}
          {code && (
            <>
              <div className="gv-row me-block">
                <span className="gv-row__body">
                  <span className="gv-row__title">1. Copy your setup code</span>
                  <span className="gv-row__subtitle">It belongs to this phone only. Don't share it.</span>
                  <code id="me-code" className="me-code">
                    {code}
                  </code>
                </span>
                <span className="gv-row__accessory">
                  <button type="button" className="gv-btn gv-btn--tinted gv-btn--sm" onClick={() => void copy()}>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </span>
              </div>
              <LinkRow
                href={GITHUB_SECRET_URL}
                title="2. Add it to GitHub"
                subtitle={
                  <>
                    Name the secret <span className="me-mono">GOVORI_PUSH</span> and paste the code.
                  </>
                }
              />
              <LinkRow href={GITHUB_ACTION_URL} title="3. Send a test" subtitle="Tap Run workflow. A notification arrives within a minute." />
            </>
          )}
          {onState && <ActionRow label="Turn off reminders" onClick={() => void turnOff()} disabled={busy} />}
        </>
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
    <Section
      title="Her voice"
      footer="Ask your wife to record words in her voice. Govori plays her recordings instead of the synthetic voice."
      before={
        <div className="me-search">
          <IconSearch />
          <label className="sr-only" htmlFor="me-voice-search">
            Search words
          </label>
          <input id="me-voice-search" type="search" placeholder="Search Bulgarian or English" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      }
    >
      <Row
        title="Recorded"
        accessory={
          <span className="me-count">
            {recorded.size.toLocaleString('en-GB')} {recorded.size === 1 ? 'word' : 'words'}
          </span>
        }
      />
      <div className="gv-row me-sub-row">
        <Segmented
          label="Which words"
          value={scope}
          block
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
      {shown.length === 0 ? (
        <div className="gv-row">
          <span className="gv-row__body">
            <span className="gv-row__subtitle">{scope === 'learned' && !query ? 'Finish a lesson and its words show up here, ready for her to record.' : 'No words match that search.'}</span>
          </span>
        </div>
      ) : (
        shown.map((it) => (
          <div key={it.id} className="gv-row me-voice-row">
            <span className="gv-row__body">
              <span className="gv-row__title" lang="bg">
                {it.bg}
              </span>
              <span className="gv-row__subtitle">
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
          </div>
        ))
      )}
      {items.length > shown.length && <ActionRow label={`Show more (${items.length - shown.length} left)`} onClick={() => setLimit((l) => l + 30)} />}
    </Section>
  )
}

function AppearanceSection() {
  const theme = useApp((s) => s.profile.theme)
  const setProfile = useApp((s) => s.setProfile)
  return (
    <Section title="Appearance">
      <div className="gv-row me-sub-row">
        <Segmented<Profile['theme']>
          label="Theme"
          value={theme}
          block
          options={[
            { v: 'system', label: 'System' },
            { v: 'light', label: 'Light' },
            { v: 'dark', label: 'Dark' },
          ]}
          onPick={(v) => void setProfile({ theme: v })}
        />
      </div>
    </Section>
  )
}

const BACKUP_EVERY_MS = 30 * 86_400_000

function DataSection() {
  const startedAt = useApp((s) => s.profile.startedAt)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [lastExport, setLastExport] = useState<number | null>(null)
  const [hasData, setHasData] = useState(false)
  const [pending, setPending] = useState<{ backup: Backup; summary: BackupSummary } | null>(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([getKV<number | null>('lastExport', null), db.sessions.count()]).then(([at, n]) => {
      if (!live) return
      setLastExport(at)
      setHasData(n > 0)
    })
    return () => {
      live = false
    }
  }, [])

  // A gentle monthly nudge: iOS can clear a web app's data when the phone is short of space.
  const since = lastExport ?? startedAt
  const nudge = hasData && Date.now() - since > BACKUP_EVERY_MS

  async function doExport() {
    setMsg('')
    try {
      const outcome = await exportAll()
      if (outcome !== 'cancelled') setLastExport(Date.now())
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      setMsg('Could not export. Try again.')
    }
  }

  async function pickBackup(file: File | undefined) {
    setMsg('')
    if (!file) return
    try {
      setPending(await readBackup(file))
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'That file could not be read.')
    }
  }

  async function doRestore() {
    if (!pending) return
    setRestoring(true)
    try {
      await restoreBackup(pending.backup)
      window.location.reload()
    } catch {
      setRestoring(false)
      setMsg('Restoring failed. Your progress is unchanged. Try again.')
    }
  }

  async function reset() {
    setBusy(true)
    await Promise.all([db.kv.clear(), db.memory.clear(), db.lessons.clear(), db.events.clear(), db.sessions.clear()])
    window.location.reload()
  }

  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

  const footer = msg ? (
    <span className="me-error" role="alert">
      {msg}
    </span>
  ) : nudge ? (
    <span className="me-nudge" role="note">
      <strong>Back up your progress.</strong> {lastExport ? `Your last backup was on ${fmt(new Date(lastExport))}.` : "You haven't made a backup yet."} Your progress lives only on this phone, and iOS can clear app
      data when storage runs low. Export a copy to Files or iCloud once a month.
    </span>
  ) : (
    'Your progress lives only on this phone. Her recordings are never exported or deleted here.'
  )

  return (
    <Section title="Your data" footer={footer}>
      <ActionRow icon={<IconShare />} label="Export everything" subtitle={lastExport ? `Last backup ${fmt(new Date(lastExport))}` : 'Every answer, session and setting as a JSON file'} onClick={() => void doExport()} />
      <label className="gv-row me-action me-file">
        <Tile icon={<IconRefresh />} />
        <span className="gv-row__body">
          <span className="gv-row__title">Import a backup</span>
          <span className="gv-row__subtitle">Restore progress from a Govori export</span>
        </span>
        <input
          id="me-import-file"
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            void pickBackup(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {pending && (
        <div className="gv-row me-block" role="alert">
          <span className="gv-row__body">
            <span className="gv-row__title">Replace your progress with this backup?</span>
            <span className="gv-row__subtitle">
              Backup from {fmt(pending.summary.exportedAt)}: {pending.summary.lessons} lessons, {pending.summary.memory} words and letters, {pending.summary.events} answers. Everything on this phone now will be
              replaced.
            </span>
            <span className="me-buttons">
              <button type="button" className="gv-btn gv-btn--sm" onClick={() => void doRestore()} disabled={restoring}>
                {restoring ? 'Restoring…' : 'Restore backup'}
              </button>
              <button type="button" className="gv-btn gv-btn--quiet gv-btn--sm" onClick={() => setPending(null)} disabled={restoring}>
                Cancel
              </button>
            </span>
          </span>
        </div>
      )}
      {!confirm ? (
        <ActionRow icon={<IconX />} label="Reset progress" onClick={() => setConfirm(true)} />
      ) : (
        <div className="gv-row me-block" role="alert">
          <span className="gv-row__body">
            <span className="gv-row__title">Delete your streak, XP and all progress?</span>
            <span className="gv-row__subtitle">This can't be undone. Export first if you want a copy. Recordings are kept.</span>
            <span className="me-buttons">
              <button type="button" className="gv-btn gv-btn--sm" onClick={() => void reset()} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete everything'}
              </button>
              <button type="button" className="gv-btn gv-btn--quiet gv-btn--sm" onClick={() => setConfirm(false)} disabled={busy}>
                Keep my progress
              </button>
            </span>
          </span>
        </div>
      )}
    </Section>
  )
}

function About() {
  return (
    <Section title="About" footer="Made for learning my wife's language.">
      <div className="gv-row me-about">
        <BrandMark size={32} />
        <span className="gv-row__body">
          <span className="gv-row__title">Govori</span>
          <span className="gv-row__subtitle" lang="bg">
            Говори
          </span>
        </span>
        <span className="gv-row__accessory">Version 1.0</span>
      </div>
      <LinkRow icon={<IconBook />} href="https://github.com/Wasim-Dilov/govori" title="Source code" subtitle="github.com/Wasim-Dilov/govori" />
    </Section>
  )
}

export function MeScreen() {
  const reduce = useReducedMotion()
  const scrolled = useScrolled()
  const sections = [ProfileHeader, StreakSection, LearningSection, TogetherSection, SoundSection, RemindersSection, HerVoiceSection, AppearanceSection, DataSection, About]
  return (
    <main className="screen me">
      <header className={`gv-navbar ${scrolled ? 'is-scrolled' : ''}`}>
        <span className="gv-navbar__title" aria-hidden="true">
          Me
        </span>
      </header>
      <h1 className="gv-largetitle">Me</h1>
      {sections.map((S, n) => (
        <motion.div key={n} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(n, 4) * 0.03, duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}>
          <S />
        </motion.div>
      ))}
    </main>
  )
}
