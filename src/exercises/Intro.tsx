import { motion, useReducedMotion } from 'motion/react'
import { SpeakButton, curly, heroSize } from './common.tsx'
import { BgStyleNote } from '../components/BgStyle.tsx'
import { EmojiTile } from '../components/EmojiTile.tsx'
import type { ExerciseProps } from './types.ts'

const EASE = [0.2, 0.8, 0.2, 1] as [number, number, number, number]

/** Meet a new word, phrase or letter: one calm, centred hero moment. */
export function IntroExercise({ ex, translit }: ExerciseProps<'intro'>) {
  const it = ex.item
  const still = useReducedMotion()
  // The tile settles in first, then the word rises into place beneath it.
  const tileIn = still ? {} : { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.2, ease: EASE } }
  const wordIn = still ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.26, ease: EASE, delay: 0.12 } }
  const restIn = still ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.24, delay: 0.3 } }

  if (it.letter) {
    const l = it.letter
    return (
      <div className="ex ex-intro">
        <div className="ex-intro__hero">
          <p className="t-eyebrow ex-eyebrow">New letter</p>
          <motion.span className="ex-intro__glyph" lang="bg" {...tileIn}>
            {l.upper}
            {l.lower}
          </motion.span>
          <motion.div className="ex-intro__words" {...wordIn}>
            <span className="ex-intro__sound">Sounds like “{l.tr}”</span>
            <span className="ex-intro__tr">{curly(l.sound)}</span>
          </motion.div>
        </div>

        <motion.div className="ex-answers ex-intro__more" {...restIn}>
          <section className="gv-section ex-section">
            <h3 className="gv-section-header">Example</h3>
            <div className="gv-list">
              <div className="gv-row">
                <EmojiTile emoji={l.example.emoji} size={44} track="azbuka" />
                <span className="gv-row__body">
                  <span className="gv-row__title t-headline" lang="bg">
                    {l.example.bg}
                  </span>
                  <span className="gv-row__subtitle">
                    {l.example.tr} · {l.example.en}
                  </span>
                </span>
                <SpeakButton text={l.example.bg} size="sm" auto label={`Play ${l.example.bg}`} />
              </div>
            </div>
          </section>
          <section className="gv-section ex-section">
            <h3 className="gv-section-header">Memory hook</h3>
            <div className="gv-list">
              <p className="gv-row ex-row-text">{l.mnemonic}</p>
            </div>
          </section>
          <BgStyleNote letter={l} />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="ex ex-intro">
      <div className="ex-intro__hero">
        <p className="t-eyebrow ex-eyebrow">{it.kind === 'phrase' ? 'New phrase' : 'New word'}</p>
        <motion.div {...tileIn}>
          <EmojiTile emoji={it.emoji} size={96} track={it.trackId} />
        </motion.div>
        <motion.div className="ex-intro__words" {...wordIn}>
          <span className={`t-bg-hero ex-intro__bg ex-intro__bg--${heroSize(it.bg)}`} lang="bg">
            {it.bg}
          </span>
          {translit && <span className="ex-intro__tr">{it.tr}</span>}
          <span className="ex-intro__en">{it.en}</span>
        </motion.div>
        <motion.div className="ex-intro__audio" {...restIn}>
          <SpeakButton text={it.bg} itemId={it.id} size="hero" auto label={`Play ${it.bg}`} />
          <SpeakButton text={it.bg} itemId={it.id} slow />
        </motion.div>
      </div>
      {it.note && (
        <motion.div className="gv-card ex-note ex-answers" {...restIn}>
          <span className="ex-note__mark" aria-hidden="true" />
          <p>{it.note}</p>
        </motion.div>
      )}
    </div>
  )
}
