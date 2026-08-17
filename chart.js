// chart.js — Canvas rendering and coverline interaction
// ─────────────────────────────────────────────
// Owns all draw* functions, renderChart, and handleCanvasClick.
// Draw order: bg → overlays → grid → annotations → data

import { store } from "./store.js";
import { LAYOUT, qs, chartY, chartLineY, chartGridY, tempSlotCount, graphHeight, chartWidth, pixelYToTemp, pixelXToColumnKey } from "./core.js";
import { getCycleCoverlineValues, setCycleCoverlineValues } from "./domain.js";

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
    ctx.strokeStyle = col.index % 5 === 0 ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.10)";
    ctx.moveTo(x, LAYOUT.chartPaddingTop);
    ctx.lineTo(x, LAYOUT.chartHeight - LAYOUT.chartPaddingBottom);
    ctx.stroke();
  });
  const lastX = chartWidth(columns) + 0.5;
  ctx.beginPath();
  ctx.lineWidth   = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.30)";
  ctx.moveTo(lastX, LAYOUT.chartPaddingTop);
  ctx.lineTo(lastX, LAYOUT.chartHeight - LAYOUT.chartPaddingBottom);
  ctx.stroke();
  ctx.lineWidth = 1;
}

/** Draws horizontal temperature grid lines — one per 0.05°C cell boundary. Every 5th line is darker. */
export function drawHorizontalGrid(ctx, canvasWidth) {
  const slots = tempSlotCount();
  for (let i = 0; i <= slots; i++) {
    const y = Math.floor(chartGridY(i)) + 0.5;
    ctx.beginPath();
    ctx.lineWidth   = 1;
    ctx.strokeStyle = i % 5 === 0 ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.10)";
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
}

/** Draws the manually placed vertical coverline — anchored to a day, recomputed to pixels each render. */
export function drawVerticalCoverline(ctx, columns) {
  const { verticalKey } = getCycleCoverlineValues();
  if (verticalKey == null) return;

  const col = columns.find(c => c.key === verticalKey);
  if (!col) return; // anchor day isn't visible in this cycle

  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(180,20,20,0.8)";
  ctx.lineWidth = 1.5;

  ctx.moveTo(col.x, LAYOUT.chartPaddingTop);
  ctx.lineTo(col.x, LAYOUT.chartHeight - LAYOUT.chartPaddingBottom);

  ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

/** Draws the manually placed horizontal coverline — anchored to a temperature, recomputed to pixels each render. */
export function drawHorizontalCoverline(ctx, columns) {
  const { horizontalTemp } = getCycleCoverlineValues();
  if (horizontalTemp == null) return;

  const y = chartLineY(horizontalTemp);

  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(180,20,20,0.8)";
  ctx.lineWidth = 1.5;

  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth(columns), y);

  ctx.stroke();

  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

/* ─── overlays ────────────────────────────── */

/** Fills day columns with optional color overlays. */
export function drawOverlayBands(ctx, columns) {
  columns.forEach(col => {
    if (!col.isFertile) return;
    ctx.fillStyle = "rgba(207,231,180,0.28)";
    ctx.fillRect(
      col.x,
      LAYOUT.chartPaddingTop,
      LAYOUT.columnWidth,
      LAYOUT.chartHeight - LAYOUT.chartPaddingTop - LAYOUT.chartPaddingBottom,
    );
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

/** Draws diagonal strokes through chart grid cells selected by the user. */
export function drawCrossedChartCells(ctx, columns) {
  const crossedCells = store.crossCellSelectionMode ? store.crossCellDraft : store.crossedChartCells;
  if (!crossedCells) return;
  columns.forEach(col => {
    (crossedCells[col.key] || []).forEach(rowIndex => {
      const top = chartGridY(rowIndex);
      const bottom = chartGridY(rowIndex + 1);
      ctx.beginPath();
      ctx.moveTo(col.x + 5, bottom - 3);
      ctx.lineTo(col.x + LAYOUT.columnWidth - 5, top + 3);
      ctx.strokeStyle = "#1c1c1e";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  });
  ctx.lineWidth = 1;
}

export function chartCellFromPoint(x, y, columns) {
  if (y < LAYOUT.chartPaddingTop || y >= LAYOUT.chartHeight - LAYOUT.chartPaddingBottom) return null;
  const key = pixelXToColumnKey(x, columns);
  if (!key) return null;
  const rowHeight = graphHeight() / tempSlotCount();
  const rowIndex = Math.floor((y - LAYOUT.chartPaddingTop) / rowHeight);
  return rowIndex >= 0 && rowIndex < tempSlotCount() ? { key, rowIndex } : null;
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
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    valid.forEach((col, i) => {
      if (i === 0) return;
      const prev = valid[i - 1];
      const prevY = chartY(prev.temp);
      const colY = chartY(col.temp);

      const daysBetween = (col.date - prev.date) / 86_400_000;

      ctx.beginPath();
      ctx.moveTo(prev.centerX, prevY);
      ctx.lineTo(col.centerX, colY);
      ctx.setLineDash(daysBetween > 1 ? [4, 4] : []);
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

    const pointY = chartY(col.temp);
    const markerY = col.markerPointType === "adjusted" && col.adjustedTemp != null
      ? chartY(col.adjustedTemp)
      : pointY;

    if (col.isPeak) {
      ctx.beginPath();
      ctx.arc(col.centerX, markerY, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(22,163,74,0.75)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const hasFactors = Boolean(col.tempFactors?.trim());

    if (hasFactors) {
      ctx.beginPath();
      ctx.arc(col.centerX, pointY, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "#ff0000";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(col.centerX, pointY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#111";
    ctx.fill();
  });

  ctx.lineWidth = 1;
}

export function drawSelectedPointHighlight(ctx, columns) {
  if (!store.selectedKey) return;
  const col = columns.find(c => c.key === store.selectedKey && c.temp != null);
  if (!col) return;

  const pointY = store.selectedPointType === "adjusted" && col.adjustedTemp != null
    ? chartY(col.adjustedTemp)
    : chartY(col.temp);

  ctx.beginPath();
  ctx.arc(col.centerX, pointY, 10, 0, Math.PI * 2);
  ctx.strokeStyle = store.markerSelectionMode ? "rgba(37,99,235,0.85)" : "rgba(37,99,235,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawHoveredPointHighlight(ctx, columns) {
  if (!store.hoveredKey) return;
  const col = columns.find(c => c.key === store.hoveredKey && c.temp != null);
  if (!col) return;

  const pointY = store.hoveredPointType === "adjusted" && col.adjustedTemp != null
    ? chartY(col.adjustedTemp)
    : chartY(col.temp);

  ctx.beginPath();
  ctx.arc(col.centerX, pointY, 12, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(37,99,235,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Draws a secondary dot for the time-adjusted temperature — connects it to the measured point with a dashed blue line. */
export function drawAdjustedTemperaturePoints(ctx, columns) {
  columns.forEach(col => {
    if (col.adjustedTemp == null || col.temp == null) return;

    const baseY = chartY(col.temp);
    const adjY = chartY(col.adjustedTemp);

    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;
    ctx.moveTo(col.centerX, baseY);
    ctx.lineTo(col.centerX, adjY);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(col.centerX, adjY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
  });

  ctx.lineWidth = 1;
}

/** Draws the measurement time label under a temperature dot, when set. */
export function drawMeasurementTimes(ctx, columns) {
  columns.forEach(col => {
    if (col.temp == null || !col.measurementTime) return;
    const pointY = chartY(col.temp);
    ctx.font = "10px Inter";
    ctx.fillStyle = "#8e8e93";
    ctx.textAlign = "center";
    ctx.fillText(col.measurementTime, col.centerX, pointY + 18);
  });
}
/** Draws anomaly marker labels above (or below, if that would overlap the other dot) the anchor temperature dot. */
export function drawMarkers(ctx, columns) {
  const MARKER_COLORS = {
    blue: "#2563eb",
    green: "#16a34a",
    orange: "#ea580c",
  };

  columns.forEach(col => {
    if (col.temp == null || !col.marker) return;
    if (col.markerColor !== "green") return;

    const usingAdjusted = col.markerPointType === "adjusted" && col.adjustedTemp != null;
    const markerY = usingAdjusted ? chartY(col.adjustedTemp) : chartY(col.temp);

    // flip label below the dot when the anchor sits lower than its counterpart, to avoid overlapping it
    let labelBelow = false;
    if (col.adjustedTemp != null) {
      const tempY = chartY(col.temp);
      const adjY = chartY(col.adjustedTemp);
      labelBelow = usingAdjusted ? adjY > tempY : tempY > adjY;
    }

    ctx.font = "bold 14px Inter";
    ctx.fillStyle = MARKER_COLORS[col.markerColor] || "#111";
    ctx.textAlign = "center";
    ctx.fillText(col.marker, col.centerX, labelBelow ? markerY + 20 : markerY - 14);
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
  drawCrossedChartCells(ctx, columns);
  drawCycleSeparators(ctx, cycleGroups);
  drawHoverLine(ctx, columns);
  drawHorizontalCoverline(ctx, columns);
  drawVerticalCoverline(ctx, columns);
  drawTemperatureLine(ctx, cycleGroups);
  drawTemperaturePoints(ctx, columns);
  drawAdjustedTemperaturePoints(ctx, columns);

  drawMeasurementTimes(ctx, columns);
  drawMarkers(ctx, columns);
}

/* ─── coverline interaction ───────────────── */

/**
 * Handles canvas clicks when a coverline mode is active.
 * Snaps the clicked temperature to the nearest 0.05°C step.
 * Deactivates coverline mode after placement.
 */

export function handleCanvasClick(event, columns, onRender) {
  if (!store.horizontalCoverlineMode && !store.verticalCoverlineMode) {
    return;
  }

  const canvas = qs("tempChart");
  const rect = canvas.getBoundingClientRect();

  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (store.horizontalCoverlineMode) {
    setCycleCoverlineValues({ horizontalTemp: pixelYToTemp(y) });
  }

  if (store.verticalCoverlineMode) {
    const key = pixelXToColumnKey(x, columns);
    if (key != null) setCycleCoverlineValues({ verticalKey: key });
  }

  store.horizontalCoverlineMode = false;
  store.verticalCoverlineMode = false;

  const btn = qs("coverlineBtn");
  if (btn) {
    btn.classList.remove("active");
    btn.innerText = "Coverline";
  }

  store.save();

  onRender?.();
}
