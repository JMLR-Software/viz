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
