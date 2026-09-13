import { describe, expect, it } from "vitest";
import { sortPlayers } from "../../web/players.js";
import type { PlayerEntry } from "../../web/lib/data.js";

function player(name: string, fga: number, fgm: number): PlayerEntry {
  return {
    id: name.length, name, team: "T", conference: "West", selection: "starter",
    regular: { fga, fgm }, playoffs: { fga: 0, fgm: 0 },
  };
}

const players = [player("Mid", 100, 50), player("Volume", 300, 120), player("None", 0, 0), player("Efficient", 10, 9)];

describe("sortPlayers", () => {
  it("sorts by attempts", () => {
    expect(sortPlayers(players, "regular", "fga").map((p) => p.name)).toEqual(["Volume", "Mid", "Efficient", "None"]);
  });

  it("sorts by percentage", () => {
    expect(sortPlayers(players, "regular", "pct").map((p) => p.name)).toEqual(["Efficient", "Mid", "Volume", "None"]);
  });

  it("pushes players with no attempts to the end either way", () => {
    expect(sortPlayers(players, "regular", "pct").at(-1)?.name).toBe("None");
    expect(sortPlayers(players, "playoffs", "fga").map((p) => p.name)).toHaveLength(4);
  });

  it("does not mutate its input", () => {
    const before = players.map((p) => p.name);
    sortPlayers(players, "regular", "fga");
    expect(players.map((p) => p.name)).toEqual(before);
  });
});
