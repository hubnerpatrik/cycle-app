import test from "node:test";
import assert from "node:assert/strict";
import {
  calendarDayDifference,
  chartY,
  getCalendarFocusDate,
  getTimeAdjustment,
  pixelYToChartCellTemp,
} from "../core.js";

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

test("calendar focuses the latest month represented in graph data", () => {
  const focus = getCalendarFocusDate({
    "2026-03-03": { temp: 36.4 },
    "2026-03-21": { bleeding: "menstruation" },
  }, new Date(2026, 7, 20));

  assert.equal(focus.getFullYear(), 2026);
  assert.equal(focus.getMonth(), 2);
});

test("calendar falls back to local today when the graph is empty", () => {
  const focus = getCalendarFocusDate({}, new Date(2026, 7, 20, 23, 30));
  assert.equal(focus.getFullYear(), 2026);
  assert.equal(focus.getMonth(), 7);
  assert.equal(focus.getDate(), 20);
});

test("calendar-day differences ignore daylight-saving clock changes", () => {
  const beforeSpringChange = new Date("2026-03-29T00:00:00+01:00");
  const afterSpringChange = new Date("2026-03-30T00:00:00+02:00");

  assert.equal(afterSpringChange - beforeSpringChange, 23 * 60 * 60 * 1000);
  assert.equal(calendarDayDifference(afterSpringChange, beforeSpringChange), 1);
});
