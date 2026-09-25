import { describe, expect, it } from "vitest";
import { DEPARTURES_PER_DOT, MAX_ARC_WIDTH, MAX_DOTS, MIN_ARC_WIDTH } from "../../../web/flights/config.js";
import { dotCount, widthFor } from "../../../web/flights/lib/scale.js";

describe("widthFor", () => {
  it("runs from the thinnest to the widest on a square-root scale", () => {
    expect(widthFor(0, 100)).toBe(MIN_ARC_WIDTH);
    expect(widthFor(100, 100)).toBe(MAX_ARC_WIDTH);
    expect(widthFor(25, 100)).toBeCloseTo(MIN_ARC_WIDTH + (MAX_ARC_WIDTH - MIN_ARC_WIDTH) / 2);
  });
});

describe("dotCount", () => {
  it("gives every route a dot and caps the busiest", () => {
    expect(dotCount(0)).toBe(1);
    expect(dotCount(DEPARTURES_PER_DOT * 3)).toBe(3);
    expect(dotCount(DEPARTURES_PER_DOT * 1000)).toBe(MAX_DOTS);
  });
});
