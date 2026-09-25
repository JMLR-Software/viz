import { bisector } from "d3-array";
import type { Quake } from "./data.js";

/** The slider steps by 0.1 in floating point; magnitudes are exact tenths. */
const EPSILON = 1e-9;
const byDay = bisector((q: Quake) => q.day);

export function atLeast(quakes: readonly Quake[], minMag: number): Quake[] {
  return quakes.filter((q) => q.mag >= minMag - EPSILON);
}

/** How many of the (day-sorted) quakes have happened by `day`, inclusive. */
export function countThrough(quakes: readonly Quake[], day: number): number {
  return byDay.right(quakes, day);
}
