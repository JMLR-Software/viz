# scripts/ — the data pipeline

## What this workspace is for

Pulling shot data from `stats.nba.com` through `nba_api` on the builder's machine and writing the files under `public/data/` that the page reads. This runs rarely (the 2025-26 season is complete) and never on Cloudflare.

## Layout

```
scripts/
├── roster.json          the 28-player 2026 All-Star pool: id, name, conference, selection (hand-maintained)
├── fetch_shots.py       fetch, transform_rows, build_index, write files
├── test_fetch_shots.py  pytest for the pure parts
├── requirements.txt     pinned: nba_api, pytest
└── .venv/               git-ignored, python3.12
```

## Key workflows

- **Set up:** `pnpm data:setup` (creates `scripts/.venv` with `/opt/homebrew/bin/python3.12` and installs requirements).
- **Fetch:** `pnpm data:fetch`. Takes about two minutes (56 calls, 1 s apart). On any player failing three times it exits non-zero and writes nothing.
- **Test:** `pnpm data:test`.
- After a fetch, commit `public/data/` in the same commit as any roster change.

## Rules

- `curl` and Worker `fetch` do not work against the NBA; only `nba_api` from a residential machine does. Do not try to move this to the edge.
- Sleep at least 1 s between calls. The NBA rate-limits and bans.
- `ZONES` order here must match `src/web/config.ts`; `index.json` carries the list and both sides test against it.
- Backcourt shots are dropped and counted in `index.json` as `droppedBackcourt`.

## What to avoid

- Hand-editing anything under `public/data/`.
- Adding pandas-heavy processing; the transform is a list comprehension.
