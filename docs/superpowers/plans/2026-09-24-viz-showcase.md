# viz.jmlr.dev Showcase Implementation Plan (phases 1–2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn shots.jmlr.dev into viz.jmlr.dev, a dark, reel-ready gallery with a showcase dropdown. This plan ships the shell with shots moved under `/shots` (phase 1) and the "Every US tornado since 1950" canvas showcase (phase 2).

**Architecture:** A multi-page static site. It has one esbuild entry per page folder under `src/web/`, and code splitting puts D3 and the shell in shared hashed chunks. A shared shell (a registry, a header with the dropdown, record mode and a theme) is mounted by every page. A small Worker `main` does the `shots.jmlr.dev` → `viz.jmlr.dev/shots` 301 and serves assets. Because the Worker now runs first, it also sets the cache and security headers that `_headers` used to set. Data is fetched on a laptop by Python and committed under `public/data/<slug>/`.

**Tech Stack:** TypeScript, esbuild, D3 (d3-geo, d3-scale, d3-scale-chromatic, d3-array), topojson-client, canvas 2D, Cloudflare Workers static assets (Wrangler 4), Vitest (with istanbul coverage), Playwright, Python 3.12 and pytest. Use pnpm for everything and never npm or npx.

**Spec:** `docs/superpowers/specs/2026-09-24-viz-showcase-design.md` (read §3, §5, §6.2, §7, §8 and §9 before starting). `docs/superpowers/specs/2026-09-13-allstar-shots-design.md` still governs what shots shows.

## Global Constraints

- **Rule 1:** the data is what the named public source reported. `public/data/` is written only by the scripts under `scripts/` and never hand-edited.
- **Rule 2:** the Worker never calls an outside API. It does the host redirect, sets headers and serves assets.
- **Rules 3–5:** math is pure and tested under a `lib/` folder (80% lines and functions), constants live in each showcase's `config.ts`, and code never mutates its inputs.
- **Rule 6:** every showcase footer credits its source and states no affiliation.
- Slugs are `shots` and `tornadoes`. The others (`quakes`, `flights`, `scoring`) are parked and **must not** appear in the registry, the dropdown or the grid until they are built.
- Dark theme only, with tokens on `:root`. There is no light theme and no toggle.
- `?rec` puts any page in a centred 9:16 frame with larger type, keeps the dropdown visible, shrinks the footer to its one-line credit and autoplays everything. It carries through every link the shell writes.
- `prefers-reduced-motion: reduce` stops autoplay, and the showcase opens paused on its final frame. Record mode overrides this.
- A data load failure shows "Couldn't load the <showcase> data" with a Retry button. It never leaves a blank canvas.
- Fetch scripts exit non-zero with a clear message on a missing column, an empty result or a failed download. They write to a temp file and rename it, so no partial file is ever left behind.
- Each showcase's data stays at about 2 MB or less (see Task 8 for the budget test).
- The Fantasy IQ window opens on **2026-10-20**. This plan is phases 1–2 only. Quakes, the scoring race and flights are parked.
- Outward-facing steps (`wrangler deploy`, `wrangler delete`, `gh repo rename`, merging a code PR) need Josh's explicit go-ahead at the time. They are marked **[Josh]**.

## Review Focus

1. **The Worker drops headers.** With `run_worker_first`, Cloudflare no longer applies `_headers`, so the CSP and cache headers would disappear without anyone noticing. Expected: every response still has the CSP, `/js/chunks/*` and `/data/*` are immutable, and `/js/pages/*` is `no-cache` so a deploy is seen at once. This is pinned in Task 5 (`headers.test.ts` plus a curl step).
2. **`?rec` gets lost on navigation.** A URL that already has a query or a hash, or a hash-only `replaceState` in shots, must not drop `rec`. Expected: `withRec` keeps the existing query and hash, and shots' `#p=` hash writes keep `?rec`. This is pinned in Task 2 (`rec.test.ts`) and Task 3 (e2e: pick a player in rec mode, and `?rec` is still there).
3. **Tornadoes with no end point, or outside Albers USA.** About 26k tracks before 2000 have `elat = 0`, and PR and VI rows have no place on the map. Expected: a tornado with no end point is drawn as a dot at its start, never a line to (0, 0), and rows off the map are dropped and counted, never drawn at the origin and never a crash. This is pinned in Task 7 (Python) and Task 9 (`decodeTracks`).
4. **Multi-state tornadoes counted twice or not at all.** The SPC file has one whole-track row (`sg=1`) plus per-state segment rows (`sn=1, sg=2`). Expected: each tornado draws one track, and each county it touched is counted once. This is pinned in Task 7 with the fixture's MO→IL tornado.
5. **Scrubbing and the EF3+ toggle while playing.** Expected: scrubbing pauses the animation and shows exactly the chosen year, the toggle applies to the heat and to the tracks, and playing resumes from the scrubbed year rather than 1950. This is pinned in Task 9 (`timeline.test.ts`) and Task 10 (e2e).

## Before you start

- Work in a worktree off `origin/main` (superpowers:using-git-worktrees), with a branch `feat/viz-phase-1`, and later `feat/viz-phase-2` off the merged phase 1.
- Run `pnpm install`, then `pnpm data:setup` once if `scripts/.venv` is missing.
- **hq:** phase 1 starting is a "This week" change. Per the hq rule, open `hq/now.md` on hq `origin/main`. If it is not there yet (it was on the unmerged `now-home-page` branch on 2026-09-24), check that branch. Add one line in a small hq PR, e.g. `viz.jmlr.dev: phase 1 (shell, shots under /shots) in progress; tornadoes next; both before 2026-10-20.` This is status-only, so it can be merged without Josh.

## File map

```
src/web/shell/registry.ts        SHOWCASES list + showcaseFor()               (pure, tested)
src/web/shell/lib/rec.ts         isRecording, withRec, shouldAutoplay          (pure, tested)
src/web/shell/config.ts          wordmark, home credit
src/web/shell/mount.ts           mountShell(): header, dropdown, footer, rec class (DOM)
src/web/home/index.ts            the / tile grid (DOM)
src/web/shots/**                 today's src/web/*.ts and src/web/lib/, moved unchanged except paths
src/web/tornadoes/config.ts      every tornado constant
src/web/tornadoes/lib/data.ts    TornadoFile types, decodeTracks                (pure, tested)
src/web/tornadoes/lib/totals.ts  buildCumulative, countAt, maxFinal             (pure, tested)
src/web/tornadoes/lib/timeline.ts positionAt, yearIndexAt, trackAlpha, positionForYearIndex (pure, tested)
src/web/tornadoes/lib/scale.ts   heatScale, trackWidth                          (pure, tested)
src/web/tornadoes/draw.ts        drawFrame, countyAt (canvas)
src/web/tornadoes/index.ts       load, controls, animation loop (DOM)
src/redirect.ts                  redirectTarget()                               (pure, tested)
src/headers.ts                   headersFor()                                   (pure, tested)
src/worker.ts                    Worker main
public/viz.css                   theme tokens, shell, rec frame, view transitions
public/index.html                the grid
public/shots/index.html, shots.css
public/tornadoes/index.html, tornadoes.css
public/data/shots/**             today's public/data/**, moved
public/data/tornadoes/tornadoes.json, counties.json   generated
scripts/shots/fetch_shots.py, test_fetch_shots.py, roster.json   moved
scripts/tornadoes/fetch_tornadoes.py, test_fetch_tornadoes.py, fixtures/sample.csv
src/test/unit/shell/*.test.ts, src/test/unit/shots/*.test.ts, src/test/unit/tornadoes/*.test.ts, src/test/unit/worker/*.test.ts
src/test/e2e/shell.spec.ts, shots.spec.ts (was dashboard.spec.ts), tornadoes.spec.ts
```

---

# Phase 1 — shell

### Task 1: Move shots under `/shots` with a multi-entry build

The goal is to move everything without changing behaviour: every existing unit and e2e test passes at the new paths.

**Files:**
- Move: `src/web/{config,court,heatmap,index,players,zone-table}.ts` → `src/web/shots/`, and `src/web/lib/` → `src/web/shots/lib/`
- Move: `src/test/unit/*.test.ts` → `src/test/unit/shots/`, and `src/test/e2e/dashboard.spec.ts` → `src/test/e2e/shots.spec.ts`
- Move: `public/index.html` → `public/shots/index.html`, `public/style.css` → `public/shots/shots.css`, and `public/data/{all.json,index.json,players/}` → `public/data/shots/`
- Move: `scripts/{fetch_shots.py,test_fetch_shots.py,roster.json}` → `scripts/shots/`
- Modify: `esbuild.mjs`, `public/_headers`, `vitest.config.ts`, `playwright.config.ts`, `package.json`, `src/web/shots/config.ts` (DATA_BASE), `scripts/shots/fetch_shots.py` (paths)
- Modify docs: `CLAUDE.md` (layout tree and routing paths), `src/CONTEXT.md`, `scripts/CONTEXT.md`, `README.md` (paths only)

**Interfaces:**
- Produces: pages are built to `public/js/pages/<folder>.js` from every `src/web/<folder>/index.ts`, and shared code goes to `public/js/chunks/<name>-<hash>.js`. Shots data lives at `/data/shots/`.

- [ ] **Step 1: Move the files with git.**

```bash
mkdir -p src/web/shots src/test/unit/shots public/shots public/data/shots scripts/shots
git mv src/web/config.ts src/web/court.ts src/web/heatmap.ts src/web/index.ts src/web/players.ts src/web/zone-table.ts src/web/shots/
git mv src/web/lib src/web/shots/lib
git mv src/test/unit/*.test.ts src/test/unit/shots/
git mv src/test/e2e/dashboard.spec.ts src/test/e2e/shots.spec.ts
git mv public/index.html public/shots/index.html
git mv public/style.css public/shots/shots.css
git mv public/data/all.json public/data/index.json public/data/players public/data/shots/
git mv scripts/fetch_shots.py scripts/test_fetch_shots.py scripts/roster.json scripts/shots/
```

- [ ] **Step 2: Fix the unit test imports and the contract test path, then run them to see what fails.**

```bash
sed -i '' 's#"\.\./\.\./web/#"../../../web/shots/#' src/test/unit/shots/*.test.ts
sed -i '' 's#"public/data/index.json"#"public/data/shots/index.json"#' src/test/unit/shots/contract.test.ts
pnpm test
```

Expected: PASS (all shots unit tests). If an import still says `../../web/`, fix it the same way.

- [ ] **Step 3: Point shots at its new data folder.** In `src/web/shots/config.ts`:

```ts
/** Where the committed data files live, relative to the site root. */
export const DATA_BASE = "/data/shots";
```

- [ ] **Step 4: Make esbuild build one page per folder, with shared chunks.** Replace `esbuild.mjs`:

```js
import { build } from "esbuild";
import { existsSync, readdirSync } from "node:fs";

// One page per src/web/<folder>/index.ts. shell/ has no index.ts, so it is only ever a shared chunk.
const pages = Object.fromEntries(
  readdirSync("src/web", { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`src/web/${d.name}/index.ts`))
    .map((d) => [d.name, `src/web/${d.name}/index.ts`]),
);

await build({
  entryPoints: pages,
  bundle: true,
  splitting: true,
  format: "esm",
  outdir: "public/js",
  // Page entries keep stable names (HTML points at them) and are served no-cache;
  // chunks are content-hashed and served immutable. See src/headers.ts.
  entryNames: "pages/[name]",
  chunkNames: "chunks/[name]-[hash]",
  // Minify in dev too: public/js is what `wrangler dev` serves, there is no separate dev path.
  minify: true,
  // Sourcemaps are for local debugging only; shipping them doubles the upload.
  sourcemap: process.env.NODE_ENV === "production" ? false : "external",
  target: "es2022",
  logLevel: "info",
});
```

- [ ] **Step 5: Point the shots page at its new script and stylesheet.** In `public/shots/index.html`, change the two tags in `<head>`:

```html
    <link rel="stylesheet" href="/shots/shots.css" />
    <script type="module" src="/js/pages/shots.js"></script>
```

- [ ] **Step 6: Update the `_headers` cache rules for the new js layout.** This file goes away in Task 5, but it has to be right until then. Replace the `/js/*` block:

```
/js/chunks/*
  Cache-Control: public, max-age=31536000, immutable

/js/pages/*
  Cache-Control: no-cache
```

- [ ] **Step 7: Update vitest coverage, the Playwright readiness URL and the package scripts.**

In `vitest.config.ts`, change the include to `include: ["src/web/*/lib/**/*.ts"],`.

In `playwright.config.ts`, change the readiness URL to `url: "http://localhost:8787/data/shots/index.json",`.

In `package.json` scripts:

```json
    "data:fetch:shots": "scripts/.venv/bin/python scripts/shots/fetch_shots.py",
    "data:test": "scripts/.venv/bin/python -m pytest scripts -q",
```

(remove the old `data:fetch`).

- [ ] **Step 8: Fix the Python paths.** In `scripts/shots/fetch_shots.py`:

```python
ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT / "public" / "data" / "shots"
```

(`ROSTER_PATH` already resolves beside the script, so leave it alone.)

Run: `pnpm data:test`. Expected: PASS.

- [ ] **Step 9: Point the e2e tests at `/shots/`.**

```bash
sed -i '' 's#page.goto("/")#page.goto("/shots/")#' src/test/e2e/shots.spec.ts
pnpm typecheck && pnpm test:e2e
```

Expected: all 7 shots flows pass. If `/shots/` 404s, check that `public/js/pages/shots.js` exists after `pnpm build:web`.

- [ ] **Step 10: Update the docs to the new paths.** In `CLAUDE.md`, change the workspace tree and the routing table's "Start with" paths (`src/web/shots/lib/`, `src/web/shots/config.ts`, `scripts/shots/roster.json`). Do the same in `src/CONTEXT.md` (layout tree) and in `scripts/CONTEXT.md` (layout tree, and `pnpm data:fetch:shots`), and in the `README.md` data commands. Leave the rules alone for now: Task 5 rewrites them.

- [ ] **Step 11: Commit.**

```bash
git add -A
git commit -m "refactor: move shots under /shots with a per-folder esbuild entry"
```

---

### Task 2: The shell registry and record-mode helpers (pure)

**Files:**
- Create: `src/web/shell/registry.ts`, `src/web/shell/lib/rec.ts`, `src/web/shell/config.ts`
- Test: `src/test/unit/shell/registry.test.ts`, `src/test/unit/shell/rec.test.ts`
- Modify: `vitest.config.ts` (coverage include)

**Interfaces:**
- Produces:
  - `interface Showcase { slug: string; title: string; hook: string; credit: string }`
  - `const SHOWCASES: readonly Showcase[]`
  - `showcaseFor(slug: string): Showcase` (throws `Error("unknown showcase: <slug>")`)
  - `isRecording(search: string): boolean`
  - `withRec(href: string, rec: boolean): string`
  - `shouldAutoplay(rec: boolean, reducedMotion: boolean): boolean`
  - `WORDMARK = "viz"` and `HOME_CREDIT` in `src/web/shell/config.ts`

- [ ] **Step 1: Write the failing tests.**

`src/test/unit/shell/rec.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRecording, shouldAutoplay, withRec } from "../../../web/shell/lib/rec.js";

describe("isRecording", () => {
  it("is true for a bare ?rec and for rec among other params", () => {
    expect(isRecording("?rec")).toBe(true);
    expect(isRecording("?x=1&rec")).toBe(true);
    expect(isRecording("?rec=1")).toBe(true);
  });
  it("is false with no rec param", () => {
    expect(isRecording("")).toBe(false);
    expect(isRecording("?record=1")).toBe(false);
  });
});

describe("withRec", () => {
  it("returns the href unchanged when not recording", () => {
    expect(withRec("/shots/", false)).toBe("/shots/");
  });
  it("adds ?rec to a bare path", () => {
    expect(withRec("/shots/", true)).toBe("/shots/?rec");
  });
  it("keeps an existing query", () => {
    expect(withRec("/shots/?a=1", true)).toBe("/shots/?a=1&rec");
  });
  it("puts rec before the hash, keeping the hash", () => {
    expect(withRec("/shots/#p=203999", true)).toBe("/shots/?rec#p=203999");
    expect(withRec("/shots/?a=1#p=2", true)).toBe("/shots/?a=1&rec#p=2");
  });
  it("does not add rec twice", () => {
    expect(withRec("/shots/?rec", true)).toBe("/shots/?rec");
  });
});

describe("shouldAutoplay", () => {
  it("autoplays unless the viewer asked for reduced motion", () => {
    expect(shouldAutoplay(false, false)).toBe(true);
    expect(shouldAutoplay(false, true)).toBe(false);
  });
  it("always autoplays in record mode", () => {
    expect(shouldAutoplay(true, true)).toBe(true);
  });
});
```

`src/test/unit/shell/registry.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SHOWCASES, showcaseFor } from "../../../web/shell/registry.js";

describe("the showcase registry", () => {
  it("has unique lower-case slugs", () => {
    const slugs = SHOWCASES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("gives every showcase a page, an entry and a script tag", () => {
    for (const { slug } of SHOWCASES) {
      expect(existsSync(`src/web/${slug}/index.ts`), slug).toBe(true);
      const html = readFileSync(`public/${slug}/index.html`, "utf8");
      expect(html, slug).toContain(`src="/js/pages/${slug}.js"`);
    }
  });

  it("credits a source and states no affiliation for every showcase", () => {
    for (const s of SHOWCASES) {
      expect(s.title.length, s.slug).toBeGreaterThan(0);
      expect(s.hook.length, s.slug).toBeGreaterThan(0);
      expect(s.credit, s.slug).toMatch(/Not affiliated/);
    }
  });

  it("finds a showcase by slug and refuses an unknown one", () => {
    expect(showcaseFor("shots").title).toBe("All-Star Shots");
    expect(() => showcaseFor("nope")).toThrow("unknown showcase: nope");
  });
});
```

- [ ] **Step 2: Run the tests to check they fail.**

Run: `pnpm test src/test/unit/shell`
Expected: FAIL because the modules cannot be resolved.

- [ ] **Step 3: Implement.**

`src/web/shell/lib/rec.ts`:

```ts
/** Record mode is on when the query has a `rec` param, with or without a value. */
export function isRecording(search: string): boolean {
  return new URLSearchParams(search).has("rec");
}

/** Carry record mode onto a same-site href, keeping any query and hash. */
export function withRec(href: string, rec: boolean): string {
  if (!rec) return href;
  const hashAt = href.indexOf("#");
  const base = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const queryAt = base.indexOf("?");
  if (queryAt !== -1 && isRecording(base.slice(queryAt))) return href;
  return `${base}${queryAt === -1 ? "?" : "&"}rec${hash}`;
}

/** Reduced motion opens a showcase paused, except when recording a reel. */
export function shouldAutoplay(rec: boolean, reducedMotion: boolean): boolean {
  return rec || !reducedMotion;
}
```

`src/web/shell/registry.ts`:

```ts
export interface Showcase {
  slug: string;
  title: string;
  /** One line, the reel's first second. */
  hook: string;
  /** Footer credit: names the source and states no affiliation (Rule 6). */
  credit: string;
}

/** Built showcases only. Parked ones (quakes, flights, scoring) are added when they ship. */
export const SHOWCASES: readonly Showcase[] = [
  {
    slug: "shots",
    title: "All-Star Shots",
    hook: "Where the 2026 NBA All-Stars shot from, 2025-26",
    credit: "Data: NBA.com/stats via nba_api. Not affiliated with the NBA.",
  },
];

export function showcaseFor(slug: string): Showcase {
  const found = SHOWCASES.find((s) => s.slug === slug);
  if (!found) throw new Error(`unknown showcase: ${slug}`);
  return found;
}
```

`src/web/shell/config.ts`:

```ts
export const WORDMARK = "viz";

/** Footer on the / grid, which has no single source of its own. */
export const HOME_CREDIT = "Every number comes from the public source each showcase names. Not affiliated with any of them.";

export const REPO_URL = "https://github.com/JMLR-Software/viz";
```

In `vitest.config.ts`, set the coverage include to:

```ts
      include: ["src/web/*/lib/**/*.ts", "src/web/shell/registry.ts"],
```

- [ ] **Step 4: Run the tests to check they pass.**

Run: `pnpm test && pnpm test:coverage`
Expected: PASS, with coverage above 80%.

- [ ] **Step 5: Commit.**

```bash
git add src/web/shell src/test/unit/shell vitest.config.ts
git commit -m "feat: showcase registry and record-mode helpers"
```

---

### Task 3: The shell on the page (header, dropdown, footer, dark theme, record frame), adopted by shots

**Files:**
- Create: `src/web/shell/mount.ts`, `public/viz.css`, `src/test/e2e/shell.spec.ts`
- Modify: `public/shots/index.html`, `public/shots/shots.css`, `src/web/shots/index.ts` (footer only)

**Interfaces:**
- Consumes: `SHOWCASES`, `showcaseFor`, `isRecording`, `withRec`, `WORDMARK`, `HOME_CREDIT`, `REPO_URL` (Task 2)
- Produces: `mountShell(slug: string | null): { rec: boolean; footerDetail: HTMLElement }`. It expects `<header id="viz-header"></header>` and `<footer id="footer"></footer>` in the page. It sets `html.rec` when recording. `footerDetail` is a `<span class="detail">` that the showcase fills in and that record mode hides.

- [ ] **Step 1: Write the failing e2e tests.** `src/test/e2e/shell.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("a showcase page carries the shared header with its hook", async ({ page }) => {
  await page.goto("/shots/");
  await expect(page.locator("#viz-header .wordmark")).toHaveText("viz");
  await expect(page.locator("#showcase")).toHaveValue("shots");
  await expect(page.locator("#viz-header .hook")).toContainText("All-Stars");
});

test("the dropdown reaches every showcase and keeps ?rec", async ({ page }) => {
  await page.goto("/shots/?rec");
  const slugs = await page.locator("#showcase option:not([disabled])").evaluateAll((os) =>
    os.map((o) => (o as HTMLOptionElement).value),
  );
  expect(slugs.length).toBeGreaterThan(0);
  for (const slug of slugs) {
    await page.locator("#showcase").selectOption(slug);
    await expect(page).toHaveURL(new RegExp(`/${slug}/\\?rec`));
    await expect(page.locator("#showcase")).toHaveValue(slug);
  }
});

test("?rec locks the page into a 9:16 frame and hides the footer detail", async ({ page }) => {
  await page.goto("/shots/?rec");
  await expect(page.locator("html")).toHaveClass(/\brec\b/);
  const box = await page.locator("body").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width / box!.height).toBeCloseTo(9 / 16, 1);
  await expect(page.locator("#footer .credit")).toBeVisible();
  await expect(page.locator("#footer .detail")).toBeHidden();
});

test("picking a player in record mode keeps ?rec", async ({ page }) => {
  await page.goto("/shots/?rec");
  await page.getByRole("button", { name: /Nikola Jokić/ }).click();
  await expect(page).toHaveURL(/\/shots\/\?rec#p=203999/);
});

test("the footer credit comes from the registry", async ({ page }) => {
  await page.goto("/shots/");
  await expect(page.locator("#footer .credit")).toContainText("Not affiliated with the NBA");
  await expect(page.locator("#footer .detail")).toContainText("Pulled");
});
```

- [ ] **Step 2: Run the tests to check they fail.**

Run: `pnpm test:e2e src/test/e2e/shell.spec.ts`
Expected: FAIL because `#viz-header .wordmark` is not found.

- [ ] **Step 3: Write `src/web/shell/mount.ts`.**

```ts
import { HOME_CREDIT, WORDMARK } from "./config.js";
import { isRecording, withRec } from "./lib/rec.js";
import { SHOWCASES, showcaseFor } from "./registry.js";

const byId = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node;
};

function buildDropdown(current: string | null, rec: boolean): HTMLSelectElement {
  const select = document.createElement("select");
  select.id = "showcase";
  select.setAttribute("aria-label", "Showcase");
  if (current === null) {
    const prompt = new Option("Pick a showcase", "", true, true);
    prompt.disabled = true;
    select.add(prompt);
  }
  for (const s of SHOWCASES) select.add(new Option(s.title, s.slug, false, s.slug === current));
  select.addEventListener("change", () => {
    window.location.assign(withRec(`/${select.value}/`, rec));
  });
  return select;
}

/** Mount the shared header and footer. `slug` is null on the / grid. */
export function mountShell(slug: string | null): { rec: boolean; footerDetail: HTMLElement } {
  const rec = isRecording(window.location.search);
  document.documentElement.classList.toggle("rec", rec);

  const wordmark = document.createElement("a");
  wordmark.className = "wordmark";
  wordmark.href = withRec("/", rec);
  wordmark.textContent = WORDMARK;

  const hook = document.createElement("p");
  hook.className = "hook";
  hook.textContent = slug === null ? "" : showcaseFor(slug).hook;

  byId("viz-header").replaceChildren(wordmark, buildDropdown(slug, rec), hook);

  const credit = document.createElement("span");
  credit.className = "credit";
  credit.textContent = slug === null ? HOME_CREDIT : showcaseFor(slug).credit;
  const footerDetail = document.createElement("span");
  footerDetail.className = "detail";
  byId("footer").replaceChildren(credit, " ", footerDetail);

  return { rec, footerDetail };
}
```

- [ ] **Step 4: Write `public/viz.css`.** It holds the tokens (dark only), the shell, the record frame and view transitions.

```css
:root {
  color-scheme: dark;
  --bg: #0b0d11;
  --panel: #14171d;
  --ink: #eef0f4;
  --muted: #99a1ae;
  --line: #262b34;
  --accent: #ff6b7a; /* 6.27:1 on --panel */
  --up: #ff8f66;
  --down: #7fb2ff;
  --court: #3b3128;
  --court-line: #ffffff;
}

@view-transition { navigation: auto; }

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  container-type: inline-size;
}

#viz-header {
  view-transition-name: viz-header;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--line);
}
#viz-header .wordmark { color: var(--ink); font-weight: 800; font-size: 22px; letter-spacing: -0.03em; text-decoration: none; }
#showcase { font: inherit; font-size: 18px; font-weight: 600; padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: inherit; }
#viz-header .hook { flex-basis: 100%; margin: 0; color: var(--muted); font-size: 16px; }

select { font: inherit; padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: inherit; }
select:disabled { opacity: 0.5; }
button { font: inherit; color: inherit; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; cursor: pointer; }

footer { padding: 16px 24px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--line); }
footer a { color: inherit; }

.load-error { margin: 24px; color: var(--accent); }
.load-error button { margin-left: 8px; }

/* Record mode: a centred 9:16 phone frame, larger type, one-line footer. */
html.rec { background: #000; height: 100%; }
html.rec body {
  width: min(100vw, calc(100vh * 9 / 16));
  height: min(100vh, calc(100vw * 16 / 9));
  margin: 0 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-size: 18px;
}
html.rec main { flex: 1; min-height: 0; overflow: auto; }
html.rec #viz-header .hook { font-size: 20px; color: var(--ink); }
html.rec footer { padding: 8px 16px; }
html.rec footer .detail { display: none; }

@media (prefers-reduced-motion: reduce) {
  @view-transition { navigation: none; }
}
```

- [ ] **Step 5: Adopt the shell in the shots page.** In `public/shots/index.html`, put the shared stylesheet before `shots.css`, add the shell header, and turn the old `<header>` into a bar:

```html
    <link rel="stylesheet" href="/viz.css" />
    <link rel="stylesheet" href="/shots/shots.css" />
```

```html
  <body>
    <header id="viz-header"></header>
    <div class="bar">
      <h1>All-Star Shots <span class="season">2025-26</span></h1>
      <label>Season
        <select id="season">
          <option value="regular" selected>Regular Season</option>
          <option value="playoffs">Playoffs</option>
        </select>
      </label>
    </div>
```

(the `<main>` and the `<footer id="footer"></footer>` stay as they are).

- [ ] **Step 6: Restyle `public/shots/shots.css` to the dark tokens.** Delete its `:root` block, its `@media (prefers-color-scheme: dark)` block, and its `*`, `body`, `select`, `select:disabled`, `footer` and `footer a` rules, because `viz.css` owns them now. Rename the `header { … }` rule to `.bar { … }` and keep its body. Change `@media (max-width: 800px)` to `@container (max-width: 800px)`, so the stacked layout also applies inside the 405 px record frame.

- [ ] **Step 7: Move the shots footer into the shell's detail slot.** In `src/web/shots/index.ts`, add the import and the mount at the top (after the imports):

```ts
import { mountShell } from "../shell/mount.js";
import { REPO_URL } from "../shell/config.js";

const { footerDetail } = mountShell("shots");
```

Remove `const footer = el("footer");`. In `start()`, replace the footer block with:

```ts
  const date = state.index.generatedAt.slice(0, 10);
  const repoLink = document.createElement("a");
  repoLink.href = REPO_URL;
  repoLink.textContent = "Source";
  footerDetail.replaceChildren(`Pulled ${date}. `, repoLink);
```

The existing `writeHash` calls `history.replaceState(null, "", "#p=…")`. A hash-only URL keeps the current query, so `?rec` survives, and the Step 1 test pins that. Also change the `start()` error text to the spec §7 form, keeping "Reload" out of it:

```ts
    showError("Couldn't load the shots data. Reload to try again.");
```

- [ ] **Step 8: Update the old footer e2e test.** In `src/test/e2e/shots.spec.ts`, the "footer credits the source" test still passes (`#footer` contains the credit). Leave it.

- [ ] **Step 9: Run everything.**

Run: `pnpm typecheck && pnpm test && pnpm test:e2e`
Expected: PASS, with the 5 shell tests and 7 shots tests all green.

- [ ] **Step 10: Look at it.** Run `pnpm dev`, then open `http://localhost:8787/shots/` and `http://localhost:8787/shots/?rec`. Check that the court, the rail and the table read on the dark theme and that the record frame shows the header, the dropdown and the court. Take one screenshot of each for the PR.

- [ ] **Step 11: Commit.**

```bash
git add -A
git commit -m "feat: shared shell with dropdown, dark theme and record mode; shots adopts it"
```

---

### Task 4: The `/` tile grid

**Files:**
- Create: `public/index.html`, `src/web/home/index.ts`, `public/home.css`
- Modify: `src/test/e2e/shell.spec.ts`

**Interfaces:**
- Consumes: `mountShell(null)`, `SHOWCASES`, `withRec`

- [ ] **Step 1: Write the failing e2e tests.** Append these to `src/test/e2e/shell.spec.ts`:

```ts
test("/ shows one tile per showcase with its title and hook", async ({ page }) => {
  await page.goto("/");
  const options = await page.locator("#showcase option:not([disabled])").count();
  await expect(page.locator("#tiles li")).toHaveCount(options);
  await expect(page.locator("#tiles li").first()).toContainText("All-Star Shots");
  await expect(page.locator("#footer .credit")).toContainText("Not affiliated");
});

test("a tile carries ?rec, and the wordmark goes home with it", async ({ page }) => {
  await page.goto("/?rec");
  await page.locator("#tiles a").first().click();
  await expect(page).toHaveURL(/\/shots\/\?rec/);
  await page.locator("#viz-header .wordmark").click();
  await expect(page).toHaveURL(/\/\?rec$/);
});
```

- [ ] **Step 2: Run the tests to check they fail.**

Run: `pnpm test:e2e src/test/e2e/shell.spec.ts`
Expected: FAIL, because `/` returns 404.

- [ ] **Step 3: Implement the page.** `public/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>viz: data visualisations</title>
    <meta name="description" content="A small gallery of D3 data visualisations built on real public data." />
    <link rel="stylesheet" href="/viz.css" />
    <link rel="stylesheet" href="/home.css" />
    <script type="module" src="/js/pages/home.js"></script>
  </head>
  <body>
    <header id="viz-header"></header>
    <main><ul id="tiles"></ul></main>
    <footer id="footer"></footer>
  </body>
</html>
```

`src/web/home/index.ts`:

```ts
import { withRec } from "../shell/lib/rec.js";
import { mountShell } from "../shell/mount.js";
import { SHOWCASES } from "../shell/registry.js";

const { rec } = mountShell(null);

const tiles = document.getElementById("tiles");
if (!tiles) throw new Error("missing #tiles");

tiles.replaceChildren(
  ...SHOWCASES.map((s) => {
    const title = document.createElement("h2");
    title.textContent = s.title;
    const hook = document.createElement("p");
    hook.textContent = s.hook;
    const link = document.createElement("a");
    link.href = withRec(`/${s.slug}/`, rec);
    link.append(title, hook);
    const item = document.createElement("li");
    item.append(link);
    return item;
  }),
);
```

`public/home.css`:

```css
#tiles { list-style: none; margin: 0; padding: 24px; display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
#tiles a { display: block; height: 100%; padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); color: inherit; text-decoration: none; }
#tiles a:hover, #tiles a:focus-visible { border-color: var(--accent); }
#tiles h2 { margin: 0 0 6px; font-size: 20px; }
#tiles p { margin: 0; color: var(--muted); }
html.rec #tiles { grid-template-columns: 1fr; }
```

- [ ] **Step 4: Run the tests to check they pass.**

Run: `pnpm test:e2e`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add public/index.html public/home.css src/web/home src/test/e2e/shell.spec.ts
git commit -m "feat: / tile grid from the registry"
```

---

### Task 5: Worker main: the shots.jmlr.dev redirect and headers, the rename to `viz`, and the rules

`run_worker_first: true` is required, because otherwise `shots.jmlr.dev/` matches `index.html` and the Worker never runs. Cloudflare's docs say `_headers` "are not applied to responses generated by your Worker code". So the Worker sets the headers itself, and `_headers` is deleted.

**Files:**
- Create: `src/redirect.ts`, `src/headers.ts`, `src/worker.ts`, `src/test/unit/worker/redirect.test.ts`, `src/test/unit/worker/headers.test.ts`
- Delete: `public/_headers`
- Modify: `wrangler.jsonc`, `package.json` (name), `vitest.config.ts` (coverage include), `CLAUDE.md` (title, stack, live URL, rules 1, 2 and 6 per spec §3), `README.md`, `src/CONTEXT.md` (the Worker now has code)

**Interfaces:**
- Produces: `redirectTarget(url: string): string | null`, `headersFor(pathname: string): Record<string, string>`, and the Worker default export `{ fetch(request: Request, env: Env): Promise<Response> }`

- [ ] **Step 1: Write the failing tests.**

`src/test/unit/worker/redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { redirectTarget } from "../../../redirect.js";

describe("redirectTarget", () => {
  it("sends the old root to /shots/", () => {
    expect(redirectTarget("https://shots.jmlr.dev/")).toBe("https://viz.jmlr.dev/shots/");
  });
  it("keeps the path under /shots and keeps the query", () => {
    expect(redirectTarget("https://shots.jmlr.dev/?rec")).toBe("https://viz.jmlr.dev/shots/?rec");
    expect(redirectTarget("https://shots.jmlr.dev/foo?a=1")).toBe("https://viz.jmlr.dev/shots/foo?a=1");
  });
  it("leaves every other host alone", () => {
    expect(redirectTarget("https://viz.jmlr.dev/shots/")).toBeNull();
    expect(redirectTarget("http://localhost:8787/")).toBeNull();
  });
});
```

`src/test/unit/worker/headers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { headersFor } from "../../../headers.js";

describe("headersFor", () => {
  it("puts the CSP and nosniff on every path", () => {
    for (const path of ["/", "/shots/", "/js/pages/shots.js", "/data/shots/index.json"]) {
      const h = headersFor(path);
      expect(h["Content-Security-Policy"], path).toContain("default-src 'self'");
      expect(h["X-Content-Type-Options"], path).toBe("nosniff");
    }
  });
  it("caches hashed chunks and data forever", () => {
    expect(headersFor("/js/chunks/chunk-ABC123.js")["Cache-Control"]).toBe("public, max-age=31536000, immutable");
    expect(headersFor("/data/tornadoes/tornadoes.json")["Cache-Control"]).toBe("public, max-age=31536000, immutable");
  });
  it("revalidates page scripts so a deploy is seen at once", () => {
    expect(headersFor("/js/pages/shots.js")["Cache-Control"]).toBe("no-cache");
  });
  it("sets no cache rule on HTML", () => {
    expect(headersFor("/shots/")["Cache-Control"]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to check they fail.**

Run: `pnpm test src/test/unit/worker`
Expected: FAIL because the modules cannot be resolved.

- [ ] **Step 3: Implement.**

`src/redirect.ts`:

```ts
const OLD_HOST = "shots.jmlr.dev";
const NEW_ORIGIN = "https://viz.jmlr.dev";

/** Where a request to the old shots host should go, or null to serve it here. */
export function redirectTarget(url: string): string | null {
  const u = new URL(url);
  if (u.hostname !== OLD_HOST) return null;
  const path = u.pathname === "/" ? "/shots/" : `/shots${u.pathname}`;
  return `${NEW_ORIGIN}${path}${u.search}`;
}
```

`src/headers.ts`. The CSP is copied verbatim from the old `public/_headers`:

```ts
const IMMUTABLE = "public, max-age=31536000, immutable";

const SECURITY: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://cdn.nba.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
};

/** Headers the Worker adds to every asset (what public/_headers did before the Worker ran first). */
export function headersFor(pathname: string): Record<string, string> {
  if (pathname.startsWith("/js/chunks/") || pathname.startsWith("/data/")) {
    return { ...SECURITY, "Cache-Control": IMMUTABLE };
  }
  if (pathname.startsWith("/js/pages/")) return { ...SECURITY, "Cache-Control": "no-cache" };
  return { ...SECURITY };
}
```

`src/worker.ts`:

```ts
import { headersFor } from "./headers.js";
import { redirectTarget } from "./redirect.js";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const target = redirectTarget(request.url);
    if (target) return Response.redirect(target, 301);
    const asset = await env.ASSETS.fetch(request);
    const response = new Response(asset.body, asset);
    for (const [name, value] of Object.entries(headersFor(new URL(request.url).pathname))) {
      response.headers.set(name, value);
    }
    return response;
  },
};
```

`wrangler.jsonc`:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "viz",
  "main": "src/worker.ts",
  "compatibility_date": "2026-03-10",
  // run_worker_first: shots.jmlr.dev/ would otherwise match index.html and never reach the redirect.
  "assets": { "directory": "./public", "binding": "ASSETS", "run_worker_first": true },
  "routes": [
    { "pattern": "viz.jmlr.dev", "custom_domain": true },
    { "pattern": "shots.jmlr.dev", "custom_domain": true }
  ],
  "observability": { "enabled": true }
}
```

Run `git rm public/_headers`. In `package.json`, set `"name": "viz"`. In `vitest.config.ts`, set the coverage include to `["src/web/*/lib/**/*.ts", "src/web/shell/registry.ts", "src/redirect.ts", "src/headers.ts"]`.

- [ ] **Step 4: Run the tests to check they pass.**

Run: `pnpm typecheck && pnpm test && pnpm test:coverage`
Expected: PASS.

- [ ] **Step 5: Check the headers through the real Worker.** Run `pnpm dev`, then in another shell:

```bash
curl -sI http://localhost:8787/js/pages/shots.js | grep -i -E 'cache-control|content-security'
curl -sI http://localhost:8787/shots/ | grep -i content-security
ls public/js/chunks/ | head -1 | xargs -I{} curl -sI http://localhost:8787/js/chunks/{} | grep -i cache-control
```

Expected: `no-cache` plus the CSP, then the CSP, then `immutable`. If any header is missing, the Worker is not running first, so check `run_worker_first` before going on.

- [ ] **Step 6: Run the e2e tests** (they now go through the Worker): `pnpm test:e2e`. Expected: PASS.

- [ ] **Step 7: Rewrite the docs for the rename and the new rules.** In `CLAUDE.md`, set the title to `# viz`, rewrite the intro to one paragraph from spec §1 (live at https://viz.jmlr.dev, with shots.jmlr.dev redirecting), and change Stack to "a static multi-page site, and a Worker that redirects, sets headers and serves assets". Replace Rules 1, 2 and 6 with the spec §3 wording, and add a Rule 7: "Headers live in `src/headers.ts`; there is no `_headers` file (the Worker runs first, so Cloudflare would ignore it)." Add routing rows for "Add a showcase" (start with `src/web/shell/registry.ts`, then `src/CONTEXT.md`) and "Pick up where the last session stopped" (start with the newest `docs/handoff-*.md`). In `src/CONTEXT.md`, replace "There is no Worker code" with a short description of `worker.ts`, `redirect.ts` and `headers.ts`, and add a "How to add a showcase" workflow: a registry entry, `src/web/<slug>/index.ts`, `public/<slug>/index.html` with `/js/pages/<slug>.js`, and data under `public/data/<slug>/`. In `README.md`, change the title to viz and the Live URL to viz.jmlr.dev.

- [ ] **Step 8: Commit.**

```bash
git add -A
git commit -m "feat: Worker main with shots.jmlr.dev redirect and headers; rename to viz"
```

---

### Task 6: Ship phase 1 and rename the repo

- [ ] **Step 1: Review.** Dispatch the code-reviewer agent on `git diff origin/main...HEAD`. Fix CRITICAL and HIGH findings, then re-run `pnpm typecheck && pnpm test:coverage && pnpm test:e2e && pnpm data:test`.
- [ ] **Step 2: Open the PR** from `feat/viz-phase-1`, with the Task 3 screenshots and a test plan. **[Josh]** merges it, because it is a code PR.
- [ ] **Step 3: [Josh] approves the cut-over.** The old Worker `allstar-shots` owns the `shots.jmlr.dev` custom domain, so the new `viz` Worker cannot claim it until the old one is gone. `shots.jmlr.dev` will be down from the delete until the deploy finishes, which is seconds because the build runs first. From an up-to-date `main`:

```bash
pnpm test && NODE_ENV=production pnpm build:web   # everything slow happens before the old Worker goes
pnpm wrangler delete --name allstar-shots           # asks to confirm; Josh can run it himself with `! `
pnpm wrangler deploy
```

- [ ] **Step 4: Verify live.**

```bash
curl -sI https://shots.jmlr.dev/ | grep -i -E '^(HTTP|location)'     # 301, location: https://viz.jmlr.dev/shots/
curl -sI "https://shots.jmlr.dev/?rec" | grep -i location               # .../shots/?rec
curl -sI https://viz.jmlr.dev/shots/ | grep -i content-security         # present
curl -s https://viz.jmlr.dev/ | grep -c 'js/pages/home.js'              # 1
```

Open `https://viz.jmlr.dev/shots/?rec` on a phone-sized window and check the frame.

- [ ] **Step 5: [Josh] approves renaming the GitHub repo and the folder.** No session may be working in `~/Coding/allstar-shots` at the time.

```bash
gh repo rename viz --repo JMLR-Software/allstar-shots --yes
mv ~/Coding/allstar-shots ~/Coding/viz
git -C ~/Coding/viz remote set-url origin https://github.com/JMLR-Software/viz.git
git -C ~/Coding/viz worktree repair
git -C ~/Coding/viz fetch && git -C ~/Coding/viz status -sb
```

- [ ] **Step 6: hq.** Rewrite the phase 1 line in `hq/now.md` to say that phase 1 is live and tornadoes are in progress. Do it in a small status-only hq PR and merge it yourself.

---

# Phase 2 — tornadoes

Branch `feat/viz-phase-2` off `main` after phase 1 has merged.

**Source facts, verified on 2026-09-24 against the live SPC file:**

- The file is `https://www.spc.noaa.gov/wcm/data/1950-2025_all_tornadoes.csv` (74,956 rows, 1950–2025). The spec says 1950–2024, and SPC has since published 2025, so this plan uses the newest complete year and puts the end year in the hook. Flag this to Josh in the PR.
- `sg == "1"` is one row per tornado with its whole track (73,455). This is what the tracks use.
- `sn == "1"` is a row per state with that state's counties in `f1`–`f4` (the county FIPS within `stf`, with 0 meaning none). This is what the county counts use. A multi-state tornado has an `sn=0, sg=1` whole-track row plus `sn=1, sg=2` state rows. `sg == "-9"` rows are continuation rows and are ignored.
- `elat == 0` means no end point was recorded (26,083 tracks, almost all before 2000).
- `mag == -9` means the rating is unknown (1,546 rows).
- There are PR, VI, AK, HI and DC rows. `geoAlbersUsa` has no place for PR or VI.
- The counties atlas is `https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-albers-10m.json` (795 KB, 3,142 counties, 5-digit string ids, `objects.counties` and `objects.states`, each with `properties.name`). It is pre-projected with `geoAlbersUsa().scale(1300).translate([487.5, 305])` into a 975×610 frame.

**Data format** (`public/data/tornadoes/tornadoes.json`):

```jsonc
{
  "generatedAt": "2026-09-25T12:00:00Z",
  "source": "NOAA Storm Prediction Center, 1950-2025_all_tornadoes.csv",
  "firstYear": 1950, "lastYear": 2025,
  "trackFields": ["lat", "lon", "dlat", "dlon", "mag"],   // hundredths of a degree; d* = end − start; mag −1 = unknown
  "countyFields": ["year", "all", "strong"],              // year = offset from firstYear; strong = EF/F3+
  "tracks": [[3673, -10252, 15, 22, 1, 3417, -7860, 0, 0, 3], …],   // one flat array per year, 5 ints per tornado
  "counties": { "40025": [[0, 1, 0]], … },                          // sparse, sorted by year
  "unmatchedCountyRefs": 1
}
```

`public/data/tornadoes/counties.json` is the us-atlas topology, copied unchanged.

### Task 7: The tornado fetch script (pure parts first)

**Files:**
- Create: `scripts/tornadoes/fetch_tornadoes.py`, `scripts/tornadoes/test_fetch_tornadoes.py`, `scripts/tornadoes/fixtures/sample.csv`
- Modify: `package.json` (add `"data:fetch:tornadoes": "scripts/.venv/bin/python scripts/tornadoes/fetch_tornadoes.py"`), `scripts/CONTEXT.md` (layout, workflow, rules for the tornado data)

**Interfaces:**
- Produces (Python): `parse_csv(text) -> list[dict]`, `build_tracks(rows) -> tuple[int, int, list[list[int]]]`, `build_counties(rows, first_year, valid_fips) -> tuple[dict[str, list[list[int]]], int]`, `county_ids(topology) -> set[str]`, `build_output(rows, valid_fips, generated_at) -> dict`, `write_json_atomic(path, obj) -> None`, `TRACK_FIELDS` and `COUNTY_FIELDS` (must equal the TS constants in Task 9)

- [ ] **Step 1: Write the fixture** `scripts/tornadoes/fixtures/sample.csv`. It has one of each case: a single-state tornado, a point tornado, a MO→IL tornado with a whole-track row and two state rows, a continuation row, an unknown rating plus a renamed county, and Puerto Rico.

```csv
om,yr,mo,dy,date,time,tz,st,stf,stn,mag,inj,fat,loss,closs,slat,slon,elat,elon,len,wid,ns,sn,sg,f1,f2,f3,f4,fc
192,1950,10,01,1950-10-01,21:00:00,3,OK,40,23,1,0,0,4.0,0.0,36.73,-102.52,36.88,-102.3,15.8,10,1,1,1,25,0,0,0,0
193,1950,10,09,1950-10-09,02:15:00,3,NC,37,9,3,3,0,5.0,0.0,34.17,-78.6,0.0,0.0,2.0,880,1,1,1,47,0,0,0,0
1,1951,02,12,1951-02-12,14:00:00,3,MO,29,0,4,0,0,0,0,38.77,-90.22,38.83,-90.03,9.5,150,2,0,1,0,0,0,0,0
1,1951,02,12,1951-02-12,14:00:00,3,MO,29,1,4,0,0,0,0,38.77,-90.22,38.82,-90.12,6.2,150,2,1,2,189,0,0,0,0
1,1951,02,12,1951-02-12,14:00:00,3,IL,17,1,4,0,0,0,0,38.82,-90.12,38.83,-90.03,3.3,150,2,1,2,119,0,0,0,0
2,1951,03,01,1951-03-01,10:00:00,3,KS,20,0,2,0,0,0,0,37.10,-97.30,37.20,-97.10,5.0,100,1,0,-9,5,0,0,0,0
3,1951,04,02,1951-04-02,16:00:00,3,FL,12,1,-9,0,0,0,0,25.80,-80.30,25.85,-80.25,1.0,30,1,1,1,25,11,0,0,0
4,1951,05,03,1951-05-03,13:00:00,3,PR,72,1,0,0,0,0,0,18.40,-66.10,18.41,-66.09,0.5,20,1,1,1,127,0,0,0,0
```

- [ ] **Step 2: Write the failing tests** in `scripts/tornadoes/test_fetch_tornadoes.py`:

```python
import json
from pathlib import Path

import pytest

import fetch_tornadoes as ft

FIXTURE = (Path(__file__).parent / "fixtures" / "sample.csv").read_text(encoding="utf-8")
VALID = {"40025", "37047", "29189", "17119", "12086", "12011"}


def rows():
    return ft.parse_csv(FIXTURE)


def test_parse_csv_rejects_a_missing_column():
    broken = FIXTURE.replace(",sg,", ",sgx,", 1)
    with pytest.raises(ValueError, match="missing columns: sg"):
        ft.parse_csv(broken)


def test_parse_csv_rejects_an_empty_file():
    header = FIXTURE.splitlines()[0] + "\n"
    with pytest.raises(ValueError, match="no rows"):
        ft.parse_csv(header)


def test_tracks_take_one_row_per_tornado_by_year():
    first, last, tracks = ft.build_tracks(rows())
    assert (first, last) == (1950, 1951)
    assert tracks[0] == [3673, -10252, 15, 22, 1, 3417, -7860, 0, 0, 3]
    # 1951: the MO->IL whole track once (not its two state rows, not the -9 row), FL, PR.
    assert tracks[1] == [3877, -9022, 6, 19, 4, 2580, -8030, 5, 5, -1, 1840, -6610, 1, 1, 0]


def test_a_tornado_with_no_end_point_is_a_point():
    _, _, tracks = ft.build_tracks(rows())
    assert tracks[0][7:9] == [0, 0]


def test_counties_count_each_state_row_once_and_split_strong():
    counties, _ = ft.build_counties(rows(), 1950, VALID)
    assert counties == {
        "40025": [[0, 1, 0]],
        "37047": [[0, 1, 1]],
        "29189": [[1, 1, 1]],
        "17119": [[1, 1, 1]],
        "12086": [[1, 1, 0]],  # Dade 12025 renamed Miami-Dade 12086
        "12011": [[1, 1, 0]],
    }


def test_counties_off_the_atlas_are_counted_not_dropped_silently():
    _, unmatched = ft.build_counties(rows(), 1950, VALID)
    assert unmatched == 1  # Puerto Rico 72127


def test_county_ids_reads_the_topology():
    topo = {"objects": {"counties": {"geometries": [{"id": "01001"}, {"id": "56045"}]}}}
    assert ft.county_ids(topo) == {"01001", "56045"}


def test_build_output_names_its_fields_and_years():
    out = ft.build_output(rows(), VALID, "2026-09-25T00:00:00Z")
    assert out["trackFields"] == ["lat", "lon", "dlat", "dlon", "mag"]
    assert out["countyFields"] == ["year", "all", "strong"]
    assert (out["firstYear"], out["lastYear"]) == (1950, 1951)
    assert len(out["tracks"]) == 2
    assert out["unmatchedCountyRefs"] == 1


def test_write_json_atomic_leaves_no_temp_file(tmp_path):
    target = tmp_path / "out.json"
    ft.write_json_atomic(target, {"a": 1})
    assert json.loads(target.read_text()) == {"a": 1}
    assert [p.name for p in tmp_path.iterdir()] == ["out.json"]
```

- [ ] **Step 3: Run the tests to check they fail.**

Run: `pnpm data:test`
Expected: FAIL with `ModuleNotFoundError: No module named 'fetch_tornadoes'`.

- [ ] **Step 4: Implement** `scripts/tornadoes/fetch_tornadoes.py`:

```python
"""Pull every US tornado since 1950 from NOAA SPC and write the tornadoes showcase's data files.

Runs on a laptop. Writes public/data/tornadoes/{tornadoes,counties}.json atomically. See scripts/CONTEXT.md.
"""

import csv
import io
import json
import os
import sys
import tempfile
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SPC_URL = "https://www.spc.noaa.gov/wcm/data/1950-2025_all_tornadoes.csv"
SPC_NAME = "NOAA Storm Prediction Center, 1950-2025_all_tornadoes.csv"
ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-albers-10m.json"
REQUEST_TIMEOUT = 60
MIN_ATLAS_COUNTIES = 3000
STRONG_MIN_MAG = 3
UNKNOWN_MAG = -1
REQUIRED_COLUMNS = ("yr", "mag", "stf", "slat", "slon", "elat", "elon", "sn", "sg", "f1", "f2", "f3", "f4")
COUNTY_COLUMNS = ("f1", "f2", "f3", "f4")
TRACK_FIELDS = ["lat", "lon", "dlat", "dlon", "mag"]
COUNTY_FIELDS = ["year", "all", "strong"]
# SPC keeps the FIPS in force when the tornado happened; us-atlas (2017) has the current ones.
FIPS_REMAP = {"12025": "12086", "46113": "46102", "51515": "51019", "02270": "02158"}

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = ROOT / "public" / "data" / "tornadoes"


def parse_csv(text):
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"missing columns: {', '.join(missing)}")
    rows = list(reader)
    if not rows:
        raise ValueError("no rows in the SPC file")
    return rows


def hundredths(value):
    return round(float(value) * 100)


def magnitude(value):
    mag = int(value)
    return UNKNOWN_MAG if mag < 0 else mag


def track(row):
    lat, lon = hundredths(row["slat"]), hundredths(row["slon"])
    if float(row["elat"]) == 0 or float(row["elon"]) == 0:
        dlat, dlon = 0, 0  # no end point recorded: draw a point
    else:
        dlat, dlon = hundredths(row["elat"]) - lat, hundredths(row["elon"]) - lon
    return [lat, lon, dlat, dlon, magnitude(row["mag"])]


def build_tracks(rows):
    """One whole-track row (sg == 1) per tornado, flattened per year. Returns (first, last, tracks)."""
    whole = [r for r in rows if r["sg"] == "1"]
    if not whole:
        raise ValueError("no whole-track (sg=1) rows")
    first = min(int(r["yr"]) for r in whole)
    last = max(int(r["yr"]) for r in whole)
    tracks = [[] for _ in range(last - first + 1)]  # local accumulator; no input is mutated
    for r in whole:
        tracks[int(r["yr"]) - first].extend(track(r))
    return first, last, tracks


def build_counties(rows, first_year, valid_fips):
    """Count tornadoes per county per year from the per-state rows (sn == 1). Returns (counties, unmatched)."""
    counts = defaultdict(lambda: [0, 0])  # local accumulator; no input is mutated
    unmatched = 0
    for r in rows:
        if r["sn"] != "1":
            continue
        strong = 1 if magnitude(r["mag"]) >= STRONG_MIN_MAG else 0
        year = int(r["yr"]) - first_year
        for column in COUNTY_COLUMNS:
            county = int(r[column])
            if county == 0:
                continue
            fips = f"{int(r['stf']):02d}{county:03d}"
            fips = FIPS_REMAP.get(fips, fips)
            if fips not in valid_fips:
                unmatched += 1
                continue
            counts[(fips, year)][0] += 1
            counts[(fips, year)][1] += strong
    counties = defaultdict(list)
    for (fips, year), (all_count, strong_count) in sorted(counts.items()):
        counties[fips].append([year, all_count, strong_count])
    return dict(counties), unmatched


def county_ids(topology):
    return {g["id"] for g in topology["objects"]["counties"]["geometries"]}


def build_output(rows, valid_fips, generated_at):
    first, last, tracks = build_tracks(rows)
    counties, unmatched = build_counties(rows, first, valid_fips)
    if not counties:
        raise ValueError("no county matched the atlas")
    return {
        "generatedAt": generated_at,
        "source": SPC_NAME,
        "firstYear": first,
        "lastYear": last,
        "trackFields": TRACK_FIELDS,
        "countyFields": COUNTY_FIELDS,
        "tracks": tracks,
        "counties": counties,
        "unmatchedCountyRefs": unmatched,
    }


def write_json_atomic(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, separators=(",", ":"))
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def download(url):
    with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT) as response:
        return response.read().decode("utf-8")


def main():
    try:
        print(f"downloading {ATLAS_URL}")
        topology = json.loads(download(ATLAS_URL))
        valid = county_ids(topology)
        if len(valid) < MIN_ATLAS_COUNTIES:
            raise ValueError(f"atlas has only {len(valid)} counties")
        print(f"downloading {SPC_URL}")
        rows = parse_csv(download(SPC_URL))
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        output = build_output(rows, valid, generated_at)
    except (OSError, ValueError, KeyError) as error:
        print(f"fetch_tornadoes: {error}", file=sys.stderr)
        sys.exit(1)
    write_json_atomic(OUT_DIR / "counties.json", topology)
    write_json_atomic(OUT_DIR / "tornadoes.json", output)
    total = sum(len(t) // len(TRACK_FIELDS) for t in output["tracks"])
    print(f"wrote {total} tornadoes {output['firstYear']}-{output['lastYear']}, "
          f"{len(output['counties'])} counties, {output['unmatchedCountyRefs']} county refs off the atlas")


if __name__ == "__main__":
    main()
```

The accumulators are local and built fresh on each call, so no input is mutated (Rule 5). Rebuilding a dict on every row would be O(n²) over about 75k rows.

- [ ] **Step 5: Run the tests to check they pass.**

Run: `pnpm data:test`
Expected: PASS (the shots tests and the 9 tornado tests).

- [ ] **Step 6: Document it** in `scripts/CONTEXT.md`. Add `tornadoes/` to the layout, a "Fetch tornadoes: `pnpm data:fetch:tornadoes` (two downloads, a few seconds)" workflow line, and these rules: "tracks come from `sg=1` rows, county counts from `sn=1` rows", "`FIPS_REMAP` handles county renames; `unmatchedCountyRefs` is the rest", and "`TRACK_FIELDS` and `COUNTY_FIELDS` must match `src/web/tornadoes/config.ts`".

- [ ] **Step 7: Commit.**

```bash
git add scripts/tornadoes scripts/CONTEXT.md package.json
git commit -m "feat: tornado fetch script from NOAA SPC with pytest fixture"
```

---

### Task 8: Fetch the tornado data and pin the contract

**Files:**
- Create: `public/data/tornadoes/tornadoes.json`, `public/data/tornadoes/counties.json` (both generated), `src/web/tornadoes/config.ts`, `src/test/unit/tornadoes/contract.test.ts`

**Interfaces:**
- Produces (`src/web/tornadoes/config.ts`): `DATA_BASE`, `TRACK_FIELDS`, `COUNTY_FIELDS`, `COORD_SCALE`, `MAP_WIDTH`, `MAP_HEIGHT`, `ALBERS_SCALE`, `ALBERS_TRANSLATE`, `PLAY_MS`, `HOLD_MS`, `FLASH_FADE_YEARS`, `STRONG_MIN_MAG`, `HEAT_PERCENTILE`, `EMPTY_FILL`, `TRACK_COLOR`, `STATE_STROKE`, `TRACK_WIDTH_BY_MAG`, `UNKNOWN_TRACK_WIDTH`, `DATA_BUDGET_BYTES`

- [ ] **Step 1: Run the fetch.**

Run: `pnpm data:fetch:tornadoes`
Expected: something like `wrote 73455 tornadoes 1950-2025, ~2500+ counties, N county refs off the atlas`. N should be small, a few hundred at most. If it is in the thousands, look at which FIPS miss (print a `Counter` in a scratch run) and extend `FIPS_REMAP` only for real county renames. Then `ls -la public/data/tornadoes/`.

- [ ] **Step 2: Write the config** `src/web/tornadoes/config.ts`:

```ts
export const DATA_BASE = "/data/tornadoes";

/** Must match scripts/tornadoes/fetch_tornadoes.py; tornadoes.json carries both and the contract test checks. */
export const TRACK_FIELDS = ["lat", "lon", "dlat", "dlon", "mag"] as const;
export const COUNTY_FIELDS = ["year", "all", "strong"] as const;
/** Coordinates are stored in hundredths of a degree. */
export const COORD_SCALE = 100;

/** us-atlas's pre-projected frame: geoAlbersUsa().scale(1300).translate([487.5, 305]). */
export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;
export const ALBERS_SCALE = 1300;
export const ALBERS_TRANSLATE: readonly [number, number] = [487.5, 305];

/** 1950 to the last year plays in this long, then holds the final frame before looping. */
export const PLAY_MS = 20_000;
export const HOLD_MS = 2_500;
/** A year's tracks stay bright through their year, then fade over this many years. */
export const FLASH_FADE_YEARS = 1.5;

export const STRONG_MIN_MAG = 3;
/** Heat colour domain caps at this percentile of final county totals, so a few huge counties do not wash out the map. */
export const HEAT_PERCENTILE = 0.99;

export const EMPTY_FILL = "#171a21";
export const TRACK_COLOR = "#fff3c4";
export const STATE_STROKE = "rgba(255, 255, 255, 0.28)";
/** Line width in map units by F/EF rating 0–5; unknown ratings draw thinnest. */
export const TRACK_WIDTH_BY_MAG = [0.5, 0.7, 1, 1.4, 1.9, 2.5] as const;
export const UNKNOWN_TRACK_WIDTH = 0.5;

/** Spec §6: about 2 MB per showcase. tornadoes.json alone; the county atlas (~0.8 MB) is shared map geometry. */
export const DATA_BUDGET_BYTES = 2_200_000;
```

- [ ] **Step 3: Write the contract test** `src/test/unit/tornadoes/contract.test.ts`:

```ts
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COUNTY_FIELDS, DATA_BUDGET_BYTES, TRACK_FIELDS } from "../../../web/tornadoes/config.js";
import type { TornadoFile } from "../../../web/tornadoes/lib/data.js";

const PATH = "public/data/tornadoes/tornadoes.json";
const file = JSON.parse(readFileSync(PATH, "utf8")) as TornadoFile;
const atlas = JSON.parse(readFileSync("public/data/tornadoes/counties.json", "utf8")) as {
  objects: { counties: { geometries: { id: string }[] } };
};

describe("the tornado data contract", () => {
  it("agrees with the pipeline on field order", () => {
    expect(file.trackFields).toEqual([...TRACK_FIELDS]);
    expect(file.countyFields).toEqual([...COUNTY_FIELDS]);
  });

  it("starts in 1950 and has one track array per year", () => {
    expect(file.firstYear).toBe(1950);
    expect(file.lastYear).toBeGreaterThanOrEqual(2024);
    expect(file.tracks).toHaveLength(file.lastYear - file.firstYear + 1);
    for (const year of file.tracks) expect(year.length % TRACK_FIELDS.length).toBe(0);
  });

  it("only names counties that exist in the atlas", () => {
    const ids = new Set(atlas.objects.counties.geometries.map((g) => g.id));
    for (const fips of Object.keys(file.counties)) expect(ids.has(fips), fips).toBe(true);
  });

  it("stays inside the data budget", () => {
    expect(statSync(PATH).size).toBeLessThanOrEqual(DATA_BUDGET_BYTES);
  });
});
```

It needs the `TornadoFile` type, so first create `src/web/tornadoes/lib/data.ts` with the interface from Task 9 Step 3 (the interface only; Task 9 adds the functions).

- [ ] **Step 4: Run it.**

Run: `pnpm test src/test/unit/tornadoes/contract.test.ts`
Expected: PASS. If the budget fails, report the size to Josh rather than raising the budget on your own. The first lever is dropping `TRACK_FIELDS` precision to tenths for rows with no end point, which changes both sides and their tests.

- [ ] **Step 5: Commit** (the data in its own commit, so the diff stays readable):

```bash
git add public/data/tornadoes src/web/tornadoes/config.ts src/web/tornadoes/lib/data.ts src/test/unit/tornadoes/contract.test.ts
git commit -m "feat: tornado data 1950-2025 from NOAA SPC, with contract test"
```

---

### Task 9: The tornado math (pure)

**Files:**
- Modify: `src/web/tornadoes/lib/data.ts`
- Create: `src/web/tornadoes/lib/totals.ts`, `lib/timeline.ts`, `lib/scale.ts`
- Test: `src/test/unit/tornadoes/{data,totals,timeline,scale}.test.ts`
- Modify: `package.json` (dependencies)

**Interfaces:**
- Consumes: the Task 8 config constants
- Produces:
  - `interface TornadoFile { generatedAt: string; source: string; firstYear: number; lastYear: number; trackFields: string[]; countyFields: string[]; tracks: number[][]; counties: Record<string, number[][]>; unmatchedCountyRefs: number }`
  - `interface Track { x0: number; y0: number; x1: number; y1: number; mag: number }`
  - `type Project = (lonLat: [number, number]) => [number, number] | null`
  - `decodeTracks(tracks: number[][], project: Project): { byYear: Track[][]; dropped: number }`
  - `buildCumulative(counties: Record<string, number[][]>, years: number, strongOnly: boolean): Map<string, Int32Array>`
  - `countAt(cumulative: ReadonlyMap<string, Int32Array>, fips: string, yearIndex: number): number`
  - `maxFinal(cumulative: ReadonlyMap<string, Int32Array>, percentile: number): number`
  - `interface Timeline { years: number; playMs: number; holdMs: number }`
  - `positionAt(elapsedMs: number, t: Timeline): number` (0…years, looping)
  - `yearIndexAt(position: number, years: number): number` (0…years-1)
  - `positionForYearIndex(yearIndex: number): number` (yearIndex + 1)
  - `elapsedForPosition(position: number, t: Timeline): number`
  - `trackAlpha(trackYearIndex: number, position: number, fadeYears: number): number` (0…1)
  - `heatScale(max: number, empty: string): (count: number) => string`
  - `trackWidth(mag: number): number`

- [ ] **Step 1: Add the dependencies.**

```bash
pnpm add d3-geo d3-scale topojson-client
pnpm add -D @types/d3-geo @types/d3-scale @types/topojson-client @types/topojson-specification
```

- [ ] **Step 2: Write the failing tests.**

`src/test/unit/tornadoes/data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeTracks } from "../../../web/tornadoes/lib/data.js";
import type { Project } from "../../../web/tornadoes/lib/data.js";

// A fake projection: x = lon, y = lat; anything south of 20°N is "off the map".
const project: Project = ([lon, lat]) => (lat < 20 ? null : [lon, lat]);

describe("decodeTracks", () => {
  it("decodes start and end from hundredths and deltas", () => {
    const { byYear, dropped } = decodeTracks([[3673, -10252, 15, 22, 1]], project);
    expect(dropped).toBe(0);
    expect(byYear[0][0]).toEqual({ x0: -102.52, y0: 36.73, x1: -102.3, y1: 36.88, mag: 1 });
  });

  it("draws a tornado with no end point as a point at its start", () => {
    const { byYear } = decodeTracks([[3417, -7860, 0, 0, 3]], project);
    const t = byYear[0][0];
    expect([t.x1, t.y1]).toEqual([t.x0, t.y0]);
  });

  it("drops and counts tracks off the map, never drawing them at the origin", () => {
    const { byYear, dropped } = decodeTracks([[3673, -10252, 15, 22, 1, 1840, -6610, 1, 1, 0]], project);
    expect(byYear[0]).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it("falls back to the start when only the end is off the map", () => {
    const { byYear } = decodeTracks([[2001, -8000, -5, 0, 0]], project);
    const t = byYear[0][0];
    expect([t.x1, t.y1]).toEqual([t.x0, t.y0]);
  });

  it("keeps one array per year, empty years included", () => {
    expect(decodeTracks([[], [3673, -10252, 0, 0, 0]], project).byYear.map((y) => y.length)).toEqual([0, 1]);
  });
});
```

`src/test/unit/tornadoes/totals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCumulative, countAt, maxFinal } from "../../../web/tornadoes/lib/totals.js";

const counties = { "40025": [[0, 2, 1], [2, 3, 0]], "37047": [[1, 1, 1]] };

describe("buildCumulative", () => {
  it("builds a running total per county through each year", () => {
    const cum = buildCumulative(counties, 3, false);
    expect([...cum.get("40025")!]).toEqual([2, 2, 5]);
    expect([...cum.get("37047")!]).toEqual([0, 1, 1]);
  });

  it("counts only EF3+ when strongOnly", () => {
    const cum = buildCumulative(counties, 3, true);
    expect([...cum.get("40025")!]).toEqual([1, 1, 1]);
  });

  it("does not modify its input", () => {
    const copy = JSON.parse(JSON.stringify(counties));
    buildCumulative(counties, 3, false);
    expect(counties).toEqual(copy);
  });
});

describe("countAt", () => {
  const cum = buildCumulative(counties, 3, false);
  it("reads a county's total through a year", () => expect(countAt(cum, "40025", 1)).toBe(2));
  it("is 0 for a county with no tornadoes", () => expect(countAt(cum, "99999", 2)).toBe(0));
  it("clamps the year index into range", () => {
    expect(countAt(cum, "40025", -1)).toBe(0);
    expect(countAt(cum, "40025", 99)).toBe(5);
  });
});

describe("maxFinal", () => {
  it("is the percentile of final totals, at least 1", () => {
    const cum = buildCumulative(counties, 3, false);
    expect(maxFinal(cum, 1)).toBe(5);
    expect(maxFinal(new Map(), 0.99)).toBe(1);
  });
});
```

`src/test/unit/tornadoes/timeline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  elapsedForPosition, positionAt, positionForYearIndex, trackAlpha, yearIndexAt,
} from "../../../web/tornadoes/lib/timeline.js";

const t = { years: 10, playMs: 1000, holdMs: 500 };

describe("positionAt", () => {
  it("runs 0 to years over playMs", () => {
    expect(positionAt(0, t)).toBe(0);
    expect(positionAt(500, t)).toBe(5);
  });
  it("holds at the end, then loops", () => {
    expect(positionAt(1200, t)).toBe(10);
    expect(positionAt(1500, t)).toBe(0);
    expect(positionAt(2000, t)).toBe(5);
  });
});

describe("yearIndexAt", () => {
  it("floors the position and clamps to the last year", () => {
    expect(yearIndexAt(0, 10)).toBe(0);
    expect(yearIndexAt(3.7, 10)).toBe(3);
    expect(yearIndexAt(10, 10)).toBe(9);
  });
});

describe("scrubbing", () => {
  it("puts a scrubbed year at its end, so its heat and tracks are shown", () => {
    expect(positionForYearIndex(4)).toBe(5);
    expect(yearIndexAt(positionForYearIndex(4), 10)).toBe(4);
  });
  it("resumes play from the scrubbed position, not from the start", () => {
    expect(positionAt(elapsedForPosition(5, t), t)).toBe(5);
  });
});

describe("trackAlpha", () => {
  it("is 0 before the track's year", () => expect(trackAlpha(5, 4.9, 1.5)).toBe(0));
  it("is 1 during its year and just after", () => {
    expect(trackAlpha(5, 5.2, 1.5)).toBe(1);
    expect(trackAlpha(5, 6, 1.5)).toBe(1);
  });
  it("fades to 0 over fadeYears", () => {
    expect(trackAlpha(5, 6.75, 1.5)).toBeCloseTo(0.5);
    expect(trackAlpha(5, 8, 1.5)).toBe(0);
  });
});
```

`src/test/unit/tornadoes/scale.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { UNKNOWN_TRACK_WIDTH, TRACK_WIDTH_BY_MAG } from "../../../web/tornadoes/config.js";
import { heatScale, trackWidth } from "../../../web/tornadoes/lib/scale.js";

describe("heatScale", () => {
  const color = heatScale(100, "#000");
  it("draws a county with none as the empty fill", () => expect(color(0)).toBe("#000"));
  it("gets brighter with more tornadoes and clamps above max", () => {
    expect(color(1)).not.toBe(color(100));
    expect(color(1000)).toBe(color(100));
  });
});

describe("trackWidth", () => {
  it("widens with rating", () => expect(trackWidth(5)).toBeGreaterThan(trackWidth(0)));
  it("uses the table for known ratings", () => expect(trackWidth(3)).toBe(TRACK_WIDTH_BY_MAG[3]));
  it("draws an unknown rating thinnest", () => expect(trackWidth(-1)).toBe(UNKNOWN_TRACK_WIDTH));
});
```

- [ ] **Step 3: Run the tests to check they fail.**

Run: `pnpm test src/test/unit/tornadoes`
Expected: FAIL (missing exports).

- [ ] **Step 4: Implement.**

`src/web/tornadoes/lib/data.ts`:

```ts
import { COORD_SCALE, TRACK_FIELDS } from "../config.js";

export interface TornadoFile {
  generatedAt: string;
  source: string;
  firstYear: number;
  lastYear: number;
  trackFields: string[];
  countyFields: string[];
  /** One flat array per year: TRACK_FIELDS.length ints per tornado. */
  tracks: number[][];
  /** fips -> [[yearOffset, all, strong], ...], sorted by year. */
  counties: Record<string, number[][]>;
  unmatchedCountyRefs: number;
}

/** A track in map coordinates. A point tornado has x1,y1 equal to x0,y0. */
export interface Track {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  mag: number;
}

export type Project = (lonLat: [number, number]) => [number, number] | null;

const STRIDE = TRACK_FIELDS.length;

export function decodeTracks(tracks: number[][], project: Project): { byYear: Track[][]; dropped: number } {
  let dropped = 0;
  const byYear = tracks.map((flat) => {
    const out: Track[] = [];
    for (let i = 0; i + STRIDE <= flat.length; i += STRIDE) {
      const lat = flat[i] / COORD_SCALE;
      const lon = flat[i + 1] / COORD_SCALE;
      const start = project([lon, lat]);
      if (!start) {
        dropped += 1;
        continue;
      }
      // Sum in integer hundredths before dividing, so 3673 + 15 is exactly 36.88.
      const end = project([(flat[i + 1] + flat[i + 3]) / COORD_SCALE, (flat[i] + flat[i + 2]) / COORD_SCALE]) ?? start;
      out.push({ x0: start[0], y0: start[1], x1: end[0], y1: end[1], mag: flat[i + 4] });
    }
    return out;
  });
  return { byYear, dropped };
}
```

`src/web/tornadoes/lib/totals.ts`:

```ts
import { quantile } from "d3-array";

/** Running total per county, indexed by year offset. Built once per toggle state. */
export function buildCumulative(
  counties: Record<string, number[][]>,
  years: number,
  strongOnly: boolean,
): Map<string, Int32Array> {
  const out = new Map<string, Int32Array>();
  for (const [fips, entries] of Object.entries(counties)) {
    const perYear = new Int32Array(years);
    for (const [year, all, strong] of entries) {
      if (year >= 0 && year < years) perYear[year] += strongOnly ? strong : all;
    }
    for (let i = 1; i < years; i += 1) perYear[i] += perYear[i - 1];
    out.set(fips, perYear);
  }
  return out;
}

export function countAt(cumulative: ReadonlyMap<string, Int32Array>, fips: string, yearIndex: number): number {
  const series = cumulative.get(fips);
  if (!series || yearIndex < 0) return 0;
  return series[Math.min(yearIndex, series.length - 1)];
}

/** The colour-domain top: a percentile of final totals, never below 1. */
export function maxFinal(cumulative: ReadonlyMap<string, Int32Array>, percentile: number): number {
  const finals = [...cumulative.values()].map((s) => s[s.length - 1]);
  return Math.max(1, quantile(finals, percentile) ?? 0);
}
```

`src/web/tornadoes/lib/timeline.ts`:

```ts
export interface Timeline {
  years: number;
  playMs: number;
  holdMs: number;
}

/** Position in years since the first year, 0..years. Holds at `years` for holdMs, then loops. */
export function positionAt(elapsedMs: number, t: Timeline): number {
  const e = elapsedMs % (t.playMs + t.holdMs);
  return e >= t.playMs ? t.years : (e / t.playMs) * t.years;
}

export function yearIndexAt(position: number, years: number): number {
  return Math.min(years - 1, Math.max(0, Math.floor(position)));
}

/** A scrubbed year sits at its end: its heat is counted and its tracks are bright. */
export function positionForYearIndex(yearIndex: number): number {
  return yearIndex + 1;
}

export function elapsedForPosition(position: number, t: Timeline): number {
  return (Math.min(position, t.years) / t.years) * t.playMs;
}

/** Bright from the start of its year through one year later, then fading out over fadeYears. */
export function trackAlpha(trackYearIndex: number, position: number, fadeYears: number): number {
  const age = position - trackYearIndex;
  if (age < 0) return 0;
  if (age <= 1) return 1;
  return Math.max(0, 1 - (age - 1) / fadeYears);
}
```

`src/web/tornadoes/lib/scale.ts`:

```ts
import { scaleSequentialSqrt } from "d3-scale";
import { interpolateInferno } from "d3-scale-chromatic";
import { TRACK_WIDTH_BY_MAG, UNKNOWN_TRACK_WIDTH } from "../config.js";

/** Sequential heat for a running county total. 0 is the empty fill; the top of inferno is left out so tracks stay brighter. */
export function heatScale(max: number, empty: string): (count: number) => string {
  const scale = scaleSequentialSqrt((t: number) => interpolateInferno(0.15 + t * 0.8))
    .domain([0, max])
    .clamp(true);
  return (count) => (count <= 0 ? empty : scale(count));
}

export function trackWidth(mag: number): number {
  return TRACK_WIDTH_BY_MAG[mag] ?? UNKNOWN_TRACK_WIDTH;
}
```

(`buildCumulative` mutates only the `Int32Array` it creates and never its input, which the test pins.)

- [ ] **Step 5: Run the tests to check they pass.**

Run: `pnpm test && pnpm test:coverage && pnpm typecheck`
Expected: PASS, with coverage at 80% or more.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat: tornado track decoding, running county totals, timeline and scales"
```

---

### Task 10: The tornadoes page (canvas, controls, error state, registry entry)

**Files:**
- Create: `src/web/tornadoes/draw.ts`, `src/web/tornadoes/index.ts`, `public/tornadoes/index.html`, `public/tornadoes/tornadoes.css`, `src/test/e2e/tornadoes.spec.ts`
- Modify: `src/web/shell/registry.ts` (add the entry), `CLAUDE.md` (a routing row for tornadoes), `src/CONTEXT.md` (layout)

**Interfaces:**
- Consumes: everything from Tasks 8 and 9, plus `mountShell` and `shouldAutoplay`
- Produces: `interface Scene`, `drawFrame(ctx, scene, position, strongOnly): void`, `countyAt(ctx, scene, px, py): County | null`

- [ ] **Step 1: Write the failing e2e tests.** `src/test/e2e/tornadoes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const litPixels = (page: import("@playwright/test").Page) =>
  page.locator("#map").evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit += 1;
    return lit;
  });

test("draws the map and a year label", async ({ page }) => {
  await page.goto("/tornadoes/");
  await expect(page.locator("#map")).toHaveAttribute("data-drawn", "true");
  expect(await litPixels(page)).toBeGreaterThan(1000);
  await expect(page.locator("#year-label")).toHaveText(/^(19[5-9]\d|20[0-2]\d)$/);
  await expect(page.locator("#footer .credit")).toContainText("Not affiliated with NOAA");
});

test("plays on its own", async ({ page }) => {
  await page.goto("/tornadoes/");
  const first = await page.locator("#year-label").textContent();
  await expect(page.locator("#year-label")).not.toHaveText(first ?? "", { timeout: 5000 });
});

test("scrubbing pauses on exactly that year, and play resumes from it", async ({ page }) => {
  await page.goto("/tornadoes/");
  await page.locator("#year").fill("24"); // 1950 + 24
  await expect(page.locator("#year-label")).toHaveText("1974");
  await expect(page.locator("#play")).toHaveText("Play");
  await page.waitForTimeout(600);
  await expect(page.locator("#year-label")).toHaveText("1974");
  await page.locator("#play").click();
  await expect(page.locator("#play")).toHaveText("Pause");
  await expect(page.locator("#year-label")).not.toHaveText(/^195\d$/);
});

test("tapping a county names it and its count; EF3+ lowers the count", async ({ page }) => {
  await page.goto("/tornadoes/");
  await page.locator("#year").fill("75");
  const box = (await page.locator("#map").boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.locator("#county-info")).toHaveText(/, .+: \d+ tornado/);
  const all = Number((await page.locator("#county-info").textContent())!.match(/(\d+) tornado/)![1]);
  await page.locator("#strong").check();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const strong = Number((await page.locator("#county-info").textContent())!.match(/(\d+) tornado/)![1]);
  expect(strong).toBeLessThanOrEqual(all);
});

test("reduced motion opens paused on the last year; record mode still plays", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tornadoes/");
  await expect(page.locator("#map")).toHaveAttribute("data-drawn", "true");
  await expect(page.locator("#play")).toHaveText("Play");
  const last = await page.locator("#year").getAttribute("max");
  await expect(page.locator("#year")).toHaveValue(last!);

  await page.goto("/tornadoes/?rec");
  await expect(page.locator("#play")).toHaveText("Pause");
});

test("a failed data load shows the error and retries", async ({ page }) => {
  await page.route("**/data/tornadoes/tornadoes.json", (route) => route.abort());
  await page.goto("/tornadoes/");
  await expect(page.locator(".load-error")).toContainText("Couldn't load the tornadoes data");
  await page.unroute("**/data/tornadoes/tornadoes.json");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("#map")).toHaveAttribute("data-drawn", "true");
  await expect(page.locator(".load-error")).toBeHidden();
});
```

- [ ] **Step 2: Run the tests to check they fail.**

Run: `pnpm test:e2e src/test/e2e/tornadoes.spec.ts`
Expected: FAIL (404 on `/tornadoes/`).

- [ ] **Step 3: Add the registry entry.** In `src/web/shell/registry.ts`, append this to `SHOWCASES`:

```ts
  {
    slug: "tornadoes",
    title: "US Tornadoes",
    hook: "Every US tornado since 1950",
    credit: "Data: NOAA Storm Prediction Center severe weather database. Not affiliated with NOAA.",
  },
```

- [ ] **Step 4: Write the page** `public/tornadoes/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Every US tornado since 1950 · viz</title>
    <meta name="description" content="Every tornado NOAA recorded in the US since 1950, county by county, year by year." />
    <link rel="stylesheet" href="/viz.css" />
    <link rel="stylesheet" href="/tornadoes/tornadoes.css" />
    <script type="module" src="/js/pages/tornadoes.js"></script>
  </head>
  <body>
    <header id="viz-header"></header>
    <main>
      <div class="stage">
        <output id="year-label" aria-live="off"></output>
        <canvas id="map" role="img" aria-label="Map of US counties shaded by tornado count, with tornado tracks"></canvas>
        <p id="county-info" role="status" aria-live="polite"></p>
      </div>
      <div class="controls">
        <button id="play" type="button">Pause</button>
        <input id="year" type="range" min="0" step="1" aria-label="Year" />
        <label><input id="strong" type="checkbox" /> EF3+ only</label>
      </div>
      <p class="load-error" role="alert" hidden></p>
    </main>
    <footer id="footer"></footer>
  </body>
</html>
```

`public/tornadoes/tornadoes.css`:

```css
main { padding: 16px 24px; }
.stage { position: relative; }
#map { display: block; width: 100%; height: auto; aspect-ratio: 975 / 610; background: var(--bg); touch-action: manipulation; }
#year-label { position: absolute; top: 4px; right: 8px; font-size: 44px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; pointer-events: none; }
#county-info { min-height: 1.5em; margin: 8px 0 0; color: var(--muted); }
.controls { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-top: 8px; color: var(--muted); }
#year { flex: 1; min-width: 160px; accent-color: var(--accent); }
html.rec main { padding: 8px 12px; display: flex; flex-direction: column; justify-content: center; }
html.rec #year-label { font-size: 64px; position: static; display: block; text-align: center; }
```

- [ ] **Step 5: Write the canvas drawing** `src/web/tornadoes/draw.ts`:

```ts
import { FLASH_FADE_YEARS, STATE_STROKE, STRONG_MIN_MAG, TRACK_COLOR } from "./config.js";
import type { Track } from "./lib/data.js";
import { trackWidth } from "./lib/scale.js";
import { yearIndexAt, trackAlpha } from "./lib/timeline.js";
import { countAt } from "./lib/totals.js";

export interface County {
  fips: string;
  name: string;
  path: Path2D;
}

export interface Heat {
  cumulative: ReadonlyMap<string, Int32Array>;
  color: (count: number) => string;
}

export interface Scene {
  years: number;
  counties: County[];
  states: Path2D;
  tracks: Track[][];
  all: Heat;
  strong: Heat;
}

/** Draw one frame at `position` (years since the first year). The ctx transform maps map units to device pixels. */
export function drawFrame(ctx: CanvasRenderingContext2D, scene: Scene, position: number, strongOnly: boolean): void {
  const heat = strongOnly ? scene.strong : scene.all;
  const yearIndex = yearIndexAt(position, scene.years);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const county of scene.counties) {
    ctx.fillStyle = heat.color(countAt(heat.cumulative, county.fips, yearIndex));
    ctx.fill(county.path);
  }
  ctx.strokeStyle = STATE_STROKE;
  ctx.lineWidth = 0.5;
  ctx.stroke(scene.states);

  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = TRACK_COLOR;
  ctx.lineCap = "round";
  const oldest = Math.max(0, Math.floor(position - 1 - FLASH_FADE_YEARS));
  for (let y = oldest; y <= yearIndex; y += 1) {
    const alpha = trackAlpha(y, position, FLASH_FADE_YEARS);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    for (const t of scene.tracks[y]) {
      if (strongOnly && t.mag < STRONG_MIN_MAG) continue;
      ctx.lineWidth = trackWidth(t.mag);
      ctx.beginPath();
      ctx.moveTo(t.x0, t.y0);
      ctx.lineTo(t.x1 + 0.01, t.y1); // a zero-length round-capped line draws a dot
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** The county under a device-pixel point, or null. isPointInPath applies the current transform. */
export function countyAt(ctx: CanvasRenderingContext2D, scene: Scene, px: number, py: number): County | null {
  return scene.counties.find((c) => ctx.isPointInPath(c.path, px, py)) ?? null;
}
```

- [ ] **Step 6: Write the wiring** `src/web/tornadoes/index.ts`:

```ts
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { mountShell } from "../shell/mount.js";
import { REPO_URL } from "../shell/config.js";
import { shouldAutoplay } from "../shell/lib/rec.js";
import {
  ALBERS_SCALE, ALBERS_TRANSLATE, DATA_BASE, EMPTY_FILL, HEAT_PERCENTILE, HOLD_MS, MAP_HEIGHT, MAP_WIDTH, PLAY_MS,
} from "./config.js";
import { countyAt, drawFrame } from "./draw.js";
import type { County, Scene } from "./draw.js";
import { decodeTracks } from "./lib/data.js";
import type { Project, TornadoFile } from "./lib/data.js";
import { heatScale } from "./lib/scale.js";
import { elapsedForPosition, positionAt, positionForYearIndex, yearIndexAt } from "./lib/timeline.js";
import type { Timeline } from "./lib/timeline.js";
import { buildCumulative, countAt, maxFinal } from "./lib/totals.js";

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

const { rec, footerDetail } = mountShell("tornadoes");
const canvas = el<HTMLCanvasElement>("map");
const yearLabel = el<HTMLOutputElement>("year-label");
const playButton = el<HTMLButtonElement>("play");
const yearInput = el<HTMLInputElement>("year");
const strongInput = el<HTMLInputElement>("strong");
const countyInfo = el("county-info");
const errorBox = document.querySelector<HTMLElement>(".load-error");
if (!errorBox) throw new Error("missing .load-error");
const ctxOrNull = canvas.getContext("2d");
if (!ctxOrNull) throw new Error("canvas 2d unavailable");
const ctx: CanvasRenderingContext2D = ctxOrNull;

type CountiesTopology = Topology<{ counties: GeometryCollection<{ name: string }>; states: GeometryCollection<{ name: string }> }>;

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${DATA_BASE}/${path}`);
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return (await response.json()) as T;
}

function buildScene(file: TornadoFile, topo: CountiesTopology): Scene {
  const albers = geoAlbersUsa().scale(ALBERS_SCALE).translate([...ALBERS_TRANSLATE]);
  const project: Project = (lonLat) => albers(lonLat);
  const path = geoPath(); // the atlas is already projected into the 975x610 frame
  const stateNames = new Map(topo.objects.states.geometries.map((g) => [String(g.id), g.properties?.name ?? ""]));
  const counties: County[] = feature(topo, topo.objects.counties).features.map((f) => ({
    fips: String(f.id),
    name: `${f.properties.name}, ${stateNames.get(String(f.id).slice(0, 2)) ?? ""}`,
    path: new Path2D(path(f) ?? ""),
  }));
  const states = new Path2D(path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? "");
  const years = file.lastYear - file.firstYear + 1;
  const { byYear, dropped } = decodeTracks(file.tracks, project);
  if (dropped > 0) console.info(`tornadoes: ${dropped} tracks outside the US map (PR, VI) not drawn`);
  const allCum = buildCumulative(file.counties, years, false);
  const strongCum = buildCumulative(file.counties, years, true);
  return {
    years,
    counties,
    states,
    tracks: byYear,
    all: { cumulative: allCum, color: heatScale(maxFinal(allCum, HEAT_PERCENTILE), EMPTY_FILL) },
    strong: { cumulative: strongCum, color: heatScale(maxFinal(strongCum, HEAT_PERCENTILE), EMPTY_FILL) },
  };
}

function sizeCanvas(): number {
  const ratio = window.devicePixelRatio || 1;
  const scale = (canvas.clientWidth * ratio) / MAP_WIDTH;
  canvas.width = Math.round(MAP_WIDTH * scale);
  canvas.height = Math.round(MAP_HEIGHT * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return scale;
}

function run(file: TornadoFile, scene: Scene): void {
  const timeline: Timeline = { years: scene.years, playMs: PLAY_MS, holdMs: HOLD_MS };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let playing = shouldAutoplay(rec, reduced);
  let position = playing ? 0 : scene.years;
  let startedAt = performance.now();
  let lastYearIndex = -1;

  yearInput.max = String(scene.years - 1);
  sizeCanvas();

  const render = (): void => {
    drawFrame(ctx, scene, position, strongInput.checked);
    const yearIndex = yearIndexAt(position, scene.years);
    if (yearIndex !== lastYearIndex) {
      yearLabel.textContent = String(file.firstYear + yearIndex);
      yearInput.value = String(yearIndex);
      lastYearIndex = yearIndex;
    }
    canvas.dataset.drawn = "true";
  };

  const setPlaying = (next: boolean): void => {
    playing = next;
    playButton.textContent = playing ? "Pause" : "Play";
    if (playing) {
      startedAt = performance.now() - elapsedForPosition(position >= scene.years ? 0 : position, timeline);
      requestAnimationFrame(tick);
    }
  };

  const tick = (now: number): void => {
    if (!playing) return;
    position = positionAt(now - startedAt, timeline);
    render();
    requestAnimationFrame(tick);
  };

  playButton.addEventListener("click", () => setPlaying(!playing));
  yearInput.addEventListener("input", () => {
    setPlaying(false);
    position = positionForYearIndex(Number(yearInput.value));
    render();
  });
  strongInput.addEventListener("change", () => {
    countyInfo.textContent = "";
    render();
  });
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const county = countyAt(ctx, scene, px, py);
    if (!county) {
      countyInfo.textContent = "";
      return;
    }
    const heat = strongInput.checked ? scene.strong : scene.all;
    const yearIndex = yearIndexAt(position, scene.years);
    const n = countAt(heat.cumulative, county.fips, yearIndex);
    const rated = strongInput.checked ? " rated EF3+" : "";
    countyInfo.textContent = `${county.name}: ${n} tornado${n === 1 ? "" : "es"}${rated}, ${file.firstYear}–${file.firstYear + yearIndex}`;
  });
  window.addEventListener("resize", () => {
    sizeCanvas();
    render();
  });

  setPlaying(playing);
  render();
}

async function start(): Promise<void> {
  errorBox!.hidden = true;
  try {
    const [file, topo] = await Promise.all([
      getJson<TornadoFile>("tornadoes.json"),
      getJson<CountiesTopology>("counties.json"),
    ]);
    footerDetail.replaceChildren(`${file.source}, pulled ${file.generatedAt.slice(0, 10)}. `, sourceLink());
    run(file, buildScene(file, topo));
  } catch (error) {
    console.error(error);
    showLoadError();
  }
}

function sourceLink(): HTMLAnchorElement {
  const a = document.createElement("a");
  a.href = REPO_URL;
  a.textContent = "Source";
  return a;
}

function showLoadError(): void {
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Retry";
  retry.addEventListener("click", () => void start(), { once: true });
  errorBox!.replaceChildren("Couldn't load the tornadoes data.", retry);
  errorBox!.hidden = false;
}

void start();
```

`countyInfo` reads, for example, "Sedgwick, Kansas: 12 tornadoes rated EF3+, 1950–2025". The e2e regex `(\d+) tornado` matches it with and without the toggle.

- [ ] **Step 7: Run everything.**

Run: `pnpm typecheck && pnpm test && pnpm test:e2e`
Expected: PASS, including the shell tests, which now also reach `/tornadoes/` through the dropdown and the grid.

- [ ] **Step 8: Look at it and time it.** Run `pnpm dev`, then open `/tornadoes/` and `/tornadoes/?rec` in a 1080×1920 window. Check that the full 1950→2025 run takes about 20 s, that frames stay smooth (use DevTools Performance and look for frames over 16 ms), that the tracks read as bright lines over the heat, and that April 2011 and 1974 stand out. If frames drop, cache the county layer: draw the heat to an offscreen canvas only when the year index changes, and composite it each frame. Record a short screen capture of the record mode for the PR.

- [ ] **Step 9: Update the docs.** In `CLAUDE.md`, add a routing row "Change the tornado map", with the start being `src/web/tornadoes/config.ts`, then `lib/`, and the skip being `scripts/`. In `src/CONTEXT.md`, add `tornadoes/` to the layout.

- [ ] **Step 10: Commit.**

```bash
git add -A
git commit -m "feat: tornadoes showcase: county heat and track flashes, 1950 onward"
```

---

### Task 11: Ship phase 2

- [ ] **Step 1: Review.** Dispatch the code-reviewer agent on `git diff origin/main...HEAD` and fix CRITICAL and HIGH findings. Then run `pnpm typecheck && pnpm test:coverage && pnpm test:e2e && pnpm data:test`.
- [ ] **Step 2: Open the PR** with the screen capture, the note that the data covers 1950–2025 rather than the spec's 1950–2024, and the `unmatchedCountyRefs` count. **[Josh]** merges it.
- [ ] **Step 3: [Josh] approves the deploy.** Then run `pnpm run deploy` from an up-to-date `main`. Verify with `curl -sI https://viz.jmlr.dev/tornadoes/ | head -1` (200) and by opening `https://viz.jmlr.dev/tornadoes/?rec` on a phone.
- [ ] **Step 4: hq (spec §9, §10).** In a small status-only hq PR, rewrite the viz line in `now.md` to "phases 1–2 live", and add quakes, the scoring race and flights under "Parked, and why" with the reason "after Fantasy IQ opens 2026-10-20". Merge it yourself.
- [ ] **Step 5: Follow-up outside this repo (spec §10), for a separate session.** The `jmlr-dev` work card becomes the viz card: a new name, blurb and link, and a new 2176×1360 screenshot. Put it in the handoff as the next step rather than doing it here.
