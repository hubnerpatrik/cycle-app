export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSortedEntryDates(entries) {
  return Object.keys(entries || {}).sort();
}

function buildMapMeta(map) {
  const dates = getSortedEntryDates(map.entries);
  const years = [...new Set(dates.map(date => date.slice(0, 4)))].sort();
  const months = [...new Set(dates.map(date => date.slice(5, 7)))].sort();
  const values = Object.values(map.entries || {});
  const tempCount = values.filter(entry => entry?.temp != null).length;
  const periodCount = values.filter(entry => entry?.bleeding === "menstruation").length;
  const notesCount = values.filter(entry => Boolean(entry?.other?.trim())).length;

  return {
    ...map,
    dates,
    years,
    months,
    preview: `${dates.length} day${dates.length === 1 ? "" : "s"} · ${tempCount} temps · ${periodCount} period days · ${notesCount} notes`,
    dateRange: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "No entries yet",
    lastActivity: map.closedAt || dates[dates.length - 1] || map.createdAt,
  };
}

function matchesFilter(map, year, month) {
  if (!year && !month) return true;
  return map.dates.some(date => {
    const sameYear = !year || date.startsWith(`${year}-`);
    const sameMonth = !month || date.slice(5, 7) === month;
    return sameYear && sameMonth;
  });
}

function renderMapList(container, maps, activeMapId, year, month, onOpen, onRename, onDelete, onExport) {
  const filteredMaps = maps.filter(map => matchesFilter(map, year, month));
  const list = container.querySelector("#mapsList");

  if (!list) return;

  if (!filteredMaps.length) {
    list.innerHTML = `
      <div class="screen-card empty-state">
        <h3>No maps found</h3>
        <p>Try a different month or year, or create a new map.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filteredMaps.map(map => `
    <article class="screen-card map-list-card${map.id === activeMapId ? " is-active" : ""}">
      <div class="map-list-main">
        <div>
          <div class="map-list-title-row">
            <h3>${escapeHtml(map.name || "Untitled map")}</h3>
            <span class="map-pill ${map.status === "closed" ? "map-pill-closed" : ""}">${map.status === "closed" ? "Closed" : "Open"}</span>
            ${map.id === activeMapId ? '<span class="map-pill">Active</span>' : ""}
            ${map.profileSnapshotLocked ? '<span class="map-pill">Shared</span>' : ""}
          </div>
          <p class="map-list-meta">${escapeHtml(map.dateRange)}</p>
          <p class="map-list-preview">Preview: ${escapeHtml(map.preview)}</p>
          <p class="map-list-meta">Last activity: ${escapeHtml(String(map.lastActivity).slice(0, 10))}</p>
        </div>
        <div class="map-list-actions">
          <button type="button" class="btn secondary map-export-btn" data-map-export-id="${escapeHtml(map.id)}">Export</button>
          <button type="button" class="btn secondary map-edit-btn" data-map-rename-id="${escapeHtml(map.id)}">Edit name</button>
          <button type="button" class="btn danger map-delete-btn" data-map-delete-id="${escapeHtml(map.id)}">Delete</button>
          <button type="button" class="btn primary map-open-btn" data-map-id="${escapeHtml(map.id)}">${map.status === "closed" ? "Reopen" : "Open"}</button>
        </div>
      </div>
      <div class="map-delete-confirmation hidden" data-map-delete-confirmation="${escapeHtml(map.id)}" role="alert">
        <span>Are you sure you want to delete this map? This cannot be undone.</span>
        <div class="map-delete-confirmation-actions">
          <button type="button" class="btn secondary" data-map-delete-no="${escapeHtml(map.id)}">No</button>
          <button type="button" class="btn danger" data-map-delete-yes="${escapeHtml(map.id)}">Yes</button>
        </div>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-map-id]").forEach(button => {
    button.addEventListener("click", () => onOpen?.(button.dataset.mapId));
  });

  list.querySelectorAll("[data-map-export-id]").forEach(button => {
    button.addEventListener("click", () => onExport?.(button.dataset.mapExportId));
  });

  list.querySelectorAll("[data-map-rename-id]").forEach(button => {
    button.addEventListener("click", () => {
      const mapId = button.dataset.mapRenameId;
      const map = filteredMaps.find(item => item.id === mapId);
      if (!map) return;

      const nextName = prompt("Edit map name", map.name || "");
      if (nextName == null) return;

      onRename?.(mapId, nextName);
    });
  });

  list.querySelectorAll("[data-map-delete-id]").forEach(button => {
    button.addEventListener("click", () => {
      const confirmation = button.closest(".map-list-card")?.querySelector(".map-delete-confirmation");
      confirmation?.classList.remove("hidden");
      confirmation?.querySelector("[data-map-delete-no]")?.focus();
    });
  });

  list.querySelectorAll("[data-map-delete-no]").forEach(button => {
    button.addEventListener("click", () => {
      button.closest(".map-delete-confirmation")?.classList.add("hidden");
    });
  });

  list.querySelectorAll("[data-map-delete-yes]").forEach(button => {
    button.addEventListener("click", () => onDelete?.(button.dataset.mapDeleteYes));
  });
}

export function renderMyMapsView(container, { maps, activeMapId, onCreate, onImport, onOpen, onRename, onDelete, onExport }) {
  const mapMeta = maps.map(buildMapMeta);
  const allYears = [...new Set(mapMeta.flatMap(map => map.years))].sort();
  let selectedYear = "";
  let selectedMonth = "";

  container.innerHTML = `
    <section class="screen" aria-label="My maps">
      <div class="screen-shell">
        <div class="screen-hero">
          <p class="screen-kicker">My Maps</p>
          <h2>Saved cycle maps</h2>
          <p>Export individual maps with their saved profile, or import a shared map without replacing your own data.</p>
        </div>

        <div class="screen-card map-filter-card">
          <div class="map-filters">
            <label>
              <span class="input-label">Year</span>
              <select id="mapsYearFilter">
                <option value="">All years</option>
                ${allYears.map(year => `<option value="${year}">${year}</option>`).join("")}
              </select>
            </label>
            <label>
              <span class="input-label">Month</span>
              <select id="mapsMonthFilter">
                <option value="">All months</option>
                <option value="01">January</option>
                <option value="02">February</option>
                <option value="03">March</option>
                <option value="04">April</option>
                <option value="05">May</option>
                <option value="06">June</option>
                <option value="07">July</option>
                <option value="08">August</option>
                <option value="09">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>
            </label>
          </div>
          <div class="screen-inline-actions">
            <button type="button" class="btn secondary" id="myMapsImportBtn">Import map</button>
            <button type="button" class="btn primary" id="myMapsCreateBtn">Create map</button>
            <input class="visually-hidden" id="myMapsImportFile" type="file" accept="application/json,.json" tabindex="-1">
          </div>
        </div>

        <div id="mapsList" class="maps-list"></div>
      </div>
    </section>
  `;

  const yearFilter = container.querySelector("#mapsYearFilter");
  const monthFilter = container.querySelector("#mapsMonthFilter");

  const refresh = () => {
    selectedYear = yearFilter?.value ?? "";
    selectedMonth = monthFilter?.value ?? "";
    renderMapList(container, mapMeta, activeMapId, selectedYear, selectedMonth, onOpen, onRename, onDelete, onExport);
  };

  yearFilter?.addEventListener("change", refresh);
  monthFilter?.addEventListener("change", refresh);
  container.querySelector("#myMapsCreateBtn")?.addEventListener("click", () => onCreate?.());
  const importInput = container.querySelector("#myMapsImportFile");
  container.querySelector("#myMapsImportBtn")?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (file) onImport?.(file);
  });

  refresh();
}
