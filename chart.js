// chart.js — Canvas rendering and coverline interaction
// ─────────────────────────────────────────────
// Owns all draw* functions, renderChart, and handleCanvasClick.
// Draw order: bg → overlays → grid → annotations → data

import { store } from "./store.js";
import { LAYOUT, qs, chartY, chartLineY, chartGridY, tempSlotCount, graphHeight, chartWidth, pixelYToTemp } from "./core.js";
import { getCycleCoverlineValues, setCycleCoverlineValues } from "./domain.js";

function coverlineColumnX(column, position = "start") {
  if (position === "center") return column.centerX ?? column.x + LAYOUT.columnWidth / 2;
  if (position === "end") return column.x + LAYOUT.columnWidth;
  return column.x;
}

function coverlineAnchorX(values, keyField, positionField, columns, fallback = null) {
  const column = columns.find(item => item.key === values[keyField]);
  return column ? coverlineColumnX(column, values[positionField]) : fallback;
}

function getCoverlineGeometry(columns) {
  const values = getCycleCoverlineValues();
  const width = chartWidth(columns);
  const horizontalY = values.horizontalTemp == null ? null : chartLineY(values.horizontalTemp);
  const verticalX = coverlineAnchorX(values, "verticalKey", "verticalPosition", columns);

  return {
    horizontal: horizontalY == null ? null : {
      startX: coverlineAnchorX(
        values,
        "horizontalStartKey",
        "horizontalStartPosition",
        columns,
        verticalX ?? 0,
      ),
      endX: coverlineAnchorX(
        values,
        "horizontalEndKey",
        "horizontalEndPosition",
        columns,
        width,
      ),
      y: horizontalY,
    },
    vertical: verticalX == null ? null : {
      x: verticalX,
      topY: values.verticalTopTemp == null
        ? LAYOUT.chartPaddingTop
        : chartLineY(values.verticalTopTemp),
      bottomY: values.verticalBottomTemp == null
        ? horizontalY ?? LAYOUT.chartHeight - LAYOUT.chartPaddingBottom
        : chartLineY(values.verticalBottomTemp),
    },
  };
}

function drawCoverlineHandle(ctx, x, y) {
  if (typeof ctx.arc !== "function" || typeof ctx.fill !== "function") return;
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.fillStyle = "white";
  ctx.strokeStyle = "rgba(180,20,20,1)";
  ctx.lineWidth = 2;
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

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

/** Draws the manually placed vertical coverline with independently resizable endpoints. */
export function drawVerticalCoverline(ctx, columns, selected = false) {
  const { vertical } = getCoverlineGeometry(columns);
  if (!vertical) return;

  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = selected ? "rgba(180,20,20,1)" : "rgba(180,20,20,0.8)";
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.shadowColor = selected ? "rgba(180,20,20,0.35)" : "transparent";
  ctx.shadowBlur = selected ? 5 : 0;

  ctx.moveTo(vertical.x, vertical.topY);
  ctx.lineTo(vertical.x, vertical.bottomY);

  ctx.stroke();
  if (selected) {
    drawCoverlineHandle(ctx, vertical.x, vertical.topY);
    drawCoverlineHandle(ctx, vertical.x, vertical.bottomY);
  }

  ctx.setLineDash([]);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.lineWidth = 1;
}

/** Draws the manually placed horizontal coverline with independently resizable endpoints. */
export function drawHorizontalCoverline(ctx, columns, selected = false) {
  const { horizontal } = getCoverlineGeometry(columns);
  if (!horizontal) return;

  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = selected ? "rgba(180,20,20,1)" : "rgba(180,20,20,0.8)";
  ctx.lineWidth = selected ? 3 : 1.5;
  ctx.shadowColor = selected ? "rgba(180,20,20,0.35)" : "transparent";
  ctx.shadowBlur = selected ? 5 : 0;

  ctx.moveTo(horizontal.startX, horizontal.y);
  ctx.lineTo(horizontal.endX, horizontal.y);

  ctx.stroke();
  if (selected) {
    drawCoverlineHandle(ctx, horizontal.startX, horizontal.y);
    drawCoverlineHandle(ctx, horizontal.endX, horizontal.y);
  }

  ctx.setLineDash([]);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
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

/** Draws an ascending diagonal inside every chart grid cell marked by the user. */
export function drawCrossedChartCells(ctx, columns) {
  columns.forEach(col => {
    const temps = store.crossCellSelectionMode
      ? store.crossCellDraft?.[col.key]
      : store.entries[col.key]?.crossedChartTemps;
    if (!Array.isArray(temps)) return;

    temps.forEach(temp => {
      const centerY = chartY(temp);
      const insetX = Math.min(7, LAYOUT.columnWidth * 0.22);
      const cellHalfHeight = graphHeight() / tempSlotCount() / 2;
      const insetY = Math.min(4, cellHalfHeight * 0.3);
      const left = col.x + insetX;
      const right = col.x + LAYOUT.columnWidth - insetX;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(22,163,74,0.78)";
      ctx.lineWidth = 1.5;
      ctx.moveTo(left, centerY + cellHalfHeight - insetY);
      ctx.lineTo(right, centerY - cellHalfHeight + insetY);
      ctx.stroke();
    });
  });
  ctx.lineWidth = 1;
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
    const markerY = col.markers?.bbt?.pointType === "adjusted" && col.adjustedTemp != null
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
  columns.forEach(col => {
    const marker = col.markers?.bbt;
    if (col.temp == null || !marker?.value) return;

    const usingAdjusted = marker.pointType === "adjusted" && col.adjustedTemp != null;
    const markerY = usingAdjusted ? chartY(col.adjustedTemp) : chartY(col.temp);

    // flip label below the dot when the anchor sits lower than its counterpart, to avoid overlapping it
    let labelBelow = false;
    if (col.adjustedTemp != null) {
      const tempY = chartY(col.temp);
      const adjY = chartY(col.adjustedTemp);
      labelBelow = usingAdjusted ? adjY > tempY : tempY > adjY;
    }

    ctx.font = "bold 14px Inter";
    ctx.fillStyle = "#16a34a";
    ctx.textAlign = "center";
    ctx.fillText(marker.value, col.centerX, labelBelow ? markerY + 20 : markerY - 14);
  });
}

/* ─── render ──────────────────────────────── */

/** Main chart render — sets up canvas, scales for DPR, and runs the full draw pipeline. */
export function renderChart(columns, { coverlineSelected = false } = {}) {
  const canvas = qs("tempChart");
  if (!canvas) return;

  const width       = chartWidth(columns);
  const dpr         = window.devicePixelRatio || 1;
  const ctx         = canvas.getContext("2d");
  const cycleGroups = groupColumnsByCycle(columns);

  canvas.style.width  = `${width}px`;
  canvas.style.height = `${LAYOUT.chartHeight}px`;
  canvas.classList.toggle("cross-cell-selection-mode", store.crossCellSelectionMode);
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
  drawHorizontalCoverline(ctx, columns, coverlineSelected);
  drawVerticalCoverline(ctx, columns, coverlineSelected);
  drawTemperatureLine(ctx, cycleGroups);
  drawTemperaturePoints(ctx, columns);
  drawAdjustedTemperaturePoints(ctx, columns);

  drawMeasurementTimes(ctx, columns);
  drawMarkers(ctx, columns);
}

/* ─── coverline interaction ───────────────── */

const COVERLINE_HIT_TOLERANCE = 10;
const COVERLINE_ENDPOINT_HIT_TOLERANCE = 13;

/** Returns a coverline body or endpoint at a chart position. Endpoints take priority. */
export function getCoverlineDragTarget(x, y, columns, tolerance = COVERLINE_HIT_TOLERANCE) {
  const geometry = getCoverlineGeometry(columns);
  const endpoints = [];
  if (geometry.horizontal) {
    endpoints.push(
      { target: "horizontal-start", axis: "horizontal", x: geometry.horizontal.startX, y: geometry.horizontal.y },
      { target: "horizontal-end", axis: "horizontal", x: geometry.horizontal.endX, y: geometry.horizontal.y },
    );
  }
  if (geometry.vertical) {
    endpoints.push(
      { target: "vertical-top", axis: "vertical", x: geometry.vertical.x, y: geometry.vertical.topY },
      { target: "vertical-bottom", axis: "vertical", x: geometry.vertical.x, y: geometry.vertical.bottomY },
    );
  }

  const endpointHits = endpoints
    .map(endpoint => ({ ...endpoint, distance: Math.hypot(x - endpoint.x, y - endpoint.y) }))
    .filter(endpoint => endpoint.distance <= COVERLINE_ENDPOINT_HIT_TOLERANCE)
    .sort((a, b) => a.distance - b.distance);
  if (endpointHits.length) {
    const nearest = endpointHits[0];
    const overlapping = endpointHits.filter(endpoint =>
      Math.abs(endpoint.x - nearest.x) < 0.5 && Math.abs(endpoint.y - nearest.y) < 0.5);
    if (overlapping.length > 1) {
      const preferredAxis = Math.abs(x - nearest.x) >= Math.abs(y - nearest.y)
        ? "horizontal"
        : "vertical";
      return overlapping.find(endpoint => endpoint.axis === preferredAxis)?.target ?? nearest.target;
    }
    return nearest.target;
  }

  const horizontalHit = geometry.horizontal
    && x >= Math.min(geometry.horizontal.startX, geometry.horizontal.endX) - tolerance
    && x <= Math.max(geometry.horizontal.startX, geometry.horizontal.endX) + tolerance
    && Math.abs(y - geometry.horizontal.y) <= tolerance;
  const verticalHit = geometry.vertical
    && y >= Math.min(geometry.vertical.topY, geometry.vertical.bottomY) - tolerance
    && y <= Math.max(geometry.vertical.topY, geometry.vertical.bottomY) + tolerance
    && Math.abs(x - geometry.vertical.x) <= tolerance;

  if (horizontalHit && verticalHit) {
    return Math.abs(y - geometry.horizontal.y) <= Math.abs(x - geometry.vertical.x)
      ? "horizontal"
      : "vertical";
  }
  if (horizontalHit) return "horizontal";
  if (verticalHit) return "vertical";
  return null;
}

function pixelXToCoverlineAnchor(x, columns) {
  if (!columns.length) return null;

  const anchors = columns.flatMap(column => [
    { key: column.key, position: "start", x: coverlineColumnX(column, "start") },
    { key: column.key, position: "center", x: coverlineColumnX(column, "center") },
  ]);
  const lastColumn = columns.at(-1);
  anchors.push({
    key: lastColumn.key,
    position: "end",
    x: coverlineColumnX(lastColumn, "end"),
  });

  return anchors.reduce((closest, anchor) =>
    Math.abs(x - anchor.x) < Math.abs(x - closest.x) ? anchor : closest);
}

function coverlineTempFromY(y, allowTopBoundary = false) {
  const maximum = Math.round(
    (LAYOUT.maxTemp + (allowTopBoundary ? LAYOUT.tempStep : 0)) * 100,
  ) / 100;
  return Math.min(maximum, Math.max(LAYOUT.minTemp, pixelYToTemp(y)));
}

/** Moves a coverline body or resizes one endpoint independently. */
export function updateCoverlineDrag(target, x, y, columns) {
  const values = {};

  if (target === "horizontal") {
    values.horizontalTemp = coverlineTempFromY(y);
  }

  if (target === "vertical") {
    const anchor = pixelXToCoverlineAnchor(x, columns);
    if (anchor) {
      values.verticalKey = anchor.key;
      values.verticalPosition = anchor.position;
    }
  }

  if (target === "horizontal-start" || target === "horizontal-end") {
    const anchor = pixelXToCoverlineAnchor(x, columns);
    const prefix = target === "horizontal-start" ? "horizontalStart" : "horizontalEnd";
    if (anchor) {
      values[`${prefix}Key`] = anchor.key;
      values[`${prefix}Position`] = anchor.position;
    }
  }

  if (target === "vertical-top" || target === "vertical-bottom") {
    const field = target === "vertical-top" ? "verticalTopTemp" : "verticalBottomTemp";
    values[field] = coverlineTempFromY(y, true);
  }

  if (!Object.keys(values).length) return false;
  setCycleCoverlineValues(values);
  return true;
}

/** Places both lines as an initial L; every endpoint can then be moved independently. */
export function placeCoverlinesAt(x, y, columns) {
  const anchor = pixelXToCoverlineAnchor(x, columns);
  if (!anchor) return false;
  const lastColumn = columns.at(-1);
  const temp = coverlineTempFromY(y);

  setCycleCoverlineValues({
    horizontalTemp: temp,
    horizontalStartKey: anchor.key,
    horizontalStartPosition: anchor.position,
    horizontalEndKey: lastColumn.key,
    horizontalEndPosition: "end",
    verticalKey: anchor.key,
    verticalPosition: anchor.position,
    verticalTopTemp: Math.round((LAYOUT.maxTemp + LAYOUT.tempStep) * 100) / 100,
    verticalBottomTemp: temp,
  });
  return true;
}

/**
 * Handles canvas clicks when a coverline mode is active.
 * Snaps the clicked temperature to the nearest 0.05°C step.
 * Deactivates coverline mode after placement.
 */
export function handleCanvasClick(x, y, columns) {
  if (!store.horizontalCoverlineMode && !store.verticalCoverlineMode) {
    return;
  }

  if (!placeCoverlinesAt(x, y, columns)) return false;

  store.horizontalCoverlineMode = false;
  store.verticalCoverlineMode = false;

  const btn = qs("coverlineBtn");
  if (btn) {
    btn.classList.remove("active");
    btn.innerText = "Coverlines";
    btn.setAttribute("aria-pressed", "false");
  }
  return true;
}
