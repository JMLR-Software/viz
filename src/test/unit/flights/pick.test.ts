import { describe, expect, it } from "vitest";
import { airportSummary, nearestAirport, routesTouching } from "../../../web/flights/lib/pick.js";

const routes = [
  { a: 0, b: 2, passengers: 1800, departures: 18 },
  { a: 1, b: 3, passengers: 540, departures: 9 },
  { a: 0, b: 3, passengers: 300, departures: 3 },
];

describe("nearestAirport", () => {
  const points: [number, number][] = [[0, 0], [10, 0], [20, 0]];
  it("picks the closest airport within reach", () => {
    expect(nearestAirport(points, 11, 1, 5)).toBe(1);
  });
  it("picks nothing when every airport is out of reach", () => {
    expect(nearestAirport(points, 50, 50, 5)).toBe(-1);
  });
});

describe("routesTouching and airportSummary", () => {
  it("lists the routes that start or end at an airport", () => {
    expect(routesTouching(routes, 3)).toEqual([1, 2]);
    expect(routesTouching(routes, 9)).toEqual([]);
  });
  it("counts an airport's routes and passengers", () => {
    expect(airportSummary(routes, 0)).toEqual({ routes: 2, passengers: 2100 });
  });
});
