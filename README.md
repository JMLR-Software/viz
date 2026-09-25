# viz

A small gallery of D3 data visualisations on real public data, made for reels. Pick a showcase from the dropdown; add `?rec` to any URL for a 9:16 recording frame. The first showcase, All-Star Shots (`/shots`), is where the 2026 NBA All-Stars shot from during the 2025-26 season: a half-court hex heat map per player (or for the whole pool), by frequency or by efficiency against the All-Star average, with a zone table underneath.

**Status (2026-09-25):** the gallery shell, All-Star Shots, tornadoes, quakes, the NBA scoring race and flights are live at https://viz.jmlr.dev.

Live: https://viz.jmlr.dev (https://shots.jmlr.dev redirects to `/shots`)

## Run it

```
pnpm install
pnpm dev            # builds the frontend, serves on http://localhost:8787
```

## Tests

```
pnpm test           # Vitest unit tests on the pure math
pnpm test:coverage  # with the 80% threshold
pnpm test:e2e       # Playwright, starts its own wrangler dev
pnpm data:test      # pytest on the fetch script's pure parts
```

## Data

The data under `public/data/shots/` is committed. To refresh it:

```
pnpm data:setup     # once: python3.12 venv + nba_api
pnpm data:fetch:shots  # ~2 minutes, 56 calls to stats.nba.com
pnpm data:fetch:scoring  # ~10 minutes, 501 calls to stats.nba.com
```

Only works from a normal machine; the NBA blocks curl and cloud egress. See `scripts/CONTEXT.md`.

### Flights: two files downloaded by hand

TranStats has no scriptable download. Once per data year:

1. **T-100 Domestic Segment (All Carriers):** open
   https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FMG&QO_fu146_anzr=Nv4%20Pn44vr45 .
   Set the year filter to **2025** and the period to **All Months**, then tick only these fields: `YEAR`, `MONTH`,
   `PASSENGERS`, `DEPARTURES_PERFORMED`, `ORIGIN_AIRPORT_ID`, `ORIGIN`, `ORIGIN_STATE_ABR`, `DEST_AIRPORT_ID`,
   `DEST`, `DEST_STATE_ABR`. Download it and keep the .zip.
2. **Master Coordinate:** open
   https://www.transtats.bts.gov/DL_SelectFields.aspx?gnoyr_VQ=FLL&QO_fu146_anzr=N8vn6v10%20f722146%20gnoyr5 .
   Use no filter, and tick `AIRPORT_ID`, `AIRPORT`, `DISPLAY_AIRPORT_NAME`, `DISPLAY_AIRPORT_CITY_NAME_FULL`,
   `LATITUDE`, `LONGITUDE` and `AIRPORT_IS_LATEST`. Download it.
3. `pnpm data:fetch:flights ~/Downloads/<segments>.zip ~/Downloads/<coords>.zip`

The script refuses anything but all twelve months of 2025, so a wrong filter fails loudly rather than drawing
half a year. The downloads are not committed; `public/data/flights/` is.

## Deploy

```
pnpm run deploy
```

Data: NBA.com/stats via `nba_api`. Not affiliated with the NBA.
