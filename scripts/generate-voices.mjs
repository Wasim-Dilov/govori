// Generates natural Bulgarian voice clips for everything Govori says, with ElevenLabs or Microsoft Azure.
//
//   node scripts/generate-voices.mjs                 make every missing clip (full run)
//   node scripts/generate-voices.mjs --list-voices   list Bulgarian ElevenLabs voices to choose from
//   node scripts/generate-voices.mjs --add-voice <public_owner_id> <voice_id> <name>
//                                                    copy a shared library voice into the account
//   node scripts/generate-voices.mjs --sample        8 sample sentences per voice in SAMPLE_VOICES
//
// Provider: TTS_PROVIDER=elevenlabs|azure, else ElevenLabs when ELEVENLABS_API_KEY is set,
// else Azure when AZURE_SPEECH_KEY is set, else nothing happens (the app uses the phone voice).
//   ElevenLabs: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_F, ELEVENLABS_VOICE_M (and optional
//               ELEVENLABS_VOICE_KID, _ELDER_F, _ELDER_M), ELEVENLABS_MODEL, ELEVENLABS_ENDPOINT.
//   Azure:      AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_TTS_ENDPOINT.
//
// Clips go to public/voices/<key>.mp3 with an index in public/voices/manifest.json that maps
// "<profile>|<text>" to a key. Keys include the provider and voice, so changing either makes
// fresh clips. Existing clips are skipped, so it is cheap to rerun; a run that hits the monthly
// character limit stops cleanly and the next run carries on.
// Optional env: MAX_CLIPS (cap new clips), GIT_COMMIT=1 (commit and push every 250 new clips),
// SAMPLE_VOICES (comma separated voice ids, or public_owner_id:voice_id for library voices),
// VOICES_DIR / SAMPLE_DIR (output folders, for tests).
//
// Order: clips are made in learning priority, so a monthly free quota voices what he meets first:
// alphabet example and reading words, lesson words and phrases in 12-week-plan order (basics u1-u2,
// love u1, kids u1, then every track unit by unit), conversation lines, word-bank tile words, and
// last the woman's-form variants (only used when Govori addresses the learner as a woman).
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { FatalError, QuotaError, elevenlabs } from './voices-elevenlabs.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tracksDir = join(root, 'src', 'content', 'tracks')
// VOICES_DIR / SAMPLE_DIR override the output folders (used by tests so nothing fake lands in public/).
const outDir = process.env.VOICES_DIR || join(root, 'public', 'voices')
const manifestPath = join(outDir, 'manifest.json')
const sampleDir = process.env.SAMPLE_DIR || join(root, 'sample-voices')

/** Who speaks a conversation line, mapped to a voice profile. "me" is generated in both m and f. */
export const WHO_PROFILE = {
  wife: 'f',
  son: 'kid',
  daughter: 'kid',
  mil: 'elder-f',
  grandma: 'elder-f',
  fil: 'elder-m',
  friend: 'm',
  waiter: 'm',
  seller: 'f',
  neighbour: 'f',
}
const PROFILE_NAMES = ['f', 'm', 'kid', 'elder-f', 'elder-m']

const SAMPLE_SENTENCES = [
  'Обичам те, скъпа.',
  'Лека нощ, сладки сънища.',
  'Какво искаш за закуска?',
  'Много е вкусно, благодаря!',
  'Добро утро, слънчице.',
  'Наздраве!',
  'Колко струва това?',
  'Говори по-бавно, моля.',
]

const sha = (s) => createHash('sha1').update(s).digest('hex').slice(0, 16)
const tilesOf = (bg, tiles) =>
  tiles?.length
    ? tiles
    : bg
        .replace(/[.,!?;:„“"«»…]/g, '')
        .split(/\s+/)
        .filter(Boolean)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const notice = (msg) => console.log(process.env.GITHUB_ACTIONS ? `::notice::${msg}` : msg)

// ------------------------------------------------------------- collect every spoken string
const PLAN_TRACKS = ['basics', 'love', 'kids', 'grammar', 'home', 'family', 'out']
const FIRST_UNITS = ['basics.u1', 'basics.u2', 'love.u1', 'kids.u1']

/** Rank of a unit in the learning order: the first units of the plan, then every track unit by unit. */
function unitRank(unitId, maxUnits) {
  const first = FIRST_UNITS.indexOf(unitId)
  if (first >= 0) return first
  const [track, u] = unitId.split('.')
  const n = Number(u?.replace('u', '')) || 99
  const t = PLAN_TRACKS.indexOf(track)
  return FIRST_UNITS.length + (n - 1) * PLAN_TRACKS.length + (t < 0 ? PLAN_TRACKS.length : t) + (n > maxUnits ? 1000 : 0)
}

// Priority tiers: lower is made first.
const TIER = { letters: 0, lesson: 1, dialogue: 2, tiles: 3, femaleForms: 4 }

async function collect() {
  const entries = new Map() // "profile|text" -> { profile, text, prio }
  let seq = 0
  const add = (profile, text, tier, rank = 0) => {
    const t = (text ?? '').trim()
    if (!t) return
    const id = `${profile}|${t}`
    const prio = tier * 1e9 + rank * 1e5 + seq++
    const prev = entries.get(id)
    if (!prev || prio < prev.prio) entries.set(id, { profile, text: t, prio })
  }
  const files = readdirSync(tracksDir).filter((f) => f.endsWith('.ts')).sort()
  for (const file of files) {
    const mod = await import(pathToFileURL(join(tracksDir, file)).href)
    for (const track of Object.values(mod)) {
      if (!track || typeof track !== 'object') continue
      if (track.id === 'azbuka') {
        let rank = 0
        for (const u of track.units)
          for (const le of u.lessons) {
            rank++
            for (const lid of le.letters) {
              const l = track.letters.find((x) => x.id === lid)
              if (l) add('f', l.example.bg, TIER.letters, rank)
            }
            for (const r of le.reading) add('f', r.bg, TIER.letters, rank)
          }
        continue
      }
      const maxUnits = 50
      const unitOfItem = new Map()
      for (const u of track.units ?? []) for (const le of u.lessons) for (const id of le.items) unitOfItem.set(id, u.id)
      for (const it of track.items ?? []) {
        const rank = unitRank(unitOfItem.get(it.id) ?? `${track.id}.u99`, maxUnits)
        add('f', it.bg, TIER.lesson, rank)
        for (const w of tilesOf(it.bg, it.tiles)) add('f', w, TIER.tiles, rank)
        if (it.f) {
          add('f', it.f.bg, TIER.femaleForms, rank)
          for (const w of tilesOf(it.f.bg)) add('f', w, TIER.femaleForms, rank)
        }
      }
      for (const d of track.dialogues ?? []) {
        const rank = unitRank(d.unitId, maxUnits)
        for (const line of d.lines) {
          if (line.who === 'me') {
            add('m', line.bg, TIER.dialogue, rank)
            add('f', line.f?.bg ?? line.bg, TIER.femaleForms, rank)
          } else add(WHO_PROFILE[line.who] ?? 'f', line.bg, TIER.dialogue, rank)
        }
      }
    }
  }
  // Insertion order of the returned map is the generation order.
  const sorted = [...entries.entries()].sort(([, a], [, b]) => a.prio - b.prio)
  return new Map(sorted.map(([id, { profile, text }]) => [id, { profile, text }]))
}

// ------------------------------------------------------------- providers
/** Microsoft Azure neural voices, with prosody per profile. */
function azureProvider() {
  const key = process.env.AZURE_SPEECH_KEY?.trim()
  const region = process.env.AZURE_SPEECH_REGION?.trim()
  const endpoint = process.env.AZURE_TTS_ENDPOINT?.trim() || (region ? `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1` : '')
  if (!endpoint) throw new FatalError('AZURE_SPEECH_REGION is not set (e.g. westeurope).')
  const KALINA = 'bg-BG-KalinaNeural'
  const BORISLAV = 'bg-BG-BorislavNeural'
  const PROFILES = {
    f: { voice: KALINA, rate: '-8%', pitch: '+0%' },
    m: { voice: BORISLAV, rate: '-8%', pitch: '+0%' },
    kid: { voice: KALINA, rate: '-4%', pitch: '+15%' },
    'elder-f': { voice: KALINA, rate: '-12%', pitch: '-8%' },
    'elder-m': { voice: BORISLAV, rate: '-10%', pitch: '-6%' },
  }
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
  const ssml = (p, text) =>
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="bg-BG"><voice name="${p.voice}"><prosody rate="${p.rate}" pitch="${p.pitch}">${esc(text)}</prosody></voice></speak>`

  async function synth(profile, text) {
    const p = PROFILES[profile]
    let wait = 2000
    for (let attempt = 1; attempt <= 12; attempt++) {
      let res
      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'govori',
          },
          body: ssml(p, text),
        })
      } catch (e) {
        console.warn(`  network error (${e.message}); retrying in ${wait / 1000}s`)
        await sleep(wait)
        wait = Math.min(60_000, wait * 2)
        continue
      }
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      if (res.status === 401 || res.status === 403)
        throw new FatalError(`Azure refused the key (HTTP ${res.status}). Check the AZURE_SPEECH_KEY secret and that AZURE_SPEECH_REGION matches the Speech resource's region.`)
      if (res.status === 429 || res.status === 503 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after'))
        const ms = Number.isFinite(ra) && ra > 0 ? ra * 1000 : wait
        console.warn(`  HTTP ${res.status}; waiting ${Math.round(ms / 1000)}s`)
        await sleep(ms)
        wait = Math.min(60_000, wait * 2)
        continue
      }
      throw new Error(`HTTP ${res.status} for "${text}": ${(await res.text()).slice(0, 200)}`)
    }
    throw new Error(`Gave up on "${text}" after repeated throttling`)
  }

  return {
    name: 'azure',
    async prepare() {
      return Object.fromEntries(PROFILE_NAMES.map((p) => [p, PROFILES[p].voice.replace(/^bg-BG-|Neural$/g, '')]))
    },
    clipKey: (profile, text) => {
      const p = PROFILES[profile]
      return sha(`azure|${p.voice}|${p.rate}|${p.pitch}|${text}`)
    },
    synth,
    async credits() {
      return null
    },
  }
}

/** Display names for the voices chosen with the user (library names can be long). */
const KNOWN_VOICES = {
  M1ydWt7KnBCiuv4CnEDC: 'Milena',
  '31jwlwrRwpOA5yGuVAby': 'Georgi',
  CBDgRB8OyxYGowoi5iXR: 'Mimi',
}
/** "Milena - warm narrator" -> "Milena" */
const shortName = (id, name) => KNOWN_VOICES[id] ?? String(name || id).split(/\s+[-–|(]\s*/)[0].trim()

/** ElevenLabs voices chosen per profile with repo variables. */
function elevenlabsProvider() {
  const api = elevenlabs()
  const env = process.env
  const configured = {
    f: env.ELEVENLABS_VOICE_F?.trim(),
    m: env.ELEVENLABS_VOICE_M?.trim(),
    kid: env.ELEVENLABS_VOICE_KID?.trim(),
    'elder-f': env.ELEVENLABS_VOICE_ELDER_F?.trim(),
    'elder-m': env.ELEVENLABS_VOICE_ELDER_M?.trim(),
  }
  const ids = {}
  return {
    name: 'elevenlabs',
    api,
    ready: !!configured.f,
    async prepare() {
      await api.resolveModel()
      // The free plan has 3 voice slots: f, m and kid are added first; elders only if slots remain.
      const usable = await api.ensureVoices([
        ['f', configured.f, true],
        ['m', configured.m, true],
        ['kid', configured.kid, true],
        ['elder-f', configured['elder-f'], false],
        ['elder-m', configured['elder-m'], false],
      ])
      if (!usable.has(configured.f)) throw new FatalError(`The main voice ELEVENLABS_VOICE_F (${configured.f}) cannot be used: it is not in the account and could not be added from the library.`)
      const ok = (id) => (id && usable.has(id) ? id : null)
      ids.f = configured.f
      ids.m = ok(configured.m) ?? ids.f
      if (!ok(configured.m)) console.warn('No usable male voice (ELEVENLABS_VOICE_M): male lines will use the female voice.')
      ids.kid = ok(configured.kid) ?? ids.f
      ids['elder-f'] = ok(configured['elder-f']) ?? ids.f
      ids['elder-m'] = ok(configured['elder-m']) ?? ids.m
      console.log(`Model: ${api.model}`)
      const names = {}
      const cache = new Map()
      for (const p of PROFILE_NAMES) {
        if (!cache.has(ids[p])) cache.set(ids[p], shortName(ids[p], await api.voiceName(ids[p])))
        names[p] = cache.get(ids[p])
      }
      return names
    },
    // Same voice, model and text give the same clip, so profiles that share a voice share files.
    clipKey: (profile, text) => sha(`elevenlabs|${ids[profile]}|${api.model}|${text}`),
    synth: (profile, text) => api.synth(ids[profile], text),
    credits: () => api.subscription(),
  }
}

function pickProvider() {
  const forced = process.env.TTS_PROVIDER?.trim().toLowerCase()
  const has11 = !!process.env.ELEVENLABS_API_KEY?.trim()
  const hasAz = !!process.env.AZURE_SPEECH_KEY?.trim()
  const which = forced || (has11 ? 'elevenlabs' : hasAz ? 'azure' : '')
  if (!which) return null
  if (which === 'elevenlabs') {
    if (!has11) throw new FatalError('TTS_PROVIDER is elevenlabs but ELEVENLABS_API_KEY is not set.')
    return elevenlabsProvider()
  }
  if (which === 'azure') {
    if (!hasAz) throw new FatalError('TTS_PROVIDER is azure but AZURE_SPEECH_KEY is not set.')
    return azureProvider()
  }
  throw new FatalError(`Unknown TTS_PROVIDER "${which}" (use elevenlabs or azure).`)
}

// ------------------------------------------------------------- git and manifest
function commitProgress(message) {
  try {
    execSync('git add public/voices', { cwd: root, stdio: 'ignore' })
    const changed = execSync('git status --porcelain public/voices', { cwd: root }).toString().trim()
    if (!changed) return
    execSync(`git commit -q -m "${message}"`, { cwd: root, stdio: 'inherit' })
    execSync('git pull -q --rebase origin main && git push -q origin HEAD:main', { cwd: root, stdio: 'inherit' })
    console.log(`  committed: ${message}`)
  } catch (e) {
    console.warn(`  could not commit progress: ${e.message}`)
  }
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch {
    return null
  }
}

function writeManifest(provider, voices, clips) {
  const sorted = Object.fromEntries(Object.entries(clips).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(manifestPath, JSON.stringify({ v: 1, generatedAt: new Date().toISOString(), provider, voices, clips: sorted }, null, 1) + '\n')
}

// ------------------------------------------------------------- full run
async function runFull() {
  const provider = pickProvider()
  if (!provider) {
    notice('No voice key is set (ELEVENLABS_API_KEY or AZURE_SPEECH_KEY): skipping voice generation. The app uses the phone voice.')
    return
  }
  if (provider.name === 'elevenlabs' && !provider.ready) {
    notice('ElevenLabs is connected but no voice is chosen yet. Run the workflow in "list" mode, then set the repository variables ELEVENLABS_VOICE_F and ELEVENLABS_VOICE_M.')
    return
  }
  const maxNew = Number(process.env.MAX_CLIPS) || Infinity
  const gitCommit = process.env.GIT_COMMIT === '1'
  mkdirSync(outDir, { recursive: true })

  const voices = await provider.prepare()
  const wanted = await collect()
  const old = readManifest()
  const clips = {}
  const jobsByKey = new Map() // key -> { key, profile, text, ids: [] }
  let chars = 0
  let pendingChars = 0
  for (const [id, { profile, text }] of wanted) {
    const k = provider.clipKey(profile, text)
    if (existsSync(join(outDir, `${k}.mp3`))) {
      clips[id] = k
      continue
    }
    const job = jobsByKey.get(k)
    if (job) job.ids.push(id)
    else {
      jobsByKey.set(k, { key: k, profile, text, ids: [id] })
      pendingChars += text.length
    }
  }
  for (const { text } of new Set([...wanted.values()])) chars += text.length
  const todo = [...jobsByKey.values()]
  const skipped = Object.keys(clips).length
  const queue = todo.slice(0, maxNew)
  console.log(
    `${provider.name}: ${wanted.size} lines (${chars} characters) use ${new Set([...wanted.values()].map(({ profile, text }) => provider.clipKey(profile, text))).size} distinct clips; ` +
      `${skipped} lines already voiced, ${todo.length} clips to make (${pendingChars} characters)${queue.length < todo.length ? `, making ${queue.length} this run` : ''}.`,
  )
  console.log(`Voices: ${PROFILE_NAMES.map((p) => `${p}=${voices[p]}`).join(', ')}`)

  const credits = await provider.credits()
  if (credits) {
    console.log(`ElevenLabs credits (${credits.tier}): ${credits.used} of ${credits.limit} used, ${credits.remaining} remaining${credits.reset ? `, resets ${credits.reset.toISOString().slice(0, 10)}` : ''}.`)
    if (queue.length && credits.remaining <= 0) {
      notice(`No ElevenLabs characters left this month${credits.reset ? ` (resets ${credits.reset.toISOString().slice(0, 10)})` : ''}. ${todo.length} clips are still to make; the next run will carry on.`)
      keepOldClips(old, wanted, clips)
      writeManifest(provider.name, voices, clips)
      return
    }
  }

  let made = 0
  let sinceCommit = 0
  let fatal = null
  let quota = null
  const worker = async () => {
    while (queue.length && !fatal && !quota) {
      const job = queue.shift()
      try {
        const audio = await provider.synth(job.profile, job.text)
        writeFileSync(join(outDir, `${job.key}.mp3`), audio)
        for (const id of job.ids) clips[id] = job.key
        made++
        sinceCommit++
        if (made % 50 === 0) console.log(`  ${made} new clips`)
        if (gitCommit && sinceCommit >= 250) {
          sinceCommit = 0
          writeManifest(provider.name, voices, { ...keepOldClips(old, wanted, { ...clips }) })
          commitProgress(`Add Bulgarian voice clips (${made} new) [skip ci]`)
        }
      } catch (e) {
        if (e instanceof QuotaError) quota = e
        else if (e instanceof FatalError) fatal = e
        else console.warn(`  skipped "${job.text}": ${e.message}`)
      }
    }
  }
  await Promise.all([worker(), worker()])

  // Lines without a new clip keep their previous clip (e.g. while switching provider).
  keepOldClips(old, wanted, clips)
  const used = new Set(Object.values(clips))
  let pruned = 0
  for (const f of readdirSync(outDir))
    if (f.endsWith('.mp3') && !used.has(f.slice(0, -4))) {
      unlinkSync(join(outDir, f))
      pruned++
    }
  writeManifest(provider.name, voices, clips)
  const voiced = Object.keys(clips).length
  console.log(`Done: ${voiced} of ${wanted.size} lines voiced, ${made} new clips, ${pruned} unused clips removed.`)
  if (quota) {
    const left = todo.length - made
    let when = ''
    try {
      const c = await provider.credits()
      if (c?.reset) when = ` It resets on ${c.reset.toISOString().slice(0, 10)}.`
    } catch {
      /* ignore */
    }
    notice(`Stopped at the monthly ElevenLabs character limit after ${made} new clips (${quota?.message ?? 'quota'}); ${left} clips are still to make.${when} Run this workflow again after the reset (a monthly schedule does it automatically).`)
  }
  if (fatal) {
    console.error(fatal.message)
    process.exit(1)
  }
}

/** Fill lines that still lack a clip with the previous manifest's clip, if its file is still there. */
function keepOldClips(old, wanted, clips) {
  if (!old?.clips) return clips
  for (const id of wanted.keys()) {
    if (clips[id]) continue
    const k = old.clips[id]
    if (k && existsSync(join(outDir, `${k}.mp3`))) clips[id] = k
  }
  return clips
}

// ------------------------------------------------------------- voice picking helpers
function requireElevenlabs() {
  if (!process.env.ELEVENLABS_API_KEY?.trim()) throw new FatalError('Set ELEVENLABS_API_KEY to list, add or sample ElevenLabs voices.')
  return elevenlabs()
}

async function runList() {
  const api = requireElevenlabs()
  const [library, mine] = await Promise.all([api.sharedVoices('bg'), api.myVoices()])
  const rows = [...mine, ...library]
  const cols = ['source', 'name', 'gender', 'age', 'accent', 'useCase', 'publicOwnerId', 'voiceId', 'previewUrl']
  console.log(`${mine.length} voices in your account, ${library.length} Bulgarian voices in the shared library.\n`)
  for (const r of rows) console.log(cols.map((c) => `${c}: ${r[c] || '-'}`).join(' | '))
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) {
    const cell = (s) => String(s || '').replace(/\|/g, '/')
    const md = [
      '## Bulgarian voices',
      '',
      'Copy a **voice id** into the repository variables `ELEVENLABS_VOICE_F` and `ELEVENLABS_VOICE_M`. Library voices may need adding first: run the workflow in **sample** mode with `public_owner_id:voice_id` entries, which adds them for you.',
      '',
      '| Source | Name | Gender | Age | Accent | Use case | public_owner_id | voice_id | Preview |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...rows.map((r) => `| ${cell(r.source)} | ${cell(r.name)} | ${cell(r.gender)} | ${cell(r.age)} | ${cell(r.accent)} | ${cell(r.useCase)} | ${r.publicOwnerId ? `\`${cell(r.publicOwnerId)}\`` : ""} | \`${cell(r.voiceId)}\` | ${r.previewUrl ? `[listen](${r.previewUrl})` : ''} |`),
      '',
    ].join('\n')
    appendFileSync(summary, md)
  }
}

async function runAdd(args) {
  const [owner, voiceId, ...nameParts] = args
  if (!owner || !voiceId) throw new FatalError('Usage: --add-voice <public_owner_id> <voice_id> <name>')
  const api = requireElevenlabs()
  const id = await api.addVoice(owner, voiceId, nameParts.join(' ') || voiceId)
  console.log(`Added. Use this voice id: ${id}`)
  console.log('Set it as the repository variable ELEVENLABS_VOICE_F (female) or ELEVENLABS_VOICE_M (male).')
}

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'voice'

async function runSample() {
  const api = requireElevenlabs()
  const entries = (process.env.SAMPLE_VOICES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!entries.length) throw new FatalError('Set SAMPLE_VOICES to a comma separated list of voice ids (or public_owner_id:voice_id for shared library voices).')
  rmSync(sampleDir, { recursive: true, force: true })
  mkdirSync(sampleDir, { recursive: true })
  const library = await api.sharedVoices('bg').catch(() => [])
  const made = []
  let chars = 0
  for (const entry of entries) {
    const [owner, rawId] = entry.includes(':') ? entry.split(':') : ['', entry]
    let voiceId = rawId
    const lib = library.find((v) => v.voiceId === rawId)
    let name = lib?.name || (await api.voiceName(voiceId))
    const dir = join(sampleDir, slug(`${name}-${voiceId.slice(0, 6)}`))
    mkdirSync(dir, { recursive: true })
    const files = []
    for (const [i, text] of SAMPLE_SENTENCES.entries()) {
      let audio
      try {
        audio = await api.synth(voiceId, text)
      } catch (e) {
        if (i === 0 && e instanceof FatalError && /not found/i.test(e.message) && (owner || lib?.publicOwnerId)) {
          voiceId = await api.addVoice(owner || lib.publicOwnerId, rawId, name)
          name = (await api.voiceName(voiceId)) || name
          console.log(`  added library voice ${name} to the account as ${voiceId}`)
          audio = await api.synth(voiceId, text)
        } else throw e
      }
      const file = `${String(i + 1).padStart(2, '0')}.mp3`
      writeFileSync(join(dir, file), audio)
      files.push({ file, text })
      chars += text.length
    }
    made.push({ name, voiceId, dir: dir.slice(sampleDir.length + 1), gender: lib?.gender ?? '', accent: lib?.accent ?? '', files })
    console.log(`  ${name} (${voiceId}): ${files.length} samples`)
  }
  writeFileSync(join(sampleDir, 'voices.json'), JSON.stringify(made, null, 1) + '\n')
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Govori voice samples</title>
<style>body{font:16px/1.4 -apple-system,system-ui,sans-serif;margin:0;padding:16px;max-width:640px;margin-inline:auto;background:#f2f2f7;color:#000}
section{background:#fff;border-radius:14px;padding:16px;margin-bottom:16px}h1{font-size:28px}h2{font-size:20px;margin:0 0 4px}
p.meta{color:#6c6c70;margin:0 0 12px;font-size:14px}code{font-size:13px}div.row{display:grid;gap:4px;margin:10px 0}audio{width:100%}
@media (prefers-color-scheme:dark){body{background:#000;color:#fff}section{background:#1c1c1e}p.meta{color:#98989f}}</style></head><body>
<h1>Govori voice samples</h1><p>Listen with your wife and pick the voice that sounds most natural. Copy its voice id into the repository variable ELEVENLABS_VOICE_F or ELEVENLABS_VOICE_M.</p>
${made
  .map(
    (v) => `<section><h2>${esc(v.name)}</h2><p class="meta">${esc([v.gender, v.accent].filter(Boolean).join(' · '))} · voice id <code>${esc(v.voiceId)}</code></p>
${v.files.map((f) => `<div class="row"><span lang="bg">${esc(f.text)}</span><audio controls preload="none" src="${esc(v.dir)}/${f.file}"></audio></div>`).join('\n')}</section>`,
  )
  .join('\n')}
</body></html>
`
  writeFileSync(join(sampleDir, 'index.html'), html)
  console.log(`Samples for ${made.length} voices in ${sampleDir} (${chars} characters used).`)
  const summary = process.env.GITHUB_STEP_SUMMARY
  const repo = process.env.GITHUB_REPOSITORY
  if (summary && repo) {
    const md = [
      '## Voice samples',
      '',
      'Tap a sentence to listen (opens the mp3). The full player page is in the `voice-samples` artifact and branch.',
      '',
      ...made.flatMap((v) => [
        `### ${v.name} \`${v.voiceId}\``,
        '',
        ...v.files.map((f) => `- [${f.text}](https://github.com/${repo}/raw/voice-samples/${v.dir}/${f.file})`),
        '',
      ]),
    ].join('\n')
    appendFileSync(summary, md)
  }
}

// ------------------------------------------------------------- entry
async function main() {
  const [mode, ...args] = process.argv.slice(2)
  if (mode === '--list-voices') return runList()
  if (mode === '--add-voice') return runAdd(args)
  if (mode === '--sample') return runSample()
  return runFull()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main()
  } catch (e) {
    console.error(e instanceof FatalError ? e.message : e)
    process.exit(1)
  }
}
