import { useApp, type Tab } from '../lib/store.ts'
import { IconChart, IconLetters, IconPath, IconUser } from './Icons.tsx'
import { sfx } from '../lib/audio.ts'

const TABS: { tab: Tab; label: string; Icon: typeof IconPath }[] = [
  { tab: 'home', label: 'Learn', Icon: IconPath },
  { tab: 'letters', label: 'Letters', Icon: IconLetters },
  { tab: 'stats', label: 'Stats', Icon: IconChart },
  { tab: 'me', label: 'Me', Icon: IconUser },
]

export function TabBar() {
  const screen = useApp((s) => s.screen.name)
  const goTab = useApp((s) => s.goTab)
  return (
    <nav className="gv-tabbar" aria-label="Main">
      {TABS.map(({ tab, label, Icon }) => (
        <button
          key={tab}
          type="button"
          className="gv-tab"
          aria-current={screen === tab ? 'page' : undefined}
          onClick={() => {
            if (screen !== tab) sfx.tap()
            goTab(tab)
          }}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}
