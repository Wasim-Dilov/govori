// Content schema for Govori. All lesson content lives in src/content/tracks/*.ts
// and is plain data, so new words and phrases can be added without touching app code.

export type TrackId = 'azbuka' | 'basics' | 'kids' | 'love' | 'home' | 'family' | 'grammar' | 'out'

/** A word or phrase the learner studies. */
export interface Item {
  /** Globally unique and stable forever (progress is keyed on it), e.g. "kids.vilitsa". */
  id: string
  kind: 'word' | 'phrase'
  /** Bulgarian in Cyrillic, as a man would say it (see `f` for the woman's form). */
  bg: string
  /** Latin transliteration with an acute accent on the stressed vowel, e.g. "vodá", "obícham te". ъ is written "ă". */
  tr: string
  /** Main English meaning, short. */
  en: string
  /** One emoji that pictures the meaning. */
  emoji: string
  /** Optional short tip: usage, grammar, culture, pronunciation. One or two sentences. */
  note?: string
  /** Other English answers that should be accepted (lowercase, no punctuation). */
  alt?: string[]
  /** Other Bulgarian answers that should be accepted (Cyrillic). */
  bgAlt?: string[]
  /** Woman-speaker form, only when the speaker's gender changes the Bulgarian (e.g. "уморен съм" vs "уморена съм"). */
  f?: { bg: string; tr: string }
  /** Override tiles for sentence building; defaults to splitting `bg` on spaces with punctuation removed. */
  tiles?: string[]
}

export interface Lesson {
  id: string
  title: string
  titleBg: string
  /** Ids of the items introduced in this lesson (4 to 6). */
  items: string[]
}

export interface Unit {
  id: string
  title: string
  titleBg: string
  description: string
  emoji: string
  lessons: Lesson[]
}

export interface Track {
  id: TrackId
  title: string
  titleBg: string
  tagline: string
  emoji: string
  items: Item[]
  units: Unit[]
  /** One short conversation per unit, played as a story node after the unit's lessons. */
  dialogues?: Dialogue[]
}

// ---------------------------------------------------------------- Conversations

/** Who speaks a line. "me" is the learner; the learner picks these lines from options. */
export type Who =
  | 'me'
  | 'wife'
  | 'son'
  | 'daughter'
  | 'mil' // тъща, his mother-in-law
  | 'fil' // тъст, his father-in-law
  | 'grandma'
  | 'friend'
  | 'waiter'
  | 'seller'
  | 'neighbour'

export interface DialogueLine {
  who: Who
  bg: string
  tr: string
  en: string
  /** Woman-speaker form, only on "me" lines where the speaker's gender changes the Bulgarian. */
  f?: { bg: string; tr: string }
  /** For "me" lines: 2 plausible but wrong Bulgarian replies (wrong meaning, not wrong grammar). */
  wrong?: string[]
}

export interface DialogueQuestion {
  /** Comprehension question in English about the conversation. */
  q: string
  options: string[]
  /** Index of the correct option. */
  answer: number
}

export interface Dialogue {
  /** e.g. "kids.d1" */
  id: string
  /** The unit this conversation closes. */
  unitId: string
  title: string
  titleBg: string
  /** One-line scene setting in English, e.g. "Bedtime. Your daughter is stalling." */
  scene: string
  emoji: string
  /** 5 to 9 lines; 2 to 4 of them are "me" lines, mostly reusing the unit's vocabulary. */
  lines: DialogueLine[]
  /** 1 or 2 questions asked at the end. */
  questions: DialogueQuestion[]
}

// ---------------------------------------------------------------- Alphabet

export interface Letter {
  /** e.g. "az.zh" */
  id: string
  upper: string
  lower: string
  /** Latin equivalent used in transliteration, e.g. "zh". */
  tr: string
  /** How it sounds, for an English speaker, e.g. 'like the "s" in pleasure'. */
  sound: string
  /** familiar = looks and sounds like English; false-friend = looks English but sounds different; new = new shape. */
  kind: 'familiar' | 'false-friend' | 'new'
  /** A short memory hook. */
  mnemonic: string
  /** An example word that starts with (or clearly contains) the letter. */
  example: { bg: string; tr: string; en: string; emoji: string }
}

export interface ReadingWord {
  bg: string
  tr: string
  en: string
  emoji: string
}

export interface AlphabetLesson {
  id: string
  title: string
  titleBg: string
  /** Letter ids introduced in this lesson (2 to 4). */
  letters: string[]
  /** 4 to 6 real Bulgarian words written ONLY with letters introduced up to and including this lesson. */
  reading: ReadingWord[]
}

export interface AlphabetUnit {
  id: string
  title: string
  titleBg: string
  description: string
  emoji: string
  lessons: AlphabetLesson[]
}

export interface Alphabet {
  id: 'azbuka'
  title: string
  titleBg: string
  tagline: string
  emoji: string
  letters: Letter[]
  units: AlphabetUnit[]
}
