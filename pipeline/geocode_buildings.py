"""
geocode_buildings.py

Geocodes Bucharest AMCCRS seismic-risk building addresses via OpenStreetMap's
Nominatim (free, keyless, rate-limited to 1 req/sec per its usage policy).
Resumable: caches every lookup to disk, so re-running after an interruption
only fetches what's missing.

Every building here is in Bucharest by construction (AMCCRS only covers
Bucharest), so unlike a general RO geocoder this always anchors queries to
"Bucuresti, Romania" and falls back to a Bucharest sector centroid (never a
bare city-center point) when street-level lookup fails -- same fallback
approach used in geocode_candidates.py for the five-star business map.

USAGE:
  python geocode_buildings.py \
      --candidates buildings_for_geocoding.csv \
      --out buildings_geocoded.csv \
      [--cache geocode_cache.json] \
      [--retry-failed]

Takes a while the first time (2,796 addresses, budgeted at ~1.1s/request,
worst case ~1-2 hours if many need multiple query attempts) -- it's safe to
Ctrl+C and re-run later, already-geocoded addresses are skipped via the
cache file.
"""
import argparse
import csv
import json
import os
import sys
import time
import requests

DELIM = "^"
NOMINATIM_USER_AGENT = "bucharest-seismic-risk-map/1.0 (dana.juncu@diconium.com)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
RATE_LIMIT = 1.1

# Same Bucharest sector centroids used for the five-star business map.
BUCHAREST_SECTORS = {
    "Sector 1": (44.4669, 26.0820),
    "Sector 2": (44.4453, 26.1200),
    "Sector 3": (44.4185, 26.1200),
    "Sector 4": (44.3950, 26.0950),
    "Sector 5": (44.4050, 26.0500),
    "Sector 6": (44.4300, 26.0250),
}


def nominatim_query(query: str, session: requests.Session):
    try:
        resp = session.get(
            NOMINATIM_URL,
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "ro"},
            timeout=10,
        )
        resp.raise_for_status()
        results = resp.json()
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as e:
        print(f"  Warning: '{query}': {e}", file=sys.stderr)
    return None, None


def geocode_row(street: str, number: str, sector: str, session: requests.Session):
    queries = []
    street_part = f"{street} {number}".strip() if number else street
    if street:
        if sector:
            queries.append(f"{street_part}, {sector}, Bucuresti, Romania")
        queries.append(f"{street_part}, Bucuresti, Romania")
        if number:
            # retry without the house number if the number-specific query fails
            if sector:
                queries.append(f"{street}, {sector}, Bucuresti, Romania")
            queries.append(f"{street}, Bucuresti, Romania")

    for query in queries:
        lat, lon = nominatim_query(query, session)
        time.sleep(RATE_LIMIT)
        if lat is not None:
            return lat, lon, "street"

    if sector in BUCHAREST_SECTORS:
        lat, lon = BUCHAREST_SECTORS[sector]
        return lat, lon, "sector_centroid"

    return 44.4268, 26.1025, "city_center"


def load_cache(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_cache(path, cache):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--candidates", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--cache", default="geocode_cache.json")
    ap.add_argument("--retry-failed", action="store_true",
                     help="Re-attempt addresses previously marked sector_centroid/city_center")
    args = ap.parse_args()

    print("Loading buildings...", file=sys.stderr)
    with open(args.candidates, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f, delimiter=DELIM))
    print(f"  -> {len(rows):,} rows", file=sys.stderr)

    cache = load_cache(args.cache)

    if args.retry_failed:
        retry_precisions = {"sector_centroid", "city_center"}
        retry_ids = [rid for rid, v in cache.items() if v.get("precision") in retry_precisions]
        for rid in retry_ids:
            del cache[rid]
        print(f"  -> retrying {len(retry_ids):,} previously unresolved addresses", file=sys.stderr)

    already_done = sum(1 for r in rows if r["id"] in cache)
    remaining = len(rows) - already_done
    print(f"  -> {already_done:,} cached, {remaining:,} to fetch", file=sys.stderr)
    if remaining > 0:
        print(f"  -> Estimated time: {remaining * RATE_LIMIT / 60:.0f} minutes (worst case, more if retries needed)",
              file=sys.stderr)

    session = requests.Session()
    session.headers.update({"User-Agent": NOMINATIM_USER_AGENT})

    done = 0
    precision_counts = {}
    for row in rows:
        rid = row["id"]
        if rid in cache:
            p = cache[rid].get("precision", "?")
            precision_counts[p] = precision_counts.get(p, 0) + 1
            continue

        lat, lon, precision = geocode_row(row["street_query"], row["house_number"], row["sector"], session)
        cache[rid] = {"lat": lat, "lon": lon, "precision": precision}
        precision_counts[precision] = precision_counts.get(precision, 0) + 1
        done += 1

        if done % 50 == 0:
            save_cache(args.cache, cache)
            pct = (already_done + done) / len(rows) * 100
            print(f"  [{already_done + done:,}/{len(rows):,} | {pct:.1f}%] {row['address_raw'][:50]} -> {precision}",
                  file=sys.stderr)

    save_cache(args.cache, cache)

    print("\nGeocoding precision breakdown:", file=sys.stderr)
    for level, count in sorted(precision_counts.items(), key=lambda x: -x[1]):
        print(f"  {level}: {count:,}", file=sys.stderr)

    for row in rows:
        c = cache.get(row["id"], {})
        row["lat"] = c.get("lat", "")
        row["lon"] = c.get("lon", "")
        row["geo_precision"] = c.get("precision", "failed")

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), delimiter=DELIM)
        w.writeheader()
        w.writerows(rows)
    print(f"\n  -> written to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
