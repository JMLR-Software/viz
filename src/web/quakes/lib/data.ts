import { COORD_SCALE, EVENT_FIELDS, MAG_SCALE, MINUTES_PER_DAY, MS_PER_DAY } from "../config.js";

export interface QuakeFile {
  generatedAt: string;
  source: string;
  /** First day of the window, YYYY-MM-DD (UTC). */
  start: string;
  /** The day after the window, YYYY-MM-DD: exclusive. */
  end: string;
  minMag: number;
  eventFields: string[];
  /** EVENT_FIELDS.length ints per quake, sorted by time. */
  events: number[];
  skipped: number;
}

export interface Quake {
  /** Days since the window's start, fractional. */
  day: number;
  lat: number;
  lon: number;
  mag: number;
  depth: number;
}

const STRIDE = EVENT_FIELDS.length;

export function decodeEvents(flat: readonly number[]): Quake[] {
  const out: Quake[] = [];
  for (let i = 0; i + STRIDE <= flat.length; i += STRIDE) {
    out.push({
      day: flat[i] / MINUTES_PER_DAY,
      lat: flat[i + 1] / COORD_SCALE,
      lon: flat[i + 2] / COORD_SCALE,
      mag: flat[i + 3] / MAG_SCALE,
      depth: flat[i + 4],
    });
  }
  return out;
}

export function windowDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY);
}
