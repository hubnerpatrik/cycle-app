import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const { Store, PROFILE_STORAGE_KEY } = await import("../store.js");

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
