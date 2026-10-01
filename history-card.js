/* history-card.js — adds a "History" card (and, if heritage-data.js is loaded, a heritage block + filters), a documentation-level filter and a
 * coverage stat to the Bucharest Seismic Risk Map.
 *
 * Load AFTER the map's inline script, and after history-data.js:
 *   <script src="history-data.js"></script>
 *   <script src="history-photos.js"></script>   (optional: adds a photo to each card)
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
    .popup .her { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--hairline); font-size: 13px; line-height: 1.45; }
    .her-badge { display: inline-block; font-family: var(--font-mono); font-size: 11px; letter-spacing: .04em; text-transform: uppercase;
      padding: 2px 8px; border-radius: 10px; border: 1.5px solid var(--red); color: var(--red); margin: 0 6px 4px 0; white-space: nowrap; }
    .her-badge.z { border-style: dashed; }
    .popup .her .m { margin: 4px 0 0; color: var(--ink-secondary); }
    .popup .her .m b { font-weight: 600; color: var(--black); }
    .popup .her .note { margin-top: 6px; font-size: 11.5px; color: var(--ink-muted); line-height: 1.4; }
    .popup .her a { color: var(--red); text-decoration: none; }
    .popup .her a:hover { text-decoration: underline; }
    .popup .ph { margin: 0 0 8px; }
    .popup .ph img { display: block; width: 100%; max-height: 200px; object-fit: cover; background: var(--hairline); border-radius: 2px; }
    .popup .ph .cap { font-size: 11px; color: var(--ink-muted); line-height: 1.35; margin-top: 3px; }
    .popup .ph .cap a { color: var(--ink-secondary); }
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
    const hm = typeof HERITAGE !== "undefined" && HERITAGE[b.id] && HERITAGE[b.id].m;   /* official list shown in its own block */
    if (h.dat && !hm) rows.push(["Dated (heritage list)", escapeHtml(h.dat)]);
    if (h.her && !hm) rows.push(["Heritage code", escapeHtml(h.her)]);
    const dl = rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : "";
    const nar = h.n && h.n.length ? `<ul>${h.n.map(([t]) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : "";
    const src = h.s && h.s.length
      ? `<div class="src">Sources: ${h.s.map(([l, u]) => u ? `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(l)}</a>` : escapeHtml(l)).join(" · ")}</div>`
      : "";
    return `<div class="hist"><div class="hist-head">${badge}</div>${dl}${nar}${src}
      <div class="caveat">Registry "Built" above is the year of the current structure; sources may date the original building differently. Style tags from Wikimedia Commons are community-made.</div>
      <div class="fix"><a href="${issueUrl(b)}" target="_blank" rel="noopener">Spot a mistake or know more? →</a></div></div>`;
  }

  /* ---------- heritage: listed monuments + protected zones (optional: needs heritage-data.js) ---------- */
  const LMI_URL = "https://2014-2020.adrbi.ro/media/2885/lista-monumentelor-istorice-din-bucuresti.pdf";
  const ZONES_URL = "https://www2.pmb.ro/servicii/urbanism/zone_protejate/z_protejate_aprobate.php";
  const hasHer = typeof HERITAGE !== "undefined";
  const isMon = (id) => hasHer && !!(HERITAGE[id] && HERITAGE[id].m);
  const isZone = (id) => hasHer && !!(HERITAGE[id] && HERITAGE[id].z);
  const KIND = { m: "Historic monument", a: "Part of a listed ensemble", s: "Listed site" };
  function monHtml(code, name, dat) {
    const p = code.split("-");                      /* B-II-m-A-18674 : kind m/a/s, group A/B */
    const grp = p[3] === "A" ? "national importance (group A)" : "local importance (group B)";
    return `<div class="m"><b>${escapeHtml(KIND[p[2]] || "Listed")}</b>, ${grp}${name ? " · " + escapeHtml(name) : ""}${dat ? " · " + escapeHtml(dat) : ""}
      <span style="font-family:var(--font-mono);font-size:11px;color:var(--ink-muted)"> ${escapeHtml(code)}</span></div>`;
  }
  function heritageHtml(b) {
    if (!hasHer || !HERITAGE[b.id]) return "";
    const e = HERITAGE[b.id], parts = [];
    if (e.m) {
      parts.push(`<span class="her-badge">Listed monument</span>` + e.m.map(([c, n, d]) => monHtml(c, n, d)).join(""));
      const seis = ["RsI", "RsII", "RsIII", "RsIV"].includes(b.risk) ? `This building is both a listed monument and seismic class ${b.risk}. ` : "";
      parts.push(`<div class="note">${seis}Works on listed monuments need approval from the cultural authorities (Law 422/2001), so strengthening has to be planned together with conservation. Source: <a href="${LMI_URL}" target="_blank" rel="noopener">Official Monuments List 2015</a> (Ministry of Culture / INP, Monitorul Oficial 113 bis/2016), matched by street and number.</div>`);
    }
    if (e.z) {
      const names = e.z.map((z) => `no. ${escapeHtml(z.replace(/^0/, ""))} \u2013 ${escapeHtml(HERITAGE_ZONES[z] || "")}`).join("; ");
      parts.push(`<div style="margin-top:6px"><span class="her-badge z">Protected zone</span>Street is part of protected built zone ${names}.</div>
        <div class="note">Matched by street name only; the zone may cover just part of a long street, so check the exact boundary on the plan. Source: Bucharest City Hall, protected built zones (HCGMB 279/2000), <a href="${ZONES_URL}" target="_blank" rel="noopener">zone documents</a>.</div>`);
    }
    return `<div class="her">${parts.join("")}</div>`;
  }

  /* ---------- photo (optional: needs history-photos.js) ---------- */
  const LICENSE_URLS = {
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC BY 3.0 pl": "https://creativecommons.org/licenses/by/3.0/pl/",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC BY-SA 3.0 ro": "https://creativecommons.org/licenses/by-sa/3.0/ro/",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  };
  /* Safeguards against photos of the wrong building.
   * 1) PHOTO_EXCLUDE: ids whose photo was reported wrong (add more here; or delete the id from history-photos.js).
   * 2) Same-side check: Bucharest streets number odd on one side, even on the other. If the photo's
   *    house number and the registry address number differ in parity, it shows the opposite side: hide it. */
  const PHOTO_EXCLUDE = new Set(["820"]);
  function regNumbers(addr) {
    const m = String(addr).match(/(\d+)\s*[A-Za-z]?\s*(?:[÷–\-\/]\s*(\d+)\s*[A-Za-z]?)?\s*$/);
    return m ? [parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : null] : null;
  }
  function fileNumber(file) {
    const m = file.match(/^(\d+)\s*[A-Za-z]?\s/) || file.match(/\s(\d+)\s*[A-Za-z]?(?:\s*\(\d+\))?\.\w+$/);
    return m ? parseInt(m[1], 10) : null;
  }
  function sameSide(b, file) {
    const r = regNumbers(b.addr), f = fileNumber(file);
    if (!r || f == null) return true;               /* cannot tell: keep */
    if (r[1] != null && (r[0] % 2) !== (r[1] % 2)) return true; /* range mixes both sides: keep */
    return (r[0] % 2) === (f % 2);
  }
  /* Manual photo picks: building id -> Commons file name. Author and licence are looked up from
   * Commons when the card is opened, and the photo is hidden unless the licence is free. */
  const PHOTO_OVERRIDES = {
    /* e.g. "123": "File name on Commons.jpg" */
  };
  const FREE_LIC = /^(cc0|cc[ -]by|public domain|pd)/i;
  function overrideHtml(b, file) {
    const page = "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(file.replace(/ /g, "_"));
    const src = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=360";
    return `<div class="ph" data-ov="${escapeHtml(file)}"><a href="${page}" target="_blank" rel="noopener"><img src="${src}" loading="lazy" alt="Photo of ${escapeHtml(b.addr)}" onerror="this.closest('.ph').style.display='none'"></a>
      <div class="cap"><a href="${page}" target="_blank" rel="noopener">Photo: Wikimedia Commons</a></div></div>`;
  }
  new MutationObserver(() => {
    document.querySelectorAll(".ph[data-ov]:not([data-done])").forEach((el) => {
      el.setAttribute("data-done", "1");
      const file = el.getAttribute("data-ov");
      fetch("https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=extmetadata&titles=" + encodeURIComponent("File:" + file))
        .then((r) => r.json()).then((d) => {
          const pg = Object.values(d.query.pages)[0], md = pg.imageinfo && pg.imageinfo[0].extmetadata;
          const lic = md && md.LicenseShortName && md.LicenseShortName.value;
          if (!lic || !FREE_LIC.test(lic)) { el.style.display = "none"; return; }
          const who = ((md.Artist && md.Artist.value) || "Unknown").replace(/<[^>]+>/g, "").trim().slice(0, 60);
          const cap = el.querySelector(".cap");
          cap.textContent = "Photo: " + who + ", " + lic + " \u00b7 Wikimedia Commons";
        }).catch(() => {});
    });
  }).observe(document.body, { childList: true, subtree: true });

  function photoHtml(b) {
    if (PHOTO_OVERRIDES[b.id]) return overrideHtml(b, PHOTO_OVERRIDES[b.id]);
    if (typeof PHOTOS === "undefined" || !PHOTOS[b.id] || PHOTO_EXCLUDE.has(String(b.id))) return "";
    if (!sameSide(b, PHOTOS[b.id][0])) return "";
    const [file, author, lic] = PHOTOS[b.id];
    const page = "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(file.replace(/ /g, "_"));
    const src = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=360";
    const licTxt = LICENSE_URLS[lic]
      ? `<a href="${LICENSE_URLS[lic]}" target="_blank" rel="noopener">${escapeHtml(lic)}</a>`
      : escapeHtml(lic);
    return `<div class="ph"><a href="${page}" target="_blank" rel="noopener"><img src="${src}" loading="lazy" alt="Photo of ${escapeHtml(b.addr)}" onerror="this.closest('.ph').style.display='none'"></a>
      <div class="cap">Photo: ${escapeHtml(author)}, ${licTxt} · <a href="${page}" target="_blank" rel="noopener">Wikimedia Commons</a>. May show the building or its street front — see the Commons page.</div></div>`;
  }

  const basePopup = popupHtml;
  popupHtml = function (b) {
    let html = basePopup(b);
    const ph = photoHtml(b);
    if (ph) html = html.replace('<div class="popup">', '<div class="popup">' + ph);
    const i = html.lastIndexOf("</div>");
    return html.slice(0, i) + heritageHtml(b) + historyHtml(b) + html.slice(i);
  };

  /* ---------- filter ---------- */
  const activeHist = new Set(["d", "p", "u"]);
  const basePass = passesFilter;
  const herOnly = { m: false, z: false };
  passesFilter = function (b) {
    if (!basePass(b) || !activeHist.has(level(b.id))) return false;
    if (!herOnly.m && !herOnly.z) return true;
    return (herOnly.m && isMon(b.id)) || (herOnly.z && isZone(b.id));
  };

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
    if (hasHer) {
      const nm = BUILDINGS.filter((b) => isMon(b.id)).length, nz = BUILDINGS.filter((b) => isZone(b.id)).length;
      const r1 = BUILDINGS.filter((b) => b.risk === "RsI"), r1m = r1.filter((b) => isMon(b.id)).length;
      const hb = document.createElement("div");
      hb.innerHTML = `
        <div class="section-label">Heritage</div>
        ${[["m", "Listed monuments", nm], ["z", "In a protected zone (street-based)", nz]].map(([k, l, n]) => `
          <label class="filter-row" style="display:flex;align-items:center;gap:8px;font-size:14px;margin:4px 0;cursor:pointer">
            <input type="checkbox" data-her="${k}"><span>${l}</span>
            <span style="margin-left:auto;font-family:var(--font-mono);font-size:12px;color:var(--ink-muted)">${n.toLocaleString()}</span>
          </label>`).join("")}
        <div class="hist-cov">${r1m} of the ${r1.length} buildings in the highest seismic class (RsI) are listed monuments.
          Sources: Official Monuments List 2015 and City Hall protected-zone documents. Tick a box to show only those buildings.</div>`;
      box.insertAdjacentElement("afterend", hb);
      hb.querySelectorAll("input[data-her]").forEach((cb) => {
        cb.addEventListener("change", () => { herOnly[cb.getAttribute("data-her")] = cb.checked; rebuildMarkers(); });
      });
    }
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
