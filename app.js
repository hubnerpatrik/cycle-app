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
  renderTempFactorsOptions,
  renderProfileInfo,
  renderActionButtons,
  renderCalendar,
  renderMapRows,
  openModal,
  syncMucusModalUI,
  closeModal,
  openActionModal,
  closeActionModal,
  saveModal,
  openMucusModal,
  closeMucusModal,
  saveMucusModal,
  openBleedingModal,
  closeBleedingModal,
  saveBleedingModal,
  openMarkersModal,
  closeMarkersModal,
  clearMarkersModalInput,
  saveMarkersModal,
  openCervixModal,
  closeCervixModal,
  saveCervixModal,
  openFertileRangeModal,
  closeFertileRangeModal,
  saveFertileRangeModal,
  clearFertileRangeModal,
  changeFertileRangeMonth,
  openProfileModal,
  closeProfileModal,
  saveProfileModal,
  openOtherModal,
  closeOtherModal,
  saveOtherModal,
  syncModalUI,
  syncMeasurementTimeUI,
  openDayInfoModal,
  closeDayInfoModal,
  showMessage,
} from "./ui.js";

/* ─── DOM helpers ─────────────────────────── */

export const qs  = id       => document.getElementById(id);
export const qsa = selector => document.querySelectorAll(selector);

function bindButton(id, handler) {
  const button = qs(id);
  if (button) button.onclick = handler;
}

function bindModalOverlayClicks(definitions) {
  definitions.forEach(([id, closeFn]) => {
    const modal = qs(id);
    if (!modal) return;
    modal.addEventListener("click", event => {
      if (event.target === modal) closeFn();
    });
  });
}

/* ─── layout constants ────────────────────── */

/** All canvas/grid dimensions in one place. Synced to CSS via syncCSSVariables(). */
export const LAYOUT = {
  columnWidth:        50,
  sideLabelWidth:     96,
  tempScaleWidth:     72,
  chartHeight:        840,
  chartPaddingTop:    12,
  chartPaddingBottom: 8,
  minTemp:            36.0,
  maxTemp:            37.4,
  tempStep:           0.05,
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

/** Influence factor options for temperature readings — dropdown source. */
export const TEMP_FACTORS = {
  alcohol:          "Alcohol",
  travel:           "Travel",
  stress:           "Stress",
  medication:       "Medication",
  illness:          "Illness",
  restlessSleep:    "Restless sleep",
  newThermometer:   "New thermometer",
  physicalActivity: "Physical activity",
  other:            "Other",
};

/* ─── measurement time adjustment ─────────── */

const TEMP_ADJUSTMENT_PER_HOUR = 0.1;

/** Converts "HH:MM" to minutes since midnight, or null if empty/invalid. */
function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Rule of thumb: body temperature drifts about 0.1°C per hour relative to
 * the usual measurement time — later readings run warm, earlier ones run cool.
 * Returns the signed adjustment in °C: measuring later than usual gives a
 * negative value (temp gets corrected down), earlier gives a positive one.
 */
export function getTimeAdjustment(actualTime, usualTime) {
  const actual = timeToMinutes(actualTime);
  const usual  = timeToMinutes(usualTime);
  if (actual == null || usual == null) return 0;

  const hoursDiff = (actual - usual) / 60; // positive = measured later than usual
  return Math.round(-hoursDiff * TEMP_ADJUSTMENT_PER_HOUR * 100) / 100;
}

/** Returns the temperature normalized back to the usual measurement time, or null if not applicable. */
export function getAdjustedTemp(temp, actualTime, usualTime) {
  if (temp == null) return null;
  const adjustment = getTimeAdjustment(actualTime, usualTime);
  if (adjustment === 0) return null;
  return Math.round((temp + adjustment) * 100) / 100;
}

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

/** Number of discrete temperature cells on the chart — one per 0.05°C step, both ends inclusive. */
export function tempSlotCount() {
  return Math.round((LAYOUT.maxTemp - LAYOUT.minTemp) / LAYOUT.tempStep) + 1;
}

/** Pixel height of a single temperature cell. */
export function tempSlotHeight() {
  return graphHeight() / tempSlotCount();
}

/** Y position of the boundary line above cell index (0 = chart top edge, tempSlotCount() = bottom edge). */
export function chartGridY(boundaryIndex) {
  return LAYOUT.chartPaddingTop + boundaryIndex * tempSlotHeight();
}

/**
 * Converts a temperature to a canvas y coordinate — snapped to the
 * vertical center of its 0.05°C cell. Grid lines, scale labels, and
 * plotted points all derive from this same function, so a point
 * always lands exactly in the middle of its cell.
 */
export function chartY(temp) {
  const slots         = tempSlotCount();
  const rawIndex      = Math.round((temp - LAYOUT.minTemp) / LAYOUT.tempStep);
  const index          = Math.min(Math.max(rawIndex, 0), slots - 1);
  const indexFromTop   = slots - 1 - index; // maxTemp sits at the top of the chart

  return chartGridY(indexFromTop) + tempSlotHeight() / 2;
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

export function getCycleCoverlineKey(cycleIndex = store.currentCycleIndex) {
  return cycleIndex == null ? "default" : `cycle-${cycleIndex}`;
}

/** Returns the coverline anchors for a cycle — a temperature and a day key, not pixels — so they stay accurate across zoom and cycle changes. */
export function getCycleCoverlineValues(cycleIndex = store.currentCycleIndex) {
  const key = getCycleCoverlineKey(cycleIndex);
  return store.coverlines?.[key] ?? {};
}

export function setCycleCoverlineValues(values, cycleIndex = store.currentCycleIndex) {
  const key = getCycleCoverlineKey(cycleIndex);
  if (!store.coverlines[key]) store.coverlines[key] = {};

  // only touch an axis if the caller actually passed it in —
  // otherwise setting one coverline would wipe out the other
  const data = store.coverlines[key];
  if ("horizontalTemp" in values) {
    if (values.horizontalTemp != null) data.horizontalTemp = values.horizontalTemp;
    else delete data.horizontalTemp;
  }

  if ("verticalKey" in values) {
    if (values.verticalKey != null) data.verticalKey = values.verticalKey;
    else delete data.verticalKey;
  }

  if (!Object.keys(data).length) delete store.coverlines[key];
}

/** Converts a click's y pixel back to the temperature of the cell it landed in — inverse of chartY(). */
export function chartLineY(temp) {
  const slots         = tempSlotCount();
  const rawIndex      = Math.round((temp - LAYOUT.minTemp) / LAYOUT.tempStep);
  const index         = Math.min(Math.max(rawIndex, 0), slots);
  const indexFromTop  = slots - index;
  return chartGridY(indexFromTop);
}

export function pixelYToTemp(y) {
  const slots       = tempSlotCount();
  const slotHeight  = tempSlotHeight();
  const relativeY   = y - LAYOUT.chartPaddingTop;
  const lineIndexFromTop = Math.min(Math.max(Math.round(relativeY / slotHeight), 0), slots);
  const tempIndex = slots - lineIndexFromTop;
  return LAYOUT.minTemp + tempIndex * LAYOUT.tempStep;
}

/** Finds the column whose center is closest to a click's x pixel. */
export function pixelXToColumnKey(x, columns) {
  if (!columns.length) return null;
  let closest = columns[0];
  let minDist = Math.abs(x - closest.centerX);
  columns.forEach(col => {
    const dist = Math.abs(x - col.centerX);
    if (dist < minDist) { minDist = dist; closest = col; }
  });
  return closest.key;
}

export function pixelToPointColumnHit(x, y, columns) {
  if (!columns.length) return null;
  const maxDistance = 18;
  let closest = null;
  let minDist = maxDistance;

  columns.forEach(col => {
    if (col.temp != null) {
      const tempY = chartY(col.temp);
      const dx = x - col.centerX;
      const dy = y - tempY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = { key: col.key, type: "temp" };
      }
    }

    if (col.adjustedTemp != null) {
      const adjY = chartY(col.adjustedTemp);
      const dx = x - col.centerX;
      const dy = y - adjY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        closest = { key: col.key, type: "adjusted" };
      }
    }
  });

  return closest;
}

/** Returns the currently active fertile range, or null if none is set. */
export function getFertileRange() {
  const { start, end } = store.fertileRange;
  return start && end ? { start, end } : null;
}

/** Replaces the active fertile range with a new start/end pair. */
export function setFertileRange(start, end) {
  store.fertileRange = { start, end };
}

/** Removes the active fertile range. */
export function clearFertileRange() {
  store.fertileRange = { start: null, end: null };
}

/** Returns true if the given day is manually flagged fertile or falls inside the fertile range. */
export function isFertileDay(key, entries = store.entries) {
  if (entries[key]?.isFertile === true) return true;

  const range = getFertileRange();
  if (!range) return false;

  const day = normalize(parseDateKey(key));
  return day >= normalize(parseDateKey(range.start)) && day <= normalize(parseDateKey(range.end));
}

/** Selects a day column, switches to the correct cycle, and triggers a full re-render. */
export function selectColumn(key, pointType = "temp") {
  store.selectedKey = key;
  store.selectedPointType = pointType;

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

  if (store.markerSelectionMode) {
    store.markerSelectionMode = false;
    qs("markersActionBtn")?.classList.remove("active");
    openMarkersModal();
  }
}

/** Highlights a column on hover — only redraws the chart layer. */
export function hoverColumn(key)  { store.hoveredKey = key; store.hoveredPointType = null; renderChart(currentColumns); }

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
  renderProfileInfo();
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
  renderTempFactorsOptions();
  renderActionButtons();

  const openAfterAction = (openFn, delay = 250) => {
    closeActionModal();
    setTimeout(openFn, delay);
  };

  const reopenActionAfter = (closeFn, delay = 250) => {
    closeFn();
    setTimeout(() => openActionModal(), delay);
  };

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
  const animatePrimaryButton = button => {
    if (!button) return;
    button.addEventListener("click", () => {
      button.classList.add("pulse-attention");
      button.addEventListener("animationend", () => button.classList.remove("pulse-attention"), { once: true });
    });
  };

  qsa(".btn.primary").forEach(animatePrimaryButton);

  bindButton("editBtn", () => openActionModal());
  bindButton("closeBtn", () => {
    closeModal();
    setTimeout(() => openActionModal(), 250);
  });
  animatePrimaryButton(qs("saveBtn"));
  bindButton("saveBtn", () => saveModal(render));
  bindButton("closeActionModalBtn", closeActionModal);

  [
    ["temperatureActionBtn", () => openAfterAction(() => openModal(currentColumns), 200)],
    ["bleedingActionBtn", () => openAfterAction(() => openBleedingModal())],
    ["mucusActionBtn", () => openAfterAction(() => openMucusModal())],
    ["cervixActionBtn", () => openAfterAction(() => openCervixModal())],
    ["fertileRangeActionBtn", () => openAfterAction(() => openFertileRangeModal())],
    ["profileActionBtn", () => openAfterAction(() => openProfileModal())],
    ["otherActionBtn", () => openAfterAction(() => openOtherModal())],
  ].forEach(([id, handler]) => bindButton(id, handler));

  bindButton("saveBleedingModalBtn", () => saveBleedingModal(render));
  bindButton("saveMucusModalBtn", () => saveMucusModal(render));

  bindButton("markersActionBtn", () => {
    closeActionModal();
    store.markerSelectionMode = true;
    qs("markersActionBtn").classList.add("active");
    setTimeout(() => showMessage("Click a day on the chart to choose a marker day."), 300);
  });

  bindButton("saveFertileRangeModalBtn", () => saveFertileRangeModal(render));
  bindButton("clearFertileRangeBtn", () => clearFertileRangeModal(render));
  bindButton("fertileRangePrevMonth", () => changeFertileRangeMonth(-1));
  bindButton("fertileRangeNextMonth", () => changeFertileRangeMonth(1));

  bindButton("saveProfileModalBtn", () => saveProfileModal(render));

  bindButton("clearMarkersModalBtn", () => clearMarkersModalInput());
  bindButton("saveMarkersModalBtn", () => saveMarkersModal(render));

  bindButton("saveCervixModalBtn", () => saveCervixModal(render));

  bindButton("saveOtherModalBtn", () => saveOtherModal(render));

  // back buttons — close current modal and reopen the main action menu
  [
    ["closeBleedingModalBtn", () => reopenActionAfter(() => closeBleedingModal())],
    ["closeMucusModalBtn", () => reopenActionAfter(() => closeMucusModal())],
    ["closeFertileRangeModalBtn", () => closeFertileRangeModal()],
    ["closeProfileModalBtn", () => closeProfileModal()],
    ["closeMarkersModalBtn", () => closeMarkersModal()],
    ["closeCervixModalBtn", () => reopenActionAfter(() => closeCervixModal())],
    ["closeOtherModalBtn", () => reopenActionAfter(() => closeOtherModal())],
  ].forEach(([id, handler]) => bindButton(id, handler));

  bindModalOverlayClicks([
    ["modal", closeModal],
    ["actionModal", closeActionModal],
    ["bleedingModal", closeBleedingModal],
    ["mucusModal", closeMucusModal],
    ["markersModal", closeMarkersModal],
    ["cervixModal", closeCervixModal],
    ["fertileRangeModal", closeFertileRangeModal],
    ["profileModal", closeProfileModal],
    ["otherModal", closeOtherModal],
    ["dayInfoModal", closeDayInfoModal],
  ]);

  // coverline tool menu
  const coverlineBtn = qs("coverlineBtn");
  const coverlineMenu = qs("coverlineMenu");

  const refreshCoverlineButton = () => {
    if (!coverlineBtn) return;
    const menuOpen = coverlineMenu && !coverlineMenu.classList.contains("hidden");
    const active = menuOpen || store.horizontalCoverlineMode || store.verticalCoverlineMode;
    coverlineBtn.classList.toggle("active", active);
    if (store.horizontalCoverlineMode) {
      coverlineBtn.innerText = "Horizontal coverline";
    } else if (store.verticalCoverlineMode) {
      coverlineBtn.innerText = "Vertical coverline";
    } else {
      coverlineBtn.innerText = "Coverline";
    }
  };

  if (coverlineBtn && coverlineMenu) {
    coverlineBtn.onclick = event => {
      event.stopPropagation();
      coverlineMenu.classList.toggle("hidden");
      refreshCoverlineButton();
    };

    qsa(".coverline-option").forEach(option => {
      option.onclick = () => {
        const mode = option.dataset.coverline;
        store.horizontalCoverlineMode = mode === "horizontal";
        store.verticalCoverlineMode = mode === "vertical";
        coverlineMenu.classList.add("hidden");
        refreshCoverlineButton();
      };
    });

    document.addEventListener("click", event => {
      if (!coverlineMenu.contains(event.target) && event.target !== coverlineBtn) {
        coverlineMenu.classList.add("hidden");
        refreshCoverlineButton();
      }
    });
  }
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

  const tempChart = qs("tempChart");
  if (tempChart) {
    tempChart.addEventListener("click", event => {
    if (store.horizontalCoverlineMode || store.verticalCoverlineMode) {
      handleCanvasClick(event);
      return;
    }

    const rect = tempChart.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = pixelToPointColumnHit(x, y, currentColumns);
    const key = hit?.key || pixelXToColumnKey(x, currentColumns);
    if (!key) return;

    selectColumn(key, hit?.type || "temp");
  });

    tempChart.addEventListener("mousemove", event => {
      const rect = tempChart.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = pixelToPointColumnHit(x, y, currentColumns);

      if (hit) {
        store.hoveredKey = hit.key;
        store.hoveredPointType = hit.type;
        renderChart(currentColumns);
        return;
      }

      if (store.hoveredKey) {
        store.hoveredKey = null;
        store.hoveredPointType = null;
        renderChart(currentColumns);
      }
    });

    tempChart.addEventListener("mouseleave", () => {
      if (store.hoveredKey) {
        store.hoveredKey = null;
        store.hoveredPointType = null;
        renderChart(currentColumns);
      }
    });
  }

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

  const mucusColorOtherCheckbox = qs("mucusColorOtherCheckbox");
  const mucusColorOtherInput = qs("mucusColorOtherInput");
  if (mucusColorOtherCheckbox) {
    mucusColorOtherCheckbox.onchange = () => {
      if (mucusColorOtherCheckbox.checked) {
        store.modal.color = "other";
        store.modal.colorOther = store.modal.colorOther ?? "";
      } else {
        store.modal.color = "";
        store.modal.colorOther = "";
      }
      syncMucusModalUI();
    };
  }

  if (mucusColorOtherInput) {
    mucusColorOtherInput.oninput = () => {
      store.modal.colorOther = mucusColorOtherInput.value;
    };
  }

  const measurementTimeCheckbox = qs("measurementTimeCheckbox");
  const measurementTimeInput = qs("measurementTimeInput");
  if (measurementTimeCheckbox) {
    measurementTimeCheckbox.onchange = () => {
      store.modal.measurementTimeEnabled = measurementTimeCheckbox.checked;
      if (!measurementTimeCheckbox.checked && measurementTimeInput) {
        measurementTimeInput.value = "";
      }
      syncMeasurementTimeUI();
    };
  }

  if (measurementTimeInput) {
    measurementTimeInput.oninput = () => {
      store.modal.measurementTime = measurementTimeInput.value;
      syncMeasurementTimeUI();
    };
  }
  
  // day info modal
  bindButton("dayInfoBtn", () => openDayInfoModal(currentColumns));
  bindButton("closeDayInfoModalBtn", closeDayInfoModal);
}

/* ─── boot ────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  init();
  render();
  renderZoomLabel();
});