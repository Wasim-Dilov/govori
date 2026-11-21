import { useEffect, useRef, useState } from 'react'
import { gradeBulgarian } from '../lib/engine.ts'
import { Cue, Prompt, SpeakButton } from './common.tsx'
import type { ExerciseProps } from './types.ts'

// Bulgarian phonetic layout, the one most Bulgarians use on phones and laptops.
const ROWS = [
  ['я', 'в', 'е', 'р', 'т', 'ъ', 'у', 'и', 'о', 'п'],
  ['а', 'с', 'д', 'ф', 'г', 'х', 'й', 'к', 'л', 'ш'],
  ['з', 'ь', 'ц', 'ж', 'б', 'н', 'м', 'ч', 'щ', 'ю'],
]

const IconDelete = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z" />
    <path d="M12 9.5l5 5M17 9.5l-5 5" />
  </svg>
)

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
          <div className="ex-stage">
            <Cue emoji={ex.item.emoji} text={ex.item.en} track={ex.item.trackId} />
          </div>
        </>
      ) : (
        <>
          <Prompt>Type what you hear</Prompt>
          <div className="ex-stage">
            <div className="ex-listen">
              <SpeakButton text={ex.item.bg} itemId={ex.item.id} size="lg" auto />
              <SpeakButton text={ex.item.bg} itemId={ex.item.id} slow />
            </div>
          </div>
        </>
      )}
      <div className="ex-answers ex-type__answers">
        <div className="ex-type__field">
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
            rows={2}
            placeholder={cyrKb ? 'Tap the letters below' : 'Cyrillic or Latin letters both work'}
          />
          <button
            type="button"
            className="ex-type__switch"
            onClick={() => {
              setCyrKb((v) => !v)
              setTimeout(() => ref.current?.focus(), 50)
            }}
          >
            {cyrKb ? 'Use my keyboard' : 'Use the Bulgarian keyboard'}
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
              <button type="button" className="gv-key gv-key--wide ex-kbd__space" onClick={() => key(' ')}>
                space
              </button>
              <button type="button" className="gv-key gv-key--wide ex-kbd__del" onClick={back} aria-label="Delete">
                <IconDelete />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
