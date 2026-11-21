// "Our phrases" (things his wife adds, or he does) and the "Quiz me" couple mode.
// Custom phrases live in Dexie (table "custom"), are registered with study() at startup and are
// scheduled for review like any other item.
import { registerCustomItems, study, type Speaker, type StudyItem } from '../content/index.ts'
import { db, type CustomItem } from './db.ts'
import { shuffle, translit } from './engine.ts'
import { dueItems, learnedWordIds, logAnswer, updateMemory } from './progress.ts'

const toStudy = (c: CustomItem): StudyItem => ({
  id: c.id,
  kind: c.bg.trim().split(/\s+/).length > 1 ? 'phrase' : 'word',
  // Custom items sit with the love track for distractors and colour.
  trackId: 'love',
  bg: c.bg,
  tr: c.tr?.trim() || translit(c.bg, 'ă'),
  en: c.en,
  emoji: c.emoji || '💬',
  note: c.note,
})

/** Load "Our phrases" and make them resolvable by study(). Call once at startup (the store does). */
export async function loadOurPhrases(): Promise<CustomItem[]> {
  const list = await db.custom.orderBy('addedAt').toArray().catch(() => [] as CustomItem[])
  registerCustomItems(list.map(toStudy))
  return list
}

/** Newest first. */
export async function listOurPhrases(): Promise<CustomItem[]> {
  return (await db.custom.orderBy('addedAt').toArray().catch(() => [] as CustomItem[])).reverse()
}

const slug = (bg: string) =>
  translit(bg)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'phrase'

export interface NewPhrase {
  bg: string
  en: string
  tr?: string
  emoji?: string
  note?: string
  addedBy: 'her' | 'me'
}

/** Add a phrase to "Our phrases" and schedule it for review straight away. */
export async function addOurPhrase(input: NewPhrase): Promise<StudyItem> {
  const bg = input.bg.trim()
  const en = input.en.trim()
  if (!bg || !en) throw new Error('A phrase needs the Bulgarian and the English.')
  let id = `our.${slug(bg)}`
  for (let n = 2; await db.custom.get(id); n++) id = `our.${slug(bg)}-${n}`
  const row: CustomItem = { id, bg, en, tr: input.tr?.trim() || undefined, emoji: input.emoji?.trim() || undefined, note: input.note?.trim() || undefined, addedBy: input.addedBy, addedAt: Date.now() }
  await db.custom.put(row)
  await loadOurPhrases()
  const now = Date.now()
  await db.memory.put({ itemId: id, box: 0, due: now, seen: 0, correct: 0, wrong: 0, lastSeen: now, learnedAt: now })
  return toStudy(row)
}

/** Remove a phrase and its review schedule. */
export async function removeOurPhrase(id: string) {
  if (!id.startsWith('our.')) return
  await db.custom.delete(id)
  await db.memory.delete(id)
  await loadOurPhrases()
}

/**
 * Up to n things he has learned for "Quiz me": due and weak items first, then a mix of the rest,
 * always including some of "Our phrases". She sees the English and the Bulgarian; he says it aloud.
 */
export async function quizMeDeck(speaker: Speaker = 'm', n = 10): Promise<StudyItem[]> {
  const [due, learned, ours] = await Promise.all([dueItems(n), learnedWordIds(), listOurPhrases()])
  const ids = [...new Set([...shuffle(ours.map((o) => o.id)).slice(0, 3), ...due, ...shuffle(learned)])]
  return ids
    .map((id) => study(id, speaker))
    .filter((x): x is StudyItem => !!x && (x.kind === 'word' || x.kind === 'phrase'))
    .slice(0, n)
}

/** Record one "Quiz me" answer (she taps right or wrong). Logged as speaking. */
export async function logQuiz(itemId: string, correct: boolean, sessionId: string, ms = 0) {
  const it = study(itemId)
  await logAnswer({
    sessionId,
    trackId: it?.trackId ?? 'love',
    lessonId: 'quiz',
    itemId,
    exType: 'speak',
    correct,
    ms,
    attempt: 1,
    answer: correct ? 'she said right' : 'she said not yet',
    level: 0,
    source: 'quiz',
  })
  await updateMemory(itemId, correct, true)
}
