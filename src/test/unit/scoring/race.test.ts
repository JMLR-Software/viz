import { describe, expect, it } from "vitest";
import {
  barColors, barsAt, buildRace, cumulativeTotals, firstCompleteSeason, rankAt, seasonIndexAt, startNote,
} from "../../../web/scoring/lib/race.js";

const players = [
  { id: 1, name: "Ann", first: 0, points: [100, 100, 100] },
  { id: 2, name: "Bo", first: 1, points: [50, 100, 0, 100] },
  { id: 3, name: "Cy", first: 3, points: [60, 60] },
];

describe("cumulativeTotals", () => {
  it("runs each career through every season, holding after the last", () => {
    expect(cumulativeTotals(players, 5).map((t) => [...t])).toEqual([
      [100, 200, 300, 300, 300],
      [0, 50, 150, 150, 250],
      [0, 0, 0, 60, 120],
    ]);
  });
});

describe("rankAt", () => {
  it("ranks by total, highest first, with ties in file order", () => {
    const totals = cumulativeTotals(players, 5);
    expect(rankAt(totals, 0)).toEqual([0, 1, 2]);
    expect(rankAt(totals, 4)).toEqual([0, 1, 2]);
  });
});

describe("firstCompleteSeason", () => {
  it("agrees with the Python check on the same players", () => {
    expect(firstCompleteSeason(buildRace(players, 5, 2), 120)).toBe(2);
    expect(firstCompleteSeason(buildRace(players, 5, 3), 120)).toBe(4);
  });
  it("is -1 when no season reaches the threshold", () => {
    expect(firstCompleteSeason(buildRace(players, 5, 2), 1000)).toBe(-1);
  });
});

describe("barsAt", () => {
  // X passes Y between season 0 and season 1.
  const race = buildRace(
    [
      { id: 10, name: "X", first: 0, points: [100, 100] },
      { id: 11, name: "Y", first: 0, points: [150, 0] },
    ],
    2,
    2,
  );

  it("sits on the ranking at a whole season", () => {
    expect(barsAt(race, 0)).toEqual([
      { player: 1, value: 150, y: 0 },
      { player: 0, value: 100, y: 1 },
    ]);
  });
  it("slides values and rows between seasons, so an overtake is a crossing, not a jump", () => {
    expect(barsAt(race, 0.5)).toEqual([
      { player: 0, value: 150, y: 0.5 },
      { player: 1, value: 150, y: 0.5 },
    ]);
  });
  it("brings a newcomer up from just below the chart", () => {
    const one = { ...race, tops: race.tops.map((t) => t.slice(0, 1)), topN: 1 };
    const bars = barsAt(one, 0.25);
    expect(bars.find((b) => b.player === 0)!.y).toBeCloseTo(0.75);
    expect(bars.find((b) => b.player === 1)!.y).toBeCloseTo(0.25);
  });
  it("clamps past the last season", () => {
    expect(barsAt(race, 5)).toEqual(barsAt(race, 1));
  });
});

describe("barColors", () => {
  it("gives no two players who ever share a top the same colour", () => {
    // X leads season 0 with Y, then drops out of the top while Z overtakes and Y stays: X and Z never share a
    // top, so index-based colouring (0 and 2, both even) would collide, but they never need to differ.
    const race = buildRace(
      [
        { id: 1, name: "X", first: 0, points: [100, 0] },
        { id: 2, name: "Y", first: 0, points: [90, 50] },
        { id: 3, name: "Z", first: 0, points: [10, 200] },
      ],
      2,
      2,
    );
    expect(race.tops).toEqual([
      [0, 1],
      [2, 1],
    ]);
    const colors = barColors(race, 0, 2);
    expect(colors[0]).not.toBe(colors[1]); // season 0's top
    expect(colors[2]).not.toBe(colors[1]); // season 1's top
  });

  it("leaves a player who never reaches the top from start unassigned", () => {
    const race = buildRace(
      [
        { id: 1, name: "X", first: 0, points: [100, 100] },
        { id: 2, name: "Y", first: 0, points: [10, 10] },
      ],
      2,
      1,
    );
    expect(barColors(race, 0, 2)).toEqual([0, -1]);
  });

  it("throws rather than let three players who share a top collide in a two-colour palette", () => {
    const race = buildRace(
      [
        { id: 1, name: "A", first: 0, points: [100] },
        { id: 2, name: "B", first: 0, points: [90] },
        { id: 3, name: "C", first: 0, points: [80] },
      ],
      1,
      3,
    );
    expect(() => barColors(race, 0, 2)).toThrow(/palette of 2/);
  });
});

describe("seasonIndexAt", () => {
  it("names the season being moved toward, clamped to the data", () => {
    expect(seasonIndexAt(0, 4)).toBe(0);
    expect(seasonIndexAt(2.3, 4)).toBe(3);
    expect(seasonIndexAt(4, 4)).toBe(4);
    expect(seasonIndexAt(5.5, 4)).toBe(4);
  });
});

describe("startNote", () => {
  it("names the start season and why", () => {
    const note = startNote({
      seasons: ["1959-60", "1960-61"], startSeason: 1, topN: 10, threshold: 8770, candidates: 500,
    });
    expect(note).toBe(
      "Starts in 1960-61, the first season the top 10 is provably complete: 10th place had at least 8,770 points, " +
        "the 500th-highest career total, so no one outside the all-time top 500 could be missing.",
    );
  });
});
