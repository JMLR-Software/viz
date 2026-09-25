import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAR_COLORS, DATA_BUDGET_BYTES, TOP_N } from "../../../web/scoring/config.js";
import { barColors, buildRace, firstCompleteSeason } from "../../../web/scoring/lib/race.js";
import type { ScoringFile } from "../../../web/scoring/lib/race.js";

const PATH = "public/data/scoring/scoring.json";
const file = JSON.parse(readFileSync(PATH, "utf8")) as ScoringFile;
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

describe("the scoring data contract", () => {
  it("has the full candidate set and the page's top N", () => {
    expect(file.candidates).toBe(500);
    expect(file.players).toHaveLength(file.candidates);
    expect(file.topN).toBe(TOP_N);
  });

  it("labels one season per index from 1946-47", () => {
    expect(file.seasons[0]).toBe("1946-47");
    file.seasons.forEach((label, i) => expect(label.slice(0, 4)).toBe(String(1946 + i)));
    for (const p of file.players) expect(p.first + p.points.length).toBeLessThanOrEqual(file.seasons.length);
  });

  it("uses the smallest candidate career as the threshold", () => {
    expect(file.threshold).toBe(Math.min(...file.players.map((p) => sum(p.points))));
  });

  it("starts where the TypeScript completeness check says, independently of Python", () => {
    const race = buildRace(file.players, file.seasons.length, file.topN);
    expect(file.startSeason).toBeGreaterThan(0);
    expect(firstCompleteSeason(race, file.threshold)).toBe(file.startSeason);
  });

  it("stays inside the data budget", () => {
    expect(statSync(PATH).size).toBeLessThanOrEqual(DATA_BUDGET_BYTES);
  });

  it("colours no season's top N with a repeated colour, on the real data", () => {
    const race = buildRace(file.players, file.seasons.length, file.topN);
    const colors = barColors(race, file.startSeason, BAR_COLORS.length);
    for (let s = file.startSeason; s <= race.last; s += 1) {
      const top = race.tops[s].map((p) => colors[p]);
      expect(new Set(top).size).toBe(top.length);
    }
  });
});
