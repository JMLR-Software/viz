import { describe, expect, it } from "vitest";
import { arcPoints, dotTs, measure, pointAt } from "../../../web/flights/lib/arcs.js";

const flat = (lonLat: [number, number]): [number, number] => [lonLat[0], lonLat[1]];

describe("arcPoints", () => {
  it("samples the great circle from end to end", () => {
    const pts = arcPoints([0, 0], [90, 0], 2, flat);
    expect(pts).toHaveLength(3);
    [[0, 0], [45, 0], [90, 0]].forEach(([x, y], i) => {
      expect(pts[i][0]).toBeCloseTo(x);
      expect(pts[i][1]).toBeCloseTo(y);
    });
  });
  it("bows north between two northern points, as a great circle does", () => {
    const mid = arcPoints([-118, 34], [-74, 41], 2, flat)[1];
    expect(mid[1]).toBeGreaterThan((34 + 41) / 2);
  });
  it("drops points the projection cannot place", () => {
    const pts = arcPoints([0, 0], [90, 0], 2, (p) => (p[0] > 50 ? null : flat(p)));
    expect(pts).toHaveLength(2);
  });
});

describe("measure and pointAt", () => {
  const m = measure([[0, 0], [3, 4], [3, 10]]);
  it("measures the polyline", () => {
    expect(m.cum).toEqual([0, 5, 11]);
    expect(m.total).toBe(11);
  });
  it("walks the polyline by length", () => {
    expect(pointAt(m, 0)).toEqual([0, 0]);
    expect(pointAt(m, 1)).toEqual([3, 10]);
    const corner = pointAt(m, 5 / 11); // 5/11 * 11 is not exactly 5 in floating point
    expect(corner[0]).toBeCloseTo(3);
    expect(corner[1]).toBeCloseTo(4);
    const a = pointAt(m, 2.5 / 11);
    expect(a[0]).toBeCloseTo(1.5);
    expect(a[1]).toBeCloseTo(2);
    const b = pointAt(m, 8 / 11);
    expect(b[0]).toBeCloseTo(3);
    expect(b[1]).toBeCloseTo(7);
  });
  it("clamps t and survives a one-point arc", () => {
    expect(pointAt(m, 2)).toEqual([3, 10]);
    expect(pointAt(measure([[4, 4]]), 0.5)).toEqual([4, 4]);
  });
  it("has no point to give for an empty arc", () => {
    expect(() => pointAt(measure([]), 0.5)).toThrow();
  });
});

describe("dotTs", () => {
  it("spaces dots evenly and sends every other one the other way", () => {
    const ts = dotTs(4, 0.1);
    [0.1, 0.65, 0.6, 0.15].forEach((t, i) => expect(ts[i]).toBeCloseTo(t));
  });
  it("wraps the phase", () => {
    expect(dotTs(1, 0.25)).toEqual([0.25]);
    expect(dotTs(1, 1)[0]).toBeCloseTo(0);
  });
});
