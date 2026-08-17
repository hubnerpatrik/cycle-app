import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const { renderInfoLines } = await import("../ui.js");

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
