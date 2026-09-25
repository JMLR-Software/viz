import { describe, expect, it } from "vitest";
import { redirectTarget } from "../../../redirect.js";

describe("redirectTarget", () => {
  it("sends the old root to /shots/", () => {
    expect(redirectTarget("https://shots.jmlr.dev/")).toBe("https://viz.jmlr.dev/shots/");
  });
  it("keeps the path under /shots and keeps the query", () => {
    expect(redirectTarget("https://shots.jmlr.dev/?rec")).toBe("https://viz.jmlr.dev/shots/?rec");
    expect(redirectTarget("https://shots.jmlr.dev/foo?a=1")).toBe("https://viz.jmlr.dev/shots/foo?a=1");
  });
  it("leaves every other host alone", () => {
    expect(redirectTarget("https://viz.jmlr.dev/shots/")).toBeNull();
    expect(redirectTarget("http://localhost:8787/")).toBeNull();
  });
});
