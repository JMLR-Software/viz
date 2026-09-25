import fetch_shots as fs


def row(**kw):
    base = {
        "LOC_X": 47,
        "LOC_Y": 32,
        "SHOT_MADE_FLAG": 1,
        "SHOT_ZONE_BASIC": "In The Paint (Non-RA)",
        "SHOT_DISTANCE": 5,
        "PERIOD": 1,
        "GAME_DATE": "20251023",
    }
    base.update(kw)
    return base


def test_transform_rows_builds_compact_tuples():
    shots, dropped = fs.transform_rows([row()])
    assert dropped == 0
    assert shots == [[47, 32, 1, 1, 5, 1, "20251023"]]


def test_transform_rows_drops_backcourt():
    shots, dropped = fs.transform_rows([row(), row(SHOT_ZONE_BASIC="Backcourt")])
    assert dropped == 1
    assert len(shots) == 1


def test_transform_rows_maps_every_zone_to_its_index():
    rows = [row(SHOT_ZONE_BASIC=z) for z in fs.ZONES]
    shots, dropped = fs.transform_rows(rows)
    assert dropped == 0
    assert [s[3] for s in shots] == list(range(len(fs.ZONES)))


def test_transform_rows_records_a_miss_as_zero():
    shots, _ = fs.transform_rows([row(SHOT_MADE_FLAG=0)])
    assert shots[0][2] == 0


def test_zone_totals_counts_attempts_and_makes_per_zone():
    shots = [
        [0, 0, 1, 0, 1, 1, "20251023"],
        [0, 0, 0, 0, 1, 1, "20251023"],
        [0, 0, 1, 2, 18, 2, "20251023"],
    ]
    totals = fs.zone_totals(shots)
    assert totals[0] == {"fga": 2, "fgm": 1}
    assert totals[2] == {"fga": 1, "fgm": 1}
    assert totals[5] == {"fga": 0, "fgm": 0}


def test_build_index_sorts_players_by_regular_season_attempts():
    players = [
        {"id": 1, "name": "Low", "team": "A", "conference": "East", "selection": "reserve",
         "regular": [[0, 0, 1, 0, 1, 1, "20251023"]], "playoffs": []},
        {"id": 2, "name": "High", "team": "B", "conference": "West", "selection": "starter",
         "regular": [[0, 0, 1, 0, 1, 1, "20251023"], [0, 0, 0, 0, 1, 1, "20251023"]], "playoffs": []},
    ]
    index = fs.build_index(players, dropped=4, generated_at="2026-09-13T00:00:00Z")
    assert [p["name"] for p in index["players"]] == ["High", "Low"]
    assert index["players"][0]["regular"] == {"fga": 2, "fgm": 1}
    assert index["pool"]["regular"]["fga"] == 3
    assert index["pool"]["regular"]["zones"][0] == {"fga": 3, "fgm": 2}
    assert index["droppedBackcourt"] == 4
    assert index["zones"] == fs.ZONES
    assert index["season"] == "2025-26"
