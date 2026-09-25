import { scaleSequentialSqrt } from "d3-scale";
import { interpolateInferno } from "d3-scale-chromatic";
import { TRACK_WIDTH_BY_MAG, UNKNOWN_TRACK_WIDTH } from "../config.js";

/** Sequential heat for a running county total. 0 is the empty fill; the top of inferno is left out so tracks stay brighter. */
export function heatScale(max: number, empty: string): (count: number) => string {
  const scale = scaleSequentialSqrt((t: number) => interpolateInferno(0.15 + t * 0.8))
    .domain([0, max])
    .clamp(true);
  return (count) => (count <= 0 ? empty : scale(count));
}

export function trackWidth(mag: number): number {
  return TRACK_WIDTH_BY_MAG[mag] ?? UNKNOWN_TRACK_WIDTH;
}
