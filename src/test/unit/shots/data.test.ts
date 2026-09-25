import { describe, expect, it } from "vitest";
import { decodeShots, pct, zonePercentages } from "../../../web/shots/lib/data.js";
import type { ShotTuple } from "../../../web/shots/lib/data.js";

const rows: ShotTuple[] = [
  [47, 32, 1, 1, 5, 1, "20251023"],
  [-220, 90, 0, 3, 22, 3, "20251025"],
];

describe("decodeShots", () => {
  it("turns tuples into named fields", () => {
    expect(decodeShots(rows)[0]).toEqual({
      x: 47, y: 32, made: true, zone: 1, distance: 5, period: 1, date: "20251023",
    });
  });

  it("reads 0 as a miss", () => {
    expect(decodeShots(rows)[1].made).toBe(false);
  });

  it("does not mutate its input", () => {
    const copy = rows.map((r) => [...r]);
    decodeShots(rows);
    expect(rows).toEqual(copy);
  });
});

describe("pct", () => {
  it("divides makes by attempts", () => {
    expect(pct({ fga: 4, fgm: 1 })).toBe(0.25);
  });

  it("is null with no attempts", () => {
    expect(pct({ fga: 0, fgm: 0 })).toBeNull();
  });
});

describe("zonePercentages", () => {
  it("returns one percentage per zone, zero where nobody shot", () => {
    expect(zonePercentages([{ fga: 2, fgm: 1 }, { fga: 0, fgm: 0 }])).toEqual([0.5, 0]);
  });
});
