#!/usr/bin/env python3
"""fetch_footprints.py -- download OpenStreetMap building outlines for the registry buildings.

Writes ../footprints.js (a small JS data file: id -> list of outlines) which outlines.js uses to
draw the building on hover and on click. Run it on your own computer (Python 3.9+, `pip install requests`):

    cd pipeline
    python fetch_footprints.py --buildings ../buildings.js --out ../footprints.js
    python fetch_footprints.py --limit 60        # quick test on the first 60 buildings

It asks the public Overpass API for building polygons around each geocoded point (about a dozen nearby points per
request, one request every ~2 s, so the full run takes roughly 10-15 minutes), then picks the right polygon:
  a  the polygon tagged with the same house number (and street) as the registry address
  i  otherwise the polygon that contains the geocoded point
  n  otherwise the nearest polygon within 12 m (drawn dashed: a guess)
Anything else gets no outline rather than a wrong one. Raw responses are cached in
footprints_cache.json so an interrupted run resumes. Outlines are (c) OpenStreetMap contributors, ODbL.
"""
import argparse, json, math, os, re, sys, time, unicodedata
import requests

ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter",
             "https://overpass.kumi.systems/api/interpreter"]
UA = {"User-Agent": "bucharest-seismic-risk-map/1.0 (https://github.com/dana-juncu/bucharest-seismic-risk-map)"}
RADIUS = 45          # metres around each point
NEAR_MAX = 12        # metres for the 'n' (guess) match
BATCH = 12             # points per request: small and geographically close, so the public servers answer quickly


def strip(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower()

def load_js(path):
    txt = open(path, encoding="utf8").read()
    m = re.search(r"(?:const|let|var)\s+\w+\s*=\s*", txt)
    return json.loads(txt[m.end():].strip().rstrip(";").strip())

def hav(a, b, c, d):
    p = math.pi / 180
    x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 12742000 * math.asin(math.sqrt(x))

def in_poly(lat, lon, ring):                      # ray casting; ring = [(lat, lon), ...]
    inside = False
    n = len(ring)
    for i in range(n):
        y1, x1 = ring[i]; y2, x2 = ring[(i + 1) % n]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside

def dist_to_poly(lat, lon, ring):                 # metres, approximate (planar, vertices and edges)
    k = math.cos(lat * math.pi / 180)
    best = 1e9
    for i in range(len(ring)):
        y1, x1 = ring[i]; y2, x2 = ring[(i + 1) % len(ring)]
        ax, ay = (x1 - lon) * k * 111320, (y1 - lat) * 110540
        bx, by = (x2 - lon) * k * 111320, (y2 - lat) * 110540
        dx, dy = bx - ax, by - ay
        t = 0 if dx == dy == 0 else max(0, min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
        best = min(best, math.hypot(ax + t * dx, ay + t * dy))
    return best

def reg_numbers(addr):
    """House numbers named in the registry address (ranges expand by 2: '4÷14' -> 4,6,...,14)."""
    a = re.sub(r"\([^)]*\)", "", addr)
    m = re.search(r"(\d+)\s*([A-Za-z]?)\s*(?:[÷\-–/]\s*(\d+)\s*([A-Za-z]?))?\s*$", a.strip())
    if not m:
        m = re.search(r"(\d+)\s*([A-Za-z]?)(?:\s*[÷\-–/]\s*(\d+)\s*([A-Za-z]?))?", a)
    if not m:
        return set()
    lo = int(m.group(1)); out = {m.group(1) + m.group(2).upper()}
    if m.group(3):
        hi = int(m.group(3))
        if lo < hi and hi - lo <= 40:
            out |= {str(x) for x in range(lo, hi + 1, 2)}
        out.add(m.group(3) + (m.group(4) or "").upper())
    return out

def street_tokens(s):
    skip = {"strada", "str", "bulevardul", "bd", "bdul", "calea", "soseaua", "sos", "piata", "splaiul", "aleea", "intrarea", "general", "gen", "doctor", "dr", "ion", "i"}
    return {t for t in re.findall(r"[a-z0-9]+", strip(s)) if len(t) > 2 and t not in skip}

def reg_street(addr):
    a = re.sub(r"\([^)]*\)", " ", addr)
    m = re.match(r"^(.*?)\s+\d", a.strip())
    return street_tokens(m.group(1) if m else a)

def way_ring(el):
    g = el.get("geometry") or []
    ring = [(p["lat"], p["lon"]) for p in g]
    return ring[:-1] if len(ring) > 3 and ring[0] == ring[-1] else ring

def choose(b, ways):
    """ways: Overpass way elements with tags + geometry. Returns [(quality, ring), ...]."""
    lat, lon = b["lat"], b["lon"]
    nums, st = reg_numbers(b["addr"]), reg_street(b["addr"])
    cands = []
    for w in ways:
        ring = way_ring(w)
        if len(ring) < 3:
            continue
        cands.append((w, ring, dist_to_poly(lat, lon, ring)))
    tagged = []
    for w, ring, d in cands:
        t = w.get("tags", {})
        hn = re.sub(r"\s", "", t.get("addr:housenumber", "")).upper()
        if hn and hn in nums and d <= 80 and (not st or not street_tokens(t.get("addr:street", "x")) or st & street_tokens(t.get("addr:street", ""))):
            tagged.append((d, ring))
    if tagged:
        tagged.sort(key=lambda x: x[0])
        return [("a", r) for _, r in tagged[:6]]
    inside = [(d, ring) for w, ring, d in cands if in_poly(lat, lon, ring)]
    if inside:
        inside.sort(key=lambda x: len(x[1]))
        return [("i", inside[0][1])]
    near = sorted((d, ring) for w, ring, d in cands if d <= NEAR_MAX)
    return [("n", near[0][1])] if near else []

def overpass(query, cache_key, cache):
    if cache_key in cache:
        return cache[cache_key]
    for attempt in range(6):
        ep = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            r = requests.post(ep, data={"data": query}, headers=UA, timeout=(15, 100))
            if r.status_code == 200:
                data = r.json().get("elements", [])
                cache[cache_key] = data
                return data
            print(f"  {ep}: HTTP {r.status_code}, retrying", file=sys.stderr)
        except (requests.RequestException, ValueError) as e:
            print(f"  {ep}: {type(e).__name__}, retrying", file=sys.stderr)
        time.sleep(5 * (attempt + 1))
    return None          # give up on this batch for now; it is retried on the next run

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--buildings", default="../buildings.js"); ap.add_argument("--out", default="../footprints.js")
    ap.add_argument("--cache", default="footprints_cache.json"); ap.add_argument("--limit", type=int)
    ap.add_argument("--batch", type=int, default=BATCH)
    a = ap.parse_args()
    B = [b for b in load_js(a.buildings) if b.get("lat") is not None and b.get("precision") != "sector_centroid"]
    B.sort(key=lambda b: (round(b["lat"], 3), round(b["lon"], 3)))   # neighbours travel together
    if a.limit: B = B[:a.limit]
    cache = json.load(open(a.cache, encoding="utf8")) if os.path.exists(a.cache) else {}
    out, stats = {}, {"a": 0, "i": 0, "n": 0, "none": 0}
    failed = 0
    for s in range(0, len(B), a.batch):
        chunk = B[s:s + a.batch]
        key = "b" + str(chunk[0]["id"]) + "-" + str(chunk[-1]["id"]) + "-" + str(len(chunk))
        q = "[out:json][timeout:60];(" + "".join(f'way(around:{RADIUS},{b["lat"]},{b["lon"]})["building"];' for b in chunk) + ");out tags geom;"
        fresh = key not in cache
        got = overpass(q, key, cache)
        if got is None:
            failed += 1; stats["none"] += len(chunk)
            print(f"  batch at {s} failed on every server; skipped (run again later to fill it in)", file=sys.stderr)
            continue
        ways = [e for e in got if e.get("type") == "way"]
        for b in chunk:
            near = [w for w in ways if w.get("geometry") and any(hav(b["lat"], b["lon"], p["lat"], p["lon"]) <= RADIUS + 40 for p in w["geometry"][::2] + w["geometry"][-1:])]
            res = choose(b, near)
            if not res:
                stats["none"] += 1; continue
            stats[res[0][0]] += 1
            out[str(b["id"])] = [[q_, [[round(la, 5), round(lo, 5)] for la, lo in ring]] for q_, ring in res]
        print(f"{min(s + a.batch, len(B))}/{len(B)} buildings", file=sys.stderr)
        if fresh:
            json.dump(cache, open(a.cache, "w", encoding="utf8")); time.sleep(2)
    if failed:
        print(f"WARNING: {failed} batches failed; the output is incomplete. Run the same command again: finished batches are cached, so it only retries the missing ones.", file=sys.stderr)
    with open(a.out, "w", encoding="utf8") as f:
        f.write("// Building outlines (c) OpenStreetMap contributors, ODbL. id -> [[quality a|i|n, [[lat, lon], ...]], ...]\n")
        f.write("const FOOTPRINTS = " + json.dumps(out, separators=(",", ":")) + ";\n")
    print(f"done: {len(out)} buildings with an outline "
          f"(address match {stats['a']}, contains point {stats['i']}, nearest guess {stats['n']}, none {stats['none']}); {os.path.getsize(a.out)//1024} KB", file=sys.stderr)

if __name__ == "__main__":
    main()
