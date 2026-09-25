import { legendStops, legendTicks } from "../../shell/lib/legend.js";
import type { LegendStop, LegendTick } from "../../shell/lib/legend.js";
import { efficiencyColor, frequencyColor } from "./scales.js";

export type Mode = "frequency" | "efficiency";

export interface LegendSpec {
  title: string;
  stops: LegendStop[];
  ticks: LegendTick[];
}

/** YlOrRd from 1 shot to the cap, on the same square-root scale as the hexes. */
export function frequencyLegend(cap: number, tickCount: number, steps: number): LegendSpec {
  return {
    title: "Shots from each spot",
    stops: legendStops(cap, (count) => frequencyColor(count, cap), steps),
    ticks: legendTicks(cap, tickCount),
  };
}

/** RdBu from −limit to +limit FG% points, grey at the pool average; both ends clamp. */
export function efficiencyLegend(limit: number, steps: number): LegendSpec {
  const points = Math.round(limit * 100);
  return {
    title: "FG% points vs the All-Star average",
    stops: Array.from({ length: steps }, (_, i) => {
      const offset = i / (steps - 1);
      return { offset, color: efficiencyColor((offset * 2 - 1) * limit, limit) };
    }),
    ticks: [
      { value: -limit, offset: 0, label: `−${points} or worse` },
      { value: 0, offset: 0.5, label: "average" },
      { value: limit, offset: 1, label: `+${points} or better` },
    ],
  };
}

/** The line under the colour bar: what size and fading mean, or why efficiency is off. */
export function legendNote(mode: Mode, isPool: boolean, confidentShots: number): string {
  if (isPool) {
    return "Efficiency is unavailable here: the All-Star average is the baseline, so All All-Stars can't be compared with itself.";
  }
  return mode === "efficiency"
    ? `Each hex is compared with All-Stars' shots from its zone. Bigger hexes had more shots; faded ones had fewer than ${confidentShots}. This player's own shots are in the average.`
    : "";
}
