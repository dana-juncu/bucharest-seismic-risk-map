# History card for the Bucharest Seismic Risk Map

Adds, without touching the existing map code:
- a **history card** in every building popup (documentation badge, architect / style / historical owner / heritage code, source links, "spot a mistake?" link that opens a prefilled GitHub issue),
- a **"History documented" filter** in the sidebar (Documented / Partly documented / No history found yet) with counts and a coverage bar,
- a **photo** (313 buildings) from Wikimedia Commons, loaded from Commons at view time, with author + licence credit and a link to the Commons page,
- an honest caveat that the registry "Built" year is the current structure and that Commons style tags are community-made.

## Install (3 lines)
1. Copy `history-data.js`, `history-photos.js` and `history-card.js` into the map's repo folder, next to `buildings.js`.
2. In `index.html`, just before `</body>` (after the inline script), add:
```html
<script src="history-data.js"></script>
<script src="history-photos.js"></script>
<script src="history-card.js"></script>
```
`history-photos.js` is optional — without it the cards simply have no photo.
If the files are missing the map works exactly as before (the card script exits quietly).

## Levels
- **Documented (212):** an architect, style or historical owner is named by a cited source.
- **Partly documented (316):** a heritage listing and/or a date only.
- **No history found yet (2,268):** not in `history-data.js`.

## Regenerating the data
`history-data.js` is generated from `building_history_curated.json` + `building_history_pilot.tsv` (one level up). Confidence is stored as h/m/l; low-confidence values are shown as "unverified".

## Notes
- The GitHub issue link points to `dana-juncu/bucharest-seismic-risk-map` — change `REPO_ISSUES` at the top of `history-card.js` if the repo differs.
- Sources: heritage list (LMI) via ro.wikipedia, Wikipedia (CC BY-SA 4.0), Wikimedia Commons category structure (CC0), OpenStreetMap (ODbL). Attribution is in the source links on each card; add a line to the site footer crediting them.
- Only historical owners and institutions are recorded — never current private owners or residents.

## Photos
Photos come from the Commons category of each address (e.g. "Strada Colței 25, Bucharest"), one per building, chosen by a simple score (photo size, not an interior/detail shot, file name contains the house number). They are not stored in the repo — the browser loads a 500 px thumbnail from Wikimedia at view time, which Wikimedia allows. Only CC BY, CC BY-SA, CC0 and public-domain files were used, and each card shows the author and licence. Some pictures show a neighbouring building or the whole street front; the "Spot a mistake" link is the way to flag those.

## Wrong photo?
`history-card.js` hides a photo when its house number is on the opposite side of the street from the registry address (odd vs even). To remove any other wrong photo, add its building id to `PHOTO_EXCLUDE` near the top of the photo section in `history-card.js` (or delete the id from `history-photos.js`).
