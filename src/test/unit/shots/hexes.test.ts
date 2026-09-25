import { describe, expect, it } from "vitest";
import { binShots, deltaFor, maxCount } from "../../../web/shots/lib/hexes.js";
import type { Shot } from "../../../web/shots/lib/data.js";

function shot(x: number, y: number, made: boolean, zone = 0): Shot {
  return { x, y, made, zone, distance: 1, period: 1, date: "20251023" };
}

const poolPct = [0.6, 0.45, 0.4, 0.38, 0.38, 0.36];

describe("binShots", () => {
  it("puts shots at the same spot in one bin", () => {
    const bins = binShots([shot(0, 0, true), shot(0, 0, false)], 10, poolPct);
    expect(bins).toHaveLength(1);
    expect(bins[0].count).toBe(2);
    expect(bins[0].made).toBe(1);
  });

  it("separates shots further apart than the radius", () => {
    const bins = binShots([shot(0, 0, true), shot(200, 200, true)], 10, poolPct);
    expect(bins).toHaveLength(2);
  });

  it("sums the pool percentage for each shot's zone into expected", () => {
    const bins = binShots([shot(0, 0, true, 0), shot(0, 0, true, 2)], 10, poolPct);
    expect(bins[0].expected).toBeCloseTo(0.6 + 0.4);
  });

  it("returns bins positioned in court units", () => {
    const bins = binShots([shot(120, 90, true)], 10, poolPct);
    expect(bins[0].x).toBeGreaterThan(100);
    expect(bins[0].x).toBeLessThan(140);
    expect(bins[0].y).toBeGreaterThan(70);
    expect(bins[0].y).toBeLessThan(110);
  });

  it("returns nothing for no shots", () => {
    expect(binShots([], 10, poolPct)).toEqual([]);
  });

  it("does not mutate its input", () => {
    const shots = [shot(0, 0, true)];
    const copy = structuredClone(shots);
    binShots(shots, 10, poolPct);
    expect(shots).toEqual(copy);
  });
});

describe("deltaFor", () => {
  it("is the bin's FG% minus the pool's expectation", () => {
    expect(deltaFor({ x: 0, y: 0, count: 2, made: 2, expected: 1.2 })).toBeCloseTo(0.4);
  });

  it("is zero for an empty bin", () => {
    expect(deltaFor({ x: 0, y: 0, count: 0, made: 0, expected: 0 })).toBe(0);
  });
});

describe("maxCount", () => {
  it("finds the busiest bin", () => {
    expect(maxCount([
      { x: 0, y: 0, count: 3, made: 1, expected: 1 },
      { x: 1, y: 1, count: 9, made: 4, expected: 3 },
    ])).toBe(9);
  });

  it("is zero with no bins", () => {
    expect(maxCount([])).toBe(0);
  });
});
