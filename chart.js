// chart.js — Canvas rendering and coverline interaction
// ─────────────────────────────────────────────
// Owns all draw* functions, renderChart, and handleCanvasClick.
// Draw order: bg → overlays → grid → annotations → data

import { store } from "./store.js";
import { LAYOUT, qs, chartY, graphHeight, chartWidth, getCycleCoverlineValues, setCycleCoverlineValues } from "./app.js";

/* ─── cycle grouping ──────────────────────── */

/** Groups columns by cycleId — used to draw temperature lines per cycle. */
export function groupColumnsByCycle(columns) {
  const groups = [];
  columns.forEach(column => {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup || lastGroup.id !== column.cycleId) {
      groups.push({ id: column.cycleId, columns: [column] });
      return;
    }
    lastGroup.columns.push(column);
  });
  return groups;
}

/* ─── grid ────────────────────────────────── */

/** Draws vertical column separators. Every 5th line is darker. */
export function drawVerticalGrid(ctx, columns) {
  columns.forEach(col => {
    const x = Math.round(col.x) + 0.5;
    ctx.beginPath();
    ctx.lineWidth   = 1;
    ctx.strokeStyle = col.index % 5 === 0 ? "#d4d4da" : "#e5e5ea";
    ctx.moveTo(x, LAYOUT.chartPaddingTop);
    ctx.lineTo(x, LAYOUT.chartHeight - LAYOUT.chartPaddingBottom);
    ctx.stroke();
  });
  const lastX = chartWidth(columns) + 0.5;
  ctx.beginPath();
  ctx.lineWidth   = 1;
  ctx.strokeStyle = "#d4d4da";
  ctx.moveTo(lastX, LAYOUT.chartPaddingTop);
  ctx.lineTo(lastX, LAYOUT.chartHeight - LAYOUT.chartPaddingBottom);
  ctx.stroke();
  ctx.lineWidth = 1;
}

/** Draws horizontal temperature grid lines. Every 5th line is darker. */
export function drawHorizontalGrid(ctx, canvasWidth) {
  for (let i = 0; i <= 15; i++) {
    const y = Math.floor(chartY(LAYOUT.minTemp + i / 10)) + 0.5;
    ctx.beginPath();
    ctx.lineWidth   = 1;
    ctx.strokeStyle = i % 5 === 0 ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.3)";
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
}

/* ─── overlays ────────────────────────────── */

/** Fills fertile and peak day columns with a color band. */
export function drawOverlayBands(ctx, columns) {
  columns.forEach(col => {
    if (col.isFertile) {
      ctx.fillStyle = "rgba(34,197,94,0.12)";
      ctx.fillRect(col.x, LAYOUT.chartPaddingTop, LAYOUT.columnWidth, graphHeight());
    }
  });
}

/** Highlights the currently selected column. */
export function drawSelectedHighlight(ctx, columns) {
  if (!store.selectedKey) return;
  const col = columns.find(c => c.key === store.selectedKey);
  if (!col) return;
  ctx.fillStyle = "rgba(37,99,235,0.08)";
  ctx.fillRect(col.x, 0, LAYOUT.columnWidth, LAYOUT.chartHeight);
}

/** Draws a vertical hover line on the currently hovered column. */
export function drawHoverLine(ctx, columns) {
  if (!store.hoveredKey) return;
  const col = columns.find(c => c.key === store.hoveredKey);
  if (!col) return;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(37,99,235,0.45)";
  ctx.moveTo(col.centerX, 0);
  ctx.lineTo(col.centerX, LAYOUT.chartHeight);
  ctx.stroke();
}

/* ─── coverlines ──────────────────────────── */

/** Draws the manually placed horizontal coverline as a dashed red line. */
export function drawHorizontalCoverline(ctx, columns) {
  const { horizontalGuideY } = getCycleCoverlineValues();
  if (horizontalGuideY == null) return;

  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(180,20,20,0.8)";
  ctx.lineWidth = 1.5;

  ctx.moveTo(0, horizontalGuideY);
  ctx.lineTo(chartWidth(columns), horizontalGuideY);

  ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

/** Draws the manually placed vertical coverline as a dashed red line. */
export function drawVerticalCoverline(ctx) {
  const { verticalGuideX } = getCycleCoverlineValues();
  if (verticalGuideX == null) return;

  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(180,20,20,0.8)";
  ctx.lineWidth = 1.5;

  ctx.moveTo(verticalGuideX, LAYOUT.chartPaddingTop);
  ctx.lineTo(
    verticalGuideX,
    LAYOUT.chartHeight - LAYOUT.chartPaddingBottom
  );

  ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}
/** Draws vertical separators between cycle groups. */
export function drawCycleSeparators(ctx, cycleGroups) {
  cycleGroups.slice(1).forEach(group => {
    const x = group.columns[0].x - 0.5;
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 2;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, LAYOUT.chartHeight);
    ctx.stroke();
  });
}

/* ─── temperature data ────────────────────── */

/** Draws the temperature line — one path per cycle group to avoid cross-cycle connections. */
export function drawTemperatureLine(ctx, cycleGroups) {
  cycleGroups.forEach(group => {
    const valid = group.columns.filter(c => c.temp != null);
    if (valid.length < 2) return;

    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;

    valid.forEach((col, i) => {
      if (i === 0) return;
      const prev = valid[i - 1];
      ctx.beginPath();
      ctx.moveTo(prev.centerX, chartY(prev.temp));
      ctx.lineTo(col.centerX, chartY(col.temp));
      ctx.setLineDash(col.index - prev.index > 1 ? [4, 4] : []);
      ctx.stroke();
    });

    ctx.setLineDash([]);
  });
  ctx.lineWidth = 1;
}

/** Draws a dot at each temperature reading. Selected day dot is highlighted in blue. If influence factors are present, a larger red dot is drawn. */
export function drawTemperaturePoints(ctx, columns) {
  columns.forEach(col => {
    if (col.temp == null) return;

    const hasFactors = Boolean(col.tempFactors?.trim());

    if (hasFactors) {
    ctx.beginPath();
    ctx.arc(col.centerX, chartY(col.temp), 9, 0, Math.PI * 2);
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

    ctx.beginPath();
    ctx.arc(col.centerX, chartY(col.temp), 4, 0, Math.PI * 2);
    ctx.fillStyle = store.selectedKey === col.key ? "#2563eb" : "#111";
    ctx.fill();
  });

  ctx.lineWidth = 1;
}

/** Draws the measurement time label under a temperature dot, when set. */
export function drawMeasurementTimes(ctx, columns) {
  columns.forEach(col => {
    if (col.temp == null || !col.measurementTime) return;
    ctx.font = "10px Inter";
    ctx.fillStyle = "#8e8e93";
    ctx.textAlign = "center";
    ctx.fillText(col.measurementTime, col.centerX, chartY(col.temp) + 18);
  });
}
/** Draws anomaly marker labels above temperature dots. */
export function drawMarkers(ctx, columns) {
  columns.forEach(col => {
    if (col.temp == null || !col.marker) return;
    ctx.font = "bold 14px Inter";
    ctx.fillStyle = "#dc2626";
    ctx.textAlign = "center";
    ctx.fillText(col.marker, col.centerX, chartY(col.temp) - 14);
  });
}

/* ─── render ──────────────────────────────── */

/** Main chart render — sets up canvas, scales for DPR, and runs the full draw pipeline. */
export function renderChart(columns) {
  const canvas = qs("tempChart");
  if (!canvas) return;

  const width       = chartWidth(columns);
  const dpr         = window.devicePixelRatio || 1;
  const ctx         = canvas.getContext("2d");
  const cycleGroups = groupColumnsByCycle(columns);

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
  drawHorizontalCoverline(ctx, columns);
  drawVerticalCoverline(ctx, columns);
  drawTemperatureLine(ctx, cycleGroups);
  drawTemperaturePoints(ctx, columns);
  drawMeasurementTimes(ctx, columns);
  drawMarkers(ctx, columns);
}

/* ─── coverline interaction ───────────────── */

/**
 * Handles canvas clicks when a coverline mode is active.
 * Snaps the clicked temperature to the nearest 0.05°C step.
 * Deactivates coverline mode after placement.
 */

export function handleCanvasClick(event) {
  if (!store.horizontalCoverlineMode && !store.verticalCoverlineMode) {
    return;
  }

  const canvas = qs("tempChart");
  const rect = canvas.getBoundingClientRect();

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (store.horizontalCoverlineMode) {
    setCycleCoverlineValues({ horizontalGuideY: y });
  }

  if (store.verticalCoverlineMode) {
    setCycleCoverlineValues({ verticalGuideX: x });
  }

  store.horizontalCoverlineMode = false;
  store.verticalCoverlineMode = false;

  qs("horizontalCoverlineBtn").classList.remove("active");
  qs("verticalCoverlineBtn").classList.remove("active");

  qs("horizontalCoverlineBtn").innerText = "Horizontal coverline";
  qs("verticalCoverlineBtn").innerText = "Vertical coverline";

  store.save();

  import("./app.js").then(({ render }) => render());
}