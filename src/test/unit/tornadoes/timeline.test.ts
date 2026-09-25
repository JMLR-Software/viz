import { describe, expect, it } from "vitest";
import {
  positionForYearIndex, trackAlpha, yearIndexAt,
} from "../../../web/tornadoes/lib/timeline.js";

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
