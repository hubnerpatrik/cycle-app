// Application bootstrap and top-level active-map rendering.

import { store } from "./store.js";
import { buildColumns } from "./domain.js";
import { createRouter } from "./router.js";
import { createChartInteractions } from "./active-map/chart-interactions.js";
import { initializeActiveMapControls } from "./active-map/bindings.js";
import {
  openMarkersModal,
  renderCalendar,
  renderMapRows,
  renderMonth,
  renderProfileInfo,
  renderTempScale,
  showMessage,
} from "./ui.js";
import { LAYOUT, getCalendarFocusDate, qs } from "./core.js";

const ZOOM_BASE = 50;
const MODAL_IDS = [
  "modal",
  "actionModal",
  "bleedingModal",
  "mucusModal",
  "markersModal",
  "cervixModal",
  "fertileRangeModal",
  "otherModal",
  "dayInfoModal",
];

export let currentColumns = [];
let router = null;

export function selectColumn(key, pointType = "temp") {
  store.selectedKey = key;
  store.selectedPointType = pointType;
  render();
  if (store.markerSelectionMode) {
    chartInteractions.finishMarkerPlacement();
    openMarkersModal();
  }
}

export function hoverColumn(key) {
  store.hoveredKey = key;
  chartInteractions.render();
}

export function clearHover() {
  store.hoveredKey = null;
  chartInteractions.render();
}

const chartInteractions = createChartInteractions({
  getColumns: () => currentColumns,
  renderApp: () => render(),
  selectColumn,
  showMessage,
});

function renderActiveMapMeta() {
  const activeMap = store.getActiveMap();
  const name = qs("activeMapName");
  const status = qs("activeMapStatusPill");
  const save = qs("saveActiveMapBtn");
  if (!name || !status || !save) return;
  if (!activeMap) {
    name.innerText = "No active map";
    status.classList.add("hidden");
    save.disabled = true;
    return;
  }
  name.innerText = activeMap.name || "Untitled map";
  status.innerText = activeMap.status === "closed" ? "Closed" : "Open";
  status.classList.remove("hidden", "map-pill-closed");
  status.classList.toggle("map-pill-closed", activeMap.status === "closed");
  save.disabled = activeMap.status === "closed";
}

export function render() {
  renderMonth();
  renderCalendar(selectColumn);
  renderTempScale();
  currentColumns = buildColumns();
  renderMapRows(currentColumns, selectColumn, hoverColumn, clearHover);
  chartInteractions.render();
  renderProfileInfo();
  renderActiveMapMeta();
}

function renderZoomLabel() {
  qs("zoomLabel").innerText = `${Math.round((LAYOUT.columnWidth / ZOOM_BASE) * 100)}%`;
}

function hideAllModals() {
  MODAL_IDS.forEach(id => {
    const modal = qs(id);
    modal?.classList.remove("show");
    modal?.classList.add("hidden");
  });
}

function showStandaloneScreen() {
  chartInteractions.deactivate();
  hideAllModals();
  qs("screenRoot")?.classList.remove("hidden");
  qs("activeMapScreen")?.classList.add("hidden");
}

function openActiveMapScreen() {
  initializeActiveMapControls({
    chartInteractions,
    getColumns: () => currentColumns,
    navigate: screen => router?.navigate(screen),
    render,
    renderZoomLabel,
    restart: () => router?.start(),
  });
  chartInteractions.deactivate();
  hideAllModals();
  const focusDate = getCalendarFocusDate(store.entries);
  store.month = focusDate.getMonth();
  store.year = focusDate.getFullYear();
  qs("screenRoot")?.classList.add("hidden");
  qs("activeMapScreen")?.classList.remove("hidden");
  render();
  renderZoomLabel();
}

function bindNavigation() {
  [
    ["navMenuBtn", "menu"],
    ["navProfileBtn", "my-profile"],
    ["navMapsBtn", "my-maps"],
    ["navCreateMapBtn", "create-map"],
    ["navActiveMapBtn", "active-map"],
  ].forEach(([id, screen]) => {
    const button = qs(id);
    if (button) button.onclick = () => router?.navigate(screen);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  router = createRouter({
    root: qs("screenRoot"),
    showStandaloneScreen,
    openActiveMap: openActiveMapScreen,
    showMessage,
  });
  bindNavigation();
  router.start();
});
