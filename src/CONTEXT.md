# src/ — the frontend and its tests

## What this workspace is for

The showcase pages, the shared shell around them, and the Worker. Each showcase loads its committed data, computes with pure `lib/` functions and draws with D3.

The Worker (`src/worker.ts`, configured in `wrangler.jsonc` with `run_worker_first`) does three things: `redirect.ts` sends `shots.jmlr.dev` to `viz.jmlr.dev/shots` with a 301, `headers.ts` sets the CSP and cache headers on every response (Cloudflare ignores `_headers` when the Worker runs first), and everything else is served from `public/`.

## Layout

```
src/
├── worker.ts, redirect.ts, headers.ts   the Worker main and its two pure helpers
├── web/
│   ├── shell/               registry.ts (the showcase list), mount.ts (header, dropdown, footer), config.ts, lib/rec.ts
│   ├── home/                the / tile grid
│   └── shots/               one folder per page; esbuild builds each index.ts to public/js/pages/<folder>.js
│       ├── config.ts        every constant: ZONES, hex radius, colour domains, URL templates
│       ├── index.ts         DOM wiring: state, controls, fetch, render calls (no math here)
│       ├── court.ts         draws the half-court lines into an SVG group
│       ├── heatmap.ts       draws hex bins and the tooltip
│       ├── zone-table.ts    renders the zone table
│       ├── players.ts       renders the player rail
│       └── lib/             pure functions, unit-tested
│           ├── court.ts     geometry constants and courtToSvg
│           ├── data.ts      index/shots types and decoding
│           ├── filter.ts    filterShots
│           ├── hexes.ts     binShots, deltaFor
│           ├── zones.ts     zoneStats
│           └── scales.ts    colour and radius scale helpers
│   └── tornadoes/           canvas, not SVG: ~73k tracks and ~3k counties redraw every frame
│       ├── config.ts        every constant: field order, map frame, timing, colours, track widths, data budget
│       ├── index.ts         DOM wiring: load, controls (disabled until the data is in), animation loop
│       ├── draw.ts          drawFrame (county heat, state lines, track flashes), countyAt (tap hit-test)
│       └── lib/             pure functions, unit-tested
│           ├── data.ts      TornadoFile type, decodeTracks (points, off-map drops)
│           ├── totals.ts    buildCumulative, countAt, maxFinal
│           ├── timeline.ts  positionAt, yearIndexAt, positionForYearIndex, trackAlpha
│           └── scale.ts     heatScale, trackWidth
└── test/
    ├── unit/<area>/         Vitest, one file per lib module (shell, shots, worker, …)
    └── e2e/                 Playwright flows (shell.spec.ts, shots.spec.ts, tornadoes.spec.ts)
```

## Key workflows

- **Run locally:** `pnpm dev` (builds `public/js/` then `wrangler dev` on :8787).
- **Unit tests:** `pnpm test`; coverage with `pnpm test:coverage` (80% lines and functions on `src/web/*/lib/**`).
- **E2E:** `pnpm test:e2e` (starts its own `wrangler dev`, never reuses one).
- **Typecheck:** `pnpm typecheck`.
- **Add a showcase:** a registry entry in `src/web/shell/registry.ts` (built showcases only), `src/web/<slug>/index.ts` that calls `mountShell("<slug>")`, `public/<slug>/index.html` that links `/viz.css` and has `<header id="viz-header">`, `<footer id="footer">` and `<script type="module" src="/js/pages/<slug>.js" blocking="render">` (a unit test checks the attribute), and data under `public/data/<slug>/` written by `scripts/<slug>/`.
- **Deploy:** `pnpm run deploy` (tests, production build, `wrangler deploy`). Plain `pnpm deploy` is a reserved pnpm command and fails.

## Rules

- New computation goes in `lib/` with a test first; `index.ts` only wires.
- No magic numbers outside `config.ts`.
- The result filter never reaches the zone table; the table always shows all attempts.
- In efficiency mode the result control is forced to "all" and disabled.
- Never throw to the console unhandled; failed fetches render the error state.
