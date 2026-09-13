import { describe, expect, it } from "vitest";
import { filterShots } from "../../web/lib/filter.js";
import type { Shot } from "../../web/lib/data.js";

const shots: Shot[] = [
  { x: 0, y: 10, made: true, zone: 0, distance: 1, period: 1, date: "20251023" },
  { x: 5, y: 20, made: false, zone: 0, distance: 2, period: 1, date: "20251023" },
];

describe("filterShots", () => {
  it("returns everything for all", () => {
    expect(filterShots(shots, "all")).toHaveLength(2);
  });

  it("keeps only makes", () => {
    expect(filterShots(shots, "made").every((s) => s.made)).toBe(true);
    expect(filterShots(shots, "made")).toHaveLength(1);
  });

  it("keeps only misses", () => {
    expect(filterShots(shots, "missed")).toEqual([shots[1]]);
  });

  it("returns a new array", () => {
    expect(filterShots(shots, "all")).not.toBe(shots);
  });
});
