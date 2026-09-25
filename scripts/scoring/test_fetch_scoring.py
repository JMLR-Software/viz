import copy
import json
from pathlib import Path

import pytest

import fetch_scoring as fs

HERE = Path(__file__).parent / "fixtures"
LEADERS = json.loads((HERE / "leaders.json").read_text(encoding="utf-8"))
CAREERS = json.loads((HERE / "careers.json").read_text(encoding="utf-8"))


def leaders():
    return fs.parse_leaders(LEADERS, candidates=3)


def points():
    return {int(pid): fs.season_points(rs) for pid, rs in CAREERS.items()}


def test_parse_leaders_reads_ids_names_and_careers():
    assert leaders() == [
        {"id": 1, "name": "Ann", "career": 300},
        {"id": 2, "name": "Bo", "career": 250},
        {"id": 3, "name": "Cy", "career": 120},
    ]


def test_parse_leaders_wants_exactly_the_candidate_count():
    with pytest.raises(ValueError, match="expected 500 all-time leaders, got 3"):
        fs.parse_leaders(LEADERS)


def test_parse_leaders_rejects_a_missing_column():
    broken = {**LEADERS, "headers": ["PLAYER_ID", "PLAYER_NAME", "POINTS", "PTS_RANK", "IS_ACTIVE_FLAG"]}
    with pytest.raises(ValueError, match="missing columns: PTS"):
        fs.parse_leaders(broken, candidates=3)


def test_seasons_are_indexed_from_1946_47():
    assert fs.season_index("1946-47") == 0
    assert fs.season_index("2025-26") == 79
    assert fs.season_label(0) == "1946-47"
    assert fs.season_label(53) == "1999-00"


def test_a_traded_season_counts_its_tot_row_only():
    assert fs.season_points(CAREERS["1"]) == {0: 100, 1: 100, 2: 100}


def test_several_team_rows_without_a_tot_row_fail():
    broken = copy.deepcopy(CAREERS["1"])
    broken["data"] = [r for r in broken["data"] if r[2] != "TOT"]
    with pytest.raises(ValueError, match="1947-48 has 2 team rows and no TOT row"):
        fs.season_points(broken)


def test_a_season_with_no_points_fails():
    broken = copy.deepcopy(CAREERS["3"])
    broken["data"][0][4] = None
    with pytest.raises(ValueError, match="1949-50 has no points"):
        fs.season_points(broken)


def test_players_carry_a_first_season_and_zero_for_a_missed_one():
    players = fs.build_players(leaders(), points())
    assert players == [
        {"id": 1, "name": "Ann", "first": 0, "points": [100, 100, 100]},
        {"id": 2, "name": "Bo", "first": 1, "points": [50, 100, 0, 100]},
        {"id": 3, "name": "Cy", "first": 3, "points": [60, 60]},
    ]


def test_a_career_that_does_not_add_up_fails_by_name():
    off = [dict(l, career=130) if l["id"] == 3 else l for l in leaders()]
    with pytest.raises(ValueError, match=r"career totals disagree: Cy \(120 by season vs 130 career\)"):
        fs.build_players(off, points())


def test_cumulative_runs_through_every_season():
    players = fs.build_players(leaders(), points())
    assert [fs.cumulative(p, 5) for p in players] == [
        [100, 200, 300, 300, 300],
        [0, 50, 150, 150, 250],
        [0, 0, 0, 60, 120],
    ]


def test_the_race_starts_when_the_top_n_is_provably_complete():
    players = fs.build_players(leaders(), points())
    assert fs.first_complete_season(players, 5, 120, top_n=2) == 2
    assert fs.first_complete_season(players, 5, 120, top_n=3) == 4
    assert fs.first_complete_season(players, 5, 120, top_n=4) is None


def test_build_output_names_the_start_and_why():
    out = fs.build_output(leaders(), points(), "2026-09-25T00:00:00Z", top_n=2)
    assert out["seasons"] == ["1946-47", "1947-48", "1948-49", "1949-50", "1950-51"]
    assert (out["candidates"], out["threshold"], out["topN"], out["startSeason"]) == (3, 120, 2, 2)
    assert len(out["players"]) == 3


def test_build_output_fails_when_no_season_is_complete():
    with pytest.raises(ValueError, match="no season's top 4 reaches 120"):
        fs.build_output(leaders(), points(), "2026-09-25T00:00:00Z", top_n=4)


def test_write_json_atomic_leaves_no_temp_file(tmp_path):
    target = tmp_path / "out.json"
    fs.write_json_atomic(target, {"a": 1})
    assert json.loads(target.read_text()) == {"a": 1}
    assert [p.name for p in tmp_path.iterdir()] == ["out.json"]


def test_a_corrupt_cache_file_names_itself_in_the_error(tmp_path, monkeypatch):
    monkeypatch.setattr(fs, "CACHE_DIR", tmp_path)
    path = tmp_path / "42.json"
    path.write_text("not json", encoding="utf-8")
    with pytest.raises(ValueError, match=rf"cache file {path} is corrupt"):
        fs.fetch_career(42)


def test_a_good_cache_file_is_read_without_a_network_call(tmp_path, monkeypatch):
    monkeypatch.setattr(fs, "CACHE_DIR", tmp_path)
    (tmp_path / "42.json").write_text(json.dumps(CAREERS["1"]), encoding="utf-8")
    result, fetched = fs.fetch_career(42)
    assert fetched is False
    assert result == CAREERS["1"]


def test_add_cache_hint_leaves_other_errors_alone():
    assert fs.add_cache_hint("expected 500 all-time leaders, got 3") == "expected 500 all-time leaders, got 3"


def test_add_cache_hint_points_at_the_stale_cache_on_a_career_mismatch():
    hint = fs.add_cache_hint("career totals disagree: Ann (100 by season vs 130 career)")
    assert hint.startswith("career totals disagree: Ann (100 by season vs 130 career)")
    assert str(fs.CACHE_DIR) in hint
    assert "delete it and rerun" in hint
