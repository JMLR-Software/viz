import json
from datetime import date
from pathlib import Path

import pytest

import fetch_quakes as fq

FIXTURE = (Path(__file__).parent / "fixtures" / "sample.csv").read_text(encoding="utf-8")
START, END = date(2025, 9, 1), date(2026, 9, 1)


def rows():
    return fq.parse_csv(FIXTURE)


def test_window_is_the_last_twelve_whole_months():
    assert fq.window_for(date(2026, 9, 25)) == (START, END)
    assert fq.window_for(date(2026, 1, 1)) == (date(2025, 1, 1), date(2026, 1, 1))


def test_query_url_asks_for_earthquakes_in_time_order():
    url = fq.query_url(START, END)
    for part in ("format=csv", "starttime=2025-09-01", "endtime=2026-09-01", "minmagnitude=4.5",
                 "eventtype=earthquake", "orderby=time-asc", "limit=20000"):
        assert part in url


def test_parse_csv_rejects_a_missing_column():
    with pytest.raises(ValueError, match="missing columns: mag"):
        fq.parse_csv(FIXTURE.replace(",mag,", ",magx,", 1))


def test_parse_csv_rejects_an_empty_result():
    with pytest.raises(ValueError, match="no events"):
        fq.parse_csv(FIXTURE.splitlines()[0] + "\n")


def test_parse_csv_refuses_a_truncated_result(monkeypatch):
    monkeypatch.setattr(fq, "USGS_LIMIT", 3)
    with pytest.raises(ValueError, match="limit"):
        fq.parse_csv(FIXTURE)


def test_events_keep_the_window_drop_duplicates_and_other_types_and_sort_by_time():
    events, skipped = fq.build_events(rows(), START, END)
    assert events == [
        0, -5729, -2552, 45, 35,          # at the start
        90, 1893, 3914, 48, 10,           # 01:30:30.5 floors to minute 90
        281520, 3830, 14237, 71, 30,      # 2026-03-15 12:00, once
        525599, -1550, -17999, 52, 600,   # the last minute
    ]
    assert skipped == 1  # the row with no magnitude


def test_build_events_refuses_an_empty_window():
    with pytest.raises(ValueError, match="no earthquakes"):
        fq.build_events(rows(), date(2020, 1, 1), date(2020, 2, 1))


def test_build_output_names_its_window_and_fields():
    out = fq.build_output(rows(), START, END, "2026-09-25T00:00:00Z")
    assert (out["start"], out["end"], out["minMag"]) == ("2025-09-01", "2026-09-01", 4.5)
    assert out["eventFields"] == ["minute", "lat", "lon", "mag", "depth"]
    assert len(out["events"]) == 20
    assert out["skipped"] == 1


def test_check_land_wants_a_land_object():
    fq.check_land({"type": "Topology", "objects": {"land": {}}})
    with pytest.raises(ValueError, match="land"):
        fq.check_land({"type": "Topology", "objects": {}})


def test_write_json_atomic_leaves_no_temp_file(tmp_path):
    target = tmp_path / "out.json"
    fq.write_json_atomic(target, {"a": 1})
    assert json.loads(target.read_text()) == {"a": 1}
    assert [p.name for p in tmp_path.iterdir()] == ["out.json"]
