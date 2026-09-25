import { scaleLinear } from "d3-scale";

export interface LegendTick {
  value: number;
  /** 0..1 along the bar, on the same square-root scale as the heat. */
  offset: number;
  label: string;
}

export interface LegendStop {
  offset: number;
  color: string;
}

/** Ticks closer than this (as a share of the bar) would overlap their labels. */
const MIN_TICK_GAP = 0.12;

const offsetOf = (value: number, max: number): number => Math.sqrt(value / max);

/** Ticks from 1 (the first coloured count) to max, which is labelled "max+" because the colours clamp there. */
export function legendTicks(max: number, count: number): LegendTick[] {
  const top: LegendTick = { value: max, offset: 1, label: `${Math.round(max)}+` };
  const candidates = [1, ...scaleLinear().domain([0, max]).ticks(count).filter((v) => v > 1 && v < max)];
  const kept = candidates
    .map((value) => ({ value, offset: offsetOf(value, max), label: String(value) }))
    .filter((t) => 1 - t.offset >= MIN_TICK_GAP)
    .reduce<LegendTick[]>((acc, t) => {
      const prev = acc[acc.length - 1];
      return prev && t.offset - prev.offset < MIN_TICK_GAP ? acc : [...acc, t];
    }, []);
  return [...kept, top];
}

/** Gradient stops evenly along the bar: offset t shows the colour of t² · max (never below 1). */
export function legendStops(max: number, color: (count: number) => string, steps: number): LegendStop[] {
  return Array.from({ length: steps }, (_, i) => {
    const offset = i / (steps - 1);
    return { offset, color: color(Math.max(1, offset * offset * max)) };
  });
}
