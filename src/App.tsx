import { useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useApp, type Screen } from './lib/store.ts'
import { HomeScreen } from './screens/Home.tsx'
import { LettersScreen } from './screens/Letters.tsx'
import { StatsScreen } from './screens/Stats.tsx'
import { MeScreen } from './screens/Me.tsx'
import { OnboardingScreen } from './screens/Onboarding.tsx'
import { SessionScreen } from './screens/Session.tsx'
import { CompleteScreen } from './screens/Complete.tsx'
import { QuizScreen } from './screens/Quiz.tsx'
import { engineFeatures } from './lib/engine.ts'
import { TabBar } from './components/TabBar.tsx'
import { BrandMark } from './components/BrandMark.tsx'
import { Toast } from './components/Toast.tsx'

// The fill-the-gap exercise has a screen now, so the engine may build it.
engineFeatures.cloze = true

// ---------------------------------------------------------------- screen transitions
// Every screen change goes through store.go(). Wrap it once so each change runs inside a
// View Transition (Safari 18+, Chrome) with the right motion; elsewhere the incoming screen
// animates on its own (data-enter on .app-shell). The styles live in base.css.
type Motion = 'tab' | 'push' | 'pop' | 'complete' | 'fade' | 'reduce'
const TABS = new Set(['home', 'letters', 'stats', 'me'])
const FLOWS = new Set(['session', 'quiz'])

function motionFor(from: string, to: string): Motion | null {
  if (from === to) return null
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 'reduce'
  if (TABS.has(from) && TABS.has(to)) return 'tab'
  if (to === 'complete') return 'complete'
  if (FLOWS.has(to)) return 'push'
  if (FLOWS.has(from) || from === 'complete') return 'pop'
  return 'fade'
}

type ViewTransition = { ready: Promise<void>; updateCallbackDone: Promise<void>; finished: Promise<void> }
type VTDocument = Document & { startViewTransition?: (update: () => void) => ViewTransition }
const supportsVT = typeof document !== 'undefined' && typeof (document as VTDocument).startViewTransition === 'function'
/** For the fallback: how the screen now being shown should enter. */
let enterMotion: Motion | null = null

const baseGo = useApp.getState().go
useApp.setState({
  go(screen: Screen) {
    const state = useApp.getState()
    const motion = state.ready && document.visibilityState === 'visible' ? motionFor(state.screen.name, screen.name) : null
    if (!motion) {
      enterMotion = null
      baseGo(screen)
      return
    }
    if (supportsVT) {
      const root = document.documentElement
      root.dataset.vt = motion
      const vt = (document as VTDocument).startViewTransition!(() => {
        flushSync(() => baseGo(screen))
      })
      // A transition can be skipped (e.g. the viewport changes mid-way); that is not an error.
      const ignore = () => undefined
      vt.ready.catch(ignore)
      vt.updateCallbackDone.catch(ignore)
      void vt.finished.catch(ignore).finally(() => {
        if (root.dataset.vt === motion) delete root.dataset.vt
      })
    } else {
      enterMotion = motion
      baseGo(screen)
    }
  },
})

export default function App() {
  return (
    <>
      <Screens />
      <Toast />
    </>
  )
}

function Screens() {
  const ready = useApp((s) => s.ready)
  const screen = useApp((s) => s.screen)
  const init = useApp((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  // Same size and place as the iOS launch image (scripts/make-splash.mjs), so launch hands over seamlessly.
  if (!ready)
    return (
      <div className="app-shell app-loader">
        <BrandMark size={120} />
      </div>
    )

  const enter = supportsVT ? undefined : (enterMotion ?? undefined)
  const key = screen.name === 'session' ? `session-${screen.sessionId}` : screen.name

  let content
  switch (screen.name) {
    case 'onboarding':
      content = <OnboardingScreen />
      break
    case 'session':
      content = <SessionScreen key={screen.sessionId} />
      break
    case 'complete':
      content = <CompleteScreen />
      break
    case 'quiz':
      content = <QuizScreen />
      break
    default:
      content = (
        <>
          {screen.name === 'home' && <HomeScreen />}
          {screen.name === 'letters' && <LettersScreen />}
          {screen.name === 'stats' && <StatsScreen />}
          {screen.name === 'me' && <MeScreen />}
          <div className="tabbar-dock">
            <TabBar />
          </div>
        </>
      )
  }

  return (
    <div className="app-shell" key={key} data-enter={enter}>
      {content}
    </div>
  )
}
