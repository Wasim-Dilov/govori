# Govori design system

Native iOS, clean and professional. Calm, precise, content first. One rose accent, everything else neutral. No mascot, no chunky 3D ledges, no bouncing, no confetti.

- **Tokens:** `design/tokens.json` is the single source. `npm run tokens` (or `node scripts/build-tokens.mjs`) writes `src/styles/tokens.css` and checks every text and background pair for WCAG contrast in light and dark. It must report 0 issues.
- **Components:** `src/styles/components.css` (classes prefixed `gv-`). Base layout is in `src/styles/base.css`.
- **Icons:** `src/components/Icons.tsx`. They're SF Symbols-style line icons on a 24px grid with 1.75px strokes. Pass `filled` for the filled variant, for example on the active tab.

## Principles

1. **Hierarchy:** comes from type size and weight, spacing and grouping, not from colour or decoration.
2. **Layout:** flat white cells on a grey grouped background (black in dark mode), like Settings or Fitness.
3. **Colour:** the accent (rose) is for the primary action, selection, the active tab and the streak. Nothing else is coloured, except feedback (green is correct, amber is not quite) and small track badges.
4. **Case:** sentence case everywhere, buttons included. No uppercase labels.
5. **Emoji:** only where they teach meaning, such as picture cards and the intro card. Keep them modest in size, and never use them as decoration.
6. **Шевица:** the fine-line embroidery accent appears in three places only: the app icon, the top of the completion sheet and the onboarding welcome. The eight-pointed star (`IconStar`, `--mask-star8`) is the one other folk detail.

## Colour tokens

| Token | Role |
|---|---|
| `linen` | Grouped background (`#f2f2f7` / `#000`) |
| `linen-raised` | Cells, cards, choices, sheets (`#fff` / `#1c1c1e`) |
| `linen-sunk` | Tertiary fill: wells, disabled buttons, progress tracks |
| `fill-secondary` | Pressed cells, ring and progress tracks, keyboard |
| `segment-thumb` | Segmented control thumb |
| `material`, `material-thick` | Translucent bars and sheets (with backdrop blur) |
| `separator` | Hairline list separators |
| `line`, `line-strong` | Quiet borders; resting border of tiles, inputs and choice keys |
| `ink` | Primary label |
| `ink-muted` | Secondary label: subtitles, transliteration, metadata (≥4.5:1) |
| `label-tertiary` | Placeholders and disabled glyphs only |
| `accent`, `accent-pressed`, `on-accent` | Filled primary button and selection fills (white label in both themes) |
| `rose`, `rose-deep`, `rose-soft`, `rose-ink`, `on-rose` | Accent as text and icons, tints, and text on a tint |
| `pick`, `pick-soft`, `pick-deep` | Aliases of the rose family for a selected answer |
| `pine`, `pine-deep`, `pine-soft`, `pine-ink`, `on-pine` | Correct |
| `warn`, `warn-deep`, `warn-soft`, `warn-ink`, `on-warn` | Not quite (amber, never red) |
| `gold`, `gold-deep`, `gold-soft`, `gold-ink`, `on-gold` | Rewards as icons and numbers only |
| `trk-<track>`, `-deep`, `-soft`, `on-track` | Muted track hues for badges and rings, never large fills behind text |
| `shadow-card`, `shadow-float`, `focus-ring` | Optional lift (light only); floating things; keyboard focus |

In dark mode, `pine`, `warn` and `rose` are bright, and their `on-*` labels are dark. `accent` stays a deep rose with a white label.

## Type

The font is the system font: SF Pro on iPhone, with Inter as the fallback elsewhere. Sofia Sans is used only for the "Bulgarian style" alternate letter. Tag Bulgarian text with `lang="bg"`.

| Class | Size / line / weight | Use |
|---|---|---|
| `.t-large-title` | 34/41 700 | Tab screen title, once |
| `.t-title1` | 28/34 700 | Flow titles |
| `.t-title2` | 22/28 700 | Exercise prompts, sheet titles |
| `.t-title3` | 20/25 600 | Card and unit titles |
| `.t-headline` | 17/22 600 | Row titles, emphasis |
| `.t-body` | 17/22 400 | Reading text |
| `.t-callout` | 16/21 400 | Supporting text |
| `.t-subhead` | 15/20 400 | Row subtitles |
| `.t-footnote` | 13/18 400 | Section headers, transliteration |
| `.t-caption` | 12/16 400 | Tiny metadata |
| `.t-bg-word` | 30/36 600 | The Bulgarian being taught |
| `.t-letter` | 96/100 600 | A letter on a letter card |

Older names still work as aliases:
- `.t-hero` → large-title
- `.t-screen-title` → title1
- `.t-card-title` → title3
- `.t-prompt` → title2
- `.t-stat` → headline with tabular figures
- `.t-body-strong` → headline
- `.t-label` → subhead 600, sentence case

## Spacing, radius, motion

- **Spacing:** `space-1` 4, `space-2` 8, `space-3` 12, `space-4` 16 (gutter), `space-5` 20 (between groups), `space-6` 24, `space-8` 32, `space-12` 48.
- **Radius:** `radius-sm` 10 (chips, tiles), `radius-md` 14 (buttons, choices), `radius-lg` 20 (cards, lists, sheets), `radius-full`.
- **Retired:** `ledge-*` is always 0 and kept only so older styles resolve.
- **Motion:** quick ease-outs (`--ease-out`), no overshoot (`--ease-spring` is damped). Press means `scale(0.97)`, plus a darker fill or a dim. Keyframes: `gv-shake` (4px, wrong answer), `gv-ring` (soft halo on the current lesson), `gv-pulse` (opacity, while audio plays), `gv-pop`, `gv-fade-up`. All motion is off under reduced motion.

## Components

| Class | Notes and states |
|---|---|
| `.gv-btn` | Filled accent, 50px, radius 14, 17/600. Modifiers: `--block`, `--quiet` (gray), `--tinted`, `--ghost` / `--plain`, `--sm` (34px capsule). States: `:active` scales and goes darker; `:disabled` is the tertiary fill with the secondary label. A tone class recolours it. |
| `.gv-iconbtn` | 44px round, tinted. Modifiers: `--lg` (88px, filled; the listening play button), `--sm` (36px). `.is-playing` pulses the icon. |
| `.gv-choice` | A white cell with a 2px transparent border. States: `.is-selected` (rose border; the key badge fills rose), `.is-correct` (green), `.is-wrong` (amber, small shake), `.is-dim`. Parts: `__key`, `__text`, `__sub`, `__emoji`. Modifier: `--card` (2×2 picture cell). |
| `.gv-tile` | Word-bank tile with a hairline border; `__tr` for transliteration; `.is-used` for a placeholder. |
| `.gv-progress` > `.gv-progress__fill` | 6px, rounded; fill is `--tone` or the accent. |
| `.gv-feedback` (`--wrong`) | Result panel: green tint (amber when wrong). Parts: `__head`, `__badge`, `__title`, `__answer`, `__tr`. A `.gv-btn` inside takes the result colour automatically. |
| `.gv-node` | 64px circle with a progress ring; set `style="--progress: 0.66"`. States: `.is-current` (filled centre plus a soft halo), `.is-locked`. `__stars` > `i(.on)` shows level dots. |
| `.gv-bubble` | Small accent capsule callout. |
| `.gv-stat` (`--streak`, `--xp`, `--muted`) | Header counter with tabular figures. The streak is rose. |
| `.gv-card` | White card, radius 20. |
| `.gv-unit` | Unit header card. Parts: `__eyebrow` (track colour), `__title`, `__desc`, `__motif` (eight-pointed star badge). |
| `.gv-shevitsa` (`--sm`) | Fine embroidery band at 35% opacity. Use only where the principles allow. |
| `.gv-star` | 8px dot, a level or reward indicator. |
| `.gv-trackcard` (`.is-active`) | Track picker cell. Parts: `__icon`, `__title`, `__bg`, `__meta`. |
| `.gv-chips` > `.gv-chip[aria-pressed]` | Capsule filter chips; pressed is filled accent. |
| `.gv-letter` | Letter card. Parts: `__glyph`, `__sound`, `__hint`. Pair it with `.bgstyle-note` (base.css). |
| `.gv-tabbar` > `.gv-tab[aria-current=page]` | Translucent material bar. The active tab is rose; give its icon `filled`. |
| `.gv-key` (`--wide`) | Keyboard keys on a `fill-secondary` tray. |
| `.gv-input` | Text input; the focus ring is rose. |
| `.gv-sheet` > `.gv-sheet__grip` | Material bottom sheet. |
| `.gv-navbar` (`.is-scrolled`) > `.gv-navbar__title`, `__leading`, `__trailing` + `.gv-largetitle` | Large title that hands over to a compact translucent bar. Add `.is-scrolled` once the large title scrolls out of view. |
| `.gv-section` > `.gv-section-header` (+ `__title`, `__action`), `.gv-list`, `.gv-section-footer` | Inset grouped list section. |
| `.gv-list` > `.gv-row` | A row (a button, link or label). Parts: `__icon`, `__body` > `__title` + `__subtitle`, `__accessory`, `__chevron`. A `.gv-ring` can sit first. States: `.is-current` (rose title), `.is-disabled` / `[aria-disabled]`. The separator indents automatically after an icon or ring. |
| `.gv-ring` | SVG progress ring: `viewBox="0 0 36 36"`, `style="--value: 0..100"`, `circle.gv-ring__track` + `circle.gv-ring__value[pathLength=100]` (cx 18, cy 18, r 16). `--lg` is 72px. Wrap it in `.gv-ring-wrap` with `.gv-ring__label` to centre a number. |
| `.gv-segmented` > `button[aria-pressed]` | iOS segmented control; `--block` makes it full width. |
| `.gv-toggle` | `<input type="checkbox" role="switch">` styled as an iOS switch, accent when on. |
| `.gv-statgrid` > `.gv-statcell` | Small stat cells. Parts: `__label`, `__value`, `__unit`. |
| `.gv-badge` (`--accent`) | Count badge. |

**Tones:** `.gv-tone-rose | pick | pine | warn | gold | azbuka | basics | kids | love | home | family | grammar | out` set `--tone`, `--tone-deep`, `--tone-soft`, `--on-tone`, `--tone-ink` and `--tone-text` for anything inside.

## Do and don't

**Do:**
- Put one primary button per screen.
- Put long content in grouped lists.
- Use `ink-muted` for transliteration.
- Show lesson progress as rings or dots, and the streak as a flame and a number.
- Write calm completion copy.

**Don't:**
- Use emoji as decoration.
- Use uppercase labels.
- Add gradients (the app icon is the one exception).
- Add confetti or mascot characters.
- Use coloured fills behind body text.
- Put a red error colour anywhere (amber means "not quite").
