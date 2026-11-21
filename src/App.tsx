import { useEffect } from 'react'
import { useApp } from './lib/store.ts'
import { HomeScreen } from './screens/Home.tsx'
import { LettersScreen } from './screens/Letters.tsx'
import { StatsScreen } from './screens/Stats.tsx'
import { MeScreen } from './screens/Me.tsx'
import { OnboardingScreen } from './screens/Onboarding.tsx'
import { SessionScreen } from './screens/Session.tsx'
import { CompleteScreen } from './screens/Complete.tsx'
import { TabBar } from './components/TabBar.tsx'
import { Mascot } from './components/Mascot.tsx'

export default function App() {
  const ready = useApp((s) => s.ready)
  const screen = useApp((s) => s.screen)
  const init = useApp((s) => s.init)

  useEffect(() => {
    void init()
  }, [init])

  if (!ready)
    return (
      <div className="app-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <Mascot mood="idle" size={120} />
      </div>
    )

  switch (screen.name) {
    case 'onboarding':
      return (
        <div className="app-shell">
          <OnboardingScreen />
        </div>
      )
    case 'session':
      return (
        <div className="app-shell">
          <SessionScreen key={screen.sessionId} />
        </div>
      )
    case 'complete':
      return (
        <div className="app-shell">
          <CompleteScreen />
        </div>
      )
    default:
      return (
        <div className="app-shell">
          {screen.name === 'home' && <HomeScreen />}
          {screen.name === 'letters' && <LettersScreen />}
          {screen.name === 'stats' && <StatsScreen />}
          {screen.name === 'me' && <MeScreen />}
          <div className="tabbar-dock">
            <TabBar />
          </div>
        </div>
      )
  }
}
