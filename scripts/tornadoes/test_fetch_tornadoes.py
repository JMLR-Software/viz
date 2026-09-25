import json
from pathlib import Path

import pytest

import fetch_tornadoes as ft

FIXTURE = (Path(__file__).parent / "fixtures" / "sample.csv").read_text(encoding="utf-8")
VALID = {"40025", "37047", "29189", "29510", "17119", "12086", "12011"}


def rows():
    return ft.parse_csv(FIXTURE)


def test_parse_csv_rejects_a_missing_column():
    broken = FIXTURE.replace(",sg,", ",sgx,", 1)
    with pytest.raises(ValueError, match="missing columns: sg"):
        ft.parse_csv(broken)


def test_parse_csv_rejects_an_empty_file():
    header = FIXTURE.splitlines()[0] + "\n"
    with pytest.raises(ValueError, match="no rows"):
        ft.parse_csv(header)


def test_tracks_take_one_row_per_tornado_by_year():
    first, last, tracks = ft.build_tracks(rows())
    assert (first, last) == (1950, 1951)
    assert tracks[0] == [3673, -10252, 15, 22, 1, 3417, -7860, 0, 0, 3]
    # 1951: the MO->IL whole track once (not its two state rows, not the -9 row), FL, PR.
    assert tracks[1] == [3877, -9022, 6, 19, 4, 2580, -8030, 5, 5, -1, 1840, -6610, 1, 1, 0]


def test_a_tornado_with_no_end_point_is_a_point():
    _, _, tracks = ft.build_tracks(rows())
    assert tracks[0][7:9] == [0, 0]


def test_counties_count_each_tornado_once_per_county_and_split_strong():
    counties, _ = ft.build_counties(rows(), 1950, VALID)
    assert counties == {
        "40025": [[0, 1, 0]],
        "37047": [[0, 1, 1]],
        "29189": [[1, 1, 1]],  # also on the -9 row: counted once
        "29510": [[1, 1, 1]],  # fifth county on, only on the sg=-9 row
        "17119": [[1, 1, 1]],
        "12086": [[1, 1, 0]],  # Dade 12025 renamed Miami-Dade 12086; listed twice, counted once
        "12011": [[1, 1, 0]],
    }


def test_counties_off_the_atlas_are_counted_not_dropped_silently():
    _, unmatched = ft.build_counties(rows(), 1950, VALID)
    assert unmatched == 1  # Puerto Rico 72127


def test_county_ids_reads_the_topology():
    topo = {"objects": {"counties": {"geometries": [{"id": "01001"}, {"id": "56045"}]}}}
    assert ft.county_ids(topo) == {"01001", "56045"}


def test_build_output_names_its_fields_and_years():
    out = ft.build_output(rows(), VALID, "2026-09-25T00:00:00Z")
    assert out["trackFields"] == ["lat", "lon", "dlat", "dlon", "mag"]
    assert out["countyFields"] == ["year", "all", "strong"]
    assert (out["firstYear"], out["lastYear"]) == (1950, 1951)
    assert len(out["tracks"]) == 2
    assert out["unmatchedCountyRefs"] == 1


def test_write_json_atomic_leaves_no_temp_file(tmp_path):
    target = tmp_path / "out.json"
    ft.write_json_atomic(target, {"a": 1})
    assert json.loads(target.read_text()) == {"a": 1}
    assert [p.name for p in tmp_path.iterdir()] == ["out.json"]
