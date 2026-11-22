// Generates the iOS launch images (apple-touch-startup-image) for the installed app:
// the paper ground with the Г brand tile, light and dark, for each iPhone size.
// The tile is 120pt with a 27pt radius, centred in the area below the status bar, which is
// exactly where App.tsx draws its loader, so launch hands over to the app without a jump.
//
//   node scripts/make-splash.mjs        writes public/splash/*.png and updates index.html
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

// [CSS width, CSS height, pixel ratio, status bar height in pt (the app starts below it)]
const DEVICES = [
  [375, 667, 2, 20], // iPhone SE 2/3, 8
  [414, 896, 2, 48], // iPhone XR, 11
  [375, 812, 3, 44], // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  [390, 844, 3, 47], // iPhone 12, 13, 14
  [393, 852, 3, 59], // iPhone 14 Pro, 15, 15 Pro, 16
  [402, 874, 3, 62], // iPhone 16 Pro
  [428, 926, 3, 47], // iPhone 12/13 Pro Max, 14 Plus
  [430, 932, 3, 59], // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  [440, 956, 3, 62], // iPhone 16 Pro Max
]
const THEMES = { light: '#f5f0e6', dark: '#151210' }
const BRAND = '#c8234f'
const TILE = 120
const GAMMA = 'M332 236 H688 Q706 236 706 254 V354 Q706 372 688 372 H450 V770 Q450 788 432 788 H332 Q314 788 314 770 V254 Q314 236 332 236 Z'
const STITCH = 'M638 616 L724 702 L638 788 L552 702 Z'

const root = new URL('..', import.meta.url)
const outDir = new URL('public/splash/', root)
mkdirSync(outDir, { recursive: true })

const page = (w, h, top, bg) => `<!doctype html><html><head><style>
  html, body { margin: 0; width: ${w}px; height: ${h}px; background: ${bg}; overflow: hidden; }
  svg { position: absolute; left: ${(w - TILE) / 2}px; top: ${top + (h - top - TILE) / 2}px; }
</style></head><body>
<svg width="${TILE}" height="${TILE}" viewBox="0 0 1024 1024"><rect width="1024" height="1024" rx="230" fill="${BRAND}"/><path d="${GAMMA}" fill="#fff"/><path d="${STITCH}" fill="#fff"/></svg>
</body></html>`

const browser = await chromium.launch()
const links = []
for (const [w, h, dpr, top] of DEVICES) {
  for (const [theme, bg] of Object.entries(THEMES)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })
    const p = await ctx.newPage()
    await p.setContent(page(w, h, top, bg))
    const name = `splash-${w * dpr}x${h * dpr}-${theme}.png`
    await p.screenshot({ path: new URL(name, outDir).pathname, type: 'png' })
    await ctx.close()
    links.push(
      `    <link rel="apple-touch-startup-image" href="/splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait) and (prefers-color-scheme: ${theme})" />`,
    )
  }
}
await browser.close()

// Keep index.html in sync between the markers.
const indexUrl = new URL('index.html', root)
const html = readFileSync(indexUrl, 'utf8')
const start = '    <!-- splash:start -->'
const end = '    <!-- splash:end -->'
const block = [start, ...links, end].join('\n')
const next = html.includes(start)
  ? html.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block)
  : html.replace('  </head>', `${block}\n  </head>`)
writeFileSync(indexUrl, next)
console.log(`wrote ${links.length} launch images to public/splash and updated index.html`)
