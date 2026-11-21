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

/** House style: no em dashes or section signs in any text the learner reads. */
function checkStyle(text: string | undefined, where: string) {
  if (text && /[—§]/.test(text)) err(`${where}: contains an em dash or § sign: "${text}"`)
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
      if (!Array.isArray(q.options) || q.options.length !== 3) err(`${qw}: needs exactly 3 options`)
      else {
        q.options.forEach((o) => checkStyle(o, `${qw} option`))
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
    checkStyle(u.description, `${t.id} unit ${u.id} description`)
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
