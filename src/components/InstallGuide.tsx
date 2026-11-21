// "Add to Home Screen" steps for iPhone, drawn with CSS and inline SVG.
import '../screens/onboarding.css'

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5v11M8 7.5l4-4 4 4" />
      <path d="M8.5 10.5H6.5v10h11v-10h-2" />
    </svg>
  )
}

function AddGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  )
}

/** A tiny Govori app icon for the illustration. */
function MiniIcon() {
  return (
    <span className="ig-appicon" aria-hidden="true">
      <span className="gv-star" />
    </span>
  )
}

export function InstallGuide({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <ol className="ig-mini" aria-label="Add Govori to your Home Screen">
        <li>
          <span className="ig-num">1</span>
          <span>
            In Safari, tap <span className="ig-chip"><ShareGlyph /> Share</span>
          </span>
        </li>
        <li>
          <span className="ig-num">2</span>
          <span>
            Choose <span className="ig-chip"><AddGlyph /> Add to Home Screen</span>
          </span>
        </li>
        <li>
          <span className="ig-num">3</span>
          <span className="ig-mini-open">
            Open <MiniIcon /> <strong>Govori</strong> from its icon
          </span>
        </li>
      </ol>
    )
  return (
    <ol className="ig" aria-label="Add Govori to your Home Screen">
      <li className="ig-step">
        <div className="ig-art" aria-hidden="true">
          <div className="ig-safari">
            <span className="ig-url">wasim-dilov.github.io</span>
            <div className="ig-bar">
              <span className="ig-dim">‹</span>
              <span className="ig-dim">›</span>
              <span className="ig-hot">
                <ShareGlyph />
              </span>
              <span className="ig-dim ig-book" />
              <span className="ig-dim ig-tabs" />
            </div>
          </div>
        </div>
        <div className="ig-text">
          <span className="ig-num">1</span>
          <p>
            In Safari, tap the <strong>Share</strong> button.
          </p>
        </div>
      </li>
      <li className="ig-step">
        <div className="ig-art" aria-hidden="true">
          <div className="ig-sheet">
            <div className="ig-row ig-dimrow">Copy</div>
            <div className="ig-row ig-hotrow">
              Add to Home Screen <AddGlyph />
            </div>
            <div className="ig-row ig-dimrow">Add Bookmark</div>
          </div>
        </div>
        <div className="ig-text">
          <span className="ig-num">2</span>
          <p>
            Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
          </p>
        </div>
      </li>
      <li className="ig-step">
        <div className="ig-art" aria-hidden="true">
          <div className="ig-home">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i} className="ig-ghost" />
            ))}
            <span className="ig-hero">
              <MiniIcon />
              <span className="ig-label">Govori</span>
            </span>
          </div>
        </div>
        <div className="ig-text">
          <span className="ig-num">3</span>
          <p>
            Open <strong>Govori</strong> from its new icon. Reminders and offline lessons work from there.
          </p>
        </div>
      </li>
    </ol>
  )
}

export default InstallGuide
