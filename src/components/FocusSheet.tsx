import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useApp } from '../lib/store.ts'
import { tracks, type TrackView } from '../content/index.ts'
import type { LessonProgress } from '../lib/db.ts'
import { PLAN, planWeek } from '../content/plan.ts'
import { IconChevron, IconClose, IconPath } from './Icons.tsx'
import '../screens/home.css'

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
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="gv-sheet__grip" />
            {title && (
              <div className="sheet-head">
                <h2 id={headingId} className="t-card-title">
                  {title}
                </h2>
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
    <BottomSheet open={open} onClose={onClose} title="What do you want to learn?">
      <div className="focus-body">
        <div className="focus-scope">
          <span className="t-caption muted">Keep this focus for</span>
          <div className="gv-chips" role="group" aria-label="Focus length">
            <button type="button" className="gv-chip" aria-pressed={scope === 'day'} onClick={() => setScope('day')}>
              Today
            </button>
            <button type="button" className="gv-chip" aria-pressed={scope === 'week'} onClick={() => setScope('week')}>
              This week
            </button>
          </div>
        </div>

        <button type="button" className={`gv-trackcard gv-tone-rose${focus.track === 'plan' ? ' is-active' : ''}`} onClick={() => choose('plan')}>
          <span className="gv-trackcard__icon focus-plan-icon" aria-hidden="true">
            <IconPath />
          </span>
          <span>
            <span className="gv-trackcard__title">Follow my 12-week plan</span>
            <span className="gv-trackcard__meta" style={{ display: 'block' }}>
              Week {week.week}: {week.title}
            </span>
          </span>
          <IconChevron className="focus-chev" />
        </button>

        <div className="focus-tracks">
          {tracks.map((t) => {
            const c = lessonsDone(t, progress)
            const active = focus.track === t.id
            return (
              <button key={t.id} type="button" className={`gv-trackcard gv-tone-${t.id}${active ? ' is-active' : ''}`} onClick={() => choose(t.id)} aria-pressed={active}>
                <span className="gv-trackcard__icon" aria-hidden="true">
                  {t.emoji}
                </span>
                <span className="focus-track-text">
                  <span className="gv-trackcard__title">{t.title}</span>
                  <span className="gv-trackcard__bg" lang="bg">
                    {t.titleBg}
                  </span>
                  <span className="gv-trackcard__meta">
                    {c.done} of {c.total} lessons
                  </span>
                </span>
                <span className="focus-mini" aria-hidden="true">
                  <span style={{ width: `${c.total && c.done ? Math.max(8, (c.done / c.total) * 100) : 0}%` }} />
                </span>
              </button>
            )
          })}
        </div>

        <button type="button" className="focus-plan-toggle" aria-expanded={showPlan} onClick={() => setShowPlan((v) => !v)}>
          <span>{showPlan ? 'Hide' : 'Peek at'} the 12-week plan</span>
          <IconChevron className={showPlan ? 'is-open' : ''} />
        </button>
        {showPlan && (
          <ol className="focus-plan">
            {PLAN.map((w) => {
              const t = tracks.find((x) => x.id === w.focus)
              return (
                <li key={w.week} className={w.week === week.week ? 'is-now' : w.week < week.week ? 'is-past' : ''}>
                  <span className="focus-plan__wk">{w.week}</span>
                  <span className="focus-plan__text">
                    <strong>{w.title}</strong>
                    <span lang="bg">{w.titleBg}</span>
                  </span>
                  <span className="focus-plan__emoji" aria-label={t?.title}>
                    {t?.emoji}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </BottomSheet>
  )
}
