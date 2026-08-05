// ui.js — UI rendering and modal
// ─────────────────────────────────────────────
// Owns calendar, info panel, cycle map rows,
// temperature scale, and the edit modal.

import { store } from "./store.js";
import {
  LAYOUT, TEMP_FACTORS, qs, qsa,
  chartY, chartWidth,
  getDaysInMonth, getMonthOffset, formatDateKey, parseDateKey, formatTemp,
  isFertileDay, getFertileRange, setFertileRange, clearFertileRange,
  getTimeAdjustment, getAdjustedTemp,
} from "./app.js";

/* ─── month label ─────────────────────────── */

/** Renders the current month and year label above the calendar. */
export function renderMonth() {
  qs("monthLabel").innerText = new Date(store.year, store.month)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}

/* ─── temperature scale ───────────────────── */

/** Renders the fixed temperature scale labels alongside the chart. */
export function renderTempScale() {
  const scale = qs("tempScale");
  if (!scale) return;
  scale.innerHTML = "";
  for (let temp = LAYOUT.maxTemp; temp >= LAYOUT.minTemp - LAYOUT.tempStep / 2; temp -= LAYOUT.tempStep) {
    const label       = document.createElement("div");
    label.className   = "temp-scale-label";
    label.textContent = Number(temp).toFixed(2);
    label.style.top   = `${chartY(temp)}px`;
    scale.appendChild(label);
  }
}

/* ─── calendar ────────────────────────────── */

/**
 * Renders the month calendar grid.
 * Accepts selectColumn as a callback to avoid a circular import with app.js.
 */
export function renderCalendar(selectColumn) {
  const el = qs("calendar");
  el.innerHTML = "";

  // weekday headers
  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(day => {
    const w       = document.createElement("div");
    w.textContent = day;
    w.className   = "calendar-weekday";
    el.appendChild(w);
  });

  const totalDays = getDaysInMonth(store.year, store.month);
  const offset    = getMonthOffset(store.year, store.month);

  // compute cycle start dates for cycle day calculation
  const starts = Object.keys(store.entries)
    .sort()
    .filter((k, i, arr) => {
      if (store.entries[k]?.bleeding !== "menstruation") return false;
      const prev = store.entries[arr[i - 1]];
      return !prev || prev.bleeding !== "menstruation";
    });

  // empty cells before the first day
  for (let i = 0; i < offset; i++) el.appendChild(document.createElement("div"));

  for (let d = 1; d <= totalDays; d++) {
    const date  = new Date(store.year, store.month, d);
    const key   = formatDateKey(date);
    const entry = store.entries[key];

    const div     = document.createElement("div");
    div.className = "day";

    // cycle day number as superscript — only if a cycle start exists before this date
    const dateNorm = new Date(date); dateNorm.setHours(0, 0, 0, 0);
    const latest   = [...starts].reverse().find(s => {
      const sd = new Date(s); sd.setHours(0, 0, 0, 0);
      return sd <= dateNorm;
    });
    if (latest) {
      const sd       = new Date(latest); sd.setHours(0, 0, 0, 0);
      const cycleDay = Math.floor((dateNorm - sd) / 86_400_000) + 1;
      const sup      = document.createElement("span");
      sup.className  = "day-cycle-num";
      sup.textContent = cycleDay;
      div.appendChild(sup);
    }

    // day number
    const dayNum       = document.createElement("span");
    dayNum.textContent = d;
    div.appendChild(dayNum);

    if (entry?.bleeding === "menstruation") div.classList.add("red");
    if (isFertileDay(key))                   div.classList.add("fertile-day");
    if (store.selectedKey === key)          div.classList.add("selected");

    div.onclick = () => selectColumn(key);
    el.appendChild(div);
  }
}

/** Fills the temperature-influence-factor dropdown from the single TEMP_FACTORS source. */
export function renderTempFactorsOptions() {
  const select = qs("tempFactorsInput");
  if (!select) return;

  select.innerHTML = `<option value="">None</option>` +
    Object.entries(TEMP_FACTORS)
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
}

/* ─── cycle map rows ──────────────────────── */

/** Creates a single map cell div with optional CSS classes. */
export function makeCell(text = "", ...classes) {
  const cell       = document.createElement("div");
  cell.className   = ["map-cell", ...classes].filter(Boolean).join(" ");
  cell.textContent = text;
  return cell;
}

/**
 * Renders all cycle map rows (day numbers, cycle day, mucus, bleeding, etc.).
 * Interaction callbacks are passed in to avoid circular imports with app.js.
 */
export function renderMapRows(columns, selectColumn, hoverColumn, clearHover) {
const rowIds = [
  "dayNumbers",
  "cycleDayRow",

  "sensationRow",
  "stretchRow",
  "visibleRow",
  "consistencyRow",
  "colorRow",
  "peakRow",

  "bleedingRow",
  "spottingRow",
  "sedimentRow",
  "markerRow",
  "cervixFirmnessRow",
  "cervixHeightRow",
  "cervixOpennessRow",
  "otherRow",
];
  const rows  = Object.fromEntries(rowIds.map(id => [id, qs(id)]));
  const width = chartWidth(columns);

  Object.values(rows).forEach(row => { row.innerHTML = ""; row.style.width = `${width}px`; });

  // attaches hover and click handlers to a map cell
  const attach = (el, col) => {
    el.onmouseenter = () => hoverColumn(col.key);
    el.onmouseleave = () => clearHover();
    el.onclick      = () => selectColumn(col.key);
  };

  const CONSISTENCY_LABELS = {
  "": "",
  creamy: "CR",
  slightlyStretchy: "SS",
  stretchy: "ST",
};
  const COLOR_LABELS = {
    "": "",
    white: "W",
    yellow: "Y",
    clear: "C",
    other: "O",
};

  const SENSATION_LABELS = {
    "": "None",
    dry: "D",
    moist: "M",
    wet: "W",
};

  const CERVIX_FIRMNESS_LABELS = {
    "": "",
    hard: "H",
    soft: "S",
};

  const CERVIX_HEIGHT_LABELS = {
    "": "",
    low: "L",
    medium: "M",
    high: "H",
};

  columns.forEach(col => {
    const sel = [
      store.selectedKey === col.key ? "selected-column" : "",
      col.isFertile ? "fertile" : "",
    ].filter(Boolean).join(" ");

    const dayCell       = document.createElement("div");
    dayCell.className   = ["map-day", sel].filter(Boolean).join(" ");
    dayCell.textContent = col.date.getDate();
    attach(dayCell, col);
    rows.dayNumbers.appendChild(dayCell);

    const cdCell = makeCell(col.cycleDay, sel);
    attach(cdCell, col);
    rows.cycleDayRow.appendChild(cdCell);

    const sensationCell = makeCell(SENSATION_LABELS[col.sensation] || "", sel);
    attach(sensationCell, col);
    rows.sensationRow.appendChild(sensationCell);

    const stretchCell = makeCell(col.stretch ? "✓" : "", sel);
    attach(stretchCell, col);
    rows.stretchRow.appendChild(stretchCell);

    const visibleCell = makeCell(col.visible ? "✓" : "", sel);
    attach(visibleCell, col);
    rows.visibleRow.appendChild(visibleCell);

    const consistencyCell = makeCell(CONSISTENCY_LABELS[col.consistency] || "", sel);
    attach(consistencyCell, col);
    rows.consistencyRow.appendChild(consistencyCell);

    const colorCell = makeCell(COLOR_LABELS[col.color] || "", sel);
    attach(colorCell, col);
    rows.colorRow.appendChild(colorCell);

    const peakCell = makeCell(col.isPeak ? "✓" : "", sel);
    attach(peakCell, col);
    rows.peakRow.appendChild(peakCell);

    const markerCell = makeCell(col.marker || "", sel, col.marker ? `marker-${col.markerColor}` : "");
    attach(markerCell, col);
    rows.markerRow.appendChild(markerCell);

    const firmnessCell = makeCell(CERVIX_FIRMNESS_LABELS[col.cervixFirmness] || "", sel);
    attach(firmnessCell, col);
    rows.cervixFirmnessRow.appendChild(firmnessCell);

    const heightCell = makeCell(CERVIX_HEIGHT_LABELS[col.cervixHeight] || "", sel);
    attach(heightCell, col);
    rows.cervixHeightRow.appendChild(heightCell);

    const opennessCell = document.createElement("div");
    opennessCell.className = ["map-cell", sel].filter(Boolean).join(" ");
    if (col.cervixOpenness) {
      const openness = document.createElement("span");
      openness.className = ["cervix-indicator", col.cervixOpenness].join(" ");
      openness.title = `Openness: ${col.cervixOpenness}`;
      opennessCell.appendChild(openness);
    }
    attach(opennessCell, col);
    rows.cervixOpennessRow.appendChild(opennessCell);

    const bleedCell = makeCell(
      col.bleeding === "menstruation" ? "●" : "", sel,
      col.bleeding === "menstruation" ? "period" : ""
    );
    attach(bleedCell, col);
    rows.bleedingRow.appendChild(bleedCell);

    const spottingCell = makeCell(
      col.bleeding === "spotting" ? "◐" : "", sel,
      col.bleeding === "spotting" ? "spotting" : ""
    );
    attach(spottingCell, col);
    rows.spottingRow.appendChild(spottingCell);

    const sedimentCell = makeCell(col.sediment ? "✓" : "", sel);
    attach(sedimentCell, col);
    rows.sedimentRow.appendChild(sedimentCell);

    const otherCell = makeCell(col.other ? "✓" : "", sel);
    attach(otherCell, col);
    rows.otherRow.appendChild(otherCell);
  });
}

/* ─── modal ───────────────────────────────── */
/** After a modal's close transition: re-render and reopen the action modal. */
function afterModalSave(modalId, render) {
  qs(modalId).addEventListener("transitionend", () => {
    render();
    setTimeout(openActionModal, 200);
  }, { once: true });
}

/** Syncs segmented button active states to current store.modal values. */
export function syncModalUI() {
  qsa(".segmented button").forEach(btn => {
    if (btn.closest(".modal")?.classList.contains("hidden")) return;
    let value = btn.dataset.value;
    if (value === "true")  value = true;
    if (value === "false") value = false;
    btn.classList.toggle("active", store.modal[btn.dataset.group] === value);
  });
}

function resetModalState() {
  store.modal = store._emptyModal();
}

/** Opens the edit modal for the currently selected day. */
export function openModal(currentColumns) {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const key    = store.selectedKey;
  const data   = store.entries[key] || {};
  const column = currentColumns.find(c => c.key === key);

  store.modal.temp            = data.temp            ?? null;
  store.modal.tempFactors     = data.tempFactors      ?? "";
  store.modal.measurementTime = data.measurementTime  ?? "";
  store.modal.measurementTimeEnabled = Boolean(data.measurementTime);

  qs("modalTitle").innerText       = `${key} (CD ${column?.cycleDay ?? "-"})`;
  qs("tempInput").value            = store.modal.temp != null ? Number(store.modal.temp).toFixed(2) : "";
  qs("tempFactorsInput").value     = store.modal.tempFactors;
  qs("measurementTimeCheckbox").checked = store.modal.measurementTimeEnabled;
  qs("measurementTimeInput").value = store.modal.measurementTime;
  syncMeasurementTimeUI();

  const modal = qs("modal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

/** Closes the modal with a CSS transition. */
export function closeModal() {
  const modal = qs("modal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

/** Returns true if the temperature input is empty or within valid BBT range. */
export function validateTempInput() {
  const raw = qs("tempInput")?.value.trim().replace(",", ".");
  if (!raw) return true;
  const value = parseFloat(raw);
  return !isNaN(value) && (value == null || (value >= 34 && value <= 42));
}

/**
 * Saves modal data to store and triggers a re-render after the close transition.
 * Accepts render as a callback to avoid a circular import with app.js.
 */
export function saveModal(render) {
  if (!store.selectedKey) return showMessage("Select a day first");
  if (!validateTempInput()) return showMessage("Temperature must be between 34–42 °C");

  const tempInput = qs("tempInput").value.trim().replace(",", ".");
  const temp = parseFloat(tempInput);

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    temp:            isNaN(temp) ? null : temp,
    tempFactors:     qs("tempFactorsInput").value,
    measurementTime: store.modal.measurementTimeEnabled ? qs("measurementTimeInput").value : "",
  };

  store.save();
  closeModal();
  afterModalSave("modal", render);
}

export function openActionModal() {
  const modal = qs("actionModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeActionModal() {
  const modal = qs("actionModal");
  modal.classList.remove("show");
  modal.addEventListener(
    "transitionend",
    () => modal.classList.add("hidden"),
    { once: true }
  );
}

export function syncMucusModalUI() {
  const otherCheckbox = qs("mucusColorOtherCheckbox");
  const otherInput = qs("mucusColorOtherInput");
  const isOther = store.modal.color === "other" || (store.modal.colorOther && store.modal.colorOther.trim());

  if (otherCheckbox) {
    otherCheckbox.checked = isOther;
  }

  qsa('.segmented button[data-group="color"]').forEach(btn => {
    btn.disabled = isOther;
    btn.classList.toggle("disabled", isOther);
  });

  if (otherInput) {
    otherInput.classList.toggle("hidden", !isOther);
    otherInput.value = store.modal.colorOther ?? "";
  }

  syncModalUI();
}

export function syncMeasurementTimeUI() {
  const checkbox = qs("measurementTimeCheckbox");
  const wrapper = qs("measurementTimeWrapper");

  if (checkbox) {
    checkbox.checked = Boolean(store.modal.measurementTimeEnabled);
  }
  if (wrapper) {
    wrapper.classList.toggle("hidden", !store.modal.measurementTimeEnabled);
  }

  const hint = qs("timeAdjustmentHint");
  if (hint) {
    const adjustment = store.modal.measurementTimeEnabled
      ? getTimeAdjustment(store.modal.measurementTime, store.profile.usualMeasurementTime)
      : 0;
    hint.innerText = adjustment !== 0
      ? `≈ ${adjustment > 0 ? "+" : ""}${adjustment.toFixed(2)} °C vs usual time`
      : "";
  }
}

export function openMucusModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};

  // load saved values into modal state — coerce booleans explicitly
  store.modal.sensation   = data.sensation   ?? "";
  store.modal.stretch     = data.stretch     === true;
  store.modal.visible     = data.visible     === true;
  store.modal.consistency = data.consistency ?? "";
  store.modal.color       = data.color       ?? "";
  store.modal.colorOther  = data.colorOther  ?? "";
  store.modal.isPeak      = data.isPeak      === true;

  const modal = qs("mucusModal");
  modal.classList.remove("hidden");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      syncMucusModalUI();    // sync after modal is visible
      modal.classList.add("show");
    });
  });
}

export function closeMucusModal() {
  const modal = qs("mucusModal");

  modal.classList.remove("show");

  modal.addEventListener(
    "transitionend",
    () => modal.classList.add("hidden"),
    { once: true }
  );
}

export function saveMucusModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    sensation: store.modal.sensation,
    stretch: store.modal.stretch,
    visible: store.modal.visible,
    consistency: store.modal.consistency,
    color: store.modal.color,
    colorOther: store.modal.colorOther,
    isPeak: store.modal.isPeak,
  };

  store.save();
  closeMucusModal();
  afterModalSave("mucusModal", render);
}

export function openBleedingModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};

  // load saved bleeding value into modal state
  store.modal.bleeding = data.bleeding ?? "none";
  store.modal.sediment = data.sediment === true;

  syncModalUI();

  const modal = qs("bleedingModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeBleedingModal() {
  const modal = qs("bleedingModal");

  modal.classList.remove("show");

  modal.addEventListener(
    "transitionend",
    () => modal.classList.add("hidden"),
    { once: true }
  );
}

export function saveBleedingModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    bleeding: store.modal.bleeding,
    sediment: store.modal.sediment,
  };

  store.save();
  closeBleedingModal();
  afterModalSave("bleedingModal", render);
}

export function openMarkersModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};

  store.modal.isPeak = data.isPeak === true;
  store.modal.marker = data.marker ?? "";
  store.modal.markerColor = data.markerColor ?? "blue";

  qs("markersMarker").value = store.modal.marker;

  const modal = qs("markersModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      syncModalUI();
      modal.classList.add("show");
    });
  });
}

export function closeMarkersModal() {
  const modal = qs("markersModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function saveMarkersModal(render) {
  if (!store.selectedKey) return;

  store.modal.marker = qs("markersMarker").value || "";

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    isPeak: store.modal.isPeak === true,
    marker: store.modal.marker,
    markerColor: store.modal.markerColor || "blue",
  };

  store.save();
  closeMarkersModal();
  afterModalSave("markersModal", render);
}

export function openCervixModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};
  store.modal.cervixFirmness = data.cervixFirmness ?? "";
  store.modal.cervixHeight = data.cervixHeight ?? "";
  store.modal.cervixOpenness = data.cervixOpenness ?? "";

  const modal = qs("cervixModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      syncModalUI();
      modal.classList.add("show");
    });
  });
}

export function closeCervixModal() {
  const modal = qs("cervixModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function saveCervixModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    cervixFirmness: store.modal.cervixFirmness,
    cervixHeight: store.modal.cervixHeight,
    cervixOpenness: store.modal.cervixOpenness,
  };

  store.save();
  closeCervixModal();
  afterModalSave("cervixModal", render);
}

/* ─── fertile range modal ─────────────────── */

// draft state for the in-modal calendar — discarded on close without saving
let fertileRangeDraft = null;

/** Renders the mini calendar inside the fertile range modal from the current draft. */
function renderFertileRangeModal() {
  qs("fertileRangeMonthLabel").innerText = new Date(fertileRangeDraft.year, fertileRangeDraft.month)
    .toLocaleString("en-US", { month: "long", year: "numeric" });

  const el = qs("fertileRangeCalendar");
  el.innerHTML = "";

  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
    const w       = document.createElement("div");
    w.textContent = day;
    w.className   = "calendar-weekday";
    el.appendChild(w);
  });

  const totalDays = getDaysInMonth(fertileRangeDraft.year, fertileRangeDraft.month);
  const offset    = getMonthOffset(fertileRangeDraft.year, fertileRangeDraft.month);

  for (let i = 0; i < offset; i++) el.appendChild(document.createElement("div"));

  for (let d = 1; d <= totalDays; d++) {
    const key = formatDateKey(new Date(fertileRangeDraft.year, fertileRangeDraft.month, d));

    const div       = document.createElement("div");
    div.className   = "day";
    div.textContent = d;

    // full range picked — paint every day in it the same green used everywhere else
    if (fertileRangeDraft.start && fertileRangeDraft.end && key >= fertileRangeDraft.start && key <= fertileRangeDraft.end) {
      div.classList.add("fertile-day");
    } else if (key === fertileRangeDraft.start) {
      // only a start day picked so far — mark it, waiting for the end day
      div.classList.add("selected");
    }

    div.onclick = () => pickFertileRangeDay(key);
    el.appendChild(div);
  }

  const summary = qs("fertileRangeSummary");
  if (fertileRangeDraft.start && fertileRangeDraft.end) {
    summary.innerText = `${fertileRangeDraft.start} → ${fertileRangeDraft.end}`;
  } else if (fertileRangeDraft.start) {
    summary.innerText = "Pick an end day";
  } else {
    summary.innerText = "Pick a start day";
  }
}

/** Handles a day tap inside the fertile range picker. */
function pickFertileRangeDay(key) {
  if (fertileRangeDraft.start && !fertileRangeDraft.end) {
    // second tap completes the range — swap if the end was picked before the start
    fertileRangeDraft.end   = key < fertileRangeDraft.start ? fertileRangeDraft.start : key;
    fertileRangeDraft.start = key < fertileRangeDraft.start ? key : fertileRangeDraft.start;
  } else {
    // first tap, or restarting after a full range was already picked
    fertileRangeDraft.start = key;
    fertileRangeDraft.end   = null;
  }
  renderFertileRangeModal();
}

/** Moves the picker's visible month forward or back by one. */
export function changeFertileRangeMonth(delta) {
  fertileRangeDraft.month += delta;
  if (fertileRangeDraft.month < 0)  { fertileRangeDraft.month = 11; fertileRangeDraft.year--; }
  if (fertileRangeDraft.month > 11) { fertileRangeDraft.month = 0;  fertileRangeDraft.year++; }
  renderFertileRangeModal();
}

/** Opens the fertile range modal, preloading the currently active range if any. */
export function openFertileRangeModal() {
  const existing = getFertileRange();
  const base     = existing ? parseDateKey(existing.start) : new Date();

  fertileRangeDraft = {
    month: base.getMonth(),
    year:  base.getFullYear(),
    start: existing?.start ?? null,
    end:   existing?.end   ?? null,
  };

  renderFertileRangeModal();

  const modal = qs("fertileRangeModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeFertileRangeModal() {
  const modal = qs("fertileRangeModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function saveFertileRangeModal(render) {
  if (!fertileRangeDraft?.start || !fertileRangeDraft?.end) {
    return showMessage("Pick a start and an end day");
  }

  setFertileRange(fertileRangeDraft.start, fertileRangeDraft.end);
  store.save();
  closeFertileRangeModal();
  afterModalSave("fertileRangeModal", render);
}

/** Clears the active fertile range entirely. */
export function clearFertileRangeModal(render) {
  clearFertileRange();
  store.save();
  closeFertileRangeModal();
  showMessage("Fertile range cleared");
  afterModalSave("fertileRangeModal", render);
}

/* ─── profile modal ────────────────────────── */

/** Opens the profile modal, preloading the currently saved values. */
export function openProfileModal() {
  const profile = store.profile;

  qs("profileAgeInput").value               = profile.age;
  qs("profileUsualTimeInput").value          = profile.usualMeasurementTime;
  qs("profileGoalInput").value               = profile.goal;
  qs("profileMapNumberInput").value          = profile.mapNumber;
  qs("profileMeasurementMethodInput").value  = profile.measurementMethod;

  const modal = qs("profileModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeProfileModal() {
  const modal = qs("profileModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function saveProfileModal(render) {
  store.profile = {
    age:                  qs("profileAgeInput").value,
    usualMeasurementTime: qs("profileUsualTimeInput").value,
    goal:                 qs("profileGoalInput").value,
    mapNumber:            qs("profileMapNumberInput").value,
    measurementMethod:    qs("profileMeasurementMethodInput").value,
  };

  store.save();
  closeProfileModal();
  afterModalSave("profileModal", render);
}

export function openOtherModal() {
  if (!store.selectedKey) return showMessage("Select a day first");

  resetModalState();

  const data = store.entries[store.selectedKey] || {};
  qs("otherModalInput").value = data.other ?? "";

  const modal = qs("otherModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("show"));
  });
}

export function closeOtherModal() {
  const modal = qs("otherModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function saveOtherModal(render) {
  if (!store.selectedKey) return;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    other: qs("otherModalInput").value.trim(),
  };

  store.save();
  closeOtherModal();
  afterModalSave("otherModal", render);
}

/* ─── day info modal ───────────────────────── */
const BLEEDING_LABELS = { none: "None", spotting: "Spotting", menstruation: "Period" };
const SENSATION_LABELS = { "": "-", dry: "Dry", moist: "Moist", wet: "Wet" };

// full-word versions of the abbreviated map labels — used only in day-info modal
const CONSISTENCY_FULL_LABELS = { "": "-", creamy: "Creamy", slightlyStretchy: "Slightly stretchy", stretchy: "Stretchy" };
const COLOR_FULL_LABELS = { "": "-", clear: "Clear", white: "White", yellow: "Yellow", other: "Other" };

/** Opens the read-only day info modal for the currently selected day. */
export function openDayInfoModal(currentColumns) {
  if (!store.selectedKey) return showMessage("Select a day first");

  const key    = store.selectedKey;
  const data   = store.entries[key] || {};
  const column = currentColumns.find(c => c.key === key);

  qs("dayInfoTitle").innerText = `${key} (CD ${column?.cycleDay ?? "-"})`;

  const adjustedTemp = getAdjustedTemp(data.temp, data.measurementTime, store.profile.usualMeasurementTime);
  qs("infoTemp").innerText = data.temp != null
    ? `${formatTemp(data.temp)} °C${data.measurementTime ? ` at ${data.measurementTime}` : ""}${adjustedTemp != null ? ` (adjusted ${formatTemp(adjustedTemp)} °C)` : ""}`
    : "-";
  qs("infoTempFactors").innerText = data.tempFactors ? TEMP_FACTORS[data.tempFactors] : "-";
  qs("infoBleeding").innerText    = BLEEDING_LABELS[data.bleeding ?? "none"];

  qs("infoMucus").innerHTML = [
    `Sensation: ${SENSATION_LABELS[data.sensation ?? ""]}`,
    `Slippery: ${data.stretch ? "Yes" : "No"}`,
    `Discharge: ${data.visible ? "Yes" : "None"}`,
    `Consistency: ${CONSISTENCY_FULL_LABELS[data.consistency ?? ""]}`,
    `Color: ${COLOR_FULL_LABELS[data.color ?? ""]}${data.colorOther ? ` (${data.colorOther})` : ""}`,
    `Clots: ${data.sediment ? "Yes" : "No"}`,
  ].join("<br>");

  const range = getFertileRange();
  const fertileRangeText = range ? `${range.start} to ${range.end}` : "-";

  const CERVIX_LABELS = {
    firmness: {
      "": "-",
      hard: "Hard",
      soft: "Soft",
    },
    height: {
      "": "-",
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    openness: {
      "": "-",
      closed: "Closed",
      medium: "Medium",
      open: "Open",
    },
  };

  qs("infoCervix").innerHTML = [
    `Firmness: ${CERVIX_LABELS.firmness[data.cervixFirmness ?? ""]}`,
    `Height: ${CERVIX_LABELS.height[data.cervixHeight ?? ""]}`,
    `Openness: ${CERVIX_LABELS.openness[data.cervixOpenness ?? ""]}`,
  ].join("<br>");

  const markerText = data.marker ? `${data.marker} (${data.markerColor ?? "blue"})` : "None";
  qs("infoMarkers").innerHTML = [
    `Fertile range: ${fertileRangeText}`,
    `Peak: ${data.isPeak ? "Yes" : "No"}`,
    `Marker: ${markerText}`,
  ].join("<br>");

  qs("infoOther").innerText = data.other?.trim() ? data.other : "-";

  const modal = qs("dayInfoModal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

/** Closes the day info modal. */
export function closeDayInfoModal() {
  const modal = qs("dayInfoModal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

/* ─── toast ───────────────────────────────── */

let toastTimer = null;

/** Shows a temporary message banner. Used for blocked actions and validation errors. */
export function showMessage(text) {
  const toast = qs("toast");
  if (!toast) return;

  clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.classList.add("hidden"), { once: true });
  }, 2200);
}