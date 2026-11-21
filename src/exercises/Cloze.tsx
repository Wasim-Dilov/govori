import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { speak } from '../lib/audio.ts'
import { Cue, Prompt, fadeIn } from './common.tsx'
import type { ExerciseProps } from './types.ts'

/** Fill the gap: a sentence he has learned with one word missing, and four words to choose from. */
export function ClozeExercise({ ex, setAnswer, checked, translit }: ExerciseProps<'cloze'>) {
  const [picked, setPicked] = useState<string | null>(null)
  useEffect(() => setPicked(null), [ex])

  const choose = (word: string) => {
    if (checked) return
    setPicked(word)
    void speak(word)
    setAnswer({ correct: word === ex.answer, answer: word, solution: ex.item.bg, solutionTr: ex.item.tr })
  }

  // Keys 1-4 pick a word, like the other choice exercises.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
      const n = Number(e.key)
      if (n >= 1 && n <= ex.options.length) choose(ex.options[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const gapState = !checked ? (picked ? 'is-filled' : '') : checked.correct ? 'is-correct' : 'is-wrong'
  const chipState = (w: string) => {
    if (!checked) return picked === w ? 'is-selected' : ''
    if (w === ex.answer) return 'is-correct'
    if (picked === w) return 'is-wrong'
    return 'is-dim'
  }

  return (
    <div className="ex">
      <Prompt>Fill the gap</Prompt>
      <div className="ex-stage">
        <Cue emoji={ex.item.emoji} text={ex.item.en} track={ex.item.trackId} />
        <p className="ex-cloze__sentence" lang="bg">
          {ex.before}
          <span className={`ex-cloze__gap ${gapState}`} aria-label={picked ? `Your word: ${picked}` : 'Missing word'}>
            {picked ?? ' '}
          </span>
          {ex.after}
        </p>
        {translit && checked && <p className="ex-tr ex-cloze__tr">{ex.item.tr}</p>}
      </div>
      <div className="ex-answers ex-cloze__options" role="group" aria-label="Words">
        {ex.options.map((w, i) => (
          <motion.button key={w} type="button" className={`gv-tile ex-cloze__chip ${chipState(w)}`} onClick={() => choose(w)} disabled={!!checked} aria-pressed={picked === w} {...fadeIn(i)}>
            <span lang="bg">{w}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
