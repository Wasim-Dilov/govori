import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/rubik'
import '@fontsource-variable/sofia-sans'
import '@fontsource-variable/unbounded'
import './styles/tokens.css'
import './styles/components.css'
import './styles/base.css'
import App from './App.tsx'
import { useApp } from './lib/store.ts'
import { db } from './lib/db.ts'

// Dev-only handles for testing in the browser console and Playwright.
if (import.meta.env.DEV) Object.assign(window, { __app: useApp, __db: db })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
