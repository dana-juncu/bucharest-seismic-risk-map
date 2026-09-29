/* history-card.js — adds a "History" card, a documentation-level filter and a
 * coverage stat to the Bucharest Seismic Risk Map.
 *
 * Load AFTER the map's inline script, and after history-data.js:
 *   <script src="history-data.js"></script>
 *   <script src="history-card.js"></script>
 * (put both just before </body>). No other change to index.html is needed.
 *
 * Levels: d = documented (an architect, style or owner is named by a cited source),
 *         p = partly documented (heritage listing and/or a date only),
 *         anything not in HISTORY = unknown.
 */
(function () {
  if (typeof HISTORY === "undefined" || typeof popupHtml !== "function") return;

  const REPO_ISSUES = "https://github.com/dana-juncu/bucharest-seismic-risk-map/issues/new";
  const LEVELS = {
    d: { label: "Documented", hint: "An architect, style or historical owner is named by a cited source." },
    p: { label: "Partly documented", hint: "Only a heritage listing and/or a date was found." },
    u: { label: "No history found yet", hint: "Nothing documented in the sources we searched." },
  };
  const FIELD_LABELS = {
    architect: "Architect",
    style: "Style",
    historical_owner: "Historical owner",
    built_year: "Built (per source)",
  };
  const level = (id) => (HISTORY[id] ? HISTORY[id].l : "u");

  /* ---------- styles ---------- */
  const css = document.createElement("style");
  css.textContent = `
    .popup { max-width: 330px; }
    .popup .hist { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--hairline); }
    .popup .hist-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .hist-badge { font-family: var(--font-mono); font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
      padding: 2px 8px; border-radius: 10px; border: 1.5px solid var(--black); color: var(--black); white-space: nowrap; }
    .hist-badge.d { background: var(--black); color: var(--white); }
    .hist-badge.p { background: transparent; }
    .hist-badge.u { border-style: dashed; border-color: var(--ink-muted); color: var(--ink-muted); }
    .popup .hist dl { grid-template-columns: auto 1fr; }
    .popup .hist dd { font-family: var(--font-body); font-size: 13.5px; }
    .popup .hist .unv { font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-muted); margin-left: 4px; }
    .popup .hist ul { margin: 8px 0 0; padding-left: 16px; font-size: 13px; line-height: 1.4; color: var(--ink-secondary); }
    .popup .hist .src { margin-top: 8px; font-size: 12px; color: var(--ink-muted); line-height: 1.5; }
    .popup .hist .src a, .popup .hist .fix a { color: var(--red); text-decoration: none; }
    .popup .hist .src a:hover, .popup .hist .fix a:hover { text-decoration: underline; }
    .popup .hist .fix { margin-top: 8px; font-size: 12px; }
    .popup .hist .caveat { margin-top: 6px; font-size: 11.5px; color: var(--ink-muted); line-height: 1.4; }
    .hist-cov { font-size: 12.5px; color: var(--ink-secondary); line-height: 1.45; margin-top: 8px; }
    .hist-cov .bar { display: flex; height: 8px; margin: 6px 0 4px; border: 1px solid var(--black); }
    .hist-cov .bar i { display: block; height: 100%; }
    .hist-cov .bar .d { background: var(--black); }
    .hist-cov .bar .p { background: repeating-linear-gradient(45deg, var(--black) 0 2px, var(--white) 2px 5px); }
  `;
  document.head.appendChild(css);

  /* ---------- card ---------- */
  function issueUrl(b) {
    const title = `History: ${b.addr} (id ${b.id})`;
    const body = `Building id: ${b.id}\nAddress: ${b.addr}\n\nWhat I know (architect, style, owner, dates):\n\nSource (link, book, archive):\n`;
    return `${REPO_ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  }

  function historyHtml(b) {
    const h = HISTORY[b.id];
    const lv = level(b.id);
    const badge = `<span class="hist-badge ${lv}" title="${escapeHtml(LEVELS[lv].hint)}">${LEVELS[lv].label}</span>`;
    if (!h) {
      return `<div class="hist"><div class="hist-head">${badge}</div>
        <div class="caveat">We found no cited history for this address yet. ${LEVELS.u.hint}</div>
        <div class="fix"><a href="${issueUrl(b)}" target="_blank" rel="noopener">Know its history? Tell us →</a></div></div>`;
    }
    const rows = [];
    if (h.name) rows.push(["Known as", escapeHtml(h.name)]);
    for (const key of Object.keys(FIELD_LABELS)) {
      const vals = h.f && h.f[key];
      if (!vals) continue;
      const txt = vals
        .map(([v, c]) => escapeHtml(v) + (c === "l" ? '<span class="unv">unverified</span>' : ""))
        .join("; ");
      rows.push([FIELD_LABELS[key], txt]);
    }
    if (h.dat) rows.push(["Dated (heritage list)", escapeHtml(h.dat)]);
    if (h.her) rows.push(["Heritage code", escapeHtml(h.her)]);
    const dl = rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : "";
    const nar = h.n && h.n.length ? `<ul>${h.n.map(([t]) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : "";
    const src = h.s && h.s.length
      ? `<div class="src">Sources: ${h.s.map(([l, u]) => u ? `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(l)}</a>` : escapeHtml(l)).join(" · ")}</div>`
      : "";
    return `<div class="hist"><div class="hist-head">${badge}</div>${dl}${nar}${src}
      <div class="caveat">Registry "Built" above is the year of the current structure; sources may date the original building differently. Style tags from Wikimedia Commons are community-made.</div>
      <div class="fix"><a href="${issueUrl(b)}" target="_blank" rel="noopener">Spot a mistake or know more? →</a></div></div>`;
  }

  const basePopup = popupHtml;
  popupHtml = function (b) {
    const html = basePopup(b);
    const i = html.lastIndexOf("</div>");
    return html.slice(0, i) + historyHtml(b) + html.slice(i);
  };

  /* ---------- filter ---------- */
  const activeHist = new Set(["d", "p", "u"]);
  const basePass = passesFilter;
  passesFilter = function (b) { return basePass(b) && activeHist.has(level(b.id)); };

  const counts = { d: 0, p: 0, u: 0 };
  BUILDINGS.forEach((b) => { counts[level(b.id)]++; });
  const total = BUILDINGS.length;

  const anchor = document.getElementById("risk-filters");
  if (anchor && anchor.parentElement) {
    const box = document.createElement("div");
    box.innerHTML = `
      <div class="section-label">History documented</div>
      <div id="hist-filters">${["d", "p", "u"].map((k) => `
        <label class="filter-row" style="display:flex;align-items:center;gap:8px;font-size:14px;margin:4px 0;cursor:pointer" title="${escapeHtml(LEVELS[k].hint)}">
          <input type="checkbox" data-hist="${k}" checked>
          <span class="hist-badge ${k}">${LEVELS[k].label}</span>
          <span style="margin-left:auto;font-family:var(--font-mono);font-size:12px;color:var(--ink-muted)">${counts[k].toLocaleString()}</span>
        </label>`).join("")}
      </div>
      <div class="hist-cov">${((counts.d + counts.p) / total * 100).toFixed(1)}% of buildings have some documented history;
        ${(counts.d / total * 100).toFixed(1)}% have an architect, style or owner named.
        <div class="bar"><i class="d" style="width:${counts.d / total * 100}%"></i><i class="p" style="width:${counts.p / total * 100}%"></i></div>
        History comes from public sources (heritage lists, Wikipedia, Wikimedia Commons, OpenStreetMap); every fact links to its source.
      </div>`;
    anchor.parentElement.insertAdjacentElement("afterend", box);
    box.querySelectorAll("input[data-hist]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const k = cb.getAttribute("data-hist");
        if (cb.checked) activeHist.add(k); else activeHist.delete(k);
        rebuildMarkers();
      });
    });
  }

  /* ---------- refresh popups already created before this script ran ---------- */
  if (typeof markers === "object") {
    BUILDINGS.forEach((b) => { if (markers[b.id]) markers[b.id].setPopupContent(popupHtml(b)); });
  }
  rebuildMarkers();
})();
