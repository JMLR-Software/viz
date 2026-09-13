import { hexbin as d3Hexbin } from "d3-hexbin";
import type { Shot } from "./data.js";

export interface HexBin {
  /** Bin centre in court units. */
  x: number;
  y: number;
  count: number;
  made: number;
  /** Sum of the pool's FG% for each shot's zone — what an average All-Star would make here. */
  expected: number;
}

/** Group shots onto a hex grid of the given radius, in court units. */
export function binShots(shots: Shot[], radius: number, poolZonePct: number[]): HexBin[] {
  if (shots.length === 0) return [];
  const layout = d3Hexbin<Shot>()
    .x((s) => s.x)
    .y((s) => s.y)
    .radius(radius);
  return layout(shots).map((bin) => ({
    x: bin.x,
    y: bin.y,
    count: bin.length,
    made: bin.reduce((n, s) => n + (s.made ? 1 : 0), 0),
    expected: bin.reduce((n, s) => n + (poolZonePct[s.zone] ?? 0), 0),
  }));
}

/** How much better this spot shot than the pool shoots from the same zones. */
export function deltaFor(bin: HexBin): number {
  if (bin.count === 0) return 0;
  return (bin.made - bin.expected) / bin.count;
}

export function maxCount(bins: HexBin[]): number {
  return bins.reduce((n, b) => Math.max(n, b.count), 0);
}
