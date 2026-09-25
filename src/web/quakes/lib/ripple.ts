import {
  DOT_ALPHA, MIN_MAG, RADIUS_GROWTH, RADIUS_MIN, RIPPLE_DAYS_MIN, RIPPLE_DAYS_PER_MAG, RIPPLE_SPREAD,
} from "../config.js";
import type { Quake } from "./data.js";

export interface Mark {
  r: number;
  dotAlpha: number;
  ringR: number;
  ringAlpha: number;
}

const above = (mag: number): number => Math.max(0, mag - MIN_MAG);

export function dotRadius(mag: number): number {
  return RADIUS_MIN * RADIUS_GROWTH ** above(mag);
}

export function rippleDays(mag: number): number {
  return RIPPLE_DAYS_MIN + above(mag) * RIPPLE_DAYS_PER_MAG;
}

/** How a quake looks `day` days into the window: nothing before it, a spreading ring, then a dim dot. */
export function markAt(q: Quake, day: number): Mark | null {
  const age = day - q.day;
  if (age < 0) return null;
  const r = dotRadius(q.mag);
  const life = rippleDays(q.mag);
  if (age >= life) return { r, dotAlpha: DOT_ALPHA, ringR: 0, ringAlpha: 0 };
  const t = age / life;
  return { r, dotAlpha: 1 - t * (1 - DOT_ALPHA), ringR: r * (1 + (RIPPLE_SPREAD - 1) * t), ringAlpha: 1 - t };
}
