import type { Letter } from '../content/types.ts'

// Letters whose Bulgarian print and handwriting forms differ from the standard shapes.
const DIFFERENT = new Set(['б', 'в', 'г', 'д', 'ж', 'з', 'и', 'й', 'к', 'л', 'п', 'т', 'ф', 'ц', 'ш', 'щ', 'ъ', 'ь', 'ю'])

/** "You may also see it like this": the Bulgarian-style form of a letter, drawn in Sofia Sans. */
export function BgStyleNote({ letter }: { letter: Letter }) {
  if (!DIFFERENT.has(letter.lower)) return null
  return (
    <p className="bgstyle-note">
      <span className="bgstyle-note__glyph" lang="bg" aria-hidden="true">
        {letter.upper}
        {letter.lower}
      </span>
      <span>Bulgarian books, signs and handwriting often draw it like this. Same letter, same sound.</span>
    </p>
  )
}
