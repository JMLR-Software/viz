import { describe, expect, it } from "vitest";
import { DOT_ALPHA, MIN_MAG, RADIUS_MIN, RIPPLE_DAYS_MIN, RIPPLE_SPREAD } from "../../../web/quakes/config.js";
import { dotRadius, markAt, rippleDays } from "../../../web/quakes/lib/ripple.js";

const quake = (day: number, mag: number) => ({ day, lat: 0, lon: 0, mag, depth: 10 });

describe("sizes", () => {
  it("grows the dot with magnitude and never shrinks it below the minimum", () => {
    expect(dotRadius(MIN_MAG)).toBe(RADIUS_MIN);
    expect(dotRadius(7)).toBeGreaterThan(dotRadius(6));
    expect(dotRadius(3)).toBe(RADIUS_MIN);
  });
  it("lets bigger quakes ripple longer", () => {
    expect(rippleDays(MIN_MAG)).toBe(RIPPLE_DAYS_MIN);
    expect(rippleDays(7)).toBeGreaterThan(rippleDays(5));
  });
});

describe("markAt", () => {
  it("draws nothing before the quake", () => {
    expect(markAt(quake(10, 5), 9.9)).toBeNull();
  });
  it("starts bright with a small ring", () => {
    const m = markAt(quake(10, 5), 10)!;
    expect(m.dotAlpha).toBe(1);
    expect(m.ringAlpha).toBe(1);
    expect(m.ringR).toBeCloseTo(m.r);
  });
  it("spreads and fades the ring over its life", () => {
    const life = rippleDays(5);
    const m = markAt(quake(10, 5), 10 + life / 2)!;
    expect(m.ringAlpha).toBeCloseTo(0.5);
    expect(m.ringR).toBeCloseTo(m.r * (1 + (RIPPLE_SPREAD - 1) / 2));
  });
  it("settles to a dim dot with no ring", () => {
    const m = markAt(quake(10, 5), 10 + rippleDays(5) + 1)!;
    expect(m).toEqual({ r: dotRadius(5), dotAlpha: DOT_ALPHA, ringR: 0, ringAlpha: 0 });
  });
});
