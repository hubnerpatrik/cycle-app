import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const { Store, PROFILE_STORAGE_KEY, MAPS_STORAGE_KEY, normalizeCrossedRows } = await import("../store.js");

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

test("cross-cell selection can be cancelled without changing entries", () => {
  globalThis.localStorage = new MemoryStorage();
  const store = new Store();
  store.createMap("Test map");
  store.entries["2026-08-17"] = { crossedRows: ["bleedingRow"] };

  store.beginCrossCellSelection();
  store.toggleCrossedCell("2026-08-17", "spottingRow");
  store.cancelCrossCellSelection();

  assert.deepEqual(store.entries["2026-08-17"].crossedRows, ["bleedingRow"]);
});

test("confirmed cross-cell selection is persisted", () => {
  globalThis.localStorage = new MemoryStorage();
  const store = new Store();
  const map = store.createMap("Test map");

  store.beginCrossCellSelection();
  store.toggleCrossedCell("2026-08-17", "mucusModal");
  store.toggleCrossedCell("2026-08-17", "bleedingRow");
  store.commitCrossCellSelection();

  assert.deepEqual(store.entries["2026-08-17"].crossedRows, ["bleedingRow"]);
  const savedMaps = JSON.parse(localStorage.getItem(MAPS_STORAGE_KEY));
  assert.deepEqual(savedMaps[map.id].entries["2026-08-17"].crossedRows, ["bleedingRow"]);
});
