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
