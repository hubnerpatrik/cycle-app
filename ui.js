// ui.js — UI rendering and modal
// ─────────────────────────────────────────────
// Owns calendar, info panel, cycle map rows,
// temperature scale, and the edit modal.

import { store } from "./store.js";
import {
  LAYOUT, TEMP_FACTORS, qs, qsa,
  chartY, chartWidth,
  getDaysInMonth, getMonthOffset, formatDateKey, parseDateKey, formatTemp,
  isFertileDay, getFertileRange, clearFertileRange,
  getTimeAdjustment, getAdjustedTemp,
} from "./app.js";

/* ─── month label ─────────────────────────── */

/** Renders the current month and year label above the calendar. */
export function renderMonth() {
  qs("monthLabel").innerText = new Date(store.year, store.month)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}

/* ─── temperature scale ───────────────────── */

/** Renders the fixed temperature scale labels alongside the chart. */
export function renderTempScale() {
  const scale = qs("tempScale");
  if (!scale) return;
  scale.innerHTML = "";
  for (let temp = LAYOUT.maxTemp; temp >= LAYOUT.minTemp - LAYOUT.tempStep / 2; temp -= LAYOUT.tempStep) {
    const label       = document.createElement("div");
    label.className   = "temp-scale-label";
    label.textContent = Number(temp).toFixed(2);
    label.style.top   = `${chartY(temp)}px`;
    scale.appendChild(label);
  }
}

/* ─── calendar ────────────────────────────── */

/**
 * Renders the month calendar grid.
 * Accepts selectColumn as a callback to avoid a circular import with app.js.
 */
export function renderCalendar(selectColumn) {
  const el = qs("calendar");
  el.innerHTML = "";

  // weekday headers
  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(day => {
    const w       = document.createElement("div");
    w.textContent = day;
    w.className   = "calendar-weekday";
    el.appendChild(w);
  });

  const totalDays = getDaysInMonth(store.year, store.month);
  const offset    = getMonthOffset(store.year, store.month);

  // compute cycle start dates for cycle day calculation
  const starts = Object.keys(store.entries)
    .sort()
    .filter((k, i, arr) => {
      if (store.entries[k]?.bleeding !== "menstruation") return false;
      const prev = store.entries[arr[i - 1]];
      return !prev || prev.bleeding !== "menstruation";
    });

  // empty cells before the first day
  for (let i = 0; i < offset; i++) el.appendChild(document.createElement("div"));

  for (let d = 1; d <= totalDays; d++) {
    const date  = new Date(store.year, store.month, d);
    const key   = formatDateKey(date);
    const entry = store.entries[key];

    const div     = document.createElement("div");
    div.className = "day";

    // cycle day number as superscript — only if a cycle start exists before this date
    const dateNorm = new Date(date); dateNorm.setHours(0, 0, 0, 0);
    const latest   = [...starts].reverse().find(s => {
      const sd = new Date(s); sd.setHours(0, 0, 0, 0);
      return sd <= dateNorm;
    });
    if (latest) {
      const sd       = new Date(latest); sd.setHours(0, 0, 0, 0);
      const cycleDay = Math.floor((dateNorm - sd) / 86_400_000) + 1;
      const sup      = document.createElement("span");
      sup.className  = "day-cycle-num";
      sup.textContent = cycleDay;
      div.appendChild(sup);
    }

    // day number
    const dayNum       = document.createElement("span");
    dayNum.textContent = d;
    div.appendChild(dayNum);

    if (entry?.bleeding === "menstruation") div.classList.add("red");
    if (isFertileDay(key))                   div.classList.add("fertile-day");
    if (store.selectedKey === key)          div.classList.add("selected");

    div.onclick = () => selectColumn(key);
    el.appendChild(div);
  }
}

/** Fills the temperature-influence-factor dropdown from the single TEMP_FACTORS source. */
export function renderTempFactorsOptions() {
  const select = qs("tempFactorsInput");
  if (!select) return;

  select.innerHTML = `<option value="">None</option>` +
    Object.entries(TEMP_FACTORS)
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
}

/* ─── action buttons ─────────────────────── */

const sidebarActionDefs = [
  { id: "editBtn", label: "Edit Day", iconClass: "chip-edit-special", iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4Z"/><path d="M14 6l3 3"/></svg>` },
  { id: "dayInfoBtn", label: "Day Info", iconClass: "chip-gray", iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>` },
  { id: "fertileRangeActionBtn", label: "Fertile range", iconClass: "chip-green", iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2.5 3.5L16 11H5"/></svg>` },
];

const modalActionDefs = [
  { id: "temperatureActionBtn", label: "Temperature", iconClass: "chip-orange", iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>` },
  { id: "bleedingActionBtn", label: "Bleeding", iconClass: "chip-red", iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4 5 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-7 7-12Z"/></svg>` },
  { id: "mucusActionBtn", label: "Mucus", iconClass: "chip-blue", iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9c1.5 1.6 3 1.6 4.5 0s3-1.6 4.5 0 3 1.6 4.5 0 3-1.6 4.5 0"/><path d="M3 15c1.5 1.6 3 1.6 4.5 0s3-1.6 4.5 0 3 1.6 4.5 0 3-1.6 4.5 0"/></svg>` },
  { id: "cervixActionBtn", label: "Cervix", iconClass: "chip-teal", iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/></svg>` },
  { id: "otherActionBtn", label: "Other", iconClass: "chip-purple", iconSvg: `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>` },
];

function createActionButton({ id, label, iconClass, iconSvg }) {
  const button = document.createElement("button");
  button.id = id;
  button.className = "action-btn";
  button.type = "button";
  button.innerHTML = `
    <span class="action-icon ${iconClass}">${iconSvg}</span>
    <span class="action-label">${label}</span>
    <svg class="action-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
  `;
  return button;
}

export function renderActionButtons() {
  const sidebar = qs("sidebarActions");
  if (sidebar) {
    sidebar.className = "action-list";
    sidebar.innerHTML = "";
    sidebarActionDefs.forEach(action => sidebar.appendChild(createActionButton(action)));
  }

  const actionModal = qs("actionModalActions");
  if (actionModal) {
    actionModal.className = "action-list";
    actionModal.innerHTML = "";
    modalActionDefs.forEach(action => actionModal.appendChild(createActionButton(action)));
  }
}

export function renderProfileInfo() {
  const card = qs("profileInfoCard");
  if (!card) return;

  const GOAL_LABELS   = { avoid: "Avoid pregnancy", achieve: "Achieve pregnancy", observation: "Observation only" };
  const METHOD_LABELS = { oral: "Oral", vaginal: "Vaginal", rectal: "Rectal" };

  const p = store.profile;
  const rows = [
    ["Name",        p.name],
    ["Consultant",  p.consultantName],
    ["Age",         p.age],
    ["Time",        p.usualMeasurementTime],
    ["Goal",        GOAL_LABELS[p.goal] || ""],
    ["Method",      METHOD_LABELS[p.measurementMethod] || ""],
  ].filter(([, v]) => v);

  if (!rows.length) { card.innerHTML = ""; return; }

  card.innerHTML =
    `<div class="profile-info-title">Profile</div>` +
    rows.map(([k, v]) =>
      `<div class="profile-info-row"><span class="profile-info-label">${k}</span><span class="profile-info-value">${v}</span></div>`
    ).join("");
}

/* ─── cycle map rows ──────────────────────── */

/** Creates a single map cell div with optional CSS classes. */
export function makeCell(text = "", ...classes) {
  const cell       = document.createElement("div");
  cell.className   = ["map-cell", ...classes].filter(Boolean).join(" ");
  cell.textContent = text;
  return cell;
}

function normalizeMarkerColor(value) {
  return value === "green" || value === "blue" || value === "orange" ? value : "blue";
}

function makeAccentCell(text = "", selected = "", group, ...classes) {
  return makeCell(
    text,
    selected,
    group ? `map-cell-accent map-cell-accent-${group}` : "",
    "map-cell-pill",
    ...classes,
  );
}

/**
 * Renders all cycle map rows (day numbers, cycle day, mucus, bleeding, etc.).
 * Interaction callbacks are passed in to avoid circular imports with app.js.
 */
export function renderMapRows(columns, selectColumn, hoverColumn, clearHover) {
  const width = chartWidth(columns);
  const dayNumbers = qs("dayNumbers");
  const mapRows = qs("mapRows");

  if (!dayNumbers || !mapRows) return;

  dayNumbers.innerHTML = "";
  dayNumbers.style.width = `${width}px`;
  mapRows.innerHTML = "";

  const rowDefinitions = [
    { id: "cycleDayRow", label: "Cycle days", render: (col, sel) => makeCell(col.cycleDay, sel) },
    { id: "bleedingRow", label: "Bleeding", group: "red", render: (col, sel) => makeAccentCell(col.bleeding === "menstruation" ? "●" : "", sel, "red", col.bleeding === "menstruation" ? "period" : "") },
    { id: "spottingRow", label: "Spotting", group: "red", render: (col, sel) => makeAccentCell(col.bleeding === "spotting" ? "◐" : "", sel, "red", col.bleeding === "spotting" ? "spotting" : "") },
    { id: "sedimentRow", label: "Clots", group: "red", render: (col, sel) => makeAccentCell(col.sediment ? "✓" : "", sel, "red") },
    { id: "sensationRow", label: "Sensation", group: "mucus", render: (col, sel) => makeAccentCell(SENSATION_LABELS[col.sensation] || "", sel, "mucus") },
    { id: "stretchRow", label: "Slippery ", group: "mucus", render: (col, sel) => makeAccentCell(col.stretch ? "✓" : "", sel, "mucus") },
    { id: "visibleRow", label: "Discharge", group: "mucus", render: (col, sel) => makeAccentCell(col.visible ? "✓" : "", sel, "mucus") },
    { id: "consistencyRow", label: "Consistency", group: "mucus", render: (col, sel) => makeAccentCell(CONSISTENCY_LABELS[col.consistency] || "", sel, "mucus") },
    { id: "colorRow", label: "Color", group: "mucus", render: (col, sel) => makeAccentCell(COLOR_LABELS[col.color] || "", sel, "mucus") },
    { id: "blueMarkerRow", label: "Peak Mucus", group: "mucus", render: (col, sel) => {
      const markerColor = normalizeMarkerColor(col.markerColor);
      const marker = col.marker && markerColor === "blue" ? col.marker : "";
      return makeAccentCell(marker, sel, "mucus", marker ? "marker-blue" : "");
    } },
    { id: "cervixFirmnessRow", label: "Firmness", group: "cervix", render: (col, sel) => makeAccentCell(CERVIX_FIRMNESS_LABELS[col.cervixFirmness] || "", sel, "cervix") },
    { id: "cervixHeightRow", label: "Height", group: "cervix", render: (col, sel) => makeAccentCell(CERVIX_HEIGHT_LABELS[col.cervixHeight] || "", sel, "cervix") },
    { id: "cervixOpennessRow", label: "Openness", group: "cervix", render: (col, sel) => {
      const cell = makeAccentCell("", sel, "cervix");
      if (col.cervixOpenness) {
        const openness = document.createElement("span");
        openness.className = ["cervix-indicator", col.cervixOpenness].join(" ");
        openness.title = `Openness: ${col.cervixOpenness}`;
        cell.appendChild(openness);
      }
      return cell;
    } },
    { id: "orangeMarkerRow", label: "Peak Cervix", group: "cervix", render: (col, sel) => {
      const markerColor = normalizeMarkerColor(col.markerColor);
      const marker = col.marker && markerColor === "orange" ? col.marker : "";
      return makeAccentCell(marker, sel, "cervix", marker ? "marker-orange" : "");
    } },
    { id: "otherRow", label: "Additional symptoms", group: "symptoms", render: (col, sel) => makeAccentCell(col.other ? "✓" : "", sel, "symptoms") },
    { id: "sexRow", label: "Sex", group: "symptoms", render: (col, sel) => makeAccentCell(col.sex === true ? "✓" : "", sel, "symptoms") },
  ];

  const rowDefinitionsWithPosition = rowDefinitions.map((def, index, all) => {
    if (!def.group) return { ...def, groupPosition: "none" };

    const prevGroup = all[index - 1]?.group ?? null;
    const nextGroup = all[index + 1]?.group ?? null;
    const isStart = prevGroup !== def.group;
    const isEnd = nextGroup !== def.group;

    let groupPosition = "middle";
    if (isStart && isEnd) groupPosition = "single";
    else if (isStart) groupPosition = "start";
    else if (isEnd) groupPosition = "end";

    return { ...def, groupPosition };
  });

  const rows = Object.fromEntries(
    rowDefinitionsWithPosition.map(def => [def.id, createMapRow(def.label, def.group, def.groupPosition)]),
  );

  // attaches hover and click handlers to a map cell
  const attach = (el, col) => {
    el.onmouseenter = () => hoverColumn(col.key);
    el.onmouseleave = () => clearHover();
    el.onclick      = () => selectColumn(col.key);
  };

  const CONSISTENCY_LABELS = {
    "": "",
    creamy: "CR",
    slightlyStretchy: "SS",
    stretchy: "ST",
  };
  const COLOR_LABELS = {
    "": "",
    white: "W",
    whiteTranslucent: "WT",
    translucent: "T",
    other: "O",
  };

  const SENSATION_LABELS = {
    "": "",
    dry: "D",
    moist: "M",
    wet: "W",
  };

  const CERVIX_FIRMNESS_LABELS = {
    "": "",
    hard: "H",
    soft: "S",
  };

  const CERVIX_HEIGHT_LABELS = {
    "": "",
    low: "L",
    medium: "M",
    high: "H",
  };

  columns.forEach(col => {
    const sel = [
      store.selectedKey === col.key ? "selected-column" : "",
    ].filter(Boolean).join(" ");

    const dayCell = document.createElement("div");
    dayCell.className = ["map-day", sel, col.isFertile ? "fertility-cell" : ""].filter(Boolean).join(" ");
    dayCell.textContent = col.date.getDate();
    attach(dayCell, col);
    dayNumbers.appendChild(dayCell);

    rowDefinitionsWithPosition.forEach(def => {
      const cell = def.render(col, sel);
      if (col.isFertile) cell.classList.add("fertility-cell");
      attach(cell, col);
      rows[def.id].appendChild(cell);
    });
  });
}

function createMapRow(label, group, groupPosition = "none") {
  const row = document.createElement("div");
  row.className = [
    "map-row",
    group ? `map-row-group map-row-group-${group}` : "",
    group && groupPosition !== "none" ? `map-row-group-${groupPosition}` : "",
  ].filter(Boolean).join(" ");

  const sideLabel = document.createElement("div");
  sideLabel.className = "map-side-label";
  sideLabel.textContent = label;

  const spacer = document.createElement("div");
  spacer.className = "map-temp-spacer";

  const cells = document.createElement("div");
  cells.className = ["map-cells", group ? `map-cells-group-${group}` : ""].filter(Boolean).join(" ");

  row.append(sideLabel, spacer, cells);
  qs("mapRows").appendChild(row);
  return cells;
}

/* ─── modal ───────────────────────────────── */
function showModal(modalId) {
  const modal = qs(modalId);
  if (!modal) return;

  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

function hideModal(modalId) {
  const modal = qs(modalId);
  if (!modal) return;

  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

/** After a modal's close transition: re-render and reopen the action modal. */
function afterModalSave(modalId, render) {
  const modal = qs(modalId);
  if (!modal) {
    render();
    return;
  }

  modal.addEventListener("transitionend", () => {
    render();
    setTimeout(openActionModal, 200);
  }, { once: true });
}

/** Syncs segmented button active states to current store.modal values. */
export function syncModalUI() {
  qsa(".segmented button").forEach(btn => {
    if (btn.closest(".modal")?.classList.contains("hidden")) return;
    let value = btn.dataset.value;
    if (value === "true")  value = true;
    if (value === "false") value = false;
    btn.classList.toggle("active", store.modal[btn.dataset.group] === value);
  });
}

function resetModalState() {
  store.modal = store._emptyModal();
}

/** Opens the edit modal for the currently selected day. */
export function openModal(currentColumns) {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const key    = store.selectedKey;
  const data   = store.entries[key] || {};
  const column = currentColumns.find(c => c.key === key);

  store.modal.temp            = data.temp            ?? null;
  store.modal.tempFactors     = data.tempFactors      ?? "";
  store.modal.measurementTime = data.measurementTime  ?? "";
  store.modal.measurementTimeEnabled = Boolean(data.measurementTime);

  qs("modalTitle").innerText       = `${key} (CD ${column?.cycleDay ?? "-"})`;
  qs("tempInput").value            = store.modal.temp != null ? Number(store.modal.temp).toFixed(2) : "";
  qs("tempFactorsInput").value     = store.modal.tempFactors;
  qs("measurementTimeCheckbox").checked = store.modal.measurementTimeEnabled;
  qs("measurementTimeInput").value = store.modal.measurementTime;
  syncMeasurementTimeUI();

  showModal("modal");
}

/** Closes the modal with a CSS transition. */
export function closeModal() {
  hideModal("modal");
}

/** Returns true if the temperature input is empty or within valid BBT range. */
export function validateTempInput() {
  const raw = qs("tempInput")?.value.trim().replace(",", ".");
  if (!raw) return true;
  const value = parseFloat(raw);
  return !isNaN(value) && (value == null || (value >= 34 && value <= 42));
}

/**
 * Saves modal data to store and triggers a re-render after the close transition.
 * Accepts render as a callback to avoid a circular import with app.js.
 */
export function saveModal(render) {
  if (!store.selectedKey) return showMessage("Select a day first");
  if (!validateTempInput()) return showMessage("Temperature must be between 34–42 °C");

  const tempInput = qs("tempInput").value.trim().replace(",", ".");
  const temp = parseFloat(tempInput);

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    temp:            isNaN(temp) ? null : temp,
    tempFactors:     qs("tempFactorsInput").value,
    measurementTime: store.modal.measurementTimeEnabled ? qs("measurementTimeInput").value : "",
  };

  store.save();
  showMessage("Saved ✓");
  closeModal();
  afterModalSave("modal", render);
}

export function openActionModal() {
  showModal("actionModal");
}

export function closeActionModal() {
  hideModal("actionModal");
}

export function syncMucusModalUI() {
  const otherCheckbox = qs("mucusColorOtherCheckbox");
  const otherInput = qs("mucusColorOtherInput");
  const isOther = store.modal.color === "other" || (store.modal.colorOther && store.modal.colorOther.trim());

  if (otherCheckbox) {
    otherCheckbox.checked = isOther;
  }

  qsa('.segmented button[data-group="color"]').forEach(btn => {
    btn.disabled = isOther;
    btn.classList.toggle("disabled", isOther);
  });

  if (otherInput) {
    otherInput.classList.toggle("hidden", !isOther);
    otherInput.value = store.modal.colorOther ?? "";
  }

  syncModalUI();
}

export function syncMeasurementTimeUI() {
  const checkbox = qs("measurementTimeCheckbox");
  const wrapper = qs("measurementTimeWrapper");

  if (checkbox) {
    checkbox.checked = Boolean(store.modal.measurementTimeEnabled);
  }
  if (wrapper) {
    wrapper.classList.toggle("hidden", !store.modal.measurementTimeEnabled);
  }

  const hint = qs("timeAdjustmentHint");
  if (hint) {
    const adjustment = store.modal.measurementTimeEnabled
      ? getTimeAdjustment(store.modal.measurementTime, store.profile.usualMeasurementTime)
      : 0;
    hint.innerText = adjustment !== 0
      ? `≈ ${adjustment > 0 ? "+" : ""}${adjustment.toFixed(2)} °C vs usual time`
      : "";
  }
}

export function openMucusModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};

  // load saved values into modal state — coerce booleans explicitly
  store.modal.sensation   = data.sensation   ?? "";
  store.modal.stretch     = data.stretch     === true;
  store.modal.visible     = data.visible     === true;
  store.modal.consistency = data.consistency ?? "";
  store.modal.color       = data.color       ?? "";
  store.modal.colorOther  = data.colorOther  ?? "";
  store.modal.isPeak      = data.isPeak      === true;

  showModal("mucusModal");
  syncMucusModalUI();
}

export function closeMucusModal() {
  hideModal("mucusModal");
}

export function saveMucusModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    sensation: store.modal.sensation,
    stretch: store.modal.stretch,
    visible: store.modal.visible,
    consistency: store.modal.consistency,
    color: store.modal.color,
    colorOther: store.modal.colorOther,
    isPeak: store.modal.isPeak,
  };

  store.save();
  showMessage("Saved ✓");
  closeMucusModal();
  afterModalSave("mucusModal", render);
}

export function openBleedingModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};

  // load saved bleeding value into modal state
  store.modal.bleeding = data.bleeding ?? "none";
  store.modal.sediment = data.sediment === true;

  showModal("bleedingModal");
  syncModalUI();
}

export function closeBleedingModal() {
  hideModal("bleedingModal");
}

export function saveBleedingModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    bleeding: store.modal.bleeding,
    sediment: store.modal.sediment,
  };

  store.save();
  showMessage("Saved ✓");
  closeBleedingModal();
  afterModalSave("bleedingModal", render);
}

export function openMarkersModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};

  store.modal.isPeak = data.isPeak === true;
  store.modal.marker = data.marker ?? "";
  store.modal.markerColor = normalizeMarkerColor(data.markerColor ?? "blue");
  store.modal.markerPointType = data.markerPointType ?? store.selectedPointType ?? "temp";

  qs("markersMarker").value = store.modal.marker;

  showModal("markersModal");
  syncModalUI();
}

export function closeMarkersModal() {
  hideModal("markersModal");
}

export function clearMarkersModalInput() {
  store.modal.marker = "";
  const markerInput = qs("markersMarker");
  if (markerInput) markerInput.value = "";
}

export function saveMarkersModal(render) {
  if (!store.selectedKey) return;

  store.modal.marker = qs("markersMarker").value || "";

  const markerColor = normalizeMarkerColor(store.modal.markerColor || "blue");

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    isPeak: store.modal.isPeak === true,
    marker: store.modal.marker,
    markerColor,
    markerPointType: store.modal.markerPointType || "temp",
  };

  store.save();
  showMessage("Saved ✓");
  closeMarkersModal();
  afterModalSave("markersModal", render);
}

export function openCervixModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};
  store.modal.cervixFirmness = data.cervixFirmness ?? "";
  store.modal.cervixHeight = data.cervixHeight ?? "";
  store.modal.cervixOpenness = data.cervixOpenness ?? "";

  showModal("cervixModal");
  syncModalUI();
}

export function closeCervixModal() {
  hideModal("cervixModal");
}

export function saveCervixModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    cervixFirmness: store.modal.cervixFirmness,
    cervixHeight: store.modal.cervixHeight,
    cervixOpenness: store.modal.cervixOpenness,
  };

  store.save();
  showMessage("Saved ✓");
  closeCervixModal();
  afterModalSave("cervixModal", render);
}

/* ─── fertile range modal ─────────────────── */

// draft state for the in-modal calendar — discarded on close without saving
let fertileRangeDraft = null;

function collectDraftFertileDays() {
  const selected = new Set(
    Object.keys(store.entries).filter(key => store.entries[key]?.isFertile === true)
  );

  const range = getFertileRange();
  if (!range) return selected;

  const cursor = parseDateKey(range.start);
  const end = parseDateKey(range.end);
  while (cursor <= end) {
    selected.add(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return selected;
}

/** Renders the mini calendar inside the fertile range modal from the current draft. */
function renderFertileRangeModal() {
  qs("fertileRangeMonthLabel").innerText = new Date(fertileRangeDraft.year, fertileRangeDraft.month)
    .toLocaleString("en-US", { month: "long", year: "numeric" });

  const el = qs("fertileRangeCalendar");
  el.innerHTML = "";

  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
    const w       = document.createElement("div");
    w.textContent = day;
    w.className   = "calendar-weekday";
    el.appendChild(w);
  });

  const totalDays = getDaysInMonth(fertileRangeDraft.year, fertileRangeDraft.month);
  const offset    = getMonthOffset(fertileRangeDraft.year, fertileRangeDraft.month);

  for (let i = 0; i < offset; i++) el.appendChild(document.createElement("div"));

  for (let d = 1; d <= totalDays; d++) {
    const key = formatDateKey(new Date(fertileRangeDraft.year, fertileRangeDraft.month, d));

    const div       = document.createElement("div");
    div.className   = "day";
    div.textContent = d;

    if (fertileRangeDraft.selectedKeys.has(key)) {
      div.classList.add("fertile-day");
    }

    div.onclick = () => pickFertileRangeDay(key);
    el.appendChild(div);
  }
}

/** Handles day toggling inside the fertile range picker. */
function pickFertileRangeDay(key) {
  if (fertileRangeDraft.selectedKeys.has(key)) {
    fertileRangeDraft.selectedKeys.delete(key);
  } else {
    fertileRangeDraft.selectedKeys.add(key);
  }

  renderFertileRangeModal();
}

/** Moves the picker's visible month forward or back by one. */
export function changeFertileRangeMonth(delta) {
  fertileRangeDraft.month += delta;
  if (fertileRangeDraft.month < 0)  { fertileRangeDraft.month = 11; fertileRangeDraft.year--; }
  if (fertileRangeDraft.month > 11) { fertileRangeDraft.month = 0;  fertileRangeDraft.year++; }
  renderFertileRangeModal();
}

/** Opens the fertile range modal, preloading the currently active range if any. */
export function openFertileRangeModal() {
  const selectedKeys = collectDraftFertileDays();
  const firstSelected = [...selectedKeys].sort()[0] ?? null;
  const base = firstSelected ? parseDateKey(firstSelected) : new Date();

  fertileRangeDraft = {
    month: base.getMonth(),
    year:  base.getFullYear(),
    selectedKeys,
  };

  renderFertileRangeModal();

  showModal("fertileRangeModal");
}

export function closeFertileRangeModal() {
  hideModal("fertileRangeModal");
}

export function saveFertileRangeModal(render) {
  if (!fertileRangeDraft?.selectedKeys) {
    return;
  }

  Object.keys(store.entries).forEach((key) => {
    if (store.entries[key]?.isFertile === true) {
      delete store.entries[key].isFertile;
    }
  });

  fertileRangeDraft.selectedKeys.forEach((key) => {
    store.entries[key] = {
      ...(store.entries[key] || {}),
      isFertile: true,
    };
  });

  // Keep a single source of truth in per-day flags after this migration.
  clearFertileRange();

  store.save();
  showMessage("Saved ✓");
  closeFertileRangeModal();
  render();
}

/** Clears fertile-day picks for the currently visible month in the modal draft. */
export function clearFertileRangeModal() {
  if (!fertileRangeDraft?.selectedKeys) return;

  const monthPrefix = `${fertileRangeDraft.year}-${String(fertileRangeDraft.month + 1).padStart(2, "0")}-`;
  let removed = 0;

  [...fertileRangeDraft.selectedKeys].forEach((key) => {
    if (key.startsWith(monthPrefix)) {
      fertileRangeDraft.selectedKeys.delete(key);
      removed++;
    }
  });

  if (!removed) {
    showMessage("No fertile days in this month");
    return;
  }

  renderFertileRangeModal();
  showMessage(`Cleared ${removed} day${removed === 1 ? "" : "s"} in this month`);
}

export function openOtherModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};
  store.modal.sex = data.sex === true ? true : false;
  qs("otherModalInput").value = data.other ?? "";
  showModal("otherModal");
  syncModalUI();
}

export function closeOtherModal() {
  hideModal("otherModal");
}

export function saveOtherModal(render) {
  if (!store.selectedKey) return;

  const sexValue = store.modal.sex === true;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    other: qs("otherModalInput").value.trim(),
  };

  store.entries[store.selectedKey].sex = sexValue;

  store.save();
  showMessage("Saved ✓");
  closeOtherModal();
  afterModalSave("otherModal", render);
}

/* ─── day info modal ───────────────────────── */
const BLEEDING_LABELS = { none: "None", spotting: "Spotting", menstruation: "Period" };
const SENSATION_LABELS = { "": "-", dry: "Dry", moist: "Moist", wet: "Wet" };

// full-word versions of the abbreviated map labels — used only in day-info modal
const CONSISTENCY_FULL_LABELS = { "": "-", creamy: "Creamy", slightlyStretchy: "Slightly stretchy", stretchy: "Stretchy" };
const COLOR_FULL_LABELS = { "": "-", white: "White", whiteTranslucent: "White-translucent", translucent: "Translucent", other: "Other" };

/** Opens the read-only day info modal for the currently selected day. */
export function openDayInfoModal(currentColumns) {
  if (!store.selectedKey) return showMessage("Select a day first");

  const key    = store.selectedKey;
  const data   = store.entries[key] || {};
  const column = currentColumns.find(c => c.key === key);

  qs("dayInfoTitle").innerText = `${key} (CD ${column?.cycleDay ?? "-"})`;

  const adjustedTemp = getAdjustedTemp(data.temp, data.measurementTime, store.profile.usualMeasurementTime);
  qs("infoTemp").innerText = data.temp != null
    ? `${formatTemp(data.temp)} °C${data.measurementTime ? ` at ${data.measurementTime}` : ""}${adjustedTemp != null ? ` (adjusted ${formatTemp(adjustedTemp)} °C)` : ""}`
    : "-";
  qs("infoTempFactors").innerText = data.tempFactors ? TEMP_FACTORS[data.tempFactors] : "-";
  qs("infoBleeding").innerText    = BLEEDING_LABELS[data.bleeding ?? "none"];

  qs("infoMucus").innerHTML = [
    `Sensation: ${SENSATION_LABELS[data.sensation ?? ""]}`,
    `Slippery: ${data.stretch ? "Yes" : "No"}`,
    `Discharge: ${data.visible ? "Yes" : "None"}`,
    `Consistency: ${CONSISTENCY_FULL_LABELS[data.consistency ?? ""]}`,
    `Color: ${COLOR_FULL_LABELS[data.color ?? ""]}${data.colorOther ? ` (${data.colorOther})` : ""}`,
    `Clots: ${data.sediment ? "Yes" : "No"}`,
  ].join("<br>");

  const CERVIX_LABELS = {
    firmness: {
      "": "-",
      hard: "Hard",
      soft: "Soft",
    },
    height: {
      "": "-",
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    openness: {
      "": "-",
      closed: "Closed",
      medium: "Medium",
      open: "Open",
    },
  };

  qs("infoCervix").innerHTML = [
    `Firmness: ${CERVIX_LABELS.firmness[data.cervixFirmness ?? ""]}`,
    `Height: ${CERVIX_LABELS.height[data.cervixHeight ?? ""]}`,
    `Openness: ${CERVIX_LABELS.openness[data.cervixOpenness ?? ""]}`,
  ].join("<br>");

  const sexText = data.sex === true ? "Yes" : data.sex === false ? "No" : "-";
  const otherText = data.other?.trim() ? data.other : "-";
  qs("infoOther").innerHTML = `Sex: ${sexText}<br>Notes: ${otherText}`;

  showModal("dayInfoModal");
}

/** Closes the day info modal. */
export function closeDayInfoModal() {
  hideModal("dayInfoModal");
}

/* ─── toast ───────────────────────────────── */

let toastTimer = null;

/** Shows a temporary message banner. Used for blocked actions and validation errors. */
export function showMessage(text) {
  const toast = qs("toast");
  if (!toast) return;

  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.classList.add("hidden"), { once: true });
  }, 2200);
}