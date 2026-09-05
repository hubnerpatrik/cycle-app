import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();

const { Store } = await import("../store.js");
const { BackupFormatError, BACKUP_VERSION, backupFilename, parseBackup } = await import("../backup.js");
const { LocalStorageAdapter, MAPS_STORAGE_KEY } = await import("../storage/local-storage-adapter.js");

function populatedStore(storage = new MemoryStorage()) {
  const store = new Store(new LocalStorageAdapter(storage));
  store.saveProfile({ name: "Ada", usualMeasurementTime: "06:30" });
  const map = store.createMap("Spring cycle");
  store.entries["2026-08-18"] = {
    temp: 36.55,
    other: "Travel day",
    isFertile: true,
    markers: {
      bbt: { value: "P", pointType: "temp" },
      mucus: { value: "2", pointType: "temp" },
      cervix: { value: "", pointType: "temp" },
    },
  };
  store.coverlines.default = {
    horizontalTemp: 36.5,
    verticalKey: "2026-08-18",
    verticalPosition: "center",
  };
  store.save();
  return { store, map };
}

test("serialization exports all restorable state with stable metadata", () => {
  const { store, map } = populatedStore();
  const backup = JSON.parse(store.createBackup("2026-08-18T12:00:00.000Z"));

  assert.equal(backup.app, "cycle-tracker");
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.exportedAt, "2026-08-18T12:00:00.000Z");
  assert.equal(backup.data.activeMapId, map.id);
  assert.equal(backup.data.profile.name, "Ada");
  assert.equal(backup.data.maps[map.id].entries["2026-08-18"].other, "Travel day");
  assert.deepEqual(backup.data.maps[map.id].coverlines.default, {
    horizontalTemp: 36.5,
    verticalKey: "2026-08-18",
    verticalPosition: "center",
  });
});

test("an individual map backup excludes every other saved map", () => {
  const { store, map: firstMap } = populatedStore();
  const secondMap = store.createMap("Second map");
  store.entries["2026-08-19"] = { temp: 36.6 };
  store.save();

  const firstBackup = JSON.parse(store.createMapBackup(firstMap.id));
  const secondBackup = JSON.parse(store.createMapBackup(secondMap.id));

  assert.deepEqual(Object.keys(firstBackup.data.maps), [firstMap.id]);
  assert.equal(firstBackup.data.activeMapId, null);
  assert.deepEqual(Object.keys(secondBackup.data.maps), [secondMap.id]);
  assert.equal(secondBackup.data.activeMapId, secondMap.id);
});

test("saving a map captures its profile independently from later profile changes", () => {
  const { store, map } = populatedStore();
  store.saveProfile({ name: "Profile at save", usualMeasurementTime: "07:00" });
  store.closeActiveMap();
  store.saveProfile({ name: "Changed later", usualMeasurementTime: "08:00" });

  const savedMap = store.getMap(map.id);
  assert.equal(savedMap.profileSnapshot.name, "Profile at save");
  assert.equal(savedMap.profileSnapshot.usualMeasurementTime, "07:00");
  assert.equal(store.getProfile().name, "Changed later");
  assert.equal(JSON.parse(store.createMapBackup(map.id)).data.profile.name, "Profile at save");
});

test("importing a shared map preserves recipient data and uses the author's profile", () => {
  const { store: author, map: authorMap } = populatedStore();
  author.closeActiveMap();
  const sharedBackup = author.createMapBackup(authorMap.id);

  const recipient = new Store(new LocalStorageAdapter(new MemoryStorage()));
  recipient.saveProfile({ name: "Recipient", usualMeasurementTime: "08:15" });
  const recipientMap = recipient.createMap("Recipient map");
  const importedMap = recipient.importMapBackup(sharedBackup);

  assert.equal(recipient.getProfile().name, "Recipient");
  assert.equal(recipient.getActiveMapId(), recipientMap.id);
  assert.equal(recipient.listMaps().length, 2);
  assert.equal(importedMap.profileSnapshot.name, "Ada");
  assert.equal(importedMap.profileSnapshotLocked, true);

  recipient.setActiveMapId(importedMap.id);
  assert.equal(recipient.getActiveMapProfile().name, "Ada");
  assert.equal(recipient.getActiveMapProfile().usualMeasurementTime, "06:30");
});

test("importing the same shared map twice does not overwrite the first copy", () => {
  const { store: author, map } = populatedStore();
  const backup = author.createMapBackup(map.id);
  const recipient = new Store(new LocalStorageAdapter(new MemoryStorage()));
  recipient.saveProfile({ name: "Recipient" });

  const first = recipient.importMapBackup(backup);
  const second = recipient.importMapBackup(backup);

  assert.notEqual(first.id, second.id);
  assert.equal(recipient.listMaps().length, 2);
});

test("map backup filenames identify the selected map safely", () => {
  assert.equal(
    backupFilename(new Date("2026-08-18T12:00:00.000Z"), "Léto / Map #2"),
    "cycle-tracker-leto-map-2-backup-2026-08-18.json",
  );
});

test("a valid backup restores profile, maps, observations, and the active map", () => {
  const { store: source, map } = populatedStore();
  const target = new Store(new LocalStorageAdapter(new MemoryStorage()));

  target.restoreBackup(source.createBackup());

  assert.equal(target.getProfile().name, "Ada");
  assert.equal(target.getActiveMapId(), map.id);
  assert.equal(target.entries["2026-08-18"].temp, 36.55);
  assert.equal(target.entries["2026-08-18"].markers.mucus.value, "2");
});

test("invalid JSON and unrelated files are rejected with distinct format errors", () => {
  assert.throws(() => parseBackup("{broken"), error => (
    error instanceof BackupFormatError && error.code === "invalid-json"
  ));
  assert.throws(() => parseBackup(JSON.stringify({ app: "another-app", version: "1.0", data: {} })), error => (
    error instanceof BackupFormatError && error.code === "unsupported-format"
  ));
});

test("malformed maps and invalid active map IDs are rejected", () => {
  const base = { app: "cycle-tracker", version: BACKUP_VERSION };
  assert.throws(() => parseBackup(JSON.stringify({
    ...base,
    data: { profile: {}, maps: [] },
  })), /maps collection/i);
  assert.throws(() => parseBackup(JSON.stringify({
    ...base,
    data: {
      profile: {},
      maps: { "map-1": { id: "map-1", name: "Map" } },
      activeMapId: "missing-map",
    },
  })), /active map ID/i);
});

test("malformed observations, markers, and coverlines are rejected", () => {
  const wrapMap = map => JSON.stringify({
    app: "cycle-tracker",
    version: BACKUP_VERSION,
    data: { profile: {}, maps: { "map-1": { id: "map-1", ...map } } },
  });

  assert.throws(() => parseBackup(wrapMap({ entries: { "not-a-date": {} } })), /observation/i);
  assert.throws(() => parseBackup(wrapMap({
    entries: { "2026-08-18": { markers: { bbt: [] } } },
  })), /marker/i);
  assert.throws(() => parseBackup(wrapMap({
    coverlines: { default: { horizontalTemp: "warm" } },
  })), /coverline/i);
  assert.throws(() => parseBackup(wrapMap({
    coverlines: { default: { horizontalTemp: 37.41 } },
  })), /coverline/i);
  assert.throws(() => parseBackup(wrapMap({
    coverlines: { default: { verticalKey: "2026-08-18", verticalPosition: "floating" } },
  })), /coverline/i);
  assert.throws(() => parseBackup(wrapMap({
    coverlines: { default: { horizontalStartKey: "not-a-date", horizontalStartPosition: "center" } },
  })), /coverline/i);
  assert.throws(() => parseBackup(wrapMap({
    coverlines: { default: { verticalTopTemp: 37.46 } },
  })), /coverline/i);
  assert.throws(() => parseBackup(wrapMap({ profileSnapshot: [] })), /profile snapshot/i);
  assert.throws(() => parseBackup(wrapMap({
    entries: { "2026-08-18": { temp: 37.41 } },
  })), /temp/i);
  assert.throws(() => parseBackup(wrapMap({
    entries: { "2026-08-18": { temp: 35.99 } },
  })), /temp/i);
  assert.throws(() => parseBackup(wrapMap({
    entries: { "2026-08-18": { other: { text: "not a string" } } },
  })), /other/i);
  assert.throws(() => parseBackup(wrapMap({
    entries: { "2026-08-18": { bleeding: "unexpected" } },
  })), /bleeding/i);
});

test("missing optional map and profile fields receive safe defaults", () => {
  const restored = parseBackup(JSON.stringify({
    app: "cycle-tracker",
    version: BACKUP_VERSION,
    data: {
      profile: { name: "Older backup" },
      maps: { "map-1": { id: "map-1", name: "Map" } },
    },
  }));

  assert.equal(restored.profile.goal, "");
  assert.deepEqual(restored.maps["map-1"].entries, {});
  assert.deepEqual(restored.maps["map-1"].coverlines, {});
  assert.equal(restored.activeMapId, null);
});

test("legacy numeric profile ages remain importable", () => {
  const restored = parseBackup(JSON.stringify({
    app: "cycle-tracker",
    version: BACKUP_VERSION,
    data: { profile: { age: 30 }, maps: {} },
  }));
  assert.equal(restored.profile.age, "30");
});

test("failed validation preserves existing in-memory and persisted data", () => {
  const storage = new MemoryStorage();
  const { store } = populatedStore(storage);
  const beforeState = JSON.stringify(store.getPersistentState());
  const beforeStorage = storage.getItem(MAPS_STORAGE_KEY);

  assert.throws(() => store.restoreBackup("{}"));

  assert.equal(JSON.stringify(store.getPersistentState()), beforeState);
  assert.equal(storage.getItem(MAPS_STORAGE_KEY), beforeStorage);
});

test("a persistence failure rolls storage back and does not change Store state", () => {
  class FailingStorage extends MemoryStorage {
    setItem(key, value) {
      if (this.fail && key === MAPS_STORAGE_KEY) throw new Error("quota exceeded");
      super.setItem(key, value);
    }
  }

  const storage = new FailingStorage();
  const target = populatedStore(storage).store;
  const replacement = populatedStore().store.createBackup();
  const beforeState = JSON.stringify(target.getPersistentState());
  const beforeValues = new Map(storage.values);
  storage.fail = true;

  assert.throws(() => target.restoreBackup(replacement), /could not be saved/i);
  assert.equal(JSON.stringify(target.getPersistentState()), beforeState);
  assert.deepEqual(storage.values, beforeValues);
});

test("export and import round-trip to equivalent application state", () => {
  const { store: source } = populatedStore();
  const restored = new Store(new LocalStorageAdapter(new MemoryStorage()));

  restored.restoreBackup(source.createBackup());

  assert.deepEqual(restored.getPersistentState(), parseBackup(source.createBackup()));
});
