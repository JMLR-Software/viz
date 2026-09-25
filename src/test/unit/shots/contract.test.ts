import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZONES } from "../../../web/shots/config.js";
import type { IndexFile } from "../../../web/shots/lib/data.js";

const index = JSON.parse(readFileSync("public/data/shots/index.json", "utf8")) as IndexFile;

describe("the data contract", () => {
  it("agrees with the pipeline on the zone list and its order", () => {
    expect(index.zones).toEqual([...ZONES]);
  });

  it("carries the whole All-Star pool", () => {
    expect(index.players).toHaveLength(28);
  });

  it("carries pool totals for both season types", () => {
    expect(index.pool.regular.zones).toHaveLength(ZONES.length);
    expect(index.pool.playoffs.zones).toHaveLength(ZONES.length);
    expect(index.pool.regular.fga).toBeGreaterThan(0);
  });

  it("sorts players by regular-season attempts", () => {
    const fga = index.players.map((p) => p.regular.fga);
    expect([...fga].sort((a, b) => b - a)).toEqual(fga);
  });

  it("names the season it covers", () => {
    expect(index.season).toBe("2025-26");
  });
});
