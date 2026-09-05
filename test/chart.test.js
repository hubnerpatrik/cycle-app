import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();

const { store } = await import("../store.js");
const { LAYOUT, chartLineY } = await import("../core.js");
const { clearCycleCoverlineValues } = await import("../domain.js");
const {
  drawCrossedChartCells,
  drawHorizontalCoverline,
  drawVerticalCoverline,
  getCoverlineDragTarget,
  placeCoverlinesAt,
  updateCoverlineDrag,
} = await import("../chart.js");

function recordingContext() {
  const calls = [];
  return {
    calls,
    beginPath() {},
    setLineDash() {},
    stroke() {},
    fill() { calls.push(["fill"]); },
    arc(...args) { calls.push(["arc", ...args]); },
    moveTo(...args) { calls.push(["moveTo", ...args]); },
    lineTo(...args) { calls.push(["lineTo", ...args]); },
    set fillStyle(value) { calls.push(["fillStyle", value]); },
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

test("legacy coverlines without endpoint data retain their L shape", () => {
  store.coverlines = {
    default: {
      horizontalTemp: 36.5,
      verticalKey: "2026-03-10",
      verticalPosition: "center",
    },
  };
  const columns = [
    { key: "2026-03-09", x: 0, centerX: LAYOUT.columnWidth / 2 },
    { key: "2026-03-10", x: LAYOUT.columnWidth, centerX: LAYOUT.columnWidth * 1.5 },
    { key: "2026-03-11", x: LAYOUT.columnWidth * 2, centerX: LAYOUT.columnWidth * 2.5 },
  ];
  const origin = [LAYOUT.columnWidth * 1.5, chartLineY(36.5)];
  const horizontal = recordingContext();
  const vertical = recordingContext();

  drawHorizontalCoverline(horizontal, columns);
  drawVerticalCoverline(vertical, columns);

  assert.deepEqual(horizontal.calls.find(call => call[0] === "moveTo").slice(1), origin);
  assert.deepEqual(vertical.calls.find(call => call[0] === "moveTo").slice(1), [origin[0], LAYOUT.chartPaddingTop]);
  assert.deepEqual(vertical.calls.find(call => call[0] === "lineTo").slice(1), origin);
});

test("vertical coverlines support cell edges and centers", () => {
  const columns = [
    { key: "2026-03-09", x: 0, centerX: LAYOUT.columnWidth / 2 },
    { key: "2026-03-10", x: LAYOUT.columnWidth, centerX: LAYOUT.columnWidth * 1.5 },
  ];

  store.coverlines = { default: { verticalKey: "2026-03-10" } };
  const legacyEdge = recordingContext();
  drawVerticalCoverline(legacyEdge, columns);
  assert.equal(legacyEdge.calls.find(call => call[0] === "moveTo")[1], LAYOUT.columnWidth);

  store.coverlines.default.verticalPosition = "center";
  const center = recordingContext();
  drawVerticalCoverline(center, columns);
  assert.equal(center.calls.find(call => call[0] === "moveTo")[1], LAYOUT.columnWidth * 1.5);

  store.coverlines.default.verticalPosition = "end";
  const endEdge = recordingContext();
  drawVerticalCoverline(endEdge, columns);
  assert.equal(endEdge.calls.find(call => call[0] === "moveTo")[1], LAYOUT.columnWidth * 2);
});

test("one chart placement creates the complete L-shaped coverline", () => {
  store.coverlines = {};
  const columns = [
    { key: "2026-03-09", x: 0, centerX: LAYOUT.columnWidth / 2 },
    { key: "2026-03-10", x: LAYOUT.columnWidth, centerX: LAYOUT.columnWidth * 1.5 },
  ];

  assert.equal(placeCoverlinesAt(LAYOUT.columnWidth * 1.5, chartLineY(36.7), columns), true);
  assert.equal(store.coverlines.default.horizontalTemp, 36.7);
  assert.equal(store.coverlines.default.horizontalStartKey, "2026-03-10");
  assert.equal(store.coverlines.default.horizontalStartPosition, "center");
  assert.equal(store.coverlines.default.horizontalEndKey, "2026-03-10");
  assert.equal(store.coverlines.default.horizontalEndPosition, "end");
  assert.equal(store.coverlines.default.verticalKey, "2026-03-10");
  assert.equal(store.coverlines.default.verticalPosition, "center");
  assert.equal(store.coverlines.default.verticalTopTemp, 37.45);
  assert.equal(store.coverlines.default.verticalBottomTemp, 36.7);
});

test("coverline bodies and all four endpoints have independent drag targets", () => {
  store.coverlines = {
    default: {
      horizontalTemp: 36.5,
      verticalKey: "2026-03-10",
      verticalPosition: "center",
    },
  };
  const columns = [
    { key: "2026-03-09", x: 0, centerX: LAYOUT.columnWidth / 2 },
    { key: "2026-03-10", x: LAYOUT.columnWidth, centerX: LAYOUT.columnWidth * 1.5 },
    { key: "2026-03-11", x: LAYOUT.columnWidth * 2, centerX: LAYOUT.columnWidth * 2.5 },
  ];
  const originX = LAYOUT.columnWidth * 1.5;
  const originY = chartLineY(36.5);

  assert.equal(getCoverlineDragTarget(originX + 30, originY, columns), "horizontal");
  assert.equal(getCoverlineDragTarget(originX, originY - 30, columns), "vertical");
  assert.equal(getCoverlineDragTarget(originX + 8, originY, columns), "horizontal-start");
  assert.equal(getCoverlineDragTarget(originX, originY - 8, columns), "vertical-bottom");
  assert.equal(getCoverlineDragTarget(LAYOUT.columnWidth * 3, originY, columns), "horizontal-end");
  assert.equal(getCoverlineDragTarget(originX, LAYOUT.chartPaddingTop, columns), "vertical-top");
  assert.equal(getCoverlineDragTarget(originX + 30, originY + 30, columns), null);
});

test("coverline endpoints can form independent segments instead of a forced L", () => {
  store.coverlines = {
    default: {
      horizontalTemp: 36.5,
      horizontalStartKey: "2026-03-09",
      horizontalStartPosition: "center",
      horizontalEndKey: "2026-03-11",
      horizontalEndPosition: "center",
      verticalKey: "2026-03-10",
      verticalPosition: "center",
      verticalTopTemp: 36.9,
      verticalBottomTemp: 36.3,
    },
  };
  const columns = [
    { key: "2026-03-09", x: 0, centerX: LAYOUT.columnWidth / 2 },
    { key: "2026-03-10", x: LAYOUT.columnWidth, centerX: LAYOUT.columnWidth * 1.5 },
    { key: "2026-03-11", x: LAYOUT.columnWidth * 2, centerX: LAYOUT.columnWidth * 2.5 },
  ];
  const horizontal = recordingContext();
  const vertical = recordingContext();

  drawHorizontalCoverline(horizontal, columns);
  drawVerticalCoverline(vertical, columns);

  assert.deepEqual(horizontal.calls.find(call => call[0] === "moveTo").slice(1), [
    LAYOUT.columnWidth / 2,
    chartLineY(36.5),
  ]);
  assert.deepEqual(horizontal.calls.find(call => call[0] === "lineTo").slice(1), [
    LAYOUT.columnWidth * 2.5,
    chartLineY(36.5),
  ]);
  assert.deepEqual(vertical.calls.find(call => call[0] === "moveTo").slice(1), [
    LAYOUT.columnWidth * 1.5,
    chartLineY(36.9),
  ]);
  assert.deepEqual(vertical.calls.find(call => call[0] === "lineTo").slice(1), [
    LAYOUT.columnWidth * 1.5,
    chartLineY(36.3),
  ]);
});

test("selecting coverlines highlights both lines and shows four endpoint handles", () => {
  store.coverlines = {
    default: {
      horizontalTemp: 36.5,
      verticalKey: "2026-03-10",
      verticalPosition: "center",
    },
  };
  const columns = [
    { key: "2026-03-10", x: 0, centerX: LAYOUT.columnWidth / 2 },
  ];
  const horizontal = recordingContext();
  const vertical = recordingContext();

  drawHorizontalCoverline(horizontal, columns, true);
  drawVerticalCoverline(vertical, columns, true);

  assert.ok(horizontal.calls.some(call => call[0] === "lineWidth" && call[1] === 3));
  assert.ok(vertical.calls.some(call => call[0] === "lineWidth" && call[1] === 3));
  assert.equal(horizontal.calls.filter(call => call[0] === "arc").length, 2);
  assert.equal(vertical.calls.filter(call => call[0] === "arc").length, 2);
});

test("deleting coverlines removes both complete segments", () => {
  store.coverlines = {
    default: {
      horizontalTemp: 36.5,
      verticalKey: "2026-03-10",
      verticalPosition: "center",
    },
  };

  assert.equal(clearCycleCoverlineValues(), true);
  assert.deepEqual(store.coverlines, {});
  assert.equal(clearCycleCoverlineValues(), false);
});

test("dragging line bodies and endpoints updates only the intended anchors", () => {
  store.coverlines = {
    default: {
      horizontalTemp: 36.5,
      horizontalStartKey: "2026-03-09",
      horizontalStartPosition: "center",
      horizontalEndKey: "2026-03-11",
      horizontalEndPosition: "center",
      verticalKey: "2026-03-10",
      verticalPosition: "center",
      verticalTopTemp: 37,
      verticalBottomTemp: 36.4,
    },
  };
  const columns = [
    { key: "2026-03-09", x: 0, centerX: LAYOUT.columnWidth / 2 },
    { key: "2026-03-10", x: LAYOUT.columnWidth, centerX: LAYOUT.columnWidth * 1.5 },
    { key: "2026-03-11", x: LAYOUT.columnWidth * 2, centerX: LAYOUT.columnWidth * 2.5 },
  ];

  updateCoverlineDrag("horizontal", 0, chartLineY(36.8), columns);
  assert.equal(store.coverlines.default.horizontalTemp, 36.8);
  assert.equal(store.coverlines.default.verticalKey, "2026-03-10");
  assert.equal(store.coverlines.default.verticalTopTemp, 37);

  updateCoverlineDrag("vertical", LAYOUT.columnWidth * 2.5, 0, columns);
  assert.equal(store.coverlines.default.horizontalTemp, 36.8);
  assert.equal(store.coverlines.default.verticalKey, "2026-03-11");
  assert.equal(store.coverlines.default.verticalPosition, "center");

  updateCoverlineDrag("horizontal-start", 0, 0, columns);
  assert.equal(store.coverlines.default.horizontalStartKey, "2026-03-09");
  assert.equal(store.coverlines.default.horizontalStartPosition, "start");
  assert.equal(store.coverlines.default.horizontalEndKey, "2026-03-11");

  updateCoverlineDrag("horizontal-end", LAYOUT.columnWidth * 2, 0, columns);
  assert.equal(store.coverlines.default.horizontalEndKey, "2026-03-11");
  assert.equal(store.coverlines.default.horizontalEndPosition, "start");
  assert.equal(store.coverlines.default.horizontalStartPosition, "start");

  updateCoverlineDrag("vertical-top", 0, chartLineY(37.2), columns);
  updateCoverlineDrag("vertical-bottom", 0, chartLineY(36.2), columns);
  assert.equal(store.coverlines.default.verticalTopTemp, 37.2);
  assert.equal(store.coverlines.default.verticalBottomTemp, 36.2);
  assert.equal(store.coverlines.default.horizontalTemp, 36.8);
});

test("coverline endpoints may cross so users can freely rebuild the shape", () => {
  store.coverlines = {
    default: {
      horizontalTemp: 36.5,
      horizontalStartKey: "2026-03-09",
      horizontalStartPosition: "start",
      horizontalEndKey: "2026-03-10",
      horizontalEndPosition: "start",
      verticalKey: "2026-03-10",
      verticalPosition: "center",
      verticalTopTemp: 37,
      verticalBottomTemp: 36.5,
    },
  };
  const columns = [
    { key: "2026-03-09", x: 0, centerX: LAYOUT.columnWidth / 2 },
    { key: "2026-03-10", x: LAYOUT.columnWidth, centerX: LAYOUT.columnWidth * 1.5 },
    { key: "2026-03-11", x: LAYOUT.columnWidth * 2, centerX: LAYOUT.columnWidth * 2.5 },
  ];

  updateCoverlineDrag("horizontal-start", LAYOUT.columnWidth * 3, 0, columns);
  updateCoverlineDrag("vertical-top", 0, chartLineY(36.1), columns);

  assert.equal(store.coverlines.default.horizontalStartKey, "2026-03-11");
  assert.equal(store.coverlines.default.horizontalStartPosition, "end");
  assert.equal(store.coverlines.default.verticalTopTemp, 36.1);
  assert.equal(store.coverlines.default.verticalBottomTemp, 36.5);
});
