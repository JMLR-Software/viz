import type { Point } from "./arcs.js";
import type { Route } from "./data.js";

export function nearestAirport(points: readonly Point[], x: number, y: number, maxDist: number): number {
  let best = -1;
  let bestDist = maxDist;
  points.forEach(([px, py], i) => {
    const d = Math.hypot(px - x, py - y);
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

export function routesTouching(routes: readonly Route[], airport: number): number[] {
  return routes.flatMap((r, i) => (r.a === airport || r.b === airport ? [i] : []));
}

export function airportSummary(routes: readonly Route[], airport: number): { routes: number; passengers: number } {
  const touching = routesTouching(routes, airport);
  return { routes: touching.length, passengers: touching.reduce((sum, i) => sum + routes[i].passengers, 0) };
}
