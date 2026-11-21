import { motion } from 'motion/react'
import { Bg, SpeakButton } from './common.tsx'
import { BgStyleNote } from '../components/BgStyle.tsx'
import type { ExerciseProps } from './types.ts'

const enter = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.25, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] } }

/** Meet a new word, phrase or letter. */
export function IntroExercise({ ex, translit }: ExerciseProps<'intro'>) {
  const it = ex.item
  if (it.letter) {
    const l = it.letter
    return (
      <div className="ex ex-intro">
        <p className="ex-eyebrow">New letter</p>
        <motion.div className="gv-letter gv-tone-azbuka" {...enter}>
          <span className="gv-letter__glyph" lang="bg">
            {l.upper}
            {l.lower}
          </span>
          <span className="gv-letter__sound">Sounds like “{l.tr}”</span>
          <span className="gv-letter__hint">{l.sound}</span>
          <BgStyleNote letter={l} />
        </motion.div>

        <section className="gv-section ex-section">
          <h3 className="gv-section-header">Memory hook</h3>
          <div className="gv-list">
            <p className="gv-row ex-row-text">{l.mnemonic}</p>
          </div>
        </section>

        <section className="gv-section ex-section">
          <h3 className="gv-section-header">Example</h3>
          <div className="gv-list">
            <div className="gv-row">
              <span className="ex-row-emoji" aria-hidden="true">
                {l.example.emoji}
              </span>
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
      </div>
    )
  }
  return (
    <div className="ex ex-intro">
      <p className="ex-eyebrow">{it.kind === 'phrase' ? 'New phrase' : 'New word'}</p>
      <motion.div className="gv-card ex-introcard" {...enter}>
        <span className="ex-introcard__emoji" aria-hidden="true">
          {it.emoji}
        </span>
        <Bg text={it.bg} tr={it.tr} showTr={translit} className="t-bg-word ex-introcard__bg" />
        <p className="ex-introcard__en">{it.en}</p>
        <div className="ex-introcard__audio">
          <SpeakButton text={it.bg} itemId={it.id} auto />
          <SpeakButton text={it.bg} itemId={it.id} slow />
        </div>
      </motion.div>
      {it.note && (
        <motion.div className="gv-card ex-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.25 }}>
          <span className="ex-note__mark" aria-hidden="true" />
          <p>{it.note}</p>
        </motion.div>
      )}
    </div>
  )
}
