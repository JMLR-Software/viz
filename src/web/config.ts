/** Zone names in the order the data pipeline writes them. Must match scripts/fetch_shots.py. */
export const ZONES = [
  "Restricted Area",
  "In The Paint (Non-RA)",
  "Mid-Range",
  "Left Corner 3",
  "Right Corner 3",
  "Above the Break 3",
] as const;

/** Hex grid radius in court units (tenths of a foot). 7.5 ≈ 0.75 ft between centres. */
export const HEX_RADIUS = 7.5;

/** Frequency colour domain caps at this percentile so one hot spot does not wash out the map. */
export const FREQ_PERCENTILE = 0.98;

/** Efficiency colour domain is clamped to ±this, in FG% points as a fraction. */
export const DELTA_CLAMP = 0.15;

/** In efficiency mode a hex never shrinks below this fraction of the grid radius. */
export const RADIUS_FLOOR = 0.35;

/**
 * Shot count at which an efficiency bin is drawn at full opacity. Below this, a bin fades
 * toward transparent so a one- or two-shot hex cannot shout as loudly as a well-sampled one.
 */
export const EFFICIENCY_CONFIDENT_SHOTS = 5;

/** SVG width the court is drawn at; height follows from the court aspect ratio. */
export const COURT_SVG_WIDTH = 560;

/** Where the committed data files live, relative to the site root. */
export const DATA_BASE = "/data";

/** NBA headshot CDN. Falls back to an initials badge on error. */
export function HEADSHOT_URL(id: number): string {
  return `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`;
}
