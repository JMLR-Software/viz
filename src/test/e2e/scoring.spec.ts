import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

/** Saturated pixels: the bars. The page background is transparent and the labels are grey or near-black. */
const barPixels = (page: Page) =>
  page.locator("#race").evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 60) n += 1;
    }
    return n;
  });

const scoring = async (request: APIRequestContext) =>
  (await (await request.get("/data/scoring/scoring.json")).json()) as { seasons: string[]; startSeason: number };

test("draws ten bars, a season and the start note", async ({ page }) => {
  await page.goto("/scoring/");
  await expect(page.locator("#race")).toHaveAttribute("data-drawn", "true");
  expect(await barPixels(page)).toBeGreaterThan(5000);
  await expect(page.locator("#season-label")).toHaveText(/^\d{4}-\d{2}$/);
  await expect(page.locator("#start-note")).toContainText(/^Starts in \d{4}-\d{2}, the first season the top 10/);
  await expect(page.locator("#footer .credit")).toContainText("Not affiliated with the NBA");
});

test("plays on its own, starting at the start season", async ({ page, request }) => {
  const file = await scoring(request);
  await page.goto("/scoring/");
  await expect(page.locator("#race")).toHaveAttribute("data-drawn", "true");
  const first = file.seasons.indexOf((await page.locator("#season-label").textContent())!);
  expect(first).toBeGreaterThanOrEqual(file.startSeason);
  expect(first).toBeLessThan(file.startSeason + 3); // it opens at the start, not at 1946-47 or the end
  await expect(page.locator("#season-label")).not.toHaveText(file.seasons[first], { timeout: 5000 });
});

test("scrubbing pauses on exactly that season, and play resumes from it", async ({ page, request }) => {
  const file = await scoring(request);
  const target = file.startSeason + 20;
  await page.goto("/scoring/");
  await page.locator("#season").fill(String(target));
  await expect(page.locator("#season-label")).toHaveText(file.seasons[target]);
  await expect(page.locator("#play")).toHaveText("Play");
  await page.waitForTimeout(600);
  await expect(page.locator("#season-label")).toHaveText(file.seasons[target]);
  await page.locator("#play").click();
  await expect(page.locator("#play")).toHaveText("Pause");
  await expect(page.locator("#season-label")).not.toHaveText(file.seasons[target], { timeout: 3000 });
  const shown = file.seasons.indexOf((await page.locator("#season-label").textContent())!);
  expect(shown).toBeGreaterThan(target);
});

test("reduced motion opens paused on the last season; record mode still plays", async ({ page, request }) => {
  const file = await scoring(request);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/scoring/");
  await expect(page.locator("#play")).toHaveText("Play");
  await expect(page.locator("#season-label")).toHaveText(file.seasons[file.seasons.length - 1]);

  await page.goto("/scoring/?rec");
  await expect(page.locator("#play")).toHaveText("Pause");
});

test("a failed data load shows the error and retries", async ({ page }) => {
  await page.route("**/data/scoring/scoring.json", (route) => route.abort());
  await page.goto("/scoring/");
  await expect(page.locator(".load-error")).toContainText("Couldn't load the scoring data");
  await page.unroute("**/data/scoring/scoring.json");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("#race")).toHaveAttribute("data-drawn", "true");
  await expect(page.locator(".load-error")).toBeHidden();
});

test("record mode fits the phone frame: nothing under the header or the footer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/scoring/?rec");
  await expect(page.locator("#race")).toHaveAttribute("data-drawn", "true");
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
  const header = await box("#viz-header");
  const footer = await box("footer");
  expect((await box("#season-label")).y).toBeGreaterThanOrEqual(header.y + header.height);
  for (const sel of ["#race", "#season-label", "#season"]) {
    const b = await box(sel);
    expect(b.y + b.height).toBeLessThanOrEqual(footer.y);
  }
  // The backing store follows the box after layout settles, so the chart is neither blurry nor oversized.
  await expect.poll(() => page.locator("#race").evaluate((c: HTMLCanvasElement) => c.width - c.clientWidth)).toBe(0);
});
