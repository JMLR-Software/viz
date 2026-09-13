"""Pull 2025-26 shot data for the 2026 All-Star pool and write the site's data files.

Runs on a laptop, never on Cloudflare: stats.nba.com blocks curl and cloud egress.
See scripts/CONTEXT.md.
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

SEASON = "2025-26"
SEASON_TYPES = {"regular": "Regular Season", "playoffs": "Playoffs"}
ZONES = [
    "Restricted Area",
    "In The Paint (Non-RA)",
    "Mid-Range",
    "Left Corner 3",
    "Right Corner 3",
    "Above the Break 3",
]
ZONE_INDEX = {name: i for i, name in enumerate(ZONES)}
SLEEP_SECONDS = 1.0
RETRIES = 3
RETRY_SLEEP_SECONDS = 5.0
REQUEST_TIMEOUT = 30

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
PLAYERS_DIR = DATA_DIR / "players"
ROSTER_PATH = Path(__file__).resolve().parent / "roster.json"


def transform_rows(records):
    """Map raw shotchartdetail records to compact tuples. Returns (shots, dropped_backcourt)."""
    shots = []
    dropped = 0
    for r in records:
        zone = ZONE_INDEX.get(r["SHOT_ZONE_BASIC"])
        if zone is None:
            dropped += 1
            continue
        shots.append([
            int(r["LOC_X"]),
            int(r["LOC_Y"]),
            int(r["SHOT_MADE_FLAG"]),
            zone,
            int(r["SHOT_DISTANCE"]),
            int(r["PERIOD"]),
            str(r["GAME_DATE"]),
        ])
    return shots, dropped


def zone_totals(shots):
    """Attempts and makes per zone, in ZONES order."""
    totals = [{"fga": 0, "fgm": 0} for _ in ZONES]
    for s in shots:
        t = totals[s[3]]
        t["fga"] += 1
        t["fgm"] += s[2]
    return totals


def _totals(shots):
    return {"fga": len(shots), "fgm": sum(s[2] for s in shots)}


def build_index(players, dropped, generated_at):
    """Assemble index.json from per-player shot lists."""
    ordered = sorted(players, key=lambda p: len(p["regular"]), reverse=True)
    pool = {}
    for key in SEASON_TYPES:
        all_shots = [s for p in ordered for s in p[key]]
        pool[key] = {**_totals(all_shots), "zones": zone_totals(all_shots)}
    return {
        "season": SEASON,
        "generatedAt": generated_at,
        "zones": ZONES,
        "players": [
            {
                "id": p["id"],
                "name": p["name"],
                "team": p["team"],
                "conference": p["conference"],
                "selection": p["selection"],
                "regular": _totals(p["regular"]),
                "playoffs": _totals(p["playoffs"]),
            }
            for p in ordered
        ],
        "pool": pool,
        "droppedBackcourt": dropped,
    }


def fetch_player(player_id, season_type):
    """One shotchartdetail call with retries. Returns (records, team_name)."""
    from nba_api.stats.endpoints import shotchartdetail

    last = None
    for attempt in range(1, RETRIES + 1):
        try:
            resp = shotchartdetail.ShotChartDetail(
                player_id=player_id,
                team_id=0,
                season_nullable=SEASON,
                season_type_all_star=season_type,
                context_measure_simple="FGA",
                timeout=REQUEST_TIMEOUT,
            )
            df = resp.get_data_frames()[0]
            records = df.to_dict("records")
            team = str(df["TEAM_NAME"].iloc[-1]) if len(df) else ""
            return records, team
        except Exception as exc:  # noqa: BLE001 - any failure is retried then fatal
            last = exc
            print(f"  attempt {attempt}/{RETRIES} failed: {exc}", file=sys.stderr)
            if attempt < RETRIES:
                time.sleep(RETRY_SLEEP_SECONDS)
    raise SystemExit(f"giving up on player {player_id} ({season_type}): {last}")


def main():
    roster = json.loads(ROSTER_PATH.read_text(encoding="utf-8"))
    players = []
    dropped_total = 0

    for i, entry in enumerate(roster, start=1):
        print(f"[{i}/{len(roster)}] {entry['name']}")
        record = {**entry, "team": ""}
        for key, season_type in SEASON_TYPES.items():
            records, team = fetch_player(entry["id"], season_type)
            shots, dropped = transform_rows(records)
            dropped_total += dropped
            record[key] = shots
            if team and not record["team"]:
                record["team"] = team
            print(f"    {season_type}: {len(shots)} shots")
            time.sleep(SLEEP_SECONDS)
        players.append(record)

    PLAYERS_DIR.mkdir(parents=True, exist_ok=True)
    for p in players:
        path = PLAYERS_DIR / f"{p['id']}.json"
        path.write_text(
            json.dumps({"id": p["id"], "regular": p["regular"], "playoffs": p["playoffs"]}, separators=(",", ":")),
            encoding="utf-8",
        )

    combined = {
        "id": "all",
        "regular": [s for p in players for s in p["regular"]],
        "playoffs": [s for p in players for s in p["playoffs"]],
    }
    (DATA_DIR / "all.json").write_text(json.dumps(combined, separators=(",", ":")), encoding="utf-8")

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    index = build_index(players, dropped_total, generated_at)
    (DATA_DIR / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"wrote {len(players)} players, {combined and len(combined['regular'])} regular-season shots, {dropped_total} backcourt dropped")


if __name__ == "__main__":
    main()
