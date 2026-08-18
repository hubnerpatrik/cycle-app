import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const {
  Store, LEGACY_STORAGE_KEY, PROFILE_STORAGE_KEY, MAPS_STORAGE_KEY, normalizeCrossedChartTemps, normalizeCrossedRows,
  normalizeDayMarkers,
} = await import("../store.js");

test("legacy single-map data migrates without losing observations", () => {
  globalThis.localStorage = new MemoryStorage({
    [LEGACY_STORAGE_KEY]: JSON.stringify({
      profile: { name: "Legacy user" },
      entries: { "2026-08-18": { temp: 36.45, other: "Keep me" } },
      coverlines: { default: { horizontalTemp: 36.4 } },
      fertileRange: { start: "2026-08-17", end: "2026-08-19" },
    }),
  });

  const store = new Store();
  assert.equal(store.listMaps().length, 1);
  assert.equal(store.entries["2026-08-18"].other, "Keep me");
  assert.equal(store.coverlines.default.horizontalTemp, 36.4);
  assert.equal(localStorage.getItem(LEGACY_STORAGE_KEY), null);
});

test("a corrupt stored profile does not bypass setup", () => {
  globalThis.localStorage = new MemoryStorage({ [PROFILE_STORAGE_KEY]: "{broken" });
  assert.equal(new Store().hasProfile(), false);
});

test("saving a profile records explicit setup completion", () => {
  globalThis.localStorage = new MemoryStorage();
  const store = new Store();
  store.saveProfile({ name: "Ada" });
  assert.equal(store.hasProfile(), true);
  assert.equal(JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY)).setupCompleted, true);
});

test("legacy valid profile objects remain completed", () => {
  globalThis.localStorage = new MemoryStorage({
    [PROFILE_STORAGE_KEY]: JSON.stringify({ name: "Legacy user" }),
  });
  assert.equal(new Store().hasProfile(), true);
});

test("array profiles do not bypass setup", () => {
  globalThis.localStorage = new MemoryStorage({
    [PROFILE_STORAGE_KEY]: JSON.stringify([]),
  });
  assert.equal(new Store().hasProfile(), false);
});

test("invalid nested map collections are normalized safely", () => {
  globalThis.localStorage = new MemoryStorage({
    [MAPS_STORAGE_KEY]: JSON.stringify({
      "trusted-key": {
        id: 'untrusted-id\" onclick=\"alert(1)',
        name: "Map",
        entries: [],
        coverlines: [],
        fertileRange: [],
      },
    }),
  });
  const map = new Store().getMap("trusted-key");
  assert.equal(map.id, "trusted-key");
  assert.deepEqual(map.entries, {});
  assert.deepEqual(map.coverlines, {});
  assert.deepEqual(map.fertileRange, { start: null, end: null });
});

test("an array maps payload is rejected", () => {
  globalThis.localStorage = new MemoryStorage({
    [MAPS_STORAGE_KEY]: JSON.stringify([{ id: "unexpected" }]),
  });
  assert.deepEqual(new Store().listMaps(), []);
});

test("crossed rows are limited to known chart rows", () => {
  assert.deepEqual(
    normalizeCrossedRows(["bleedingRow", "unknownRow", "bleedingRow", 42]),
    ["bleedingRow"],
  );
});

test("crossed chart temperatures are normalized and limited to the visible grid", () => {
  assert.deepEqual(
    normalizeCrossedChartTemps([36, 36.0001, 37.4, 37.45, "36.5", null]),
    [36, 37.4],
  );
});

test("legacy marker data migrates to its matching independent marker type", () => {
  assert.deepEqual(normalizeDayMarkers(null, {
    marker: "P",
    markerColor: "green",
    markerPointType: "adjusted",
  }), {
    bbt: { value: "P", pointType: "adjusted" },
    mucus: { value: "", pointType: "temp" },
    cervix: { value: "", pointType: "temp" },
  });
});

test("BBT, mucus, and cervix markers remain independent", () => {
  assert.deepEqual(normalizeDayMarkers({
    bbt: { value: "P", pointType: "temp" },
    mucus: { value: "2" },
    cervix: { value: "4" },
  }), {
    bbt: { value: "P", pointType: "temp" },
    mucus: { value: "2", pointType: "temp" },
    cervix: { value: "4", pointType: "temp" },
  });
});

test("cross-cell selection can be cancelled without changing entries", () => {
  globalThis.localStorage = new MemoryStorage();
  const store = new Store();
  store.createMap("Test map");
  store.entries["2026-08-17"] = { crossedChartTemps: [36.5] };

  store.beginCrossCellSelection();
  store.toggleCrossedCell("2026-08-17", 36.75);
  store.cancelCrossCellSelection();

  assert.deepEqual(store.entries["2026-08-17"].crossedChartTemps, [36.5]);
});

test("confirmed cross-cell selection is persisted", () => {
  globalThis.localStorage = new MemoryStorage();
  const store = new Store();
  const map = store.createMap("Test map");

  store.beginCrossCellSelection();
  store.toggleCrossedCell("2026-08-17", 99);
  store.toggleCrossedCell("2026-08-17", 36.65);
  store.commitCrossCellSelection();

  assert.deepEqual(store.entries["2026-08-17"].crossedChartTemps, [36.65]);
  const savedMaps = JSON.parse(localStorage.getItem(MAPS_STORAGE_KEY));
  assert.deepEqual(savedMaps[map.id].entries["2026-08-17"].crossedChartTemps, [36.65]);
});

test("deleting a map removes it and clears active map state", () => {
  globalThis.localStorage = new MemoryStorage();
  const store = new Store();
  const map = store.createMap("Delete me");
  store.entries["2026-08-17"] = { temp: 36.5 };

  assert.equal(store.deleteMap(map.id), true);
  assert.equal(store.getMap(map.id), null);
  assert.equal(store.getActiveMapId(), null);
  assert.deepEqual(store.entries, {});
  assert.equal(localStorage.getItem("activeMapId"), null);
});
