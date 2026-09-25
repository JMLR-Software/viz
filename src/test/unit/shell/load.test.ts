import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson } from "../../../web/shell/load.js";

// This suite runs in Vitest's "node" environment (see vitest.config.ts): there is no `document`, so
// `el`, `sourceLink` and `showLoadError` are DOM-only and are exercised instead by the Playwright specs
// (tornadoes.spec.ts, quakes.spec.ts, scoring.spec.ts). `getJson` has no DOM dependency and is honestly
// testable here with a stubbed `fetch`.
describe("getJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches base/path and resolves the parsed JSON", async () => {
    const json = vi.fn().mockResolvedValue({ a: 1 });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/data/scoring", "scoring.json")).resolves.toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/data/scoring/scoring.json");
  });

  it("throws with the path and status on a non-OK response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/data/scoring", "scoring.json")).rejects.toThrow("scoring.json -> 404");
  });
});
