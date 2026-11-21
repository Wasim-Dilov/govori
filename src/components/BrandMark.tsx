// Govori's brand mark: the Г monogram with a rhombus stitch (the шевица motif),
// white on a rose tile, plus an optional "Govori" wordmark in the system font.
// Colours come from CSS variables so it works in light and dark themes.

const GAMMA = 'M332 236 H688 Q706 236 706 254 V354 Q706 372 688 372 H450 V770 Q450 788 432 788 H332 Q314 788 314 770 V254 Q314 236 332 236 Z'
const STITCH = 'M638 616 L724 702 L638 788 L552 702 Z'

export function BrandMark({ size = 32, showWordmark = false, className, title = 'Govori' }: { size?: number; showWordmark?: boolean; className?: string; title?: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.32 }}>
      <svg width={size} height={size} viewBox="0 0 1024 1024" role={showWordmark ? undefined : 'img'} aria-label={showWordmark ? undefined : title} aria-hidden={showWordmark ? true : undefined}>
        <rect width="1024" height="1024" rx="230" fill="var(--rose, #c8234f)" />
        <path d={GAMMA} fill="#fff" />
        <path d={STITCH} fill="#fff" />
      </svg>
      {showWordmark && (
        <span
          style={{
            font: `700 ${Math.round(size * 0.62)}px/1 -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Variable", "Segoe UI", Roboto, system-ui, sans-serif`,
            letterSpacing: '-0.02em',
            color: 'var(--label, var(--ink, currentColor))',
          }}
        >
          {title}
        </span>
      )}
    </span>
  )
}

export default BrandMark
