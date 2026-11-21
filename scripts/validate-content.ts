// Validates Govori lesson content. Run: node scripts/validate-content.ts
// Checks whichever track files exist, so it can be rerun as tracks land.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Alphabet, Dialogue, Track } from '../src/content/types.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tracksDir = join(root, 'src', 'content', 'tracks')

const errors: string[] = []
const warnings: string[] = []
const err = (m: string) => errors.push(m)
const warn = (m: string) => warnings.push(m)

// minUnits: fewer is an error. target: the planned size; fewer is a warning (tracks grow over time).
const TRACK_FILES: { file: string; exportName: string; minUnits: number; target: number }[] = [
  { file: 'basics.ts', exportName: 'basics', minUnits: 4, target: 8 },
  { file: 'kids.ts', exportName: 'kids', minUnits: 4, target: 8 },
  { file: 'love.ts', exportName: 'love', minUnits: 4, target: 7 },
  { file: 'home.ts', exportName: 'home', minUnits: 3, target: 6 },
  { file: 'family.ts', exportName: 'family', minUnits: 3, target: 6 },
  { file: 'grammar.ts', exportName: 'grammar', minUnits: 6, target: 6 },
  { file: 'out.ts', exportName: 'out', minUnits: 6, target: 6 },
]

const WHO = new Set(['me', 'wife', 'son', 'daughter', 'mil', 'fil', 'grandma', 'friend', 'waiter', 'seller', 'neighbour'])

const BULGARIAN_LETTERS = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЬЮЯ'.split('')
const CYRILLIC = /[Ѐ-ӿ]/
const LATIN_LETTER = /[A-Za-z]/

/** Every word of 2+ syllables in a transliteration must carry an acute accent. */
function checkStress(tr: string, where: string) {
  if (CYRILLIC.test(tr)) err(`${where}: transliteration contains Cyrillic: "${tr}"`)
  // House style: all lowercase, no trailing punctuation (inner commas and ! stay).
  if (/[A-ZÀ-ÞĂ]/.test(tr.normalize('NFC'))) err(`${where}: transliteration must be lowercase: "${tr}"`)
  if (/[.?!…]\s*$/.test(tr)) err(`${where}: transliteration must not end with punctuation: "${tr}"`)
  const words = tr
    .normalize('NFD')
    .toLowerCase()
    .split(/[\s\-–]+/)
    .map((w) => w.replace(/[^a-ź̆]/g, ''))
    .filter(Boolean)
  for (const w of words) {
    const vowels = (w.match(/[aeiou]/g) ?? []).length
    const acutes = (w.match(/́/g) ?? []).length
    if (vowels >= 2 && acutes === 0) err(`${where}: no stress accent on "${w.normalize('NFC')}" in "${tr}"`)
    if (acutes > 1) warn(`${where}: more than one accent on "${w.normalize('NFC')}" in "${tr}"`)
  }
}

function checkBg(bg: string, where: string) {
  if (!CYRILLIC.test(bg)) err(`${where}: Bulgarian text has no Cyrillic: "${bg}"`)
  if (LATIN_LETTER.test(bg)) err(`${where}: Bulgarian text contains Latin letters: "${bg}"`)
  if (/[ыэё]/i.test(bg)) err(`${where}: Russian-only letter in "${bg}"`)
}

/** Can-do statements: one per unit, "You can ...", plain English, no final punctuation. */
function checkCanDo(canDo: string | undefined, where: string) {
  if (!canDo || !canDo.trim()) return err(`${where}: needs a canDo statement ("You can ...")`)
  if (!canDo.startsWith('You can ')) err(`${where}: canDo must start with "You can ": "${canDo}"`)
  if (/[.!?…;:,]$/.test(canDo.trim())) err(`${where}: canDo must not end with punctuation: "${canDo}"`)
  if (/[—–§]/.test(canDo)) err(`${where}: canDo contains a dash or § sign: "${canDo}"`)
  if (canDo.length > 100) warn(`${where}: canDo is long (${canDo.length} characters)`)
}

/** House style: no em dashes or section signs in any text the learner reads. */
function checkStyle(text: string | undefined, where: string) {
  if (text && /[—§]/.test(text)) err(`${where}: contains an em dash or § sign: "${text}"`)
}
// ------------------------------------------------------------ House style: ids
// Item ids are progress keys, so they never change once a learner has data. Each id's slug spells
// the item's transliteration (accents removed): every 3+ letter part of the slug must appear in it.
const plainLatin = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/y/g, 'i').replace(/[^a-z\s-]/g, ' ')
function checkSlug(trackId: string, id: string, tr: string, where: string) {
  const parts = id.slice(trackId.length + 1).replace(/y/g, 'i').split('-').filter((x) => x.length >= 3)
  const words = plainLatin(tr).split(/[\s-]+/).filter(Boolean)
  const near = (a: string, b: string) => {
    const n = Math.min(4, a.length, b.length)
    return a === b || (n >= 3 && a.slice(0, n) === b.slice(0, n))
  }
  const missing = parts.filter((x) => !words.some((w) => near(x, w)))
  if (missing.length) warn(`${where}: id does not match its content (${missing.join(', ')} not in "${tr}"); the slug should spell the transliteration`)
}

// ------------------------------------------------------------ House style: punctuation
// Words: no full stop in either language; a ? or ! only when both languages have it.
// Phrases: a sentence (capitalised Bulgarian) ends with . ? or ! and the English ends with the same mark;
//   a fragment (lowercase Bulgarian, e.g. "за теб" / "for you") has no final mark in either language.
// Dialogue lines are sentences, the English mirroring the Bulgarian mark. Questions end with "?".
// Answer options and titles never end with a full stop. Scenes end with a full stop.
// A trailing parenthetical such as "(to a boy)" is ignored when finding the final mark.
const coreText = (x: string) => x.trim().replace(/\s*\([^)]*\)\s*$/, '').trim()
const finalMark = (x: string) => {
  const c = coreText(x).slice(-1)
  return /[.!?…]/.test(c) ? c : ''
}
const startsLower = (x: string) => {
  const c = x.trim().charAt(0)
  return c !== c.toLocaleUpperCase('bg')
}
function checkPunct(kind: 'word' | 'phrase' | 'line', bg: string, en: string, where: string, fBg?: string) {
  const b = finalMark(bg)
  const e = finalMark(en)
  if (kind === 'word') {
    if (b === '.' || e === '.') err(`${where}: a word takes no full stop ("${bg}" / "${en}")`)
    else if (b !== e) err(`${where}: Bulgarian and English end differently ("${bg}" / "${en}")`)
  } else if (kind === 'phrase' && startsLower(bg)) {
    if (b || e) err(`${where}: a lowercase fragment takes no final punctuation ("${bg}" / "${en}")`)
    if (!startsLower(en)) err(`${where}: a fragment's English starts lowercase ("${en}")`)
  } else {
    if (!b) err(`${where}: a sentence ends with . ? or ! ("${bg}")`)
    else if (b !== e) err(`${where}: the English must end with the same mark as the Bulgarian ("${bg}" / "${en}")`)
    if (kind === 'phrase' && startsLower(en)) err(`${where}: a sentence's English starts with a capital ("${en}")`)
  }
  if (fBg !== undefined && finalMark(fBg) !== b) err(`${where}: the woman's form ends differently from the man's ("${fBg}")`)
}
const noFullStop = (x: string | undefined, where: string) => {
  if (x && /\.\s*$/.test(x)) err(`${where}: no full stop at the end ("${x}")`)
}

// ------------------------------------------------------------ Dialogue vocabulary
// A "me" line should mostly reuse words the track has taught by that unit. Words are compared loosely:
// common endings are stripped and stems compared on their first 4 letters. Very common words are ignored.
const COMMON = new Set(
  ('аз ти той тя то ние вие те да не и е съм си сме сте са ще ли много моля благодаря а но или че за на в във с със ' +
    'от до по при към без под над пред след през мен теб него нея нас вас тях ми му ни ви им ме го я ги се ' +
    'това тази този тези там тук сега вече още само така също какво къде кога защо колко как кой коя кое кои ' +
    'нещо всичко всички нищо добре хайде нали може трябва има няма мой моя мое мои моят моята моето твой твоя твое ' +
    'твоите твоята твоето наш наша наше наши нашата нашето ваш ваша свой своя един една едно когато повече малко ' +
    'разбира хубаво хубав беше бях бяха ето даже просто после преди ами ако дали значи супер')
    .split(' '),
)
const ENDINGS = ['ите', 'ата', 'ото', 'ове', 'ета', 'ът', 'ят', 'та', 'то', 'те', 'ия', 'а', 'я', 'и', 'е', 'о', 'у', 'ъ']
const lemma = (w: string) => {
  for (const e of ENDINGS) if (w.endsWith(e) && w.length - e.length >= 3) return w.slice(0, -e.length)
  return w
}
const sameStem = (a: string, b: string) => {
  const n = Math.min(4, a.length, b.length)
  return n >= 3 && a.slice(0, n) === b.slice(0, n)
}
// Words a conversation may use without the track teaching them, by dialogue id. Each entry says why.
const UNTAUGHT_OK: Record<string, string[]> = {
  'basics.d3': ['коза'], // the joke turns on a word he has not learned yet
  'basics.d5': ['спим'], // said to a child at bedtime; clear from the scene
  'basics.d6': ['почивай'], // taught in Home (почини си); a natural imperative here
  'basics.d7': ['скъпа', 'браво', 'миличка', 'обичам'], // endearments and praise taught in Love and Kids
  'basics.d8': ['чужбина'], // small-talk answer, understood from context
  'love.d1': ['приятен'], // "Приятен ден" is a set phrase
  'love.d4': ['бутилка', 'червено', 'наздраве', 'удоволствие'], // ordering wine and a toast; set phrases
  'love.d5': ['хотел', 'баба', 'гледа'], // international word; баба is taught in Family
  'love.d6': ['готова'], // "when you're ready": the line would lose its warmth without it
  'love.d7': ['говоря'], // taught in Basics; the anniversary line is the payoff
  'home.d4': ['вкусно'], // the natural thing to say when tasting; taught in Family
  'home.d5': ['проблем', 'окося'], // "Няма проблем" is a set phrase; mowing fits the garden scene
  'home.d6': ['проблем', 'пуканки'], // set phrase; popcorn for film night
  'family.d4': ['скоро'], // taught in Love
  'grammar.d1': ['уморен'], // taught in Basics; the reply "И аз" depends on it
  'grammar.d2': ['вратата'], // shows the article on a new noun, which is the unit's point
  'grammar.d4': ['измия', 'чиниите', 'избереш'], // chores and choices from Home; the unit drills мога да + verb
  'grammar.d5': ['събота', 'неделя'], // days of the week are taught in Basics
  'grammar.d6': ['заповядайте'], // polite set phrase, taught in Family and Out
  'out.d3': ['половин'], // "half a kilo" at the market
  'out.d4': ['извинете', 'шипка', 'минути'], // polite opener, a street name, and minutes from Basics
  'out.d5': ['шапката', 'вратата', 'обичам'], // everyday words in a snow-day scene
  'out.d6': ['ракия'], // the village scene ends with rakia
}
function checkDialogueVocab(t: Track) {
  const items = new Map(t.items.map((i) => [i.id, i]))
  const taught: string[] = []
  for (const u of t.units) {
    for (const l of u.lessons)
      for (const id of l.items) {
        const it = items.get(id)
        if (!it) continue
        for (const x of [it.bg, it.f?.bg, ...(it.bgAlt ?? [])]) if (x) for (const w of tokensBg(x)) taught.push(lemma(w))
      }
    const d = (t.dialogues ?? []).find((x) => x.unitId === u.id)
    if (!d) continue
    const ok = new Set(UNTAUGHT_OK[d.id] ?? [])
    d.lines.forEach((line, i) => {
      if (line.who !== 'me') return
      const unknown = tokensBg(line.bg).filter((w) => w.length >= 4 && !COMMON.has(w) && !ok.has(w) && !taught.some((x) => sameStem(lemma(w), x)))
      if (unknown.length) warn(`${d.id} line ${i + 1}: "me" line uses words not taught in ${t.id} by ${u.id}: ${unknown.join(', ')}`)
    })
  }
}

// ------------------------------------------------------------ Cross-track checks
// The same Bulgarian word must carry the same stress everywhere.
// Add a word here only if it truly has two stresses with two meanings (e.g. 'пара': пára steam / пaрá coin).
const HOMOGRAPHS = new Set<string>([])
const stressSeen = new Map<string, Map<string, string>>()
const tokensBg = (s: string) => s.toLowerCase().replace(/[.,!?;:„“"«»…()]/g, ' ').split(/\s+/).filter(Boolean)
const tokensTr = (s: string) => s.toLowerCase().replace(/[.,!?;:"«»…()]/g, ' ').split(/\s+/).filter(Boolean)
function noteStress(bg: string, tr: string, where: string) {
  const b = tokensBg(bg)
  const t = tokensTr(tr)
  if (b.length !== t.length) return
  b.forEach((w, i) => {
    const form = t[i].normalize('NFC')
    if (!/\u0301/.test(form.normalize('NFD')) || HOMOGRAPHS.has(w)) return
    const m = stressSeen.get(w) ?? new Map<string, string>()
    stressSeen.set(w, m)
    if (!m.has(form)) m.set(form, where)
  })
}
function reportStress() {
  const plain = (x: string) => x.normalize('NFD').replace(/\u0301/g, '').normalize('NFC')
  for (const [w, forms] of stressSeen) {
    const byPlain = new Map<string, string[]>()
    for (const [form, where] of forms) byPlain.set(plain(form), [...(byPlain.get(plain(form)) ?? []), `${form} (${where})`])
    for (const list of byPlain.values()) if (list.length > 1) warn(`"${w}" is stressed differently: ${list.join(' vs ')}`)
  }
}
// The same Bulgarian taught in two tracks counts twice as "learned"; vary one of them.
const bgAcross = new Map<string, string>()
function noteCrossTrack(trackId: string, itemId: string, bg: string) {
  const key = normBg(bg)
  const prev = bgAcross.get(key)
  if (prev && !prev.startsWith(`${trackId}.`)) warn(`${itemId}: same Bulgarian as ${prev} in another track ("${bg}")`)
  else if (!prev) bgAcross.set(key, itemId)
}

const normBg = (s: string) => s.toLowerCase().replace(/[.,!?;:„“"«»…]/g, '').replace(/\s+/g, ' ').trim()

const allIds = new Map<string, string>()
function claimId(id: string, where: string) {
  if (!id) return err(`${where}: missing id`)
  const prev = allIds.get(id)
  if (prev) err(`duplicate id "${id}" (${prev} and ${where})`)
  else allIds.set(id, where)
}

async function load<T>(file: string, exportName: string): Promise<T | null> {
  const path = join(tracksDir, file)
  if (!existsSync(path)) return null
  try {
    const mod = await import(pathToFileURL(path).href)
    if (!mod[exportName]) {
      err(`${file}: no export named "${exportName}"`)
      return null
    }
    return mod[exportName] as T
  } catch (e) {
    err(`${file}: failed to load: ${(e as Error).message}`)
    return null
  }
}

// ------------------------------------------------------------ Alphabet
function validateAlphabet(a: Alphabet) {
  const letterById = new Map(a.letters.map((l) => [l.id, l]))
  const seenUpper = new Map<string, string>()
  for (const l of a.letters) {
    const where = `azbuka letter ${l.id}`
    claimId(l.id, where)
    if (!l.id.startsWith('az.')) err(`${where}: id must start with "az."`)
    if (l.upper.toLowerCase() !== l.lower) err(`${where}: upper "${l.upper}" and lower "${l.lower}" do not match`)
    if (seenUpper.has(l.upper)) err(`${where}: letter ${l.upper} also defined as ${seenUpper.get(l.upper)}`)
    seenUpper.set(l.upper, l.id)
    for (const k of ['tr', 'sound', 'mnemonic'] as const) if (!l[k]) err(`${where}: missing ${k}`)
    checkBg(l.example.bg, `${where} example`)
    checkStress(l.example.tr, `${where} example`)
    noteStress(l.example.bg, l.example.tr, `${where} example`)
    if (!l.example.emoji || !l.example.en) err(`${where}: example needs en and emoji`)
    if (!l.example.bg.toLowerCase().includes(l.lower)) warn(`${where}: example "${l.example.bg}" does not contain ${l.lower}`)
  }
  for (const ch of BULGARIAN_LETTERS) if (!seenUpper.has(ch)) err(`azbuka: letter ${ch} is missing`)
  if (a.letters.length !== 30) err(`azbuka: expected 30 letters, found ${a.letters.length}`)

  const introduced = new Set<string>()
  const usedLetter = new Map<string, string>()
  for (const u of a.units) {
    claimId(u.id, `azbuka unit ${u.id}`)
    checkCanDo(u.canDo, `azbuka unit ${u.id}`)
    for (const lesson of u.lessons) {
      const where = `azbuka lesson ${lesson.id}`
      claimId(lesson.id, where)
      if (lesson.letters.length < 2 || lesson.letters.length > 4) err(`${where}: has ${lesson.letters.length} letters (want 2 to 4)`)
      for (const id of lesson.letters) {
        const l = letterById.get(id)
        if (!l) {
          err(`${where}: unknown letter id "${id}"`)
          continue
        }
        if (usedLetter.has(id)) err(`${where}: letter ${id} already introduced in ${usedLetter.get(id)}`)
        usedLetter.set(id, lesson.id)
        introduced.add(l.lower)
      }
      if (lesson.reading.length < 3 || lesson.reading.length > 6) err(`${where}: has ${lesson.reading.length} reading words (want 3 to 6)`)
      for (const w of lesson.reading) {
        checkBg(w.bg, `${where} reading "${w.bg}"`)
        checkStress(w.tr, `${where} reading "${w.bg}"`)
        noteStress(w.bg, w.tr, where)
        if (!w.en || !w.emoji) err(`${where} reading "${w.bg}": needs en and emoji`)
        const unknown = [...w.bg.toLowerCase()].filter((c) => CYRILLIC.test(c) && !introduced.has(c))
        if (unknown.length) err(`${where} reading "${w.bg}": uses letters not yet introduced: ${[...new Set(unknown)].join(' ')}`)
      }
    }
  }
  for (const l of a.letters) if (!usedLetter.has(l.id)) err(`azbuka: letter ${l.id} is never introduced in a lesson`)
  const lessonCount = a.units.reduce((n, u) => n + u.lessons.length, 0)
  return { units: a.units.length, lessons: lessonCount, letters: a.letters.length }
}

// ------------------------------------------------------------ Tracks
function validateDialogues(t: Track) {
  const unitIds = new Set(t.units.map((u) => u.id))
  const perUnit = new Map<string, string>()
  const dialogues: Dialogue[] = t.dialogues ?? []
  for (const d of dialogues) {
    const where = `${t.id} dialogue ${d.id}`
    claimId(d.id, where)
    if (!d.id?.startsWith(`${t.id}.d`)) err(`${where}: id must start with "${t.id}.d"`)
    if (!unitIds.has(d.unitId)) err(`${where}: unitId "${d.unitId}" is not a unit of ${t.id}`)
    else if (perUnit.has(d.unitId)) err(`${where}: unit ${d.unitId} already has dialogue ${perUnit.get(d.unitId)}`)
    else perUnit.set(d.unitId, d.id)
    for (const k of ['title', 'titleBg', 'scene', 'emoji'] as const) if (!d[k]) err(`${where}: missing ${k}`)
    checkBg(d.titleBg ?? '', `${where} titleBg`)
    checkStyle(d.title, `${where} title`)
    checkStyle(d.scene, `${where} scene`)
    noFullStop(d.title, `${where} title`)
    if (d.scene && finalMark(d.scene) !== '.') err(`${where}: the scene ends with a full stop ("${d.scene}")`)
    const lines = d.lines ?? []
    if (lines.length < 5 || lines.length > 9) err(`${where}: has ${lines.length} lines (want 5 to 9)`)
    const meLines = lines.filter((l) => l.who === 'me')
    if (meLines.length < 2 || meLines.length > 4) err(`${where}: has ${meLines.length} "me" lines (want 2 to 4)`)
    lines.forEach((l, i) => {
      const lw = `${where} line ${i + 1}`
      if (!WHO.has(l.who)) err(`${lw}: unknown speaker "${l.who}"`)
      checkBg(l.bg, lw)
      checkStress(l.tr, lw)
      noteStress(l.bg, l.tr, lw)
      if (!l.en) err(`${lw}: missing en`)
      checkStyle(l.en, lw)
      if (l.en) checkPunct('line', l.bg, l.en, lw, l.f?.bg)
      if (l.f) {
        if (l.who !== 'me') warn(`${lw}: f form on a line not spoken by "me"`)
        checkBg(l.f.bg, `${lw} (f)`)
        checkStress(l.f.tr, `${lw} (f)`)
        noteStress(l.f.bg, l.f.tr, `${lw} (f)`)
        if (l.f.bg === l.bg) warn(`${lw}: f.bg is identical to bg`)
      }
      if (l.who === 'me') {
        const wrong = l.wrong ?? []
        if (wrong.length !== 2) err(`${lw}: "me" line needs exactly 2 wrong replies, has ${wrong.length}`)
        const right = [l.bg, l.f?.bg].filter(Boolean).map((x) => normBg(x as string))
        const seen = new Set<string>()
        for (const w of wrong) {
          checkBg(w, `${lw} wrong`)
          const n = normBg(w)
          if (right.includes(n)) err(`${lw}: wrong reply "${w}" is the same as the right line`)
          if (seen.has(n)) err(`${lw}: wrong reply "${w}" is repeated`)
          seen.add(n)
        }
      } else if (l.wrong?.length) warn(`${lw}: wrong replies on a line not spoken by "me" are ignored`)
    })
    const qs = d.questions ?? []
    if (qs.length < 1 || qs.length > 2) err(`${where}: has ${qs.length} questions (want 1 or 2)`)
    qs.forEach((q, i) => {
      const qw = `${where} question ${i + 1}`
      if (!q.q) err(`${qw}: missing q`)
      checkStyle(q.q, qw)
      if (q.q && !/\?\s*$/.test(q.q)) err(`${qw}: a question ends with "?" ("${q.q}")`)
      if (!Array.isArray(q.options) || q.options.length !== 3) err(`${qw}: needs exactly 3 options`)
      else {
        q.options.forEach((o) => {
          checkStyle(o, `${qw} option`)
          noFullStop(o, `${qw} option`)
        })
        if (new Set(q.options.map((o) => o.toLowerCase())).size !== 3) err(`${qw}: options repeat`)
      }
      if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) err(`${qw}: answer index ${q.answer} is out of range`)
    })
  }
  if (!dialogues.length) warn(`${t.id}: no dialogues yet (want one per unit)`)
  else for (const u of t.units) if (!perUnit.has(u.id)) warn(`${t.id} unit ${u.id}: has no dialogue`)
  return dialogues.length
}

function validateTrack(t: Track, minUnits: number, target: number) {
  const items = new Map(t.items.map((i) => [i.id, i]))
  const bgSeen = new Map<string, string>()
  for (const item of t.items) {
    const where = `${t.id} item ${item.id}`
    claimId(item.id, where)
    if (!item.id.startsWith(`${t.id}.`)) err(`${where}: id must start with "${t.id}."`)
    if (item.kind !== 'word' && item.kind !== 'phrase') err(`${where}: kind must be word or phrase`)
    checkBg(item.bg, where)
    checkStress(item.tr, where)
    noteStress(item.bg, item.tr, where)
    noteCrossTrack(t.id, item.id, item.bg)
    if (!item.en) err(`${where}: missing en`)
    if (!item.emoji) err(`${where}: missing emoji`)
    checkStyle(item.en, where)
    checkStyle(item.note, `${where} note`)
    checkSlug(t.id, item.id, item.tr, where)
    if (item.en && (item.kind === 'word' || item.kind === 'phrase')) checkPunct(item.kind, item.bg, item.en, where, item.f?.bg)
    if (item.f) {
      checkBg(item.f.bg, `${where} (f)`)
      checkStress(item.f.tr, `${where} (f)`)
      noteStress(item.f.bg, item.f.tr, `${where} (f)`)
      if (item.f.bg === item.bg) warn(`${where}: f.bg is identical to bg`)
    }
    for (const a of item.alt ?? []) {
      if (a !== a.toLowerCase() || /[.,!?;:"]/.test(a)) err(`${where}: alt "${a}" must be lowercase without punctuation`)
    }
    for (const b of item.bgAlt ?? []) checkBg(b, `${where} bgAlt`)
    const key = item.bg.toLowerCase().replace(/[.,!?]/g, '').trim()
    if (bgSeen.has(key)) err(`${where}: same Bulgarian as ${bgSeen.get(key)} ("${item.bg}")`)
    bgSeen.set(key, item.id)
    const tiles = item.tiles ?? item.bg.split(/\s+/).map((w) => w.replace(/[.,!?;:]/g, '')).filter(Boolean)
    if (item.kind === 'phrase' && (tiles.length < 1 || tiles.length > 7)) warn(`${where}: phrase has ${tiles.length} tiles (want 2 to 7)`)
    if (item.kind === 'word' && tiles.length > 3) warn(`${where}: "word" has ${tiles.length} words; should it be a phrase?`)
  }

  if (t.units.length < minUnits) err(`${t.id}: has ${t.units.length} units (want at least ${minUnits})`)
  else if (t.units.length < target) warn(`${t.id}: has ${t.units.length} units (planned ${target})`)
  for (const u of t.units) {
    checkStyle(u.title, `${t.id} unit ${u.id} title`)
    checkCanDo(u.canDo, `${t.id} unit ${u.id}`)
    checkStyle(u.description, `${t.id} unit ${u.id} description`)
    noFullStop(u.title, `${t.id} unit ${u.id} title`)
    for (const l of u.lessons) noFullStop(l.title, `${t.id} lesson ${l.id} title`)
  }
  const usedIn = new Map<string, string>()
  for (const u of t.units) {
    claimId(u.id, `${t.id} unit ${u.id}`)
    if (u.lessons.length !== 3) warn(`${t.id} unit ${u.id}: has ${u.lessons.length} lessons (want 3)`)
    for (const lesson of u.lessons) {
      const where = `${t.id} lesson ${lesson.id}`
      claimId(lesson.id, where)
      if (lesson.items.length < 4 || lesson.items.length > 6) err(`${where}: has ${lesson.items.length} items (want 4 to 6)`)
      for (const id of lesson.items) {
        if (!items.has(id)) err(`${where}: unknown item id "${id}"`)
        if (usedIn.has(id)) err(`${where}: item ${id} already used in ${usedIn.get(id)}`)
        usedIn.set(id, lesson.id)
      }
    }
  }
  for (const id of items.keys()) if (!usedIn.has(id)) err(`${t.id}: item ${id} is not used in any lesson`)
  const lessonCount = t.units.reduce((n, u) => n + u.lessons.length, 0)
  const dialogues = validateDialogues(t)
  checkDialogueVocab(t)
  return { units: t.units.length, lessons: lessonCount, items: t.items.length, dialogues }
}

// ------------------------------------------------------------ Run
const summary: string[] = []
const alphabet = await load<Alphabet>('azbuka.ts', 'alphabet')
if (alphabet) {
  const s = validateAlphabet(alphabet)
  summary.push(`azbuka: ${s.units} units, ${s.lessons} lessons, ${s.letters} letters`)
} else summary.push('azbuka: not found (skipped)')

for (const tf of TRACK_FILES) {
  const track = await load<Track>(tf.file, tf.exportName)
  if (!track) {
    summary.push(`${tf.exportName}: not found (skipped)`)
    continue
  }
  const s = validateTrack(track, tf.minUnits, tf.target)
  summary.push(`${track.id}: ${s.units} units, ${s.lessons} lessons, ${s.items} items, ${s.dialogues} dialogues`)
}

reportStress()
console.log(summary.join('\n'))
if (warnings.length) console.log(`\n${warnings.length} warning(s):\n- ${warnings.join('\n- ')}`)
if (errors.length) {
  console.log(`\n${errors.length} error(s):\n- ${errors.join('\n- ')}`)
  process.exit(1)
}
console.log('\nContent OK')
