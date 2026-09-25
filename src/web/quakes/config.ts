export const DATA_BASE = "/data/quakes";

/** Must match scripts/quakes/fetch_quakes.py; quakes.json carries the list and the contract test checks. */
export const EVENT_FIELDS = ["minute", "lat", "lon", "mag", "depth"] as const;
export const COORD_SCALE = 100;
export const MAG_SCALE = 10;
export const MINUTES_PER_DAY = 1440;
export const MS_PER_DAY = 86_400_000;

/** The globe is drawn in a square logical frame of this many units. */
export const GLOBE_SIZE = 600;
export const GLOBE_MARGIN = 2;
/** Resting tilt in degrees (d3 rotate phi): negative shows a little more of the north, where most people are. */
export const GLOBE_TILT = -20;
export const MAX_TILT = 70;
/** Whole turns over one play of the year, so the loop from the last day to the first is seamless. */
export const TURNS_PER_PLAY = 2;
export const DRAG_DEG_PER_PX = 0.35;

/** The year plays in this long, then holds the final frame before looping. */
export const PLAY_MS = 24_000;
export const HOLD_MS = 2_500;

export const MIN_MAG = 4.5;
export const MAX_SLIDER_MAG = 7.5;
/** Dot radius in globe units at MIN_MAG, multiplied by RADIUS_GROWTH per magnitude unit (M7 is about 11.5). */
export const RADIUS_MIN = 1.6;
export const RADIUS_GROWTH = 2.2;
/** A ripple lasts this many days at MIN_MAG, plus RIPPLE_DAYS_PER_MAG per magnitude unit above it. */
export const RIPPLE_DAYS_MIN = 6;
export const RIPPLE_DAYS_PER_MAG = 6;
/** The ring grows to this multiple of the dot radius as it fades. */
export const RIPPLE_SPREAD = 3;
export const RING_WIDTH = 1.2;
/** After its ripple, a quake stays as a dim dot. */
export const DOT_ALPHA = 0.35;

export const OCEAN_FILL = "#0f1420";
export const LAND_FILL = "#232a36";
export const GRATICULE_STROKE = "rgba(255, 255, 255, 0.06)";
export const RIM_STROKE = "rgba(255, 255, 255, 0.18)";
export const QUAKE_COLOR = "#ffb45c";

/** Spec §6: about 2 MB per showcase, quakes.json and land.json together. */
export const DATA_BUDGET_BYTES = 2_000_000;
