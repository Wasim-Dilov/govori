import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useApp } from '../lib/store.ts'
import { tracks, type TrackView } from '../content/index.ts'
import type { TrackId } from '../content/types.ts'
import type { LessonProgress } from '../lib/db.ts'
import { PLAN, planWeek } from '../content/plan.ts'
import { IconCheck, IconClose, IconPath } from './Icons.tsx'
import './chrome.css'

// ------------------------------------------------------------- track badge

/** Each track's Bulgarian initial, shown on its badge: Азбука, Основи, Децата... */
const INITIAL: Record<TrackId, string> = { azbuka: 'А', basics: 'О', kids: 'Д', love: 'Л', home: 'В', family: 'С', grammar: 'Г', out: 'Н' }

/** An iOS Settings-style tile in the track's colour with its Cyrillic initial. */
export function TrackBadge({ track, size = 30 }: { track: TrackId | 'plan'; size?: number }) {
  const style = { '--badge-size': `${size}px` } as CSSProperties
  if (track === 'plan')
    return (
      <span className="track-badge track-badge--plan" style={style} aria-hidden="true">
        <IconPath />
      </span>
    )
  return (
    <span className={`track-badge gv-tone-${track}`} style={style} aria-hidden="true" lang="bg">
      {INITIAL[track]}
    </span>
  )
}

// ------------------------------------------------------------- generic bottom sheet

export function BottomSheet({ open, onClose, title, children, labelledBy }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; labelledBy?: string }) {
  const reduce = useReducedMotion()
  const autoId = useId()
  const headingId = labelledBy ?? `${autoId}-title`
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => sheetRef.current?.focus(), 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="sheet-layer">
          <motion.button
            type="button"
            className="sheet-backdrop"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title || labelledBy ? headingId : undefined}
            tabIndex={-1}
            className="gv-sheet sheet-panel"
            initial={{ y: reduce ? 0 : '100%' }}
            animate={{ y: 0 }}
            exit={{ y: reduce ? 0 : '100%' }}
            transition={reduce ? { duration: 0 } : { type: 'tween', duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="gv-sheet__grip" />
            {title && (
              <div className="sheet-head">
                <h2 id={headingId}>{title}</h2>
                <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
                  <IconClose />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ------------------------------------------------------------- focus picker

/** "4 of 12 lessons" (conversations not counted). */
export function lessonsDone(track: TrackView, progress: Record<string, LessonProgress>) {
  const lessons = track.lessons.filter((l) => l.kind !== 'story')
  return { done: lessons.filter((l) => (progress[l.id]?.level ?? 0) > 0).length, total: lessons.length }
}

export function FocusSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const focus = useApp((s) => s.focus)
  const progress = useApp((s) => s.progress)
  const startedAt = useApp((s) => s.profile.startedAt)
  const setFocus = useApp((s) => s.setFocus)
  const [scope, setScope] = useState<'day' | 'week'>(focus.scope)
  const [showPlan, setShowPlan] = useState(false)
  const week = planWeek(startedAt)

  useEffect(() => {
    if (open) setScope(focus.track === 'plan' ? 'week' : focus.scope)
  }, [open, focus])

  const choose = async (track: TrackView['id'] | 'plan') => {
    await setFocus(track, track === 'plan' ? 'week' : scope)
    onClose()
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="What to learn">
      <div className="focus-body">
        <div className="gv-segmented gv-segmented--block" role="group" aria-label="Keep this focus for">
          <button type="button" aria-pressed={scope === 'day'} onClick={() => setScope('day')}>
            Today
          </button>
          <button type="button" aria-pressed={scope === 'week'} onClick={() => setScope('week')}>
            This week
          </button>
        </div>

        <div>
          <div className="gv-list">
            <button type="button" className={`gv-row${focus.track === 'plan' ? ' is-current' : ''}`} onClick={() => choose('plan')} aria-pressed={focus.track === 'plan'}>
              <span className="gv-row__icon badge-slot">
                <TrackBadge track="plan" size={32} />
              </span>
              <span className="gv-row__body">
                <span className="gv-row__title">Follow my 12-week plan</span>
                <span className="gv-row__subtitle">
                  Week {week.week} · {week.title}
                </span>
              </span>
              {focus.track === 'plan' && <IconCheck className="focus-check" />}
            </button>
          </div>
          <p className="gv-section-footer">The plan changes focus each week and always lasts a full week.</p>
        </div>

        <div>
          <p className="sheet-section-title">Or focus on one track</p>
          <div className="gv-list">
            {tracks.map((t) => {
              const c = lessonsDone(t, progress)
              const active = focus.track === t.id
              return (
                <button key={t.id} type="button" className={`gv-row gv-tone-${t.id}${active ? ' is-current' : ''}`} onClick={() => choose(t.id)} aria-pressed={active}>
                  <span className="gv-row__icon badge-slot">
                    <TrackBadge track={t.id} size={32} />
                  </span>
                  <span className="gv-row__body">
                    <span className="gv-row__title">{t.title}</span>
                    <span className="gv-row__subtitle focus-row-sub">
                      <span lang="bg">{t.titleBg}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {c.done} of {c.total}
                      </span>
                    </span>
                  </span>
                  <span className="focus-mini" aria-hidden="true">
                    <span style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} />
                  </span>
                  {active ? <IconCheck className="focus-check" /> : <span className="focus-check" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="gv-list">
            <button type="button" className="gv-row focus-plan-toggle" aria-expanded={showPlan} onClick={() => setShowPlan((v) => !v)}>
              <span className="gv-row__body">
                <span className="gv-row__title">The 12-week plan</span>
              </span>
              <span className="gv-row__accessory">Week {week.week}</span>
              <span className="gv-row__chevron" aria-hidden="true" />
            </button>
            {showPlan &&
              PLAN.map((w) => {
                const t = tracks.find((x) => x.id === w.focus)
                const now = w.week === week.week
                return (
                  <div key={w.week} className={`gv-row${now ? ' is-now is-current' : w.week < week.week ? ' is-past' : ''}`} aria-current={now ? 'step' : undefined}>
                    <span className="gv-row__icon badge-slot">
                      <span className="focus-week">{w.week}</span>
                    </span>
                    <span className="gv-row__body">
                      <span className="gv-row__title">{w.title}</span>
                      <span className="gv-row__subtitle" lang="bg">
                        {w.titleBg}
                      </span>
                    </span>
                    <span className="focus-plan-track" title={t?.title}>
                      <TrackBadge track={w.focus} size={22} />
                      <span className="sr-only">{t?.title}</span>
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </BottomSheet>
  )
}
