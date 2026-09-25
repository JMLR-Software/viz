import { describe, expect, it } from "vitest";
import { zoneStats } from "../../../web/shots/lib/zones.js";
import type { Shot, Totals } from "../../../web/shots/lib/data.js";

const names = ["Restricted Area", "In The Paint (Non-RA)", "Mid-Range"] as const;
const pool: Totals[] = [
  { fga: 100, fgm: 60 },
  { fga: 100, fgm: 45 },
  { fga: 0, fgm: 0 },
];

function shot(zone: number, made: boolean): Shot {
  return { x: 0, y: 0, made, zone, distance: 1, period: 1, date: "20251023" };
}

describe("zoneStats", () => {
  const { rows, total } = zoneStats(
    [shot(0, true), shot(0, true), shot(0, false), shot(1, false)],
    pool,
    names,
  );

  it("returns one row per zone in order", () => {
    expect(rows.map((r) => r.zone)).toEqual([...names]);
  });

  it("counts attempts and makes per zone", () => {
    expect(rows[0]).toMatchObject({ fga: 3, fgm: 2 });
    expect(rows[1]).toMatchObject({ fga: 1, fgm: 0 });
  });

  it("computes the percentage against the pool", () => {
    expect(rows[0].pct).toBeCloseTo(2 / 3);
    expect(rows[0].poolPct).toBeCloseTo(0.6);
    expect(rows[0].delta).toBeCloseTo(2 / 3 - 0.6);
  });

  it("leaves a zone with no attempts null rather than zero", () => {
    expect(rows[2].fga).toBe(0);
    expect(rows[2].pct).toBeNull();
    expect(rows[2].delta).toBeNull();
  });

  it("leaves poolPct null where the pool never shot", () => {
    expect(rows[2].poolPct).toBeNull();
  });

  it("totals every zone", () => {
    expect(total).toMatchObject({ zone: "Total", fga: 4, fgm: 2 });
    expect(total.pct).toBeCloseTo(0.5);
    expect(total.poolPct).toBeCloseTo(105 / 200);
  });
});
