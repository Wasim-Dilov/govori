// Exports everything Govori has logged on this phone as one JSON file, for backup
// or later analysis. Audio recordings and the reminder keys are left out on purpose.
import { db, localDay } from './db.ts'

/** kv keys that must never leave the phone (the reminder private key lives under "push"). */
const PRIVATE_KV = new Set(['push'])

export async function collectData() {
  const [kv, lessons, memory, events, sessions] = await Promise.all([db.kv.toArray(), db.lessons.toArray(), db.memory.toArray(), db.events.toArray(), db.sessions.toArray()])
  const settings = Object.fromEntries(kv.filter((r) => !PRIVATE_KV.has(r.key)).map((r) => [r.key, r.value]))
  return {
    app: 'govori',
    format: 1,
    exportedAt: new Date().toISOString(),
    counts: { lessons: lessons.length, memory: memory.length, events: events.length, sessions: sessions.length },
    profile: settings.profile ?? null,
    summary: settings.summary ?? null,
    settings,
    lessons,
    memory,
    events,
    sessions,
  }
}

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled'

/** Share the file through the iPhone share sheet when possible, otherwise download it. */
export async function exportAll(): Promise<ExportOutcome> {
  const data = await collectData()
  const name = `govori-data-${localDay()}.json`
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const file = new File([blob], name, { type: 'application/json' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Govori data', text: 'My Govori learning data' })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Fall through to a plain download if sharing failed for another reason.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return 'downloaded'
}

/** Alias used by the Me screen. */
export const exportData = exportAll
