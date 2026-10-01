# Bucharest Seismic Risk Map

An interactive map of Bucharest's ~2,800 seismic-risk-classified buildings
(AMCCRS registry), built as a public usage-case demo for
[RoPublicData](https://github.com/dana-juncu/ro-public-data) -- a keyless
MCP server for Romanian public data.

**[Open the live map](https://dana-juncu.github.io/bucharest-seismic-risk-map/index.html)**

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
- **A building-history card** in every popup: how well documented the
  building's history is, plus architect, style, historical owner, heritage
  code and a photo where public sources have them -- each fact linked to its
  source (see "Building history layer" below).
- **A "History documented" filter** in the sidebar, with counts and a
  coverage bar.

## Data & methodology

### Registry pipeline

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
messier than the registry's documentation suggests. Only ~39% of rows are
actually classified into RsI-RsIV; the largest single bucket (~57%) is a
"flagged, not yet formally classified" status, and ~4% are buildings that
were at risk but have since been retrofitted ("consolidated"). The map
treats these as the distinct categories they are rather than lumping them
together or dropping them.

#### Reproducing the data

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

### Building history layer

The registry says how risky a building is, not what it is. The history layer
adds documented history from **public documents and open data only** (no
street imagery is analysed). Each fact carries a link to its source.

Sources: the heritage-monument (LMI) lists on Romanian Wikipedia, Wikipedia
articles on buildings, streets and architects, Wikimedia Commons address
categories (style, architect and build-year tags, plus photos), Wikidata and
OpenStreetMap. Buildings were matched to the registry by street name plus
house number (letter suffixes must agree; several false matches were
rejected by hand).

Each building gets one of three levels:

| Level | Count | Meaning |
|---|---|---|
| Documented | 212 | An architect, style or historical owner is named by a cited source |
| Partly documented | 316 | Only a heritage listing and/or a date was found |
| No history found yet | 2,268 | Nothing found in the sources searched (not in `history-data.js`) |

Roughly 19% of buildings therefore have some history and about 8% have an
architect, style or owner named. The card says so openly; low-confidence
values are shown as "unverified". Caveats: the registry "Built" year is the
year of the current structure, which sources may date differently, and
Commons style tags are community-made. Only historical owners and
institutions are recorded -- never current private owners or residents.

Each popup has a "Spot a mistake or know more?" link that opens a prefilled
GitHub issue.

#### Photos

313 buildings show a photo taken from the Wikimedia Commons category of their
address (e.g. "Strada Colței 25, Bucharest"), one per building, chosen by a
simple score (photo size, not an interior/detail shot, file name contains the
house number). Photos are not stored in this repo: the browser loads a 500 px
thumbnail from Wikimedia at view time. Only CC BY, CC BY-SA, CC0 and
public-domain files are used, and each card shows the author and licence.

The choice is a heuristic, so some pictures show a neighbouring building or
the whole street front. Two safeguards exist: a photo is hidden when its house
number is on the opposite side of the street from the registry address (odd vs
even), and a manual `PHOTO_EXCLUDE` list in `history-card.js` removes any photo
reported as wrong (add the building id, or delete its entry from
`history-photos.js`).

#### Files

| File | Purpose |
|---|---|
| `history-data.js` | `HISTORY`: per-building history, keyed by registry id |
| `history-photos.js` | `PHOTOS`: per-building Commons file, author and licence (optional) |
| `history-card.js` | Adds the card, photo, filter and coverage bar; no other code changes needed |

Install: keep the three files next to `buildings.js`, and in `index.html`,
just before `</body>` (after the inline script), add:

```html
<script src="history-data.js?v=1"></script>
<script src="history-photos.js?v=1"></script>
<script src="history-card.js?v=1"></script>
```

If the files are missing the map works exactly as before. GitHub Pages caches
scripts aggressively, so raise the `?v=` number after each update.

`history-data.js` is generated from a curated JSON of sourced claims (each with
verbatim evidence, source URL, licence and confidence) plus a per-building
table; confidence is stored as high / medium / low. The GitHub issue link
points to this repo -- change `REPO_ISSUES` at the top of `history-card.js` if
the repo moves.

## Data sources & attribution

- **Building safety records:** AMCCRS (Autoritatea Municipală pentru
  Consolidarea Clădirilor cu Risc Seismic), via
  [RoPublicData](https://github.com/dana-juncu/ro-public-data).
- **Geocoding and building data:** © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, via the Nominatim API, licensed under the
  [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/).
- **Building history:** heritage lists and articles from
  [Wikipedia](https://ro.wikipedia.org) (CC BY-SA 4.0), category structure and
  photos from [Wikimedia Commons](https://commons.wikimedia.org) (photo
  licences and authors shown on each card), and
  [Wikidata](https://www.wikidata.org) (CC0).
- **Basemap tiles:** Esri (`World_Light_Gray_Base` / `_Reference`).

The code in this repository (HTML, JavaScript, Python) is MIT-licensed --
see `LICENSE`. The underlying AMCCRS, OpenStreetMap, Wikipedia and Wikimedia
data and photos keep their own licenses/ownership as above; this project
doesn't claim any rights over any of them.

## Disclaimer

Independent, unofficial, non-commercial. **Not a safety assessment.** For a
building's current authoritative seismic-risk status, consult AMCCRS or
Primăria Municipiului București directly. The history information is
compiled from public sources, may contain errors, and is not a heritage or
legal record. This project is not affiliated with AMCCRS, Primăria
Municipiului București, or any other Romanian government or municipal body.

## Publishing (GitHub Pages)

Since this is a static page, GitHub Pages can serve it directly with no
build step:

1. Push this repo to GitHub.
2. Repo Settings -> Pages -> Source: `Deploy from a branch` -> Branch:
   `main`, folder `/ (root)` -> Save.
3. The map will be live at `https://<your-username>.github.io/bucharest-seismic-risk-map/`
   within a minute or two.

## Built by

[Dana Juncu](https://linkedin.com/in/danajuncu)
