import { describe, expect, it } from "vitest";
import {
  clampDelta,
  confidenceOpacity,
  efficiencyColor,
  frequencyCap,
  frequencyColor,
  hexRadius,
} from "../../../web/shots/lib/scales.js";
import type { HexBin } from "../../../web/shots/lib/hexes.js";

/** Parses a d3-scale-chromatic "rgb(r, g, b)" string into its channels. */
function rgbChannels(color: string): { r: number; g: number; b: number } {
  const match = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color);
  if (!match) throw new Error(`not an rgb() string: ${color}`);
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function bin(count: number): HexBin {
  return { x: 0, y: 0, count, made: 0, expected: 0 };
}

describe("frequencyCap", () => {
  it("caps below the single busiest bin", () => {
    const bins = [...Array(99).fill(0).map(() => bin(1)), bin(500)];
    const cap = frequencyCap(bins, 0.98);
    expect(cap).toBeLessThan(500);
    expect(cap).toBeGreaterThanOrEqual(1);
  });

  it("is at least 1 so the scale never collapses", () => {
    expect(frequencyCap([], 0.98)).toBe(1);
  });
});

describe("frequencyColor", () => {
  it("returns a colour string", () => {
    expect(frequencyColor(3, 10)).toMatch(/^(#|rgb)/);
  });

  it("gives different colours to rare and common spots", () => {
    expect(frequencyColor(1, 100)).not.toBe(frequencyColor(100, 100));
  });

  it("does not break past the cap", () => {
    expect(frequencyColor(500, 10)).toMatch(/^(#|rgb)/);
  });
});

describe("clampDelta", () => {
  it("passes values inside the limit through", () => {
    expect(clampDelta(0.05, 0.15)).toBeCloseTo(0.05);
  });

  it("clamps both directions", () => {
    expect(clampDelta(0.9, 0.15)).toBeCloseTo(0.15);
    expect(clampDelta(-0.9, 0.15)).toBeCloseTo(-0.15);
  });
});

describe("efficiencyColor", () => {
  it("gives opposite ends to hot and cold", () => {
    expect(efficiencyColor(0.15, 0.15)).not.toBe(efficiencyColor(-0.15, 0.15));
  });

  it("returns a colour string", () => {
    expect(efficiencyColor(0, 0.15)).toMatch(/^(#|rgb)/);
  });

  it("a positive delta (above pool average) reads more red than blue", () => {
    const { r, b } = rgbChannels(efficiencyColor(0.15, 0.15));
    expect(r).toBeGreaterThan(b);
  });

  it("a negative delta (below pool average) reads more blue than red", () => {
    const { r, b } = rgbChannels(efficiencyColor(-0.15, 0.15));
    expect(b).toBeGreaterThan(r);
  });
});

describe("confidenceOpacity", () => {
  it("is 0 for zero shots", () => {
    expect(confidenceOpacity(0, 5)).toBe(0);
  });

  it("is below 0.5 for a single shot", () => {
    expect(confidenceOpacity(1, 5)).toBeLessThan(0.5);
  });

  it("is exactly 1 at the confidence threshold", () => {
    expect(confidenceOpacity(5, 5)).toBe(1);
  });

  it("is exactly 1 above the confidence threshold", () => {
    expect(confidenceOpacity(50, 5)).toBe(1);
  });

  it("never exceeds 1", () => {
    expect(confidenceOpacity(1000, 5)).toBeLessThanOrEqual(1);
  });
});

describe("hexRadius", () => {
  it("gives the full grid radius to the busiest bin", () => {
    expect(hexRadius(100, 100, 8, 0.35)).toBeCloseTo(8);
  });

  it("never shrinks below the floor", () => {
    const r = hexRadius(1, 10_000, 8, 0.35);
    expect(r).toBeGreaterThanOrEqual(8 * 0.35);
    expect(r).toBeLessThan(8 * 0.4);
  });

  it("grows with count", () => {
    expect(hexRadius(50, 100, 8, 0.35)).toBeGreaterThan(hexRadius(5, 100, 8, 0.35));
  });

  it("does not exceed the grid radius past the cap", () => {
    expect(hexRadius(500, 100, 8, 0.35)).toBeCloseTo(8);
  });
});
