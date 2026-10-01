/* export-data.js — adds a "Download the data" section to the sidebar (CSV and GeoJSON).
 * Load AFTER history-card.js (so history and heritage columns are included when present):
 *   <script src="export-data.js"></script>
 * Exports either the buildings currently shown on the map (filters and search applied)
 * or all 2,796 registry buildings. Addresses that could not be placed get empty coordinates.
 */
(function () {
  if (typeof BUILDINGS === "undefined" || typeof RISK_META === "undefined") return;
  const sidebar = document.querySelector(".sidebar");
  const footer = sidebar && sidebar.querySelector("footer");
  if (!sidebar || !footer) return;

  const ATTRIBUTION =
    "Building registry: AMCCRS (Primaria Municipiului Bucuresti), via RoPublicData. " +
    "Coordinates: geocoded with OpenStreetMap Nominatim, (c) OpenStreetMap contributors, ODbL. " +
    "History and heritage: Wikipedia and Wikimedia Commons (CC BY-SA 4.0), Wikidata (CC0), " +
    "Official Monuments List 2015 (Ministry of Culture / INP), City Hall protected-zone documents. " +
    "Independent, unofficial; not a safety assessment. https://github.com/dana-juncu/bucharest-seismic-risk-map";
  const LEVEL = { d: "documented", p: "partly documented" };
  const hasH = typeof HISTORY !== "undefined", hasHer = typeof HERITAGE !== "undefined", hasP = typeof PHOTOS !== "undefined";

  /* the registry text has Windows-1252 control characters (quotes, dashes) in a few addresses */
  const FIX = { "\x91": "'", "\x92": "'", "\x93": '"', "\x94": '"', "\x96": "-", "\x97": "-" };
  const clean = (t) => String(t == null ? "" : t).replace(/[\x80-\x9f]/g, (c) => FIX[c] || "");
  const first = (h, key) => (h && h.f && h.f[key] ? h.f[key].map((x) => x[0]).join("; ") : "");

  function record(b) {
    const h = hasH ? HISTORY[b.id] : null, e = hasHer ? HERITAGE[b.id] : null;
    const mappable = typeof isMappable === "function" ? isMappable(b) : true;
    const meta = RISK_META[b.risk] || { label: b.risk };
    return {
      id: b.id,
      address: clean(b.addr),
      sector: b.sector || "",
      risk_class: b.risk,
      risk_label: meta.label,
      year_built: b.year || "",
      height_regime: b.height || "",
      apartments: b.apts || "",
      expert: b.expert || "",
      expertise_year: b.expertYear || "",
      notes: clean(b.notes).trim(),
      lat: mappable && b.lat != null ? b.lat : "",
      lon: mappable && b.lon != null ? b.lon : "",
      location_precision: b.precision || "",
      history_level: h ? LEVEL[h.l] || "" : "no history found",
      known_as: h && h.name ? h.name : "",
      architect: first(h, "architect"),
      style: first(h, "style"),
      historical_owner: first(h, "historical_owner"),
      listed_monument_codes: e && e.m ? e.m.map((m) => m[0]).join("; ") : "",
      protected_zone: e && e.z ? e.z.map((z) => z.replace(/^0/, "") + " " + (HERITAGE_ZONES[z] || "")).join("; ") : "",
      photo_commons_file: hasP && PHOTOS[b.id] ? PHOTOS[b.id][0] : "",
    };
  }

  function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) {
    const cols = Object.keys(rows[0] || record(BUILDINGS[0]));
    /* BOM so Excel reads the Romanian diacritics correctly */
    return "﻿" + [cols.join(",")].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))).join("\r\n") + "\r\n";
  }
  function toGeoJson(rows) {
    return JSON.stringify({
      type: "FeatureCollection",
      attribution: ATTRIBUTION,
      generated: new Date().toISOString().slice(0, 10),
      features: rows.map((r) => {
        const p = Object.assign({}, r); delete p.lat; delete p.lon;
        return {
          type: "Feature",
          geometry: r.lat === "" ? null : { type: "Point", coordinates: [r.lon, r.lat] },
          properties: p,
        };
      }),
    }, null, 1);
  }
  function download(name, mime, text) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const box = document.createElement("div");
  box.innerHTML = `
    <hr class="divider">
    <div class="section-label">Download the data</div>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0;cursor:pointer"><input type="radio" name="exp-scope" value="shown" checked> <span id="exp-shown">Buildings shown now</span></label>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0;cursor:pointer"><input type="radio" name="exp-scope" value="all"> <span>All ${BUILDINGS.length.toLocaleString()} buildings</span></label>
    <div style="display:flex;gap:8px;margin:8px 0 6px">
      <button type="button" data-fmt="csv" class="exp-btn">CSV</button>
      <button type="button" data-fmt="geojson" class="exp-btn">GeoJSON</button>
    </div>
    <p style="font-size:12px;color:var(--ink-muted);line-height:1.45;margin:0">Free to reuse with attribution. Includes risk class, registry details, history and heritage columns. Sources and licences: see the footer. Not a safety assessment.</p>`;
  const st = document.createElement("style");
  st.textContent = `.exp-btn{font-family:var(--font-mono);font-size:12px;letter-spacing:.04em;padding:6px 14px;border:1.5px solid var(--black);background:var(--white);color:var(--black);border-radius:2px;cursor:pointer}
    .exp-btn:hover{background:var(--black);color:var(--white)}`;
  document.head.appendChild(st);
  footer.parentElement.insertBefore(box, footer);

  const scope = () => box.querySelector("input[name=exp-scope]:checked").value;
  function selected() {
    const list = scope() === "all" || typeof passesFilter !== "function" ? BUILDINGS : BUILDINGS.filter(passesFilter);
    return list.map(record);
  }
  function refreshCount() {
    const n = typeof passesFilter === "function" ? BUILDINGS.filter(passesFilter).length : BUILDINGS.length;
    box.querySelector("#exp-shown").textContent = `Buildings shown now (${n.toLocaleString()})`;
  }
  refreshCount();
  sidebar.addEventListener("change", () => setTimeout(refreshCount, 0));
  sidebar.addEventListener("input", () => setTimeout(refreshCount, 0));

  box.querySelectorAll(".exp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rows = selected();
      if (!rows.length) { alert("No buildings match the current filters."); return; }
      const day = new Date().toISOString().slice(0, 10);
      const base = "bucharest-seismic-risk-" + (scope() === "all" ? "all" : "filtered") + "-" + day;
      if (btn.dataset.fmt === "csv") download(base + ".csv", "text/csv;charset=utf-8", toCsv(rows));
      else download(base + ".geojson", "application/geo+json", toGeoJson(rows));
    });
  });
})();
