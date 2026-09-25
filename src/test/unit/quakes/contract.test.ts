import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DATA_BUDGET_BYTES, EVENT_FIELDS, MIN_MAG } from "../../../web/quakes/config.js";
import { decodeEvents, windowDays } from "../../../web/quakes/lib/data.js";
import type { QuakeFile } from "../../../web/quakes/lib/data.js";

const PATH = "public/data/quakes/quakes.json";
const LAND = "public/data/quakes/land.json";
const file = JSON.parse(readFileSync(PATH, "utf8")) as QuakeFile;

describe("the quake data contract", () => {
  it("agrees with the pipeline on field order and threshold", () => {
    expect(file.eventFields).toEqual([...EVENT_FIELDS]);
    expect(file.minMag).toBe(MIN_MAG);
  });

  it("covers twelve whole months", () => {
    expect(file.start).toMatch(/^\d{4}-\d{2}-01$/);
    expect(file.end).toMatch(/^\d{4}-\d{2}-01$/);
    expect(windowDays(file.start, file.end)).toBeGreaterThanOrEqual(365);
    expect(windowDays(file.start, file.end)).toBeLessThanOrEqual(366);
  });

  it("holds thousands of in-window, in-range quakes in time order", () => {
    const quakes = decodeEvents(file.events);
    const span = windowDays(file.start, file.end);
    expect(file.events.length % EVENT_FIELDS.length).toBe(0);
    expect(quakes.length).toBeGreaterThan(3000);
    for (let i = 0; i < quakes.length; i += 1) {
      const q = quakes[i];
      expect(q.day).toBeGreaterThanOrEqual(i === 0 ? 0 : quakes[i - 1].day);
      expect(q.day).toBeLessThan(span);
      expect(q.mag).toBeGreaterThanOrEqual(MIN_MAG);
      expect(Math.abs(q.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(q.lon)).toBeLessThanOrEqual(180);
    }
  });

  it("stays inside the data budget", () => {
    expect(statSync(PATH).size + statSync(LAND).size).toBeLessThanOrEqual(DATA_BUDGET_BYTES);
  });
});
