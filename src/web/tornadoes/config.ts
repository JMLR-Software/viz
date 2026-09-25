export const DATA_BASE = "/data/tornadoes";

/** Must match scripts/tornadoes/fetch_tornadoes.py; tornadoes.json carries both and the contract test checks. */
export const TRACK_FIELDS = ["lat", "lon", "dlat", "dlon", "mag"] as const;
export const COUNTY_FIELDS = ["year", "all", "strong"] as const;
/** Coordinates are stored in hundredths of a degree. */
export const COORD_SCALE = 100;

/** us-atlas's pre-projected frame: geoAlbersUsa().scale(1300).translate([487.5, 305]). */
export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;
export const ALBERS_SCALE = 1300;
export const ALBERS_TRANSLATE: readonly [number, number] = [487.5, 305];

/** 1950 to the last year plays in this long, then holds the final frame before looping. */
export const PLAY_MS = 20_000;
export const HOLD_MS = 2_500;
/** A year's tracks stay bright through their year, then fade over this many years. */
export const FLASH_FADE_YEARS = 1.5;

export const STRONG_MIN_MAG = 3;
/** Heat colour domain caps at this percentile of final county totals, so a few huge counties do not wash out the map. */
export const HEAT_PERCENTILE = 0.99;

export const EMPTY_FILL = "#171a21";
export const TRACK_COLOR = "#fff3c4";
export const STATE_STROKE = "rgba(255, 255, 255, 0.28)";
/** Line width in map units by F/EF rating 0–5; unknown ratings draw thinnest. */
export const TRACK_WIDTH_BY_MAG = [0.5, 0.7, 1, 1.4, 1.9, 2.5] as const;
export const UNKNOWN_TRACK_WIDTH = 0.5;

/** Spec §6: about 2 MB per showcase. tornadoes.json alone; the county atlas (~0.8 MB) is shared map geometry. */
export const DATA_BUDGET_BYTES = 2_200_000;
