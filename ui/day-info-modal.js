import { store } from "../store.js";
import { TEMP_FACTORS, formatTemp, getAdjustedTemp, qs } from "../core.js";
import { hideModal, showModal } from "./modal-shared.js";
import { showMessage } from "./toast.js";

const LABELS = {
  bleeding: { none: "None", spotting: "Spotting", menstruation: "Period" },
  sensation: { "": "-", dry: "Dry", moist: "Moist", wet: "Wet" },
  consistency: { "": "-", creamy: "Creamy", slightlyStretchy: "Slightly stretchy", stretchy: "Stretchy" },
  color: { "": "-", white: "White", whiteTranslucent: "White-translucent", translucent: "Translucent", other: "Other" },
  firmness: { "": "-", hard: "Hard", soft: "Soft" },
  height: { "": "-", low: "Low", medium: "Medium", high: "High" },
  openness: { "": "-", closed: "Closed", medium: "Medium", open: "Open" },
};

export function renderInfoLines(element, lines) {
  element.replaceChildren();
  lines.forEach((line, index) => {
    if (index) element.appendChild(document.createElement("br"));
    element.appendChild(document.createTextNode(line));
  });
}

export function openDayInfoModal(currentColumns) {
  if (!store.selectedKey) return showMessage("Select a day first");
  const key = store.selectedKey;
  const data = store.entries[key] || {};
  const column = currentColumns.find(item => item.key === key);
  qs("dayInfoTitle").innerText = `${key} (CD ${column?.cycleDay ?? "-"})`;

  const adjusted = getAdjustedTemp(
    data.temp,
    data.measurementTime,
    store.getActiveMapProfile().usualMeasurementTime,
  );
  qs("infoTemp").innerText = data.temp == null
    ? "-"
    : `${formatTemp(data.temp)} °C${data.measurementTime ? ` at ${data.measurementTime}` : ""}${adjusted == null ? "" : ` (adjusted ${formatTemp(adjusted)} °C)`}`;
  qs("infoTempFactors").innerText = data.tempFactors ? TEMP_FACTORS[data.tempFactors] : "-";
  renderInfoLines(qs("infoBleeding"), [
    `Bleeding: ${LABELS.bleeding[data.bleeding ?? "none"]}`,
    `Clots: ${data.sediment ? "Yes" : "No"}`,
  ]);
  renderInfoLines(qs("infoMucus"), [
    `Sensation: ${LABELS.sensation[data.sensation ?? ""]}`,
    `Slippery: ${data.stretch ? "Yes" : "No"}`,
    `Discharge: ${data.visible ? "Yes" : "None"}`,
    `Consistency: ${LABELS.consistency[data.consistency ?? ""]}`,
    `Color: ${LABELS.color[data.color ?? ""]}${data.colorOther ? ` (${data.colorOther})` : ""}`,
  ]);
  renderInfoLines(qs("infoCervix"), [
    `Firmness: ${LABELS.firmness[data.cervixFirmness ?? ""]}`,
    `Height: ${LABELS.height[data.cervixHeight ?? ""]}`,
    `Openness: ${LABELS.openness[data.cervixOpenness ?? ""]}`,
  ]);
  const sex = data.sex === true ? "Yes" : data.sex === false ? "No" : "-";
  const notes = typeof data.other === "string" && data.other.trim() ? data.other : "-";
  renderInfoLines(qs("infoOther"), [`Sex: ${sex}`, `Notes: ${notes}`]);
  showModal("dayInfoModal");
}

export function closeDayInfoModal() {
  hideModal("dayInfoModal");
}
