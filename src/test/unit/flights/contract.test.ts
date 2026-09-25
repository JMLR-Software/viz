import { readFileSync, statSync } from "node:fs";
import { geoAlbersUsa } from "d3-geo";
import { describe, expect, it } from "vitest";
import { ALBERS_SCALE, ALBERS_TRANSLATE, DATA_BUDGET_BYTES, ROUTE_FIELDS, TOP_ROUTES } from "../../../web/flights/config.js";
import { decodeRoutes } from "../../../web/flights/lib/data.js";
import type { FlightFile } from "../../../web/flights/lib/data.js";

const PATH = "public/data/flights/flights.json";
const STATES = "public/data/flights/states.json";
const file = JSON.parse(readFileSync(PATH, "utf8")) as FlightFile;
const routes = decodeRoutes(file.routes);

describe("the flight data contract", () => {
  it("agrees with the pipeline on field order and year", () => {
    expect(file.routeFields).toEqual([...ROUTE_FIELDS]);
    expect(file.year).toBe(2025);
  });

  it("holds the busiest routes, busiest first, between two different known airports", () => {
    expect(file.routes.length % ROUTE_FIELDS.length).toBe(0);
    expect(routes).toHaveLength(Math.min(TOP_ROUTES, file.pairs));
    routes.forEach((r, i) => {
      expect(r.a).not.toBe(r.b);
      expect(file.airports[r.a]).toBeDefined();
      expect(file.airports[r.b]).toBeDefined();
      expect(r.passengers).toBeGreaterThan(0);
      if (i > 0) expect(r.passengers).toBeLessThanOrEqual(routes[i - 1].passengers);
    });
  });

  it("places every airport on the lower-48 map", () => {
    const albers = geoAlbersUsa().scale(ALBERS_SCALE).translate([...ALBERS_TRANSLATE]);
    for (const a of file.airports) {
      expect(a.lat, a.code).toBeGreaterThan(24);
      expect(a.lat, a.code).toBeLessThan(50);
      expect(a.lon, a.code).toBeGreaterThan(-125);
      expect(a.lon, a.code).toBeLessThan(-66);
      expect(albers([a.lon, a.lat]), a.code).not.toBeNull();
    }
  });

  it("stays inside the data budget", () => {
    expect(statSync(PATH).size + statSync(STATES).size).toBeLessThanOrEqual(DATA_BUDGET_BYTES);
  });
});
