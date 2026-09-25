import { describe, expect, it } from "vitest";
import {
  elapsedForPosition, positionAt, positionForYearIndex, trackAlpha, yearIndexAt,
} from "../../../web/tornadoes/lib/timeline.js";

const t = { years: 10, playMs: 1000, holdMs: 500 };

describe("positionAt", () => {
  it("runs 0 to years over playMs", () => {
    expect(positionAt(0, t)).toBe(0);
    expect(positionAt(500, t)).toBe(5);
  });
  it("holds at the end, then loops", () => {
    expect(positionAt(1200, t)).toBe(10);
    expect(positionAt(1500, t)).toBe(0);
    expect(positionAt(2000, t)).toBe(5);
  });
});

describe("yearIndexAt", () => {
  it("floors the position and clamps to the last year", () => {
    expect(yearIndexAt(0, 10)).toBe(0);
    expect(yearIndexAt(3.7, 10)).toBe(3);
    expect(yearIndexAt(10, 10)).toBe(9);
  });
});

describe("scrubbing", () => {
  it("puts a scrubbed year at its end, so its heat and tracks are shown", () => {
    expect(positionForYearIndex(4)).toBe(5);
    expect(yearIndexAt(positionForYearIndex(4), 10)).toBe(4);
  });
  it("resumes play from the scrubbed position, not from the start", () => {
    expect(positionAt(elapsedForPosition(5, t), t)).toBe(5);
  });
});

describe("trackAlpha", () => {
  it("is 0 before the track's year", () => expect(trackAlpha(5, 4.9, 1.5)).toBe(0));
  it("is 1 during its year and just after", () => {
    expect(trackAlpha(5, 5.2, 1.5)).toBe(1);
    expect(trackAlpha(5, 6, 1.5)).toBe(1);
  });
  it("fades to 0 over fadeYears", () => {
    expect(trackAlpha(5, 6.75, 1.5)).toBeCloseTo(0.5);
    expect(trackAlpha(5, 8, 1.5)).toBe(0);
  });
});
