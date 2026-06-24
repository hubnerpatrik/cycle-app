// ui.js — UI rendering and modal
// ─────────────────────────────────────────────
// Owns calendar, info panel, cycle map rows,
// temperature scale, and the edit modal.

import { store } from "./store.js";
import {
  LAYOUT, MUCUS_LABELS, qs, qsa,
  chartY, chartWidth,
  getDaysInMonth, getMonthOffset, formatDateKey, formatTemp,
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
  for (let temp = LAYOUT.maxTemp; temp >= LAYOUT.minTemp - 0.001; temp -= 0.1) {
    const label       = document.createElement("div");
    label.className   = "temp-scale-label";
    label.textContent = Number(temp).toFixed(2);
    label.style.top   = `${chartY(temp) - 9}px`;
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
    if (entry?.isFertile)                   div.classList.add("fertile-day");
    if (store.selectedKey === key)          div.classList.add("selected");

    div.onclick = () => selectColumn(key);
    el.appendChild(div);
  }
}

/* ─── cycle map rows ──────────────────────── */

/** Creates a single map cell div with optional CSS classes. */
export function makeCell(text = "", ...classes) {
  const cell       = document.createElement("div");
  cell.className   = ["map-cell", ...classes].filter(Boolean).join(" ");
  cell.textContent = text;
  return cell;
}

/**
 * Renders all cycle map rows (day numbers, cycle day, mucus, bleeding, etc.).
 * Interaction callbacks are passed in to avoid circular imports with app.js.
 */
export function renderMapRows(columns, selectColumn, hoverColumn, clearHover) {
const rowIds = [
  "dayNumbers",
  "cycleDayRow",

  "sensationRow",
  "stretchRow",
  "visibleRow",
  "consistencyRow",
  "colorRow",
  "peakRow",

  "bleedingRow",
  "spottingRow",
  "sedimentRow",
  "otherRow",
];
  const rows  = Object.fromEntries(rowIds.map(id => [id, qs(id)]));
  const width = chartWidth(columns);

  Object.values(rows).forEach(row => { row.innerHTML = ""; row.style.width = `${width}px`; });

  // attaches hover and click handlers to a map cell
  const attach = (el, col) => {
    el.onmouseenter = () => hoverColumn(col.key);
    el.onmouseleave = () => clearHover();
    el.onclick      = () => selectColumn(col.key);
  };

  const CONSISTENCY_LABELS = {
  none: "",
  sticky: "ST",
  creamy: "CR",
  eggwhite: "EW",
};
  const COLOR_LABELS = {
    none: "",
    white: "W",
    yellow: "Y",
    clear: "C",
};

  columns.forEach(col => {
    const sel = store.selectedKey === col.key ? "selected-column" : "";

    const dayCell       = document.createElement("div");
    dayCell.className   = ["map-day", sel].filter(Boolean).join(" ");
    dayCell.textContent = col.date.getDate();
    attach(dayCell, col);
    rows.dayNumbers.appendChild(dayCell);

    const cdCell = makeCell(col.cycleDay, sel);
    attach(cdCell, col);
    rows.cycleDayRow.appendChild(cdCell);

    const sensationCell = makeCell(col.sensation || "", sel);
    attach(sensationCell, col);
    rows.sensationRow.appendChild(sensationCell);

    const stretchCell = makeCell(col.stretch ? "✓" : "", sel);
    attach(stretchCell, col);
    rows.stretchRow.appendChild(stretchCell);

    const visibleCell = makeCell(col.visible ? "✓" : "", sel);
    attach(visibleCell, col);
    rows.visibleRow.appendChild(visibleCell);

    const consistencyCell = makeCell(CONSISTENCY_LABELS[col.consistency] || "", sel);
    attach(consistencyCell, col);
    rows.consistencyRow.appendChild(consistencyCell);

    const colorCell = makeCell(COLOR_LABELS[col.color] || "", sel);
    attach(colorCell, col);
    rows.colorRow.appendChild(colorCell);

    const peakCell = makeCell(col.isPeak ? "P" : "", sel);
    attach(peakCell, col);
    rows.peakRow.appendChild(peakCell);

    const bleedCell = makeCell(
      col.bleeding === "menstruation" ? "●" : "", sel,
      col.bleeding === "menstruation" ? "period" : ""
    );
    attach(bleedCell, col);
    rows.bleedingRow.appendChild(bleedCell);

    const spottingCell = makeCell(
      col.bleeding === "spotting" ? "◐" : "", sel,
      col.bleeding === "spotting" ? "spotting" : ""
    );
    attach(spottingCell, col);
    rows.spottingRow.appendChild(spottingCell);

    const sedimentCell = makeCell(col.sediment ? "✓" : "", sel);
    attach(sedimentCell, col);
    rows.sedimentRow.appendChild(sedimentCell);

    const otherCell = makeCell(col.other ? "✓" : "", sel);
    attach(otherCell, col);
    rows.otherRow.appendChild(otherCell);
  });
}

/* ─── modal ───────────────────────────────── */

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

/** Opens the edit modal for the currently selected day. */
export function openModal(currentColumns) {
  if (!store.selectedKey) return showMessage("Select a day first");

  const key    = store.selectedKey;
  const data   = store.entries[key] || {};
  const column = currentColumns.find(c => c.key === key);

  store.modal.temp        = data.temp        ?? null;
  store.modal.tempFactors = data.tempFactors ?? "";

  qs("modalTitle").innerText       = `${key} (CD ${column?.cycleDay ?? "-"})`;
  qs("tempInput").value            = store.modal.temp != null ? Number(store.modal.temp).toFixed(2) : "";
  qs("tempFactorsInput").value     = store.modal.tempFactors;

  const modal = qs("modal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

/** Closes the modal with a CSS transition. */
export function closeModal() {
  const modal = qs("modal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

/** Returns true if the temperature input is empty or within valid BBT range. */
export function validateTempInput() {
  const raw = qs("tempInput")?.value.trim();
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

  const temp = parseFloat(qs("tempInput").value);

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    temp:        isNaN(temp) ? null : temp,
    tempFactors: qs("tempFactorsInput").value.trim(),
  };

  store.save();
  closeModal();

  qs("modal").addEventListener("transitionend", render, { once: true });
}

export function openActionModal() {
  const modal = qs("actionModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeActionModal() {
  const modal = qs("actionModal");
  modal.classList.remove("show");
  modal.addEventListener(
    "transitionend",
    () => modal.classList.add("hidden"),
    { once: true }
  );
}

export function openMucusModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  const data = store.entries[store.selectedKey] || {};

  // load saved values into modal state — coerce booleans explicitly
  store.modal.sensation   = data.sensation   ?? "dry";
  store.modal.stretch     = data.stretch     === true;
  store.modal.visible     = data.visible     === true;
  store.modal.consistency = data.consistency ?? "none";
  store.modal.color       = data.color       ?? "none";
  store.modal.sediment    = data.sediment    === true;
  store.modal.isPeak      = data.isPeak      === true;

  const modal = qs("mucusModal");
  modal.classList.remove("hidden");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      syncModalUI();          // sync after modal is visible
      modal.classList.add("show");
    });
  });
}

export function closeMucusModal() {
  const modal = qs("mucusModal");

  modal.classList.remove("show");

  modal.addEventListener(
    "transitionend",
    () => modal.classList.add("hidden"),
    { once: true }
  );
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
    sediment: store.modal.sediment,
    isPeak: store.modal.isPeak,
  };
  
  store.save();
  closeMucusModal();

  qs("mucusModal").addEventListener(
    "transitionend",
    render,
    { once: true }
  );
}
export function openBleedingModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  const data = store.entries[store.selectedKey] || {};

  // load saved bleeding value into modal state
  store.modal.bleeding = data.bleeding ?? "none";

  syncModalUI();

  const modal = qs("bleedingModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeBleedingModal() {
  const modal = qs("bleedingModal");

  modal.classList.remove("show");

  modal.addEventListener(
    "transitionend",
    () => modal.classList.add("hidden"),
    { once: true }
  );
}

export function saveBleedingModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    bleeding: store.modal.bleeding,
  };

  store.save();
  closeBleedingModal();

  qs("bleedingModal").addEventListener(
    "transitionend",
    render,
    { once: true }
  );
}
export function openMarkersModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  const data = store.entries[store.selectedKey] || {};

  // load saved marker values into modal state — coerce booleans explicitly
  qs("markersFertile").checked = data.isFertile === true;
  qs("markersPeak").checked    = data.isPeak    === true;
  qs("markersMarker").value    = data.marker    ?? "";

  const modal = qs("markersModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeMarkersModal() {
  const modal = qs("markersModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function saveMarkersModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    isFertile: qs("markersFertile").checked,
    isPeak:    qs("markersPeak").checked,
    marker:    qs("markersMarker").value,
  };

  store.save();
  closeMarkersModal();

  qs("markersModal").addEventListener("transitionend", render, { once: true });
}

export function openOtherModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  const data = store.entries[store.selectedKey] || {};
  qs("otherModalInput").value = data.other ?? "";

  const modal = qs("otherModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeOtherModal() {
  const modal = qs("otherModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function saveOtherModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    other: qs("otherModalInput").value.trim(),
  };

  store.save();
  closeOtherModal();

  qs("otherModal").addEventListener("transitionend", render, { once: true });
}

/* ─── day info modal ───────────────────────── */
const BLEEDING_LABELS = { none: "None", spotting: "Spotting", menstruation: "Period" };
const SENSATION_LABELS = { dry: "Dry", moist: "Moist", wet: "Wet" };

// full-word versions of the abbreviated map labels — used only in day-info modal
const CONSISTENCY_FULL_LABELS = { none: "None", sticky: "Creamy", creamy: "Slightly stretchy", eggwhite: "Stretchy" };
const COLOR_FULL_LABELS = { none: "None", clear: "White", white: "Clear", yellow: "Other" };

/** Opens the read-only day info modal for the currently selected day. */
export function openDayInfoModal(currentColumns) {
  if (!store.selectedKey) return showMessage("Select a day first");

  const key    = store.selectedKey;
  const data   = store.entries[key] || {};
  const column = currentColumns.find(c => c.key === key);

  qs("dayInfoTitle").innerText = `${key} (CD ${column?.cycleDay ?? "-"})`;

  qs("infoTemp").innerText        = data.temp != null ? `${formatTemp(data.temp)} °C` : "-";
  qs("infoTempFactors").innerText = data.tempFactors?.trim() ? data.tempFactors : "-";
  qs("infoBleeding").innerText    = BLEEDING_LABELS[data.bleeding ?? "none"];

  qs("infoMucus").innerHTML = [
    `Sensation: ${SENSATION_LABELS[data.sensation ?? "dry"]}`,
    `Slippery: ${data.stretch ? "Yes" : "No"}`,
    `Discharge: ${data.visible ? "Yes" : "No"}`,
    `Consistency: ${CONSISTENCY_FULL_LABELS[data.consistency ?? "none"]}`,
    `Color: ${COLOR_FULL_LABELS[data.color ?? "none"]}`,
    `Clots: ${data.sediment ? "Yes" : "No"}`,
  ].join("<br>");

  qs("infoMarkers").innerHTML = [
    `Fertile: ${data.isFertile ? "Yes" : "No"}`,
    `Peak: ${data.isPeak ? "Yes" : "No"}`,
    `Marker: ${data.marker || "-"}`,
  ].join("<br>");

  qs("infoOther").innerText = data.other?.trim() ? data.other : "-";

  const modal = qs("dayInfoModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

/** Closes the day info modal. */
export function closeDayInfoModal() {
  const modal = qs("dayInfoModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
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