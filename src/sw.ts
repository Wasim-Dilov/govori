/// <reference lib="webworker" />
// Govori service worker: offline caching plus the evening reminder.
// A scheduled GitHub Action sends an empty "daily" push; this worker reads
// the learner's progress from IndexedDB and decides what the notification says.
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

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
interface Summary {
  streak: number
  lastPracticeDay: string | null
  name?: string
  wordOfDay?: WordOfDay | null
}

function localDay(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

function streakSaver(streak: number, name: string) {
  const who = name ? `, ${name}` : ''
  if (streak > 0) {
    const days = streak === 1 ? '1-day streak' : `${streak}-day streak`
    const variants = [
      { title: `Your ${days} needs you 🔥`, body: `Една минута стига. One minute is enough${who}.` },
      { title: `Don't let the ${days} go out 🔥`, body: 'Хайде! Come on, one quick lesson keeps it alive.' },
      { title: `Щъркелът чака 🐦 ${streak} 🔥`, body: `The stork is waiting${who}. A short lesson saves your streak.` },
      { title: `${streak} days in a row. Keep going? 🔥`, body: 'Само пет минути. Just five minutes tonight.' },
    ]
    return variants[dayIndex(variants.length)]
  }
  const variants = [
    { title: 'Time for a little Bulgarian 🐦', body: `Една минута стига. One minute is enough${who}.` },
    { title: 'Хайде да говорим! 💬', body: "Let's talk. Start a fresh streak with one short lesson." },
    { title: 'Your stork misses you 🐦', body: 'Five minutes of Bulgarian before bed?' },
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
      const streak = summary?.streak ?? 0
      const name = summary?.name ?? ''
      const practisedToday = summary?.lastPracticeDay === localDay()

      const { title, body } = practisedToday ? wordOfTheDay(summary?.wordOfDay, streak) : streakSaver(streak, name)

      if (!practisedToday) {
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
        data: { url: scope },
      })
    })(),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url: string = (event.notification.data as { url?: string } | undefined)?.url ?? self.registration.scope
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          await client.focus()
          return
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
