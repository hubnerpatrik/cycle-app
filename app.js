"use strict";

/* ─── helpers ─────────────────────────────── */

export const qs  = id       => document.getElementById(id);
export const qsa = selector => document.querySelectorAll(selector);

/* ─── constants ───────────────────────────── */

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

export const CYCLE = {
  maxDays:        90,
  ovulationLag:    6,
  minLowTemps:     4,
  coverlineShift:  0.05
};

export const MUCUS_LABELS = { dry: "D", moist: "M", wet: "W" };

/* ─── utils ───────────────────────────────── */

export function normalize(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateKey(date) {
  const d  = normalize(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getMonthOffset(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export function formatTemp(temp) {
  return temp != null ? Number(temp).toFixed(2) : "-";
}

export function isValidTemp(temp) {
  return temp == null || (temp >= 34 && temp <= 42);
}

/* ─── layout geometry ─────────────────────── */

export function columnX(index)       { return index * LAYOUT.columnWidth; }
export function columnCenterX(index) { return columnX(index) + LAYOUT.columnWidth / 2; }
export function chartWidth(columns)  { return columns.length * LAYOUT.columnWidth; }

export function graphHeight() {
  return LAYOUT.chartHeight - LAYOUT.chartPaddingTop - LAYOUT.chartPaddingBottom;
}

export function chartY(temp) {
  return (
    LAYOUT.chartPaddingTop +
    ((LAYOUT.maxTemp - temp) / (LAYOUT.maxTemp - LAYOUT.minTemp)) * graphHeight()
  );
}

export function syncCSSVariables() {
  const root = document.documentElement;
  root.style.setProperty("--column-width",     `${LAYOUT.columnWidth}px`);
  root.style.setProperty("--label-width",      `${LAYOUT.sideLabelWidth}px`);
  root.style.setProperty("--temp-scale-width", `${LAYOUT.tempScaleWidth}px`);
  root.style.setProperty("--chart-height",     `${LAYOUT.chartHeight}px`);
}

/* ─── imports ─────────────────────────────── */

import { store } from "./store.js";
import { buildColumns } from "./domain.js";
import { renderChart, handleCanvasClick } from "./chart.js";
import { renderMonth, renderTempScale, renderCalendar, renderInfo, renderMapRows, openModal, closeModal, saveModal, validateTempInput, syncModalUI } from "./ui.js";

/* ─── state ───────────────────────────────── */

export let currentColumns = [];

export function selectColumn(key) { store.selectedKey = key; render(); }
export function hoverColumn(key)  { store.hoveredKey  = key; renderChart(currentColumns); }
export function clearHover()      { store.hoveredKey  = null; renderChart(currentColumns); }

/* ─── render ──────────────────────────────── */

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

function init() {
  syncCSSVariables();

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

  qs("editBtn").onclick  = () => openModal(currentColumns);
  qs("closeBtn").onclick = closeModal;
  qs("saveBtn").onclick  = () => saveModal(render);

  qs("tempInput").oninput = validateTempInput;

  qsa(".segmented button").forEach(btn => {
    btn.onclick = () => {
      let value = btn.dataset.value;
      if (value === "true")  value = true;
      if (value === "false") value = false;
      store.modal[btn.dataset.group] = value;
      syncModalUI();
    };
  });

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

  qs("devReset").onclick = () => {
    if (!confirm("Opravdu smazat všechna data?")) return;
    store.reset(); render();
  };

  qs("tempChart").addEventListener("click", handleCanvasClick);
}

/* ─── boot ────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  init();
  render();
});