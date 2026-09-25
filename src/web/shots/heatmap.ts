import { DELTA_CLAMP, EFFICIENCY_CONFIDENT_SHOTS, FREQ_PERCENTILE, RADIUS_FLOOR } from "./config.js";
import { COURT_WIDTH, courtToSvg } from "./lib/court.js";
import { deltaFor } from "./lib/hexes.js";
import type { HexBin } from "./lib/hexes.js";
import type { Mode } from "./lib/legend.js";
import { clampDelta, confidenceOpacity, efficiencyColor, frequencyCap, frequencyColor, hexRadius } from "./lib/scales.js";

export type { Mode } from "./lib/legend.js";

const NS = "http://www.w3.org/2000/svg";

/** Pointy-top hexagon centred on the origin, in SVG units. */
function hexPath(r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push(`${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join("L")}Z`;
}

function percent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function tooltipText(bin: HexBin, mode: Mode): string {
  const made = `${bin.made}/${bin.count}`;
  const fg = bin.count === 0 ? "—" : percent(bin.made / bin.count);
  if (mode === "frequency") {
    return `${bin.count} ${bin.count === 1 ? "shot" : "shots"} · ${made} · ${fg}`;
  }
  const d = deltaFor(bin);
  const sign = d >= 0 ? "+" : "−";
  return `${made} · ${fg}\n${sign}${percent(Math.abs(d))} vs All-Stars from this zone`;
}

/** Replace the heat map layer with hexagons for these bins. Returns the frequency cap the colours used. */
export function drawHexes(
  svg: SVGSVGElement,
  tooltip: HTMLElement,
  bins: HexBin[],
  mode: Mode,
  width: number,
  gridRadius: number,
): number {
  svg.querySelector(".hexes")?.remove();
  tooltip.hidden = true;
  // Same cap for both modes: one huge bin should not flatten every other hex's colour or size.
  const cap = frequencyCap(bins, FREQ_PERCENTILE);
  if (bins.length === 0) return cap;

  const radius = gridRadius * (width / COURT_WIDTH);
  const svgH = svg.viewBox.baseVal.height || width;

  const layer = document.createElementNS(NS, "g");
  layer.setAttribute("class", "hexes");

  for (const bin of bins) {
    const centre = courtToSvg(bin.x, bin.y, width);
    const r = mode === "frequency"
      ? radius
      : hexRadius(bin.count, cap, radius, RADIUS_FLOOR);
    const path = document.createElementNS(NS, "path");
    path.setAttribute("class", "hex");
    path.setAttribute("d", hexPath(r));
    path.setAttribute("transform", `translate(${centre.x.toFixed(2)},${centre.y.toFixed(2)})`);
    path.setAttribute(
      "fill",
      mode === "frequency"
        ? frequencyColor(bin.count, cap)
        : efficiencyColor(clampDelta(deltaFor(bin), DELTA_CLAMP), DELTA_CLAMP),
    );
    if (mode === "efficiency") {
      path.setAttribute("fill-opacity", String(confidenceOpacity(bin.count, EFFICIENCY_CONFIDENT_SHOTS)));
    }
    path.addEventListener("pointerenter", () => {
      tooltip.textContent = tooltipText(bin, mode);
      tooltip.style.left = `${(centre.x / width) * 100}%`;
      tooltip.style.top = `${(centre.y / svgH) * 100}%`;
      tooltip.hidden = false;
    });
    path.addEventListener("pointerleave", () => {
      tooltip.hidden = true;
    });
    layer.appendChild(path);
  }

  svg.appendChild(layer);
  return cap;
}
