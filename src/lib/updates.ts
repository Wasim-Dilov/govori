// Keeps the installed app current. The service worker (src/sw.ts) installs new
// versions in the background and takes over straight away; this reloads the page
// onto the new version, but never in the middle of a lesson or onboarding.
import { useApp } from './store.ts'

const UNSAFE = new Set(['session', 'complete', 'onboarding'])
const HOUR = 60 * 60 * 1000

export function watchForUpdates() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  // On a first-ever visit there is no controller yet; taking control then is not an update.
  const hadController = !!navigator.serviceWorker.controller
  let pending = false
  let reloading = false

  const reloadWhenSafe = () => {
    if (reloading) return
    if (UNSAFE.has(useApp.getState().screen.name)) {
      pending = true
      return
    }
    reloading = true
    window.location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) reloadWhenSafe()
  })
  // Finish a deferred update as soon as the learner leaves the lesson.
  useApp.subscribe((s) => {
    if (pending && !UNSAFE.has(s.screen.name)) reloadWhenSafe()
  })

  void navigator.serviceWorker.ready.then((reg) => {
    let last = 0
    const check = () => {
      if (Date.now() - last < 60_000) return
      last = Date.now()
      void reg.update().catch(() => undefined)
    }
    check()
    // iPhone home-screen apps resume rather than relaunch, so check whenever it comes back.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
    setInterval(check, HOUR)
  })
}
