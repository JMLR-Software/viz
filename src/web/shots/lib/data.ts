export type SeasonType = "regular" | "playoffs";
export type ResultFilter = "all" | "made" | "missed";

/** [x, y, made, zone, distance, period, date] as written by scripts/shots/fetch_shots.py. */
export type ShotTuple = [number, number, number, number, number, number, string];

export interface Shot {
  x: number;
  y: number;
  made: boolean;
  zone: number;
  distance: number;
  period: number;
  date: string;
}

export interface Totals {
  fga: number;
  fgm: number;
}

export interface PoolTotals extends Totals {
  zones: Totals[];
}

export interface PlayerEntry {
  id: number;
  name: string;
  team: string;
  conference: string;
  selection: string;
  regular: Totals;
  playoffs: Totals;
}

export interface IndexFile {
  season: string;
  generatedAt: string;
  zones: string[];
  players: PlayerEntry[];
  pool: Record<SeasonType, PoolTotals>;
  droppedBackcourt: number;
}

export interface ShotsFile {
  id: number | "all";
  regular: ShotTuple[];
  playoffs: ShotTuple[];
}

export function decodeShots(rows: ShotTuple[]): Shot[] {
  return rows.map(([x, y, made, zone, distance, period, date]) => ({
    x, y, made: made === 1, zone, distance, period, date,
  }));
}

/** Shooting percentage, or null when nobody attempted. */
export function pct(totals: Totals): number | null {
  return totals.fga === 0 ? null : totals.fgm / totals.fga;
}

/** One percentage per zone; zones with no attempts read 0 so they never skew a delta. */
export function zonePercentages(zones: Totals[]): number[] {
  return zones.map((z) => (z.fga === 0 ? 0 : z.fgm / z.fga));
}
