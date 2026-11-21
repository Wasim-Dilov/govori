/// <reference lib="webworker" />
// Govori service worker: offline caching plus the evening reminder.
// A scheduled GitHub Action sends an empty "daily" push; this worker reads
// the learner's progress from IndexedDB and decides what the notification says.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { reminderStreak, type StreakFields } from './lib/streak.ts'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>
}

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Microsoft voice clips: kept once heard (or saved in bulk from Me), the index refreshed quietly.
// The app reads the shared cache name 'govori-voices' when saving every clip for offline use.
registerRoute(
  ({ url }) => url.pathname.includes('/voices/') && url.pathname.endsWith('.mp3'),
  new CacheFirst({ cacheName: 'govori-voices', plugins: [new CacheableResponsePlugin({ statuses: [200] })] }),
)
registerRoute(
  ({ url }) => url.pathname.endsWith('/voices/manifest.json'),
  new StaleWhileRevalidate({ cacheName: 'govori-voices-index', plugins: [new CacheableResponsePlugin({ statuses: [200] })] }),
)

// Offline: any navigation inside the app falls back to the precached shell.
try {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))
} catch {
  // index.html is missing from the manifest in dev builds; nothing to route.
}

// ------------------------------------------------------------------ state

interface WordOfDay {
  bg: string
  tr: string
  en: string
  emoji: string
}

/** Mirror of `Summary` in src/lib/db.ts (only the fields the reminder needs). */
interface Summary extends Partial<StreakFields> {
  streak: number
  lastPracticeDay: string | null
  name?: string
  wordOfDay?: WordOfDay | null
}

/** Where the learner stands tonight. */
type StreakState =
  | { kind: 'practised'; streak: number }
  | { kind: 'at-risk'; streak: number; frozen: boolean }
  | { kind: 'repairable'; streak: number; sessionsLeft: number }
  | { kind: 'lapsed'; best: number }
  | { kind: 'new' }

function localDay(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * The streak as it really stands, not the stored number: the stored streak is only
 * updated when he finishes a session, so after a gap it still shows the old run.
 * Uses the app's own streak rules (src/lib/streak.ts): freezes cover a single missed
 * day, and a broken streak can be repaired with two sessions within 48 hours.
 */
function streakState(s: Summary | null): StreakState {
  if (!s?.lastPracticeDay) return { kind: 'new' }
  const r = reminderStreak({ longestStreak: 0, ...s } as StreakFields, localDay())
  if (r.state === 'repairable') return { kind: 'repairable', streak: r.streak, sessionsLeft: r.repairSessionsLeft }
  if (r.practisedToday) return { kind: 'practised', streak: r.streak }
  if (r.state === 'alive') return { kind: 'at-risk', streak: r.streak, frozen: false }
  if (r.state === 'frozen') return { kind: 'at-risk', streak: r.streak, frozen: true }
  return { kind: 'lapsed', best: r.best }
}

/** Reads kv["summary"] without a version number so it never triggers an upgrade. */
function readSummary(): Promise<Summary | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open('govori')
    } catch {
      resolve(null)
      return
    }
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
    // A brand-new database means the app was never opened: abort so we don't create it empty.
    req.onupgradeneeded = () => {
      req.transaction?.abort()
      resolve(null)
    }
    req.onsuccess = () => {
      const database = req.result
      try {
        if (!database.objectStoreNames.contains('kv')) {
          database.close()
          resolve(null)
          return
        }
        const get = database.transaction('kv', 'readonly').objectStore('kv').get('summary')
        get.onsuccess = () => {
          const row = get.result as { key: string; value: Summary } | undefined
          database.close()
          resolve(row?.value ?? null)
        }
        get.onerror = () => {
          database.close()
          resolve(null)
        }
      } catch {
        database.close()
        resolve(null)
      }
    }
  })
}

// ------------------------------------------------------------------ copy

/** Same index for the whole day, different from day to day. */
function dayIndex(len: number) {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime()
  const day = Math.floor((Date.now() - start) / 86_400_000)
  return day % len
}

const FALLBACK_WORDS: WordOfDay[] = [
  { bg: 'Обичам те', tr: 'obícham te', en: 'I love you', emoji: '❤️' },
  { bg: 'Липсваш ми', tr: 'lípsvash mi', en: 'I miss you', emoji: '🥺' },
  { bg: 'Лека нощ', tr: 'léka nosht', en: 'Good night', emoji: '🌙' },
  { bg: 'Браво!', tr: 'brávo', en: 'Well done!', emoji: '👏' },
]

function streakSaver(streak: number, frozen: boolean, name: string) {
  const who = name ? `, ${name}` : ''
  const days = streak === 1 ? '1-day streak' : `${streak}-day streak`
  if (frozen)
    return { title: `Your ${days} is safe ❄️`, body: 'A streak freeze covered yesterday. One minute today keeps it going.' }
  const variants = [
    { title: `Keep your ${days} going 🔥`, body: `Една минута стига. One minute is enough${who}.` },
    { title: `${streak} days in a row. One more? 🔥`, body: 'Хайде! A one-minute review counts for today.' },
    { title: `Your ${days} is waiting 🔥`, body: 'Само една минута. Just one minute before bed.' },
    { title: `Day ${streak + 1} starts here 🔥`, body: `A quick review keeps it alive${who}.` },
  ]
  return variants[dayIndex(variants.length)]
}

/** The streak broke very recently and can still be brought back. */
function repairPrompt(streak: number, sessionsLeft: number, name: string) {
  const who = name ? `, ${name}` : ''
  if (sessionsLeft <= 1)
    return { title: `One more session brings back your ${streak}-day streak 🔧`, body: `Почти готово${who}. Almost there: one short lesson or review tonight.` }
  const variants = [
    { title: `Repair your ${streak}-day streak tonight 🔧`, body: 'Two short sessions bring it back. Хайде!' },
    { title: `Your ${streak}-day streak can still be saved 🔧`, body: `Две кратки сесии${who}. Two short sessions and it is back.` },
  ]
  return variants[dayIndex(variants.length)]
}

/** After a gap: warm, no guilt, and the smallest possible next step. */
function welcomeBack(best: number, name: string) {
  const who = name ? `, ${name}` : ''
  const variants = [
    { title: 'Welcome back 🌿', body: `Радвам се да те видя${who}. Two minutes today?` },
    { title: 'A fresh start 🌱', body: 'Нов ден, нов старт. One short review is all it takes.' },
    { title: 'Ready when you are 💬', body: 'Една минута стига. Pick up right where you left off.' },
  ]
  const v = variants[dayIndex(variants.length)]
  if (best >= 3 && dayIndex(2) === 0)
    return { title: v.title, body: `Your best run was ${best} days. Start a new one tonight with one minute.` }
  return v
}

/** Never practised yet: an easy first step. */
function firstStep(name: string) {
  const who = name ? `, ${name}` : ''
  const variants = [
    { title: 'Time for a little Bulgarian 💬', body: `Една минута стига. One minute is enough${who}.` },
    { title: 'Хайде да говорим! 💬', body: "Let's talk. Your first Bulgarian words take one minute." },
    { title: 'Your first words are waiting 🌱', body: 'Започни днес. Start tonight with one short lesson.' },
  ]
  return variants[dayIndex(variants.length)]
}

function wordOfTheDay(word: WordOfDay | null | undefined, streak: number) {
  const w = word ?? FALLBACK_WORDS[dayIndex(FALLBACK_WORDS.length)]
  const flame = streak > 0 ? ` ${streak} 🔥` : ''
  const variants = [
    { title: `Word of the day ${w.emoji}${flame}`, body: `${w.bg}, ${w.tr}. ${w.en}.` },
    { title: `Браво! Streak safe${flame}`, body: `Try this on her tonight: ${w.bg} (${w.tr}), ${w.en}.` },
    { title: `Say it today ${w.emoji}`, body: `${w.bg}, ${w.tr}, means "${w.en}".` },
  ]
  return variants[dayIndex(variants.length)]
}

// ------------------------------------------------------------------ push

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      let summary: Summary | null = null
      try {
        summary = await readSummary()
      } catch {
        summary = null
      }
      const name = summary?.name ?? ''
      const state = streakState(summary)
      const practisedToday = summary?.lastPracticeDay === localDay()

      const { title, body } =
        state.kind === 'practised'
          ? wordOfTheDay(summary?.wordOfDay, state.streak)
          : state.kind === 'repairable'
            ? repairPrompt(state.streak, state.sessionsLeft, name)
            : state.kind === 'at-risk'
              ? streakSaver(state.streak, state.frozen, name)
              : state.kind === 'lapsed'
                ? welcomeBack(state.best, name)
                : firstStep(name)
      // A repair still in progress needs another session even if he practised today.
      const nudge = !practisedToday || state.kind === 'repairable'

      if (nudge) {
        try {
          await self.navigator.setAppBadge?.(1)
        } catch {
          // Badging is optional.
        }
      }

      const scope = self.registration.scope
      // iOS revokes the subscription if a push does not show a notification, so always show one.
      await self.registration.showNotification(title, {
        body,
        tag: 'govori-daily',
        icon: new URL('icons/icon-192.png', scope).href,
        badge: new URL('icons/badge-96.png', scope).href,
        // Not practised yet (or a repair is open): open straight into a one-minute quick session.
        data: { url: nudge ? `${scope}?quick=1` : scope, quick: nudge },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const data = event.notification.data as { url?: string; quick?: boolean } | undefined
  const url: string = data?.url ?? self.registration.scope
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          await client.focus()
          // The app is already open: ask it to start the one-minute quick session.
          if (data?.quick) client.postMessage({ type: 'govori-quick' })
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
