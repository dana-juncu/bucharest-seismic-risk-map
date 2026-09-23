"""
Parse the raw AMCCRS JSON dump into a clean CSV ready for geocoding,
with risk_class normalized into real categories.

Key finding while inspecting the live data: the tool's own docstring
undersells the mess in this field. Only ~59% of rows (RsI/RsII/RsIII/RsIV
combined) are actually classified into a seismic risk class. The single
largest bucket (1,453 of 2,796 rows, ~52%) is a bureaucratic status phrase
meaning "flagged urgent-category, not yet formally classified into a risk
class" -- i.e. these buildings are NOT yet known to be RsI/II/III/IV, they
are just in the queue. Another ~115 rows are "5.CONSOLIDATE" / "CONSOLIDATE"
-- meaning the building WAS at risk but has since been structurally
retrofitted, so it's a resolved case, not a current risk. A real seismic
risk map has to show these as distinct categories, not silently drop them
or lump them in with an actual risk class.
"""
import json
import re
import csv

with open("amccrs_raw.json", encoding="utf-8") as f:
    data = json.load(f)

buildings = data["buildings"]

RS_RE = re.compile(r"RS\s*([IV]+)", re.IGNORECASE)
CONSOLIDATED_RE = re.compile(r"CONSOLIDAT", re.IGNORECASE)
PENDING_RE = re.compile(r"NEINCADRAT|NEÎNCADRAT", re.IGNORECASE)

def normalize_risk(raw: str) -> str:
    raw = (raw or "").strip()
    if not raw:
        return "unknown"
    m = RS_RE.search(raw)
    if m:
        numeral = m.group(1).upper()
        if numeral in ("I", "II", "III", "IV"):
            return f"Rs{numeral}"
    if CONSOLIDATED_RE.search(raw):
        return "consolidated"
    if PENDING_RE.search(raw):
        return "pending"
    return "unknown"

SECTOR_RE = re.compile(r"sector\s*(\d)", re.IGNORECASE)

def normalize_sector(raw: str) -> str:
    raw = (raw or "").strip()
    m = SECTOR_RE.search(raw)
    if m:
        return f"Sector {m.group(1)}"
    return ""

PAREN_RE = re.compile(r"\([^)]*\)")
MOJIBAKE_RE = re.compile(r"[\x91\x92\x93\x94\x96\x97]")
# grab a leading street-type + name, then the first number token after it
NUM_RE = re.compile(r"(\d+)")

# Two real bugs found by spot-checking against Nominatim directly:
# (1) "Splaiu" is a typo in AMCCRS's own data for "Splaiul" (a major
#     boulevard) -- confirmed live: "Splaiul Independentei 84" geocodes
#     correctly, "Splaiu Independentei 84" returns nothing.
# (2) Abbreviated street-type prefixes ("Str.", "Bd.", etc.) sometimes
#     confuse Nominatim's parser -- normalizing to the full Romanian word
#     is safer and costs nothing on rows that already worked.
TYPO_FIXES = [
    (re.compile(r"\bSplaiu\b(?!l)", re.IGNORECASE), "Splaiul"),
    # "VASIOLE LUCACIU" -> "VASILE LUCACIU": confirmed real street (9 other
    # buildings on this same street geocode correctly under "VASILE").
    (re.compile(r"\bVASIOLE\b", re.IGNORECASE), "VASILE"),
]
ABBREV_FIXES = [
    (re.compile(r"^Str\.\s*", re.IGNORECASE), "Strada "),
    (re.compile(r"^Bd\.\s*", re.IGNORECASE), "Bulevardul "),
    (re.compile(r"^Cal\.\s*", re.IGNORECASE), "Calea "),
    (re.compile(r"^Sos\.\s*|^Șos\.\s*", re.IGNORECASE), "Soseaua "),
    (re.compile(r"^P-?ta\.?\s*", re.IGNORECASE), "Piata "),
]

def build_street_query(addr: str) -> tuple:
    """Returns (street_name_and_type, house_number) with parentheticals
    and OCR/encoding artifacts stripped, good enough for a Nominatim query
    (not meant to be a perfect canonical address)."""
    cleaned = MOJIBAKE_RE.sub("", addr)
    for pattern, repl in TYPO_FIXES:
        cleaned = pattern.sub(repl, cleaned)
    for pattern, repl in ABBREV_FIXES:
        cleaned = pattern.sub(repl, cleaned)
    cleaned = PAREN_RE.sub(" ", cleaned)
    cleaned = re.sub(r"\bnr\.?\b", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\bbl\.?\b.*", "", cleaned, flags=re.IGNORECASE)  # drop "bl. F2C" trailing block refs
    cleaned = re.sub(r"[;:,]+", " ", cleaned)  # stray punctuation left over from the raw address
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    # take the first number token as the house number
    m = NUM_RE.search(cleaned)
    if m:
        number = m.group(1)
        street = cleaned[:m.start()].strip(" ,")
    else:
        number = ""
        street = cleaned.strip(" ,")
    return street, number

rows = []
risk_counts = {}
for i, b in enumerate(buildings):
    risk = normalize_risk(b.get("risk_class", ""))
    risk_counts[risk] = risk_counts.get(risk, 0) + 1
    sector = normalize_sector(b.get("sector", ""))
    street, number = build_street_query(b.get("address", ""))
    rows.append({
        "id": i,
        "address_raw": b.get("address", ""),
        "street_query": street,
        "house_number": number,
        "sector": sector,
        "risk_class_raw": b.get("risk_class", ""),
        "risk_class": risk,
        "year_built": b.get("year_built", ""),
        "height_regime": b.get("height_regime", ""),
        "apartment_count": b.get("apartment_count", ""),
        "technical_expert": b.get("technical_expert", ""),
        "expertise_year": b.get("expertise_year", ""),
        "notes": b.get("notes", ""),
    })

with open("buildings_for_geocoding.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()), delimiter="^")
    w.writeheader()
    w.writerows(rows)

print(f"Wrote {len(rows)} rows to buildings_for_geocoding.csv")
print()
print("Normalized risk_class distribution:")
for k, v in sorted(risk_counts.items(), key=lambda x: -x[1]):
    print(f"  {k}: {v} ({v/len(rows)*100:.1f}%)")
print()
print("Sample parsed addresses:")
for r in rows[:3] + rows[100:103] + rows[-3:]:
    print(f"  {r['address_raw']!r} -> street={r['street_query']!r} num={r['house_number']!r} sector={r['sector']!r}")
