import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Literata sets titles, numbers and every Bulgarian word; the optical-size cut keeps it crisp small and fine large.
import '@fontsource-variable/literata/opsz.css'
// English text uses the system font (SF Pro) on Apple devices; Inter is the fallback elsewhere.
import '@fontsource-variable/inter'
// Only for the 'Bulgarian style' alternate letter on letter cards.
import '@fontsource-variable/sofia-sans'
import './styles/tokens.css'
import './styles/components.css'
import './styles/base.css'
import App from './App.tsx'
import { watchForUpdates } from './lib/updates.ts'
import { useApp } from './lib/store.ts'
import { db } from './lib/db.ts'
import { unlockAudio } from './lib/audio.ts'

// Unlock speech and sound on the very first touch (iOS needs a user gesture).
window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true })

// Dev-only handles for testing in the browser console and Playwright.
if (import.meta.env.DEV) Object.assign(window, { __app: useApp, __db: db })

// Pick up new versions of the app without the learner having to do anything.
watchForUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
