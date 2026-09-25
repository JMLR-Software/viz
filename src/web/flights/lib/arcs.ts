import { geoInterpolate } from "d3-geo";

export type Point = [number, number];
export type Project = (lonLat: [number, number]) => [number, number] | null;

export interface Measured {
  points: Point[];
  /** Length along the polyline up to each point. */
  cum: number[];
  total: number;
}

/** steps + 1 points along the great circle from `from` to `to` (lon/lat), projected; unplaceable points are dropped. */
export function arcPoints(from: Point, to: Point, steps: number, project: Project): Point[] {
  const along = geoInterpolate(from, to);
  const out: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const xy = project(along(i / steps));
    if (xy) out.push([xy[0], xy[1]]);
  }
  return out;
}

export function measure(points: readonly Point[]): Measured {
  const cum = [0];
  for (let i = 1; i < points.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  return { points: [...points], cum, total: cum[cum.length - 1] };
}

/** The point a fraction t (0..1) of the way along by length. */
export function pointAt(m: Measured, t: number): Point {
  if (m.points.length < 2) return m.points[0] ?? [0, 0];
  const d = Math.min(Math.max(t, 0), 1) * m.total;
  let i = 1;
  while (i < m.cum.length - 1 && m.cum[i] < d) i += 1;
  const [x0, y0] = m.points[i - 1];
  const [x1, y1] = m.points[i];
  const segment = m.cum[i] - m.cum[i - 1];
  const f = segment === 0 ? 0 : (d - m.cum[i - 1]) / segment;
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
}

/** Where each of `count` dots is (0..1 along its arc) at a loop phase; odd dots fly the other way. */
export function dotTs(count: number, phase: number): number[] {
  return Array.from({ length: count }, (_, k) => {
    const t = (phase + k / count) % 1;
    return k % 2 === 0 ? t : 1 - t;
  });
}
