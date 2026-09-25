# viz

A small gallery of D3 data visualisations on real public data, made for reels. Pick a showcase from the dropdown; add `?rec` to any URL for a 9:16 recording frame. The first showcase, All-Star Shots (`/shots`), is where the 2026 NBA All-Stars shot from during the 2025-26 season: a half-court hex heat map per player (or for the whole pool), by frequency or by efficiency against the All-Star average, with a zone table underneath.

**Status (2026-09-25):** the gallery shell, All-Star Shots, tornadoes and quakes are live at https://viz.jmlr.dev.

Live: https://viz.jmlr.dev (https://shots.jmlr.dev redirects to `/shots`)

## Run it

```
pnpm install
pnpm dev            # builds the frontend, serves on http://localhost:8787
```

## Tests

```
pnpm test           # Vitest unit tests on the pure math
pnpm test:coverage  # with the 80% threshold
pnpm test:e2e       # Playwright, starts its own wrangler dev
pnpm data:test      # pytest on the fetch script's pure parts
```

## Data

The data under `public/data/shots/` is committed. To refresh it:

```
pnpm data:setup     # once: python3.12 venv + nba_api
pnpm data:fetch:shots  # ~2 minutes, 56 calls to stats.nba.com
```

Only works from a normal machine; the NBA blocks curl and cloud egress. See `scripts/CONTEXT.md`.

## Deploy

```
pnpm run deploy
```

Data: NBA.com/stats via `nba_api`. Not affiliated with the NBA.
