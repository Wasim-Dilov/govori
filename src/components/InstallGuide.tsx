// "Add to Home Screen" steps for iPhone, drawn as a clean grouped list.
import { BrandMark } from './BrandMark.tsx'
import './install-guide.css'

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5v11M8 7.5l4-4 4 4" />
      <path d="M8.5 10.5H6.5v10h11v-10h-2" />
    </svg>
  )
}

function AddGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  )
}

const STEPS = [
  { icon: <ShareGlyph />, title: 'Tap Share in Safari', text: 'The square with an arrow, in the toolbar.' },
  { icon: <AddGlyph />, title: 'Choose Add to Home Screen', text: 'Scroll down the list if you don’t see it, then tap Add.' },
  { icon: <BrandMark size={28} />, title: 'Open Govori from its icon', text: 'Reminders and offline lessons work from there.' },
]

export function InstallGuide({ compact = false }: { compact?: boolean }) {
  return (
    <ol className={`ig${compact ? ' ig--compact' : ' gv-list'}`} aria-label="Add Govori to your Home Screen">
      {STEPS.map((s, i) => (
        <li key={s.title} className="gv-row ig-row">
          <span className={`ig-icon${i === 2 ? ' ig-icon--app' : ''}`} aria-hidden="true">
            {s.icon}
          </span>
          <span className="gv-row__body">
            <span className="gv-row__title">
              <span className="ig-num">{i + 1}.</span> {s.title}
            </span>
            {!compact && <span className="gv-row__subtitle">{s.text}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default InstallGuide
