"""Pull the NBA's all-time top 500 scorers and each one's regular-season points by season, for the scoring race.

Runs on a laptop, like fetch_shots.py: nba_api only works from a residential machine. 501 calls, 1 s apart, about
ten minutes. Each player's response is cached in scripts/scoring/.cache/ (git-ignored), so a failed run resumes
where it stopped; delete the folder to refresh. See scripts/CONTEXT.md.
"""

import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

SOURCE = "NBA.com/stats via nba_api: all-time leaders and player career stats, regular season"
CANDIDATES = 500
TOP_N = 10
FIRST_SEASON_YEAR = 1946
LEADER_COLUMNS = ("PLAYER_ID", "PLAYER_NAME", "PTS")
SEASON_COLUMNS = ("SEASON_ID", "TEAM_ABBREVIATION", "PTS")
TRADED = "TOT"
SLEEP_SECONDS = 1.0
RETRIES = 3
RETRY_SLEEP_SECONDS = 5.0
REQUEST_TIMEOUT = 30

HERE = Path(__file__).resolve().parent
CACHE_DIR = HERE / ".cache"
OUT_PATH = HERE.parent.parent / "public" / "data" / "scoring" / "scoring.json"


def records(result_set, required):
    headers = result_set.get("headers") or []
    missing = [c for c in required if c not in headers]
    if missing:
        raise ValueError(f"missing columns: {', '.join(missing)}")
    return [dict(zip(headers, row)) for row in result_set.get("data") or []]


def parse_leaders(result_set, candidates=CANDIDATES):
    rows = records(result_set, LEADER_COLUMNS)
    if len(rows) != candidates:
        raise ValueError(f"expected {candidates} all-time leaders, got {len(rows)}")
    return [{"id": int(r["PLAYER_ID"]), "name": str(r["PLAYER_NAME"]), "career": int(r["PTS"])} for r in rows]


def season_index(season_id):
    return int(season_id[:4]) - FIRST_SEASON_YEAR


def season_label(index):
    year = FIRST_SEASON_YEAR + index
    return f"{year}-{(year + 1) % 100:02d}"


def season_points(result_set):
    """{season index: points}. A traded season has a row per team plus a TOT row; the TOT row is the season."""
    by_season = {}  # local accumulator; no input is mutated
    for r in records(result_set, SEASON_COLUMNS):
        by_season.setdefault(r["SEASON_ID"], []).append(r)
    out = {}
    for season_id, rows in by_season.items():
        totals = [r for r in rows if r["TEAM_ABBREVIATION"] == TRADED]
        if not totals and len(rows) > 1:
            raise ValueError(f"season {season_id} has {len(rows)} team rows and no {TRADED} row")
        chosen = totals[0] if totals else rows[0]
        if chosen["PTS"] is None:
            raise ValueError(f"season {season_id} has no points")
        out[season_index(season_id)] = int(chosen["PTS"])
    if not out:
        raise ValueError("no regular-season rows")
    return out


def build_players(leaders, points_by_id):
    """First season index and points per season from there (0 for a season missed). Every career must add up."""
    players = []
    mismatched = []
    for leader in leaders:
        seasons = points_by_id[leader["id"]]
        first, last = min(seasons), max(seasons)
        points = [seasons.get(i, 0) for i in range(first, last + 1)]
        if sum(points) != leader["career"]:
            mismatched.append(f"{leader['name']} ({sum(points)} by season vs {leader['career']} career)")
        players.append({"id": leader["id"], "name": leader["name"], "first": first, "points": points})
    if mismatched:
        raise ValueError("career totals disagree: " + "; ".join(mismatched))
    return players


def cumulative(player, seasons):
    totals = []
    running = 0
    for i in range(seasons):
        offset = i - player["first"]
        if 0 <= offset < len(player["points"]):
            running += player["points"][offset]
        totals.append(running)
    return totals


def first_complete_season(players, seasons, threshold, top_n=TOP_N):
    """The first season whose top_n-th cumulative total is at least threshold, or None.

    Anyone outside the candidates has a career total of at most threshold, so from that season on no outsider
    can be in the top_n. Cumulative totals never fall, so every later season passes too.
    """
    if top_n > len(players):
        return None
    table = [cumulative(p, seasons) for p in players]
    for s in range(seasons):
        ranked = sorted((t[s] for t in table), reverse=True)
        if ranked[top_n - 1] >= threshold:
            return s
    return None


def build_output(leaders, points_by_id, generated_at, top_n=TOP_N):
    players = build_players(leaders, points_by_id)
    seasons = max(p["first"] + len(p["points"]) for p in players)
    threshold = min(l["career"] for l in leaders)
    start = first_complete_season(players, seasons, threshold, top_n)
    if start is None:
        raise ValueError(f"no season's top {top_n} reaches {threshold}; the candidate set is too small")
    return {
        "generatedAt": generated_at,
        "source": SOURCE,
        "seasons": [season_label(i) for i in range(seasons)],
        "candidates": len(leaders),
        "threshold": threshold,
        "topN": top_n,
        "startSeason": start,
        "players": players,
    }


def write_json_atomic(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, separators=(",", ":"))
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def call_with_retries(label, make):
    last = None
    for attempt in range(1, RETRIES + 1):
        try:
            return make()
        except Exception as exc:  # noqa: BLE001 - any failure is retried then fatal
            last = exc
            print(f"  attempt {attempt}/{RETRIES} failed: {exc}", file=sys.stderr)
            if attempt < RETRIES:
                time.sleep(RETRY_SLEEP_SECONDS)
    raise SystemExit(f"fetch_scoring: giving up on {label}: {last}")


def fetch_leaders():
    from nba_api.stats.endpoints import alltimeleadersgrids

    return call_with_retries("the all-time leaders", lambda: alltimeleadersgrids.AllTimeLeadersGrids(
        league_id="00", per_mode_simple="Totals", season_type="Regular Season", topx=CANDIDATES,
        timeout=REQUEST_TIMEOUT,
    ).pts_leaders.get_dict())


def fetch_career(player_id):
    """One player's season totals, from the cache when present. Returns (result set, fetched)."""
    path = CACHE_DIR / f"{player_id}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8")), False
        except json.JSONDecodeError as error:
            raise ValueError(f"cache file {path} is corrupt ({error}); delete it and rerun") from error
    from nba_api.stats.endpoints import playercareerstats

    result = call_with_retries(f"player {player_id}", lambda: playercareerstats.PlayerCareerStats(
        player_id=player_id, per_mode36="Totals", timeout=REQUEST_TIMEOUT,
    ).season_totals_regular_season.get_dict())
    write_json_atomic(path, result)
    return result, True


def add_cache_hint(message):
    """The per-player cache never expires (see scripts/CONTEXT.md), so a rerun next season compares new leader
    totals against last season's cached rows and every active player fails here — a data-looking error that is
    really a stale cache. Point at the fix instead of leaving the wrong impression (Task 9 escalated this as a
    TOT-rule bug before the cause was found).
    """
    if not message.startswith("career totals disagree"):
        return message
    return f"{message} (if {CACHE_DIR} is from an earlier run, delete it and rerun: the per-player cache has no expiry)"


def main():
    try:
        leaders = parse_leaders(fetch_leaders())
        time.sleep(SLEEP_SECONDS)
        points_by_id = {}
        for i, leader in enumerate(leaders, start=1):
            result, fetched = fetch_career(leader["id"])
            try:
                points_by_id[leader["id"]] = season_points(result)
            except ValueError as error:
                raise ValueError(f"{leader['name']}: {error}") from error
            print(f"[{i}/{len(leaders)}] {leader['name']}{'' if fetched else ' (cached)'}")
            if fetched:
                time.sleep(SLEEP_SECONDS)
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        output = build_output(leaders, points_by_id, generated_at)
    except (OSError, ValueError, KeyError) as error:
        print(f"fetch_scoring: {add_cache_hint(str(error))}", file=sys.stderr)
        sys.exit(1)
    write_json_atomic(OUT_PATH, output)
    start = output["seasons"][output["startSeason"]]
    print(f"wrote {len(output['players'])} players over {len(output['seasons'])} seasons; the race starts in {start} "
          f"(10th place >= {output['threshold']}, the 500th career total)")


if __name__ == "__main__":
    main()
