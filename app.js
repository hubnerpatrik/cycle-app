// app.js — Cycle Tracker
// ─────────────────────────────────────────────
// Entry point. Owns top-level rendering, interaction state,
// and application initialization.
//
// Module map:
//   app.js      render, interaction state, init
//   core.js     constants, date/temperature/geometry utilities
//   store.js    Store class and persistence coordination
//   domain.js   cycle detection, column building
//   chart.js    canvas rendering, coverline interaction
//   ui.js       calendar, info panel, map rows, modal
// ─────────────────────────────────────────────

"use strict";

import { store } from "./store.js";
import { buildColumns, clearCycleCoverlineValues } from "./domain.js";
import {
  renderChart,
  handleCanvasClick,
  getCoverlineDragTarget,
  updateCoverlineDrag,
} from "./chart.js";
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
  selectMarkerType,
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
  LAYOUT, qs, qsa, getCalendarFocusDate, chartY, pixelXToColumnKey, pixelYToChartCellTemp,
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
let activeCoverlineDrag = null;
let coverlineSelected = false;
let suppressNextChartClick = false;
let markerHintTimer = null;

function setCoverlineCursor(canvas, target, dragging = false) {
  canvas.classList.remove(
    "coverline-drag-horizontal",
    "coverline-drag-vertical",
    "coverline-drag-both",
    "coverline-dragging",
  );
  if (target) canvas.classList.add(`coverline-drag-${target}`);
  if (dragging) canvas.classList.add("coverline-dragging");
}

function hideToolPill() {
  qs("toast")?.classList.remove("action-toast");
  showMessage("", 0);
}

function showPersistentHint(text) {
  // Cancel the timer of any earlier transient message. Older cached versions
  // may still schedule a hide here, so the node replacement below isolates it.
  showMessage("", null);
  const currentToast = qs("toast");
  if (!currentToast) return null;

  // Replace the node so any timer attached to an earlier transient message
  // can only affect the detached old node, never this persistent hint.
  const toast = currentToast.cloneNode(false);
  toast.className = "toast persistent-toast";
  toast.textContent = text;
  currentToast.replaceWith(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  return toast;
}

function showCrossCellsPill() {
  const toast = showPersistentHint("");
  if (!toast) return;

  const label = document.createElement("span");
  label.textContent = "Select cells directly in the temperature chart.";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "toast-action toast-action-primary";
  saveButton.textContent = "Save";
  saveButton.onclick = startOrSaveCrossCellSelection;

  toast.replaceChildren(label, saveButton);
  toast.classList.add("action-toast");
}

function deleteSelectedCoverline() {
  if (!coverlineSelected || !clearCycleCoverlineValues()) return;
  coverlineSelected = false;
  activeCoverlineDrag = null;
  const canvas = qs("tempChart");
  if (canvas) setCoverlineCursor(canvas, null);
  hideToolPill();
  store.save();
  render();
  showMessage("Coverline deleted.");
}

function showCoverlineSelectionPill() {
  const toast = showPersistentHint("");
  if (!toast) return;

  const label = document.createElement("span");
  label.textContent = "Drag to move";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "toast-action toast-action-danger";
  deleteButton.textContent = "Delete";
  deleteButton.onclick = deleteSelectedCoverline;

  toast.replaceChildren(label, deleteButton);
  toast.classList.add("action-toast");
}

function renderCurrentChart() {
  renderChart(currentColumns, { coverlineSelected });
}

function cancelMarkerPlacement() {
  clearTimeout(markerHintTimer);
  markerHintTimer = null;
  store.markerSelectionMode = false;
  qs("markersActionBtn")?.classList.remove("active");
}

function setCrossCellButtonActive(active) {
  const button = qs("crossCellsActionBtn");
  if (!button) return;
  button.classList.toggle("active", active);
  button.innerText = "Cross cells";
}

function setCoverlineButtonActive(active) {
  const button = qs("coverlineBtn");
  if (!button) return;
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
}

function clearChartInteractionModes() {
  coverlineSelected = false;
  store.horizontalCoverlineMode = false;
  store.verticalCoverlineMode = false;
  if (store.crossCellSelectionMode) store.cancelCrossCellSelection();
  cancelMarkerPlacement();
  setCrossCellButtonActive(false);
  setCoverlineButtonActive(false);
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

/** Converts pointer coordinates from the displayed canvas to its logical chart coordinates. */
export function canvasPointerPosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const dpr = window.devicePixelRatio || 1;
  return {
    x: (event.clientX - rect.left) * (canvas.width / dpr / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / dpr / rect.height),
  };
}

/** Selects a day column and triggers a full re-render. */
export function selectColumn(key, pointType = "temp") {
  store.selectedKey = key;
  store.selectedPointType = pointType;

  render();

  if (store.markerSelectionMode) {
    cancelMarkerPlacement();
    hideToolPill();
    openMarkersModal();
  }
}

/** Highlights a column on hover — only redraws the chart layer. */
export function hoverColumn(key)  { store.hoveredKey = key; store.hoveredPointType = null; renderCurrentChart(); }

/** Clears hover state and redraws the chart layer. */
export function clearHover()      { store.hoveredKey = null; renderCurrentChart(); }

function startOrSaveCrossCellSelection() {
  if (store.crossCellSelectionMode) {
    store.commitCrossCellSelection();
    setCrossCellButtonActive(false);
    hideToolPill();
    render();
    showMessage("Crossed cells saved.");
    return;
  }

  clearChartInteractionModes();
  store.beginCrossCellSelection();
  setCrossCellButtonActive(true);
  showCrossCellsPill();
  render();
}

function cancelCrossCellSelection() {
  store.cancelCrossCellSelection();
  setCrossCellButtonActive(false);
  hideToolPill();
  render();
}

function toggleCrossedCell(key, temp) {
  store.toggleCrossedCell(key, temp);
  render();
}

/* ─── render ──────────────────────────────── */

/** Full re-render — rebuilds columns from store and updates all UI layers. */
export function render() {
  renderMonth();
  renderCalendar(selectColumn);
  renderTempScale();
  currentColumns = buildColumns();
  renderMapRows(currentColumns, selectColumn, hoverColumn, clearHover);
  renderCurrentChart();
  renderProfileInfo();
  renderActiveMapMeta();
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
    if (store.markerSelectionMode) {
      cancelMarkerPlacement();
      hideToolPill();
      return;
    }

    closeActionModal();
    clearChartInteractionModes();
    render();
    store.markerSelectionMode = true;
    qs("markersActionBtn").classList.add("active");
    markerHintTimer = setTimeout(() => {
      if (store.markerSelectionMode) {
        showPersistentHint("Click a day on the chart to choose a marker day.");
      }
    }, 300);
  });

  bindButton("crossCellsActionBtn", () => {
    if (store.crossCellSelectionMode) {
      cancelCrossCellSelection();
      return;
    }
    startOrSaveCrossCellSelection();
  });

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
    ["cervixModal", closeCervixModal],
    ["fertileRangeModal", closeFertileRangeModal],
    ["otherModal", closeOtherModal],
    ["dayInfoModal", closeDayInfoModal],
  ]);

  // coverline placement tool
  const coverlineBtn = qs("coverlineBtn");
  if (coverlineBtn) {
    coverlineBtn.onclick = () => {
      const active = !(store.horizontalCoverlineMode && store.verticalCoverlineMode);
      const otherToolActive = store.crossCellSelectionMode || store.markerSelectionMode;
      const selectionWasActive = coverlineSelected;
      coverlineSelected = false;
      if (active && store.crossCellSelectionMode) {
        store.cancelCrossCellSelection();
        setCrossCellButtonActive(false);
      }
      if (active && store.markerSelectionMode) cancelMarkerPlacement();
      if (active && otherToolActive) render();
      else if (selectionWasActive) renderCurrentChart();
      store.horizontalCoverlineMode = active;
      store.verticalCoverlineMode = active;
      setCoverlineButtonActive(active);
      if (active) {
        showPersistentHint("Click then drag lines");
      } else {
        hideToolPill();
      }
    };
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
    tempChart.addEventListener("pointerdown", event => {
      if (event.button !== 0
        || store.crossCellSelectionMode
        || store.markerSelectionMode
        || store.horizontalCoverlineMode
        || store.verticalCoverlineMode) return;
      const pointer = canvasPointerPosition(event, tempChart);
      if (!pointer) return;

      const target = getCoverlineDragTarget(pointer.x, pointer.y, currentColumns);
      if (!target) return;

      event.preventDefault();
      coverlineSelected = true;
      showCoverlineSelectionPill();
      renderCurrentChart();
      activeCoverlineDrag = {
        pointerId: event.pointerId,
        target,
        startX: pointer.x,
        startY: pointer.y,
        moved: false,
      };
      tempChart.setPointerCapture?.(event.pointerId);
      setCoverlineCursor(tempChart, target, true);
    });

    tempChart.addEventListener("pointermove", event => {
      const pointer = canvasPointerPosition(event, tempChart);
      if (!pointer) return;

      if (activeCoverlineDrag?.pointerId === event.pointerId) {
        event.preventDefault();
        const distance = Math.hypot(
          pointer.x - activeCoverlineDrag.startX,
          pointer.y - activeCoverlineDrag.startY,
        );
        if (distance >= 3) activeCoverlineDrag.moved = true;
        if (activeCoverlineDrag.moved
          && updateCoverlineDrag(activeCoverlineDrag.target, pointer.x, pointer.y, currentColumns)) {
          renderCurrentChart();
        }
        return;
      }

      if (store.crossCellSelectionMode || store.horizontalCoverlineMode || store.verticalCoverlineMode) {
        setCoverlineCursor(tempChart, null);
        return;
      }
      setCoverlineCursor(
        tempChart,
        getCoverlineDragTarget(pointer.x, pointer.y, currentColumns),
      );
    });

    const finishCoverlineDrag = event => {
      if (activeCoverlineDrag?.pointerId !== event.pointerId) return;
      const moved = activeCoverlineDrag.moved;
      tempChart.releasePointerCapture?.(event.pointerId);
      activeCoverlineDrag = null;
      setCoverlineCursor(tempChart, null);
      if (event.type === "pointerup") {
        suppressNextChartClick = true;
        setTimeout(() => { suppressNextChartClick = false; }, 0);
      }
      if (!moved) return;
      store.save();
      renderCurrentChart();
    };

    tempChart.addEventListener("pointerup", finishCoverlineDrag);
    tempChart.addEventListener("pointercancel", finishCoverlineDrag);

    tempChart.addEventListener("click", event => {
      if (suppressNextChartClick) {
        suppressNextChartClick = false;
        return;
      }
      const pointer = canvasPointerPosition(event, tempChart);
      if (!pointer) return;
      const { x, y } = pointer;

      if (coverlineSelected && !getCoverlineDragTarget(x, y, currentColumns)) {
        coverlineSelected = false;
        hideToolPill();
        renderCurrentChart();
      }

      if (store.crossCellSelectionMode) {
        const key = pixelXToColumnKey(x, currentColumns);
        const temp = pixelYToChartCellTemp(y);
        if (key && temp != null) toggleCrossedCell(key, temp);
        return;
      }

      if (store.horizontalCoverlineMode || store.verticalCoverlineMode) {
        if (handleCanvasClick(event, currentColumns, render)) hideToolPill();
        return;
      }

      const hit = pixelToPointColumnHit(x, y, currentColumns);
      const key = hit?.key || pixelXToColumnKey(x, currentColumns);
      if (!key) return;

      selectColumn(key, hit?.type || "temp");
    });

    tempChart.addEventListener("mousemove", event => {
      if (activeCoverlineDrag) return;
      const pointer = canvasPointerPosition(event, tempChart);
      if (!pointer) return;
      const { x, y } = pointer;
      const hit = pixelToPointColumnHit(x, y, currentColumns);

      if (hit) {
        store.hoveredKey = hit.key;
        store.hoveredPointType = hit.type;
        renderCurrentChart();
        return;
      }

      if (store.hoveredKey) {
        store.hoveredKey = null;
        store.hoveredPointType = null;
        renderCurrentChart();
      }
    });

    tempChart.addEventListener("mouseleave", () => {
      if (!activeCoverlineDrag) setCoverlineCursor(tempChart, null);
      if (store.hoveredKey) {
        store.hoveredKey = null;
        store.hoveredPointType = null;
        renderCurrentChart();
      }
    });

    document.addEventListener("click", event => {
      if (!coverlineSelected) return;
      if (event.target === tempChart || event.target.closest?.("#toast")) return;
      coverlineSelected = false;
      hideToolPill();
      renderCurrentChart();
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
      if (btn.dataset.group === "markerColor") {
        selectMarkerType(value);
        return;
      }
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
  const focusDate = getCalendarFocusDate(store.entries);
  store.month = focusDate.getMonth();
  store.year = focusDate.getFullYear();
}

function showStandaloneScreen() {
  const coverlineModeActive = store.horizontalCoverlineMode || store.verticalCoverlineMode;
  const crossCellModeActive = store.crossCellSelectionMode;
  const markerModeActive = store.markerSelectionMode;
  const coverlineSelectionActive = coverlineSelected;
  clearChartInteractionModes();
  if (coverlineModeActive || coverlineSelectionActive || crossCellModeActive || markerModeActive) hideToolPill();
  hideAllModals();
  qs("screenRoot")?.classList.remove("hidden");
  qs("activeMapScreen")?.classList.add("hidden");
}

function openActiveMapScreen(mapId = store.getActiveMapId()) {
  if (mapId) {
    store.setActiveMapId(mapId);
  }

  initActiveMap();
  coverlineSelected = false;
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
