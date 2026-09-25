import { describe, expect, it } from "vitest";
import { atLeast, countThrough } from "../../../web/quakes/lib/filter.js";

const q = (day: number, mag: number) => ({ day, lat: 0, lon: 0, mag, depth: 10 });
const quakes = [q(0, 4.5), q(1, 5.0), q(1, 6.2), q(3, 4.9), q(9, 7.1)];

describe("atLeast", () => {
  it("keeps quakes at or above the threshold, as a new array", () => {
    expect(atLeast(quakes, 5).map((x) => x.mag)).toEqual([5.0, 6.2, 7.1]);
    expect(atLeast(quakes, 4.5)).not.toBe(quakes);
    expect(atLeast(quakes, 4.5)).toHaveLength(5);
  });
  it("is not fooled by float noise from the slider", () => {
    expect(atLeast([q(0, 5.0)], 4.9 + 0.1)).toHaveLength(1);
  });
});

describe("countThrough", () => {
  it("counts quakes up to and including the day", () => {
    expect(countThrough(quakes, -1)).toBe(0);
    expect(countThrough(quakes, 0)).toBe(1);
    expect(countThrough(quakes, 1)).toBe(3);
    expect(countThrough(quakes, 8.9)).toBe(4);
    expect(countThrough(quakes, 365)).toBe(5);
  });
});
