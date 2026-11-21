import type { Letter } from '../content/types.ts'
import './bgstyle.css'

// Letters whose Bulgarian print and handwriting forms differ from the standard shapes.
const DIFFERENT = new Set(['б', 'в', 'г', 'д', 'ж', 'з', 'и', 'й', 'к', 'л', 'п', 'т', 'ф', 'ц', 'ш', 'щ', 'ъ', 'ь', 'ю'])

/** A short lowercase word that shows the letter in context (a lone capital reads like Latin). */
function printWord(letter: Letter): string {
  const word = letter.example.bg.toLowerCase().replace(/[^а-яѝ]/g, '')
  return word.includes(letter.lower) ? word : letter.lower
}

/**
 * "You may also see it like this": a word in Bulgarian print (Sofia Sans draws the Bulgarian
 * letterforms; the bgstyle-note__glyph class keeps that font) in a compact row.
 */
export function BgStyleNote({ letter }: { letter: Letter }) {
  if (!DIFFERENT.has(letter.lower)) return null
  const word = printWord(letter)
  return (
    <div className="bgstyle-note bgstyle">
      <span className="bgstyle__tile" role="img" aria-label={`${word} in Bulgarian print`}>
        <span className="bgstyle-note__glyph bgstyle__glyph" lang="bg" aria-hidden="true">
          {word}
        </span>
      </span>
      <span className="bgstyle__text">
        <span className="bgstyle__cap">In Bulgarian print</span>
        <span>Same letter, same sound.</span>
      </span>
    </div>
  )
}
