import { describe, expect, it } from "vitest";
import { decodeEvents, windowDays } from "../../../web/quakes/lib/data.js";

describe("decodeEvents", () => {
  it("turns the flat ints into quakes in days, degrees and magnitudes", () => {
    const quakes = decodeEvents([0, -5729, -2552, 45, 35, 281520, 3830, 14237, 71, 30]);
    expect(quakes).toEqual([
      { day: 0, lat: -57.29, lon: -25.52, mag: 4.5, depth: 35 },
      { day: 195.5, lat: 38.3, lon: 142.37, mag: 7.1, depth: 30 },
    ]);
  });
  it("ignores a trailing partial record", () => {
    expect(decodeEvents([0, 1, 2, 45])).toEqual([]);
  });
});

describe("windowDays", () => {
  it("counts the days in the window, end exclusive", () => {
    expect(windowDays("2025-09-01", "2026-09-01")).toBe(365);
    expect(windowDays("2023-09-01", "2024-09-01")).toBe(366);
  });
});
