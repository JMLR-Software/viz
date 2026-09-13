# All-Star Shots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a static shot-chart dashboard for the 2026 NBA All-Stars' 2025-26 season at `https://shots.jmlr.dev`.

**Architecture:** A Python script pulls shot data from `stats.nba.com` once and writes committed JSON under `public/data/`. The page is plain TypeScript with D3, bundled by esbuild into `public/js/index.js`. All computation lives in pure, unit-tested modules under `src/web/lib/`; DOM modules only draw. An assets-only Cloudflare Worker serves `public/` on a custom domain. Nothing runs server-side.

**Tech Stack:** TypeScript, D3 v7 (`d3-selection`, `d3-scale`, `d3-scale-chromatic`, `d3-hexbin`, `d3-array`, `d3-format`), esbuild, Vitest, Playwright, pnpm 10, Wrangler 4, Python 3.12 with `nba_api`, pytest.

**Spec:** `docs/superpowers/specs/2026-09-13-allstar-shots-design.md`

## Global Constraints

- Package manager is **pnpm**. Use `pnpm dlx`, never `npx`. Plain `pnpm deploy` is a reserved pnpm command and fails — the script is run as `pnpm run deploy`.
- Node 22, pnpm 10.17.1, Wrangler `^4.131.1`, TypeScript `^7.0.2`, Vitest `^3.2.7`, esbuild `^0.28.2`.
- `compatibility_date` is exactly `"2026-03-10"`. Do not raise it; newer dates are not yet supported by the installed workerd.
- Python is `/opt/homebrew/bin/python3.12`. The system `python3` is 3.9 and must not be used.
- **Immutability:** every function returns new objects and never mutates its inputs.
- **No magic numbers** outside `src/web/config.ts` (TypeScript) or the constants block at the top of `scripts/fetch_shots.py` (Python).
- **Pure math in `src/web/lib/`**, DOM only in `src/web/*.ts`. `lib/` modules must not import `d3-selection` or touch `document`.
- Files stay under 400 lines. Functions stay under 50 lines.
- Coverage thresholds: 80% lines and 80% functions on `src/web/lib/**`.
- `ZONES` order is exactly `["Restricted Area", "In The Paint (Non-RA)", "Mid-Range", "Left Corner 3", "Right Corner 3", "Above the Break 3"]` in both `scripts/fetch_shots.py` and `src/web/config.ts`.
- Court coordinates are tenths of a foot with the hoop at the origin. Never convert to feet.
- The footer text is exactly: `Data: NBA.com/stats via nba_api, pulled <date>. Not affiliated with the NBA.` Do not remove or reword it.
- Never hand-edit anything under `public/data/`; it is generated.
- Commit after every task with a conventional-commit message (`feat:`, `test:`, `chore:`, `docs:`).

---

### Task 1: Toolchain scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `esbuild.mjs`, `wrangler.jsonc`, `src/web/config.ts`
- Test: `src/test/unit/config.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `src/web/config.ts` exporting `ZONES: readonly string[]`, `HEX_RADIUS: number`, `FREQ_PERCENTILE: number`, `DELTA_CLAMP: number`, `RADIUS_FLOOR: number`, `COURT_SVG_WIDTH: number`, `HEADSHOT_URL(id: number): string`, `DATA_BASE: string`. A working `pnpm test`, `pnpm build:web`, `pnpm typecheck`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "allstar-shots",
  "private": true,
  "type": "module",
  "scripts": {
    "build:web": "node esbuild.mjs",
    "dev": "pnpm build:web && wrangler dev --port 8787",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "data:setup": "/opt/homebrew/bin/python3.12 -m venv scripts/.venv && scripts/.venv/bin/pip install -q -r scripts/requirements.txt",
    "data:fetch": "scripts/.venv/bin/python scripts/fetch_shots.py",
    "data:test": "scripts/.venv/bin/python -m pytest scripts -q",
    "deploy": "pnpm test && NODE_ENV=production pnpm build:web && wrangler deploy"
  },
  "packageManager": "pnpm@10.17.1",
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild", "workerd"]
  },
  "dependencies": {
    "d3-array": "^3.2.4",
    "d3-format": "^3.1.0",
    "d3-hexbin": "^0.2.2",
    "d3-scale": "^4.0.2",
    "d3-scale-chromatic": "^3.1.0",
    "d3-selection": "^3.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@types/d3-array": "^3.2.1",
    "@types/d3-format": "^3.0.4",
    "@types/d3-hexbin": "^0.2.5",
    "@types/d3-scale": "^4.0.8",
    "@types/d3-scale-chromatic": "^3.0.3",
    "@types/d3-selection": "^3.0.11",
    "@types/node": "^22.20.2",
    "@vitest/coverage-istanbul": "^3.2.7",
    "esbuild": "^0.28.2",
    "typescript": "^7.0.2",
    "vitest": "^3.2.7",
    "wrangler": "^4.131.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "vitest.config.ts", "esbuild.mjs"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/test/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "istanbul",
      include: ["src/web/lib/**/*.ts"],
      // Spec §10: 80% on the pure math. DOM modules are Playwright's job.
      thresholds: { lines: 80, functions: 80 },
    },
  },
});
```

- [ ] **Step 4: Create `esbuild.mjs`**

```js
import { build } from "esbuild";

await build({
  entryPoints: { index: "src/web/index.ts" },
  bundle: true,
  format: "esm",
  outdir: "public/js",
  // Minify in dev too: public/js is what `wrangler dev` serves, there is no separate dev path.
  minify: true,
  // Sourcemaps are for local debugging only; shipping them doubles the upload.
  sourcemap: process.env.NODE_ENV === "production" ? false : "external",
  target: "es2022",
  logLevel: "info",
});
```

- [ ] **Step 5: Create `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "allstar-shots",
  "compatibility_date": "2026-03-10",
  "assets": { "directory": "./public" },
  "routes": [{ "pattern": "shots.jmlr.dev", "custom_domain": true }],
  "observability": { "enabled": true }
}
```

- [ ] **Step 6: Create `src/web/config.ts`**

```ts
/** Zone names in the order the data pipeline writes them. Must match scripts/fetch_shots.py. */
export const ZONES = [
  "Restricted Area",
  "In The Paint (Non-RA)",
  "Mid-Range",
  "Left Corner 3",
  "Right Corner 3",
  "Above the Break 3",
] as const;

/** Hex grid radius in court units (tenths of a foot). 7.5 ≈ 0.75 ft between centres. */
export const HEX_RADIUS = 7.5;

/** Frequency colour domain caps at this percentile so one hot spot does not wash out the map. */
export const FREQ_PERCENTILE = 0.98;

/** Efficiency colour domain is clamped to ±this, in FG% points as a fraction. */
export const DELTA_CLAMP = 0.15;

/** In efficiency mode a hex never shrinks below this fraction of the grid radius. */
export const RADIUS_FLOOR = 0.35;

/** SVG width the court is drawn at; height follows from the court aspect ratio. */
export const COURT_SVG_WIDTH = 560;

/** Where the committed data files live, relative to the site root. */
export const DATA_BASE = "/data";

/** NBA headshot CDN. Falls back to an initials badge on error. */
export function HEADSHOT_URL(id: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
}
```

- [ ] **Step 7: Write the failing test**

Create `src/test/unit/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DELTA_CLAMP, FREQ_PERCENTILE, HEADSHOT_URL, HEX_RADIUS, RADIUS_FLOOR, ZONES } from "../../web/config.js";

describe("config", () => {
  it("lists the six zones in pipeline order", () => {
    expect([...ZONES]).toEqual([
      "Restricted Area",
      "In The Paint (Non-RA)",
      "Mid-Range",
      "Left Corner 3",
      "Right Corner 3",
      "Above the Break 3",
    ]);
  });

  it("keeps the tuning constants in range", () => {
    expect(HEX_RADIUS).toBeGreaterThan(0);
    expect(FREQ_PERCENTILE).toBeGreaterThan(0.5);
    expect(FREQ_PERCENTILE).toBeLessThanOrEqual(1);
    expect(DELTA_CLAMP).toBeGreaterThan(0);
    expect(RADIUS_FLOOR).toBeGreaterThan(0);
    expect(RADIUS_FLOOR).toBeLessThan(1);
  });

  it("builds a headshot URL from a player id", () => {
    expect(HEADSHOT_URL(203999)).toBe("https://cdn.nba.com/headshots/nba/latest/260x190/203999.png");
  });
});
```

- [ ] **Step 8: Install and run**

Run: `pnpm install && pnpm test && pnpm typecheck`
Expected: 3 tests pass, typecheck clean. (`pnpm build:web` will fail until Task 11 creates `src/web/index.ts`; do not run it yet.)

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts esbuild.mjs wrangler.jsonc src/web/config.ts src/test/unit/config.test.ts
git commit -m "chore: toolchain scaffold and shared constants"
```

---

### Task 2: Data pipeline

**Files:**
- Create: `scripts/roster.json`, `scripts/requirements.txt`, `scripts/fetch_shots.py`, `scripts/test_fetch_shots.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `public/data/index.json`, `public/data/all.json`, `public/data/players/<id>.json` in the shapes below. Every later task reads these shapes.

The shot tuple written to disk is `[x, y, made, zone, distance, period, date]`:
`x` int, `y` int (tenths of a foot, hoop at origin), `made` 0 or 1, `zone` index into `ZONES`, `distance` int feet, `period` int, `date` `"YYYYMMDD"` string.

- [ ] **Step 1: Create `scripts/requirements.txt`**

```
nba_api==1.11.0
pytest==8.4.2
```

- [ ] **Step 2: Create `scripts/roster.json`**

```json
[
  { "id": 203507, "name": "Giannis Antetokounmpo", "conference": "East", "selection": "starter" },
  { "id": 1627759, "name": "Jaylen Brown", "conference": "East", "selection": "starter" },
  { "id": 1628973, "name": "Jalen Brunson", "conference": "East", "selection": "starter" },
  { "id": 1630595, "name": "Cade Cunningham", "conference": "East", "selection": "starter" },
  { "id": 1630178, "name": "Tyrese Maxey", "conference": "East", "selection": "starter" },
  { "id": 1630567, "name": "Scottie Barnes", "conference": "East", "selection": "reserve" },
  { "id": 1631105, "name": "Jalen Duren", "conference": "East", "selection": "reserve" },
  { "id": 1630552, "name": "Jalen Johnson", "conference": "East", "selection": "reserve" },
  { "id": 1628378, "name": "Donovan Mitchell", "conference": "East", "selection": "reserve" },
  { "id": 1626181, "name": "Norman Powell", "conference": "East", "selection": "reserve" },
  { "id": 1627783, "name": "Pascal Siakam", "conference": "East", "selection": "reserve" },
  { "id": 1626157, "name": "Karl-Anthony Towns", "conference": "East", "selection": "reserve" },
  { "id": 1627742, "name": "Brandon Ingram", "conference": "East", "selection": "replacement" },
  { "id": 1628368, "name": "De'Aaron Fox", "conference": "West", "selection": "replacement" },
  { "id": 1628983, "name": "Shai Gilgeous-Alexander", "conference": "West", "selection": "starter" },
  { "id": 201939, "name": "Stephen Curry", "conference": "West", "selection": "starter" },
  { "id": 1629029, "name": "Luka Dončić", "conference": "West", "selection": "starter" },
  { "id": 1641705, "name": "Victor Wembanyama", "conference": "West", "selection": "starter" },
  { "id": 203999, "name": "Nikola Jokić", "conference": "West", "selection": "starter" },
  { "id": 1630166, "name": "Deni Avdija", "conference": "West", "selection": "reserve" },
  { "id": 1626164, "name": "Devin Booker", "conference": "West", "selection": "reserve" },
  { "id": 201142, "name": "Kevin Durant", "conference": "West", "selection": "reserve" },
  { "id": 1630162, "name": "Anthony Edwards", "conference": "West", "selection": "reserve" },
  { "id": 1631096, "name": "Chet Holmgren", "conference": "West", "selection": "reserve" },
  { "id": 2544, "name": "LeBron James", "conference": "West", "selection": "reserve" },
  { "id": 1627750, "name": "Jamal Murray", "conference": "West", "selection": "reserve" },
  { "id": 202695, "name": "Kawhi Leonard", "conference": "West", "selection": "commissioner" },
  { "id": 1630578, "name": "Alperen Şengün", "conference": "West", "selection": "replacement" }
]
```

- [ ] **Step 3: Write the failing tests**

Create `scripts/test_fetch_shots.py`:

```python
import fetch_shots as fs


def row(**kw):
    base = {
        "LOC_X": 47,
        "LOC_Y": 32,
        "SHOT_MADE_FLAG": 1,
        "SHOT_ZONE_BASIC": "In The Paint (Non-RA)",
        "SHOT_DISTANCE": 5,
        "PERIOD": 1,
        "GAME_DATE": "20251023",
    }
    base.update(kw)
    return base


def test_transform_rows_builds_compact_tuples():
    shots, dropped = fs.transform_rows([row()])
    assert dropped == 0
    assert shots == [[47, 32, 1, 1, 5, 1, "20251023"]]


def test_transform_rows_drops_backcourt():
    shots, dropped = fs.transform_rows([row(), row(SHOT_ZONE_BASIC="Backcourt")])
    assert dropped == 1
    assert len(shots) == 1


def test_transform_rows_maps_every_zone_to_its_index():
    rows = [row(SHOT_ZONE_BASIC=z) for z in fs.ZONES]
    shots, dropped = fs.transform_rows(rows)
    assert dropped == 0
    assert [s[3] for s in shots] == list(range(len(fs.ZONES)))


def test_transform_rows_records_a_miss_as_zero():
    shots, _ = fs.transform_rows([row(SHOT_MADE_FLAG=0)])
    assert shots[0][2] == 0


def test_zone_totals_counts_attempts_and_makes_per_zone():
    shots = [
        [0, 0, 1, 0, 1, 1, "20251023"],
        [0, 0, 0, 0, 1, 1, "20251023"],
        [0, 0, 1, 2, 18, 2, "20251023"],
    ]
    totals = fs.zone_totals(shots)
    assert totals[0] == {"fga": 2, "fgm": 1}
    assert totals[2] == {"fga": 1, "fgm": 1}
    assert totals[5] == {"fga": 0, "fgm": 0}


def test_build_index_sorts_players_by_regular_season_attempts():
    players = [
        {"id": 1, "name": "Low", "team": "A", "conference": "East", "selection": "reserve",
         "regular": [[0, 0, 1, 0, 1, 1, "20251023"]], "playoffs": []},
        {"id": 2, "name": "High", "team": "B", "conference": "West", "selection": "starter",
         "regular": [[0, 0, 1, 0, 1, 1, "20251023"], [0, 0, 0, 0, 1, 1, "20251023"]], "playoffs": []},
    ]
    index = fs.build_index(players, dropped=4, generated_at="2026-09-13T00:00:00Z")
    assert [p["name"] for p in index["players"]] == ["High", "Low"]
    assert index["players"][0]["regular"] == {"fga": 2, "fgm": 1}
    assert index["pool"]["regular"]["fga"] == 3
    assert index["pool"]["regular"]["zones"][0] == {"fga": 3, "fgm": 2}
    assert index["droppedBackcourt"] == 4
    assert index["zones"] == fs.ZONES
    assert index["season"] == "2025-26"
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm data:setup && pnpm data:test`
Expected: FAIL with `ModuleNotFoundError: No module named 'fetch_shots'`.

- [ ] **Step 5: Write `scripts/fetch_shots.py`**

```python
"""Pull 2025-26 shot data for the 2026 All-Star pool and write the site's data files.

Runs on a laptop, never on Cloudflare: stats.nba.com blocks curl and cloud egress.
See scripts/CONTEXT.md.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SEASON = "2025-26"
SEASON_TYPES = {"regular": "Regular Season", "playoffs": "Playoffs"}
ZONES = [
    "Restricted Area",
    "In The Paint (Non-RA)",
    "Mid-Range",
    "Left Corner 3",
    "Right Corner 3",
    "Above the Break 3",
]
ZONE_INDEX = {name: i for i, name in enumerate(ZONES)}
SLEEP_SECONDS = 1.0
RETRIES = 3
RETRY_SLEEP_SECONDS = 5.0
REQUEST_TIMEOUT = 30

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
PLAYERS_DIR = DATA_DIR / "players"
ROSTER_PATH = Path(__file__).resolve().parent / "roster.json"


def transform_rows(records):
    """Map raw shotchartdetail records to compact tuples. Returns (shots, dropped_backcourt)."""
    shots = []
    dropped = 0
    for r in records:
        zone = ZONE_INDEX.get(r["SHOT_ZONE_BASIC"])
        if zone is None:
            dropped += 1
            continue
        shots.append([
            int(r["LOC_X"]),
            int(r["LOC_Y"]),
            int(r["SHOT_MADE_FLAG"]),
            zone,
            int(r["SHOT_DISTANCE"]),
            int(r["PERIOD"]),
            str(r["GAME_DATE"]),
        ])
    return shots, dropped


def zone_totals(shots):
    """Attempts and makes per zone, in ZONES order."""
    totals = [{"fga": 0, "fgm": 0} for _ in ZONES]
    for s in shots:
        t = totals[s[3]]
        t["fga"] += 1
        t["fgm"] += s[2]
    return totals


def _totals(shots):
    return {"fga": len(shots), "fgm": sum(s[2] for s in shots)}


def build_index(players, dropped, generated_at):
    """Assemble index.json from per-player shot lists."""
    ordered = sorted(players, key=lambda p: len(p["regular"]), reverse=True)
    pool = {}
    for key in SEASON_TYPES:
        all_shots = [s for p in ordered for s in p[key]]
        pool[key] = {**_totals(all_shots), "zones": zone_totals(all_shots)}
    return {
        "season": SEASON,
        "generatedAt": generated_at,
        "zones": ZONES,
        "players": [
            {
                "id": p["id"],
                "name": p["name"],
                "team": p["team"],
                "conference": p["conference"],
                "selection": p["selection"],
                "regular": _totals(p["regular"]),
                "playoffs": _totals(p["playoffs"]),
            }
            for p in ordered
        ],
        "pool": pool,
        "droppedBackcourt": dropped,
    }


def fetch_player(player_id, season_type):
    """One shotchartdetail call with retries. Returns (records, team_name)."""
    from nba_api.stats.endpoints import shotchartdetail

    last = None
    for attempt in range(1, RETRIES + 1):
        try:
            resp = shotchartdetail.ShotChartDetail(
                player_id=player_id,
                team_id=0,
                season_nullable=SEASON,
                season_type_all_star=season_type,
                context_measure_simple="FGA",
                timeout=REQUEST_TIMEOUT,
            )
            df = resp.get_data_frames()[0]
            records = df.to_dict("records")
            team = str(df["TEAM_NAME"].iloc[-1]) if len(df) else ""
            return records, team
        except Exception as exc:  # noqa: BLE001 - any failure is retried then fatal
            last = exc
            print(f"  attempt {attempt}/{RETRIES} failed: {exc}", file=sys.stderr)
            if attempt < RETRIES:
                time.sleep(RETRY_SLEEP_SECONDS)
    raise SystemExit(f"giving up on player {player_id} ({season_type}): {last}")


def main():
    roster = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
    players = []
    dropped_total = 0

    for i, entry in enumerate(roster, start=1):
        print(f"[{i}/{len(roster)}] {entry['name']}")
        record = {**entry, "team": ""}
        for key, season_type in SEASON_TYPES.items():
            records, team = fetch_player(entry["id"], season_type)
            shots, dropped = transform_rows(records)
            dropped_total += dropped
            record[key] = shots
            if team and not record["team"]:
                record["team"] = team
            print(f"    {season_type}: {len(shots)} shots")
            time.sleep(SLEEP_SECONDS)
        players.append(record)

    PLAYERS_DIR.mkdir(parents=True, exist_ok=True)
    for p in players:
        path = PLAYERS_DIR / f"{p['id']}.json"
        path.write_text(
            json.dumps({"id": p["id"], "regular": p["regular"], "playoffs": p["playoffs"]}, separators=(",", ":")),
            encoding="utf-8",
        )

    combined = {
        "id": "all",
        "regular": [s for p in players for s in p["regular"]],
        "playoffs": [s for p in players for s in p["playoffs"]],
    }
    (DATA_DIR / "all.json").write_text(json.dumps(combined, separators=(",", ":")), encoding="utf-8")

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index = build_index(players, dropped_total, generated_at)
    (DATA_DIR / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"wrote {len(players)} players, {combined and len(combined['regular'])} regular-season shots, {dropped_total} backcourt dropped")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm data:test`
Expected: 6 tests pass.

- [ ] **Step 7: Fetch the real data**

Run: `pnpm data:fetch`
Expected: about two minutes, one line per player, then a summary. If the NBA blocks the run from this environment, stop and report BLOCKED — the controller runs the fetch outside the sandbox and commits the data.

Verify afterwards:

```bash
python3 -c "import json;d=json.load(open('public/data/index.json'));print(len(d['players']), d['pool']['regular']['fga'], d['droppedBackcourt'])"
ls public/data/players | wc -l
```
Expected: 28 players, a six-figure-or-high-five-figure pool FGA, 28 files.

- [ ] **Step 8: Commit**

```bash
git add scripts public/data
git commit -m "feat: data pipeline and committed 2025-26 All-Star shot data"
```

---

### Task 3: Court geometry

**Files:**
- Create: `src/web/lib/court.ts`
- Test: `src/test/unit/court.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `COURT` — an object of court constants in tenths of a foot.
  - `COURT_WIDTH = 500`, `COURT_HEIGHT = 470`.
  - `courtToSvg(x: number, y: number, width: number): { x: number; y: number }`
  - `svgHeight(width: number): number`

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/court.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COURT, COURT_HEIGHT, COURT_WIDTH, courtToSvg, svgHeight } from "../../web/lib/court.js";

describe("court geometry", () => {
  it("spans the half court", () => {
    expect(COURT_WIDTH).toBe(2 * COURT.sidelineX);
    expect(COURT_HEIGHT).toBe(COURT.halfCourtY - COURT.baselineY);
  });

  it("keeps the aspect ratio", () => {
    expect(svgHeight(500)).toBeCloseTo(470);
    expect(svgHeight(250)).toBeCloseTo(235);
  });

  it("puts the hoop on the centre line near the bottom", () => {
    const p = courtToSvg(0, 0, 500);
    expect(p.x).toBeCloseTo(250);
    expect(p.y).toBeCloseTo(417.5);
  });

  it("flips y so shots further out are higher on screen", () => {
    const near = courtToSvg(0, 50, 500);
    const far = courtToSvg(0, 250, 500);
    expect(far.y).toBeLessThan(near.y);
  });

  it("maps the corners of the half court to the SVG corners", () => {
    expect(courtToSvg(-COURT.sidelineX, COURT.halfCourtY, 500)).toEqual({ x: 0, y: 0 });
    const bottomRight = courtToSvg(COURT.sidelineX, COURT.baselineY, 500);
    expect(bottomRight.x).toBeCloseTo(500);
    expect(bottomRight.y).toBeCloseTo(470);
  });

  it("scales with the requested width", () => {
    const half = courtToSvg(100, 100, 250);
    const full = courtToSvg(100, 100, 500);
    expect(half.x).toBeCloseTo(full.x / 2);
    expect(half.y).toBeCloseTo(full.y / 2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/test/unit/court.test.ts`
Expected: FAIL, cannot resolve `../../web/lib/court.js`.

- [ ] **Step 3: Write `src/web/lib/court.ts`**

```ts
/**
 * Court geometry in tenths of a foot, hoop at the origin, y increasing away from the baseline.
 * These are the NBA's published dimensions in the same units stats.nba.com reports shots in.
 */
export const COURT = {
  baselineY: -52.5,
  backboardY: -12.5,
  rimRadius: 7.5,
  restrictedRadius: 40,
  laneHalfWidth: 80,
  freeThrowY: 137.5,
  freeThrowRadius: 60,
  cornerThreeX: 220,
  cornerThreeY: 89.5,
  threeRadius: 237.5,
  halfCourtY: 417.5,
  centerCircleRadius: 60,
  sidelineX: 250,
} as const;

export const COURT_WIDTH = 2 * COURT.sidelineX;
export const COURT_HEIGHT = COURT.halfCourtY - COURT.baselineY;

/** SVG height that preserves the court's aspect ratio at the given width. */
export function svgHeight(width: number): number {
  return (width * COURT_HEIGHT) / COURT_WIDTH;
}

/** Court point to SVG point: origin moves to the left/top edge and y flips. */
export function courtToSvg(x: number, y: number, width: number): { x: number; y: number } {
  const scale = width / COURT_WIDTH;
  return {
    x: (x + COURT.sidelineX) * scale,
    y: (COURT.halfCourtY - y) * scale,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/test/unit/court.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/web/lib/court.ts src/test/unit/court.test.ts
git commit -m "feat: court geometry and SVG projection"
```

---

### Task 4: Data types, decoding, and filtering

**Files:**
- Create: `src/web/lib/data.ts`, `src/web/lib/filter.ts`
- Test: `src/test/unit/data.test.ts`, `src/test/unit/filter.test.ts`

**Interfaces:**
- Consumes: `ZONES` from `src/web/config.ts`; the file shapes from Task 2.
- Produces:
  - `type SeasonType = "regular" | "playoffs"`
  - `type ResultFilter = "all" | "made" | "missed"`
  - `type ShotTuple = [number, number, number, number, number, number, string]`
  - `interface Shot { x, y, made: boolean, zone: number, distance: number, period: number, date: string }`
  - `interface Totals { fga: number; fgm: number }`
  - `interface PoolTotals extends Totals { zones: Totals[] }`
  - `interface PlayerEntry { id: number; name: string; team: string; conference: string; selection: string; regular: Totals; playoffs: Totals }`
  - `interface IndexFile { season: string; generatedAt: string; zones: string[]; players: PlayerEntry[]; pool: Record<SeasonType, PoolTotals>; droppedBackcourt: number }`
  - `interface ShotsFile { id: number | "all"; regular: ShotTuple[]; playoffs: ShotTuple[] }`
  - `decodeShots(rows: ShotTuple[]): Shot[]`
  - `zonePercentages(zones: Totals[]): number[]`
  - `pct(totals: Totals): number | null`
  - `filterShots(shots: Shot[], result: ResultFilter): Shot[]`

- [ ] **Step 1: Write the failing tests**

Create `src/test/unit/data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeShots, pct, zonePercentages } from "../../web/lib/data.js";
import type { ShotTuple } from "../../web/lib/data.js";

const rows: ShotTuple[] = [
  [47, 32, 1, 1, 5, 1, "20251023"],
  [-220, 90, 0, 3, 22, 3, "20251025"],
];

describe("decodeShots", () => {
  it("turns tuples into named fields", () => {
    expect(decodeShots(rows)[0]).toEqual({
      x: 47, y: 32, made: true, zone: 1, distance: 5, period: 1, date: "20251023",
    });
  });

  it("reads 0 as a miss", () => {
    expect(decodeShots(rows)[1].made).toBe(false);
  });

  it("does not mutate its input", () => {
    const copy = rows.map((r) => [...r]);
    decodeShots(rows);
    expect(rows).toEqual(copy);
  });
});

describe("pct", () => {
  it("divides makes by attempts", () => {
    expect(pct({ fga: 4, fgm: 1 })).toBe(0.25);
  });

  it("is null with no attempts", () => {
    expect(pct({ fga: 0, fgm: 0 })).toBeNull();
  });
});

describe("zonePercentages", () => {
  it("returns one percentage per zone, zero where nobody shot", () => {
    expect(zonePercentages([{ fga: 2, fgm: 1 }, { fga: 0, fgm: 0 }])).toEqual([0.5, 0]);
  });
});
```

Create `src/test/unit/filter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filterShots } from "../../web/lib/filter.js";
import type { Shot } from "../../web/lib/data.js";

const shots: Shot[] = [
  { x: 0, y: 10, made: true, zone: 0, distance: 1, period: 1, date: "20251023" },
  { x: 5, y: 20, made: false, zone: 0, distance: 2, period: 1, date: "20251023" },
];

describe("filterShots", () => {
  it("returns everything for all", () => {
    expect(filterShots(shots, "all")).toHaveLength(2);
  });

  it("keeps only makes", () => {
    expect(filterShots(shots, "made").every((s) => s.made)).toBe(true);
    expect(filterShots(shots, "made")).toHaveLength(1);
  });

  it("keeps only misses", () => {
    expect(filterShots(shots, "missed")).toEqual([shots[1]]);
  });

  it("returns a new array", () => {
    expect(filterShots(shots, "all")).not.toBe(shots);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/test/unit/data.test.ts src/test/unit/filter.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/web/lib/data.ts`**

```ts
export type SeasonType = "regular" | "playoffs";
export type ResultFilter = "all" | "made" | "missed";

/** [x, y, made, zone, distance, period, date] as written by scripts/fetch_shots.py. */
export type ShotTuple = [number, number, number, number, number, number, string];

export interface Shot {
  x: number;
  y: number;
  made: boolean;
  zone: number;
  distance: number;
  period: number;
  date: string;
}

export interface Totals {
  fga: number;
  fgm: number;
}

export interface PoolTotals extends Totals {
  zones: Totals[];
}

export interface PlayerEntry {
  id: number;
  name: string;
  team: string;
  conference: string;
  selection: string;
  regular: Totals;
  playoffs: Totals;
}

export interface IndexFile {
  season: string;
  generatedAt: string;
  zones: string[];
  players: PlayerEntry[];
  pool: Record<SeasonType, PoolTotals>;
  droppedBackcourt: number;
}

export interface ShotsFile {
  id: number | "all";
  regular: ShotTuple[];
  playoffs: ShotTuple[];
}

export function decodeShots(rows: ShotTuple[]): Shot[] {
  return rows.map(([x, y, made, zone, distance, period, date]) => ({
    x, y, made: made === 1, zone, distance, period, date,
  }));
}

/** Shooting percentage, or null when nobody attempted. */
export function pct(totals: Totals): number | null {
  return totals.fga === 0 ? null : totals.fgm / totals.fga;
}

/** One percentage per zone; zones with no attempts read 0 so they never skew a delta. */
export function zonePercentages(zones: Totals[]): number[] {
  return zones.map((z) => (z.fga === 0 ? 0 : z.fgm / z.fga));
}
```

- [ ] **Step 4: Write `src/web/lib/filter.ts`**

```ts
import type { ResultFilter, Shot } from "./data.js";

export function filterShots(shots: Shot[], result: ResultFilter): Shot[] {
  if (result === "all") return [...shots];
  const want = result === "made";
  return shots.filter((s) => s.made === want);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/test/unit/data.test.ts src/test/unit/filter.test.ts`
Expected: 10 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/web/lib/data.ts src/web/lib/filter.ts src/test/unit/data.test.ts src/test/unit/filter.test.ts
git commit -m "feat: shot data types, decoding, and the result filter"
```

---

### Task 5: Hex binning

**Files:**
- Create: `src/web/lib/hexes.ts`
- Test: `src/test/unit/hexes.test.ts`

**Interfaces:**
- Consumes: `Shot` from `src/web/lib/data.ts`.
- Produces:
  - `interface HexBin { x: number; y: number; count: number; made: number; expected: number }`
  - `binShots(shots: Shot[], radius: number, poolZonePct: number[]): HexBin[]`
  - `deltaFor(bin: HexBin): number`
  - `maxCount(bins: HexBin[]): number`

`expected` is the sum over the bin's shots of the pool's FG% in that shot's zone, so `deltaFor` is the bin's FG% minus what the pool shoots from the same mix of zones.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/hexes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { binShots, deltaFor, maxCount } from "../../web/lib/hexes.js";
import type { Shot } from "../../web/lib/data.js";

function shot(x: number, y: number, made: boolean, zone = 0): Shot {
  return { x, y, made, zone, distance: 1, period: 1, date: "20251023" };
}

const poolPct = [0.6, 0.45, 0.4, 0.38, 0.38, 0.36];

describe("binShots", () => {
  it("puts shots at the same spot in one bin", () => {
    const bins = binShots([shot(0, 0, true), shot(0, 0, false)], 10, poolPct);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(2);
    expect(bins[0].made).toBe(1);
  });

  it("separates shots further apart than the radius", () => {
    const bins = binShots([shot(0, 0, true), shot(200, 200, true)], 10, poolPct);
    expect(bins).toHaveLength(2);
  });

  it("sums the pool percentage for each shot's zone into expected", () => {
    const bins = binShots([shot(0, 0, true, 0), shot(0, 0, true, 2)], 10, poolPct);
    expect(bins[0].expected).toBeCloseTo(0.6 + 0.4);
  });

  it("returns bins positioned in court units", () => {
    const bins = binShots([shot(120, 90, true)], 10, poolPct);
    expect(bins[0].x).toBeGreaterThan(100);
    expect(bins[0].x).toBeLessThan(140);
    expect(bins[0].y).toBeGreaterThan(70);
    expect(bins[0].y).toBeLessThan(110);
  });

  it("returns nothing for no shots", () => {
    expect(binShots([], 10, poolPct)).toEqual([]);
  });

  it("does not mutate its input", () => {
    const shots = [shot(0, 0, true)];
    const copy = structuredClone(shots);
    binShots(shots, 10, poolPct);
    expect(shots).toEqual(copy);
  });
});

describe("deltaFor", () => {
  it("is the bin's FG% minus the pool's expectation", () => {
    expect(deltaFor({ x: 0, y: 0, count: 2, made: 2, expected: 1.2 })).toBeCloseTo(0.4);
  });

  it("is zero for an empty bin", () => {
    expect(deltaFor({ x: 0, y: 0, count: 0, made: 0, expected: 0 })).toBe(0);
  });
});

describe("maxCount", () => {
  it("finds the busiest bin", () => {
    expect(maxCount([
      { x: 0, y: 0, count: 3, made: 1, expected: 1 },
      { x: 1, y: 1, count: 9, made: 4, expected: 3 },
    ])).toBe(9);
  });

  it("is zero with no bins", () => {
    expect(maxCount([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/test/unit/hexes.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/web/lib/hexes.ts`**

```ts
import { hexbin as d3Hexbin } from "d3-hexbin";
import type { Shot } from "./data.js";

export interface HexBin {
  /** Bin centre in court units. */
  x: number;
  y: number;
  count: number;
  made: number;
  /** Sum of the pool's FG% for each shot's zone — what an average All-Star would make here. */
  expected: number;
}

/** Group shots onto a hex grid of the given radius, in court units. */
export function binShots(shots: Shot[], radius: number, poolZonePct: number[]): HexBin[] {
  if (shots.length === 0) return [];
  const layout = d3Hexbin<Shot>()
    .x((s) => s.x)
    .y((s) => s.y)
    .radius(radius);
  return layout(shots).map((bin) => ({
    x: bin.x,
    y: bin.y,
    count: bin.length,
    made: bin.reduce((n, s) => n + (s.made ? 1 : 0), 0),
    expected: bin.reduce((n, s) => n + (poolZonePct[s.zone] ?? 0), 0),
  }));
}

/** How much better this spot shot than the pool shoots from the same zones. */
export function deltaFor(bin: HexBin): number {
  if (bin.count === 0) return 0;
  return (bin.made - bin.expected) / bin.count;
}

export function maxCount(bins: HexBin[]): number {
  return bins.reduce((n, b) => Math.max(n, b.count), 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/test/unit/hexes.test.ts`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/web/lib/hexes.ts src/test/unit/hexes.test.ts
git commit -m "feat: hex binning with pool-relative expectation"
```

---

### Task 6: Zone statistics

**Files:**
- Create: `src/web/lib/zones.ts`
- Test: `src/test/unit/zones.test.ts`

**Interfaces:**
- Consumes: `Shot`, `Totals`, `pct` from `src/web/lib/data.ts`.
- Produces:
  - `interface ZoneStat { zone: string; fga: number; fgm: number; pct: number | null; poolPct: number | null; delta: number | null }`
  - `zoneStats(shots: Shot[], poolZones: Totals[], zoneNames: readonly string[]): { rows: ZoneStat[]; total: ZoneStat }`

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/zones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { zoneStats } from "../../web/lib/zones.js";
import type { Shot, Totals } from "../../web/lib/data.js";

const names = ["Restricted Area", "In The Paint (Non-RA)", "Mid-Range"] as const;
const pool: Totals[] = [
  { fga: 100, fgm: 60 },
  { fga: 100, fgm: 45 },
  { fga: 0, fgm: 0 },
];

function shot(zone: number, made: boolean): Shot {
  return { x: 0, y: 0, made, zone, distance: 1, period: 1, date: "20251023" };
}

describe("zoneStats", () => {
  const { rows, total } = zoneStats(
    [shot(0, true), shot(0, true), shot(0, false), shot(1, false)],
    pool,
    names,
  );

  it("returns one row per zone in order", () => {
    expect(rows.map((r) => r.zone)).toEqual([...names]);
  });

  it("counts attempts and makes per zone", () => {
    expect(rows[0]).toMatchObject({ fga: 3, fgm: 2 });
    expect(rows[1]).toMatchObject({ fga: 1, fgm: 0 });
  });

  it("computes the percentage against the pool", () => {
    expect(rows[0].pct).toBeCloseTo(2 / 3);
    expect(rows[0].poolPct).toBeCloseTo(0.6);
    expect(rows[0].delta).toBeCloseTo(2 / 3 - 0.6);
  });

  it("leaves a zone with no attempts null rather than zero", () => {
    expect(rows[2].fga).toBe(0);
    expect(rows[2].pct).toBeNull();
    expect(rows[2].delta).toBeNull();
  });

  it("leaves poolPct null where the pool never shot", () => {
    expect(rows[2].poolPct).toBeNull();
  });

  it("totals every zone", () => {
    expect(total).toMatchObject({ zone: "Total", fga: 4, fgm: 2 });
    expect(total.pct).toBeCloseTo(0.5);
    expect(total.poolPct).toBeCloseTo(105 / 200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/test/unit/zones.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/web/lib/zones.ts`**

```ts
import { pct } from "./data.js";
import type { Shot, Totals } from "./data.js";

export interface ZoneStat {
  zone: string;
  fga: number;
  fgm: number;
  pct: number | null;
  poolPct: number | null;
  delta: number | null;
}

function stat(zone: string, mine: Totals, pool: Totals): ZoneStat {
  const minePct = pct(mine);
  const poolPct = pct(pool);
  return {
    zone,
    fga: mine.fga,
    fgm: mine.fgm,
    pct: minePct,
    poolPct,
    delta: minePct === null || poolPct === null ? null : minePct - poolPct,
  };
}

/** Per-zone attempts, makes, and the gap against the pool, plus a totals row. */
export function zoneStats(
  shots: Shot[],
  poolZones: Totals[],
  zoneNames: readonly string[],
): { rows: ZoneStat[]; total: ZoneStat } {
  const mine: Totals[] = zoneNames.map(() => ({ fga: 0, fgm: 0 }));
  for (const s of shots) {
    const t = mine[s.zone];
    if (!t) continue;
    t.fga += 1;
    t.fgm += s.made ? 1 : 0;
  }

  const rows = zoneNames.map((name, i) =>
    stat(name, mine[i], poolZones[i] ?? { fga: 0, fgm: 0 }),
  );

  const sum = (totals: Totals[]): Totals => ({
    fga: totals.reduce((n, t) => n + t.fga, 0),
    fgm: totals.reduce((n, t) => n + t.fgm, 0),
  });

  return { rows, total: stat("Total", sum(mine), sum(poolZones)) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/test/unit/zones.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/web/lib/zones.ts src/test/unit/zones.test.ts
git commit -m "feat: per-zone statistics against the pool average"
```

---

### Task 7: Colour and radius scales

**Files:**
- Create: `src/web/lib/scales.ts`
- Test: `src/test/unit/scales.test.ts`

**Interfaces:**
- Consumes: `HexBin`, `deltaFor` from `src/web/lib/hexes.ts`.
- Produces:
  - `frequencyCap(bins: HexBin[], percentile: number): number`
  - `frequencyColor(count: number, cap: number): string`
  - `clampDelta(delta: number, limit: number): number`
  - `efficiencyColor(delta: number, limit: number): string`
  - `hexRadius(count: number, cap: number, gridRadius: number, floor: number): number`

Frequency colour runs on `sqrt(count)` against `sqrt(cap)` through `interpolateYlOrRd`. Efficiency colour runs on the clamped delta through `interpolateRdBu` reversed, so red is above average and blue is below.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/scales.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clampDelta, efficiencyColor, frequencyCap, frequencyColor, hexRadius } from "../../web/lib/scales.js";
import type { HexBin } from "../../web/lib/hexes.js";

function bin(count: number): HexBin {
  return { x: 0, y: 0, count, made: 0, expected: 0 };
}

describe("frequencyCap", () => {
  it("caps below the single busiest bin", () => {
    const bins = [...Array(99).fill(0).map(() => bin(1)), bin(500)];
    const cap = frequencyCap(bins, 0.98);
    expect(cap).toBeLessThan(500);
    expect(cap).toBeGreaterThanOrEqual(1);
  });

  it("is at least 1 so the scale never collapses", () => {
    expect(frequencyCap([], 0.98)).toBe(1);
  });
});

describe("frequencyColor", () => {
  it("returns a colour string", () => {
    expect(frequencyColor(3, 10)).toMatch(/^(#|rgb)/);
  });

  it("gives different colours to rare and common spots", () => {
    expect(frequencyColor(1, 100)).not.toBe(frequencyColor(100, 100));
  });

  it("does not break past the cap", () => {
    expect(frequencyColor(500, 10)).toMatch(/^(#|rgb)/);
  });
});

describe("clampDelta", () => {
  it("passes values inside the limit through", () => {
    expect(clampDelta(0.05, 0.15)).toBeCloseTo(0.05);
  });

  it("clamps both directions", () => {
    expect(clampDelta(0.9, 0.15)).toBeCloseTo(0.15);
    expect(clampDelta(-0.9, 0.15)).toBeCloseTo(-0.15);
  });
});

describe("efficiencyColor", () => {
  it("gives opposite ends to hot and cold", () => {
    expect(efficiencyColor(0.15, 0.15)).not.toBe(efficiencyColor(-0.15, 0.15));
  });

  it("returns a colour string", () => {
    expect(efficiencyColor(0, 0.15)).toMatch(/^(#|rgb)/);
  });
});

describe("hexRadius", () => {
  it("gives the full grid radius to the busiest bin", () => {
    expect(hexRadius(100, 100, 8, 0.35)).toBeCloseTo(8);
  });

  it("never shrinks below the floor", () => {
    expect(hexRadius(1, 10_000, 8, 0.35)).toBeCloseTo(8 * 0.35);
  });

  it("grows with count", () => {
    expect(hexRadius(50, 100, 8, 0.35)).toBeGreaterThan(hexRadius(5, 100, 8, 0.35));
  });

  it("does not exceed the grid radius past the cap", () => {
    expect(hexRadius(500, 100, 8, 0.35)).toBeCloseTo(8);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/test/unit/scales.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/web/lib/scales.ts`**

```ts
import { quantile } from "d3-array";
import { interpolateRdBu, interpolateYlOrRd } from "d3-scale-chromatic";
import type { HexBin } from "./hexes.js";

/**
 * The count the frequency scale treats as "as hot as it gets". Using a high percentile
 * instead of the maximum stops one restricted-area bin from flattening everything else.
 */
export function frequencyCap(bins: HexBin[], percentile: number): number {
  if (bins.length === 0) return 1;
  const counts = bins.map((b) => b.count).sort((a, b) => a - b);
  return Math.max(1, quantile(counts, percentile) ?? 1);
}

export function frequencyColor(count: number, cap: number): string {
  const t = Math.min(1, Math.sqrt(count) / Math.sqrt(Math.max(1, cap)));
  return interpolateYlOrRd(t);
}

export function clampDelta(delta: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, delta));
}

/** Red above the pool average, blue below — RdBu reversed. */
export function efficiencyColor(delta: number, limit: number): string {
  const t = (clampDelta(delta, limit) + limit) / (2 * limit);
  return interpolateRdBu(1 - t);
}

/** In efficiency mode, size carries volume: area grows with count, never below the floor. */
export function hexRadius(count: number, cap: number, gridRadius: number, floor: number): number {
  const t = Math.min(1, Math.sqrt(count) / Math.sqrt(Math.max(1, cap)));
  return gridRadius * (floor + (1 - floor) * t);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/test/unit/scales.test.ts`
Expected: 11 tests pass.

- [ ] **Step 5: Check coverage**

Run: `pnpm test:coverage`
Expected: all tests pass and the 80% thresholds on `src/web/lib/**` are met.

- [ ] **Step 6: Commit**

```bash
git add src/web/lib/scales.ts src/test/unit/scales.test.ts
git commit -m "feat: frequency and efficiency colour scales"
```

---

### Task 8: The ZONES contract test

**Files:**
- Create: `src/test/unit/contract.test.ts`

**Interfaces:**
- Consumes: `ZONES` from `src/web/config.ts`, `public/data/index.json` from Task 2.
- Produces: nothing importable; a guard that the pipeline and the frontend agree.

- [ ] **Step 1: Write the test**

Create `src/test/unit/contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZONES } from "../../web/config.js";
import type { IndexFile } from "../../web/lib/data.js";

const index = JSON.parse(readFileSync("public/data/index.json", "utf8")) as IndexFile;

describe("the data contract", () => {
  it("agrees with the pipeline on the zone list and its order", () => {
    expect(index.zones).toEqual([...ZONES]);
  });

  it("carries the whole All-Star pool", () => {
    expect(index.players).toHaveLength(28);
  });

  it("carries pool totals for both season types", () => {
    expect(index.pool.regular.zones).toHaveLength(ZONES.length);
    expect(index.pool.playoffs.zones).toHaveLength(ZONES.length);
    expect(index.pool.regular.fga).toBeGreaterThan(0);
  });

  it("sorts players by regular-season attempts", () => {
    const fga = index.players.map((p) => p.regular.fga);
    expect([...fga].sort((a, b) => b - a)).toEqual(fga);
  });

  it("names the season it covers", () => {
    expect(index.season).toBe("2025-26");
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/test/unit/contract.test.ts`
Expected: 5 tests pass against the committed data.

- [ ] **Step 3: Commit**

```bash
git add src/test/unit/contract.test.ts
git commit -m "test: pin the zone contract between the pipeline and the page"
```

---

### Task 9: Page shell and court drawing

**Files:**
- Create: `public/index.html`, `public/style.css`, `src/web/court.ts`

**Interfaces:**
- Consumes: `COURT`, `courtToSvg`, `svgHeight`, `COURT_WIDTH`, `COURT_HEIGHT` from `src/web/lib/court.ts`.
- Produces: `drawCourt(svg: SVGSVGElement, width: number): void` — sets the viewBox and appends a `<g class="court">` of white lines. Idempotent: calling it twice leaves one court group.
- Produces the DOM contract every later task selects against:
  - `#players` (the player rail `<ul>`), `#court` (the `<svg>`), `#zones` (the `<table>`), `#summary`, `#legend`, `#tooltip`, `#empty`, `#error`
  - controls `#season` (`<select>`), `#mode` (`<select>`), `#result` (`<select>`), `#sort` (`<select>`)

- [ ] **Step 1: Create `public/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>All-Star Shots 2025-26</title>
    <meta name="description" content="Where the 2026 NBA All-Stars shot from during the 2025-26 season." />
    <link rel="stylesheet" href="/style.css" />
    <script type="module" src="/js/index.js"></script>
  </head>
  <body>
    <header>
      <h1>All-Star Shots <span class="season">2025-26</span></h1>
      <label>Season
        <select id="season">
          <option value="regular" selected>Regular Season</option>
          <option value="playoffs">Playoffs</option>
        </select>
      </label>
    </header>

    <main>
      <aside>
        <label class="sort">Sort
          <select id="sort">
            <option value="fga" selected>Attempts</option>
            <option value="pct">FG%</option>
          </select>
        </label>
        <ul id="players"></ul>
      </aside>

      <section class="chart">
        <p id="summary"></p>
        <div class="controls">
          <label>Show
            <select id="mode">
              <option value="frequency" selected>Frequency</option>
              <option value="efficiency">Efficiency vs All-Stars</option>
            </select>
          </label>
          <label>Shots
            <select id="result">
              <option value="all" selected>All</option>
              <option value="made">Made</option>
              <option value="missed">Missed</option>
            </select>
          </label>
        </div>
        <div class="court-wrap">
          <svg id="court" role="img" aria-label="Shot chart"></svg>
          <div id="tooltip" hidden></div>
        </div>
        <p id="legend"></p>
        <p id="empty" hidden></p>
        <p id="error" hidden></p>
        <table id="zones"></table>
      </section>
    </main>

    <footer id="footer"></footer>
  </body>
</html>
```

- [ ] **Step 2: Create `public/style.css`**

```css
:root {
  color-scheme: light dark;
  --bg: #f7f7f8;
  --panel: #ffffff;
  --ink: #16181d;
  --muted: #5f6672;
  --line: #d9dce2;
  --court: #b98a5a;
  --court-line: #ffffff;
  --accent: #c8102e;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #101216;
    --panel: #181b21;
    --ink: #eef0f4;
    --muted: #99a1ae;
    --line: #2b303a;
    --court: #3b3128;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--line);
}

h1 { margin: 0; font-size: 20px; letter-spacing: -0.01em; }
h1 .season { color: var(--muted); font-weight: 400; }

select {
  font: inherit;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: inherit;
}

select:disabled { opacity: 0.5; }

main {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
  padding: 24px;
  align-items: start;
}

aside { position: sticky; top: 24px; }
aside .sort { display: block; margin-bottom: 12px; color: var(--muted); font-size: 13px; }

#players { list-style: none; margin: 0; padding: 0; max-height: 72vh; overflow-y: auto; }

#players li button {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

#players li button:hover { background: var(--panel); }
#players li[aria-selected="true"] button { background: var(--panel); box-shadow: inset 3px 0 0 var(--accent); }
#players li.empty button { opacity: 0.45; }

#players .who { min-width: 0; }
#players .name { display: block; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#players .meta { display: block; color: var(--muted); font-size: 12px; }

#players img, #players .badge {
  width: 40px; height: 30px; object-fit: cover; border-radius: 4px; background: var(--line);
}
#players .badge { display: grid; place-items: center; font-size: 11px; font-weight: 700; color: var(--muted); }

.chart { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 20px; }
#summary { margin: 0 0 12px; font-size: 16px; font-weight: 600; }
.controls { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 12px; color: var(--muted); font-size: 13px; }

.court-wrap { position: relative; max-width: 560px; }
#court { display: block; width: 100%; height: auto; background: var(--court); border-radius: 8px; }
.court line, .court path, .court circle, .court rect { stroke: var(--court-line); fill: none; stroke-width: 2; }
.hex { stroke: rgba(0, 0, 0, 0.25); stroke-width: 0.5; }

#tooltip {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(16, 18, 22, 0.92);
  color: #fff;
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  transform: translate(-50%, -120%);
}

#legend { margin: 12px 0 0; color: var(--muted); font-size: 12px; }
#empty { margin: 12px 0 0; color: var(--muted); }
#error { margin: 12px 0 0; color: var(--accent); }

#zones { width: 100%; margin-top: 16px; border-collapse: collapse; font-size: 13px; }
#zones th, #zones td { padding: 6px 8px; text-align: right; border-bottom: 1px solid var(--line); }
#zones th:first-child, #zones td:first-child { text-align: left; }
#zones tfoot td { font-weight: 700; border-bottom: 0; }
#zones .delta.up { color: #b3261e; }
#zones .delta.down { color: #1a56a8; }

footer { padding: 24px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); }
footer a { color: inherit; }

@media (max-width: 800px) {
  main { grid-template-columns: minmax(0, 1fr); }
  aside { position: static; }
  #players { display: flex; gap: 8px; max-height: none; overflow-x: auto; padding-bottom: 8px; }
  #players li { flex: 0 0 200px; }
}
```

- [ ] **Step 3: Write `src/web/court.ts`**

```ts
import { COURT, COURT_WIDTH, courtToSvg, svgHeight } from "./lib/court.js";

/** Draw the half-court lines. Safe to call repeatedly; the previous court is replaced. */
export function drawCourt(svg: SVGSVGElement, width: number): void {
  const height = svgHeight(width);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.querySelector(".court")?.remove();

  const ns = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(ns, "g");
  g.setAttribute("class", "court");

  const p = (x: number, y: number) => courtToSvg(x, y, width);
  const scale = width / COURT_WIDTH;

  const line = (x1: number, y1: number, x2: number, y2: number) => {
    const a = p(x1, y1);
    const b = p(x2, y2);
    const el = document.createElementNS(ns, "line");
    el.setAttribute("x1", String(a.x));
    el.setAttribute("y1", String(a.y));
    el.setAttribute("x2", String(b.x));
    el.setAttribute("y2", String(b.y));
    g.appendChild(el);
  };

  const circle = (cx: number, cy: number, r: number) => {
    const c = p(cx, cy);
    const el = document.createElementNS(ns, "circle");
    el.setAttribute("cx", String(c.x));
    el.setAttribute("cy", String(c.y));
    el.setAttribute("r", String(r * scale));
    g.appendChild(el);
  };

  /** An arc of the given court radius, swept between two court points above the hoop. */
  const arc = (fromX: number, fromY: number, toX: number, toY: number, r: number) => {
    const a = p(fromX, fromY);
    const b = p(toX, toY);
    const el = document.createElementNS(ns, "path");
    el.setAttribute("d", `M ${a.x} ${a.y} A ${r * scale} ${r * scale} 0 0 1 ${b.x} ${b.y}`);
    g.appendChild(el);
  };

  // Outline: baseline, sidelines, half-court line.
  line(-COURT.sidelineX, COURT.baselineY, COURT.sidelineX, COURT.baselineY);
  line(-COURT.sidelineX, COURT.baselineY, -COURT.sidelineX, COURT.halfCourtY);
  line(COURT.sidelineX, COURT.baselineY, COURT.sidelineX, COURT.halfCourtY);
  line(-COURT.sidelineX, COURT.halfCourtY, COURT.sidelineX, COURT.halfCourtY);
  circle(0, COURT.halfCourtY, COURT.centerCircleRadius);

  // The lane and the free-throw circle.
  line(-COURT.laneHalfWidth, COURT.baselineY, -COURT.laneHalfWidth, COURT.freeThrowY);
  line(COURT.laneHalfWidth, COURT.baselineY, COURT.laneHalfWidth, COURT.freeThrowY);
  line(-COURT.laneHalfWidth, COURT.freeThrowY, COURT.laneHalfWidth, COURT.freeThrowY);
  circle(0, COURT.freeThrowY, COURT.freeThrowRadius);

  // Rim, backboard, restricted area.
  circle(0, 0, COURT.rimRadius);
  line(-30, COURT.backboardY, 30, COURT.backboardY);
  arc(-COURT.restrictedRadius, 0, COURT.restrictedRadius, 0, COURT.restrictedRadius);

  // Three-point line: two corners and the arc between them.
  line(-COURT.cornerThreeX, COURT.baselineY, -COURT.cornerThreeX, COURT.cornerThreeY);
  line(COURT.cornerThreeX, COURT.baselineY, COURT.cornerThreeX, COURT.cornerThreeY);
  arc(-COURT.cornerThreeX, COURT.cornerThreeY, COURT.cornerThreeX, COURT.cornerThreeY, COURT.threeRadius);

  svg.insertBefore(g, svg.firstChild);
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css src/web/court.ts
git commit -m "feat: page shell, stylesheet, and half-court drawing"
```

---

### Task 10: Heat map and tooltip

**Files:**
- Create: `src/web/heatmap.ts`

**Interfaces:**
- Consumes: `HexBin`, `deltaFor`, `maxCount` from `lib/hexes.ts`; the scale helpers from `lib/scales.ts`; `courtToSvg` from `lib/court.ts`; constants from `config.ts`.
- Produces:
  - `type Mode = "frequency" | "efficiency"`
  - `drawHexes(svg: SVGSVGElement, tooltip: HTMLElement, bins: HexBin[], mode: Mode, width: number, gridRadius: number): void` — `gridRadius` is in court units and is scaled internally
  - `legendText(mode: Mode): string`

The hexagon path for radius `r` is the six points at angles 0°, 60°, … in SVG units. Bin centres come from `courtToSvg`; the radius is scaled by `width / COURT_WIDTH`.

- [ ] **Step 1: Write `src/web/heatmap.ts`**

```ts
import { DELTA_CLAMP, FREQ_PERCENTILE, RADIUS_FLOOR } from "./config.js";
import { COURT_WIDTH, courtToSvg } from "./lib/court.js";
import { deltaFor, maxCount } from "./lib/hexes.js";
import type { HexBin } from "./lib/hexes.js";
import { clampDelta, efficiencyColor, frequencyCap, frequencyColor, hexRadius } from "./lib/scales.js";

export type Mode = "frequency" | "efficiency";

const NS = "http://www.w3.org/2000/svg";

/** Pointy-top hexagon centred on the origin, in SVG units. */
function hexPath(r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push(`${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

function percent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function tooltipText(bin: HexBin, mode: Mode): string {
  const made = `${bin.made}/${bin.count}`;
  const fg = bin.count === 0 ? "—" : percent(bin.made / bin.count);
  if (mode === "frequency") {
    return `${bin.count} ${bin.count === 1 ? "shot" : "shots"} · ${made} · ${fg}`;
  }
  const d = deltaFor(bin);
  const sign = d >= 0 ? "+" : "−";
  return `${made} · ${fg}\n${sign}${percent(Math.abs(d))} vs All-Stars from here`;
}

/** Replace the heat map layer with hexagons for these bins. */
export function drawHexes(
  svg: SVGSVGElement,
  tooltip: HTMLElement,
  bins: HexBin[],
  mode: Mode,
  width: number,
  gridRadius: number,
): void {
  svg.querySelector(".hexes")?.remove();
  tooltip.hidden = true;
  if (bins.length === 0) return;

  const radius = gridRadius * (width / COURT_WIDTH);
  const svgH = svg.viewBox.baseVal.height || width;
  const cap = mode === "frequency" ? frequencyCap(bins, FREQ_PERCENTILE) : maxCount(bins);

  const layer = document.createElementNS(NS, "g");
  layer.setAttribute("class", "hexes");

  for (const bin of bins) {
    const centre = courtToSvg(bin.x, bin.y, width);
    const r = mode === "frequency"
      ? radius
      : hexRadius(bin.count, cap, radius, RADIUS_FLOOR);
    const path = document.createElementNS(NS, "path");
    path.setAttribute("class", "hex");
    path.setAttribute("d", hexPath(r));
    path.setAttribute("transform", `translate(${centre.x.toFixed(2)},${centre.y.toFixed(2)})`);
    path.setAttribute(
      "fill",
      mode === "frequency"
        ? frequencyColor(bin.count, cap)
        : efficiencyColor(clampDelta(deltaFor(bin), DELTA_CLAMP), DELTA_CLAMP),
    );
    path.addEventListener("pointerenter", () => {
      tooltip.textContent = tooltipText(bin, mode);
      tooltip.style.left = `${(centre.x / width) * 100}%`;
      tooltip.style.top = `${(centre.y / svgH) * 100}%`;
      tooltip.hidden = false;
    });
    path.addEventListener("pointerleave", () => {
      tooltip.hidden = true;
    });
    layer.appendChild(path);
  }

  svg.appendChild(layer);
}

export function legendText(mode: Mode): string {
  return mode === "frequency"
    ? "Colour is how often this spot was shot from — pale yellow is rare, deep red is a favourite."
    : "Colour is field goal percentage against the All-Star average from the same zones — red is better, blue is worse. Size is volume.";
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/web/heatmap.ts
git commit -m "feat: hexagon heat map with frequency and efficiency modes"
```

---

### Task 11: Player rail and zone table

**Files:**
- Create: `src/web/players.ts`, `src/web/zone-table.ts`

**Interfaces:**
- Consumes: `PlayerEntry`, `SeasonType`, `Totals`, `pct` from `lib/data.ts`; `ZoneStat` from `lib/zones.ts`; `HEADSHOT_URL` from `config.ts`.
- Produces:
  - `type Selection = number | "all"`
  - `type SortKey = "fga" | "pct"`
  - `sortPlayers(players: PlayerEntry[], season: SeasonType, sort: SortKey): PlayerEntry[]`
  - `renderPlayers(list: HTMLUListElement, players: PlayerEntry[], pool: Totals, season: SeasonType, sort: SortKey, selected: Selection, onSelect: (s: Selection) => void): void`
  - `renderZones(table: HTMLTableElement, rows: ZoneStat[], total: ZoneStat): void`

`sortPlayers` puts players with no attempts in the current season type last, regardless of sort key.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/sort-players.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sortPlayers } from "../../web/players.js";
import type { PlayerEntry } from "../../web/lib/data.js";

function player(name: string, fga: number, fgm: number): PlayerEntry {
  return {
    id: name.length, name, team: "T", conference: "West", selection: "starter",
    regular: { fga, fgm }, playoffs: { fga: 0, fgm: 0 },
  };
}

const players = [player("Mid", 100, 50), player("Volume", 300, 120), player("None", 0, 0), player("Efficient", 10, 9)];

describe("sortPlayers", () => {
  it("sorts by attempts", () => {
    expect(sortPlayers(players, "regular", "fga").map((p) => p.name)).toEqual(["Volume", "Mid", "Efficient", "None"]);
  });

  it("sorts by percentage", () => {
    expect(sortPlayers(players, "regular", "pct").map((p) => p.name)).toEqual(["Efficient", "Mid", "Volume", "None"]);
  });

  it("pushes players with no attempts to the end either way", () => {
    expect(sortPlayers(players, "regular", "pct").at(-1)?.name).toBe("None");
    expect(sortPlayers(players, "playoffs", "fga").map((p) => p.name)).toHaveLength(4);
  });

  it("does not mutate its input", () => {
    const before = players.map((p) => p.name);
    sortPlayers(players, "regular", "fga");
    expect(players.map((p) => p.name)).toEqual(before);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/test/unit/sort-players.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/web/players.ts`**

```ts
import { HEADSHOT_URL } from "./config.js";
import { pct } from "./lib/data.js";
import type { PlayerEntry, SeasonType, Totals } from "./lib/data.js";

export type Selection = number | "all";
export type SortKey = "fga" | "pct";

/** Sort by the chosen key for the chosen season type; players with no attempts go last. */
export function sortPlayers(players: PlayerEntry[], season: SeasonType, sort: SortKey): PlayerEntry[] {
  return [...players].sort((a, b) => {
    const ta = a[season];
    const tb = b[season];
    if (ta.fga === 0 || tb.fga === 0) return (tb.fga === 0 ? 0 : 1) - (ta.fga === 0 ? 0 : 1);
    if (sort === "fga") return tb.fga - ta.fga;
    return (pct(tb) ?? 0) - (pct(ta) ?? 0);
  });
}

function totalsLabel(t: Totals): string {
  const p = pct(t);
  return p === null ? "no shots" : `${t.fga.toLocaleString()} FGA · ${(p * 100).toFixed(1)}%`;
}

function initials(name: string): string {
  return name.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
}

function row(
  key: Selection,
  name: string,
  meta: string,
  totals: Totals,
  selected: Selection,
  onSelect: (s: Selection) => void,
  headshot: string | null,
): HTMLLIElement {
  const li = document.createElement("li");
  li.setAttribute("aria-selected", String(key === selected));
  if (totals.fga === 0) li.classList.add("empty");

  const button = document.createElement("button");
  button.type = "button";

  if (headshot) {
    const img = document.createElement("img");
    img.src = headshot;
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("error", () => {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = initials(name);
      img.replaceWith(badge);
    });
    button.appendChild(img);
  } else {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "ALL";
    button.appendChild(badge);
  }

  const who = document.createElement("span");
  who.className = "who";
  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = name;
  const metaEl = document.createElement("span");
  metaEl.className = "meta";
  metaEl.textContent = `${meta}${meta ? " · " : ""}${totalsLabel(totals)}`;
  who.append(nameEl, metaEl);
  button.appendChild(who);

  button.addEventListener("click", () => onSelect(key));
  li.appendChild(button);
  return li;
}

/** Render the rail: the combined entry first, then players in the chosen order. */
export function renderPlayers(
  list: HTMLUListElement,
  players: PlayerEntry[],
  pool: Totals,
  season: SeasonType,
  sort: SortKey,
  selected: Selection,
  onSelect: (s: Selection) => void,
): void {
  list.replaceChildren();
  list.appendChild(row("all", "All All-Stars", "28 players", pool, selected, onSelect, null));
  for (const p of sortPlayers(players, season, sort)) {
    list.appendChild(row(p.id, p.name, p.team, p[season], selected, onSelect, HEADSHOT_URL(p.id)));
  }
}
```

- [ ] **Step 4: Write `src/web/zone-table.ts`**

```ts
import type { ZoneStat } from "./lib/zones.js";

function percentCell(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function deltaCell(cell: HTMLTableCellElement, delta: number | null): void {
  cell.className = "delta";
  if (delta === null) {
    cell.textContent = "—";
    return;
  }
  cell.classList.add(delta >= 0 ? "up" : "down");
  const sign = delta >= 0 ? "+" : "−";
  cell.textContent = `${sign}${(Math.abs(delta) * 100).toFixed(1)}`;
}

function bodyRow(stat: ZoneStat): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const cells = [stat.zone, stat.fga.toLocaleString(), stat.fgm.toLocaleString(), percentCell(stat.pct), percentCell(stat.poolPct)];
  for (const text of cells) {
    const td = document.createElement("td");
    td.textContent = text;
    tr.appendChild(td);
  }
  const delta = document.createElement("td");
  deltaCell(delta, stat.delta);
  tr.appendChild(delta);
  return tr;
}

/** Zone rows plus a totals footer. Always all attempts: FG% needs makes and misses both. */
export function renderZones(table: HTMLTableElement, rows: ZoneStat[], total: ZoneStat): void {
  table.replaceChildren();

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["Zone", "FGA", "FGM", "FG%", "All-Stars", "Diff"]) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  for (const stat of rows) tbody.appendChild(bodyRow(stat));

  const tfoot = document.createElement("tfoot");
  tfoot.appendChild(bodyRow(total));

  table.append(thead, tbody, tfoot);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/test/unit/sort-players.test.ts && pnpm typecheck`
Expected: 4 tests pass, typecheck clean. (`sortPlayers` is pure and lives in a DOM module; the test imports only that function, which node can evaluate because the module's DOM calls are inside function bodies.)

- [ ] **Step 6: Commit**

```bash
git add src/web/players.ts src/web/zone-table.ts src/test/unit/sort-players.test.ts
git commit -m "feat: player rail and zone table rendering"
```

---

### Task 12: Wiring the page together

**Files:**
- Create: `src/web/index.ts`
- Modify: `public/index.html` (no change expected; verify the ids match)

**Interfaces:**
- Consumes: everything from Tasks 3-11.
- Produces: a built `public/js/index.js`. No exports.

Behaviour:
- On load, fetch `/data/index.json`, render the rail, read the URL hash (`#p=<id>` or `#p=all`, default `all`), then load that selection's shots.
- Shots files are cached in a `Map<string, ShotsFile>` so re-selecting is instant.
- Changing season, mode, result, or sort re-renders without refetching.
- Efficiency mode forces `result` to `all` and disables the control; leaving efficiency re-enables it.
- A season type with no shots for the selection shows `#empty` with `No <regular-season|playoff> shots for <name>.` and an empty court; this is not an error.
- A failed fetch shows `#error` with `Couldn't load shots for <name>. Reload to try again.`, clears the hexes, and logs the error. Nothing throws unhandled.
- The footer is written from `index.generatedAt`.

- [ ] **Step 1: Write `src/web/index.ts`**

```ts
import { COURT_SVG_WIDTH, DATA_BASE, HEX_RADIUS, ZONES } from "./config.js";
import { drawCourt } from "./court.js";
import { drawHexes, legendText } from "./heatmap.js";
import type { Mode } from "./heatmap.js";
import { decodeShots, zonePercentages } from "./lib/data.js";
import type { IndexFile, ResultFilter, SeasonType, Shot, ShotsFile, Totals } from "./lib/data.js";
import { filterShots } from "./lib/filter.js";
import { binShots } from "./lib/hexes.js";
import { zoneStats } from "./lib/zones.js";
import { renderPlayers } from "./players.js";
import type { Selection, SortKey } from "./players.js";
import { renderZones } from "./zone-table.js";

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

const playersList = el<HTMLUListElement>("players");
const courtSvg = document.getElementById("court") as SVGSVGElement | null;
const tooltip = el("tooltip");
const summary = el("summary");
const legend = el("legend");
const errorBox = el("error");
const emptyBox = el("empty");
const zonesTable = el<HTMLTableElement>("zones");
const footer = el("footer");
const seasonSelect = el<HTMLSelectElement>("season");
const modeSelect = el<HTMLSelectElement>("mode");
const resultSelect = el<HTMLSelectElement>("result");
const sortSelect = el<HTMLSelectElement>("sort");

interface State {
  index: IndexFile | null;
  selected: Selection;
  season: SeasonType;
  mode: Mode;
  result: ResultFilter;
  sort: SortKey;
}

const state: State = {
  index: null,
  selected: readHash(),
  season: "regular",
  mode: "frequency",
  result: "all",
  sort: "fga",
};

const cache = new Map<string, ShotsFile>();

function readHash(): Selection {
  const match = /[#&]p=([^&]+)/.exec(window.location.hash);
  if (!match) return "all";
  const value = decodeURIComponent(match[1]);
  return value === "all" ? "all" : Number(value) || "all";
}

function writeHash(selection: Selection): void {
  const next = `#p=${selection}`;
  if (window.location.hash !== next) {
    history.replaceState(null, "", next);
  }
}

async function loadShots(selection: Selection): Promise<ShotsFile> {
  const key = String(selection);
  const cached = cache.get(key);
  if (cached) return cached;
  const url = selection === "all" ? `${DATA_BASE}/all.json` : `${DATA_BASE}/players/${selection}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  const file = (await response.json()) as ShotsFile;
  cache.set(key, file);
  return file;
}

function nameFor(selection: Selection): string {
  if (selection === "all") return "All All-Stars";
  return state.index?.players.find((p) => p.id === selection)?.name ?? "this player";
}

function totalsFor(selection: Selection): Totals {
  if (!state.index) return { fga: 0, fgm: 0 };
  if (selection === "all") return state.index.pool[state.season];
  const player = state.index.players.find((p) => p.id === selection);
  return player ? player[state.season] : { fga: 0, fgm: 0 };
}

function seasonWord(): string {
  return state.season === "regular" ? "regular-season" : "playoff";
}

function renderSummary(): void {
  const totals = totalsFor(state.selected);
  const label = seasonWord();
  const team = state.selected === "all"
    ? `${state.index?.players.length ?? 0} players`
    : state.index?.players.find((p) => p.id === state.selected)?.team ?? "";
  const shooting = totals.fga === 0
    ? `no ${label} shots`
    : `${totals.fga.toLocaleString()} FGA · ${((totals.fgm / totals.fga) * 100).toFixed(1)}% FG`;
  summary.textContent = `${nameFor(state.selected)} · ${team} · ${shooting}`;
}

function render(shots: Shot[]): void {
  if (!courtSvg || !state.index) return;

  const pool = state.index.pool[state.season];
  const poolPct = zonePercentages(pool.zones);

  drawCourt(courtSvg, COURT_SVG_WIDTH);

  const visible = state.mode === "efficiency" ? shots : filterShots(shots, state.result);
  drawHexes(courtSvg, tooltip, binShots(visible, HEX_RADIUS, poolPct), state.mode, COURT_SVG_WIDTH, HEX_RADIUS);

  if (shots.length === 0) {
    emptyBox.textContent = `No ${seasonWord()} shots for ${nameFor(state.selected)}.`;
    emptyBox.hidden = false;
  } else {
    emptyBox.hidden = true;
  }

  legend.textContent = legendText(state.mode);
  const { rows, total } = zoneStats(shots, pool.zones, ZONES);
  renderZones(zonesTable, rows, total);
  renderSummary();
}

function renderRail(): void {
  if (!state.index) return;
  renderPlayers(
    playersList,
    state.index.players,
    state.index.pool[state.season],
    state.season,
    state.sort,
    state.selected,
    select,
  );
}

function showError(message: string): void {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function clearError(): void {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

let pending = 0;

async function refresh(): Promise<void> {
  if (!state.index) return;
  const token = ++pending;
  clearError();
  try {
    const file = await loadShots(state.selected);
    if (token !== pending) return;
    render(decodeShots(file[state.season]));
  } catch (error) {
    if (token !== pending) return;
    console.error(error);
    emptyBox.hidden = true;
    if (courtSvg) {
      drawCourt(courtSvg, COURT_SVG_WIDTH);
      drawHexes(courtSvg, tooltip, [], state.mode, COURT_SVG_WIDTH, HEX_RADIUS);
    }
    showError(`Couldn't load shots for ${nameFor(state.selected)}. Reload to try again.`);
  }
}

function select(selection: Selection): void {
  state.selected = selection;
  writeHash(selection);
  renderRail();
  void refresh();
}

function syncResultControl(): void {
  const efficiency = state.mode === "efficiency";
  resultSelect.disabled = efficiency;
  if (efficiency) {
    resultSelect.value = "all";
    state.result = "all";
  }
}

seasonSelect.addEventListener("change", () => {
  state.season = seasonSelect.value as SeasonType;
  renderRail();
  void refresh();
});

modeSelect.addEventListener("change", () => {
  state.mode = modeSelect.value as Mode;
  syncResultControl();
  void refresh();
});

resultSelect.addEventListener("change", () => {
  state.result = resultSelect.value as ResultFilter;
  void refresh();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value as SortKey;
  renderRail();
});

async function start(): Promise<void> {
  try {
    const response = await fetch(`${DATA_BASE}/index.json`);
    if (!response.ok) throw new Error(`index.json -> ${response.status}`);
    state.index = (await response.json()) as IndexFile;
  } catch (error) {
    console.error(error);
    showError("Couldn't load the shot data. Reload to try again.");
    return;
  }

  const date = state.index.generatedAt.slice(0, 10);
  footer.textContent = `Data: NBA.com/stats via nba_api, pulled ${date}. Not affiliated with the NBA.`;

  syncResultControl();
  renderRail();
  await refresh();
}

void start();
```

- [ ] **Step 2: Build and typecheck**

Run: `pnpm typecheck && pnpm build:web`
Expected: clean typecheck, esbuild writes `public/js/index.js`.

- [ ] **Step 3: Look at it**

Run: `pnpm dev`, open `http://localhost:8787`, confirm the court draws, hexagons appear, the rail lists 29 entries, the tooltip follows the pointer, and switching to Efficiency disables the Shots control. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/web/index.ts
git commit -m "feat: wire the dashboard together"
```

---

### Task 13: End-to-end tests

**Files:**
- Create: `playwright.config.ts`, `src/test/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: the running site.
- Produces: `pnpm test:e2e` green.

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "src/test/e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:8787" },
  webServer: {
    command: "pnpm build:web && wrangler dev --port 8787",
    url: "http://localhost:8787/data/index.json",
    // Never reuse a running server: a leftover dev server serves a stale public/js bundle.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

- [ ] **Step 2: Write `src/test/e2e/dashboard.spec.ts`**

```ts
import { expect, test } from "@playwright/test";

test("loads the combined view with hexagons on the court", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#summary")).toContainText("All All-Stars");
  await expect(page.locator("#court .hexes path").first()).toBeVisible();
  await expect(page.locator("#zones tbody tr")).toHaveCount(6);
});

test("selecting a player changes the summary and the hash", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Nikola Jokić/ }).click();
  await expect(page.locator("#summary")).toContainText("Nikola Jokić");
  await expect(page).toHaveURL(/#p=203999/);
});

test("efficiency mode disables the result filter", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#result")).toBeEnabled();
  await page.locator("#mode").selectOption("efficiency");
  await expect(page.locator("#result")).toBeDisabled();
  await expect(page.locator("#legend")).toContainText("All-Star average");
  await page.locator("#mode").selectOption("frequency");
  await expect(page.locator("#result")).toBeEnabled();
});

test("hovering a hexagon shows a tooltip with a percentage", async ({ page }) => {
  await page.goto("/");
  await page.locator("#court .hexes path").first().hover();
  await expect(page.locator("#tooltip")).toBeVisible();
  await expect(page.locator("#tooltip")).toContainText("%");
});

test("a player with no playoff shots shows an empty court, not an error", async ({ page }) => {
  await page.goto("/");
  await page.locator("#season").selectOption("playoffs");
  const empty = page.locator("#players li.empty button").first();
  const count = await page.locator("#players li.empty").count();
  test.skip(count === 0, "every All-Star played in the playoffs");
  await empty.click();
  await expect(page.locator("#empty")).toContainText("No playoff shots for");
  await expect(page.locator("#court .hexes path")).toHaveCount(0);
  await expect(page.locator("#error")).toBeHidden();
});

test("the footer credits the source", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#footer")).toContainText("Not affiliated with the NBA");
});
```

- [ ] **Step 3: Run them**

Run: `pnpm dlx playwright install chromium && pnpm test:e2e`
Expected: 6 tests pass (one may skip).

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts src/test/e2e/dashboard.spec.ts
git commit -m "test: end-to-end dashboard flows"
```

---

### Task 14: Deploy

**Files:**
- Modify: `README.md` (status line)

**Interfaces:**
- Consumes: everything.
- Produces: the site live at `https://shots.jmlr.dev`.

- [ ] **Step 1: Full green run**

Run: `pnpm test:coverage && pnpm typecheck && pnpm test:e2e`
Expected: all green, coverage thresholds met.

- [ ] **Step 2: Deploy**

Run: `pnpm run deploy`
Expected: Wrangler uploads the assets and reports the custom domain `shots.jmlr.dev`. Note the Version ID.

- [ ] **Step 3: Verify the live site**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://shots.jmlr.dev/
curl -s -o /dev/null -w '%{http_code}\n' https://shots.jmlr.dev/data/index.json
curl -s -o /dev/null -w '%{http_code}\n' https://shots.jmlr.dev/js/index.js
```
Expected: 200 for each.

- [ ] **Step 4: Update the README status line**

Change `**Status (2026-09-13):** in development.` to `**Status (2026-09-13):** deployed to https://shots.jmlr.dev.`

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "chore: first deploy to shots.jmlr.dev"
```
