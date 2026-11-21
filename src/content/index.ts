import type { Dialogue, Item, Letter, TrackId } from './types.ts'
import type { Alphabet, Track } from './types.ts'

// Every file in ./tracks is picked up automatically; a missing track never breaks the app.
const modules = import.meta.glob<Record<string, Track | Alphabet>>('./tracks/*.ts', { eager: true })
const exported = Object.values(modules).flatMap((m) => Object.values(m))
export const alphabet = exported.find((t): t is Alphabet => t.id === 'azbuka')!
const ORDER: TrackId[] = ['basics', 'kids', 'love', 'home', 'family', 'grammar', 'out']
export const wordTracks: Track[] = ORDER.map((id) => exported.find((t): t is Track => t.id === id)).filter((t): t is Track => !!t)

export type Speaker = 'm' | 'f'

/** One thing to study: a word, a phrase, a letter, or a reading-practice word. */
export interface StudyItem {
  id: string
  kind: 'word' | 'phrase' | 'letter' | 'reading'
  trackId: TrackId
  bg: string
  tr: string
  en: string
  emoji: string
  note?: string
  alt?: string[]
  bgAlt?: string[]
  tiles?: string[]
  letter?: Letter
}

export interface LessonView {
  id: string
  trackId: TrackId
  unitId: string
  title: string
  titleBg: string
  kind: 'words' | 'letters' | 'story'
  /** Item ids (words/phrases) or letter ids, plus reading ids for letter lessons. Empty for stories. */
  itemIds: string[]
  /** For story nodes: the conversation to play. */
  dialogueId?: string
  /** Global position in its track, 0-based. */
  index: number
}

export interface UnitView {
  id: string
  trackId: TrackId
  title: string
  titleBg: string
  description: string
  emoji: string
  index: number
  lessons: LessonView[]
}

export interface TrackView {
  id: TrackId
  title: string
  titleBg: string
  tagline: string
  emoji: string
  units: UnitView[]
  lessons: LessonView[]
}

const items = new Map<string, Item>()
const itemTrack = new Map<string, TrackId>()
for (const t of wordTracks)
  for (const it of t.items) {
    items.set(it.id, it)
    itemTrack.set(it.id, t.id)
  }

export const lettersById = new Map<string, Letter>(alphabet.letters.map((l) => [l.id, l]))
const readingById = new Map<string, StudyItem>()
export const dialogueById = new Map<string, Dialogue>()

function buildAlphabetView(): TrackView {
  const lessons: LessonView[] = []
  const units: UnitView[] = alphabet.units.map((u, ui) => ({
    id: u.id,
    trackId: 'azbuka',
    title: u.title,
    titleBg: u.titleBg,
    description: u.description,
    emoji: u.emoji,
    index: ui,
    lessons: u.lessons.map((l) => {
      const readingIds = l.reading.map((r, ri) => {
        const id = `${l.id}.r${ri}`
        readingById.set(id, { id, kind: 'reading', trackId: 'azbuka', bg: r.bg, tr: r.tr, en: r.en, emoji: r.emoji })
        return id
      })
      const view: LessonView = {
        id: l.id,
        trackId: 'azbuka',
        unitId: u.id,
        title: l.title,
        titleBg: l.titleBg,
        kind: 'letters',
        itemIds: [...l.letters, ...readingIds],
        index: lessons.length,
      }
      lessons.push(view)
      return view
    }),
  }))
  return { id: 'azbuka', title: alphabet.title, titleBg: alphabet.titleBg, tagline: alphabet.tagline, emoji: alphabet.emoji, units, lessons }
}

function buildTrackView(t: Track): TrackView {
  const lessons: LessonView[] = []
  const units: UnitView[] = t.units.map((u, ui) => ({
    id: u.id,
    trackId: t.id,
    title: u.title,
    titleBg: u.titleBg,
    description: u.description,
    emoji: u.emoji,
    index: ui,
    lessons: [
      ...u.lessons.map((l) => {
        const view: LessonView = { id: l.id, trackId: t.id, unitId: u.id, title: l.title, titleBg: l.titleBg, kind: 'words', itemIds: l.items, index: lessons.length }
        lessons.push(view)
        return view
      }),
      ...(t.dialogues ?? [])
        .filter((d) => d.unitId === u.id)
        .map((d) => {
          dialogueById.set(d.id, d)
          const view: LessonView = { id: d.id, trackId: t.id, unitId: u.id, title: d.title, titleBg: d.titleBg, kind: 'story', itemIds: [], dialogueId: d.id, index: lessons.length }
          lessons.push(view)
          return view
        }),
    ],
  }))
  return { id: t.id, title: t.title, titleBg: t.titleBg, tagline: t.tagline, emoji: t.emoji, units, lessons }
}

/** All tracks in display order: alphabet first, then the word tracks. */
export const tracks: TrackView[] = [buildAlphabetView(), ...wordTracks.map(buildTrackView)]
export const trackById = new Map<TrackId, TrackView>(tracks.map((t) => [t.id, t]))
export const lessonById = new Map<string, LessonView>(tracks.flatMap((t) => t.lessons.map((l) => [l.id, l] as const)))
export const unitById = new Map<string, UnitView>(tracks.flatMap((t) => t.units.map((u) => [u.id, u] as const)))

export const TRACK_IDS = tracks.map((t) => t.id)

/** Highest level a lesson node can reach: 3 for lessons, 1 for conversations. */
export const maxLevel = (l: LessonView) => (l.kind === 'story' ? 1 : 3)

/** Resolve any id (item, letter, reading word) to a StudyItem, using the learner's speaker form. */
export function study(id: string, speaker: Speaker = 'm'): StudyItem | undefined {
  const it = items.get(id)
  if (it) {
    const useF = speaker === 'f' && it.f
    return {
      id: it.id,
      kind: it.kind,
      trackId: itemTrack.get(id)!,
      bg: useF ? it.f!.bg : it.bg,
      tr: useF ? it.f!.tr : it.tr,
      en: it.en,
      emoji: it.emoji,
      note: it.note,
      alt: it.alt,
      bgAlt: useF ? undefined : it.bgAlt,
      tiles: useF ? undefined : it.tiles,
    }
  }
  const letter = lettersById.get(id)
  if (letter)
    return {
      id: letter.id,
      kind: 'letter',
      trackId: 'azbuka',
      bg: `${letter.upper}${letter.lower}`,
      tr: letter.tr,
      en: letter.sound,
      emoji: letter.example.emoji,
      note: letter.mnemonic,
      letter,
    }
  return readingById.get(id)
}

/** Every word/phrase item, for pools of distractors and practice. */
export const allItemIds = [...items.keys()]
export const allLetterIds = alphabet.letters.map((l) => l.id)
export const totalItems = items.size
