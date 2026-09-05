import test from "node:test";
import assert from "node:assert/strict";
import { createNavigation } from "../navigation.js";
import { MemoryStorage } from "./setup.js";

function fakeBrowser(hash = "") {
  const listeners = new Map();
  const entries = [{ hash, state: null }];
  let index = 0;
  const browser = {
    location: { hash },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    history: {
      get state() { return entries[index].state; },
      get length() { return entries.length; },
      replaceState(state, title, hash) { entries[index] = { state, hash }; browser.location.hash = hash; },
      pushState(state, title, hash) {
        entries.splice(index + 1);
        entries.push({ state, hash });
        index++;
        browser.location.hash = hash;
      },
      back() { if (index > 0) move(-1); },
      forward() { if (index + 1 < entries.length) move(1); },
    },
  };
  function move(delta) {
    index += delta;
    browser.location.hash = entries[index].hash;
    listeners.get("popstate")?.();
    listeners.get("hashchange")?.();
  }
  return browser;
}

test("pages traverse back and forward once without duplicate history entries", () => {
  const browser = fakeBrowser();
  const rendered = [];
  const navigation = createNavigation({
    browser,
    normalize: input => ({ screen: (typeof input === "string" ? input : input.screen) || "menu", params: new URLSearchParams() }),
    render: route => rendered.push(route.screen),
  });
  navigation.start();
  navigation.navigate("my-maps");
  navigation.navigate("create-map");
  navigation.navigate("create-map");
  assert.equal(browser.history.length, 3);
  navigation.back();
  assert.equal(navigation.current.screen, "my-maps");
  const count = rendered.length;
  browser.history.forward();
  assert.equal(rendered.length, count + 1);
  assert.equal(navigation.current.screen, "create-map");
  navigation.dispose();
  const reloaded = createNavigation({ browser, normalize: input => ({ ...input, params: new URLSearchParams() }), render() {} });
  reloaded.start();
  reloaded.back();
  assert.equal(reloaded.current.screen, "my-maps");
});

globalThis.localStorage = new MemoryStorage();
const { store } = await import("../store.js");
const { createRouter } = await import("../router.js");

function setup(hash = "") {
  store.reset();
  store.saveProfile({ name: "Test" });
  globalThis.document = { getElementById: () => null };
  const browser = fakeBrowser(hash);
  const pages = [];
  const router = createRouter({
    browser,
    root: { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] },
    showStandaloneScreen() {}, openActiveMap() {},
    openMapPage: page => pages.push(page), showMessage() {},
  });
  return { router, browser, pages };
}

test("router restores a specific map and editor day, and Back returns through its parent", () => {
  const { router, browser, pages } = setup();
  const first = store.createMap("First");
  router.start();
  router.navigate("active-map");
  store.selectedKey = "2026-09-05";
  router.modalOpened("actionModal");
  router.modalOpened("mucusModal");
  assert.match(browser.location.hash, /page=mucus&day=2026-09-05/);
  router.modalClosed();
  assert.equal(pages.at(-1), "edit-day");
  browser.history.forward();
  assert.equal(pages.at(-1), "mucus");
  assert.equal(store.selectedKey, "2026-09-05");
  const second = store.createMap("Second");
  router.navigate("active-map");
  router.back();
  assert.equal(store.getActiveMapId(), first.id);
  assert.notEqual(store.getActiveMapId(), second.id);
});

test("router guards deleted maps, invalid dates, unknown screens and prototype names", () => {
  const { router, browser } = setup();
  const map = store.createMap("Test");
  router.start();
  router.navigate({ screen: "active-map", params: new URLSearchParams({ map: map.id, page: "temperature", day: "2026-02-30" }) });
  assert.equal(browser.location.hash.includes("page="), false);
  store.deleteMap(map.id);
  router.start();
  assert.equal(router.currentScreen, "my-maps");
  router.navigate("toString");
  assert.equal(router.currentScreen, "menu");
  router.navigate({ screen: "active-map", params: new URLSearchParams({ map: "__proto__" }) });
  assert.equal(router.currentScreen, "my-maps");
  assert.equal(store.setActiveMapId("constructor"), false);
});

test("direct page entry has a safe Back fallback and setup cannot be bypassed", () => {
  const { router, browser } = setup("#/my-profile");
  router.start();
  assert.equal(router.currentScreen, "my-profile");
  router.back();
  assert.equal(router.currentScreen, "menu");
  assert.equal(browser.history.length, 1);
  store.reset();
  router.navigate("active-map");
  assert.equal(router.currentScreen, "profile-setup");
});
