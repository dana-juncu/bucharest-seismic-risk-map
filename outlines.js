/* outlines.js — draws the building's outline on the map: a light outline on hover, and a stronger
 * one that stays while its popup is open (until you close the popup or pick another building).
 * Needs footprints.js (made by pipeline/fetch_footprints.py from OpenStreetMap). Without it, nothing changes.
 *   <script src="footprints.js"></script>
 *   <script src="outlines.js"></script>      (after history-card.js, before </body>)
 */
(function () {
  if (typeof FOOTPRINTS === "undefined" || typeof L === "undefined" || typeof map === "undefined" ||
      typeof clusterGroup === "undefined" || typeof markers === "undefined") return;

  const MIN_ZOOM = 15;                       /* below this the outline is just a dot */
  const byId = new Map(BUILDINGS.map((b) => [String(b.id), b]));
  const hoverLayer = L.layerGroup().addTo(map);
  const selectLayer = L.layerGroup().addTo(map);
  let rev = new Map(), revSize = -1, selectedId = null;
  let showApprox = false;                    /* "n" = nearest-building guess; hidden unless the user opts in */

  map.attributionControl && map.attributionControl.addAttribution("Building outlines &copy; OpenStreetMap contributors");

  function idOf(layer) {
    const n = Object.keys(markers).length;
    if (n !== revSize) { rev = new Map(Object.entries(markers).map(([id, m]) => [m, id])); revSize = n; }
    return rev.get(layer);
  }
  function draw(group, id, strong) {
    group.clearLayers();
    const fp = FOOTPRINTS[id], b = byId.get(String(id));
    if (!fp || !b) return;
    const color = typeof riskColor === "function" ? riskColor(b.risk) : "#9E101D";
    fp.forEach(([q, ring]) => {
      if (q === "n" && !showApprox) return;
      /* q: a = matched by house number, i = contains the point, n = nearest guess (dashed) */
      L.polygon(ring, {
        color, weight: strong ? 3 : 2, opacity: strong ? 1 : 0.85,
        fillColor: color, fillOpacity: strong ? 0.28 : 0.14,
        dashArray: q === "n" ? "5 4" : null, interactive: false, lineJoin: "round",
      }).addTo(group);
    });
  }

  clusterGroup.on("mouseover", (e) => {
    if (map.getZoom() < MIN_ZOOM) return;
    const id = idOf(e.layer);
    if (id != null && id !== selectedId) draw(hoverLayer, id, false);
  });
  clusterGroup.on("mouseout", () => hoverLayer.clearLayers());

  map.on("popupopen", (e) => {
    const id = e.popup && e.popup._source ? idOf(e.popup._source) : null;
    hoverLayer.clearLayers();
    selectedId = id != null ? id : null;
    if (selectedId != null) draw(selectLayer, selectedId, true); else selectLayer.clearLayers();
    /* one-line caveat on the card when an outline is shown */
    const fp = FOOTPRINTS[selectedId];
    const el = e.popup && e.popup.getElement && e.popup.getElement();
    const host = el && el.querySelector(".leaflet-popup-content");
    if (host && fp && fp.some(([q]) => q !== "n" || showApprox) && !host.querySelector(".fp-note")) {
      const n = document.createElement("div");
      n.className = "fp-note";
      n.style.cssText = "font-size:11px;color:var(--ink-muted,#777);line-height:1.4;margin-top:8px";
      n.textContent = "Outline from OpenStreetMap" + (fp.every(([q]) => q === "n") ? " (approximate: nearest building)" : "") + "; it may not match the registry building exactly.";
      host.appendChild(n);
    }
  });
  /* sidebar toggle, placed just above "Download the data" */
  const lbl = [...document.querySelectorAll(".section-label")].find((x) => /Download the data/.test(x.textContent));
  const cnt = { n: 0, ok: 0 };
  Object.values(FOOTPRINTS).forEach((fp) => { if (fp.every(([q]) => q === "n")) cnt.n++; else cnt.ok++; });
  const tb = document.createElement("div");
  tb.innerHTML = `<hr class="divider"><div class="section-label">Building outlines</div>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0;cursor:pointer"><input type="checkbox" id="fp-approx"><span>Also show approximate outlines (dashed)</span><span style="margin-left:auto;font-family:var(--font-mono);font-size:12px;color:var(--ink-muted)">${cnt.n.toLocaleString()}</span></label>
    <p style="font-size:12px;color:var(--ink-muted);line-height:1.45;margin:0">Outlines of ${cnt.ok.toLocaleString()} buildings come from OpenStreetMap (matched by house number or by the registry point). Approximate ones are the nearest building to the point and may be the wrong one.</p>`;
  const anchor = lbl && lbl.parentElement;
  if (anchor) anchor.insertAdjacentElement("beforebegin", tb);
  else { const sb = document.querySelector("#sidebar, .sidebar"); if (sb) sb.appendChild(tb); }
  const cb = tb.querySelector("#fp-approx");
  cb.addEventListener("change", () => {
    showApprox = cb.checked;
    hoverLayer.clearLayers();
    if (selectedId != null) draw(selectLayer, selectedId, true);
  });

  map.on("popupclose", () => { selectLayer.clearLayers(); selectedId = null; });
})();
