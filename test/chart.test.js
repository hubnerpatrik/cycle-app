import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const { chartCellFromPoint } = await import("../chart.js");
const { LAYOUT, columnCenterX, chartGridY } = await import("../core.js");

test("chart clicks resolve to a day and temperature grid cell", () => {
  const columns = [
    { key: "2026-08-17", centerX: columnCenterX(0) },
    { key: "2026-08-18", centerX: columnCenterX(1) },
  ];

  assert.deepEqual(
    chartCellFromPoint(columnCenterX(1), chartGridY(5) + 2, columns),
    { key: "2026-08-18", rowIndex: 5 },
  );
});

test("chart clicks outside the temperature grid are ignored", () => {
  const columns = [{ key: "2026-08-17", centerX: columnCenterX(0) }];
  assert.equal(chartCellFromPoint(columnCenterX(0), LAYOUT.chartPaddingTop - 1, columns), null);
  assert.equal(chartCellFromPoint(columnCenterX(0), LAYOUT.chartHeight, columns), null);
});
