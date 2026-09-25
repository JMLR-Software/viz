import { EMPTY_FILL, LEGEND_STOPS, LEGEND_TICKS } from "./config.js";
import type { Heat } from "./draw.js";
import { legendStops, legendTicks } from "./lib/legend.js";

/** Redraw the colour key for the heat in use. Styles go through the CSSOM, which the CSP allows. */
export function renderLegend(root: HTMLElement, heat: Heat, strongOnly: boolean): void {
  const part = (selector: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(selector);
    if (!node) throw new Error(`missing ${selector}`);
    return node;
  };
  part(".legend-title").textContent = `${strongOnly ? "EF3+ tornadoes" : "Tornadoes"} per county since 1950`;
  part(".legend-swatch").style.background = EMPTY_FILL;
  const stops = legendStops(heat.max, heat.color, LEGEND_STOPS).map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`);
  part(".legend-ramp").style.background = `linear-gradient(to right, ${stops.join(", ")})`;
  part(".legend-ticks").replaceChildren(
    ...legendTicks(heat.max, LEGEND_TICKS).map((t) => {
      const tick = document.createElement("span");
      tick.className = "legend-tick";
      tick.style.left = `${(t.offset * 100).toFixed(1)}%`;
      tick.textContent = t.label;
      return tick;
    }),
  );
}
