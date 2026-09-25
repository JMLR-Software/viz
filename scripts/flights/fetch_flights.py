"""Turn Josh's two BTS downloads into the flights showcase's data: the 1,000 busiest lower-48 airport pairs of 2025.

TranStats has no scriptable download, so the files are downloaded by hand (README, "Data") and passed in:

    pnpm data:fetch:flights SEGMENTS COORDS

each a TranStats .zip or the .csv inside it. The us-atlas states file is downloaded. See scripts/CONTEXT.md.
"""

import csv
import io
import json
import os
import sys
import tempfile
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SOURCE = ("US Bureau of Transportation Statistics, T-100 Domestic Segment (All Carriers), 2025, "
          "with airport coordinates from the BTS Master Coordinate table")
STATES_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json"
REQUEST_TIMEOUT = 60
YEAR = 2025
MONTHS = set(range(1, 13))
TOP_ROUTES = 1000
# Albers USA puts Alaska and Hawaii in insets, where a great circle means nothing; the map keeps the lower 48 and DC.
LOWER_48 = frozenset(
    "AL AZ AR CA CO CT DE DC FL GA ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR "
    "PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
)
SEGMENT_COLUMNS = ("YEAR", "MONTH", "PASSENGERS", "DEPARTURES_PERFORMED", "ORIGIN_AIRPORT_ID", "ORIGIN_STATE_ABR",
                   "DEST_AIRPORT_ID", "DEST_STATE_ABR")
COORD_COLUMNS = ("AIRPORT_ID", "AIRPORT", "DISPLAY_AIRPORT_NAME", "DISPLAY_AIRPORT_CITY_NAME_FULL", "LATITUDE",
                 "LONGITUDE", "AIRPORT_IS_LATEST")
ROUTE_FIELDS = ["a", "b", "passengers", "departures"]
COORD_DECIMALS = 4

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = ROOT / "public" / "data" / "flights"


def read_table(path, required):
    """Rows of a TranStats download: the .zip it comes as, or the .csv inside it."""
    path = Path(path)
    if not path.exists():
        raise ValueError(f"no such file: {path}")
    if path.suffix.lower() == ".zip":
        try:
            with zipfile.ZipFile(path) as archive:
                names = [n for n in archive.namelist() if n.lower().endswith(".csv")]
                if len(names) != 1:
                    raise ValueError(f"{path.name} should hold one .csv, found {len(names)}")
                text = archive.read(names[0]).decode("utf-8-sig")
        except zipfile.BadZipFile:
            raise ValueError(f"{path.name} is not a zip file (a truncated or failed download?)") from None
    else:
        text = path.read_text(encoding="utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in required if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"{path.name} is missing columns: {', '.join(missing)}")
    rows = list(reader)
    if not rows:
        raise ValueError(f"{path.name} has no rows")
    return rows


def number(value):
    """TranStats writes counts as "1234.00"."""
    return round(float(value))


def build_routes(rows):
    """The busiest lower-48 airport pairs, both directions summed. Returns (top, pairs, off_map_rows)."""
    years = {number(r["YEAR"]) for r in rows}
    if years != {YEAR}:
        raise ValueError(f"expected only {YEAR}, the file has {sorted(years)}: check the download's year filter")
    months = {number(r["MONTH"]) for r in rows}
    if months != MONTHS:
        raise ValueError(f"expected all 12 months of {YEAR}, the file has {sorted(months)}")
    totals = defaultdict(lambda: [0, 0])  # local accumulator; no input is mutated
    off_map = 0
    for r in rows:
        passengers = number(r["PASSENGERS"])
        if passengers <= 0:
            continue  # freight and mail only
        if r["ORIGIN_STATE_ABR"] not in LOWER_48 or r["DEST_STATE_ABR"] not in LOWER_48:
            off_map += 1
            continue
        a, b = sorted((number(r["ORIGIN_AIRPORT_ID"]), number(r["DEST_AIRPORT_ID"])))
        if a == b:
            continue
        totals[(a, b)][0] += passengers
        totals[(a, b)][1] += number(r["DEPARTURES_PERFORMED"])
    if not totals:
        raise ValueError("no passenger routes inside the lower 48")
    ranked = sorted(totals.items(), key=lambda item: (-item[1][0], item[0]))
    top = [(a, b, p, d) for (a, b), (p, d) in ranked[:TOP_ROUTES]]
    return top, len(totals), off_map


def build_airports(rows, ids):
    """{id: airport} from each wanted airport's latest row. Fails naming any id it cannot place.

    Only rows whose id is wanted are ever parsed: the Master Coordinate table has ~19k rows and
    parsing every latest one's coordinates would crash on the first blank LATITUDE/LONGITUDE
    anywhere in the file, not just among the ~300 airports this run actually needs.
    """
    wanted = set(ids)
    airports = {}
    for r in rows:
        airport_id = number(r["AIRPORT_ID"])
        if airport_id not in wanted or number(r["AIRPORT_IS_LATEST"]) != 1:
            continue
        try:
            lat = round(float(r["LATITUDE"]), COORD_DECIMALS)
            lon = round(float(r["LONGITUDE"]), COORD_DECIMALS)
        except ValueError:
            continue  # blank coordinates: reported below as missing, same as no row at all
        airports[airport_id] = {
            "code": r["AIRPORT"],
            "name": r["DISPLAY_AIRPORT_NAME"],
            "city": r["DISPLAY_AIRPORT_CITY_NAME_FULL"],
            "lat": lat,
            "lon": lon,
        }
    missing = [i for i in ids if i not in airports]
    if missing:
        raise ValueError(f"no usable coordinates for airport ids: {', '.join(map(str, missing))}")
    return {i: airports[i] for i in ids}


def build_output(segment_rows, coord_rows, generated_at):
    top, pairs, off_map = build_routes(segment_rows)
    ids = sorted({airport for a, b, _, _ in top for airport in (a, b)})
    airports = build_airports(coord_rows, ids)
    index = {airport: i for i, airport in enumerate(ids)}
    return {
        "generatedAt": generated_at,
        "source": SOURCE,
        "year": YEAR,
        "routeFields": ROUTE_FIELDS,
        "airports": [{"id": i, **airports[i]} for i in ids],
        "routes": [v for a, b, p, d in top for v in (index[a], index[b], p, d)],
        "pairs": pairs,
        "offMapRows": off_map,
    }


def check_states(topology):
    if "states" not in topology.get("objects", {}):
        raise ValueError("us-atlas file has no states object")


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


def main(argv):
    if len(argv) != 3:
        print("usage: fetch_flights.py SEGMENTS COORDS  (the two TranStats downloads, .zip or .csv)", file=sys.stderr)
        sys.exit(2)
    try:
        segment_rows = read_table(argv[1], SEGMENT_COLUMNS)
        coord_rows = read_table(argv[2], COORD_COLUMNS)
        print(f"downloading {STATES_URL}")
        states = json.loads(download(STATES_URL))
        check_states(states)
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        output = build_output(segment_rows, coord_rows, generated_at)
    except (OSError, ValueError, KeyError) as error:
        print(f"fetch_flights: {error}", file=sys.stderr)
        sys.exit(1)
    write_json_atomic(OUT_DIR / "states.json", states)
    write_json_atomic(OUT_DIR / "flights.json", output)
    routes = len(output["routes"]) // len(ROUTE_FIELDS)
    print(f"wrote {routes} routes of {output['pairs']} lower-48 pairs between {len(output['airports'])} airports; "
          f"{output['offMapRows']} rows touch Alaska, Hawaii or a territory and are left out")


if __name__ == "__main__":
    main(sys.argv)
