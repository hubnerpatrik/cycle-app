import test from "node:test";
import assert from "node:assert/strict";
import { chartY, getTimeAdjustment, pixelYToChartCellTemp } from "../core.js";

test("measurement-time adjustment accepts exact 24-hour times", () => {
  assert.equal(getTimeAdjustment("08:30", "07:30"), -0.1);
  assert.equal(getTimeAdjustment("06:00", "07:30"), 0.15);
});

test("measurement-time adjustment rejects malformed times", () => {
  assert.equal(getTimeAdjustment("12:30:garbage", "07:30"), 0);
  assert.equal(getTimeAdjustment("24:00", "07:30"), 0);
  assert.equal(getTimeAdjustment("7:30", "07:30"), 0);
  assert.equal(getTimeAdjustment(null, "07:30"), 0);
});

test("chart-cell hit testing returns the cell centered on a temperature", () => {
  assert.equal(pixelYToChartCellTemp(chartY(36)), 36);
  assert.equal(pixelYToChartCellTemp(chartY(36.7)), 36.7);
  assert.equal(pixelYToChartCellTemp(chartY(37.4)), 37.4);
  assert.equal(pixelYToChartCellTemp(0), null);
});
