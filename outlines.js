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
  });
  map.on("popupclose", () => { selectLayer.clearLayers(); selectedId = null; });
})();
