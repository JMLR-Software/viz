import { EMPTY_FILL, LEGEND_STOPS, LEGEND_TICKS } from "./config.js";
import type { Heat } from "./draw.js";
import { renderLegendBar } from "../shell/legend.js";
import { legendStops, legendTicks } from "../shell/lib/legend.js";

/** Redraw the colour key for the heat in use. */
export function renderLegend(root: HTMLElement, heat: Heat, strongOnly: boolean): void {
  const swatch = root.querySelector<HTMLElement>(".legend-swatch");
  if (!swatch) throw new Error("missing .legend-swatch");
  swatch.style.background = EMPTY_FILL;
  renderLegendBar(root, {
    title: `${strongOnly ? "EF3+ tornadoes" : "Tornadoes"} per county since 1950`,
    stops: legendStops(heat.max, heat.color, LEGEND_STOPS),
    ticks: legendTicks(heat.max, LEGEND_TICKS),
  });
}
