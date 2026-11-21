import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { BgStyleNote } from '../components/BgStyle.tsx'
import { useApp } from '../lib/store.ts'
import { nextLesson } from '../lib/progress.ts'
import { alphabet, trackById } from '../content/index.ts'
import type { Letter } from '../content/types.ts'
import { db } from '../lib/db.ts'
import { speak, sfx } from '../lib/audio.ts'
import { BottomSheet } from '../components/FocusSheet.tsx'
import { GoalRing, LargeTitle, NavBar } from '../components/TopBar.tsx'
import { IconSpeaker, IconStar, IconTurtle } from '../components/Icons.tsx'
import './letters.css'

const ORDER = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ'

const GROUPS: { kind: Letter['kind']; title: string; titleBg: string; hint: string }[] = [
  { kind: 'familiar', title: 'Familiar faces', titleBg: 'Познати', hint: 'They look and sound like English.' },
  { kind: 'false-friend', title: 'False friends', titleBg: 'Измамници', hint: 'They look English but sound different.' },
  { kind: 'new', title: 'New shapes', titleBg: 'Нови букви', hint: 'Brand new letters to meet.' },
]

export function LettersScreen() {
  const progress = useApp((s) => s.progress)
  const learnedCount = useApp((s) => s.learned)
  const lettersLearned = useApp((s) => s.lettersLearned)
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
  }, [learnedCount, lettersLearned])

  useEffect(() => {
    if (open) setShown(open)
  }, [open])

  const sorted = useMemo(() => [...alphabet.letters].sort((a, b) => ORDER.indexOf(a.upper) - ORDER.indexOf(b.upper)), [])
  const known = sorted.filter((l) => learned.has(l.id)).length
  const track = trackById.get('azbuka')!
  const next = nextLesson(track, progress)
  const total = sorted.length

  const note = known === 0 ? 'Thirty letters, and six of them you already know.' : known === total ? 'Every letter learned. You can read Bulgarian.' : `${total - known} to go. Tap any letter to hear it in a word.`

  return (
    <div className="screen has-navbar letters gv-tone-azbuka">
      <NavBar title="Letters" />
      <LargeTitle sub="Азбука, the Bulgarian alphabet" subLang="bg">
        Letters
      </LargeTitle>

      <section className="gv-section letters-summary" aria-label="Your progress">
        <div className="gv-list">
          <div className="gv-row letters-summary__row">
            <GoalRing value={known} goal={total} size={44} width={3} label={`${known} of ${total} letters learned`}>
              <span className="letters-summary__pct">{Math.round((known / total) * 100)}%</span>
            </GoalRing>
            <span className="gv-row__body">
              <span className="gv-row__title">
                {known} of {total} letters
              </span>
              <span className="gv-row__subtitle">{note}</span>
            </span>
          </div>
        </div>
        {next && (
          <button
            type="button"
            className="gv-btn gv-btn--block letters-continue"
            onClick={() => {
              sfx.tap()
              void startLesson(next.lesson.id, next.level)
            }}
          >
            {(progress[next.lesson.id]?.level ?? 0) > 0 ? `Continue: ${next.lesson.title}` : `Learn next: ${next.lesson.title}`}
          </button>
        )}
      </section>

      {GROUPS.map((g, gi) => {
        const letters = sorted.filter((l) => l.kind === g.kind)
        const groupKnown = letters.filter((l) => learned.has(l.id)).length
        return (
          <section key={g.kind} className="gv-section letters-group" aria-labelledby={`lg-${g.kind}`}>
            <div className="gv-section-header letters-group__head">
              <h2 id={`lg-${g.kind}`} className="gv-section-header__title">
                {g.title}
              </h2>
              <span className="letters-group__count">
                {groupKnown} of {letters.length}
              </span>
            </div>
            <div className="letters-card">
              <div className="letters-grid">
                {letters.map((l, i) => {
                  const isKnown = learned.has(l.id)
                  return (
                    <motion.button
                      key={l.id}
                      type="button"
                      className={`letters-cell${isKnown ? ' is-known' : ''}`}
                      onClick={() => {
                        sfx.tap()
                        setOpen(l)
                      }}
                      aria-label={`${l.upper}, sounds ${l.tr}${isKnown ? ', learned' : ''}`}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: reduce ? 0 : gi * 0.05 + i * 0.012 }}
                    >
                      <span className="letters-cell__glyph" lang="bg">
                        {l.upper}
                        <span className="letters-cell__lower">{l.lower}</span>
                      </span>
                      <span className="letters-cell__tr">{l.tr}</span>
                    </motion.button>
                  )
                })}
              </div>
            </div>
            <p className="gv-section-footer">
              <span lang="bg">{g.titleBg}</span>. {g.hint}
            </p>
          </section>
        )
      })}

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
      <p className="letter-sheet__kind">
        {kindLabel}
        {known ? ' · learned' : ''}
      </p>
      <div className="gv-letter letter-sheet__card">
        <span id="letter-sheet-title" className="gv-letter__glyph" lang="bg">
          {letter.upper}
          {letter.lower}
        </span>
        <span className="gv-letter__sound">sounds like “{letter.tr}”</span>
        <span className="gv-letter__hint">{letter.sound}</span>
        <BgStyleNote letter={letter} />
      </div>
      <p className="letter-sheet__mnemonic">
        <IconStar className="letter-sheet__star" aria-hidden="true" />
        <span>{letter.mnemonic}</span>
      </p>
      <div className="gv-list">
        <div className="gv-row letter-sheet__example">
          <span className="letter-sheet__emoji" aria-hidden="true">
            {letter.example.emoji}
          </span>
          <span className="gv-row__body">
            <span className="gv-row__title" lang="bg">
              {letter.example.bg}
            </span>
            <span className="gv-row__subtitle">
              {letter.example.tr} · {letter.example.en}
            </span>
          </span>
          <button type="button" className={`gv-iconbtn gv-iconbtn--sm${playing === 'slow' ? ' is-playing' : ''} letter-sheet__slow`} onClick={() => play(true)} aria-label="Hear it slowly">
            <IconTurtle />
          </button>
          <button type="button" className={`gv-iconbtn${playing === 'normal' ? ' is-playing' : ''}`} onClick={() => play(false)} aria-label={`Hear ${letter.example.bg}`}>
            <IconSpeaker />
          </button>
        </div>
      </div>
    </div>
  )
}
