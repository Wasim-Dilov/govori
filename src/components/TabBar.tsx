import { useApp, type Tab } from '../lib/store.ts'
import { IconChart, IconLetters, IconPath, IconUser } from './Icons.tsx'
import { sfx } from '../lib/audio.ts'

const TABS: { tab: Tab; label: string; Icon: typeof IconPath }[] = [
  { tab: 'home', label: 'Learn', Icon: IconPath },
  { tab: 'letters', label: 'Letters', Icon: IconLetters },
  { tab: 'stats', label: 'Stats', Icon: IconChart },
  { tab: 'me', label: 'Me', Icon: IconUser },
]

/** Translucent tab bar; the active tab's icon fills and turns rose. */
export function TabBar() {
  const screen = useApp((s) => s.screen.name)
  const goTab = useApp((s) => s.goTab)
  return (
    <nav className="gv-tabbar" aria-label="Main">
      {TABS.map(({ tab, label, Icon }) => {
        const active = screen === tab
        return (
          <button
            key={tab}
            type="button"
            className="gv-tab"
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              if (!active) sfx.tap()
              goTab(tab)
            }}
          >
            <Icon filled={active} />
            <span>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
