import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const { store } = await import("../store.js");
const {
  markerHeadingFromColor,
  renderInfoLines,
  returnsToActionMenuAfterSave,
  selectMarkerType,
  validateTempInput,
} = await import("../ui.js");

test("temperature entry accepts only values from 36.00 through 37.40 °C", () => {
  const tempInput = { value: "" };
  globalThis.document = {
    getElementById: id => id === "tempInput" ? tempInput : null,
  };

  for (const value of ["36", "36.55", "37.40", "37,40"]) {
    tempInput.value = value;
    assert.equal(validateTempInput(), true, `${value} should be accepted`);
  }
  for (const value of ["35.99", "37.41", "not-a-number"]) {
    tempInput.value = value;
    assert.equal(validateTempInput(), false, `${value} should be rejected`);
  }
});

test("marker saves return directly to the chart", () => {
  assert.equal(returnsToActionMenuAfterSave("markersModal"), false);
  assert.equal(returnsToActionMenuAfterSave("mucusModal"), true);
});

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
  const markerLabel = { textContent: "" };
  globalThis.document = {
    getElementById: id => ({ markersMarker: markerInput, markersMarkerLabel: markerLabel })[id] ?? null,
    querySelectorAll: () => [],
  };
  store.modal = store._emptyModal();
  store.modal.markerColor = "green";
  store.modal.markers.mucus.value = "2";

  selectMarkerType("blue");
  assert.equal(store.modal.markers.bbt.value, "P");
  assert.equal(markerInput.value, "2");
  assert.equal(markerLabel.textContent, "Mucus Marker");

  markerInput.value = "4";
  selectMarkerType("orange");
  assert.equal(store.modal.markers.mucus.value, "4");
  assert.equal(store.modal.markers.bbt.value, "P");
  assert.equal(markerLabel.textContent, "Cervix Marker");
});

test("each peak type has its own marker heading", () => {
  assert.equal(markerHeadingFromColor("green"), "BBT Marker");
  assert.equal(markerHeadingFromColor("blue"), "Mucus Marker");
  assert.equal(markerHeadingFromColor("orange"), "Cervix Marker");
});
