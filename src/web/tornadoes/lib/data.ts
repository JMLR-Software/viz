import { COORD_SCALE, TRACK_FIELDS } from "../config.js";

export interface TornadoFile {
  generatedAt: string;
  source: string;
  firstYear: number;
  lastYear: number;
  trackFields: string[];
  countyFields: string[];
  /** One flat array per year: TRACK_FIELDS.length ints per tornado. */
  tracks: number[][];
  /** fips -> [[yearOffset, all, strong], ...], sorted by year. */
  counties: Record<string, number[][]>;
  unmatchedCountyRefs: number;
}

/** A track in map coordinates. A point tornado has x1,y1 equal to x0,y0. */
export interface Track {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  mag: number;
}

export type Project = (lonLat: [number, number]) => [number, number] | null;

const STRIDE = TRACK_FIELDS.length;

export function decodeTracks(tracks: number[][], project: Project): { byYear: Track[][]; dropped: number } {
  let dropped = 0;
  const byYear = tracks.map((flat) => {
    const out: Track[] = [];
    for (let i = 0; i + STRIDE <= flat.length; i += STRIDE) {
      const lat = flat[i] / COORD_SCALE;
      const lon = flat[i + 1] / COORD_SCALE;
      const start = project([lon, lat]);
      if (!start) {
        dropped += 1;
        continue;
      }
      // Sum in integer hundredths before dividing, so 3673 + 15 is exactly 36.88.
      const end = project([(flat[i + 1] + flat[i + 3]) / COORD_SCALE, (flat[i] + flat[i + 2]) / COORD_SCALE]) ?? start;
      out.push({ x0: start[0], y0: start[1], x1: end[0], y1: end[1], mag: flat[i + 4] });
    }
    return out;
  });
  return { byYear, dropped };
}
