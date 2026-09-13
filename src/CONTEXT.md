# src/ — the frontend and its tests

## What this workspace is for

The dashboard page: loading the committed data, computing hex bins and zone stats, and drawing them with D3. There is no Worker code; the Worker is assets-only and configured in `wrangler.jsonc` at the root.

## Layout

```
src/
├── web/
│   ├── config.ts        every constant: ZONES, hex radius, colour domains, URL templates
│   ├── index.ts         DOM wiring: state, controls, fetch, render calls (no math here)
│   ├── court.ts         draws the half-court lines into an SVG group
│   ├── heatmap.ts       draws hex bins and the tooltip
│   ├── zone-table.ts    renders the zone table
│   ├── players.ts       renders the player rail
│   └── lib/             pure functions, unit-tested
│       ├── court.ts     geometry constants and courtToSvg
│       ├── data.ts      index/shots types and decoding
│       ├── filter.ts    filterShots
│       ├── hexes.ts     binShots, deltaFor
│       ├── zones.ts     zoneStats
│       └── scales.ts    colour and radius scale helpers
└── test/
    ├── unit/            Vitest, one file per lib module
    └── e2e/             Playwright flows
```

## Key workflows

- **Run locally:** `pnpm dev` (builds `public/js/` then `wrangler dev` on :8787).
- **Unit tests:** `pnpm test`; coverage with `pnpm test:coverage` (80% lines and functions on `src/web/lib/**`).
- **E2E:** `pnpm test:e2e` (starts its own `wrangler dev`, never reuses one).
- **Typecheck:** `pnpm typecheck`.
- **Deploy:** `pnpm run deploy` (tests, production build, `wrangler deploy`). Plain `pnpm deploy` is a reserved pnpm command and fails.

## Rules

- New computation goes in `lib/` with a test first; `index.ts` only wires.
- No magic numbers outside `config.ts`.
- The result filter never reaches the zone table; the table always shows all attempts.
- In efficiency mode the result control is forced to "all" and disabled.
- Never throw to the console unhandled; failed fetches render the error state.
