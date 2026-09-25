import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PUBLIC = join(__dirname, "../../../../public");

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ["data", "js"].includes(name) ? [] : pageFiles(path);
    return name === "index.html" ? [path] : [];
  });
}

describe("page HTML", () => {
  const pages = pageFiles(PUBLIC);

  it("finds the home page and at least one showcase", () => {
    expect(pages.length).toBeGreaterThanOrEqual(2);
  });

  // The shell and the ?rec class are drawn by the page script; without this the first paint is full-width.
  it("holds the first paint until the page script has drawn the shell", () => {
    for (const page of pages) {
      const scripts = readFileSync(page, "utf8").match(/<script type="module"[^>]*>/g) ?? [];
      expect(scripts, page).toHaveLength(1);
      expect(scripts[0], page).toContain('blocking="render"');
    }
  });
});
