export interface RacePlayer {
  id: number;
  name: string;
  /** Season index of the first season with points. */
  first: number;
  /** Points per season from `first` to the player's last season; 0 for a season missed. */
  points: number[];
}

export interface ScoringFile {
  generatedAt: string;
  source: string;
  seasons: string[];
  candidates: number;
  /** M: the smallest candidate career total. */
  threshold: number;
  topN: number;
  startSeason: number;
  players: RacePlayer[];
}

export interface Race {
  totals: Int32Array[];
  /** Per season, the top topN player indices, highest first. */
  tops: number[][];
  topN: number;
  last: number;
}

export interface Bar {
  player: number;
  value: number;
  /** Row, 0 at the top. topN or more is below the chart. */
  y: number;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function cumulativeTotals(players: readonly RacePlayer[], seasons: number): Int32Array[] {
  return players.map((p) => {
    const out = new Int32Array(seasons);
    let running = 0;
    for (let s = 0; s < seasons; s += 1) {
      const offset = s - p.first;
      if (offset >= 0 && offset < p.points.length) running += p.points[offset];
      out[s] = running;
    }
    return out;
  });
}

export function rankAt(totals: readonly Int32Array[], season: number): number[] {
  return totals.map((_, i) => i).sort((a, b) => totals[b][season] - totals[a][season] || a - b);
}

export function buildRace(players: readonly RacePlayer[], seasons: number, topN: number): Race {
  const totals = cumulativeTotals(players, seasons);
  const tops = Array.from({ length: seasons }, (_, s) => rankAt(totals, s).slice(0, topN));
  return { totals, tops, topN, last: seasons - 1 };
}

/** Spec §6.5: the first season whose topN-th total is at least M. Totals never fall, so later seasons pass too. */
export function firstCompleteSeason(race: Race, threshold: number): number {
  return race.tops.findIndex((top, s) => top.length === race.topN && race.totals[top[race.topN - 1]][s] >= threshold);
}

/** Every bar on or entering the chart at a fractional season: values and rows both slide between seasons. */
export function barsAt(race: Race, position: number): Bar[] {
  const p = Math.min(Math.max(position, 0), race.last);
  const s0 = Math.floor(p);
  const s1 = Math.min(s0 + 1, race.last);
  const f = p - s0;
  const row = (season: number, player: number): number => {
    const i = race.tops[season].indexOf(player);
    return i === -1 ? race.topN : i;
  };
  const players = [...new Set([...race.tops[s0], ...race.tops[s1]])];
  return players
    .map((player) => ({
      player,
      value: lerp(race.totals[player][s0], race.totals[player][s1], f),
      y: lerp(row(s0, player), row(s1, player), f),
    }))
    .sort((a, b) => a.y - b.y || a.player - b.player);
}

/**
 * Assigns a palette index to every player who reaches the top `race.topN` in some season from `start` on, so that
 * no two players who ever share a season's top `topN` are given the same colour: greedy, in the order each player
 * first enters the top. Players who never reach the top from `start` on get -1 (drawRace only looks up bars it
 * draws, and those are always current or former top-`topN` members). Throws if `paletteSize` is too small to
 * colour the real overlap without a clash, rather than silently letting two players collide.
 */
export function barColors(race: Race, start: number, paletteSize: number): number[] {
  const neighbors = new Map<number, Set<number>>();
  const firstEntry = new Map<number, number>();
  for (let s = start; s <= race.last; s += 1) {
    const top = race.tops[s];
    for (let i = 0; i < top.length; i += 1) {
      const p = top[i];
      if (!neighbors.has(p)) neighbors.set(p, new Set());
      if (!firstEntry.has(p)) firstEntry.set(p, s);
      for (let j = i + 1; j < top.length; j += 1) {
        const q = top[j];
        neighbors.get(p)!.add(q);
        if (!neighbors.has(q)) neighbors.set(q, new Set());
        neighbors.get(q)!.add(p);
      }
    }
  }
  const order = [...firstEntry.keys()].sort((a, b) => firstEntry.get(a)! - firstEntry.get(b)! || a - b);
  const colors = new Array<number>(race.totals.length).fill(-1);
  for (const player of order) {
    const used = new Set([...neighbors.get(player)!].map((n) => colors[n]).filter((c) => c >= 0));
    let color = 0;
    while (used.has(color)) color += 1;
    if (color >= paletteSize) {
      throw new Error(`barColors: a palette of ${paletteSize} cannot colour player ${player} without a clash in a top ${race.topN}`);
    }
    colors[player] = color;
  }
  return colors;
}

export function seasonIndexAt(position: number, last: number): number {
  return Math.min(last, Math.max(0, Math.ceil(position)));
}

export function startNote(file: Pick<ScoringFile, "seasons" | "startSeason" | "topN" | "threshold" | "candidates">): string {
  const points = file.threshold.toLocaleString("en-US");
  return (
    `Starts in ${file.seasons[file.startSeason]}, the first season the top ${file.topN} is provably complete: ` +
    `${file.topN}th place had at least ${points} points, the ${file.candidates}th-highest career total, ` +
    `so no one outside the all-time top ${file.candidates} could be missing.`
  );
}
