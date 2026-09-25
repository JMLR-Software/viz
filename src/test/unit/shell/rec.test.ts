import { describe, expect, it } from "vitest";
import { isRecording, shouldAutoplay, withRec } from "../../../web/shell/lib/rec.js";

describe("isRecording", () => {
  it("is true for a bare ?rec and for rec among other params", () => {
    expect(isRecording("?rec")).toBe(true);
    expect(isRecording("?x=1&rec")).toBe(true);
    expect(isRecording("?rec=1")).toBe(true);
  });
  it("is false with no rec param", () => {
    expect(isRecording("")).toBe(false);
    expect(isRecording("?record=1")).toBe(false);
  });
});

describe("withRec", () => {
  it("returns the href unchanged when not recording", () => {
    expect(withRec("/shots/", false)).toBe("/shots/");
  });
  it("adds ?rec to a bare path", () => {
    expect(withRec("/shots/", true)).toBe("/shots/?rec");
  });
  it("keeps an existing query", () => {
    expect(withRec("/shots/?a=1", true)).toBe("/shots/?a=1&rec");
  });
  it("puts rec before the hash, keeping the hash", () => {
    expect(withRec("/shots/#p=203999", true)).toBe("/shots/?rec#p=203999");
    expect(withRec("/shots/?a=1#p=2", true)).toBe("/shots/?a=1&rec#p=2");
  });
  it("does not add rec twice", () => {
    expect(withRec("/shots/?rec", true)).toBe("/shots/?rec");
  });
});

describe("shouldAutoplay", () => {
  it("autoplays unless the viewer asked for reduced motion", () => {
    expect(shouldAutoplay(false, false)).toBe(true);
    expect(shouldAutoplay(false, true)).toBe(false);
  });
  it("always autoplays in record mode", () => {
    expect(shouldAutoplay(true, true)).toBe(true);
  });
});
