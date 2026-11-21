import { useEffect, useMemo, useState } from 'react'
import { BgStyleNote } from '../components/BgStyle.tsx'
import { motion, useReducedMotion } from 'motion/react'
import { useApp } from '../lib/store.ts'
import { nextLesson } from '../lib/progress.ts'
import { alphabet, trackById } from '../content/index.ts'
import type { Letter } from '../content/types.ts'
import { db } from '../lib/db.ts'
import { speak, sfx } from '../lib/audio.ts'
import { BottomSheet } from '../components/FocusSheet.tsx'
import { IconCheck, IconSpeaker, IconTurtle } from '../components/Icons.tsx'
import './letters.css'

const ORDER = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ'

const GROUPS: { kind: Letter['kind']; title: string; titleBg: string; hint: string }[] = [
  { kind: 'familiar', title: 'Familiar faces', titleBg: 'Познати', hint: 'Look and sound like English.' },
  { kind: 'false-friend', title: 'False friends', titleBg: 'Измамници', hint: 'Look English, sound different.' },
  { kind: 'new', title: 'New shapes', titleBg: 'Нови букви', hint: 'Brand new letters to meet.' },
]

export function LettersScreen() {
  const progress = useApp((s) => s.progress)
  const learnedCount = useApp((s) => s.learned)
  const startLesson = useApp((s) => s.startLesson)
  const reduce = useReducedMotion()
  const [learned, setLearned] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Letter | null>(null)
  const [shown, setShown] = useState<Letter | null>(null)

  useEffect(() => {
    let live = true
    db.memory
      .where('itemId')
      .startsWith('az.')
      .primaryKeys()
      .then((keys) => live && setLearned(new Set(keys as string[])))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [learnedCount])

  useEffect(() => {
    if (open) setShown(open)
  }, [open])

  const sorted = useMemo(() => [...alphabet.letters].sort((a, b) => ORDER.indexOf(a.upper) - ORDER.indexOf(b.upper)), [])
  const known = sorted.filter((l) => learned.has(l.id)).length
  const track = trackById.get('azbuka')!
  const next = nextLesson(track, progress)
  const ratio = known / sorted.length

  return (
    <div className="screen letters gv-tone-azbuka">
      <header className="letters-head">
        <div>
          <p className="letters-eyebrow">The alphabet</p>
          <h1 className="t-screen-title" lang="bg">
            Азбука
          </h1>
        </div>
        <div className="letters-count" aria-label={`${known} of 30 letters learned`}>
          <strong>{known}</strong>
          <span>/ 30</span>
        </div>
      </header>

      <section className="letters-progress gv-card">
        <div className="gv-progress" aria-hidden="true">
          <div className="gv-progress__fill" style={{ width: `${Math.max(4, ratio * 100)}%` }} />
        </div>
        <p className="t-caption muted">
          {known === 0 ? 'Thirty letters, and six of them you already know.' : known === 30 ? 'Every letter learned. You can read Bulgarian.' : `${30 - known} letters to go. Tap any letter to hear it in a word.`}
        </p>
        {next && (
          <button
            type="button"
            className="gv-btn gv-btn--block letters-continue"
            onClick={() => {
              sfx.tap()
              void startLesson(next.lesson.id, next.level)
            }}
          >
            {(progress[next.lesson.id]?.level ?? 0) > 0 ? `Continue · ${next.lesson.title}` : `Learn next · ${next.lesson.title}`}
          </button>
        )}
      </section>

      {GROUPS.map((g, gi) => {
        const letters = sorted.filter((l) => l.kind === g.kind)
        return (
          <section key={g.kind} className="letters-group" aria-labelledby={`lg-${g.kind}`}>
            <div className="letters-group__head">
              <h2 id={`lg-${g.kind}`} className="t-card-title">
                {g.title}
              </h2>
              <span lang="bg" className="letters-group__bg">
                {g.titleBg}
              </span>
            </div>
            <p className="t-caption muted">{g.hint}</p>
            <div className="letters-grid">
              {letters.map((l, i) => {
                const isKnown = learned.has(l.id)
                return (
                  <motion.button
                    key={l.id}
                    type="button"
                    className={`letters-tile${isKnown ? ' is-known' : ''}`}
                    onClick={() => {
                      sfx.tap()
                      setOpen(l)
                    }}
                    aria-label={`${l.upper}, sounds ${l.tr}${isKnown ? ', learned' : ''}`}
                    initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: reduce ? 0 : gi * 0.08 + i * 0.025, type: 'spring', stiffness: 380, damping: 24 }}
                  >
                    <span className="letters-tile__glyph" lang="bg">
                      {l.upper}
                      <span className="letters-tile__lower">{l.lower}</span>
                    </span>
                    <span className="letters-tile__tr">{l.tr}</span>
                    {isKnown && (
                      <span className="letters-tile__check" aria-hidden="true">
                        <IconCheck />
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </section>
        )
      })}

      <div className="gv-shevitsa letters-band" aria-hidden="true" />

      <BottomSheet open={!!open} onClose={() => setOpen(null)} labelledBy="letter-sheet-title">
        {(open ?? shown) && <LetterCard letter={(open ?? shown)!} known={learned.has((open ?? shown)!.id)} />}
      </BottomSheet>
    </div>
  )
}

function LetterCard({ letter, known }: { letter: Letter; known: boolean }) {
  const [playing, setPlaying] = useState<'normal' | 'slow' | null>(null)
  const play = async (slow: boolean) => {
    setPlaying(slow ? 'slow' : 'normal')
    await speak(letter.example.bg, { slow })
    setPlaying(null)
  }
  const kindLabel = letter.kind === 'familiar' ? 'Familiar face' : letter.kind === 'false-friend' ? 'False friend' : 'New shape'
  return (
    <div className="letter-sheet gv-tone-azbuka">
      <div className="gv-letter">
        <span className="letter-sheet__kind">
          {kindLabel}
          {known ? ' · learned' : ''}
        </span>
        <span id="letter-sheet-title" className="gv-letter__glyph" lang="bg">
          {letter.upper}
          {letter.lower}
        </span>
        <span className="gv-letter__sound">“{letter.tr}”</span>
        <span className="gv-letter__hint">Sounds {letter.sound}.</span>
        <BgStyleNote letter={letter} />
      </div>
      <p className="letter-sheet__mnemonic">
        <span className="gv-star" aria-hidden="true" />
        <span>{letter.mnemonic}</span>
      </p>
      <div className="letter-sheet__example">
        <span className="letter-sheet__emoji" aria-hidden="true">
          {letter.example.emoji}
        </span>
        <span className="letter-sheet__word">
          <strong lang="bg">{letter.example.bg}</strong>
          <span className="t-caption muted">
            {letter.example.tr} · {letter.example.en}
          </span>
        </span>
        <button type="button" className={`gv-iconbtn${playing === 'normal' ? ' is-playing' : ''}`} onClick={() => play(false)} aria-label={`Hear ${letter.example.bg}`}>
          <IconSpeaker />
        </button>
        <button type="button" className={`gv-iconbtn gv-iconbtn--sm${playing === 'slow' ? ' is-playing' : ''}`} onClick={() => play(true)} aria-label="Hear it slowly">
          <IconTurtle />
        </button>
      </div>
    </div>
  )
}
