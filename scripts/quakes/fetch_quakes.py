"""Pull every M4.5+ earthquake in the last 12 whole months from USGS and write the quakes showcase's data files.

Runs on a laptop. Writes public/data/quakes/{quakes,land}.json atomically. See scripts/CONTEXT.md.
"""

import csv
import io
import json
import os
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

USGS_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"
USGS_NAME = "USGS Earthquake Hazards Program, FDSN event service"
LAND_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json"
REQUEST_TIMEOUT = 60
MIN_MAG = 4.5
# FDSN refuses or truncates past this; a result this long means the window is incomplete.
USGS_LIMIT = 20000
REQUIRED_COLUMNS = ("time", "latitude", "longitude", "depth", "mag", "type", "id")
EVENT_FIELDS = ["minute", "lat", "lon", "mag", "depth"]
MAG_SCALE = 10

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = ROOT / "public" / "data" / "quakes"


def window_for(today):
    """The 12 whole months before today's month: (start, end), end exclusive."""
    end = today.replace(day=1)
    return end.replace(year=end.year - 1), end


def query_url(start, end):
    params = {
        "format": "csv",
        "starttime": start.isoformat(),
        "endtime": end.isoformat(),
        "minmagnitude": MIN_MAG,
        "eventtype": "earthquake",
        "orderby": "time-asc",
        "limit": USGS_LIMIT,
    }
    return f"{USGS_URL}?{urllib.parse.urlencode(params)}"


def parse_csv(text):
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"missing columns: {', '.join(missing)}")
    rows = list(reader)
    if not rows:
        raise ValueError("no events in the USGS result")
    if len(rows) >= USGS_LIMIT:
        raise ValueError(f"USGS returned {len(rows)} rows, its limit; the window would be truncated")
    return rows


def utc(day):
    return datetime(day.year, day.month, day.day, tzinfo=timezone.utc)


def parse_time(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def hundredths(value):
    return round(float(value) * 100)


def event(row, start_dt):
    minute = int((parse_time(row["time"]) - start_dt).total_seconds() // 60)
    return [
        minute,
        hundredths(row["latitude"]),
        hundredths(row["longitude"]),
        round(float(row["mag"]) * MAG_SCALE),
        round(float(row["depth"])),
    ]


def build_events(rows, start, end):
    """Earthquakes with start <= time < end, once per id, sorted by time. Returns (flat events, skipped)."""
    start_dt, end_dt = utc(start), utc(end)
    seen = set()  # local accumulator; no input is mutated
    kept = []
    skipped = 0
    for r in rows:
        if r["type"] != "earthquake" or r["id"] in seen:
            continue
        seen.add(r["id"])
        try:
            if not start_dt <= parse_time(r["time"]) < end_dt:
                continue
            kept.append(event(r, start_dt))
        except ValueError:
            skipped += 1  # a blank magnitude, position or time: counted, not drawn
    if not kept:
        raise ValueError("no earthquakes in the window")
    return [v for e in sorted(kept, key=lambda e: e[0]) for v in e], skipped


def build_output(rows, start, end, generated_at):
    events, skipped = build_events(rows, start, end)
    return {
        "generatedAt": generated_at,
        "source": USGS_NAME,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "minMag": MIN_MAG,
        "eventFields": EVENT_FIELDS,
        "events": events,
        "skipped": skipped,
    }


def check_land(topology):
    if "land" not in topology.get("objects", {}):
        raise ValueError("world-atlas file has no land object")


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


def download(url):
    with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT) as response:
        return response.read().decode("utf-8")


def main():
    start, end = window_for(datetime.now(timezone.utc).date())
    try:
        print(f"downloading {LAND_URL}")
        land = json.loads(download(LAND_URL))
        check_land(land)
        url = query_url(start, end)
        print(f"downloading {url}")
        rows = parse_csv(download(url))
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        output = build_output(rows, start, end, generated_at)
    except (OSError, ValueError, KeyError) as error:
        print(f"fetch_quakes: {error}", file=sys.stderr)
        sys.exit(1)
    write_json_atomic(OUT_DIR / "land.json", land)
    write_json_atomic(OUT_DIR / "quakes.json", output)
    total = len(output["events"]) // len(EVENT_FIELDS)
    print(f"wrote {total} earthquakes {output['start']} to {output['end']} (exclusive), {output['skipped']} skipped")


if __name__ == "__main__":
    main()
