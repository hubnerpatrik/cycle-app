// app.js — Cycle Tracker
// ─────────────────────────────────────────────
// Entry point. Owns constants, utils, layout geometry,
// top-level render, and app initialization.
//
// Module map:
//   app.js      constants, utils, geometry, render, init
//   store.js    Store class, localStorage persistence
//   domain.js   cycle detection, column building
//   chart.js    canvas rendering, coverline interaction
//   ui.js       calendar, info panel, map rows, modal
// ─────────────────────────────────────────────

"use strict";

import { store } from "./store.js";
import { buildCycleColumns, getCycleCount, getCycleStartDates } from "./domain.js";
import { renderChart, handleCanvasClick } from "./chart.js";

import {
  renderMonth,
  renderTempScale,
  renderCalendar,
  renderMapRows,
  openModal,
  closeModal,
  openActionModal,
  closeActionModal,
  saveModal,
  validateTempInput,
  openMucusModal,
  closeMucusModal,
  saveMucusModal,
  openBleedingModal,
  closeBleedingModal,
  saveBleedingModal,
  openMarkersModal,
  closeMarkersModal,
  saveMarkersModal,
  openOtherModal,
  closeOtherModal,
  saveOtherModal,
  syncModalUI,
} from "./ui.js";

/* ─── DOM helpers ─────────────────────────── */

export const qs  = id       => document.getElementById(id);
export const qsa = selector => document.querySelectorAll(selector);

/* ─── layout constants ────────────────────── */

/** All canvas/grid dimensions in one place. Synced to CSS via syncCSSVariables(). */
export const LAYOUT = {
  columnWidth:        50,
  sideLabelWidth:     68,
  tempScaleWidth:     72,
  chartHeight:        600,
  chartPaddingTop:    12,
  chartPaddingBottom: 8,
  minTemp:            36.0,
  maxTemp:            37.5,
};
  const ZOOM_MIN  = 24;
  const ZOOM_MAX  = 90;
  const ZOOM_STEP = 8;
  const ZOOM_BASE = 50;
    
/** Symptothermal algorithm parameters (unused in UI — reserved for future logic). */
export const CYCLE = {
  maxDays:       90,    // safety cap for cycle iteration
  ovulationLag:   6,    // low-temp window size before thermal shift
  minLowTemps:    4,    // minimum valid readings to confirm ovulation
  coverlineShift: 0.05, // degrees above max-low temp = coverline
};

/** Short display labels for mucus quality values. */
export const MUCUS_LABELS = { dry: "D", moist: "M", wet: "W" };

/* ─── date utils ──────────────────────────── */

/** Returns a new Date with time zeroed — used for safe date comparisons. */
export function normalize(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parses a "YYYY-MM-DD" storage key into a local Date. */
export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Formats a Date into a "YYYY-MM-DD" storage key. */
export function formatDateKey(date) {
  const d  = normalize(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Returns the number of days in a given month. */
export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns Monday-based week offset for the first day of the month (0 = Mon, 6 = Sun). */
export function getMonthOffset(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

/** Formats a temperature value to 2 decimal places, or returns "-" if null. */
export function formatTemp(temp) {
  return temp != null ? Number(temp).toFixed(2) : "-";
}

/** Returns true if temp is within physiologically plausible BBT range. */
export function isValidTemp(temp) {
  return temp == null || (temp >= 34 && temp <= 42);
}

/* ─── layout geometry ─────────────────────── */

/** Pixel x position of the left edge of a column. */
export function columnX(index)       { return index * LAYOUT.columnWidth; }

/** Pixel x position of the center of a column. */
export function columnCenterX(index) { return columnX(index) + LAYOUT.columnWidth / 2; }

/** Total canvas width for a given column array. */
export function chartWidth(columns)  { return columns.length * LAYOUT.columnWidth; }

/** Drawable area height (excludes top/bottom padding). */
export function graphHeight() {
  return LAYOUT.chartHeight - LAYOUT.chartPaddingTop - LAYOUT.chartPaddingBottom;
}

/** Converts a temperature value to a canvas y coordinate. */
export function chartY(temp) {
  return (
    LAYOUT.chartPaddingTop +
    ((LAYOUT.maxTemp - temp) / (LAYOUT.maxTemp - LAYOUT.minTemp)) * graphHeight()
  );
}

/** Pushes LAYOUT values into CSS custom properties so CSS rows stay in sync. */
export function syncCSSVariables() {
  const root = document.documentElement;
  root.style.setProperty("--column-width",     `${LAYOUT.columnWidth}px`);
  root.style.setProperty("--label-width",      `${LAYOUT.sideLabelWidth}px`);
  root.style.setProperty("--temp-scale-width", `${LAYOUT.tempScaleWidth}px`);
  root.style.setProperty("--chart-height",     `${LAYOUT.chartHeight}px`);
}

/* ─── runtime state ───────────────────────── */

/** Columns built from store.entries each render cycle. Shared across modules. */
export let currentColumns = [];

/** Selects a day column, switches to the correct cycle, and triggers a full re-render. */
export function selectColumn(key) {
  store.selectedKey = key;

  // switch to the cycle containing this key
  const starts = getCycleStartDates();
  if (starts.length) {
    const date = normalize(parseDateKey(key));
    let cycleIndex = 0;
    for (let i = 0; i < starts.length; i++) {
      if (normalize(starts[i]) <= date) cycleIndex = i;
    }
    store.currentCycleIndex = cycleIndex;
  }

  render();
}

/** Highlights a column on hover — only redraws the chart layer. */
export function hoverColumn(key)  { store.hoveredKey = key; renderChart(currentColumns); }

/** Clears hover state and redraws the chart layer. */
export function clearHover()      { store.hoveredKey = null; renderChart(currentColumns); }

/* ─── render ──────────────────────────────── */

/** Full re-render — rebuilds columns from store and updates all UI layers. */
export function render() {
  renderMonth();
  renderCalendar(selectColumn);
  renderTempScale();
  currentColumns = buildCycleColumns();
  renderMapRows(currentColumns, selectColumn, hoverColumn, clearHover);
  renderChart(currentColumns);
  renderCycleNav();
}

/** Updates cycle navigation label and button states. */
function renderCycleNav() {
  const starts = getCycleStartDates();
  const total  = Math.max(starts.length, 1);
  const index  = store.currentCycleIndex ?? total - 1;

  qs("cycleNavLabel").innerText = `Cycle ${index + 1} / ${total}`;
  qs("prevCycleBtn").disabled   = index <= 0;
  qs("nextCycleBtn").disabled   = index >= total - 1;
}

/** Updates zoom percentage label. */
function renderZoomLabel() {
  const pct = Math.round((LAYOUT.columnWidth / ZOOM_BASE) * 100);
  qs("zoomLabel").innerText = `${pct}%`;
}
/* ─── init ────────────────────────────────── */

/** Binds all event listeners. Called once on DOMContentLoaded. */
function init() {
  syncCSSVariables();

  // calendar navigation
  qs("prevMonth").onclick = () => {
    store.month--;
    if (store.month < 0) { store.month = 11; store.year--; }
    render();
  };

  qs("nextMonth").onclick = () => {
    store.month++;
    if (store.month > 11) { store.month = 0; store.year++; }
    render();
  };

  // cycle navigation
  qs("prevCycleBtn").onclick = () => {
    const total = getCycleCount();
    const index = store.currentCycleIndex ?? total - 1;
    store.currentCycleIndex = Math.max(0, index - 1);
    render();
  };

  qs("nextCycleBtn").onclick = () => {
    const total = getCycleCount();
    const index = store.currentCycleIndex ?? total - 1;
    store.currentCycleIndex = Math.min(total - 1, index + 1);
    render();
  };

  // action modal
  qs("editBtn").onclick        = () => openActionModal();
  qs("closeBtn").onclick       = closeModal;
  qs("saveBtn").onclick        = () => saveModal(render);
  qs("closeActionModalBtn").onclick = closeActionModal;

  qs("temperatureActionBtn").onclick = () => {
    closeActionModal();
    setTimeout(() => openModal(currentColumns), 200);
  };

  qs("bleedingActionBtn").onclick = () => {
    closeActionModal();
    setTimeout(() => openBleedingModal(), 250);
  };

  qs("closeBleedingModalBtn").onclick  = closeBleedingModal;
  qs("saveBleedingModalBtn").onclick   = () => saveBleedingModal(render);

  qs("mucusActionBtn").onclick = () => {
    closeActionModal();
    setTimeout(() => openMucusModal(), 250);
  };

  qs("closeMucusModalBtn").onclick = closeMucusModal;
  qs("saveMucusModalBtn").onclick  = () => saveMucusModal(render);

  qs("markersActionBtn").onclick = () => {
    closeActionModal();
    setTimeout(() => openMarkersModal(), 250);
  };

  qs("otherActionBtn").onclick = () => {
    closeActionModal();
    setTimeout(() => openOtherModal(), 250);
  };

  qs("closeMarkersModalBtn").onclick = closeMarkersModal;
  qs("saveMarkersModalBtn").onclick  = () => saveMarkersModal(render);
  qs("closeOtherModalBtn").onclick   = closeOtherModal;
  qs("saveOtherModalBtn").onclick    = () => saveOtherModal(render);

  // coverline tools
  qs("horizontalCoverlineBtn").onclick = () => {
    store.horizontalCoverlineMode = !store.horizontalCoverlineMode;
    store.verticalCoverlineMode   = false;
    qs("horizontalCoverlineBtn").classList.toggle("active", store.horizontalCoverlineMode);
    qs("verticalCoverlineBtn").classList.remove("active");
    qs("horizontalCoverlineBtn").innerText = store.horizontalCoverlineMode
      ? "Click chart to set horizontal coverline"
      : "Horizontal coverline";
  };

  qs("verticalCoverlineBtn").onclick = () => {
    store.verticalCoverlineMode   = !store.verticalCoverlineMode;
    store.horizontalCoverlineMode = false;
    qs("verticalCoverlineBtn").classList.toggle("active", store.verticalCoverlineMode);
    qs("horizontalCoverlineBtn").classList.remove("active");
    qs("verticalCoverlineBtn").innerText = store.verticalCoverlineMode
      ? "Click chart to set vertical coverline"
      : "Vertical coverline";
  };
  // zoom controls
  qs("zoomInBtn").onclick = () => {
    LAYOUT.columnWidth = Math.min(ZOOM_MAX, LAYOUT.columnWidth + ZOOM_STEP);
    syncCSSVariables();
    render();
    renderZoomLabel();
  };

  qs("zoomOutBtn").onclick = () => {
    LAYOUT.columnWidth = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, LAYOUT.columnWidth - ZOOM_STEP));
    syncCSSVariables();
    render();
    renderZoomLabel();
  };

  // dev utility
  qs("devReset").onclick = () => {
    if (!confirm("Reset all data? This cannot be undone.")) return;
    store.reset();
    render();
  };

  qs("tempChart").addEventListener("click", handleCanvasClick);

  // segmented buttons — update store and sync active state
  qsa(".segmented button").forEach(btn => {
    btn.onclick = () => {
      // ignore click if parent modal is not visible
      if (btn.closest(".modal")?.classList.contains("hidden")) return;
      let value = btn.dataset.value;
      if (value === "true")  value = true;
      if (value === "false") value = false;
      store.modal[btn.dataset.group] = value;
      syncModalUI();
    };
  });
}

/* ─── boot ────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  init();
  render();
  renderZoomLabel();
});