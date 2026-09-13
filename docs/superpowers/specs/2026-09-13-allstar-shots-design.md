# All-Star Shots — design spec

**Date:** 2026-09-13
**Status:** approved in conversation ("go for it"), 2026-09-13
**Reasoning trail:** brainstorm session of 2026-09-13; the data check that decided the approach is recorded in §3

## 1. What it is

A single-page dashboard at `https://shots.jmlr.dev` showing where the 2026 NBA All-Stars shot from during the 2025-26 season. Pick a player (or the whole pool), and a half-court heat map of hexagons shows how often they shot from each spot, or how well they shot from there compared with the rest of the All-Stars. A zone table under the court gives the numbers.

It is a Tableau-style dashboard built in web tech, not a Tableau workbook. Everything is static: the data is pulled once by a script and committed, the page is plain TypeScript and D3, and an assets-only Cloudflare Worker serves it. No database, no cron, no runtime calls to the NBA.

**Not a revenue bet.** A portfolio piece and a data-visualisation exercise. Must not compete with the Fantasy IQ season window (opens 2026-10-20).

## 2. Scope

| In | Out |
|---|---|
| The 28 players in the 2026 All-Star pool (§4) | Any other player, any other season |
| Every field goal attempt, 2025-26 regular season and 2025-26 playoffs | Free throws, All-Star Game shots, preseason |
| Half-court hex-bin heat map, frequency and efficiency modes | Flat scatter of individual shots, shot video, play-by-play |
| Per-player view and a combined "All All-Stars" view | Head-to-head comparison of two players |
| Zone table with pool-average deltas | Period, clutch, home/away, opponent filters |
| Hover tooltip per hexagon | Click-to-drill, annotations, sharing |

## 3. Data source and the check that chose the approach

The source is `stats.nba.com/stats/shotchartdetail`, read through the `nba_api` Python package. Verified 2026-09-12/13 from the builder's machine:

- `curl` with browser headers hangs and returns nothing (HTTP/2 and HTTP/1.1 both time out). The NBA fingerprints clients.
- `nba_api` (Python `requests`) returns data: Jokić 1,132 regular-season attempts, Wembanyama 1,080, Gilgeous-Alexander 285 playoff attempts.
- Coordinates are tenths of a foot with the hoop at the origin: `LOC_X` in roughly −250..250, `LOC_Y` in roughly −50..420 for half-court shots.
- The endpoint also returns league-average FG% by zone as a second result set. It is not used; the pool average is computed from the pool's own shots (§6).

Consequences: the Worker never fetches from the NBA (Cloudflare egress IPs are blocked, and the Worker `fetch` would be fingerprinted like curl). The fetch runs on the builder's machine, and the output is committed.

## 4. Roster

The 2026 All-Star pool, from the Wikipedia page for the 2026 NBA All-Star Game (fetched 2026-09-12): 24 selections, the commissioner's addition of Kawhi Leonard, and three injury replacements (Şengün for Gilgeous-Alexander, Ingram for Curry, Fox for Antetokounmpo). Injured originals stay in the pool because they were selected. NBA player ids were resolved with `nba_api`'s static player table on 2026-09-13.

| Player | NBA id | Conference | How selected |
|---|---|---|---|
| Giannis Antetokounmpo | 203507 | East | starter |
| Jaylen Brown | 1627759 | East | starter |
| Jalen Brunson | 1628973 | East | starter |
| Cade Cunningham | 1630595 | East | starter |
| Tyrese Maxey | 1630178 | East | starter |
| Scottie Barnes | 1630567 | East | reserve |
| Jalen Duren | 1631105 | East | reserve |
| Jalen Johnson | 1630552 | East | reserve |
| Donovan Mitchell | 1628378 | East | reserve |
| Norman Powell | 1626181 | East | reserve |
| Pascal Siakam | 1627783 | East | reserve |
| Karl-Anthony Towns | 1626157 | East | reserve |
| Brandon Ingram | 1627742 | East | replacement |
| De'Aaron Fox | 1628368 | West | replacement |
| Shai Gilgeous-Alexander | 1628983 | West | starter |
| Stephen Curry | 201939 | West | starter |
| Luka Dončić | 1629029 | West | starter |
| Victor Wembanyama | 1641705 | West | starter |
| Nikola Jokić | 203999 | West | starter |
| Deni Avdija | 1630166 | West | reserve |
| Devin Booker | 1626164 | West | reserve |
| Kevin Durant | 201142 | West | reserve |
| Anthony Edwards | 1630162 | West | reserve |
| Chet Holmgren | 1631096 | West | reserve |
| LeBron James | 2544 | West | reserve |
| Jamal Murray | 1627750 | West | reserve |
| Kawhi Leonard | 202695 | West | commissioner |
| Alperen Şengün | 1630578 | West | replacement |

Fox plays for San Antonio, so he is West by team even though he replaced an East starter and played for Team Stripes. Conference is display metadata only and nothing filters on it. Team name comes from the shot data (`TEAM_NAME` of the player's most recent shot), not from this table, so a mid-season trade shows the final team.

The roster lives in `scripts/roster.json` as `[{ "id": 203507, "name": "Giannis Antetokounmpo", "conference": "East", "selection": "starter" }, …]`. It is the only hand-maintained data file.

## 5. Data pipeline (`scripts/`)

Python 3.12 (`/opt/homebrew/bin/python3.12`), a venv at `scripts/.venv` (git-ignored), dependencies pinned in `scripts/requirements.txt`: `nba_api`, `pytest`.

`scripts/fetch_shots.py`:

1. Reads `scripts/roster.json`.
2. For each player and each season type in `["Regular Season", "Playoffs"]`, calls `ShotChartDetail(player_id, team_id=0, season_nullable="2025-26", season_type_all_star=<type>, context_measure_simple="FGA", timeout=30)`. Sleeps 1.0 s between calls. Retries a call up to 3 times with a 5 s pause on any exception; after the third failure it exits non-zero naming the player and season type. No partial output is written on failure.
3. Transforms rows (`transform_rows`, a pure function, tested): drops rows whose `SHOT_ZONE_BASIC` is `Backcourt` (counted, reported in the index), maps each remaining row to a compact array `[x, y, made, zone, distance, period, date]` where `x`,`y` are integers (tenths of a foot), `made` is 0/1, `zone` is the index into `ZONES` below, `distance` is integer feet, `period` is an integer, `date` is `"YYYYMMDD"`.
4. Writes `public/data/players/<id>.json`:
   ```json
   { "id": 203999, "regular": [[47,32,1,1,5,1,"20251023"], …], "playoffs": [ … ] }
   ```
5. Writes `public/data/all.json` with the same shape and `"id": "all"`, the concatenation of every player's shots.
6. Writes `public/data/index.json`:
   ```json
   {
     "season": "2025-26",
     "generatedAt": "2026-09-13T20:00:00Z",
     "zones": ["Restricted Area", "In The Paint (Non-RA)", "Mid-Range", "Left Corner 3", "Right Corner 3", "Above the Break 3"],
     "players": [
       { "id": 203999, "name": "Nikola Jokić", "team": "Denver Nuggets", "conference": "West", "selection": "starter",
         "regular": { "fga": 1132, "fgm": 640 }, "playoffs": { "fga": 210, "fgm": 118 } }, …
     ],
     "pool": {
       "regular": { "fga": 30000, "fgm": 15000, "zones": [{ "fga": 9000, "fgm": 6000 }, …six entries in ZONES order…] },
       "playoffs": { … }
     },
     "droppedBackcourt": 41
   }
   ```
   `players` is sorted by regular-season `fga` descending. `pool.<type>.zones[i]` are the pool totals for zone `i`.

`ZONES` is the fixed list above, in that order, defined once in `scripts/fetch_shots.py` and once in `src/web/config.ts`; a unit test on each side asserts the list against `public/data/index.json`, which is the contract between them.

Headshots are not downloaded. The page hotlinks `https://cdn.nba.com/headshots/nba/latest/260x190/<id>.png` and falls back to an initials badge on image error.

Refreshing the data is `pnpm data:fetch` (runs the script through the venv) and then committing `public/data/`. The season is complete, so the expectation is that this runs once.

## 6. Dashboard computations (`src/web/lib/`, pure functions, unit-tested)

- **Court geometry** (`court.ts`): constants in tenths of a foot, hoop at the origin, y increasing away from the baseline. Baseline y = −52.5; backboard y = −12.5; rim radius 7.5; restricted-area radius 40; lane x = ±80 from the baseline to the free-throw line at y = 137.5; free-throw circle radius 60 centred on (0, 137.5); three-point corner lines at x = ±220 from the baseline to y = 89.5; three-point arc radius 237.5 between those points; half-court line y = 417.5 with a centre circle of radius 60; sidelines x = ±250. `courtToSvg(x, y, width)` scales a court point into an SVG viewport `width` wide (height = width × 470 / 500), y flipped so the hoop is near the bottom.
- **Filtering** (`filter.ts`): `filterShots(shots, { result })` where `result` is `"all" | "made" | "missed"`.
- **Hex aggregation** (`hexes.ts`): `binShots(shots, radius, poolZonePct)` groups shots into hexagons of the given radius (court units) using d3-hexbin's grid, where `poolZonePct` is the pool's FG% per zone in `ZONES` order. Returns `{ x, y, count, made, expected }[]`, where `expected` is Σ over the bin's shots of the pool FG% for that shot's zone. `deltaFor(bin) = (made − expected) / count`, the bin's FG% minus what the pool shoots from the same zones.
- **Zone stats** (`zones.ts`): `zoneStats(shots, poolZones)` returns, per zone in `ZONES` order, `{ zone, fga, fgm, pct, poolPct, delta }`, and a totals row. `pct` is `null` when `fga` is 0.
- **Scales** (`scales.ts`): frequency colour is a sequential scale (d3 `interpolateYlOrRd`) on `sqrt(count)`, domain 0 to the 98th percentile of counts (so one hot spot does not wash out the map). Efficiency colour is a diverging scale (d3 `interpolateRdBu` reversed, so red is above average) on `delta`, domain clamped to ±0.15. In efficiency mode hex radius scales with `sqrt(count)` between 35% and 100% of the grid radius; in frequency mode radius is fixed.

Constants (hex radius 7.5 court units, percentile 0.98, delta clamp 0.15, radius floor 0.35, tooltip debounce, headshot URL template) live in `src/web/config.ts`.

## 7. Page

One page, `public/index.html`, script `public/js/index.js` built by esbuild from `src/web/index.ts`. Layout at desktop widths is a two-column grid; under 800 px the player rail collapses into a horizontal scroller above the court.

**Header.** Title "All-Star Shots 2025-26". Season-type toggle: Regular Season / Playoffs.

**Player rail (left).** "All All-Stars" entry first, then the 28 players: headshot, name, team, and for the current season type FGA and FG%. Sort control: by attempts (default) or by FG%. Players with zero attempts in the current season type render greyed at the bottom and are still selectable (the court then shows "No playoff shots for <name>"). The selected player is reflected in the URL hash (`#p=203999`, `#p=all`) so a view can be linked; on load the hash picks the player.

**Court panel (main).** The half court, hexagons on top, drawn with D3 into an SVG. Controls above the court: mode (Frequency / Efficiency) and result (All / Made / Missed). Result is disabled and forced to All in efficiency mode, because efficiency is made-over-attempted. A legend under the court explains the current colour scale. Hovering a hexagon shows a tooltip: attempts, makes, FG%, and in efficiency mode the delta against the pool ("+6.2% vs All-Stars from this zone"). Summary line above the court: "Nikola Jokić · Denver Nuggets · 1,132 FGA · 56.5% FG".

**Zone table (below the court).** One row per zone plus a total: zone, FGA, FGM, FG%, pool FG%, delta with a sign and a colour matching the efficiency scale. The table always shows all attempts regardless of the result filter, because FG% needs both makes and misses; the result filter only affects the map.

**Footer.** "Data: NBA.com/stats via nba_api, pulled <generatedAt date>. Not affiliated with the NBA." and a link to the repo.

**Loading and errors.** The index loads first; the player list renders from it; the shots file loads on selection and is cached in memory. A failed fetch replaces the court with "Couldn't load shots for <name>. Reload to try again." and logs the error. Nothing throws to the console unhandled.

## 8. Worker and deployment

Assets-only Worker. `wrangler.jsonc`: `name: "allstar-shots"`, `compatibility_date: "2026-03-10"`, `assets: { directory: "./public" }` (no `main`, no bindings), `routes: [{ pattern: "shots.jmlr.dev", custom_domain: true }]`, `observability: { enabled: true }`. The `jmlr.dev` zone is on the same Cloudflare account as Sameboat.

`pnpm run deploy` runs the tests, builds the frontend for production (no sourcemaps), and runs `wrangler deploy`. Data files are committed, so a deploy never touches Python.

## 9. Stack and tooling

- TypeScript, D3 v7 (`d3-selection`, `d3-scale`, `d3-scale-chromatic`, `d3-hexbin`, `d3-array`, `d3-format`), esbuild bundling (`minify: true`, sourcemaps outside production only), no framework.
- pnpm 10, Wrangler 4, Node 22.
- Vitest (plain node environment; no Workers pool, there is no Worker code) with `@vitest/coverage-istanbul`, thresholds 80% lines and functions on `src/web/lib/**`. The DOM-wiring module `src/web/index.ts` and the D3 drawing module are covered by Playwright, not Vitest.
- Playwright with `webServer` running `pnpm build:web && wrangler dev --port 8787`, `reuseExistingServer: false`.
- pytest for `transform_rows` and the index builder in the fetch script, run by `pnpm data:test`.

## 10. Testing

- **Unit (Vitest):** court scaling (hoop maps to the expected SVG point, y flips, aspect ratio held); `filterShots` for the three results; `binShots` on a hand-built shot list (counts, makes, expected, and that two shots at the same spot land in one bin); `deltaFor`; `zoneStats` including the zero-attempt zone and the totals row; the scale domain helpers (percentile cap, delta clamp, radius floor); the `ZONES` contract against `public/data/index.json`.
- **Unit (pytest):** `transform_rows` drops backcourt and produces the compact array with the right zone index; index builder sorts by FGA and sums pool zones.
- **E2E (Playwright), against the committed data:** page loads with "All All-Stars" selected and at least one hexagon drawn; selecting a player changes the summary line and the hash; switching to Playoffs on a player with no playoff shots shows the empty state; switching to Efficiency disables the result control; hovering a hexagon shows a tooltip with a percentage.
- Target 80% coverage on `src/web/lib/**`.

## 11. Not in this version

Other seasons, other players, two-player comparison, per-game or per-period filters, shot-type breakdowns (catch-and-shoot, pull-up), a scatter view, exporting an image, analytics, a share card, dark-mode toggle (the page follows `prefers-color-scheme`).

## 12. Open questions

- Whether NBA headshot hotlinking stays reliable; the initials fallback covers a broken image but not a policy change. Downloading them into the repo is the fallback.
- Whether the combined `all.json` (about 30,000 shots, roughly 1 MB raw, about a third of that gzipped) is acceptable as the default view on mobile. If not, default to the top player and make "All" opt-in.
