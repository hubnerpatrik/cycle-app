import { store } from "../store.js";
import { clearCycleCoverlineValues } from "../domain.js";
import {
  getCoverlineDragTarget,
  handleCanvasClick,
  renderChart,
  updateCoverlineDrag,
} from "../chart.js";
import { chartY, pixelXToColumnKey, pixelYToChartCellTemp, qs } from "../core.js";

export function canvasPointerPosition(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const dpr = window.devicePixelRatio || 1;
  return {
    x: (event.clientX - rect.left) * (canvas.width / dpr / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / dpr / rect.height),
  };
}

export function pixelToPointColumnHit(x, y, columns) {
  let closest = null;
  let minimumDistance = 18;
  columns.forEach(column => {
    [[column.temp, "temp"], [column.adjustedTemp, "adjusted"]].forEach(([temp, type]) => {
      if (temp == null) return;
      const distance = Math.hypot(x - column.centerX, y - chartY(temp));
      if (distance < minimumDistance) {
        minimumDistance = distance;
        closest = { key: column.key, type };
      }
    });
  });
  return closest;
}

export function createChartInteractions({ getColumns, renderApp, selectColumn, showMessage }) {
  let activeDrag = null;
  let coverlineSelected = false;
  let suppressNextClick = false;
  let markerHintTimer = null;

  const renderCurrentChart = () => renderChart(getColumns(), { coverlineSelected });

  function persist() {
    try {
      store.save();
      return true;
    } catch {
      showMessage("Changes could not be saved. Please try again.");
      return false;
    }
  }

  function setCursor(canvas, target, dragging = false) {
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
    showMessage("", null);
    const current = qs("toast");
    if (!current) return null;
    const toast = current.cloneNode(false);
    toast.className = "toast persistent-toast";
    toast.textContent = text;
    current.replaceWith(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    return toast;
  }

  function setCrossCellButton(active) {
    const button = qs("crossCellsActionBtn");
    if (!button) return;
    button.classList.toggle("active", active);
    button.innerText = "Cross cells";
  }

  function setCoverlineButton(active) {
    const button = qs("coverlineBtn");
    if (!button) return;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  function cancelMarkerPlacement() {
    clearTimeout(markerHintTimer);
    markerHintTimer = null;
    store.markerSelectionMode = false;
    qs("markersActionBtn")?.classList.remove("active");
  }

  function clearModes() {
    coverlineSelected = false;
    store.horizontalCoverlineMode = false;
    store.verticalCoverlineMode = false;
    if (store.crossCellSelectionMode) store.cancelCrossCellSelection();
    cancelMarkerPlacement();
    setCrossCellButton(false);
    setCoverlineButton(false);
  }

  function showCrossCellPill() {
    const toast = showPersistentHint("");
    if (!toast) return;
    const label = document.createElement("span");
    const save = document.createElement("button");
    label.textContent = "Select cells directly in the temperature chart.";
    save.type = "button";
    save.className = "toast-action toast-action-primary";
    save.textContent = "Save";
    save.onclick = startOrSaveCrossCells;
    toast.replaceChildren(label, save);
    toast.classList.add("action-toast");
  }

  function showCoverlinePill() {
    const toast = showPersistentHint("");
    if (!toast) return;
    const label = document.createElement("span");
    const remove = document.createElement("button");
    label.textContent = "Drag to move";
    remove.type = "button";
    remove.className = "toast-action toast-action-danger";
    remove.textContent = "Delete";
    remove.onclick = deleteCoverline;
    toast.replaceChildren(label, remove);
    toast.classList.add("action-toast");
  }

  function deleteCoverline() {
    if (!coverlineSelected || !clearCycleCoverlineValues()) return;
    coverlineSelected = false;
    activeDrag = null;
    const canvas = qs("tempChart");
    if (canvas) setCursor(canvas, null);
    hideToolPill();
    if (!persist()) {
      renderApp();
      return;
    }
    renderApp();
    showMessage("Coverline deleted.");
  }

  function startOrSaveCrossCells() {
    if (store.crossCellSelectionMode) {
      try {
        store.commitCrossCellSelection();
      } catch {
        showMessage("Changes could not be saved. Please try again.");
        renderApp();
        return;
      }
      setCrossCellButton(false);
      hideToolPill();
      renderApp();
      showMessage("Crossed cells saved.");
      return;
    }
    clearModes();
    store.beginCrossCellSelection();
    setCrossCellButton(true);
    showCrossCellPill();
    renderApp();
  }

  function cancelCrossCells() {
    store.cancelCrossCellSelection();
    setCrossCellButton(false);
    hideToolPill();
    renderApp();
  }

  function bindToolButtons() {
    const markerButton = qs("markersActionBtn");
    markerButton.onclick = () => {
      if (store.markerSelectionMode) {
        cancelMarkerPlacement();
        hideToolPill();
        return;
      }
      clearModes();
      renderApp();
      store.markerSelectionMode = true;
      markerButton.classList.add("active");
      markerHintTimer = setTimeout(() => {
        if (store.markerSelectionMode) showPersistentHint("Click a day on the chart to choose a marker day.");
      }, 300);
    };

    qs("crossCellsActionBtn").onclick = () => {
      if (store.crossCellSelectionMode) cancelCrossCells();
      else startOrSaveCrossCells();
    };

    qs("coverlineBtn").onclick = () => {
      const active = !(store.horizontalCoverlineMode && store.verticalCoverlineMode);
      const hadOtherTool = store.crossCellSelectionMode || store.markerSelectionMode;
      const hadSelection = coverlineSelected;
      coverlineSelected = false;
      if (active && store.crossCellSelectionMode) {
        store.cancelCrossCellSelection();
        setCrossCellButton(false);
      }
      if (active && store.markerSelectionMode) cancelMarkerPlacement();
      if (active && hadOtherTool) renderApp();
      else if (hadSelection) renderCurrentChart();
      store.horizontalCoverlineMode = active;
      store.verticalCoverlineMode = active;
      setCoverlineButton(active);
      if (active) showPersistentHint("Click then drag lines");
      else hideToolPill();
    };
  }

  function bindCanvas() {
    const canvas = qs("tempChart");
    if (!canvas) return;
    canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0 || store.crossCellSelectionMode || store.markerSelectionMode
        || store.horizontalCoverlineMode || store.verticalCoverlineMode) return;
      const point = canvasPointerPosition(event, canvas);
      const target = point && getCoverlineDragTarget(point.x, point.y, getColumns());
      if (!point || !target) return;
      event.preventDefault();
      coverlineSelected = true;
      showCoverlinePill();
      renderCurrentChart();
      activeDrag = { pointerId: event.pointerId, target, startX: point.x, startY: point.y, moved: false };
      canvas.setPointerCapture?.(event.pointerId);
      setCursor(canvas, target, true);
    });

    canvas.addEventListener("pointermove", event => {
      const point = canvasPointerPosition(event, canvas);
      if (!point) return;
      if (activeDrag?.pointerId === event.pointerId) {
        event.preventDefault();
        if (Math.hypot(point.x - activeDrag.startX, point.y - activeDrag.startY) >= 3) activeDrag.moved = true;
        if (activeDrag.moved && updateCoverlineDrag(activeDrag.target, point.x, point.y, getColumns())) {
          renderCurrentChart();
        }
        return;
      }
      if (store.crossCellSelectionMode || store.horizontalCoverlineMode || store.verticalCoverlineMode) {
        setCursor(canvas, null);
        return;
      }
      setCursor(canvas, getCoverlineDragTarget(point.x, point.y, getColumns()));
    });

    const finishDrag = event => {
      if (activeDrag?.pointerId !== event.pointerId) return;
      const moved = activeDrag.moved;
      canvas.releasePointerCapture?.(event.pointerId);
      activeDrag = null;
      setCursor(canvas, null);
      if (event.type === "pointerup") {
        suppressNextClick = true;
        setTimeout(() => { suppressNextClick = false; }, 0);
      }
      if (!moved) return;
      persist();
      renderCurrentChart();
    };
    canvas.addEventListener("pointerup", finishDrag);
    canvas.addEventListener("pointercancel", finishDrag);

    canvas.addEventListener("click", event => {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      const point = canvasPointerPosition(event, canvas);
      if (!point) return;
      const columns = getColumns();
      if (coverlineSelected && !getCoverlineDragTarget(point.x, point.y, columns)) {
        coverlineSelected = false;
        hideToolPill();
        renderCurrentChart();
      }
      if (store.crossCellSelectionMode) {
        const key = pixelXToColumnKey(point.x, columns);
        const temp = pixelYToChartCellTemp(point.y);
        if (key && temp != null) {
          store.toggleCrossedCell(key, temp);
          renderApp();
        }
        return;
      }
      if (store.horizontalCoverlineMode || store.verticalCoverlineMode) {
        if (handleCanvasClick(point.x, point.y, columns)) {
          if (!persist()) renderApp();
          else {
            renderApp();
            hideToolPill();
          }
        }
        return;
      }
      const hit = pixelToPointColumnHit(point.x, point.y, columns);
      const key = hit?.key || pixelXToColumnKey(point.x, columns);
      if (key) selectColumn(key, hit?.type || "temp");
    });

    canvas.addEventListener("mousemove", event => {
      if (activeDrag) return;
      const point = canvasPointerPosition(event, canvas);
      if (!point) return;
      const hit = pixelToPointColumnHit(point.x, point.y, getColumns());
      const nextKey = hit?.key ?? null;
      if (store.hoveredKey !== nextKey) {
        store.hoveredKey = nextKey;
        renderCurrentChart();
      }
    });
    canvas.addEventListener("mouseleave", () => {
      if (!activeDrag) setCursor(canvas, null);
      if (store.hoveredKey) {
        store.hoveredKey = null;
        renderCurrentChart();
      }
    });
    document.addEventListener("click", event => {
      if (!coverlineSelected || event.target === canvas || event.target.closest?.("#toast")) return;
      coverlineSelected = false;
      hideToolPill();
      renderCurrentChart();
    });
  }

  return {
    init() {
      bindToolButtons();
      bindCanvas();
    },
    render: renderCurrentChart,
    finishMarkerPlacement() {
      cancelMarkerPlacement();
      hideToolPill();
    },
    deactivate() {
      const active = coverlineSelected || store.horizontalCoverlineMode || store.verticalCoverlineMode
        || store.crossCellSelectionMode || store.markerSelectionMode;
      clearModes();
      if (active) hideToolPill();
    },
  };
}
