import json
import zipfile
from pathlib import Path

import pytest

import fetch_flights as ff

HERE = Path(__file__).parent / "fixtures"
SEGMENTS = HERE / "segments.csv"
COORDS = HERE / "coords.csv"


def segments():
    return ff.read_table(SEGMENTS, ff.SEGMENT_COLUMNS)


def coords():
    return ff.read_table(COORDS, ff.COORD_COLUMNS)


def test_lower_48_is_the_contiguous_states_and_dc():
    assert len(ff.LOWER_48) == 49
    assert {"AK", "HI", "PR", "VI"}.isdisjoint(ff.LOWER_48)
    assert {"DC", "CA", "ME", "FL", "WA"} <= ff.LOWER_48


def test_read_table_reads_a_csv_and_the_same_csv_zipped(tmp_path):
    archive = tmp_path / "download.zip"
    with zipfile.ZipFile(archive, "w") as z:
        z.write(SEGMENTS, "T_T100D_SEGMENT_ALL_CARRIER.csv")
    assert ff.read_table(archive, ff.SEGMENT_COLUMNS) == segments()
    assert len(segments()) == 13


def test_read_table_wants_one_csv_in_a_zip(tmp_path):
    archive = tmp_path / "two.zip"
    with zipfile.ZipFile(archive, "w") as z:
        z.write(SEGMENTS, "a.csv")
        z.write(COORDS, "b.csv")
    with pytest.raises(ValueError, match="should hold one .csv, found 2"):
        ff.read_table(archive, ff.SEGMENT_COLUMNS)


def test_read_table_names_a_missing_file_and_a_missing_column(tmp_path):
    with pytest.raises(ValueError, match="no such file"):
        ff.read_table(tmp_path / "nope.csv", ff.SEGMENT_COLUMNS)
    with pytest.raises(ValueError, match="coords.csv is missing columns: YEAR, MONTH, PASSENGERS"):
        ff.read_table(COORDS, ff.SEGMENT_COLUMNS[:3])


def test_read_table_names_a_bad_zip(tmp_path):
    archive = tmp_path / "download.zip"
    archive.write_text("this is not a zip file, e.g. a failed or truncated download")
    with pytest.raises(ValueError, match="download.zip is not a zip"):
        ff.read_table(archive, ff.SEGMENT_COLUMNS)


def test_routes_sum_both_directions_and_skip_freight_off_map_and_self_pairs():
    top, pairs, off_map = ff.build_routes(segments())
    assert top == [(10397, 12892, 1800, 18), (12478, 13930, 540, 9), (10397, 13930, 300, 3)]
    assert (pairs, off_map) == (3, 2)


def test_routes_keep_only_the_busiest(monkeypatch):
    monkeypatch.setattr(ff, "TOP_ROUTES", 2)
    top, pairs, _ = ff.build_routes(segments())
    assert [(a, b) for a, b, _, _ in top] == [(10397, 12892), (12478, 13930)]
    assert pairs == 3


def test_a_download_for_the_wrong_year_fails():
    rows = [dict(r, YEAR="2024") if r["MONTH"] == "1" else r for r in segments()]
    with pytest.raises(ValueError, match="expected only 2025"):
        ff.build_routes(rows)


def test_a_download_missing_a_month_fails():
    rows = [r for r in segments() if r["MONTH"] != "7"]
    with pytest.raises(ValueError, match="all 12 months"):
        ff.build_routes(rows)


def test_no_passenger_routes_fails():
    rows = [dict(r, PASSENGERS="0.00") for r in segments()]
    with pytest.raises(ValueError, match="no passenger routes"):
        ff.build_routes(rows)


def test_airports_use_the_latest_coordinates():
    airports = ff.build_airports(coords(), [10397, 12892])
    assert airports == {
        10397: {"code": "ATL", "name": "Hartsfield-Jackson Atlanta International", "city": "Atlanta, GA",
                "lat": 33.6367, "lon": -84.4278},
        12892: {"code": "LAX", "name": "Los Angeles International", "city": "Los Angeles, CA",
                "lat": 33.9425, "lon": -118.4081},
    }


def test_an_airport_with_no_coordinates_is_named():
    rows = [r for r in coords() if r["AIRPORT"] != "JFK"]
    with pytest.raises(ValueError, match="no coordinates for airport ids: 12478"):
        ff.build_airports(rows, [10397, 12478])


def test_a_blank_coordinate_row_for_an_unneeded_airport_does_not_break_the_run():
    # coords.csv has an ANC row (id 10299) with blank LATITUDE/LONGITUDE: it is never among the
    # needed ids in this fixture, so build_airports must not even try to parse its coordinates.
    airports = ff.build_airports(coords(), [10397, 12892, 13930, 12478])
    assert set(airports) == {10397, 12892, 13930, 12478}


def test_a_needed_airport_with_blank_coordinates_is_named():
    with pytest.raises(ValueError, match="no coordinates for airport ids: 10299"):
        ff.build_airports(coords(), [10397, 10299])


def test_build_output_indexes_airports_and_flattens_routes():
    out = ff.build_output(segments(), coords(), "2026-09-25T00:00:00Z")
    assert out["year"] == 2025
    assert out["routeFields"] == ["a", "b", "passengers", "departures"]
    assert [a["code"] for a in out["airports"]] == ["ATL", "JFK", "LAX", "ORD"]
    assert out["routes"] == [0, 2, 1800, 18, 1, 3, 540, 9, 0, 3, 300, 3]
    assert (out["pairs"], out["offMapRows"]) == (3, 2)


def test_check_states_wants_a_states_object():
    ff.check_states({"objects": {"states": {}, "nation": {}}})
    with pytest.raises(ValueError, match="states"):
        ff.check_states({"objects": {"nation": {}}})


def test_write_json_atomic_leaves_no_temp_file(tmp_path):
    target = tmp_path / "out.json"
    ff.write_json_atomic(target, {"a": 1})
    assert json.loads(target.read_text()) == {"a": 1}
    assert [p.name for p in tmp_path.iterdir()] == ["out.json"]
