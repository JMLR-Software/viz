import { pct } from "./data.js";
import type { Shot, Totals } from "./data.js";

export interface ZoneStat {
  zone: string;
  fga: number;
  fgm: number;
  pct: number | null;
  poolPct: number | null;
  delta: number | null;
}

function stat(zone: string, mine: Totals, pool: Totals): ZoneStat {
  const minePct = pct(mine);
  const poolPct = pct(pool);
  return {
    zone,
    fga: mine.fga,
    fgm: mine.fgm,
    pct: minePct,
    poolPct,
    delta: minePct === null || poolPct === null ? null : minePct - poolPct,
  };
}

/** Per-zone attempts, makes, and the gap against the pool, plus a totals row. */
export function zoneStats(
  shots: Shot[],
  poolZones: Totals[],
  zoneNames: readonly string[],
): { rows: ZoneStat[]; total: ZoneStat } {
  const mine: Totals[] = zoneNames.map(() => ({ fga: 0, fgm: 0 }));
  for (const s of shots) {
    const t = mine[s.zone];
    if (!t) continue;
    t.fga += 1;
    t.fgm += s.made ? 1 : 0;
  }

  const rows = zoneNames.map((name, i) =>
    stat(name, mine[i], poolZones[i] ?? { fga: 0, fgm: 0 }),
  );

  const sum = (totals: Totals[]): Totals => ({
    fga: totals.reduce((n, t) => n + t.fga, 0),
    fgm: totals.reduce((n, t) => n + t.fgm, 0),
  });

  return { rows, total: stat("Total", sum(mine), sum(poolZones)) };
}
