import type { LegendStop, LegendTick } from "./lib/legend.js";

export interface LegendBar {
  title: string;
  stops: LegendStop[];
  ticks: LegendTick[];
}

/** Fill a `.legend` figure's title, gradient and ticks. Styles go through the CSSOM, which the CSP allows. */
export function renderLegendBar(root: HTMLElement, bar: LegendBar): void {
  const part = (selector: string): HTMLElement => {
    const node = root.querySelector<HTMLElement>(selector);
    if (!node) throw new Error(`missing ${selector}`);
    return node;
  };
  part(".legend-title").textContent = bar.title;
  const stops = bar.stops.map((s) => `${s.color} ${(s.offset * 100).toFixed(1)}%`);
  part(".legend-ramp").style.background = `linear-gradient(to right, ${stops.join(", ")})`;
  part(".legend-ticks").replaceChildren(
    ...bar.ticks.map((t) => {
      const tick = document.createElement("span");
      tick.className = "legend-tick";
      tick.style.left = `${(t.offset * 100).toFixed(1)}%`;
      tick.textContent = t.label;
      return tick;
    }),
  );
}
