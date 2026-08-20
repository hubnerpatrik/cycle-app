import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();

const { store } = await import("../store.js");
const { LAYOUT, chartLineY } = await import("../core.js");
const {
  drawCrossedChartCells,
  drawHorizontalCoverline,
  drawVerticalCoverline,
} = await import("../chart.js");

function recordingContext() {
  const calls = [];
  return {
    calls,
    beginPath() {},
    setLineDash() {},
    stroke() {},
    moveTo(...args) { calls.push(["moveTo", ...args]); },
    lineTo(...args) { calls.push(["lineTo", ...args]); },
    set strokeStyle(value) { calls.push(["strokeStyle", value]); },
    set lineWidth(value) { calls.push(["lineWidth", value]); },
  };
}

test("crossed chart cells use green lines", () => {
  store.crossCellSelectionMode = false;
  store.entries = { "2026-03-10": { crossedChartTemps: [36.5] } };
  const ctx = recordingContext();

  drawCrossedChartCells(ctx, [{ key: "2026-03-10", x: 0 }]);

  assert.ok(ctx.calls.some(call => call[0] === "strokeStyle" && call[1] === "rgba(22,163,74,0.78)"));
});

test("horizontal and vertical coverlines share an L-shaped origin", () => {
  store.coverlines = { default: { horizontalTemp: 36.5, verticalKey: "2026-03-10" } };
  const columns = [
    { key: "2026-03-09", x: 0 },
    { key: "2026-03-10", x: LAYOUT.columnWidth },
    { key: "2026-03-11", x: LAYOUT.columnWidth * 2 },
  ];
  const origin = [LAYOUT.columnWidth, chartLineY(36.5)];
  const horizontal = recordingContext();
  const vertical = recordingContext();

  drawHorizontalCoverline(horizontal, columns);
  drawVerticalCoverline(vertical, columns);

  assert.deepEqual(horizontal.calls.find(call => call[0] === "moveTo").slice(1), origin);
  assert.deepEqual(vertical.calls.find(call => call[0] === "moveTo").slice(1), origin);
  assert.deepEqual(vertical.calls.find(call => call[0] === "lineTo").slice(1), [origin[0], LAYOUT.chartPaddingTop]);
});
