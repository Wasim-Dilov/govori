// Builds lessons out of exercises and grades answers.
import { allItemIds, allLetterIds, dialogueById, lessonById, study, trackById, type LessonView, type Speaker, type StudyItem } from '../content/index.ts'
import type { Dialogue } from '../content/types.ts'
import type { ExerciseType } from './db.ts'

export type Exercise =
  | { type: 'intro'; item: StudyItem }
  | { type: 'mc_bg_en'; item: StudyItem; options: StudyItem[]; cards: boolean }
  | { type: 'mc_en_bg'; item: StudyItem; options: StudyItem[]; cards: boolean }
  | { type: 'listen_mc'; item: StudyItem; options: StudyItem[] }
  | { type: 'match'; items: StudyItem[]; letters: boolean }
  | { type: 'build'; item: StudyItem; tiles: string[]; answer: string[] }
  | { type: 'type_bg'; item: StudyItem }
  | { type: 'listen_type'; item: StudyItem }
  | { type: 'speak'; item: StudyItem }
  | { type: 'letter_sound'; item: StudyItem; options: StudyItem[] }
  | { type: 'sound_letter'; item: StudyItem; options: StudyItem[] }
  | { type: 'read_word'; item: StudyItem; options: StudyItem[] }
  | { type: 'dialogue'; dialogue: Dialogue }

/** The item an exercise is "about", for logging. */
export const exItemId = (ex: Exercise) => (ex.type === 'match' ? ex.items.map((i) => i.id).join('+') : ex.type === 'dialogue' ? ex.dialogue.id : ex.item.id)
export const exType = (ex: Exercise): ExerciseType => ex.type

export interface LessonPlan {
  lesson: LessonView | null
  kind: 'lesson' | 'practice' | 'letters' | 'story' | 'speed' | 'mistakes'
  level: number
  exercises: Exercise[]
  newItems: StudyItem[]
}

// ------------------------------------------------------------- helpers
const rand = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function distractors(item: StudyItem, pool: StudyItem[], n: number): StudyItem[] {
  const seen = new Set([norm(item.en), norm(item.bg)])
  const sameKind = shuffle(pool.filter((p) => p.id !== item.id && p.kind === item.kind))
  const other = shuffle(pool.filter((p) => p.id !== item.id && p.kind !== item.kind))
  const out: StudyItem[] = []
  for (const p of [...sameKind, ...other]) {
    if (out.length >= n) break
    if (seen.has(norm(p.en)) || seen.has(norm(p.bg))) continue
    seen.add(norm(p.en))
    seen.add(norm(p.bg))
    out.push(p)
  }
  return out
}

const options = (item: StudyItem, pool: StudyItem[], n = 3) => shuffle([item, ...distractors(item, pool, n)])

export function tilesFor(item: StudyItem): string[] {
  if (item.tiles?.length) return item.tiles
  return item.bg
    .replace(/[.,!?;:„“"«»…]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function buildEx(item: StudyItem, pool: StudyItem[]): Exercise {
  const answer = tilesFor(item)
  const extra = new Set<string>()
  const words = shuffle(pool.filter((p) => p.id !== item.id).flatMap((p) => tilesFor(p)))
  for (const w of words) {
    if (extra.size >= Math.max(2, Math.min(4, 7 - answer.length))) break
    if (!answer.some((a) => norm(a) === norm(w))) extra.add(w)
  }
  return { type: 'build', item, answer, tiles: shuffle([...answer, ...extra]) }
}

function poolAround(ids: string[], speaker: Speaker, kind: 'words' | 'letters'): StudyItem[] {
  const base = kind === 'letters' ? allLetterIds : allItemIds
  const extra = shuffle(base.filter((id) => !ids.includes(id))).slice(0, 24)
  return [...ids, ...extra].map((id) => study(id, speaker)).filter((x): x is StudyItem => !!x)
}

// ------------------------------------------------------------- lesson building

/** Exercise mix per lesson level. Level 1 recognises, level 2 recalls, level 3 produces. */
const WORD_MIX: Record<number, ExerciseType[]> = {
  1: ['mc_bg_en', 'mc_en_bg', 'listen_mc', 'mc_en_bg'],
  2: ['mc_en_bg', 'listen_mc', 'type_bg', 'build'],
  3: ['type_bg', 'listen_type', 'build', 'speak'],
}

function wordExercise(type: ExerciseType, item: StudyItem, pool: StudyItem[]): Exercise {
  const isPhrase = item.kind === 'phrase'
  switch (type) {
    case 'mc_bg_en':
      return { type, item, options: options(item, pool), cards: !isPhrase }
    case 'mc_en_bg':
      // Bulgarian-only options: pictures would give the answer away.
      return { type, item, options: options(item, pool), cards: false }
    case 'listen_mc':
      return { type, item, options: options(item, pool) }
    case 'build':
      return tilesFor(item).length >= 2 ? buildEx(item, pool) : { type: 'mc_en_bg', item, options: options(item, pool), cards: false }
    case 'type_bg':
    case 'listen_type':
    case 'speak':
      return { type, item }
    default:
      return { type: 'mc_bg_en', item, options: options(item, pool), cards: !isPhrase }
  }
}

export function buildWordLesson(lesson: LessonView, level: number, speaker: Speaker, reviewIds: string[] = []): LessonPlan {
  const items = lesson.itemIds.map((id) => study(id, speaker)).filter((x): x is StudyItem => !!x)
  const pool = poolAround([...lesson.itemIds, ...reviewIds], speaker, 'words')
  const mix = WORD_MIX[Math.min(3, Math.max(1, level))]
  const ex: Exercise[] = []

  if (level === 1) {
    // Teach each item, then immediately check it once, then mix.
    for (const it of items) {
      ex.push({ type: 'intro', item: it })
      ex.push(wordExercise(it.kind === 'phrase' ? 'build' : 'mc_bg_en', it, pool))
    }
    ex.push({ type: 'match', items: shuffle(items).slice(0, 5), letters: false })
    for (const it of shuffle(items)) ex.push(wordExercise(rand(mix.slice(1)), it, pool))
  } else {
    for (const it of shuffle(items)) {
      const types = shuffle(mix).slice(0, 2)
      for (const t of types) ex.push(wordExercise(t, it, pool))
    }
    ex.splice(Math.floor(ex.length / 2), 0, { type: 'match', items: shuffle(items).slice(0, 5), letters: false })
  }
  for (const id of reviewIds.slice(0, level === 1 ? 2 : 3)) {
    const it = study(id, speaker)
    if (it) ex.push(wordExercise(rand(WORD_MIX[2]), it, pool))
  }
  // Keep intros in order but spread the rest so the same item doesn't repeat back to back.
  const plan = level === 1 ? ex : spread(ex)
  return { lesson, kind: 'lesson', level, exercises: plan.slice(0, 16), newItems: level === 1 ? items : [] }
}

export function buildLetterLesson(lesson: LessonView, level: number, speaker: Speaker): LessonPlan {
  const all = lesson.itemIds.map((id) => study(id, speaker)).filter((x): x is StudyItem => !!x)
  const letters = all.filter((x) => x.kind === 'letter')
  const reading = all.filter((x) => x.kind === 'reading')
  // Letters taught before this lesson: the only safe distractors and match partners.
  const earlierIds = (trackById.get('azbuka')?.lessons ?? [])
    .slice(0, lesson.index)
    .flatMap((l) => l.itemIds)
    .filter((id) => allLetterIds.includes(id))
  const earlier = earlierIds.map((id) => study(id, speaker)).filter((x): x is StudyItem => !!x)
  const known = [...letters, ...earlier]
  // Options may include unknown letters only when too few are known yet.
  const letterPool = known.length >= 4 ? known : poolAround(letters.map((l) => l.id), speaker, 'letters')
  const readPool = reading.length >= 4 ? reading : [...reading, ...poolAround([], speaker, 'words').filter((p) => p.kind === 'word').slice(0, 6)]
  const matchItems = shuffle([...letters, ...shuffle(earlier).slice(0, Math.max(0, 5 - letters.length))]).slice(0, 5)
  const ex: Exercise[] = []
  if (level === 1) {
    for (const l of letters) {
      ex.push({ type: 'intro', item: l })
      ex.push({ type: 'letter_sound', item: l, options: options(l, letterPool) })
    }
    if (matchItems.length >= 3) ex.push({ type: 'match', items: matchItems, letters: true })
    for (const l of shuffle(letters)) ex.push({ type: 'sound_letter', item: l, options: options(l, letterPool) })
    for (const r of reading.slice(0, 4)) ex.push({ type: 'read_word', item: r, options: options(r, readPool) })
  } else {
    for (const l of shuffle(letters)) ex.push({ type: rand(['letter_sound', 'sound_letter'] as const), item: l, options: options(l, letterPool) })
    if (matchItems.length >= 3) ex.push({ type: 'match', items: matchItems, letters: true })
    for (const r of shuffle(reading)) {
      ex.push({ type: 'read_word', item: r, options: options(r, readPool) })
      if (level === 3) ex.push({ type: 'listen_type', item: r })
      else ex.push({ type: 'listen_mc', item: r, options: options(r, readPool) })
    }
  }
  return { lesson, kind: 'letters', level, exercises: (level === 1 ? ex : spread(ex)).slice(0, 16), newItems: level === 1 ? letters : [] }
}

export function buildLesson(lessonId: string, level: number, speaker: Speaker, reviewIds: string[] = []): LessonPlan {
  const lesson = lessonById.get(lessonId)
  if (!lesson) throw new Error(`Unknown lesson ${lessonId}`)
  if (lesson.kind === 'story') {
    const dialogue = dialogueById.get(lesson.dialogueId!)
    if (!dialogue) throw new Error(`Unknown dialogue ${lesson.dialogueId}`)
    return { lesson, kind: 'story', level: 1, exercises: [{ type: 'dialogue', dialogue }], newItems: [] }
  }
  return lesson.kind === 'letters' ? buildLetterLesson(lesson, level, speaker) : buildWordLesson(lesson, level, speaker, reviewIds)
}

/** A review session from spaced-repetition due items, weakest first. Weak exercise types get extra weight. */
export function buildPractice(ids: string[], speaker: Speaker, weakTypes: ExerciseType[] = []): LessonPlan {
  const items = ids.map((id) => study(id, speaker)).filter((x): x is StudyItem => !!x)
  const words = items.filter((i) => i.kind === 'word' || i.kind === 'phrase')
  const letters = items.filter((i) => i.kind === 'letter')
  const reading = items.filter((i) => i.kind === 'reading')
  const pool = poolAround(words.map((w) => w.id), speaker, 'words')
  const letterPool = poolAround(letters.map((l) => l.id), speaker, 'letters')
  // Reading words are practised by reading (choose the Latin form) or by ear.
  const readPool = [...reading, ...pool.filter((p) => p.kind === 'word')]
  const prefer: ExerciseType[] = ['mc_en_bg', 'listen_mc', 'type_bg', 'build', 'listen_type', ...weakTypes, ...weakTypes]
  const ex: Exercise[] = []
  for (const it of words.slice(0, 10)) ex.push(wordExercise(rand(prefer), it, pool))
  for (const l of letters.slice(0, 4)) ex.push({ type: rand(['letter_sound', 'sound_letter'] as const), item: l, options: options(l, letterPool) })
  for (const r of reading.slice(0, 4)) ex.push({ type: rand(['read_word', 'listen_mc'] as const), item: r, options: options(r, readPool) })
  if (words.length >= 4) ex.splice(3, 0, { type: 'match', items: shuffle(words).slice(0, 5), letters: false })
  return { lesson: null, kind: 'practice', level: 0, exercises: spread(ex).slice(0, 14), newItems: [] }
}

/** Three timed rounds of matching pairs from words the learner knows. */
export function buildSpeedRound(ids: string[], speaker: Speaker): LessonPlan {
  const items = shuffle(ids).map((id) => study(id, speaker)).filter((x): x is StudyItem => !!x && x.kind !== 'letter' && x.kind !== 'reading')
  const rounds: Exercise[] = []
  for (let i = 0; i + 5 <= items.length && rounds.length < 3; i += 5) rounds.push({ type: 'match', items: items.slice(i, i + 5), letters: false })
  return { lesson: null, kind: 'speed', level: 0, exercises: rounds, newItems: [] }
}

/** Re-test items answered wrongly in the last two weeks. */
export function buildMistakes(ids: string[], speaker: Speaker): LessonPlan {
  const plan = buildPractice(ids, speaker, ['type_bg', 'build'])
  return { ...plan, kind: 'mistakes' }
}

/** Reorder so no two consecutive exercises share an item where possible. */
function spread(ex: Exercise[]): Exercise[] {
  const rest = shuffle(ex)
  const out: Exercise[] = []
  while (rest.length) {
    const last = out.length ? exItemId(out[out.length - 1]) : ''
    const i = rest.findIndex((e) => exItemId(e) !== last)
    out.push(rest.splice(i === -1 ? 0 : i, 1)[0])
  }
  return out
}

// ------------------------------------------------------------- grading

const LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya', ѝ: 'i',
}

/** Lowercase, drop punctuation and stress marks, collapse spaces. Keeps й intact. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ѝ/g, 'и')
    .normalize('NFD')
    .replace(/[̀́]/g, '')
    .normalize('NFC')
    .replace(/[.,!?;:„“”"'«»…()\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Latin form of a Cyrillic string; ъ can be written a or u. */
export function translit(s: string, schwa = 'a'): string {
  return [...norm(s)].map((c) => (c === 'ъ' ? schwa : (LAT[c] ?? c))).join('')
}

/** Strip all Latin diacritics (ă, á, é...) for comparing typed transliteration. */
const latinPlain = (s: string) => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '')

function lev(a: string, b: string): number {
  if (a === b) return 0
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export interface Grade {
  correct: boolean
  /** "typo" = accepted with a small slip; "latin" = typed transliteration instead of Cyrillic. */
  note?: 'typo' | 'latin'
}

/** Grade a typed Bulgarian answer. Accepts Cyrillic, alternatives, Latin transliteration and one small typo. */
export function gradeBulgarian(input: string, item: StudyItem): Grade {
  const given = norm(input)
  if (!given) return { correct: false }
  const targets = [item.bg, ...(item.bgAlt ?? [])].map(norm)
  if (targets.includes(given)) return { correct: true }
  const isLatin = /[a-z]/.test(given) && !/[а-яѝ]/.test(given)
  if (isLatin) {
    const g = latinPlain(given)
    const lat = targets.flatMap((t) => [translit(t, 'a'), translit(t, 'u'), latinPlain(item.tr)])
    if (lat.includes(g)) return { correct: true, note: 'latin' }
    if (lat.some((t) => t.length >= 4 && lev(g, t) <= (t.length >= 10 ? 2 : 1))) return { correct: true, note: 'latin' }
    return { correct: false }
  }
  if (targets.some((t) => t.length >= 4 && lev(given, t) <= (t.length >= 12 ? 2 : 1))) return { correct: true, note: 'typo' }
  return { correct: false }
}

/** Grade word-bank tiles against the answer, tolerant of the alternatives. */
export function gradeTiles(chosen: string[], item: StudyItem): Grade {
  const given = norm(chosen.join(' '))
  const ok = [item.bg, ...(item.bgAlt ?? [])].map(norm).includes(given)
  return { correct: ok }
}
