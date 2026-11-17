# Daily Gambit ♟

A playful daily chess trainer for young players. Each day of the week has a short lesson you do right in the app, on a Lichess-style board with Stockfish:

| Day | Lesson | Time |
|---|---|---|
| Monday | **Woodpecker tactics** — a fixed set of 200 puzzles, repeated in rounds that get faster | 30 min |
| Tuesday | **Theoretical endgames** vs Stockfish — key squares, opposition, triangulation, Lucena, Philidor, Vančura | 30 min |
| Wednesday | **Guess the move** — replay a Capablanca or Rubinstein win and guess every move | 30 min |
| Thursday | **Woodpecker speed run** (Monday's puzzles, 1.5× faster) + coordinates quiz | 30 min |
| Friday | **Blindfold tactics** (read aloud) + **threat drills** | 30 min |
| Weekend | **Serious game** vs Stockfish with a clock and "sit on your hands" confirmations, then an engine-free notebook; Stockfish unlocks only after the notebook is filled | 90 min |

Built-in rules: a *circuit break* stops weekday sessions when accuracy falls below 70%, and the *engine delay* rule locks Stockfish until the player has written their own analysis.

Gamified with XP, ranks (Pawn → Grandmaster), streaks, badges and real-world prizes a parent hands over after fully finished sessions. Available in **Slovak, German and English**.

## Run it

```sh
python3 build.py            # creates dist/
cd dist && python3 -m http.server 8765
# open http://localhost:8765
```

`dist/` is a plain static site, so any static host works.

> **Storage:** the app currently saves progress through the claude.ai artifact runtime (`window.claude.use('db')`). Outside claude.ai it falls back to the browser's `localStorage` and shows a "preview mode" banner. An offline, installable version with on-device storage is planned.

## Project layout

```
src/            app source — i18n.js, core.js (data, scoring, storage, board, engine),
                lessons.js (all six lessons), ui.js (screens), index.html, pieces-sprite.svg
public/         static files copied as-is: libraries, Stockfish, puzzle/game data, sounds, css
tools/          scripts that generated the data and checked the endgame positions
tests/          end-to-end browser tests (Playwright + Chrome)
build.py        joins src/ + public/ into dist/
```

## Privacy

This repository contains **no personal data and no secrets**: no player names, no progress, no keys or tokens. Progress is stored on the device or in the app's own storage, never in the code. Please keep it that way in any contribution: no real names, photos, exported progress files or credentials.

## Licence

Daily Gambit is free software under the **GNU General Public License v3.0 or later** (see [LICENSE](LICENSE)), because it combines GPL components (Stockfish, chessground). Third-party parts keep their own licences; see [CREDITS.md](CREDITS.md).
