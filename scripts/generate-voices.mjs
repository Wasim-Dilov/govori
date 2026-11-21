// Generates Microsoft Azure neural Bulgarian voice clips for everything Govori says.
//
//   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope node scripts/generate-voices.mjs
//
// Clips go to public/voices/<key>.mp3 with an index in public/voices/manifest.json.
// Existing clips are skipped and clips no longer used are removed, so it is cheap to rerun.
// Optional env: AZURE_TTS_ENDPOINT (override the URL, for testing), MAX_CLIPS (cap new clips),
// GIT_COMMIT=1 (commit and push public/voices every 250 new clips, for long free-tier runs).
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tracksDir = join(root, 'src', 'content', 'tracks')
const outDir = join(root, 'public', 'voices')
const manifestPath = join(outDir, 'manifest.json')

// ------------------------------------------------------------- voice profiles
const KALINA = 'bg-BG-KalinaNeural'
const BORISLAV = 'bg-BG-BorislavNeural'
const PROFILES = {
  f: { voice: KALINA, rate: '-8%', pitch: '+0%' },
  m: { voice: BORISLAV, rate: '-8%', pitch: '+0%' },
  kid: { voice: KALINA, rate: '-4%', pitch: '+15%' },
  'elder-f': { voice: KALINA, rate: '-12%', pitch: '-8%' },
  'elder-m': { voice: BORISLAV, rate: '-10%', pitch: '-6%' },
}
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

const keyOf = (profile, text) => createHash('sha1').update(`${profile}|${text}`).digest('hex').slice(0, 16)
const tilesOf = (bg, tiles) =>
  tiles?.length
    ? tiles
    : bg
        .replace(/[.,!?;:„“"«»…]/g, '')
        .split(/\s+/)
        .filter(Boolean)

// ------------------------------------------------------------- collect every spoken string
async function collect() {
  const wanted = new Map() // "profile|text" -> { profile, text }
  const add = (profile, text) => {
    const t = (text ?? '').trim()
    if (t) wanted.set(`${profile}|${t}`, { profile, text: t })
  }
  const files = readdirSync(tracksDir).filter((f) => f.endsWith('.ts')).sort()
  for (const file of files) {
    const mod = await import(pathToFileURL(join(tracksDir, file)).href)
    for (const track of Object.values(mod)) {
      if (!track || typeof track !== 'object') continue
      if (track.id === 'azbuka') {
        for (const l of track.letters) add('f', l.example.bg)
        for (const u of track.units) for (const le of u.lessons) for (const r of le.reading) add('f', r.bg)
        continue
      }
      for (const it of track.items ?? []) {
        add('f', it.bg)
        for (const w of tilesOf(it.bg, it.tiles)) add('f', w)
        if (it.f) {
          add('f', it.f.bg)
          for (const w of tilesOf(it.f.bg)) add('f', w)
        }
      }
      for (const d of track.dialogues ?? [])
        for (const line of d.lines) {
          if (line.who === 'me') {
            add('m', line.bg)
            add('f', line.f?.bg ?? line.bg)
          } else add(WHO_PROFILE[line.who] ?? 'f', line.bg)
        }
    }
  }
  return wanted
}

// ------------------------------------------------------------- synthesis
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
const ssml = (profile, text) => {
  const p = PROFILES[profile]
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="bg-BG"><voice name="${p.voice}"><prosody rate="${p.rate}" pitch="${p.pitch}">${esc(text)}</prosody></voice></speak>`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class FatalError extends Error {}

async function synth(endpoint, key, profile, text) {
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
        body: ssml(profile, text),
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

// ------------------------------------------------------------- main
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

function writeManifest(clips) {
  const sorted = Object.fromEntries(Object.entries(clips).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(manifestPath, JSON.stringify({ v: 1, generatedAt: new Date().toISOString(), clips: sorted }, null, 1) + '\n')
}

async function main() {
  const key = process.env.AZURE_SPEECH_KEY?.trim()
  const region = process.env.AZURE_SPEECH_REGION?.trim()
  if (!key) {
    console.log('AZURE_SPEECH_KEY is not set: skipping voice generation. The app falls back to the phone voice.')
    return
  }
  const endpoint = process.env.AZURE_TTS_ENDPOINT?.trim() || (region ? `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1` : '')
  if (!endpoint) {
    console.error('AZURE_SPEECH_REGION is not set (e.g. westeurope).')
    process.exit(1)
  }
  const maxNew = Number(process.env.MAX_CLIPS) || Infinity
  const gitCommit = process.env.GIT_COMMIT === '1'

  mkdirSync(outDir, { recursive: true })
  const wanted = await collect()
  const clips = {}
  const todo = []
  let chars = 0
  for (const [id, { profile, text }] of wanted) {
    const k = keyOf(profile, text)
    chars += text.length
    if (existsSync(join(outDir, `${k}.mp3`))) clips[id] = k
    else todo.push({ id, profile, text, k })
  }
  const skipped = Object.keys(clips).length
  const queue = todo.slice(0, maxNew)
  console.log(`${wanted.size} clips (${chars} characters): ${skipped} already exist, ${todo.length} to make${queue.length < todo.length ? `, making ${queue.length} this run` : ''}.`)

  let made = 0
  let sinceCommit = 0
  let fatal = null
  const worker = async () => {
    while (queue.length && !fatal) {
      const job = queue.shift()
      try {
        const audio = await synth(endpoint, key, job.profile, job.text)
        writeFileSync(join(outDir, `${job.k}.mp3`), audio)
        clips[job.id] = job.k
        made++
        sinceCommit++
        if (made % 50 === 0) console.log(`  ${made} new clips`)
        if (gitCommit && sinceCommit >= 250) {
          sinceCommit = 0
          writeManifest(clips)
          commitProgress(`Add Bulgarian voice clips (${skipped + made} of ${wanted.size}) [skip ci]`)
        }
      } catch (e) {
        if (e instanceof FatalError) fatal = e
        else console.warn(`  skipped "${job.text}": ${e.message}`)
      }
    }
  }
  await Promise.all([worker(), worker()])

  // Remove clips that no content uses any more.
  const wantedKeys = new Set([...wanted.values()].map(({ profile, text }) => keyOf(profile, text)))
  let pruned = 0
  for (const f of readdirSync(outDir))
    if (f.endsWith('.mp3') && !wantedKeys.has(f.slice(0, -4))) {
      unlinkSync(join(outDir, f))
      pruned++
    }

  writeManifest(clips)
  console.log(`Done: ${Object.keys(clips).length} of ${wanted.size} clips available, ${chars} characters in total, ${made} new, ${skipped} skipped, ${pruned} pruned.`)
  if (fatal) {
    console.error(fatal.message)
    process.exit(1)
  }
}

// Allow importing WHO_PROFILE without running.
if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()

export { PROFILES, keyOf }
