import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { speak } from '../lib/audio.ts'
import { gradeTiles, translit as toLatin } from '../lib/engine.ts'
import { Cue, Prompt } from './common.tsx'
import type { ExerciseProps } from './types.ts'

const tileMotion = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.92 },
  transition: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] },
}

/** Build the Bulgarian sentence from word tiles. */
export function BuildExercise({ ex, setAnswer, checked, translit }: ExerciseProps<'build'>) {
  const tiles = useMemo(() => ex.tiles.map((t, i) => ({ key: `${i}-${t}`, text: t })), [ex])
  const [chosen, setChosen] = useState<string[]>([])
  useEffect(() => setChosen([]), [ex])

  const update = (next: string[]) => {
    setChosen(next)
    if (!next.length) return setAnswer(null)
    const words = next.map((k) => tiles.find((t) => t.key === k)!.text)
    setAnswer({ ...gradeTiles(words, ex.item), answer: words.join(' '), solution: ex.item.bg, solutionTr: ex.item.tr })
  }

  const add = (key: string, text: string) => {
    if (checked || chosen.includes(key)) return
    void speak(text)
    update([...chosen, key])
  }
  const remove = (key: string) => {
    if (checked) return
    update(chosen.filter((k) => k !== key))
  }

  return (
    <div className="ex">
      <Prompt>Say it in Bulgarian</Prompt>
      <Cue emoji={ex.item.emoji} text={ex.item.en} />
      <div className={`ex-build__answer ${checked ? (checked.correct ? 'is-correct' : 'is-wrong') : ''}`} aria-label="Your answer">
        <AnimatePresence>
          {chosen.map((k) => {
            const t = tiles.find((x) => x.key === k)!
            return (
              <motion.button key={k} layout type="button" className="gv-tile" onClick={() => remove(k)} {...tileMotion}>
                <span lang="bg">{t.text}</span>
                {translit && <span className="gv-tile__tr">{toLatin(t.text, 'ă')}</span>}
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
      <div className="ex-build__bank" aria-label="Word tiles">
        {tiles.map((t) => (
          <button key={t.key} type="button" className={`gv-tile ${chosen.includes(t.key) ? 'is-used' : ''}`} onClick={() => add(t.key, t.text)} disabled={!!checked}>
            <span lang="bg">{t.text}</span>
            {translit && <span className="gv-tile__tr">{toLatin(t.text, 'ă')}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
