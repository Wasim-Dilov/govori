import { useEffect, useRef, useState } from 'react'
import { gradeBulgarian } from '../lib/engine.ts'
import { Prompt, SpeakButton } from './common.tsx'
import type { ExerciseProps } from './types.ts'

// Bulgarian phonetic layout, the one most Bulgarians use on phones and laptops.
const ROWS = [
  ['я', 'в', 'е', 'р', 'т', 'ъ', 'у', 'и', 'о', 'п'],
  ['а', 'с', 'д', 'ф', 'г', 'х', 'й', 'к', 'л', 'ш'],
  ['з', 'ь', 'ц', 'ж', 'б', 'н', 'м', 'ч', 'щ', 'ю'],
]

/** Type the Bulgarian, either from English (type_bg) or from audio (listen_type). */
export function TypeExercise({ ex, setAnswer, checked }: ExerciseProps<'type_bg' | 'listen_type'>) {
  const [text, setText] = useState('')
  const [cyrKb, setCyrKb] = useState(true)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => setText(''), [ex])

  const update = (v: string) => {
    setText(v)
    if (!v.trim()) return setAnswer(null)
    const g = gradeBulgarian(v, ex.item)
    setAnswer({ correct: g.correct, note: g.note, answer: v, solution: ex.item.bg, solutionTr: ex.item.tr })
  }
  const key = (k: string) => !checked && update(text + k)
  const back = () => !checked && update(text.slice(0, -1))

  return (
    <div className="ex ex-type">
      {ex.type === 'type_bg' ? (
        <>
          <Prompt>Write this in Bulgarian</Prompt>
          <div className="ex-hero ex-hero--en">
            <span className="ex-emoji">{ex.item.emoji}</span>
            <span className="t-card-title">{ex.item.en}</span>
          </div>
        </>
      ) : (
        <>
          <Prompt>Type what you hear</Prompt>
          <div className="ex-hero ex-hero--listen">
            <SpeakButton text={ex.item.bg} itemId={ex.item.id} size="lg" auto />
            <SpeakButton text={ex.item.bg} itemId={ex.item.id} slow />
          </div>
        </>
      )}
      <label className="sr-only" htmlFor="ex-type-input">
        Your answer in Bulgarian
      </label>
      <textarea
        id="ex-type-input"
        ref={ref}
        className="gv-input"
        lang="bg"
        value={text}
        onChange={(e) => update(e.target.value)}
        readOnly={cyrKb || !!checked}
        inputMode={cyrKb ? 'none' : 'text'}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder={cyrKb ? 'Tap the letters below' : 'Cyrillic or Latin letters both work'}
      />
      <div className="ex-type__switch">
        <button
          type="button"
          className="gv-btn gv-btn--ghost gv-btn--sm"
          onClick={() => {
            setCyrKb((v) => !v)
            setTimeout(() => ref.current?.focus(), 50)
          }}
        >
          {cyrKb ? 'Use my phone keyboard' : 'Use the Bulgarian keyboard'}
        </button>
      </div>
      {cyrKb && !checked && (
        <div className="ex-kbd" role="group" aria-label="Bulgarian keyboard">
          {ROWS.map((row, i) => (
            <div key={i} className="ex-kbd__row">
              {row.map((k) => (
                <button key={k} type="button" className="gv-key" onClick={() => key(k)} lang="bg">
                  {k}
                </button>
              ))}
            </div>
          ))}
          <div className="ex-kbd__row">
            <button type="button" className="gv-key gv-key--wide" onClick={() => key(' ')}>
              SPACE
            </button>
            <button type="button" className="gv-key gv-key--wide" onClick={back} aria-label="Delete">
              ⌫
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
