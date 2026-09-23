# Bucharest Seismic Risk Map

An interactive map of Bucharest's ~2,800 seismic-risk-classified buildings
(AMCCRS registry), built as a public usage-case demo for
[RoPublicData](https://github.com/dana-juncu/ro-public-data) -- a keyless
MCP server for Romanian public data.

🔗[Open the live map](https://dana-juncu.github.io/bucharest-seismic-risk-map/index.html)

## What it shows

- Every building in AMCCRS's public seismic-risk registry, plotted at its
  street address, color-coded by risk class (RsI - highest risk - through
  RsIV, plus "consolidated" / retrofitted and "not yet classified").
- Filters by risk class and by sector (1-6), and a search box.
- A plain-language legend explaining what RsI-RsIV actually mean (per
  Ordonanța 20/1994), since the raw classification codes aren't
  self-explanatory to a general visitor.
- A collapsible sidebar list of addresses that couldn't be reliably matched
  to a real place on the map (bad/incomplete address text, or genuine gaps
  in OpenStreetMap's coverage) -- these are **listed, not guessed at**:
  rather than dropping an approximate pin, unmatched buildings are left off
  the map entirely and shown separately with their raw address text, so
  nothing is silently misplaced.
- Mobile-friendly layout: the building list opens as an on-demand sheet so
  the map itself stays fully visible and pinch-zoomable.

## Data & methodology

| Stage | Script | Output |
|---|---|---|
| 1. Fetch | `pipeline/fetch_amccrs.py` | `amccrs_raw.json` -- live pull via RoPublicData's `amccrs_search_buildings` MCP tool |
| 2. Parse & normalize | `pipeline/parse_and_normalize.py` | `buildings_for_geocoding.csv` -- cleans addresses, normalizes risk-class text into `RsI`/`RsII`/`RsIII`/`RsIV`/`consolidated`/`pending` |
| 3. Geocode | `pipeline/geocode_buildings.py` | `buildings_geocoded.csv` -- adds `lat`/`lon`/`geo_precision` via OpenStreetMap Nominatim |
| 4. Build | `pipeline/build_buildings_js.py` | `buildings.js` -- the data file `index.html` actually loads |

As of the last data pull: 2,796 buildings total, 2,668 geocoded to their
street address and shown on the map, 128 not reliably matched and listed
in the sidebar instead of plotted. These numbers will shift on every fresh
pull as AMCCRS's registry and OSM's coverage both change over time -- this
isn't a static snapshot, it's a pipeline meant to be re-run.

A real finding from building this: AMCCRS's own risk-class field is
messier than the registry's documentation suggests. Only ~59% of rows are
actually classified into RsI-RsIV; the largest single bucket (~57%) is a
"flagged, not yet formally classified" status, and ~4% are buildings that
were at risk but have since been retrofitted ("consolidated"). The map
treats these as the distinct categories they are rather than lumping them
together or dropping them.

### Reproducing the data

```bash
cd pipeline
# 1. Pull fresh AMCCRS data via an MCP client (see fetch_amccrs.py) -> amccrs_raw.json
python parse_and_normalize.py
python geocode_buildings.py --candidates buildings_for_geocoding.csv --out buildings_geocoded.csv
python build_buildings_js.py --in buildings_geocoded.csv --out ../buildings.js
```

`geocode_buildings.py` talks to OpenStreetMap's Nominatim API and respects
its 1 request/second usage policy, so a full run over ~2,800 addresses
takes roughly an hour. Re-run with `--retry-failed` after fixing an address
typo to re-attempt only the rows that fell back to a sector centroid or
were left unmatched, without re-querying everything else.

## Data sources & attribution

- **Building safety records:** AMCCRS (Autoritatea Municipală pentru
  Consolidarea Clădirilor cu Risc Seismic), via
  [RoPublicData](https://github.com/dana-juncu/ro-public-data).
- **Geocoding:** © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, via the Nominatim API, licensed under the
  [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
- **Basemap tiles:** Esri (`World_Light_Gray_Base` / `_Reference`).

The code in this repository (HTML, JavaScript, Python) is MIT-licensed --
see `LICENSE`. The underlying AMCCRS and OpenStreetMap data keep their own
licenses/ownership as above; this project doesn't claim any rights over
either.

## Disclaimer

Independent, unofficial, non-commercial. **Not a safety assessment.** For a
building's current authoritative seismic-risk status, consult AMCCRS or
Primăria Municipiului București directly. This project is not affiliated
with AMCCRS, Primăria Municipiului București, or any other Romanian
government or municipal body.

## Publishing (GitHub Pages)

Since this is a static page, GitHub Pages can serve it directly with no
build step:

1. Push this repo to GitHub.
2. Repo Settings -> Pages -> Source: `Deploy from a branch` -> Branch:
   `main`, folder `/ (root)` -> Save.
3. The map will be live at `https://<your-username>.github.io/bucharest-seismic-risk-map/`
   within a minute or two. Update the link at the top of this README once
   it's up.

## Built by

[Dana Juncu](https://linkedin.com/in/danajuncu)
