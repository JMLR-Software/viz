# All-Star Shots 2025-26

Where the 2026 NBA All-Stars shot from during the 2025-26 season. A half-court hex heat map per player (or for the whole pool), by frequency or by efficiency against the All-Star average, with a zone table underneath.

**Status (2026-09-13):** deployed to https://shots.jmlr.dev.

Live: https://shots.jmlr.dev

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

The data under `public/data/` is committed. To refresh it:

```
pnpm data:setup     # once: python3.12 venv + nba_api
pnpm data:fetch     # ~2 minutes, 56 calls to stats.nba.com
```

Only works from a normal machine; the NBA blocks curl and cloud egress. See `scripts/CONTEXT.md`.

## Deploy

```
pnpm run deploy
```

Data: NBA.com/stats via `nba_api`. Not affiliated with the NBA.
