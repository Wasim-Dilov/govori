// ElevenLabs client for scripts/generate-voices.mjs.
//
// Env: ELEVENLABS_API_KEY (required), ELEVENLABS_MODEL (default eleven_v4, falling back to
// eleven_multilingual_v2 when the account or API does not offer it),
// ELEVENLABS_ENDPOINT (override https://api.elevenlabs.io, for testing),
// ELEVENLABS_VOICE_F / _M / _KID / _ELDER_F / _ELDER_M (voice ids per profile).

export class FatalError extends Error {}
/** The account has run out of characters for this billing period. */
export class QuotaError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function elevenlabs(env = process.env) {
  const key = env.ELEVENLABS_API_KEY?.trim()
  if (!key) throw new FatalError('ELEVENLABS_API_KEY is not set.')
  const base = (env.ELEVENLABS_ENDPOINT?.trim() || 'https://api.elevenlabs.io').replace(/\/$/, '')
  const FALLBACK_MODEL = 'eleven_multilingual_v2'
  let model = env.ELEVENLABS_MODEL?.trim() || 'eleven_v4'
  // Only some models accept language_code; learn it from the first 400 that says so.
  let sendLanguage = true

  const headers = (json = true) => ({ 'xi-api-key': key, 'User-Agent': 'govori', ...(json ? { 'Content-Type': 'application/json' } : {}) })

  /** Parse an ElevenLabs error body into { status, message }. */
  async function errorOf(res) {
    const raw = await res.text().catch(() => '')
    let status = ''
    let message = raw.slice(0, 300)
    try {
      const j = JSON.parse(raw)
      const d = j.detail ?? j
      if (typeof d === 'string') message = d
      else {
        status = d.status ?? d.code ?? ''
        message = d.message ?? JSON.stringify(d).slice(0, 300)
      }
    } catch {
      /* not JSON */
    }
    return { status: String(status), message, raw }
  }

  async function getJson(path) {
    const res = await fetch(`${base}${path}`, { headers: headers(false) })
    if (!res.ok) {
      const e = await errorOf(res)
      if (res.status === 401 || res.status === 403)
        throw new FatalError(`ElevenLabs refused the request to ${path} (HTTP ${res.status}: ${e.status || e.message}). Check ELEVENLABS_API_KEY and that the key has the needed permissions.`)
      throw new Error(`HTTP ${res.status} from ${path}: ${e.message}`)
    }
    return res.json()
  }

  /** Characters used and allowed this billing period. */
  async function subscription() {
    const s = await getJson('/v1/user/subscription')
    const used = Number(s.character_count ?? 0)
    const limit = Number(s.character_limit ?? 0)
    const reset = s.next_character_count_reset_unix ? new Date(s.next_character_count_reset_unix * 1000) : null
    const voiceLimit = Number.isFinite(Number(s.voice_limit)) ? Number(s.voice_limit) : null
    const voiceSlotsUsed = Number.isFinite(Number(s.voice_slots_used)) ? Number(s.voice_slots_used) : null
    return { used, limit, remaining: Math.max(0, limit - used), reset, tier: s.tier ?? 'unknown', voiceLimit, voiceSlotsUsed }
  }

  async function voiceName(voiceId) {
    try {
      const v = await getJson(`/v1/voices/${encodeURIComponent(voiceId)}`)
      return v.name || voiceId
    } catch (e) {
      if (e instanceof FatalError) throw e
      return voiceId
    }
  }

  async function sharedVoices(language = 'bg') {
    const j = await getJson(`/v1/shared-voices?language=${encodeURIComponent(language)}&page_size=50`)
    return (j.voices ?? []).map((v) => ({
      source: 'library',
      name: v.name,
      gender: v.gender ?? '',
      age: v.age ?? '',
      accent: v.accent ?? v.locale ?? '',
      useCase: v.use_case ?? v.category ?? '',
      publicOwnerId: v.public_owner_id ?? '',
      voiceId: v.voice_id,
      previewUrl: v.preview_url ?? '',
    }))
  }

  async function myVoices() {
    const j = await getJson('/v1/voices')
    return (j.voices ?? []).map((v) => ({
      source: v.category ? `account (${v.category})` : 'account',
      name: v.name,
      gender: v.labels?.gender ?? '',
      age: v.labels?.age ?? '',
      accent: v.labels?.accent ?? '',
      useCase: v.labels?.use_case ?? v.labels?.['use case'] ?? '',
      publicOwnerId: '',
      voiceId: v.voice_id,
      previewUrl: v.preview_url ?? '',
    }))
  }

  /** Copy a shared library voice into the account so it can be used for speech. */
  async function addVoice(publicOwnerId, voiceId, newName) {
    const res = await fetch(`${base}/v1/voices/add/${encodeURIComponent(publicOwnerId)}/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ new_name: newName }),
    })
    if (!res.ok) {
      const e = await errorOf(res)
      if (/limit/i.test(`${e.status} ${e.message}`))
        throw new FatalError(`Could not add voice ${voiceId}: all voice slots are in use (the free plan has 3). Remove a voice under My Voices on elevenlabs.io, or choose voices already in the account.`)
      throw new FatalError(`Could not add voice ${voiceId} (HTTP ${res.status}: ${e.status || e.message}).`)
    }
    const j = await res.json()
    return j.voice_id ?? voiceId
  }

  /** Use the requested model if the API lists it, else fall back to eleven_multilingual_v2. */
  async function resolveModel() {
    try {
      const list = await getJson('/v1/models')
      const ids = (Array.isArray(list) ? list : (list.models ?? [])).map((m) => m.model_id)
      if (ids.length && !ids.includes(model)) {
        console.log(`Model ${model} is not available to this account; using ${FALLBACK_MODEL}.`)
        model = FALLBACK_MODEL
      }
    } catch (e) {
      if (e instanceof FatalError) console.warn(`  could not list models (${e.message.split('(')[1]?.split(')')[0] ?? 'no permission'}); trying ${model}`)
      else console.warn(`  could not list models; trying ${model}`)
    }
    return model
  }

  async function inAccount(voiceId) {
    const res = await fetch(`${base}/v1/voices/${encodeURIComponent(voiceId)}`, { headers: headers(false) })
    if (res.ok) return true
    if (res.status === 401 || res.status === 403) {
      const e = await errorOf(res)
      throw new FatalError(`ElevenLabs refused to read voices (HTTP ${res.status}: ${e.status || e.message}). The key needs the Voices permission.`)
    }
    return false
  }

  /** Find a shared library voice by id: Bulgarian pages first, then a general search. */
  async function findLibraryVoice(voiceId) {
    for (let page = 0; page < 5; page++) {
      const j = await getJson(`/v1/shared-voices?language=bg&page_size=100&page=${page}`).catch(() => null)
      const hit = j?.voices?.find((v) => v.voice_id === voiceId)
      if (hit) return hit
      if (!j?.has_more) break
    }
    const j = await getJson(`/v1/shared-voices?search=${encodeURIComponent(voiceId)}&page_size=20`).catch(() => null)
    return j?.voices?.find((v) => v.voice_id === voiceId) ?? null
  }

  /**
   * Make sure the configured voices are in the account, adding library voices as needed.
   * `wanted` is [[profile, voiceId, essential]] in priority order; non-essential voices are only
   * added while free voice slots remain. Returns the set of usable voice ids.
   */
  async function ensureVoices(wanted) {
    const usable = new Set()
    let slots = null
    try {
      const s = await subscription()
      if (s.voiceLimit !== null && s.voiceSlotsUsed !== null) slots = s.voiceLimit - s.voiceSlotsUsed
    } catch {
      /* unknown: try and see */
    }
    for (const [profile, id, essential] of wanted) {
      if (!id || usable.has(id)) continue
      if (await inAccount(id)) {
        usable.add(id)
        continue
      }
      if (!essential && slots !== null && slots <= 0) {
        console.log(`  no free voice slot for the ${profile} voice (${id}); using the main voices instead`)
        continue
      }
      const lib = await findLibraryVoice(id)
      if (!lib) {
        console.warn(`  voice ${id} (${profile}) is not in the account or the shared library`)
        continue
      }
      try {
        const added = await addVoice(lib.public_owner_id, id, lib.name)
        usable.add(added)
        if (slots !== null) slots--
        console.log(`  added library voice ${lib.name} (${added}) for ${profile}`)
      } catch (e) {
        console.warn(`  could not add ${lib.name} for ${profile}: ${e.message}`)
      }
    }
    return usable
  }

  /** Synthesise one clip as mp3. Retries throttling; throws QuotaError or FatalError when it cannot go on. */
  async function synth(voiceId, text) {
    let wait = 2000
    for (let attempt = 1; attempt <= 12; attempt++) {
      // Remember what this request sent: a parallel request may change the shared settings meanwhile.
      const usedModel = model
      const usedLanguage = sendLanguage
      const body = {
        text,
        model_id: usedModel,
        ...(usedLanguage ? { language_code: 'bg' } : {}),
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
      }
      let res
      try {
        res = await fetch(`${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`, {
          method: 'POST',
          headers: { ...headers(), Accept: 'audio/mpeg' },
          body: JSON.stringify(body),
        })
      } catch (e) {
        console.warn(`  network error (${e.message}); retrying in ${wait / 1000}s`)
        await sleep(wait)
        wait = Math.min(60_000, wait * 2)
        continue
      }
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      const e = await errorOf(res)
      const said = `${e.status} ${e.message}`.toLowerCase()
      if (res.status === 400 && usedLanguage && said.includes('language_code')) {
        if (sendLanguage) console.log(`  model ${usedModel} does not take language_code; continuing without it`)
        sendLanguage = false
        continue
      }
      if ([400, 404, 422].includes(res.status) && usedModel !== FALLBACK_MODEL && said.includes('model') && !said.includes('language_code')) {
        if (model !== FALLBACK_MODEL) console.log(`  model ${usedModel} was rejected (${e.status || e.message}); switching to ${FALLBACK_MODEL}`)
        model = FALLBACK_MODEL
        continue
      }
      if (said.includes('quota') || res.status === 402) throw new QuotaError(e.message || 'Character quota exceeded')
      if (res.status === 401 || res.status === 403) throw new FatalError(`ElevenLabs refused the key (HTTP ${res.status}: ${e.status || e.message}). Check the ELEVENLABS_API_KEY secret and its Text to Speech permission.`)
      if (said.includes('voice_not_found') || (res.status === 404 && said.includes('voice')))
        throw new FatalError(`Voice ${voiceId} was not found in the account. Add it first (--add-voice) or fix the ELEVENLABS_VOICE_* variable.`)
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after'))
        const ms = Number.isFinite(ra) && ra > 0 ? ra * 1000 : wait
        console.warn(`  HTTP ${res.status} (${e.status || 'busy'}); waiting ${Math.round(ms / 1000)}s`)
        await sleep(ms)
        wait = Math.min(60_000, wait * 2)
        continue
      }
      throw new Error(`HTTP ${res.status} for "${text}": ${e.message}`)
    }
    throw new Error(`Gave up on "${text}" after repeated throttling`)
  }

  return {
    get model() {
      return model
    },
    resolveModel,
    subscription,
    voiceName,
    sharedVoices,
    myVoices,
    addVoice,
    inAccount,
    findLibraryVoice,
    ensureVoices,
    synth,
  }
}
