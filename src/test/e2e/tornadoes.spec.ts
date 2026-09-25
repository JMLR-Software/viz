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

test("the legend names the count and its range, and follows the EF3+ toggle", async ({ page }) => {
  await page.goto("/tornadoes/");
  const legend = page.locator("#legend");
  await expect(legend.locator(".legend-title")).toHaveText("Tornadoes per county since 1950");
  await expect(legend.locator(".legend-none")).toHaveText("0");
  const top = legend.locator(".legend-tick").last();
  await expect(top).toHaveText(/^\d+\+$/);
  const allTop = Number((await top.textContent())!.slice(0, -1));
  await page.locator("#strong").check();
  await expect(legend.locator(".legend-title")).toHaveText("EF3+ tornadoes per county since 1950");
  await expect(top).not.toHaveText(`${allTop}+`);
  expect(Number((await top.textContent())!.slice(0, -1))).toBeLessThan(allTop);
});
