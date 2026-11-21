import { motion } from 'motion/react'
import { Bg, SpeakButton } from './common.tsx'
import { BgStyleNote } from '../components/BgStyle.tsx'
import type { ExerciseProps } from './types.ts'

/** Meet a new word, phrase or letter. */
export function IntroExercise({ ex, translit }: ExerciseProps<'intro'>) {
  const it = ex.item
  if (it.letter) {
    const l = it.letter
    return (
      <div className="ex ex-intro">
        <p className="t-label ex-eyebrow">New letter</p>
        <motion.div className="gv-letter gv-tone-azbuka" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
          <span className="gv-letter__glyph" lang="bg">
            {l.upper}
            {l.lower}
          </span>
          <span className="gv-letter__sound">sounds like "{l.tr}"</span>
          <span className="gv-letter__hint">{l.sound}</span>
          <BgStyleNote letter={l} />
        </motion.div>
        <div className="gv-card ex-note">
          <p className="t-caption muted">Memory hook</p>
          <p>{l.mnemonic}</p>
        </div>
        <div className="gv-card ex-example">
          <span className="ex-emoji">{l.example.emoji}</span>
          <div className="ex-example__text">
            <Bg text={l.example.bg} tr={l.example.tr} showTr className="t-body-strong" />
            <span className="muted">{l.example.en}</span>
          </div>
          <SpeakButton text={l.example.bg} size="sm" auto />
        </div>
      </div>
    )
  }
  return (
    <div className="ex ex-intro">
      <p className="t-label ex-eyebrow">{it.kind === 'phrase' ? 'New phrase' : 'New word'}</p>
      <motion.div className="ex-intro__emoji" initial={{ scale: 0.4, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
        {it.emoji}
      </motion.div>
      <div className="ex-intro__word">
        <Bg text={it.bg} tr={it.tr} showTr={translit} className="t-bg-word" />
        <p className="t-card-title ex-intro__en">{it.en}</p>
      </div>
      <div className="row ex-intro__audio">
        <SpeakButton text={it.bg} itemId={it.id} auto />
        <SpeakButton text={it.bg} itemId={it.id} slow />
      </div>
      {it.note && (
        <motion.div className="gv-card ex-note" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <span className="gv-star" aria-hidden="true" />
          <p>{it.note}</p>
        </motion.div>
      )}
    </div>
  )
}
