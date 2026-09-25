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

test("the Worker sends the CSP and cache headers on real responses", async ({ request }) => {
  const html = await request.get("/shots/");
  expect(html.headers()["content-security-policy"]).toContain("default-src 'self'");
  const page = await request.get("/js/pages/shots.js");
  expect(page.headers()["cache-control"]).toBe("no-cache");
  const chunk = (await page.text()).match(/chunks\/[\w-]+\.js/)?.[0];
  expect(chunk).toBeDefined();
  expect((await request.get(`/js/${chunk}`)).headers()["cache-control"]).toContain("immutable");
  const missing = await request.get("/nope/");
  expect(missing.headers()["content-security-policy"]).toContain("default-src 'self'");
});

test("after Back, the dropdown names the page again and still navigates", async ({ page }) => {
  await page.goto("/");
  await page.locator("#showcase").selectOption("shots");
  await expect(page).toHaveURL(/\/shots\/$/);
  await page.goBack();
  await expect(page.locator("#showcase")).toHaveValue("");
});
