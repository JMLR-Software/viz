import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COUNTY_FIELDS, DATA_BUDGET_BYTES, TRACK_FIELDS } from "../../../web/tornadoes/config.js";
import type { TornadoFile } from "../../../web/tornadoes/lib/data.js";

const PATH = "public/data/tornadoes/tornadoes.json";
const file = JSON.parse(readFileSync(PATH, "utf8")) as TornadoFile;
const atlas = JSON.parse(readFileSync("public/data/tornadoes/counties.json", "utf8")) as {
  objects: { counties: { geometries: { id: string }[] } };
};

describe("the tornado data contract", () => {
  it("agrees with the pipeline on field order", () => {
    expect(file.trackFields).toEqual([...TRACK_FIELDS]);
    expect(file.countyFields).toEqual([...COUNTY_FIELDS]);
  });

  it("starts in 1950 and has one track array per year", () => {
    expect(file.firstYear).toBe(1950);
    expect(file.lastYear).toBeGreaterThanOrEqual(2024);
    expect(file.tracks).toHaveLength(file.lastYear - file.firstYear + 1);
    for (const year of file.tracks) expect(year.length % TRACK_FIELDS.length).toBe(0);
  });

  it("only names counties that exist in the atlas", () => {
    const ids = new Set(atlas.objects.counties.geometries.map((g) => g.id));
    for (const fips of Object.keys(file.counties)) expect(ids.has(fips), fips).toBe(true);
  });

  it("stays inside the data budget", () => {
    expect(statSync(PATH).size).toBeLessThanOrEqual(DATA_BUDGET_BYTES);
  });
});
