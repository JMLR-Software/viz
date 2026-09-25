import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Warm pixels: quake marks. Ocean, land and graticule are all blue-grey, so red never beats blue there. */
const quakePixels = (page: Page) =>
  page.locator("#globe").evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > d[i + 2] + 20) n += 1;
    return n;
  });

const snapshot = (page: Page) => page.locator("#globe").evaluate((c: HTMLCanvasElement) => c.toDataURL());

const countOf = async (page: Page) => Number((await page.locator("#count-label").textContent())!.replace(/\D/g, ""));

test("draws the globe with quakes, a month and a count", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/quakes/");
  await expect(page.locator("#globe")).toHaveAttribute("data-drawn", "true");
  expect(await quakePixels(page)).toBeGreaterThan(500);
  // The slider's value and its label must agree with what was drawn, even after a restored form value.
  await expect(page.locator("#min-mag")).toHaveValue("4.5");
  await expect(page.locator("#mag-label")).toHaveText("M4.5+");
  await expect(page.locator("#date-label")).toHaveText(/^[A-Z][a-z]{2} 20\d\d$/);
  await expect(page.locator("#viz-header .hook")).toContainText(/[A-Z][a-z]{2} 20\d\d – [A-Z][a-z]{2} 20\d\d/);
  await expect(page.locator("#footer .credit")).toContainText("Not affiliated with the USGS");
});

test("reduced motion opens paused on the full year; record mode still plays", async ({ page, request }) => {
  const file = await (await request.get("/data/quakes/quakes.json")).json();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/quakes/");
  await expect(page.locator("#globe")).toHaveAttribute("data-drawn", "true");
  await expect(page.locator("#play")).toHaveText("Play");
  expect(await countOf(page)).toBe(file.events.length / file.eventFields.length);

  await page.goto("/quakes/?rec");
  await expect(page.locator("#play")).toHaveText("Pause");
});

test("plays on its own", async ({ page }) => {
  await page.goto("/quakes/");
  await expect(page.locator("#globe")).toHaveAttribute("data-drawn", "true");
  const first = await page.locator("#date-label").textContent();
  await expect(page.locator("#date-label")).not.toHaveText(first ?? "", { timeout: 5000 });
});

test("the magnitude slider lowers the count and names the threshold", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/quakes/");
  await expect(page.locator("#globe")).toHaveAttribute("data-drawn", "true");
  const all = await countOf(page);
  await page.locator("#min-mag").fill("6");
  await expect(page.locator("#mag-label")).toHaveText("M6.0+");
  const strong = await countOf(page);
  expect(strong).toBeGreaterThan(0);
  expect(strong).toBeLessThan(all);
});

test("dragging turns the globe while paused", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/quakes/");
  await expect(page.locator("#globe")).toHaveAttribute("data-drawn", "true");
  const before = await snapshot(page);
  const box = (await page.locator("#globe").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await snapshot(page)).not.toBe(before);
});

test("a failed data load shows the error and retries", async ({ page }) => {
  await page.route("**/data/quakes/quakes.json", (route) => route.abort());
  await page.goto("/quakes/");
  await expect(page.locator(".load-error")).toContainText("Couldn't load the quakes data");
  await page.unroute("**/data/quakes/quakes.json");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("#globe")).toHaveAttribute("data-drawn", "true");
  await expect(page.locator(".load-error")).toBeHidden();
});

test("record mode fits the phone frame: nothing under the header or the footer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/quakes/?rec");
  await expect(page.locator("#globe")).toHaveAttribute("data-drawn", "true");
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!;
  const header = await box("#viz-header");
  const footer = await box("footer");
  expect((await box("#date-label")).y).toBeGreaterThanOrEqual(header.y + header.height);
  for (const sel of ["#globe", "#min-mag"]) {
    const b = await box(sel);
    expect(b.y + b.height).toBeLessThanOrEqual(footer.y);
  }
  const globe = await box("#globe");
  expect(globe.width).toBeCloseTo(globe.height, 0);
  // The backing store follows the box after layout settles, so the globe is neither blurry nor oversized.
  await expect.poll(() => page.locator("#globe").evaluate((c: HTMLCanvasElement) => c.width - c.clientWidth)).toBe(0);
});
