import type { Exercise } from '../lib/engine.ts'

/** What an exercise reports when the learner has an answer ready. The session grades on "Check". */
export interface PendingAnswer {
  correct: boolean
  /** What the learner gave, for the log. */
  answer: string
  /** The right answer to show if wrong (Bulgarian or English). */
  solution: string
  /** Transliteration of the solution, when it is Bulgarian. */
  solutionTr?: string
  /** Accepted with a small slip, or typed in Latin letters. */
  note?: 'typo' | 'latin'
}

export interface ExerciseProps<T extends Exercise['type'] = Exercise['type']> {
  ex: Extract<Exercise, { type: T }>
  /** Report the current answer (null when nothing is selected). Used by check-style exercises. */
  setAnswer: (a: PendingAnswer | null) => void
  /** Null until the learner presses Check; then the result, so the exercise can lock and colour itself. */
  checked: null | { correct: boolean }
  /**
   * For exercises that finish themselves (intro, match, speak, dialogue): call once when done.
   * `correct` is null for a skip (not counted). `answers` lets multi-step exercises log each step.
   */
  complete: (correct: boolean | null, detail?: { answer?: string; steps?: { itemId: string; correct: boolean; answer: string; ms: number }[] }) => void
  /** Learner preferences. */
  translit: boolean
  speaking: boolean
}
