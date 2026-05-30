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
import { buildColumns } from "./domain.js";
import { renderChart, handleCanvasClick } from "./chart.js";
import {
  renderMonth, renderTempScale, renderCalendar,
  renderInfo, renderMapRows, openModal, closeModal,
  saveModal, validateTempInput, syncModalUI,
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
  chartHeight:        360,
  chartPaddingTop:    12,
  chartPaddingBottom: 8,
  minTemp:            36.0,
  maxTemp:            37.5,
};

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

/** Selects a day column and triggers a full re-render. */
export function selectColumn(key) { store.selectedKey = key; render(); }

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
  currentColumns = buildColumns();
  renderMapRows(currentColumns, selectColumn, hoverColumn, clearHover);
  renderChart(currentColumns);
  renderInfo(currentColumns);
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

  // modal
  qs("editBtn").onclick  = () => openModal(currentColumns);
  qs("closeBtn").onclick = closeModal;
  qs("saveBtn").onclick  = () => saveModal(render);

  qs("tempInput").oninput = validateTempInput;

  // segmented controls — generic handler driven by data-group / data-value
  qsa(".segmented button").forEach(btn => {
    btn.onclick = () => {
      let value = btn.dataset.value;
      if (value === "true")  value = true;
      if (value === "false") value = false;
      store.modal[btn.dataset.group] = value;
      syncModalUI();
    };
  });

  // coverline tools
  qs("horizontalCoverlineBtn").onclick = () => {
    store.horizontalCoverlineMode = !store.horizontalCoverlineMode;
    store.verticalCoverlineMode   = false;
    qs("horizontalCoverlineBtn").innerText = store.horizontalCoverlineMode
      ? "Click chart to set horizontal coverline"
      : "Set horizontal coverline";
  };

  qs("verticalCoverlineBtn").onclick = () => {
    store.verticalCoverlineMode   = !store.verticalCoverlineMode;
    store.horizontalCoverlineMode = false;
    qs("verticalCoverlineBtn").innerText = store.verticalCoverlineMode
      ? "Click chart to set vertical coverline"
      : "Set vertical coverline";
  };

  // dev utility
  qs("devReset").onclick = () => {
    if (!confirm("Reset all data? This cannot be undone.")) return;
    store.reset(); render();
  };

  qs("tempChart").addEventListener("click", handleCanvasClick);
}

/* ─── boot ────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  init();
  render();
});