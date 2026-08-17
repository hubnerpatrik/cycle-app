import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const { store } = await import("../store.js");
const { renderInfoLines, selectMarkerType } = await import("../ui.js");

test("day-info lines append user input as text nodes", () => {
  const appended = [];
  globalThis.document = {
    createElement: tagName => ({ tagName }),
    createTextNode: textContent => ({ textContent }),
  };
  const element = {
    replaceChildren() { appended.length = 0; },
    appendChild(node) { appended.push(node); },
  };
  const payload = '<img src=x onerror="globalThis.pwned=true">';

  renderInfoLines(element, ["Sex: No", `Notes: ${payload}`]);

  assert.deepEqual(appended, [
    { textContent: "Sex: No" },
    { tagName: "br" },
    { textContent: `Notes: ${payload}` },
  ]);
  assert.equal(globalThis.pwned, undefined);
});

test("switching marker types preserves each marker draft", () => {
  const markerInput = { value: "P" };
  globalThis.document = {
    getElementById: id => id === "markersMarker" ? markerInput : null,
    querySelectorAll: () => [],
  };
  store.modal = store._emptyModal();
  store.modal.markerColor = "green";
  store.modal.markers.mucus.value = "2";

  selectMarkerType("blue");
  assert.equal(store.modal.markers.bbt.value, "P");
  assert.equal(markerInput.value, "2");

  markerInput.value = "4";
  selectMarkerType("orange");
  assert.equal(store.modal.markers.mucus.value, "4");
  assert.equal(store.modal.markers.bbt.value, "P");
});
