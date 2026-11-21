import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { IconShare } from './Icons.tsx'
import { useApp } from '../lib/store.ts'
import type { SessionResult } from '../lib/progress.ts'
import type { Milestone } from '../lib/milestones.ts'
import type { Speaker } from '../content/index.ts'
import { buildSessionCard, buildWeekCard, cardText, copyText, getPartner, renderCard, savePartner, shareCard, suggestedMessage, type CardData, type Partner } from '../lib/shareCard.ts'
import './share.css'

type Step = 'setup' | 'preview'
type Build = (opts: { partner: string; from: string; message: string; speaker: Speaker }) => Promise<CardData>

/** "Share with her": a tinted button that opens a sheet with a progress card to send to his wife. */
export function ShareProgress({ result, milestone, className }: { result: SessionResult; milestone?: Milestone; className?: string }) {
  const build = useCallback<Build>((o) => buildSessionCard(result, { ...o, milestone }), [result, milestone])
  return <ShareFlow build={build} sheetTitle="Share today’s progress" className={className} />
}

/** "Share my week": the same sheet with the last 7 days on the card (used by the Sunday week card). */
export function ShareWeek({ className, label = 'Share my week' }: { className?: string; label?: string }) {
  const build = useCallback<Build>((o) => buildWeekCard(o), [])
  return <ShareFlow build={build} sheetTitle="Share your week" className={className} triggerLabel={label} />
}

function ShareFlow({ build, sheetTitle, className, triggerLabel }: { build: Build; sheetTitle: string; className?: string; triggerLabel?: string }) {
  const profileName = useApp((s) => s.profile.name)
  const speaker = useApp((s) => s.profile.speaker)
  const reduce = useReducedMotion()

  const [partner, setPartner] = useState<Partner | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('preview')
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const [message, setMessage] = useState(suggestedMessage)
  const [card, setCard] = useState<{ data: CardData; png: Blob; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getPartner().then((p) => setPartner(p))
  }, [])

  const openSheet = () => {
    setName(partner?.name ?? '')
    setFrom(partner?.from || profileName || '')
    setStep(partner ? 'preview' : 'setup')
    setStatus('')
    setOpen(true)
  }

  // Render the card whenever the inputs change (debounced while typing).
  useEffect(() => {
    if (!open || step !== 'preview') return
    let cancelled = false
    const t = setTimeout(async () => {
      const data = await build({ partner: partner?.name ?? '', from: partner?.from || profileName || '', message, speaker })
      const png = await renderCard(data)
      if (cancelled) return
      setCard({ data, png, url: URL.createObjectURL(png) })
    }, card ? 280 : 0)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, message, partner, profileName, speaker, build])

  // Free the previous preview image whenever a new one replaces it, and on unmount.
  useEffect(() => {
    if (!card) return
    return () => URL.revokeObjectURL(card.url)
  }, [card])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    sheetRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const saveSetup = async () => {
    const p = { name: name.trim(), from: from.trim() }
    await savePartner(p)
    setPartner(p)
    setStep('preview')
  }

  const share = async () => {
    if (!card) return
    setBusy(true)
    setStatus('')
    const outcome = await shareCard(card.data, card.png)
    setBusy(false)
    if (outcome === 'downloaded') setStatus('Image saved and the message copied. Send them to her from Messages.')
    else if (outcome === 'shared' || outcome === 'shared-text') close()
  }

  const copy = async () => {
    if (!card) return
    const ok = await copyText(cardText(card.data))
    setStatus(ok ? 'Message copied.' : 'Could not copy. Long-press the text to copy it.')
  }

  const label = triggerLabel ?? (partner?.name ? `Share with ${partner.name}` : 'Share with her')

  return (
    <>
      <button type="button" className={className ?? 'gv-btn gv-btn--tinted gv-btn--block gv-tone-rose share-trigger'} onClick={openSheet} disabled={partner === undefined}>
        <IconShare width={20} height={20} />
        {label}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="share-scrim" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}>
            <motion.div
              ref={sheetRef}
              className="gv-sheet share-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-title"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              initial={{ y: reduce ? 0 : '100%' }}
              animate={{ y: 0 }}
              exit={{ y: reduce ? 0 : '100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            >
              <div className="gv-sheet__grip" />
              <div className="share-head">
                <h2 id="share-title" className="t-headline">
                  {step === 'setup' ? 'Who is it for?' : sheetTitle}
                </h2>
                <button type="button" className="gv-btn gv-btn--plain gv-btn--sm gv-tone-rose share-head__done" onClick={close}>
                  {step === 'setup' ? 'Cancel' : 'Done'}
                </button>
              </div>

              {step === 'setup' ? (
                <form
                  className="share-setup"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void saveSetup()
                  }}
                >
                  <p className="t-subhead share-muted">Govori makes a small card of what you learned, ready to send her in Messages or WhatsApp.</p>
                  <div className="gv-list share-fields">
                    <label className="share-field">
                      <span className="share-field__label">Her name</span>
                      <input id="share-partner" className="share-field__input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" autoComplete="off" autoCapitalize="words" />
                    </label>
                    <label className="share-field">
                      <span className="share-field__label">Sign as</span>
                      <input id="share-from" className="share-field__input" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Your name" autoComplete="given-name" autoCapitalize="words" />
                    </label>
                  </div>
                  <p className="t-footnote share-muted share-footnote">Her name appears on the card, as in “Обичам те, Maria.” You can change it any time.</p>
                  <button type="submit" className="gv-btn gv-btn--block">
                    Continue
                  </button>
                </form>
              ) : (
                <div className="share-preview-step">
                  <div className="share-preview" aria-live="polite">
                    {card ? <img src={card.url} alt={`Progress card: ${card.data.headline}. ${card.data.subtitle}.`} className="share-preview__img" /> : <div className="share-preview__placeholder" aria-label="Preparing the card" />}
                  </div>

                  <div className="gv-list share-fields">
                    <label className="share-field">
                      <span className="share-field__label">Message</span>
                      <input id="share-message" className="share-field__input" value={message} maxLength={80} onChange={(e) => setMessage(e.target.value)} placeholder="Add a line for her" autoComplete="off" />
                    </label>
                    <button type="button" className="share-field share-field--button" onClick={() => setStep('setup')}>
                      <span className="share-field__label">To</span>
                      <span className="share-field__value">{partner?.name || 'Her'}</span>
                      <span className="share-field__edit">Edit</span>
                    </button>
                  </div>

                  {status && (
                    <p className="t-footnote share-status" role="status">
                      {status}
                    </p>
                  )}

                  <div className="share-actions">
                    <button type="button" className="gv-btn gv-btn--block" onClick={() => void share()} disabled={!card || busy}>
                      <IconShare width={20} height={20} />
                      {busy ? 'Sharing…' : 'Share'}
                    </button>
                    <button type="button" className="gv-btn gv-btn--plain gv-btn--block gv-tone-rose" onClick={() => void copy()} disabled={!card}>
                      Copy text
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default ShareProgress
