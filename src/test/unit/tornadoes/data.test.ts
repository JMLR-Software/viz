import { describe, expect, it } from "vitest";
import { decodeTracks } from "../../../web/tornadoes/lib/data.js";
import type { Project } from "../../../web/tornadoes/lib/data.js";

// A fake projection: x = lon, y = lat; anything south of 20°N is "off the map".
const project: Project = ([lon, lat]) => (lat < 20 ? null : [lon, lat]);

describe("decodeTracks", () => {
  it("decodes start and end from hundredths and deltas", () => {
    const { byYear, dropped } = decodeTracks([[3673, -10252, 15, 22, 1]], project);
    expect(dropped).toBe(0);
    expect(byYear[0][0]).toEqual({ x0: -102.52, y0: 36.73, x1: -102.3, y1: 36.88, mag: 1 });
  });

  it("draws a tornado with no end point as a point at its start", () => {
    const { byYear } = decodeTracks([[3417, -7860, 0, 0, 3]], project);
    const t = byYear[0][0];
    expect([t.x1, t.y1]).toEqual([t.x0, t.y0]);
  });

  it("drops and counts tracks off the map, never drawing them at the origin", () => {
    const { byYear, dropped } = decodeTracks([[3673, -10252, 15, 22, 1, 1840, -6610, 1, 1, 0]], project);
    expect(byYear[0]).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it("falls back to the start when only the end is off the map", () => {
    const { byYear } = decodeTracks([[2001, -8000, -5, 0, 0]], project);
    const t = byYear[0][0];
    expect([t.x1, t.y1]).toEqual([t.x0, t.y0]);
  });

  it("keeps one array per year, empty years included", () => {
    expect(decodeTracks([[], [3673, -10252, 0, 0, 0]], project).byYear.map((y) => y.length)).toEqual([0, 1]);
  });
});
