import { store } from "./store.js";
import { LAYOUT, MUCUS_LABELS, qs, qsa, chartY, chartWidth, getDaysInMonth, getMonthOffset, formatDateKey } from "./app.js";
import { renderChart } from "./chart.js";


export function renderMonth() {
  qs("monthLabel").innerText = new Date(store.year, store.month)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function renderTempScale() {
  const scale = qs("tempScale");
  if (!scale) return;
  scale.innerHTML = "";
  for (let temp = LAYOUT.maxTemp; temp >= LAYOUT.minTemp - 0.001; temp -= 0.1) {
    const label       = document.createElement("div");
    label.className   = "temp-scale-label";
    label.textContent = Number(temp).toFixed(2);
    label.style.top   = `${chartY(temp) - 9}px`;
    scale.appendChild(label);
  }
}

export function renderCalendar(selectColumn) {
  const el = qs("calendar");
  el.innerHTML = "";

  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(day => {
    const w       = document.createElement("div");
    w.textContent = day;
    w.className   = "calendar-weekday";
    el.appendChild(w);
  });

  const totalDays = getDaysInMonth(store.year, store.month);
  const offset    = getMonthOffset(store.year, store.month);

  for (let i = 0; i < offset; i++) el.appendChild(document.createElement("div"));

  for (let d = 1; d <= totalDays; d++) {
    const date  = new Date(store.year, store.month, d);
    const key   = formatDateKey(date);
    const entry = store.entries[key];

    const div       = document.createElement("div");
    div.className   = "day";
    div.textContent = d;

    if (entry?.bleeding === "menstruation") div.classList.add("red");
    if (entry?.isFertile) div.classList.add("fertile-day");
    if (store.selectedKey === key) div.classList.add("selected");

    div.onclick = () => selectColumn(key);
    el.appendChild(div);
  }
}

export function renderInfo(currentColumns) {
  const set = (id, val) => qs(id).innerText = val;

  if (!store.selectedKey) {
    set("infoTitle",     "No day selected");
    set("infoTemp",      "-");
    set("infoBleeding",  "-");
    set("infoDischarge", "-");
    set("infoSediment",  "-");
    set("infoOther",     "-");
    return;
  }

  const data   = store.entries[store.selectedKey] || {};
  const column = currentColumns.find(c => c.key === store.selectedKey);

  set("infoTitle",     `${store.selectedKey} (CD ${column?.cycleDay ?? "-"})`);
  set("infoTemp",      data.temp ?? "-");
  set("infoBleeding",  data.bleeding  !== "none" ? data.bleeding  : "-");
  set("infoDischarge", data.discharge !== "none" ? data.discharge : "-");
  set("infoSediment",  data.sediment ? "yes" : "-");
  set("infoOther",     data.other || "-");
}

export function makeCell(text = "", ...classes) {
  const cell     = document.createElement("div");
  cell.className = ["map-cell", ...classes].filter(Boolean).join(" ");
  cell.textContent = text;
  return cell;
}

export function renderMapRows(columns, selectColumn, hoverColumn, clearHover) {
  const rowIds = ["dayNumbers","cycleDayRow","mucusRow","bleedingRow","spottingRow","sedimentRow","otherRow"];
  const rows   = Object.fromEntries(rowIds.map(id => [id, qs(id)]));
  const width  = chartWidth(columns);

  Object.values(rows).forEach(row => { row.innerHTML = ""; row.style.width = `${width}px`; });

  const attach = (el, col) => {
    el.onmouseenter = () => hoverColumn(col.key);
    el.onmouseleave = () => clearHover();
    el.onclick      = () => selectColumn(col.key);
  };

  columns.forEach(col => {
    const sel = store.selectedKey === col.key ? "selected-column" : "";

    const dayCell     = document.createElement("div");
    dayCell.className = ["map-day", sel].filter(Boolean).join(" ");
    dayCell.textContent = col.date.getDate();
    attach(dayCell, col);
    rows.dayNumbers.appendChild(dayCell);

    const cdCell = makeCell(col.cycleDay, sel);
    attach(cdCell, col);
    rows.cycleDayRow.appendChild(cdCell);

    const mucusCell = makeCell(MUCUS_LABELS[col.discharge] || "", sel, col.isPeak ? "peak-helper" : "");
    attach(mucusCell, col);
    rows.mucusRow.appendChild(mucusCell);

    const bleedCell = makeCell(col.bleeding === "menstruation" ? "●" : "", sel, col.bleeding === "menstruation" ? "period" : "");
    attach(bleedCell, col);
    rows.bleedingRow.appendChild(bleedCell);

    const spottingCell = makeCell(col.bleeding === "spotting" ? "◐" : "", sel, col.bleeding === "spotting" ? "spotting" : "");
    attach(spottingCell, col);
    rows.spottingRow.appendChild(spottingCell);

    const sedimentCell = makeCell(col.sediment ? "S" : "", sel);
    attach(sedimentCell, col);
    rows.sedimentRow.appendChild(sedimentCell);

    const otherCell = makeCell(col.other, sel);
    attach(otherCell, col);
    rows.otherRow.appendChild(otherCell);
  });
}

export function syncModalUI() {
  qsa(".segmented button").forEach(btn => {
    let value = btn.dataset.value;
    if (value === "true")  value = true;
    if (value === "false") value = false;
    btn.classList.toggle("active", store.modal[btn.dataset.group] === value);
  });
}

export function openModal(currentColumns) {
  if (!store.selectedKey) return;

  const key    = store.selectedKey;
  const data   = store.entries[key] || {};
  const column = currentColumns.find(c => c.key === key);

  store.modal = {
    temp:      data.temp      ?? null,
    bleeding:  data.bleeding  ?? "none",
    discharge: data.discharge ?? "none",
    sediment:  data.sediment  ?? false,
    other:     data.other     ?? "",
    isFertile: data.isFertile ?? false,
    isPeak:    data.isPeak    ?? false,
    marker:    data.marker    ?? "",
  };

  qs("modalTitle").innerText = `${key} (CD ${column?.cycleDay ?? "-"})`;
  qs("tempInput").value      = store.modal.temp != null ? Number(store.modal.temp).toFixed(2) : "";
  qs("otherInput").value     = store.modal.other;
  qs("modalFertile").checked = store.modal.isFertile;
  qs("modalPeak").checked    = store.modal.isPeak;
  qs("modalMarker").value    = store.modal.marker;

  syncModalUI();

  const modal = qs("modal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

export function closeModal() {
  const modal = qs("modal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function validateTempInput() {
  const raw = qs("tempInput")?.value.trim();
  if (!raw) return true;
  const value = parseFloat(raw);
  return !isNaN(value) && (value == null || (value >= 34 && value <= 42));
}

export function saveModal(render) {
  if (!store.selectedKey || !validateTempInput()) return;

  const temp = parseFloat(qs("tempInput").value);
  store.modal.temp      = isNaN(temp) ? null : temp;
  store.modal.other     = qs("otherInput").value.trim();
  store.modal.isFertile = qs("modalFertile").checked;
  store.modal.isPeak    = qs("modalPeak").checked;
  store.modal.marker    = qs("modalMarker").value;

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    ...store.modal,
  };

  store.save();
  closeModal();
  qs("modal").addEventListener("transitionend", render, { once: true });
}