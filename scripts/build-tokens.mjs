// Compiles design/tokens.json (the single source of truth, shared with the
// Govori design system artifact) into src/styles/tokens.css, and checks the
// text/background pairs the design relies on for WCAG contrast.
import { readFileSync, writeFileSync } from 'node:fs'

const tokens = JSON.parse(readFileSync(new URL('../design/tokens.json', import.meta.url), 'utf8'))
const themes = tokens.color.themes.map((t) => t.id)
const [first] = themes

const colorValue = (tok, theme) => {
  const v = typeof tok.value === 'string' ? tok.value : (tok.value[theme] ?? tok.value[first])
  const alias = /^\{(.+)\}$/.exec(v)
  return alias ? `var(--${alias[1]})` : v
}
const block = (theme) =>
  tokens.color.tokens.map((t) => `  --${t.name}: ${colorValue(t, theme)};`).join('\n') +
  '\n' +
  (tokens.shadow?.tokens ?? []).map((t) => `  --${t.name}: ${colorValue(t, theme)};`).join('\n')

const plain = ['spacing', 'radius', 'ledge']
  .flatMap((fam) => tokens[fam].tokens.map((t) => `  --${t.name}: ${t.value};`))
  .concat(Object.entries(tokens.type.families).map(([k, v]) => `  --font-${k}: ${v};`))
  .join('\n')

const typeClasses = tokens.type.groups
  .flatMap((g) =>
    g.styles.map((s) => {
      const fam = s.family ?? g.family
      return `.t-${s.name} { font-family: var(--font-${fam}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight};${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''} }`
    }),
  )
  .join('\n')

const dark = themes[1]
const css = `/* Govori — generated from tokens.json by scripts/build-tokens.mjs. Do not edit by hand. */
:root, [data-theme="${first}"] {
${block(first)}
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="${first}"]) {
${block(dark).replace(/^/gm, '  ')}
    color-scheme: dark;
  }
}
[data-theme="${dark}"] {
${block(dark)}
  color-scheme: dark;
}
:root {
${plain}
}
${typeClasses}
`
writeFileSync(new URL('../src/styles/tokens.css', import.meta.url), css)

// ---- contrast check
const hex = (name, theme) => {
  const tok = tokens.color.tokens.find((t) => t.name === name)
  let v = typeof tok.value === 'string' ? tok.value : (tok.value[theme] ?? tok.value[first])
  const alias = /^\{(.+)\}$/.exec(v)
  return alias ? hex(alias[1], theme) : v
}
const lum = (h) => {
  const n = h.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
// [fg, bg, minimum]
const pairs = [
  ['ink', 'linen', 4.5], ['ink', 'linen-raised', 4.5], ['ink', 'linen-sunk', 4.5],
  ['ink-muted', 'linen', 4.5], ['ink-muted', 'linen-raised', 4.5],
  ['rose', 'linen', 4.5], ['rose', 'linen-raised', 4.5], ['rose-ink', 'rose-soft', 4.5], ['on-rose', 'rose', 4.5],
  ['pine', 'linen-raised', 4.5], ['pine-ink', 'pine-soft', 4.5], ['on-pine', 'pine', 4.5],
  ['gold-ink', 'linen-raised', 4.5], ['gold-ink', 'gold-soft', 4.5], ['on-gold', 'gold', 4.5],
  ['pick', 'pick-soft', 4.5], ['ink', 'pick-soft', 4.5],
  ...['azbuka', 'basics', 'kids', 'love', 'home', 'family', 'grammar', 'out'].flatMap((t) => [['on-track', `trk-${t}`, 3], [`trk-${t}`, 'linen-raised', 3], ['ink', `trk-${t}-soft`, 4.5]]),
]
let fails = 0
for (const theme of themes)
  for (const [fg, bg, min] of pairs) {
    const r = ratio(hex(fg, theme), hex(bg, theme))
    if (r < min) {
      fails++
      console.warn(`contrast ${theme}: ${fg} on ${bg} = ${r.toFixed(2)} (< ${min})`)
    }
  }
console.log(`tokens.css written; ${fails} contrast issue(s)`)
