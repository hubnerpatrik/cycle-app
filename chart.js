import { store } from "./store.js";
import { LAYOUT, qs, chartY, graphHeight, chartWidth } from "./app.js";

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

export function drawVerticalGrid(ctx, columns) {
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

export function drawHorizontalGrid(ctx, canvasWidth) {
  for (let i = 0; i <= 15; i++) {
    const y = Math.floor(chartY(LAYOUT.minTemp + i / 10)) + 0.5;
    ctx.beginPath();
    ctx.strokeStyle = i % 5 === 0 ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.05)";
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }
}

export function drawOverlayBands(ctx, columns) {
  columns.forEach(col => {
    if (col.isFertile) {
      ctx.fillStyle = "rgba(34,197,94,0.12)";
      ctx.fillRect(col.x, LAYOUT.chartPaddingTop, LAYOUT.columnWidth, graphHeight());
    }
    if (col.isPeak) {
      ctx.fillStyle = "rgba(168,85,247,0.10)";
      ctx.fillRect(col.x, LAYOUT.chartPaddingTop, LAYOUT.columnWidth, graphHeight());
    }
  });
}

export function drawSelectedHighlight(ctx, columns) {
  if (!store.selectedKey) return;
  const col = columns.find(c => c.key === store.selectedKey);
  if (!col) return;
  ctx.fillStyle = "rgba(37,99,235,0.08)";
  ctx.fillRect(col.x, 0, LAYOUT.columnWidth, LAYOUT.chartHeight);
}

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

export function drawHorizontalCoverline(ctx, columns) {
  if (!columns.length) return;
  const first = columns.find(c => c.manualCoverline != null);
  if (!first) return;
  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(180,20,20,0.8)";
  ctx.lineWidth = 1.5;
  ctx.moveTo(0, chartY(first.manualCoverline));
  ctx.lineTo(chartWidth(columns), chartY(first.manualCoverline));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

export function drawVerticalCoverline(ctx, columns) {
  const active = columns.find(c => c.coverlineStart);
  if (!active) return;
  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "rgba(180,20,20,0.8)";
  ctx.lineWidth = 1.5;
  ctx.moveTo(active.centerX, LAYOUT.chartPaddingTop);
  ctx.lineTo(active.centerX, LAYOUT.chartHeight - LAYOUT.chartPaddingBottom);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
}

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

export function drawTemperatureLine(ctx, cycleGroups) {
  cycleGroups.forEach(group => {
    const valid = group.columns.filter(c => c.temp != null);
    if (valid.length < 2) return;
    ctx.beginPath();
    valid.forEach((col, i) => {
      i === 0
        ? ctx.moveTo(col.centerX, chartY(col.temp))
        : ctx.lineTo(col.centerX, chartY(col.temp));
    });
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  ctx.lineWidth = 1;
}

export function drawTemperaturePoints(ctx, columns) {
  columns.forEach(col => {
    if (col.temp == null) return;
    ctx.beginPath();
    ctx.arc(col.centerX, chartY(col.temp), 4, 0, Math.PI * 2);
    ctx.fillStyle = store.selectedKey === col.key ? "#2563eb" : "#111";
    ctx.fill();
  });
}

export function drawMarkers(ctx, columns) {
  columns.forEach(col => {
    if (col.temp == null || !col.marker) return;
    ctx.font = "bold 14px Inter";
    ctx.fillStyle = "#dc2626";
    ctx.textAlign = "center";
    ctx.fillText(col.marker, col.centerX, chartY(col.temp) - 14);
  });
}

export function renderChart(columns) {
  const canvas = qs("tempChart");
  if (!canvas) return;

  const width = chartWidth(columns);
  const dpr   = window.devicePixelRatio || 1;
  const ctx   = canvas.getContext("2d");
  const cycleGroups = groupColumnsByCycle(columns);

  canvas.style.width  = `${width}px`;
  canvas.style.height = `${LAYOUT.chartHeight}px`;
  canvas.width        = width * dpr;
  canvas.height       = LAYOUT.chartHeight * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, LAYOUT.chartHeight);

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
  drawMarkers(ctx, columns);
}

export function handleCanvasClick(event) {
  if (!store.horizontalCoverlineMode && !store.verticalCoverlineMode) return;

  const canvas = qs("tempChart");
  const rect = canvas.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const ratio = (y - LAYOUT.chartPaddingTop) / graphHeight();
  const temp = LAYOUT.maxTemp - ratio * (LAYOUT.maxTemp - LAYOUT.minTemp);
  const snappedTemp = Math.round(temp * 20) / 20;

  import("./app.js").then(({ currentColumns, render }) => {
    currentColumns.forEach(col => {
      if (!store.entries[col.key]) return;
      store.entries[col.key].coverlineStart = false;
    });

    const clickedColumn = currentColumns.find(col =>
      event.offsetX >= col.x &&
      event.offsetX <= col.x + LAYOUT.columnWidth
    );

    if (!clickedColumn) return;

    store.entries[clickedColumn.key] = { ...(store.entries[clickedColumn.key] || {}) };

    if (store.horizontalCoverlineMode) {
      currentColumns.forEach(col => {
        if (!store.entries[col.key]) return;
        store.entries[col.key].manualCoverline = null;
      });
      store.entries[clickedColumn.key].manualCoverline = snappedTemp;
    }

    if (store.verticalCoverlineMode) {
      currentColumns.forEach(col => {
        if (!store.entries[col.key]) return;
        store.entries[col.key].coverlineStart = false;
      });
      store.entries[clickedColumn.key].coverlineStart = true;
    }

    store.horizontalCoverlineMode = false;
    store.verticalCoverlineMode = false;

    qs("horizontalCoverlineBtn").classList.remove("active");
    qs("verticalCoverlineBtn").classList.remove("active");
    qs("horizontalCoverlineBtn").innerText = "Set horizontal coverline";
    qs("verticalCoverlineBtn").innerText = "Set vertical coverline";

    store.save();
    render();
  });
}