import { describe, expect, it } from "vitest";
import { decodeRoutes } from "../../../web/flights/lib/data.js";

describe("decodeRoutes", () => {
  it("turns the flat ints into routes", () => {
    expect(decodeRoutes([0, 2, 1800, 18, 1, 3, 540, 9])).toEqual([
      { a: 0, b: 2, passengers: 1800, departures: 18 },
      { a: 1, b: 3, passengers: 540, departures: 9 },
    ]);
  });
  it("ignores a trailing partial record", () => {
    expect(decodeRoutes([0, 2, 1800])).toEqual([]);
  });
});
