// app.js — Cycle Tracker
// ─────────────────────────────────────────────
// Architecture:
//   CONSTANTS  →  utils  →  Store  →  domain logic
//   →  render helpers  →  render  →  init  →  boot
// ─────────────────────────────────────────────

"use strict";

/* ─── helpers ─────────────────────────────── */

const qs  = id       => document.getElementById(id);
const qsa = selector => document.querySelectorAll(selector);

/* ─── constants ───────────────────────────── */

const LAYOUT = {
  columnWidth:        36,
  sideLabelWidth:     68,
  tempScaleWidth:     52,
  chartHeight:        260,
  chartPaddingTop:    20,
  chartPaddingBottom: 24,
  minTemp:            36.0,
  maxTemp:            37.5,
};

const CYCLE = {
  maxDays:        90,   // safety cap for cycle iteration
  ovulationLag:    6,   // low-temp window size before thermal shift
  minLowTemps:     4,   // min valid readings to confirm ovulation
  coverlineShift:  0.05 // degrees above max-low = coverline
};

const MUCUS_LABELS = { dry: "D", moist: "M", wet: "W" };

const STORAGE_KEY = "cycleData";

/* ─── utils ───────────────────────────────── */

function normalize(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateKey(date) {
  const d  = normalize(date);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-based week offset (0 = Mon, 6 = Sun) */
function getMonthOffset(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function formatTemp(temp) {
  return temp != null ? Number(temp).toFixed(2) : "-";
}

function isValidTemp(temp) {
  return temp == null || (temp >= 34 && temp <= 42);
}

/* ─── layout geometry ─────────────────────── */

function columnX(index)       { return index * LAYOUT.columnWidth; }
function columnCenterX(index) { return columnX(index) + LAYOUT.columnWidth / 2; }
function chartWidth(columns)  { return columns.length * LAYOUT.columnWidth; }

function graphHeight() {
  return LAYOUT.chartHeight - LAYOUT.chartPaddingTop - LAYOUT.chartPaddingBottom;
}

function chartY(temp) {
  return (
    LAYOUT.chartPaddingTop +
    ((LAYOUT.maxTemp - temp) / (LAYOUT.maxTemp - LAYOUT.minTemp)) * graphHeight()
  );
}

function syncCSSVariables() {
  const root = document.documentElement;
  root.style.setProperty("--column-width",     `${LAYOUT.columnWidth}px`);
  root.style.setProperty("--label-width",      `${LAYOUT.sideLabelWidth}px`);
  root.style.setProperty("--temp-scale-width", `${LAYOUT.tempScaleWidth}px`);
  root.style.setProperty("--chart-height",     `${LAYOUT.chartHeight}px`);
}

/* ─── store ───────────────────────────────── */

class Store {
  constructor() {
    this.entries     = this._load();
    this.selectedKey = null;
    this.hoveredKey  = null;
    this.month       = new Date().getMonth();
    this.year        = new Date().getFullYear();
    this.modal       = this._emptyModal();
  }

  _emptyModal() {
    return { temp: null, bleeding: "none", discharge: "none", sediment: false, other: "" };
  }

  _load() {
    try {
      const raw    = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      console.warn("cycleData corrupted — resetting.");
      return {};
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.entries     = {};
    this.selectedKey = null;
    this.hoveredKey  = null;
    const now        = new Date();
    this.month       = now.getMonth();
    this.year        = now.getFullYear();
  }
}

const store = new Store();

/* ─── domain: cycle detection ─────────────── */

/** Returns sorted Date[] of cycle start dates (first day of each menstruation run). */
function getCycleStartDates() {
  const keys   = Object.keys(store.entries).sort();
  const starts = [];

  keys.forEach((key, i) => {
    if (store.entries[key]?.bleeding !== "menstruation") return;
    const prevIsPeriod = store.entries[keys[i - 1]]?.bleeding === "menstruation";
    if (!prevIsPeriod) starts.push(normalize(parseDateKey(key)));
  });

  return starts;
}

/**
 * Returns the cycle-day number for a given date relative to the most
 * recent cycle start that is ≤ that date.  Falls back to entry index + 1.
 */
function resolveCycleDay(date, starts, fallbackIndex) {
  const d            = normalize(date);
  const latestStart  = [...starts].reverse().find(s => normalize(s) <= d);
  if (latestStart) {
    return Math.floor((d - normalize(latestStart)) / 86_400_000) + 1;
  }
  return fallbackIndex + 1;
}

/* ─── domain: cycle segmentation ──────────── */

function segmentCycles(days) {
  if (!days.length) return [];

  const cycles = [];
  let currentCycle = null;

  days.forEach((day, index) => {
    const isMenstruation = day.bleeding === "menstruation";

    const previousDay = days[index - 1];

    const previousWasMenstruation =
      previousDay?.bleeding === "menstruation";

    const isCycleStart =
      isMenstruation && !previousWasMenstruation;

    if (!currentCycle || isCycleStart) {
      currentCycle = {
        id: `cycle-${cycles.length + 1}`,
        startDate: day.date,
        endDate: day.date,
        entries: [],
        overlays: null,
      };
      
      cycles.push(currentCycle);
    }

    currentCycle.entries.push(day);
    currentCycle.endDate = day.date;
  });

  return cycles.map(deriveCycleState);
}

/* ─── domain: overlays ────────────────────── */

/**
 * Detect ovulation using the three-over-six thermal shift rule.
 * Returns the index of the first confirmed high temperature, or null.
 */
function detectOvulationIndex(days) {
  const temps = days.map(d => d.temp);

  for (let i = CYCLE.ovulationLag; i < temps.length - 2; i++) {
    const validLows = temps.slice(i - CYCLE.ovulationLag, i).filter(t => t != null);
    if (validLows.length < CYCLE.minLowTemps) continue;

    const cover = Math.max(...validLows) + CYCLE.coverlineShift;
    const t1 = temps[i], t2 = temps[i + 1], t3 = temps[i + 2];

    if (t1 != null && t2 != null && t3 != null && t1 > cover && t2 > cover && t3 > cover) {
      return Math.max(0, i - 1);
    }
  }
  return null;
}

/**
 * Build all overlay data for a flat days array.
 * Returns { fertile, threeHighs, peakPlusFour: Set<key>, coverline: number|null }
 */
function buildOverlays(days) {
  const fertile      = new Set();
  const threeHighs   = new Set();
  const peakPlusFour = new Set();
  let   coverline    = null;

  const ovIdx = detectOvulationIndex(days);

  if (ovIdx != null) {
    const windowStart = ovIdx - (CYCLE.ovulationLag - 1);
    const lows = days.slice(windowStart, ovIdx + 1).map(d => d.temp).filter(t => t != null);

    if (lows.length >= CYCLE.minLowTemps) {
      coverline = Math.max(...lows) + CYCLE.coverlineShift;
    }

    for (let i = windowStart; i <= ovIdx; i++)     if (days[i]) fertile.add(days[i].key);
    for (let i = ovIdx + 1; i <= ovIdx + 3; i++)   if (days[i]) threeHighs.add(days[i].key);
  }

  // Billings peak + 4
  let peakIndex = -1;
  days.forEach((day, i) => { if (day.discharge === "wet") peakIndex = i; });
  if (peakIndex !== -1) {
    for (let i = peakIndex; i <= peakIndex + 3; i++) if (days[i]) peakPlusFour.add(days[i].key);
  }

  return { fertile, threeHighs, peakPlusFour, coverline };
}

/* ─── domain: cycle interpretation ────────── */

function deriveCycleState(cycle) {
  const overlays = buildOverlays(cycle.entries);

  return {
    ...cycle,

    derived: {
      coverline: overlays.coverline,

      fertileWindow: overlays.fertile,

      threeHighs: overlays.threeHighs,

      peakPlusFour: overlays.peakPlusFour,
    },
  };
}

/* ─── domain: timeline columns ────────────── */

/** Runtime columns — built once per render(), consumed by all render fns. */
let currentColumns = [];

function buildColumns() {
  const keys = Object.keys(store.entries).sort();
  if (!keys.length) return [];

  const starts = getCycleStartDates();

  const days = keys.map((key, i) => {
    const raw  = store.entries[key];
    const date = parseDateKey(key);
    return {
      key,
      date,
      cycleDay:  resolveCycleDay(date, starts, i),
      temp:      raw.temp      ?? null,
      bleeding:  raw.bleeding  ?? "none",
      discharge: raw.discharge ?? "none",
      sediment:  raw.sediment  ?? false,
      other:     raw.other     ?? "",
    };
  });

const cycles = segmentCycles(days);

console.log("Cycles", cycles);

let globalIndex = 0;

return cycles.flatMap(cycle => {
  return cycle.entries.map(day => {
    const column = {
      index: globalIndex,
      x: columnX(globalIndex),
      centerX: columnCenterX(globalIndex),

      cycleId: cycle.id,

      ...day,

      overlays: {
        fertile: cycle.derived.fertileWindow.has(day.key),

        threeHigh:
          cycle.derived.threeHighs.has(day.key),

        peakPlusFour:
          cycle.derived.peakPlusFour.has(day.key),

        coverline:
          cycle.derived.coverline,
      },
    };

    globalIndex++;

    return column;
  });
});
}

/* ─── state mutations ─────────────────────── */

function selectColumn(key) { store.selectedKey = key; render(); }
function hoverColumn(key)  { store.hoveredKey  = key; renderChart(currentColumns); }
function clearHover()      { store.hoveredKey  = null; renderChart(currentColumns); }

/* ─── render: month label ─────────────────── */

function renderMonth() {
  qs("monthLabel").innerText = new Date(store.year, store.month)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}

/* ─── render: temperature scale ──────────── */

function renderTempScale() {
  const scale = qs("tempScale");
  if (!scale) return;
  scale.innerHTML = "";

  for (let temp = LAYOUT.maxTemp; temp >= LAYOUT.minTemp - 0.001; temp -= 0.5) {
    const label       = document.createElement("div");
    label.className   = "temp-scale-label";
    label.textContent = Number(temp).toFixed(1);
    label.style.top   = `${chartY(temp) - 9}px`;
    scale.appendChild(label);
  }
}

/* ─── render: calendar ────────────────────── */

function renderCalendar() {
  const el = qs("calendar");
  el.innerHTML = "";

  ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(day => {
    const w           = document.createElement("div");
    w.textContent     = day;
    w.style.textAlign = "center";
    w.style.fontSize  = "12px";
    w.style.opacity   = "0.6";
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
    if (store.selectedKey === key)          div.classList.add("selected");

    div.onclick = () => selectColumn(key);
    el.appendChild(div);
  }
}

/* ─── render: info panel ──────────────────── */

function renderInfo() {
  if (!store.selectedKey) {
    qs("infoTitle").innerText     = "No day selected";
    qs("infoTemp").innerText      = "-";
    qs("infoBleeding").innerText  = "-";
    qs("infoDischarge").innerText = "-";
    return;
  }

  const key    = store.selectedKey;
  const data   = store.entries[key] || {};
  const column = currentColumns.find(c => c.key === key);

  qs("infoTitle").innerText     = `${key} (CD ${column?.cycleDay ?? "-"})`;
  qs("infoTemp").innerText      = formatTemp(data.temp);
  qs("infoBleeding").innerText  = data.bleeding  !== "none" ? data.bleeding  : "-";
  qs("infoDischarge").innerText = data.discharge !== "none" ? data.discharge : "-";
}

/* ─── render: map rows ────────────────────── */

function makeCell(text = "", ...classes) {
  const cell     = document.createElement("div");
  cell.className = ["map-cell", ...classes].filter(Boolean).join(" ");
  cell.textContent = text;
  return cell;
}

function attachColumnEvents(el, column) {
  el.onmouseenter = () => hoverColumn(column.key);
  el.onmouseleave = () => clearHover();
  el.onclick      = () => selectColumn(column.key);
}

function renderMapRows(columns) {
  const rowIds = ["dayNumbers","cycleDayRow","mucusRow","bleedingRow","spottingRow","sedimentRow","otherRow"];
  const rows   = Object.fromEntries(rowIds.map(id => [id, qs(id)]));
  const width  = chartWidth(columns);

  Object.values(rows).forEach(row => { row.innerHTML = ""; row.style.width = `${width}px`; });

  columns.forEach(col => {
    const sel = store.selectedKey === col.key ? "selected-column" : "";

    // header day number
    const dayCell       = document.createElement("div");
    dayCell.className   = ["map-day", sel].filter(Boolean).join(" ");
    dayCell.textContent = col.date.getDate();
    attachColumnEvents(dayCell, col);
    rows.dayNumbers.appendChild(dayCell);

    // cycle day
    const cdCell = makeCell(col.cycleDay, sel);
    attachColumnEvents(cdCell, col);
    rows.cycleDayRow.appendChild(cdCell);

    // mucus
    const mucusCell = makeCell(
      MUCUS_LABELS[col.discharge] || "", sel,
      col.discharge === "wet"    ? "fertile"     : "",
      col.overlays.peakPlusFour  ? "peak-helper" : ""
    );
    attachColumnEvents(mucusCell, col);
    rows.mucusRow.appendChild(mucusCell);

    // bleeding
    const bleedCell = makeCell(
      col.bleeding === "menstruation" ? "●" : "", sel,
      col.bleeding === "menstruation" ? "period" : ""
    );
    attachColumnEvents(bleedCell, col);
    rows.bleedingRow.appendChild(bleedCell);

    // spotting
    const spottingCell = makeCell(
      col.bleeding === "spotting" ? "◐" : "", sel,
      col.bleeding === "spotting" ? "spotting" : ""
    );
    attachColumnEvents(spottingCell, col);
    rows.spottingRow.appendChild(spottingCell);

    // sediment
    const sedimentCell = makeCell(col.sediment ? "S" : "", sel);
    attachColumnEvents(sedimentCell, col);
    rows.sedimentRow.appendChild(sedimentCell);

    // other
    const otherCell = makeCell(col.other, sel);
    attachColumnEvents(otherCell, col);
    rows.otherRow.appendChild(otherCell);
  });
}

/* ─── render: canvas chart ────────────────── */

function drawVerticalGrid(ctx, columns) {
  columns.forEach(col => {
    const x = Math.round(col.x) + 0.5;
    ctx.beginPath();
    ctx.strokeStyle = col.index % 5 === 0 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.05)";
    ctx.moveTo(x, LAYOUT.chartPaddingTop);
    ctx.lineTo(x, LAYOUT.chartHeight - LAYOUT.chartPaddingBottom);
    ctx.stroke();
  });
  const lastX = chartWidth(columns) + 0.5;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.moveTo(lastX, LAYOUT.chartPaddingTop);
  ctx.lineTo(lastX, LAYOUT.chartHeight - LAYOUT.chartPaddingBottom);
  ctx.stroke();
}

function drawHorizontalGrid(ctx, canvasWidth) {
  const steps = Math.round((LAYOUT.maxTemp - LAYOUT.minTemp) * 10);
  for (let i = 0; i <= steps; i++) {
    const y = Math.round(chartY(LAYOUT.minTemp + i / 10)) + 0.5;
    ctx.beginPath();
    ctx.strokeStyle = i % 5 === 0 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.05)";
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
}

function drawOverlayBands(ctx, columns) {
  columns.forEach(col => {
    if (col.overlays.fertile) {
      ctx.fillStyle = "rgba(34,197,94,0.12)";
      ctx.fillRect(col.x, LAYOUT.chartPaddingTop, LAYOUT.columnWidth, graphHeight());
    }
    if (col.overlays.peakPlusFour) {
      ctx.fillStyle = "rgba(168,85,247,0.08)";
      ctx.fillRect(col.x, LAYOUT.chartPaddingTop, LAYOUT.columnWidth, graphHeight());
    }
  });
}

function drawSelectedHighlight(ctx, columns) {
  if (!store.selectedKey) return;
  const col = columns.find(c => c.key === store.selectedKey);
  if (!col) return;
  ctx.fillStyle = "rgba(37,99,235,0.08)";
  ctx.fillRect(col.x, 0, LAYOUT.columnWidth, LAYOUT.chartHeight);
}

function drawHoverLine(ctx, columns) {
  if (!store.hoveredKey) return;
  const col = columns.find(c => c.key === store.hoveredKey);
  if (!col) return;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(37,99,235,0.45)";
  ctx.moveTo(col.centerX, 0);
  ctx.lineTo(col.centerX, LAYOUT.chartHeight);
  ctx.stroke();
}

function drawCoverlines(ctx, columns) {
  const cycles = [];

  columns.forEach(col => {
    const lastCycle = cycles[cycles.length - 1];

    const currentCoverline =
      col.overlays.coverline;

    if (
      !lastCycle ||
      lastCycle.coverline !== currentCoverline
    ) {
      cycles.push({
        coverline: currentCoverline,
        columns: [col],
      });

      return;
    }

    lastCycle.columns.push(col);
  });

  cycles.forEach(cycle => {
    if (cycle.coverline == null) return;

    const startX = cycle.columns[0].x;

    const endX =
      cycle.columns[cycle.columns.length - 1].x +
      LAYOUT.columnWidth;

    ctx.beginPath();
    ctx.setLineDash([6, 4]);

    ctx.strokeStyle = "rgba(220,38,38,0.7)";
    ctx.lineWidth = 1.5;

    ctx.moveTo(startX, chartY(cycle.coverline));
    ctx.lineTo(endX, chartY(cycle.coverline));

    ctx.stroke();

    ctx.setLineDash([]);
    ctx.lineWidth = 1;
  });
}

function drawCycleSeparators(ctx, cycleGroups) {
  cycleGroups.slice(1).forEach(group => {
    const firstColumn = group.columns[0];

    const x = firstColumn.x - 0.5;

    ctx.beginPath();

    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;

    ctx.moveTo(x, 0);
    ctx.lineTo(x, LAYOUT.chartHeight);

    ctx.stroke();
  });
}

function drawTemperatureLine(ctx, cycleGroups) {
  cycleGroups.forEach(group => {
    const valid =
      group.columns.filter(c => c.temp != null);

    if (valid.length < 2) return;

    ctx.beginPath();

    valid.forEach((col, i) => {
      if (i === 0) {
        ctx.moveTo(
          col.centerX,
          chartY(col.temp)
        );

        return;
      }

      ctx.lineTo(
        col.centerX,
        chartY(col.temp)
      );
    });

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;

    ctx.stroke();
  });

  ctx.lineWidth = 1;
}

function drawTemperaturePoints(ctx, columns) {
  columns.forEach(col => {
    if (col.temp == null) return;
    ctx.beginPath();
    ctx.arc(col.centerX, chartY(col.temp), 4, 0, Math.PI * 2);
    ctx.fillStyle = store.selectedKey === col.key ? "#2563eb" : "#111";
    ctx.fill();
  });
}
function groupColumnsByCycle(columns) {
  const groups = [];

  columns.forEach(column => {
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || lastGroup.id !== column.cycleId) {
      groups.push({
        id: column.cycleId,
        columns: [column],
      });

      return;
    }

    lastGroup.columns.push(column);
  });

  return groups;
}

function renderChart(columns) {
  const canvas = qs("tempChart");
  if (!canvas) return;

  const width = chartWidth(columns);
  const dpr   = window.devicePixelRatio || 1;
  const ctx   = canvas.getContext("2d");
  const cycleGroups =
    groupColumnsByCycle(columns);

    console.log("Cycle groups", cycleGroups);

  canvas.style.width  = `${width}px`;
  canvas.style.height = `${LAYOUT.chartHeight}px`;
  canvas.width        = width * dpr;
  canvas.height       = LAYOUT.chartHeight * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, LAYOUT.chartHeight);

  // draw order matters: bg → overlays → grid → annotations → data
  drawSelectedHighlight(ctx, columns);
  drawOverlayBands(ctx, columns);
  drawVerticalGrid(ctx, columns);
  drawHorizontalGrid(ctx, width);
  drawCycleSeparators(ctx, cycleGroups);
  drawHoverLine(ctx, columns);
  drawCoverlines(ctx, columns);
  drawTemperatureLine(ctx, cycleGroups);
  drawTemperaturePoints(ctx, columns);
}

/* ─── modal ───────────────────────────────── */

function syncModalUI() {
  qsa(".segmented").forEach(group => {
    const name = group.dataset.group;
    group.querySelectorAll("button").forEach(btn => {
      const active = name === "sediment"
        ? String(store.modal.sediment) === btn.dataset.value
        : store.modal[name] === btn.dataset.value;
      btn.classList.toggle("active", active);
    });
  });
}

function openModal() {
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
  };

  qs("modalTitle").innerText = `${key} (CD ${column?.cycleDay ?? "-"})`;
  qs("tempInput").value      = store.modal.temp != null ? Number(store.modal.temp).toFixed(2) : "";
  qs("otherInput").value     = store.modal.other;

  syncModalUI();

  const modal = qs("modal");
  modal.classList.remove("hidden");
  requestAnimationFrame(() => modal.classList.add("show"));
}

function closeModal() {
  const modal = qs("modal");
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

function validateTempInput() {
  const raw = qs("tempInput")?.value.trim();
  if (!raw) return true;
  const value = parseFloat(raw);
  return !isNaN(value) && isValidTemp(value);
}

function saveModal() {
  if (!store.selectedKey || !validateTempInput()) return;

  const temp = parseFloat(qs("tempInput").value);
  store.modal.temp  = isNaN(temp) ? null : temp;
  store.modal.other = qs("otherInput").value.trim();

  store.entries[store.selectedKey] = {
    ...(store.entries[store.selectedKey] || {}),
    ...store.modal,
  };

  store.save();
  closeModal();
  setTimeout(render, 200);
}

/* ─── top-level render ────────────────────── */

function render() {
  renderMonth();
  renderCalendar();
  renderTempScale();
  currentColumns = buildColumns();
  renderMapRows(currentColumns);
  renderChart(currentColumns);
  renderInfo();
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

  qs("editBtn").onclick  = openModal;
  qs("closeBtn").onclick = closeModal;
  qs("saveBtn").onclick  = saveModal;

  qs("tempInput").oninput = validateTempInput;

  qsa(".segmented button").forEach(btn => {
    btn.onclick = () => {
      const group = btn.parentElement.dataset.group;
      const value = btn.dataset.value;
      if (group === "sediment") {
        store.modal.sediment = value === "true";
      } else {
        store.modal[group] = value;
      }
      syncModalUI();
    };
  });

  qs("devReset").onclick = () => { store.reset(); render(); };
}

/* ─── boot ────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  init();
  render();
});
