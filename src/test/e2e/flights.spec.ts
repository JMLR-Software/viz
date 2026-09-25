import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { geoAlbersUsa } from "d3-geo";
import { ALBERS_SCALE, ALBERS_TRANSLATE, MAP_HEIGHT, MAP_WIDTH } from "../../web/flights/config.js";
import type { FlightFile } from "../../web/flights/lib/data.js";

/** Blue-white pixels: arcs, dots and airports. The states are near-black. */
const lit = (page: Page) =>
  page.locator("#map").evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 90) n += 1;
    return n;
  });

test("draws the arcs and credits the source", async ({ page }) => {
  await page.goto("/flights/");
  await expect(page.locator("#map")).toHaveAttribute("data-drawn", "true");
  expect(await lit(page)).toBeGreaterThan(2000);
  await expect(page.locator("#footer .credit")).toContainText("Not affiliated with the BTS");
});

test("tapping the busiest hub keeps only its routes; tapping empty space clears", async ({ page, request }) => {
  const file = (await (await request.get("/data/flights/flights.json")).json()) as FlightFile;
  const degree = new Map<number, number>();
  for (let i = 0; i < file.routes.length; i += 4) {
    for (const end of [file.routes[i], file.routes[i + 1]]) degree.set(end, (degree.get(end) ?? 0) + 1);
  }
  const hub = [...degree.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const albers = geoAlbersUsa().scale(ALBERS_SCALE).translate([...ALBERS_TRANSLATE]);
  const [x, y] = albers([file.airports[hub].lon, file.airports[hub].lat])!;

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/flights/");
  await expect(page.locator("#map")).toHaveAttribute("data-drawn", "true");
  const all = await lit(page);
  // A locator click (not raw page.mouse coordinates) scrolls the element into view first: on a normal
  // desktop viewport the map, at full page width, renders taller than the viewport.
  const map = page.locator("#map");
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: (x / MAP_WIDTH) * box.width, y: (y / MAP_HEIGHT) * box.height } });
  await expect(page.locator("#airport-info")).toContainText(`${file.airports[hub].code}, `);
  expect(await lit(page)).toBeLessThan(all);

  await map.click({ position: { x: box.width * 0.99, y: box.height * 0.99 } });
  await expect(page.locator("#airport-info")).toHaveText("");
});

test("reduced motion opens paused; record mode plays", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/flights/");
  await expect(page.locator("#play")).toHaveText("Play");
  await page.goto("/flights/?rec");
  await expect(page.locator("#map")).toHaveAttribute("data-drawn", "true");
  await expect(page.locator("#play")).toBeEnabled();
  await expect(page.locator("#play")).toHaveText("Pause");
});

test("a failed data load shows the error and retries", async ({ page }) => {
  await page.route("**/data/flights/flights.json", (route) => route.abort());
  await page.goto("/flights/");
  await expect(page.locator(".load-error")).toContainText("Couldn't load the flights data");
  await page.unroute("**/data/flights/flights.json");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("#map")).toHaveAttribute("data-drawn", "true");
  await expect(page.locator(".load-error")).toBeHidden();
});

// Real phones are 2x or 3x: the canvas backing store must not change the layout, so check every density.
for (const deviceScaleFactor of [1, 2, 3]) test.describe(`at ${deviceScaleFactor}x`, () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor });

test("record mode fits the phone frame: nothing under the header or the footer", async ({ page }) => {
  await page.goto("/flights/?rec");
  await expect(page.locator("#map")).toHaveAttribute("data-drawn", "true");
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
  const header = await box("#viz-header");
  const footer = await box("footer");
  expect((await box("#map")).y).toBeGreaterThanOrEqual(header.y + header.height);
  for (const sel of ["#map", "#airport-info", "#play"]) {
    const b = await box(sel);
    expect(b.y + b.height).toBeLessThanOrEqual(footer.y);
  }
  // The backing store follows the box after layout settles, so the map is neither blurry nor oversized.
  await expect
    .poll(() => page.locator("#map").evaluate((c: HTMLCanvasElement) => c.width - Math.round(c.clientWidth * devicePixelRatio)))
    .toBe(0);
});
});
