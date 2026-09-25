import { DEPARTURES_PER_DOT, MAX_ARC_WIDTH, MAX_DOTS, MIN_ARC_WIDTH } from "../config.js";

export function widthFor(passengers: number, max: number): number {
  return MIN_ARC_WIDTH + (MAX_ARC_WIDTH - MIN_ARC_WIDTH) * Math.sqrt(Math.max(0, passengers) / max);
}

export function dotCount(departures: number): number {
  return Math.min(MAX_DOTS, Math.max(1, Math.round(departures / DEPARTURES_PER_DOT)));
}
