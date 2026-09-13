import { quantile } from "d3-array";
import { interpolateRdBu, interpolateYlOrRd } from "d3-scale-chromatic";
import type { HexBin } from "./hexes.js";

/**
 * The count the frequency scale treats as "as hot as it gets". Using a high percentile
 * instead of the maximum stops one restricted-area bin from flattening everything else.
 */
export function frequencyCap(bins: HexBin[], percentile: number): number {
  if (bins.length === 0) return 1;
  const counts = bins.map((b) => b.count).sort((a, b) => a - b);
  return Math.max(1, quantile(counts, percentile) ?? 1);
}

export function frequencyColor(count: number, cap: number): string {
  const t = Math.min(1, Math.sqrt(count) / Math.sqrt(Math.max(1, cap)));
  return interpolateYlOrRd(t);
}

export function clampDelta(delta: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, delta));
}

/** Red above the pool average, blue below — RdBu reversed. */
export function efficiencyColor(delta: number, limit: number): string {
  const t = (clampDelta(delta, limit) + limit) / (2 * limit);
  return interpolateRdBu(1 - t);
}

/** In efficiency mode, size carries volume: area grows with count, never below the floor. */
export function hexRadius(count: number, cap: number, gridRadius: number, floor: number): number {
  const t = Math.min(1, Math.sqrt(count) / Math.sqrt(Math.max(1, cap)));
  return gridRadius * (floor + (1 - floor) * t);
}
