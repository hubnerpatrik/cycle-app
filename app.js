// app.js — Cycle Tracker
// ─────────────────────────────────────────────
// Entry point. Owns top-level rendering, interaction state,
// and application initialization.
//
// Module map:
//   app.js      render, interaction state, init
//   core.js     constants, date/temperature/geometry utilities
//   store.js    Store class, localStorage persistence
//   domain.js   cycle detection, column building
//   chart.js    canvas rendering, coverline interaction
//   ui.js       calendar, info panel, map rows, modal
// ─────────────────────────────────────────────

"use strict";

import { store } from "./store.js";
import { buildCycleColumns, getCycleCount, getCycleStartDates } from "./domain.js";
import { renderChart, handleCanvasClick, chartCellFromPoint } from "./chart.js";
import { createRouter } from "./router.js";

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
  openOtherModal,
  closeOtherModal,
  saveOtherModal,
  syncModalUI,
  syncMeasurementTimeUI,
  openDayInfoModal,
  closeDayInfoModal,
  showMessage,
} from "./ui.js";

/* ─── shared constants and utilities ───────── */

import {
  LAYOUT, qs, qsa, normalize, parseDateKey, chartY, pixelXToColumnKey,
  syncCSSVariables,
} from "./core.js";

const ZOOM_MIN = 24;
const ZOOM_MAX = 90;
const ZOOM_STEP = 8;
const ZOOM_BASE = 50;

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

/* ─── runtime state ───────────────────────── */

/** Columns built from store.entries each render cycle. Shared across modules. */
export let currentColumns = [];
let activeMapInitialized = false;
let router = null;

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

function setCrossCellsModal(confirming = false) {
  qs("crossCellsModal").classList.remove("hidden");
  requestAnimationFrame(() => qs("crossCellsModal").classList.add("show"));
  qs("crossCellsModal").querySelector("h2").innerText = confirming ? "Confirm crossed cells" : "Cross out cells";
  qs("crossCellsModal").querySelector("p").innerText = confirming
    ? "Save the selected cells, or cancel to discard your changes."
    : "Select the cells in the temperature chart that you want to cross out, then confirm your selection.";
  qs("startCrossCellsBtn").innerText = confirming ? "Save selection" : "Select cells";
}

function openCrossCellsModal() {
  setCrossCellsModal(store.crossCellSelectionMode === true);
}

function hideCrossCellsModal() {
  qs("crossCellsModal")?.classList.remove("show");
  qs("crossCellsModal")?.classList.add("hidden");
}

function startOrSaveCrossCellSelection() {
  if (store.crossCellSelectionMode) {
    store.commitCrossCellSelection();
    qs("crossCellsActionBtn").classList.remove("active");
    qs("crossCellsActionBtn").innerText = "Cross cells";
    qs("tempChart")?.closest(".map-chart-area")?.classList.remove("cross-cell-selectable");
    hideCrossCellsModal();
    render();
    showMessage("Crossed cells saved.");
    return;
  }

  store.beginCrossCellSelection();
  qs("crossCellsActionBtn").classList.add("active");
  qs("crossCellsActionBtn").innerText = "Confirm crosses";
  qs("tempChart")?.closest(".map-chart-area")?.classList.add("cross-cell-selectable");
  hideCrossCellsModal();
  showMessage("Select cells in the temperature chart, then click Confirm crosses.");
  render();
}

function cancelCrossCellSelection() {
  store.cancelCrossCellSelection();
  qs("crossCellsActionBtn")?.classList.remove("active");
  if (qs("crossCellsActionBtn")) qs("crossCellsActionBtn").innerText = "Cross cells";
  qs("tempChart")?.closest(".map-chart-area")?.classList.remove("cross-cell-selectable");
  hideCrossCellsModal();
  render();
}

function toggleCrossedCell(key, rowIndex) {
  store.toggleCrossedCell(key, rowIndex);
  render();
}

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
  renderActiveMapMeta();
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

function renderActiveMapMeta() {
  const activeMap = store.getActiveMap();
  const name = qs("activeMapName");
  const pill = qs("activeMapStatusPill");
  const saveButton = qs("saveActiveMapBtn");
  if (!name || !pill || !saveButton) return;

  if (!activeMap) {
    name.innerText = "No active map";
    pill.classList.add("hidden");
    saveButton.disabled = true;
    return;
  }

  name.innerText = activeMap.name || "Untitled map";
  pill.innerText = activeMap.status === "closed" ? "Closed" : "Open";
  pill.classList.remove("hidden", "map-pill-closed");
  if (activeMap.status === "closed") pill.classList.add("map-pill-closed");
  saveButton.disabled = activeMap.status === "closed";
}

/* ─── init ────────────────────────────────── */

/** Binds all event listeners. Called once on DOMContentLoaded. */
function initActiveMap() {
  if (activeMapInitialized) return;

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

  bindButton("crossCellsActionBtn", openCrossCellsModal);
  bindButton("cancelCrossCellsBtn", cancelCrossCellSelection);
  bindButton("startCrossCellsBtn", startOrSaveCrossCellSelection);

  bindButton("saveFertileRangeModalBtn", () => saveFertileRangeModal(render));
  bindButton("clearFertileRangeBtn", () => clearFertileRangeModal(render));
  bindButton("fertileRangePrevMonth", () => changeFertileRangeMonth(-1));
  bindButton("fertileRangeNextMonth", () => changeFertileRangeMonth(1));

  bindButton("clearMarkersModalBtn", () => clearMarkersModalInput());
  bindButton("saveMarkersModalBtn", () => saveMarkersModal(render));

  bindButton("saveCervixModalBtn", () => saveCervixModal(render));

  bindButton("saveOtherModalBtn", () => saveOtherModal(render));

  // back buttons — close current modal and reopen the main action menu
  [
    ["closeBleedingModalBtn", () => reopenActionAfter(() => closeBleedingModal())],
    ["closeMucusModalBtn", () => reopenActionAfter(() => closeMucusModal())],
    ["closeFertileRangeModalBtn", () => closeFertileRangeModal()],
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
    ["crossCellsModal", cancelCrossCellSelection],
    ["cervixModal", closeCervixModal],
    ["fertileRangeModal", closeFertileRangeModal],
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
    router?.start();
  };

  bindButton("saveActiveMapBtn", () => {
    const activeMap = store.getActiveMap();
    if (!activeMap) return;
    if (!confirm(`Save and close \"${activeMap.name || "Untitled map"}\"?`)) return;

    const closedMap = store.closeActiveMap();
    if (!closedMap) return;
    hideAllModals();
    showMessage("Map saved and closed ✓");
    router?.navigate("my-maps");
  });

  const tempChart = qs("tempChart");
  if (tempChart) {
    tempChart.addEventListener("click", event => {
    if (store.horizontalCoverlineMode || store.verticalCoverlineMode) {
      handleCanvasClick(event, currentColumns, render);
      return;
    }

    const rect = tempChart.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (store.crossCellSelectionMode) {
      const cell = chartCellFromPoint(x, y, currentColumns);
      if (cell) toggleCrossedCell(cell.key, cell.rowIndex);
      return;
    }
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

  activeMapInitialized = true;
}

function hideAllModals() {
  [
    "modal",
    "actionModal",
    "bleedingModal",
    "mucusModal",
    "markersModal",
    "crossCellsModal",
    "cervixModal",
    "fertileRangeModal",
    "otherModal",
    "dayInfoModal",
  ].forEach(id => {
    const modal = qs(id);
    if (!modal) return;
    modal.classList.remove("show");
    modal.classList.add("hidden");
  });
}

function focusActiveMap() {
  const keys = Object.keys(store.entries).sort();
  if (!keys.length) {
    const now = new Date();
    store.month = now.getMonth();
    store.year = now.getFullYear();
    store.currentCycleIndex = null;
    return;
  }

  const latest = parseDateKey(keys[keys.length - 1]);
  store.month = latest.getMonth();
  store.year = latest.getFullYear();

  const starts = getCycleStartDates();
  store.currentCycleIndex = starts.length ? starts.length - 1 : null;
}

function showStandaloneScreen() {
  hideAllModals();
  qs("screenRoot")?.classList.remove("hidden");
  qs("activeMapScreen")?.classList.add("hidden");
}

function openActiveMapScreen(mapId = store.getActiveMapId()) {
  if (mapId) {
    store.setActiveMapId(mapId);
  }

  initActiveMap();
  hideAllModals();
  focusActiveMap();
  qs("screenRoot")?.classList.add("hidden");
  qs("activeMapScreen")?.classList.remove("hidden");
  render();
  renderZoomLabel();
}

/* ─── boot ────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  router = createRouter({
    root: qs("screenRoot"),
    showStandaloneScreen,
    openActiveMap: openActiveMapScreen,
    showMessage,
  });

  bindButton("navMenuBtn", () => router?.navigate("menu"));
  bindButton("navProfileBtn", () => router?.navigate("my-profile"));
  bindButton("navMapsBtn", () => router?.navigate("my-maps"));
  bindButton("navCreateMapBtn", () => router?.navigate("create-map"));
  bindButton("navActiveMapBtn", () => router?.navigate("active-map"));
  router.start();
});
