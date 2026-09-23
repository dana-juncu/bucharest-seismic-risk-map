"""
Step 3 of the data pipeline: turn the geocoded CSV into buildings.js,
the compact JS data file the map (index.html) loads directly.

Loaded as a <script src="buildings.js"> tag rather than fetched as JSON,
so the map also works when index.html is opened straight from disk
(fetch() of a local file is blocked by CORS under file://; a <script> tag
isn't).

Usage:
    python build_buildings_js.py --in buildings_geocoded.csv --out buildings.js
"""
import argparse
import csv
import json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="infile", default="buildings_geocoded.csv")
    ap.add_argument("--out", dest="outfile", default="buildings.js")
    args = ap.parse_args()

    rows = []
    with open(args.infile, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="^")
        for r in reader:
            # A handful of rows (3 as of the last pull) have no risk_class
            # text at all and no "not yet classified" status phrase either
            # -- normalize_risk() in parse_and_normalize.py buckets these as
            # "unknown". They're not a distinct real-world category (there's
            # no fifth AMCCRS status), so they're folded into "pending" here
            # rather than given their own confusing legend entry.
            risk = r["risk_class"].strip()
            if risk == "unknown":
                risk = "pending"
            rows.append({
                "id": int(r["id"]),
                "addr": r["address_raw"].strip(),
                "sector": r["sector"].strip(),
                "risk": risk,
                "year": r["year_built"].strip(),
                "height": r["height_regime"].strip(),
                "apts": r["apartment_count"].strip(),
                "expert": r["technical_expert"].strip(),
                "expertYear": r["expertise_year"].strip(),
                "notes": r["notes"].strip(),
                "lat": float(r["lat"]) if r["lat"] else None,
                "lon": float(r["lon"]) if r["lon"] else None,
                "precision": r["geo_precision"].strip(),
            })

    with open(args.outfile, "w", encoding="utf-8") as f:
        f.write("const BUILDINGS = ")
        json.dump(rows, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print(f"Wrote {len(rows)} buildings to {args.outfile}")


if __name__ == "__main__":
    main()
