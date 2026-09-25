import { describe, expect, it } from "vitest";
import { elapsedForPosition, positionAt } from "../../../web/shell/lib/playback.js";

const p = { span: 10, playMs: 1000, holdMs: 500 };

describe("positionAt", () => {
  it("runs 0 to span over playMs", () => {
    expect(positionAt(0, p)).toBe(0);
    expect(positionAt(500, p)).toBe(5);
  });
  it("holds at the end, then loops", () => {
    expect(positionAt(1200, p)).toBe(10);
    expect(positionAt(1500, p)).toBe(0);
    expect(positionAt(2000, p)).toBe(5);
  });
  it("loops seamlessly with no hold", () => {
    const loop = { span: 1, playMs: 1000, holdMs: 0 };
    expect(positionAt(250, loop)).toBe(0.25);
    expect(positionAt(1250, loop)).toBe(0.25);
  });
});

describe("elapsedForPosition", () => {
  it("resumes play from a scrubbed position, not from the start", () => {
    expect(positionAt(elapsedForPosition(5, p), p)).toBe(5);
  });
  it("clamps past the end", () => {
    expect(elapsedForPosition(12, p)).toBe(1000);
  });
});
