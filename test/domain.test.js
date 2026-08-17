import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const { store } = await import("../store.js");
const { buildColumns, getCycleStartDates } = await import("../domain.js");

function cycleKeys(entries) {
  store.entries = entries;
  return getCycleStartDates().map(date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
}

test("consecutive period days form one cycle start", () => {
  assert.deepEqual(cycleKeys({
    "2026-06-01": { bleeding: "menstruation" },
    "2026-06-02": { bleeding: "menstruation" },
  }), ["2026-06-01"]);
});

test("separated period entries form separate cycle starts", () => {
  assert.deepEqual(cycleKeys({
    "2026-06-01": { bleeding: "menstruation" },
    "2026-07-01": { bleeding: "menstruation" },
  }), ["2026-06-01", "2026-07-01"]);
});

test("consecutive dates across a year boundary remain one period", () => {
  assert.deepEqual(cycleKeys({
    "2026-12-31": { bleeding: "menstruation" },
    "2027-01-01": { bleeding: "menstruation" },
  }), ["2026-12-31"]);
});

test("columns expose all three marker types for the same day", () => {
  store.entries = {
    "2026-08-17": {
      markers: {
        bbt: { value: "P", pointType: "temp" },
        mucus: { value: "1", pointType: "temp" },
        cervix: { value: "3", pointType: "temp" },
      },
    },
  };

  assert.deepEqual(buildColumns()[0].markers, {
    bbt: { value: "P", pointType: "temp" },
    mucus: { value: "1", pointType: "temp" },
    cervix: { value: "3", pointType: "temp" },
  });
});
