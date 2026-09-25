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
