import { schemeTableau10 } from "d3-scale-chromatic";

export const DATA_BASE = "/data/scoring";

/** Must equal scoring.json's topN; the contract test checks. */
export const TOP_N = 10;

/** One season per step; the race holds on the last season before looping. */
export const SEASON_MS = 450;
export const HOLD_MS = 3_000;

/** The chart is drawn in a logical frame RACE_WIDTH wide and TOP_N rows tall. */
export const RACE_WIDTH = 900;
export const ROW_HEIGHT = 64;
export const BAR_GAP = 10;
export const PAD_TOP = 8;
export const PAD_LEFT = 8;
/** Room right of the longest bar for its points label. */
export const PAD_RIGHT = 130;
export const RACE_HEIGHT = PAD_TOP * 2 + ROW_HEIGHT * TOP_N;
/** A bar at least this wide carries its name inside; a shorter one puts it after the bar. */
export const MIN_INSIDE_NAME = 260;

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const NAME_FONT = `700 24px ${FONT_STACK}`;
export const VALUE_FONT = `600 22px ${FONT_STACK}`;
export const NAME_COLOR = "#0b0d11";
export const VALUE_COLOR = "#eef0f4";
/** A player's bar colour is fixed by their place in the file, so it follows them up and down the chart. */
export const BAR_COLORS: readonly string[] = schemeTableau10;

/** Spec §6: about 2 MB per showcase. */
export const DATA_BUDGET_BYTES = 2_000_000;
