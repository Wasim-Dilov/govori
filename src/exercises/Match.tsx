import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { speak, sfx } from '../lib/audio.ts'
import { shuffle } from '../lib/engine.ts'
import { Prompt, fadeIn } from './common.tsx'
import type { ExerciseProps } from './types.ts'

/** Tap matching pairs: Bulgarian on the left, meaning on the right. */
export function MatchExercise({ ex, complete }: ExerciseProps<'match'>) {
  const left = useMemo(() => shuffle(ex.items), [ex])
  const right = useMemo(() => shuffle(ex.items), [ex])
  const [sel, setSel] = useState<{ side: 'l' | 'r'; id: string } | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [bad, setBad] = useState<{ l: string; r: string } | null>(null)
  const mistakes = useRef(0)
  const start = useRef(Date.now())

  useEffect(() => {
    if (!ex.items.length) return void complete(null)
    if (done.size === ex.items.length) {
      const t = setTimeout(() => complete(mistakes.current <= 1, { answer: `${mistakes.current} mistakes in ${Math.round((Date.now() - start.current) / 1000)}s` }), 450)
      return () => clearTimeout(t)
    }
  }, [done, ex.items.length, complete])

  const tap = (side: 'l' | 'r', id: string) => {
    if (done.has(id)) return
    const item = ex.items.find((i) => i.id === id)!
    if (side === 'l') void speak(ex.letters ? item.letter!.example.bg : item.bg, { itemId: ex.letters ? undefined : id })
    else sfx.tap()
    if (!sel || sel.side === side) {
      setSel({ side, id })
      return
    }
    if (sel.id === id) {
      sfx.correct()
      setDone((d) => new Set(d).add(id))
    } else {
      mistakes.current++
      sfx.wrong()
      setBad(side === 'l' ? { l: id, r: sel.id } : { l: sel.id, r: id })
      setTimeout(() => setBad(null), 500)
    }
    setSel(null)
  }

  const cls = (side: 'l' | 'r', id: string) => {
    if (done.has(id)) return 'gv-choice is-correct ex-match__done'
    if (bad && bad[side] === id) return 'gv-choice is-wrong'
    if (sel && sel.side === side && sel.id === id) return 'gv-choice is-selected'
    return 'gv-choice'
  }

  return (
    <div className="ex">
      <Prompt>Tap the matching pairs</Prompt>
      <div className="ex-stage ex-stage--top">
        <div className="ex-match" style={{ ['--rows' as string]: ex.items.length }}>
          <div className="ex-match__col">
            {left.map((it, i) => (
              <motion.button key={it.id} type="button" className={cls('l', it.id)} onClick={() => tap('l', it.id)} disabled={done.has(it.id)} aria-pressed={sel?.side === 'l' && sel.id === it.id} {...fadeIn(i)}>
                <span className="gv-choice__text ex-match__bg" lang="bg">
                  {ex.letters ? `${it.letter!.upper} ${it.letter!.lower}` : it.bg}
                </span>
              </motion.button>
            ))}
          </div>
          <div className="ex-match__col">
            {right.map((it, i) => (
              <motion.button key={it.id} type="button" className={cls('r', it.id)} onClick={() => tap('r', it.id)} disabled={done.has(it.id)} aria-pressed={sel?.side === 'r' && sel.id === it.id} {...fadeIn(i)}>
                <span className="gv-choice__text">{ex.letters ? `\u201c${it.tr}\u201d` : it.en}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
