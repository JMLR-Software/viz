import { ROUTE_FIELDS } from "../config.js";

export interface Airport {
  /** BTS airport id. */
  id: number;
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}

export interface FlightFile {
  generatedAt: string;
  source: string;
  year: number;
  routeFields: string[];
  airports: Airport[];
  /** ROUTE_FIELDS.length ints per route, busiest first; a and b index `airports`. */
  routes: number[];
  /** Lower-48 airport pairs with any passengers, before the top-N cut. */
  pairs: number;
  /** Rows left out because an end is in Alaska, Hawaii or a territory. */
  offMapRows: number;
}

export interface Route {
  a: number;
  b: number;
  passengers: number;
  departures: number;
}

const STRIDE = ROUTE_FIELDS.length;

export function decodeRoutes(flat: readonly number[]): Route[] {
  const out: Route[] = [];
  for (let i = 0; i + STRIDE <= flat.length; i += STRIDE) {
    out.push({ a: flat[i], b: flat[i + 1], passengers: flat[i + 2], departures: flat[i + 3] });
  }
  return out;
}
