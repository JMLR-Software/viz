"""Pull every US tornado since 1950 from NOAA SPC and write the tornadoes showcase's data files.

Runs on a laptop. Writes public/data/tornadoes/{tornadoes,counties}.json atomically. See scripts/CONTEXT.md.
"""

import csv
import io
import json
import os
import sys
import tempfile
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SPC_URL = "https://www.spc.noaa.gov/wcm/data/1950-2025_all_tornadoes.csv"
SPC_NAME = "NOAA Storm Prediction Center, 1950-2025_all_tornadoes.csv"
ATLAS_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-albers-10m.json"
REQUEST_TIMEOUT = 60
MIN_ATLAS_COUNTIES = 3000
STRONG_MIN_MAG = 3
UNKNOWN_MAG = -1
REQUIRED_COLUMNS = ("yr", "mag", "stf", "slat", "slon", "elat", "elon", "sn", "sg", "f1", "f2", "f3", "f4")
COUNTY_COLUMNS = ("f1", "f2", "f3", "f4")
TRACK_FIELDS = ["lat", "lon", "dlat", "dlon", "mag"]
COUNTY_FIELDS = ["year", "all", "strong"]
# SPC keeps the FIPS in force when the tornado happened; us-atlas (2017) has the current ones.
FIPS_REMAP = {"12025": "12086", "46113": "46102", "51515": "51019", "02270": "02158"}

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = ROOT / "public" / "data" / "tornadoes"


def parse_csv(text):
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in REQUIRED_COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"missing columns: {', '.join(missing)}")
    rows = list(reader)
    if not rows:
        raise ValueError("no rows in the SPC file")
    return rows


def hundredths(value):
    return round(float(value) * 100)


def magnitude(value):
    mag = int(value)
    return UNKNOWN_MAG if mag < 0 else mag


def track(row):
    lat, lon = hundredths(row["slat"]), hundredths(row["slon"])
    if float(row["elat"]) == 0 or float(row["elon"]) == 0:
        dlat, dlon = 0, 0  # no end point recorded: draw a point
    else:
        dlat, dlon = hundredths(row["elat"]) - lat, hundredths(row["elon"]) - lon
    return [lat, lon, dlat, dlon, magnitude(row["mag"])]


def build_tracks(rows):
    """One whole-track row (sg == 1) per tornado, flattened per year. Returns (first, last, tracks)."""
    whole = [r for r in rows if r["sg"] == "1"]
    if not whole:
        raise ValueError("no whole-track (sg=1) rows")
    first = min(int(r["yr"]) for r in whole)
    last = max(int(r["yr"]) for r in whole)
    tracks = [[] for _ in range(last - first + 1)]  # local accumulator; no input is mutated
    for r in whole:
        tracks[int(r["yr"]) - first].extend(track(r))
    return first, last, tracks


def build_counties(rows, first_year, valid_fips):
    """Count tornadoes per county per year from the per-state rows (sn == 1). Returns (counties, unmatched)."""
    counts = defaultdict(lambda: [0, 0])  # local accumulator; no input is mutated
    unmatched = 0
    for r in rows:
        if r["sn"] != "1":
            continue
        strong = 1 if magnitude(r["mag"]) >= STRONG_MIN_MAG else 0
        year = int(r["yr"]) - first_year
        for column in COUNTY_COLUMNS:
            county = int(r[column])
            if county == 0:
                continue
            fips = f"{int(r['stf']):02d}{county:03d}"
            fips = FIPS_REMAP.get(fips, fips)
            if fips not in valid_fips:
                unmatched += 1
                continue
            counts[(fips, year)][0] += 1
            counts[(fips, year)][1] += strong
    counties = defaultdict(list)
    for (fips, year), (all_count, strong_count) in sorted(counts.items()):
        counties[fips].append([year, all_count, strong_count])
    return dict(counties), unmatched


def county_ids(topology):
    return {g["id"] for g in topology["objects"]["counties"]["geometries"]}


def build_output(rows, valid_fips, generated_at):
    first, last, tracks = build_tracks(rows)
    counties, unmatched = build_counties(rows, first, valid_fips)
    if not counties:
        raise ValueError("no county matched the atlas")
    return {
        "generatedAt": generated_at,
        "source": SPC_NAME,
        "firstYear": first,
        "lastYear": last,
        "trackFields": TRACK_FIELDS,
        "countyFields": COUNTY_FIELDS,
        "tracks": tracks,
        "counties": counties,
        "unmatchedCountyRefs": unmatched,
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


def download(url):
    with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT) as response:
        return response.read().decode("utf-8")


def main():
    try:
        print(f"downloading {ATLAS_URL}")
        topology = json.loads(download(ATLAS_URL))
        valid = county_ids(topology)
        if len(valid) < MIN_ATLAS_COUNTIES:
            raise ValueError(f"atlas has only {len(valid)} counties")
        print(f"downloading {SPC_URL}")
        rows = parse_csv(download(SPC_URL))
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        output = build_output(rows, valid, generated_at)
    except (OSError, ValueError, KeyError) as error:
        print(f"fetch_tornadoes: {error}", file=sys.stderr)
        sys.exit(1)
    write_json_atomic(OUT_DIR / "counties.json", topology)
    write_json_atomic(OUT_DIR / "tornadoes.json", output)
    total = sum(len(t) // len(TRACK_FIELDS) for t in output["tracks"])
    print(f"wrote {total} tornadoes {output['firstYear']}-{output['lastYear']}, "
          f"{len(output['counties'])} counties, {output['unmatchedCountyRefs']} county refs off the atlas")


if __name__ == "__main__":
    main()
