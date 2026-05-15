// app.js

const qs = id => document.getElementById(id);
const qsa = selector => document.querySelectorAll(selector);

/* layout */

const LAYOUT = {
  columnWidth: 36,
  sideLabelWidth: 68,
  tempScaleWidth: 52,

  chartHeight: 260,
  chartPaddingTop: 20,
  chartPaddingBottom: 24,

  minTemp: 36.0,
  maxTemp: 37.5
};

/* utils */

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
  const d = normalize(date);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getOffset(year, month) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function formatTemp(temp) {
  return temp != null
    ? Number(temp).toFixed(2)
    : "-";
}

function isValidTemp(temp) {
  return (
    temp == null ||
    (temp >= 34 && temp <= 42)
  );
}

function getColumnWidth() {
  return LAYOUT.columnWidth;
}

function getColumnX(index) {
  return index * getColumnWidth();
}

function getColumnCenterX(index) {
  return getColumnX(index) + getColumnWidth() / 2;
}

function getChartWidth(columns) {
  return columns.length * getColumnWidth();
}

function getGraphHeight() {
  return (
    LAYOUT.chartHeight -
    LAYOUT.chartPaddingTop -
    LAYOUT.chartPaddingBottom
  );
}

function getChartY(temp) {
  return (
    LAYOUT.chartPaddingTop +
    (
      (LAYOUT.maxTemp - temp) /
      (LAYOUT.maxTemp - LAYOUT.minTemp)
    ) * getGraphHeight()
  );
}

function syncLayoutVariables() {
  document.documentElement.style.setProperty(
    "--column-width",
    `${LAYOUT.columnWidth}px`
  );

  document.documentElement.style.setProperty(
    "--label-width",
    `${LAYOUT.sideLabelWidth}px`
  );

  document.documentElement.style.setProperty(
    "--temp-scale-width",
    `${LAYOUT.tempScaleWidth}px`
  );

  document.documentElement.style.setProperty(
    "--chart-height",
    `${LAYOUT.chartHeight}px`
  );
}

/* store */

class Store {

  constructor() {

    this.entries = JSON.parse(
      localStorage.getItem("cycleData") || "{}"
    );

    this.selectedColumnKey = null;

    this.hoveredColumnKey = null;

    const now = new Date();

    this.month = now.getMonth();

    this.year = now.getFullYear();

    this.modal = {
      temp: null,
      bleeding: "none",
      discharge: "none",
      sediment: false,
      other: ""
    };

  }

  save() {

    localStorage.setItem(
      "cycleData",
      JSON.stringify(this.entries)
    );

  }

}

const store = new Store();

/* state */

function selectColumn(key) {

  store.selectedColumnKey = key;

  render();

}

function hoverColumn(key) {

  store.hoveredColumnKey = key;

  renderChart(currentColumns);

}

function clearHover() {

  store.hoveredColumnKey = null;

  renderChart(currentColumns);

}

/* cycles */

function getCycleStartDates() {

  const keys = Object.keys(store.entries)
    .sort();

  const starts = [];

  keys.forEach((key, index) => {

    const current = store.entries[key];

    if (current?.bleeding !== "menstruation") {
      return;
    }

    const prevKey = keys[index - 1];

    const prev = store.entries[prevKey];

    const previousWasPeriod =
      prev?.bleeding === "menstruation";

    if (!previousWasPeriod) {

      starts.push(
        normalize(
          parseDateKey(key)
        )
      );

    }

  });

  return starts;

}

function buildCycles() {

  const starts = getCycleStartDates();

  if (!starts.length) {
    return [];
  }

  const cycles = [];

  starts.forEach((start, index) => {

    const next =
      starts[index + 1] || null;

    const cycle = {
      id: index + 1,
      startDate: new Date(start),
      days: []
    };

    let d = new Date(start);

    let cycleDay = 1;

    let safety = 0;

    while (
      (!next || d < next) &&
      safety < 90
    ) {

      const key = formatDateKey(d);

      const raw =
        store.entries[key] || {};

      cycle.days.push({
        key,
        date: new Date(d),
        cycleDay,

        temp: raw.temp ?? null,
        bleeding: raw.bleeding ?? "none",
        discharge: raw.discharge ?? "none",
        sediment: raw.sediment ?? false,
        other: raw.other ?? ""
      });

      d.setDate(
        d.getDate() + 1
      );

      cycleDay++;
      safety++;

    }

    cycles.push(cycle);

  });

  return cycles;

}

function getLatestCycle() {

  const cycles = buildCycles();

  if (cycles.length) {

    return cycles[
      cycles.length - 1
    ];

  }

  const keys =
    Object.keys(store.entries)
      .sort();

  if (!keys.length) {
    return null;
  }

  return {
    id: 1,
    startDate: parseDateKey(keys[0]),

    days: keys.map((key, index) => {

      const raw = store.entries[key];

      return {
        key,
        date: parseDateKey(key),
        cycleDay: index + 1,

        temp: raw.temp ?? null,
        bleeding: raw.bleeding ?? "none",
        discharge: raw.discharge ?? "none",
        sediment: raw.sediment ?? false,
        other: raw.other ?? ""
      };

    })

  };

}

/* overlays */

function detectOvulation(days) {

  const temps =
    days.map(day => day.temp);

  for (let i = 6; i < temps.length - 2; i++) {

    const lows =
      temps.slice(i - 6, i);

    const valid =
      lows.filter(
        temp => temp != null
      );

    if (valid.length < 4) {
      continue;
    }

    const maxLow =
      Math.max(...valid);

    const cover =
      maxLow + 0.05;

    const t1 = temps[i];
    const t2 = temps[i + 1];
    const t3 = temps[i + 2];

    if (
      t1 == null ||
      t2 == null ||
      t3 == null
    ) {
      continue;
    }

    if (
      t1 > cover &&
      t2 > cover &&
      t3 > cover
    ) {

      return Math.max(0, i - 1);

    }

  }

  return null;

}

function buildOverlays(days) {

  const fertile = new Set();

  const threeHighs = new Set();

  const peakPlusFour = new Set();

  const ovulationIndex =
    detectOvulation(days);

  let coverline = null;

  if (ovulationIndex != null) {

    const lows = days
      .slice(
        ovulationIndex - 5,
        ovulationIndex + 1
      )
      .map(day => day.temp)
      .filter(Boolean);

    if (lows.length >= 4) {

      coverline =
        Math.max(...lows) + 0.05;

    }

    for (
      let i = ovulationIndex - 5;
      i <= ovulationIndex;
      i++
    ) {

      if (days[i]) {
        fertile.add(days[i].key);
      }

    }

    for (
      let i = ovulationIndex + 1;
      i <= ovulationIndex + 3;
      i++
    ) {

      if (days[i]) {
        threeHighs.add(days[i].key);
      }

    }

  }

  let peakIndex = -1;

  days.forEach((day, index) => {

    if (day.discharge === "wet") {
      peakIndex = index;
    }

  });

  if (peakIndex !== -1) {

    for (
      let i = peakIndex;
      i <= peakIndex + 3;
      i++
    ) {

      if (days[i]) {
        peakPlusFour.add(days[i].key);
      }

    }

  }

  return {
    fertile,
    threeHighs,
    peakPlusFour,
    coverline
  };

}

/* columns */

function buildCycleColumns(cycle) {

  if (!cycle) {
    return [];
  }

  const overlays =
    buildOverlays(cycle.days);

  return cycle.days.map((day, index) => ({
    index,

    x: getColumnX(index),

    centerX:
      getColumnCenterX(index),

    key: day.key,
    date: day.date,
    cycleDay: day.cycleDay,

    temp: day.temp,
    bleeding: day.bleeding,
    discharge: day.discharge,
    sediment: day.sediment,
    other: day.other,

    overlays: {
      fertile:
        overlays.fertile.has(day.key),

      threeHigh:
        overlays.threeHighs.has(day.key),

      peakPlusFour:
        overlays.peakPlusFour.has(day.key)
    }
  }));

}

let currentColumns = [];

/* calendar */

function renderMonth() {

  qs("monthLabel").innerText =
    new Date(
      store.year,
      store.month
    ).toLocaleString("en-US", {
      month: "long",
      year: "numeric"
    });

}

function renderTempScale() {

  const scale =
    qs("tempScale");

  if (!scale) {
    return;
  }

  scale.innerHTML = "";

  for (
    let temp = LAYOUT.maxTemp;
    temp >= LAYOUT.minTemp;
    temp -= 0.5
  ) {

    const label =
      document.createElement("div");

    label.className =
      "temp-scale-label";

    label.textContent =
      Number(temp).toFixed(1);

    const y =
      getChartY(temp);

    label.style.top =
      `${y - 9}px`;

    scale.appendChild(label);

  }

}

function renderCalendar() {

  const el = qs("calendar");

  el.innerHTML = "";

  [
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun"
  ].forEach(day => {

    const w =
      document.createElement("div");

    w.textContent = day;

    w.style.textAlign = "center";
    w.style.fontSize = "12px";
    w.style.opacity = "0.6";

    el.appendChild(w);

  });

  const days =
    getDaysInMonth(
      store.year,
      store.month
    );

  const off =
    getOffset(
      store.year,
      store.month
    );

  for (let i = 0; i < off; i++) {

    el.appendChild(
      document.createElement("div")
    );

  }

  for (let d = 1; d <= days; d++) {

    const date = new Date(
      store.year,
      store.month,
      d
    );

    const key =
      formatDateKey(date);

    const entry =
      store.entries[key];

    const div =
      document.createElement("div");

    div.className = "day";

    div.textContent = d;

    if (
      entry?.bleeding ===
      "menstruation"
    ) {

      div.classList.add("red");

    }

    if (
      store.selectedColumnKey === key
    ) {

      div.classList.add("selected");

    }

    div.onclick = () => {
      selectColumn(key);
    };

    el.appendChild(div);

  }

}

/* info */

function renderInfo() {

  if (!store.selectedColumnKey) {

    qs("infoTitle").innerText =
      "No day selected";

    qs("infoTemp").innerText = "-";
    qs("infoBleeding").innerText = "-";
    qs("infoDischarge").innerText = "-";

    return;

  }

  const key =
    store.selectedColumnKey;

  const data =
    store.entries[key] || {};

  const column =
    currentColumns.find(
      x => x.key === key
    );

  qs("infoTitle").innerText =
    `${key} (CD ${column?.cycleDay || "-"})`;

  qs("infoTemp").innerText =
    formatTemp(data.temp);

  qs("infoBleeding").innerText =
    data.bleeding !== "none"
      ? data.bleeding
      : "-";

  qs("infoDischarge").innerText =
    data.discharge !== "none"
      ? data.discharge
      : "-";

}

/* map */

function createMapCell(
  text = "",
  className = ""
) {

  const cell =
    document.createElement("div");

  cell.className =
    `map-cell ${className}`;

  cell.textContent = text;

  return cell;

}

function attachColumnEvents(el, column) {

  el.onmouseenter = () => {
    hoverColumn(column.key);
  };

  el.onmouseleave = () => {
    clearHover();
  };

  el.onclick = () => {
    selectColumn(column.key);
  };

}

function renderMapRows(columns) {

  const rows = {
    dayNumbers: qs("dayNumbers"),
    cycleDayRow: qs("cycleDayRow"),
    mucusRow: qs("mucusRow"),
    bleedingRow: qs("bleedingRow"),
    spottingRow: qs("spottingRow"),
    sedimentRow: qs("sedimentRow"),
    otherRow: qs("otherRow")
  };

  const width =
    getChartWidth(columns);

  Object.values(rows).forEach(row => {

    row.innerHTML = "";

    row.style.width =
      `${width}px`;

  });

  columns.forEach(column => {

    const selected =
      store.selectedColumnKey ===
      column.key;

    const selectedClass =
      selected
        ? "selected-column"
        : "";

    const dayCell =
      document.createElement("div");

    dayCell.className =
      `map-day ${selectedClass}`;

    dayCell.textContent =
      column.date.getDate();

    attachColumnEvents(
      dayCell,
      column
    );

    rows.dayNumbers.appendChild(
      dayCell
    );

    const cycleCell =
      createMapCell(
        column.cycleDay,
        selectedClass
      );

    attachColumnEvents(
      cycleCell,
      column
    );

    rows.cycleDayRow.appendChild(
      cycleCell
    );

    const mucusMap = {
      dry: "D",
      moist: "M",
      wet: "W"
    };

    const mucusCell =
      createMapCell(
        mucusMap[column.discharge] || "",
        `
        ${selectedClass}
        ${column.discharge === "wet" ? "fertile" : ""}
        ${column.overlays.peakPlusFour ? "peak-helper" : ""}
        `
      );

    attachColumnEvents(
      mucusCell,
      column
    );

    rows.mucusRow.appendChild(
      mucusCell
    );

    const bleedCell =
      createMapCell(
        column.bleeding === "menstruation"
          ? "●"
          : "",
        `
        ${selectedClass}
        ${column.bleeding === "menstruation" ? "period" : ""}
        `
      );

    attachColumnEvents(
      bleedCell,
      column
    );

    rows.bleedingRow.appendChild(
      bleedCell
    );

    const spottingCell =
      createMapCell(
        column.bleeding === "spotting"
          ? "◐"
          : "",
        `
        ${selectedClass}
        ${column.bleeding === "spotting" ? "spotting" : ""}
        `
      );

    attachColumnEvents(
      spottingCell,
      column
    );

    rows.spottingRow.appendChild(
      spottingCell
    );

    const sedimentCell =
      createMapCell(
        column.sediment ? "S" : "",
        selectedClass
      );

    attachColumnEvents(
      sedimentCell,
      column
    );

    rows.sedimentRow.appendChild(
      sedimentCell
    );

    const otherCell =
      createMapCell(
        column.other,
        selectedClass
      );

    attachColumnEvents(
      otherCell,
      column
    );

    rows.otherRow.appendChild(
      otherCell
    );

  });

}

/* chart */

function drawVerticalGrid(
  ctx,
  columns
) {

  columns.forEach(column => {

    const x =
      Math.round(column.x) + 0.5;

    ctx.beginPath();

    ctx.strokeStyle =
      column.index % 5 === 0
        ? "rgba(0,0,0,0.15)"
        : "rgba(0,0,0,0.05)";

    ctx.moveTo(
      x,
      LAYOUT.chartPaddingTop
    );

    ctx.lineTo(
      x,
      LAYOUT.chartHeight -
      LAYOUT.chartPaddingBottom
    );

    ctx.stroke();

  });

  const lastX =
    getChartWidth(columns) + 0.5;

  ctx.beginPath();

  ctx.strokeStyle =
    "rgba(0,0,0,0.15)";

  ctx.moveTo(
    lastX,
    LAYOUT.chartPaddingTop
  );

  ctx.lineTo(
    lastX,
    LAYOUT.chartHeight -
    LAYOUT.chartPaddingBottom
  );

  ctx.stroke();

}

function drawHorizontalGrid(ctx) {

  const steps =
    Math.round(
      (LAYOUT.maxTemp - LAYOUT.minTemp) * 10
    );

  for (let i = 0; i <= steps; i++) {

    const temp =
      LAYOUT.minTemp + i / 10;

    const y =
      Math.round(
        getChartY(temp)
      ) + 0.5;

    ctx.beginPath();

    ctx.strokeStyle =
      i % 5 === 0
        ? "rgba(0,0,0,0.15)"
        : "rgba(0,0,0,0.05)";

    ctx.moveTo(0, y);

    ctx.lineTo(
      ctx.canvas.width,
      y
    );

    ctx.stroke();

  }

}

function drawOverlayLayer(
  ctx,
  columns
) {

  columns.forEach(column => {

    if (column.overlays.fertile) {

      ctx.fillStyle =
        "rgba(34,197,94,0.12)";

      ctx.fillRect(
        column.x,
        LAYOUT.chartPaddingTop,
        getColumnWidth(),
        getGraphHeight()
      );

    }

    if (column.overlays.peakPlusFour) {

      ctx.fillStyle =
        "rgba(168,85,247,0.08)";

      ctx.fillRect(
        column.x,
        LAYOUT.chartPaddingTop,
        getColumnWidth(),
        getGraphHeight()
      );

    }

  });

}

function drawSelectedColumn(
  ctx,
  columns
) {

  if (!store.selectedColumnKey) {
    return;
  }

  const column =
    columns.find(
      x =>
        x.key ===
        store.selectedColumnKey
    );

  if (!column) {
    return;
  }

  ctx.fillStyle =
    "rgba(37,99,235,0.08)";

  ctx.fillRect(
    column.x,
    0,
    getColumnWidth(),
    LAYOUT.chartHeight
  );

}

function drawHoverLine(
  ctx,
  columns
) {

  if (!store.hoveredColumnKey) {
    return;
  }

  const column =
    columns.find(
      x =>
        x.key ===
        store.hoveredColumnKey
    );

  if (!column) {
    return;
  }

  ctx.beginPath();

  ctx.strokeStyle =
    "rgba(37,99,235,0.45)";

  ctx.moveTo(
    column.centerX,
    0
  );

  ctx.lineTo(
    column.centerX,
    LAYOUT.chartHeight
  );

  ctx.stroke();

}

function drawTemperatureLine(
  ctx,
  columns
) {

  const valid =
    columns.filter(
      column =>
        column.temp != null
    );

  if (valid.length < 2) {
    return;
  }

  ctx.beginPath();

  valid.forEach((column, index) => {

    const x =
      column.centerX;

    const y =
      getChartY(column.temp);

    if (index === 0) {

      ctx.moveTo(x, y);

      return;

    }

    ctx.lineTo(x, y);

  });

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;

  ctx.stroke();

}

function drawTemperaturePoints(
  ctx,
  columns
) {

  columns.forEach(column => {

    if (column.temp == null) {
      return;
    }

    ctx.beginPath();

    ctx.arc(
      column.centerX,
      getChartY(column.temp),
      4,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      store.selectedColumnKey ===
      column.key
        ? "#2563eb"
        : "#111";

    ctx.fill();

  });

}

function drawCoverline(
  ctx,
  cycle
) {

  const overlays =
    buildOverlays(cycle.days);

  if (
    overlays.coverline == null
  ) {
    return;
  }

  const y =
    getChartY(
      overlays.coverline
    );

  ctx.beginPath();

  ctx.setLineDash([6, 4]);

  ctx.strokeStyle =
    "rgba(220,38,38,0.7)";

  ctx.moveTo(0, y);

  ctx.lineTo(
    ctx.canvas.width,
    y
  );

  ctx.stroke();

  ctx.setLineDash([]);

}

function renderChart(columns) {

  const canvas =
    qs("tempChart");

  if (!canvas) {
    return;
  }

  const width =
    getChartWidth(columns);

  const ctx =
    canvas.getContext("2d");

  const dpr =
    window.devicePixelRatio || 1;

  canvas.style.width =
    `${width}px`;

  canvas.style.height =
    `${LAYOUT.chartHeight}px`;

  canvas.width =
    width * dpr;

  canvas.height =
    LAYOUT.chartHeight * dpr;

  ctx.setTransform(
    1, 0, 0, 1, 0, 0
  );

  ctx.scale(dpr, dpr);

  ctx.clearRect(
    0,
    0,
    width,
    LAYOUT.chartHeight
  );

  drawSelectedColumn(
    ctx,
    columns
  );

  drawOverlayLayer(
    ctx,
    columns
  );

  drawVerticalGrid(
    ctx,
    columns
  );

  drawHorizontalGrid(ctx);

  drawHoverLine(
    ctx,
    columns
  );

  drawTemperatureLine(
    ctx,
    columns
  );

  drawTemperaturePoints(
    ctx,
    columns
  );

  const cycle =
    getLatestCycle();

  if (cycle) {

    drawCoverline(
      ctx,
      cycle
    );

  }

}

/* modal */

function updateUI() {

  qsa(".segmented")
    .forEach(group => {

      const name =
        group.dataset.group;

      group
        .querySelectorAll("button")
        .forEach(button => {

          const value =
            button.dataset.value;

          if (name === "sediment") {

            button.classList.toggle(
              "active",
              String(
                store.modal.sediment
              ) === value
            );

            return;

          }

          button.classList.toggle(
            "active",
            store.modal[name] === value
          );

        });

    });

}

function openModal() {

  if (!store.selectedColumnKey) {
    return;
  }

  const key =
    store.selectedColumnKey;

  const data =
    store.entries[key] || {};

  const column =
    currentColumns.find(
      x => x.key === key
    );

  store.modal = {
    temp: data.temp ?? null,
    bleeding: data.bleeding ?? "none",
    discharge: data.discharge ?? "none",
    sediment: data.sediment ?? false,
    other: data.other ?? ""
  };

  qs("modalTitle").innerText =
    `${key} (CD ${column?.cycleDay || "-"})`;

  qs("tempInput").value =
    store.modal.temp != null
      ? Number(store.modal.temp).toFixed(2)
      : "";

  qs("otherInput").value =
    store.modal.other;

  updateUI();

  qs("modal")
    .classList
    .remove("hidden");

  setTimeout(() => {

    qs("modal")
      .classList
      .add("show");

  }, 10);

}

function closeModal() {

  qs("modal")
    .classList
    .remove("show");

  setTimeout(() => {

    qs("modal")
      .classList
      .add("hidden");

  }, 200);

}

function validateTempInput() {

  const raw =
    qs("tempInput")
      ?.value
      .trim();

  if (raw === "") {
    return true;
  }

  const value =
    parseFloat(raw);

  return (
    !isNaN(value) &&
    isValidTemp(value)
  );

}

/* render */

function render() {

  renderMonth();

  renderCalendar();

  renderTempScale();

  const cycle =
    getLatestCycle();

  currentColumns =
    buildCycleColumns(cycle);

  renderMapRows(
    currentColumns
  );

  renderChart(
    currentColumns
  );

  renderInfo();

}
/* reset */

function resetApp() {

  localStorage.removeItem(
    "cycleData"
  );

  store.entries = {};

  store.selectedColumnKey = null;

  store.hoveredColumnKey = null;

  const now = new Date();

  store.month =
    now.getMonth();

  store.year =
    now.getFullYear();

  render();

}

/* init */

function init() {

  syncLayoutVariables();

  qs("tempInput").oninput =
    validateTempInput;

  qs("prevMonth").onclick = () => {

    store.month--;

    if (store.month < 0) {

      store.month = 11;

      store.year--;

    }

    render();

  };

  qs("nextMonth").onclick = () => {

    store.month++;

    if (store.month > 11) {

      store.month = 0;

      store.year++;

    }

    render();

  };

  qs("editBtn").onclick =
    openModal;

  qs("closeBtn").onclick =
    closeModal;

  qs("saveBtn").onclick = () => {

    if (!store.selectedColumnKey) {
      return;
    }

    if (!validateTempInput()) {
      return;
    }

    const key =
      store.selectedColumnKey;

    const temp =
      parseFloat(
        qs("tempInput").value
      );

    store.modal.temp =
      isNaN(temp)
        ? null
        : temp;

    store.modal.other =
      qs("otherInput")
        .value
        .trim();

    store.entries[key] = {
      ...(store.entries[key] || {}),
      ...store.modal
    };

    store.save();

    closeModal();

    setTimeout(() => {
      render();
    }, 200);

  };

  qsa(".segmented button")
    .forEach(button => {

      button.onclick = () => {

        const group =
          button.parentElement
            .dataset.group;

        const value =
          button.dataset.value;

        if (group === "sediment") {

          store.modal.sediment =
            value === "true";

        } else {

          store.modal[group] =
            value;

        }

        updateUI();

      };

    });

  qs("devReset").onclick =
    resetApp;

}

/* boot */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    init();

    render();

  }
);