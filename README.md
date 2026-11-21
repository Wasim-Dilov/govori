# Govori · Говори

A personal app for learning Bulgarian in small bursts, built around real family life: sweet words for your wife, what the kids need, the in-laws at the dinner table, and trips to Bulgaria.

It installs on an iPhone like a normal app (from Safari), works offline, keeps all progress on the phone, and costs nothing to run.

## What's inside

- **8 tracks you can focus on for a day or a week:** Alphabet (Азбука), Basics, Kids, Love, Home, Family, Grammar bites and Out and about. A 12-week plan suggests a focus each week.
- **About 750 words and phrases plus all 30 letters,** across 153 lessons. Every lesson has three levels:
  - level 1 recognises
  - level 2 recalls
  - level 3 produces (typing, listening and speaking)
- **47 conversations,** one at the end of every unit, where you pick your own lines.
- **Many ways to learn:** picture cards, listening, matching pairs, building sentences from tiles, typing on a built-in Bulgarian keyboard, speaking with playback, and reading practice for the letters.
- **Spaced repetition:** Review brings back what is due, Fix mistakes retries what you got wrong, and Speed round is a timed matching game.
- **Streaks, XP, learner levels and a daily goal,** plus an evening reminder on your iPhone.
- **Her voice:** your wife can record words on your phone, and Govori plays her recordings instead of the synthetic voice.
- **Statistics:** every answer is logged on the phone, so you can see when and how you learn best. Export it as JSON for deeper analysis.

## Install on iPhone

1. Open https://wasim-dilov.github.io/govori/ in Safari.
2. Tap Share, then **Add to Home Screen**, then **Add**.
3. Open Govori from the new icon.

For the best voice, download the Bulgarian voice on the iPhone: Settings > Accessibility > Spoken Content > Voices > Bulgarian.

## Evening reminders

See [docs/reminders.md](docs/reminders.md). A free scheduled GitHub Action sends one push a day. The app decides what it says: a streak saver if you haven't practised, otherwise a word of the day.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/govori/
npm run validate   # checks all lesson content
npm run build      # tokens, validation, typecheck, production build
```

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Structure

- `src/content/tracks/*.ts`: all lesson content as plain data (schema in `src/content/types.ts`). To add words, edit a track and run `npm run validate`.
- `src/content/plan.ts`: the 12-week plan.
- `src/lib/engine.ts`: builds lessons from content and grades answers (Cyrillic, Latin transliteration, small typos).
- `src/lib/progress.ts`: streaks, XP, levels, spaced repetition and the answer log.
- `src/lib/db.ts`: on-device storage (IndexedDB).
- `src/sw.ts`: offline support and reminder notifications.
- `design/tokens.json`: the design tokens, shared with the Govori design system. `npm run tokens` regenerates `src/styles/tokens.css`.
