// Sends Govori's evening Web Push. Run by .github/workflows/reminder.yml.
// GOVORI_PUSH is the setup code copied from the app (Settings > Reminders):
// base64url JSON { v, subject, publicKey, privateKey, subscription }.
// The notification text itself is chosen on the phone by the service worker.
import * as webpush from 'web-push'

const code = (process.env.GOVORI_PUSH ?? '').trim()
if (!code) {
  console.log('No GOVORI_PUSH secret set yet, so there is nobody to remind. See docs/reminders.md.')
  process.exit(0)
}

let cfg
try {
  const json = Buffer.from(code.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  cfg = JSON.parse(json)
} catch {
  console.error('GOVORI_PUSH is not a valid setup code. Copy it again from Govori: Settings > Reminders.')
  process.exit(1)
}

const { subject, publicKey, privateKey, subscription } = cfg ?? {}
if (!publicKey || !privateKey || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
  console.error('GOVORI_PUSH is missing parts. Copy the setup code again from Govori: Settings > Reminders.')
  process.exit(1)
}

webpush.setVapidDetails(subject || 'https://wasim-dilov.github.io/govori/', publicKey, privateKey)

try {
  const res = await webpush.sendNotification(subscription, JSON.stringify({ type: 'daily', ts: Date.now() }), {
    TTL: 43200,
    urgency: 'high',
  })
  console.log(`Reminder sent (status ${res.statusCode}) to ${new URL(subscription.endpoint).host}.`)
} catch (err) {
  const status = err?.statusCode
  if (status === 404 || status === 410) {
    console.error(
      'The phone subscription has expired or was removed (status ' +
        status +
        '). Open Govori, go to Settings > Reminders, turn reminders off and on again, and paste the new code into the GOVORI_PUSH secret.',
    )
  } else if (status === 403) {
    console.error('Push service refused the keys (403). Re-enable reminders in the app and update the GOVORI_PUSH secret.')
  } else {
    console.error('Sending the reminder failed:', status ?? '', err?.body ?? err?.message ?? err)
  }
  process.exit(1)
}
