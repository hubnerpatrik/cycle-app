import test from "node:test";
import assert from "node:assert/strict";
import { MemoryStorage } from "./setup.js";

globalThis.localStorage = new MemoryStorage();
const { configureModalNavigation, showModal, hideModal, hideAllModals, afterModalSave } = await import("../ui/modal-shared.js");

test("switching and closing editors does not depend on animation events or deferred callbacks", () => {
  const element = () => {
    const classes = new Set(["hidden"]);
    return { classList: {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
    } };
  };
  const elements = { actionModal: element(), mucusModal: element() };
  globalThis.document = {
    getElementById: id => elements[id],
    querySelectorAll: () => Object.values(elements),
  };
  const opened = [];
  let closed = 0;
  configureModalNavigation({ modalOpened: id => opened.push(id), modalClosed: () => closed++ });
  showModal("actionModal");
  showModal("mucusModal");
  assert.equal(elements.actionModal.classList.contains("hidden"), true);
  assert.equal(elements.mucusModal.classList.contains("show"), true);
  assert.deepEqual(opened, ["actionModal", "mucusModal"]);
  assert.equal(closed, 0);
  hideModal("mucusModal");
  hideModal("mucusModal");
  assert.equal(closed, 1);
  let renders = 0;
  let reopened = 0;
  afterModalSave("mucusModal", () => renders++, () => reopened++);
  assert.equal(renders, 1);
  assert.equal(reopened, 0);
  showModal("actionModal");
  hideAllModals();
  assert.equal(elements.actionModal.classList.contains("hidden"), true);
  assert.equal(closed, 1);
  configureModalNavigation(null);
});
