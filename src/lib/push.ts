// Evening reminders without a server.
// The phone makes its own VAPID key pair, subscribes to Web Push with the public
// half, and hands the learner a one-time "setup code" (keys + subscription) to
// paste into the GitHub secret GOVORI_PUSH. A scheduled GitHub Action then sends
// the push each evening (see scripts/send-reminder.mjs and docs/reminders.md).
import { db, getKV, setKV } from './db.ts'

export const GITHUB_SECRET_URL = 'https://github.com/Wasim-Dilov/govori/settings/secrets/actions/new'
export const GITHUB_ACTION_URL = 'https://github.com/Wasim-Dilov/govori/actions/workflows/reminder.yml'
const SUBJECT = 'https://wasim-dilov.github.io/govori/'

interface StoredPush {
  publicKey: string
  privateKey: string
  subscription: PushSubscriptionJSON
  createdAt: number
}

export interface ReminderStatus {
  supported: boolean
  standalone: boolean
  permission: NotificationPermission | 'unsupported'
  enabled: boolean
  reason?: string
}

// ------------------------------------------------------------------ helpers

const toB64Url = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (const b of arr) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromB64Url = (str: string) => {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const textToB64Url = (text: string) => toB64Url(new TextEncoder().encode(text))

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
}

const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const pushApisPresent = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('The app is still installing its offline files. Try again in a few seconds.')), 8000),
    ),
  ])
  return reg
}

// ------------------------------------------------------------------ public API

export async function reminderStatus(): Promise<ReminderStatus> {
  const standalone = isStandalone()
  const stored = await getKV<StoredPush | null>('push', null)

  if (!pushApisPresent()) {
    const reason =
      isIOS() && !standalone
        ? 'On iPhone, reminders only work from the Home Screen app. In Safari tap Share, then "Add to Home Screen", and open Govori from there.'
        : isIOS()
          ? 'This iPhone needs iOS 16.4 or newer for reminders. Update iOS in Settings, General, Software Update.'
          : 'This browser does not support push notifications.'
    return { supported: false, standalone, permission: 'unsupported', enabled: false, reason }
  }

  const permission = Notification.permission
  let enabled = false
  if (stored && permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      enabled = !!sub && sub.endpoint === stored.subscription.endpoint
    } catch {
      enabled = false
    }
  }

  let reason: string | undefined
  if (permission === 'denied')
    reason = 'Notifications are blocked. Turn them on in the iPhone Settings app, under Notifications, Govori.'
  else if (isIOS() && !standalone)
    reason = 'Open Govori from your Home Screen to turn on reminders.'

  return { supported: true, standalone, permission, enabled, reason }
}

/** Call from a tap. Returns the setup code to paste into the GitHub secret GOVORI_PUSH. */
export async function enableReminders(): Promise<string> {
  if (!pushApisPresent()) {
    const status = await reminderStatus()
    throw new Error(status.reason ?? 'Push notifications are not supported here.')
  }

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications were not allowed. You can allow them in the iPhone Settings app, under Notifications, Govori.')
  }

  const reg = await registration()
  const stored = await getKV<StoredPush | null>('push', null)
  const existing = await reg.pushManager.getSubscription()

  // Reuse what we have when the browser still holds the same subscription.
  if (stored && existing && existing.endpoint === stored.subscription.endpoint) {
    return buildCode(stored)
  }

  let publicKey: string
  let privateKey: string
  if (stored) {
    publicKey = stored.publicKey
    privateKey = stored.privateKey
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const raw = await crypto.subtle.exportKey('raw', pair.publicKey) // 65 bytes, uncompressed point
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    if (!jwk.d) throw new Error('Could not create the reminder keys on this device.')
    publicKey = toB64Url(raw)
    privateKey = jwk.d // already base64url, 32 bytes
  }

  // A subscription made with a different key must be replaced.
  if (existing) {
    try {
      await existing.unsubscribe()
    } catch {
      // ignore
    }
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: fromB64Url(publicKey),
  })

  const record: StoredPush = { publicKey, privateKey, subscription: sub.toJSON(), createdAt: Date.now() }
  await setKV('push', record)
  return buildCode(record)
}

function buildCode(p: StoredPush): string {
  return textToB64Url(
    JSON.stringify({ v: 1, subject: SUBJECT, publicKey: p.publicKey, privateKey: p.privateKey, subscription: p.subscription }),
  )
}

export async function getReminderCode(): Promise<string | null> {
  const stored = await getKV<StoredPush | null>('push', null)
  return stored ? buildCode(stored) : null
}

export async function disableReminders(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      await sub?.unsubscribe()
    }
  } catch {
    // ignore
  }
  await db.kv.delete('push')
}

export function clearBadge(): void {
  try {
    const nav = navigator as Navigator & { clearAppBadge?: () => Promise<void> }
    void nav.clearAppBadge?.()
  } catch {
    // Badging is optional.
  }
}
