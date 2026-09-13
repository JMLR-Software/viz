import { DELTA_CLAMP, FREQ_PERCENTILE, RADIUS_FLOOR } from "./config.js";
import { COURT_WIDTH, courtToSvg } from "./lib/court.js";
import { deltaFor, maxCount } from "./lib/hexes.js";
import type { HexBin } from "./lib/hexes.js";
import { clampDelta, efficiencyColor, frequencyCap, frequencyColor, hexRadius } from "./lib/scales.js";

export type Mode = "frequency" | "efficiency";

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
  return `${made} · ${fg}\n${sign}${percent(Math.abs(d))} vs All-Stars from here`;
}

/** Replace the heat map layer with hexagons for these bins. */
export function drawHexes(
  svg: SVGSVGElement,
  tooltip: HTMLElement,
  bins: HexBin[],
  mode: Mode,
  width: number,
  gridRadius: number,
): void {
  svg.querySelector(".hexes")?.remove();
  tooltip.hidden = true;
  if (bins.length === 0) return;

  const radius = gridRadius * (width / COURT_WIDTH);
  const svgH = svg.viewBox.baseVal.height || width;
  const cap = mode === "frequency" ? frequencyCap(bins, FREQ_PERCENTILE) : maxCount(bins);

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
}

export function legendText(mode: Mode): string {
  return mode === "frequency"
    ? "Colour is how often this spot was shot from — pale yellow is rare, deep red is a favourite."
    : "Colour is field goal percentage against the All-Star average from the same zones — red is better, blue is worse. Size is volume.";
}
