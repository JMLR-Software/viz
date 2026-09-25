export const DATA_BASE = "/data/flights";

/** Must match scripts/flights/fetch_flights.py; flights.json carries the list and the contract test checks. */
export const ROUTE_FIELDS = ["a", "b", "passengers", "departures"] as const;
export const TOP_ROUTES = 1000;

/** us-atlas's pre-projected frame, the same as the tornado map: geoAlbersUsa().scale(1300).translate([487.5, 305]). */
export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;
export const ALBERS_SCALE = 1300;
export const ALBERS_TRANSLATE: readonly [number, number] = [487.5, 305];

/** Points per great-circle arc. */
export const ARC_STEPS = 32;
/** Arc width in map units, square-root scaled by passengers. */
export const MIN_ARC_WIDTH = 0.25;
export const MAX_ARC_WIDTH = 3;
/** One travelling dot per this many departures in the year (both directions), at least 1, at most MAX_DOTS. */
export const DEPARTURES_PER_DOT = 2_000;
export const MAX_DOTS = 12;
/** A dot crosses its arc in this long, whatever the arc's length; the loop is seamless. */
export const TRAVEL_MS = 6_000;
export const DOT_RADIUS = 1.1;
export const AIRPORT_RADIUS = 1.4;
export const SELECTED_RADIUS = 5;
/** A tap within this many map units of an airport picks it. */
export const TAP_RADIUS = 14;
export const STATE_BORDER_WIDTH = 0.5;
export const SELECTED_RING_WIDTH = 1.5;

export const STATE_FILL = "#151922";
export const STATE_STROKE = "rgba(255, 255, 255, 0.18)";
export const ARC_COLOR = "rgba(127, 178, 255, 0.35)";
export const DOT_COLOR = "#e8f1ff";
export const AIRPORT_COLOR = "rgba(255, 255, 255, 0.7)";
export const SELECTED_COLOR = "#ff6b7a";

/** Spec §6: about 2 MB per showcase, flights.json and states.json together. */
export const DATA_BUDGET_BYTES = 2_000_000;
