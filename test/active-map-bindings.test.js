import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();

const { saveActiveMap } = await import("../active-map/bindings.js");
const { Store } = await import("../store.js");
const { LocalStorageAdapter, MAPS_STORAGE_KEY } = await import("../storage/local-storage-adapter.js");

test("Save Map persists the active map without closing it", () => {
  const storage = new MemoryStorage();
  const activeStore = new Store(new LocalStorageAdapter(storage));
  const map = activeStore.createMap("Open map");
  activeStore.entries["2026-09-02"] = { temp: 36.6 };
  const messages = [];

  assert.equal(saveActiveMap({
    activeStore,
    notify: message => messages.push(message),
  }), true);

  assert.equal(activeStore.getActiveMapId(), map.id);
  assert.equal(activeStore.getMap(map.id).status, "open");
  assert.equal(activeStore.getMap(map.id).closedAt, null);
  assert.deepEqual(messages, ["Map saved ✓"]);

  const persistedMaps = JSON.parse(storage.getItem(MAPS_STORAGE_KEY));
  assert.equal(persistedMaps[map.id].status, "open");
  assert.equal(persistedMaps[map.id].entries["2026-09-02"].temp, 36.6);
});
