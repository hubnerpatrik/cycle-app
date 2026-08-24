import { normalizeDayMarkers, store } from "../store.js";
import { TEMPERATURE_RANGE, getTimeAdjustment, qs, qsa } from "../core.js";
import { markerColorFromType, markerTypeFromColor, normalizeMarkerColor } from "./marker-utils.js";
import {
  afterModalSave,
  hideModal,
  persistStore,
  resetModalState,
  showModal,
  syncModalUI,
  updateSelectedEntry,
} from "./modal-shared.js";
import { showMessage } from "./toast.js";

export function returnsToActionMenuAfterSave(modalId) {
  return modalId !== "markersModal";
}

function finishSave(modalId, render) {
  if (!persistStore()) return false;
  showMessage("Saved ✓");
  hideModal(modalId);
  const reopen = returnsToActionMenuAfterSave(modalId) ? openActionModal : null;
  afterModalSave(modalId, render, reopen);
  return true;
}

export function openActionModal() {
  showModal("actionModal");
}

export function closeActionModal() {
  hideModal("actionModal");
}

export function openModal(currentColumns) {
  if (!store.selectedKey) return showMessage("Select a day first");
  resetModalState();
  const key = store.selectedKey;
  const data = store.entries[key] || {};
  const column = currentColumns.find(item => item.key === key);
  Object.assign(store.modal, {
    temp: data.temp ?? null,
    tempFactors: data.tempFactors ?? "",
    measurementTime: data.measurementTime ?? "",
    measurementTimeEnabled: Boolean(data.measurementTime),
  });
  qs("modalTitle").innerText = `${key} (CD ${column?.cycleDay ?? "-"})`;
  qs("tempInput").value = store.modal.temp == null ? "" : Number(store.modal.temp).toFixed(2);
  qs("tempFactorsInput").value = store.modal.tempFactors;
  qs("measurementTimeInput").value = store.modal.measurementTime;
  syncMeasurementTimeUI();
  showModal("modal");
}

export function closeModal() {
  hideModal("modal");
}

export function validateTempInput() {
  const raw = qs("tempInput")?.value.trim().replace(",", ".");
  if (!raw) return true;
  const value = Number(raw);
  return Number.isFinite(value) && value >= TEMPERATURE_RANGE.min && value <= TEMPERATURE_RANGE.max;
}

export function saveModal(render) {
  if (!store.selectedKey) return showMessage("Select a day first");
  if (!validateTempInput()) {
    return showMessage(`Temperature must be between ${TEMPERATURE_RANGE.min}–${TEMPERATURE_RANGE.max} °C`);
  }
  const raw = qs("tempInput").value.trim().replace(",", ".");
  updateSelectedEntry({
    temp: raw ? Number(raw) : null,
    tempFactors: qs("tempFactorsInput").value,
    measurementTime: store.modal.measurementTimeEnabled ? qs("measurementTimeInput").value : "",
  });
  finishSave("modal", render);
}

export function syncMeasurementTimeUI() {
  const enabled = Boolean(store.modal.measurementTimeEnabled);
  const checkbox = qs("measurementTimeCheckbox");
  const wrapper = qs("measurementTimeWrapper");
  if (checkbox) checkbox.checked = enabled;
  wrapper?.classList.toggle("hidden", !enabled);
  const adjustment = enabled
    ? getTimeAdjustment(store.modal.measurementTime, store.getActiveMapProfile().usualMeasurementTime)
    : 0;
  const hint = qs("timeAdjustmentHint");
  if (hint) {
    hint.innerText = adjustment
      ? `≈ ${adjustment > 0 ? "+" : ""}${adjustment.toFixed(2)} °C vs usual time`
      : "";
  }
}

export function syncMucusModalUI() {
  const otherCheckbox = qs("mucusColorOtherCheckbox");
  const otherInput = qs("mucusColorOtherInput");
  const isOther = store.modal.color === "other" || Boolean(store.modal.colorOther?.trim());
  if (otherCheckbox) otherCheckbox.checked = isOther;
  qsa('.segmented button[data-group="color"]').forEach(button => {
    button.disabled = isOther;
    button.classList.toggle("disabled", isOther);
  });
  if (otherInput) {
    otherInput.classList.toggle("hidden", !isOther);
    otherInput.value = store.modal.colorOther ?? "";
  }
  syncModalUI();
}

export function openMucusModal() {
  if (!store.selectedKey) return showMessage("Select a day first");
  resetModalState();
  const data = store.entries[store.selectedKey] || {};
  Object.assign(store.modal, {
    sensation: data.sensation ?? "",
    stretch: data.stretch === true,
    visible: data.visible === true,
    consistency: data.consistency ?? "",
    color: data.color ?? "",
    colorOther: data.colorOther ?? "",
    isPeak: data.isPeak === true,
  });
  showModal("mucusModal");
  syncMucusModalUI();
}

export function closeMucusModal() {
  hideModal("mucusModal");
}

export function saveMucusModal(render) {
  if (!store.selectedKey) return;
  updateSelectedEntry({
    sensation: store.modal.sensation,
    stretch: store.modal.stretch,
    visible: store.modal.visible,
    consistency: store.modal.consistency,
    color: store.modal.color,
    colorOther: store.modal.colorOther,
    isPeak: store.modal.isPeak,
  });
  finishSave("mucusModal", render);
}

export function openBleedingModal() {
  if (!store.selectedKey) return showMessage("Select a day first");
  resetModalState();
  const data = store.entries[store.selectedKey] || {};
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
  updateSelectedEntry({ bleeding: store.modal.bleeding, sediment: store.modal.sediment });
  finishSave("bleedingModal", render);
}

export function openCervixModal() {
  if (!store.selectedKey) return showMessage("Select a day first");
  resetModalState();
  const data = store.entries[store.selectedKey] || {};
  Object.assign(store.modal, {
    cervixFirmness: data.cervixFirmness ?? "",
    cervixHeight: data.cervixHeight ?? "",
    cervixOpenness: data.cervixOpenness ?? "",
  });
  showModal("cervixModal");
  syncModalUI();
}

export function closeCervixModal() {
  hideModal("cervixModal");
}

export function saveCervixModal(render) {
  if (!store.selectedKey) return;
  updateSelectedEntry({
    cervixFirmness: store.modal.cervixFirmness,
    cervixHeight: store.modal.cervixHeight,
    cervixOpenness: store.modal.cervixOpenness,
  });
  finishSave("cervixModal", render);
}

function saveVisibleMarkerDraft() {
  const type = markerTypeFromColor(store.modal.markerColor);
  const value = qs("markersMarker")?.value || "";
  store.modal.markers[type] = {
    value,
    pointType: type === "bbt"
      ? (store.modal.markerPointType || store.selectedPointType || "temp")
      : "temp",
  };
  store.modal.marker = value;
}

export function markerHeadingFromColor(color) {
  const type = markerTypeFromColor(normalizeMarkerColor(color));
  return `${type === "bbt" ? "BBT" : type[0].toUpperCase() + type.slice(1)} Marker`;
}

function syncMarkerHeading() {
  const heading = qs("markersMarkerLabel");
  if (heading) heading.textContent = markerHeadingFromColor(store.modal.markerColor);
}

export function openMarkersModal() {
  if (!store.selectedKey) return showMessage("Select a day first");
  resetModalState();
  const data = store.entries[store.selectedKey] || {};
  store.modal.isPeak = data.isPeak === true;
  store.modal.markers = normalizeDayMarkers(data.markers, data);
  const firstType = ["bbt", "mucus", "cervix"].find(type => store.modal.markers[type].value);
  store.modal.markerColor = normalizeMarkerColor(data.markerColor ?? markerColorFromType(firstType || "mucus"));
  const selectedType = markerTypeFromColor(store.modal.markerColor);
  if (!store.modal.markers.bbt.value) {
    store.modal.markers.bbt.pointType = store.selectedPointType ?? "temp";
  }
  store.modal.markerPointType = store.modal.markers[selectedType].pointType;
  store.modal.marker = store.modal.markers[selectedType].value;
  qs("markersMarker").value = store.modal.marker;
  syncMarkerHeading();
  showModal("markersModal");
  syncModalUI();
}

export function closeMarkersModal() {
  hideModal("markersModal");
}

export function clearMarkersModalInput() {
  store.modal.marker = "";
  const input = qs("markersMarker");
  if (input) input.value = "";
}

export function selectMarkerType(color) {
  saveVisibleMarkerDraft();
  store.modal.markerColor = normalizeMarkerColor(color);
  const marker = store.modal.markers[markerTypeFromColor(store.modal.markerColor)];
  store.modal.marker = marker.value;
  store.modal.markerPointType = marker.pointType;
  const input = qs("markersMarker");
  if (input) input.value = marker.value;
  syncMarkerHeading();
  syncModalUI();
}

export function saveMarkersModal(render) {
  if (!store.selectedKey) return;
  saveVisibleMarkerDraft();
  updateSelectedEntry({
    isPeak: store.modal.isPeak === true,
    markers: normalizeDayMarkers(store.modal.markers),
    markerColor: store.modal.markerColor,
  });
  finishSave("markersModal", render);
}

export function openOtherModal() {
  if (!store.selectedKey) return showMessage("Select a day first");
  resetModalState();
  const data = store.entries[store.selectedKey] || {};
  store.modal.sex = data.sex === true;
  qs("otherModalInput").value = data.other ?? "";
  showModal("otherModal");
  syncModalUI();
}

export function closeOtherModal() {
  hideModal("otherModal");
}

export function saveOtherModal(render) {
  if (!store.selectedKey) return;
  updateSelectedEntry({ other: qs("otherModalInput").value.trim(), sex: store.modal.sex === true });
  finishSave("otherModal", render);
}

export { syncModalUI } from "./modal-shared.js";
