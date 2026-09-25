import { expect, test } from "@playwright/test";

test("loads the combined view with hexagons on the court", async ({ page }) => {
  await page.goto("/shots/");
  await expect(page.locator("#summary")).toContainText("All All-Stars");
  await expect(page.locator("#court .hexes path").first()).toBeVisible();
  await expect(page.locator("#zones tbody tr")).toHaveCount(6);
  // The combined view is its own baseline: no pool/diff columns to compare it against itself.
  await expect(page.locator("#zones thead th")).toHaveCount(4);
});

test("selecting a player changes the summary and the hash", async ({ page }) => {
  await page.goto("/shots/");
  await page.getByRole("button", { name: /Nikola Jokić/ }).click();
  await expect(page.locator("#summary")).toContainText("Nikola Jokić");
  await expect(page).toHaveURL(/#p=203999/);
  // A single player has a pool to be compared against, so the columns reappear.
  await expect(page.locator("#zones thead th")).toHaveCount(6);
});

test("efficiency mode disables the result filter", async ({ page }) => {
  await page.goto("/shots/");
  await page.getByRole("button", { name: /Nikola Jokić/ }).click();
  await expect(page.locator("#result")).toBeEnabled();
  await page.locator("#mode").selectOption("efficiency");
  await expect(page.locator("#result")).toBeDisabled();
  await expect(page.locator("#legend")).toContainText("All-Star average");
  await page.locator("#mode").selectOption("frequency");
  await expect(page.locator("#result")).toBeEnabled();
});

test("efficiency option is disabled for the combined view and enabled for a player", async ({ page }) => {
  // Playwright's toBeDisabled()/toBeEnabled() do not read a standalone <option>'s own
  // disabled property (only its enclosing form control), so assert the attribute directly.
  await page.goto("/shots/");
  await expect(page.locator("#summary")).toContainText("All All-Stars");
  await expect(page.locator('#mode option[value="efficiency"]')).toHaveAttribute("disabled", "");
  await expect(page.locator("#legend")).toContainText("All-Star average is the baseline");

  await page.getByRole("button", { name: /Nikola Jokić/ }).click();
  await expect(page.locator('#mode option[value="efficiency"]')).not.toHaveAttribute("disabled");
});

test("hovering a hexagon shows a tooltip with a percentage", async ({ page }) => {
  await page.goto("/shots/");
  await page.locator("#court .hexes path").first().hover();
  await expect(page.locator("#tooltip")).toBeVisible();
  await expect(page.locator("#tooltip")).toContainText("%");
});

test("a player with no playoff shots shows an empty court, not an error", async ({ page }) => {
  await page.goto("/shots/");
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
  await page.goto("/shots/");
  await expect(page.locator("#footer")).toContainText("Not affiliated with the NBA");
});

test("the colour key shows a shot-count bar, and a diverging bar with a size note in efficiency", async ({ page }) => {
  await page.goto("/shots/");
  const legend = page.locator("#legend");
  await expect(legend.locator(".legend-title")).toHaveText("Shots from each spot");
  await expect(legend.locator(".legend-tick").first()).toHaveText("1");
  await expect(legend.locator(".legend-tick").last()).toHaveText(/^\d+\+$/);
  await expect(legend.locator(".legend-ramp")).toHaveCSS("background-image", /linear-gradient/);

  await page.getByRole("button", { name: /Nikola Jokić/ }).click();
  await expect(legend.locator(".legend-note")).toBeHidden();
  await page.locator("#mode").selectOption("efficiency");
  await expect(legend.locator(".legend-tick")).toHaveText(["−15 or worse", "average", "+15 or better"]);
  await expect(legend.locator(".legend-note")).toContainText("Bigger hexes had more shots");
});
