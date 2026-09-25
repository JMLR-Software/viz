import { quantile } from "d3-array";

/** Running total per county, indexed by year offset. Built once per toggle state. */
export function buildCumulative(
  counties: Record<string, number[][]>,
  years: number,
  strongOnly: boolean,
): Map<string, Int32Array> {
  const out = new Map<string, Int32Array>();
  for (const [fips, entries] of Object.entries(counties)) {
    const perYear = new Int32Array(years);
    for (const [year, all, strong] of entries) {
      if (year >= 0 && year < years) perYear[year] += strongOnly ? strong : all;
    }
    for (let i = 1; i < years; i += 1) perYear[i] += perYear[i - 1];
    out.set(fips, perYear);
  }
  return out;
}

export function countAt(cumulative: ReadonlyMap<string, Int32Array>, fips: string, yearIndex: number): number {
  const series = cumulative.get(fips);
  if (!series || yearIndex < 0) return 0;
  return series[Math.min(yearIndex, series.length - 1)];
}

/** The colour-domain top: a percentile of final totals, never below 1. */
export function maxFinal(cumulative: ReadonlyMap<string, Int32Array>, percentile: number): number {
  const finals = [...cumulative.values()].map((s) => s[s.length - 1]);
  return Math.max(1, quantile(finals, percentile) ?? 0);
}
