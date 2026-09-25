# scripts/ — the data pipeline

## What this workspace is for

Pulling each showcase's data on the builder's machine and writing the files under `public/data/<slug>/` that the pages read: shots from `stats.nba.com` through `nba_api`, tornadoes from the NOAA Storm Prediction Center. This runs rarely and never on Cloudflare.

## Layout

```
scripts/
├── shots/
│   ├── roster.json          the 28-player 2026 All-Star pool: id, name, conference, selection (hand-maintained)
│   ├── fetch_shots.py       fetch, transform_rows, build_index, write files to public/data/shots/
│   └── test_fetch_shots.py  pytest for the pure parts
├── tornadoes/
│   ├── fetch_tornadoes.py       download the SPC CSV and the us-atlas counties, write public/data/tornadoes/
│   ├── test_fetch_tornadoes.py  pytest against the fixture, never the network
│   └── fixtures/sample.csv      one row of each case: single-state, point, MO→IL multi-state, continuation, unknown rating, renamed county, Puerto Rico
├── requirements.txt     pinned: nba_api, pytest
└── .venv/               git-ignored, python3.12
```

## Key workflows

- **Set up:** `pnpm data:setup` (creates `scripts/.venv` with `/opt/homebrew/bin/python3.12` and installs requirements).
- **Fetch:** `pnpm data:fetch:shots`. Takes about two minutes (56 calls, 1 s apart). On any player failing three times it exits non-zero and writes nothing.
- **Fetch tornadoes:** `pnpm data:fetch:tornadoes` (two downloads, a few seconds). Exits non-zero and writes nothing on a missing column, an empty file or a failed download.
- **Test:** `pnpm data:test`.
- After a fetch, commit `public/data/shots/` in the same commit as any roster change.

## Rules

- `curl` and Worker `fetch` do not work against the NBA; only `nba_api` from a residential machine does. Do not try to move this to the edge.
- Sleep at least 1 s between calls. The NBA rate-limits and bans.
- `ZONES` order here must match `src/web/shots/config.ts`; `index.json` carries the list and both sides test against it.
- Backcourt shots are dropped and counted in `index.json` as `droppedBackcourt`.
- Tornadoes: tracks come from `sg=1` rows, county counts from `sn=1` rows.
- Tornadoes: `FIPS_REMAP` handles county renames; `unmatchedCountyRefs` is the rest.
- Tornadoes: `TRACK_FIELDS` and `COUNTY_FIELDS` must match `src/web/tornadoes/config.ts`.

## What to avoid

- Hand-editing anything under `public/data/`.
- Adding pandas-heavy processing; the transform is a list comprehension.
