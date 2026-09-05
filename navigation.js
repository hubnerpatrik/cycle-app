// URL/history coordination, independent of rendering and stored observations.
export function createNavigation({ browser = window, normalize, render }) {
  let current = null;
  let started = false;
  const session = "cycle-tracker-v1";
  const owned = () => browser.history.state?.cycleNavigation?.session === session;

  function navigate(route, { replace = false, silent = false } = {}) {
    const next = normalize(route);
    const hash = `#/${next.screen}${next.params.size ? `?${next.params}` : ""}`;
    const same = browser.location.hash === hash;
    const previous = owned() ? browser.history.state.cycleNavigation : null;
    const depth = previous?.depth ?? 0;
    const metadata = { session, depth: replace || same ? depth : depth + 1 };
    browser.history[replace || same ? "replaceState" : "pushState"](
      { cycleNavigation: metadata }, "", hash,
    );
    current = next;
    if (!silent) render(next);
  }

  function read() {
    const [screen, query = ""] = browser.location.hash.replace(/^#\/?/, "").split("?");
    navigate({ screen, params: new URLSearchParams(query) }, { replace: true });
  }

  function back(fallback = "menu") {
    if (owned() && browser.history.state.cycleNavigation.depth > 0) browser.history.back();
    else navigate(fallback, { replace: true });
  }

  return {
    navigate,
    back,
    start() {
      if (!started) {
        browser.addEventListener("popstate", read);
        browser.addEventListener("hashchange", onHashChange);
        started = true;
      }
      read();
    },
    dispose() {
      browser.removeEventListener("popstate", read);
      browser.removeEventListener("hashchange", onHashChange);
      started = false;
    },
    get current() { return current; },
  };

  function onHashChange() {
    // A browser traversal already renders in popstate; a manually edited hash does not.
    const expected = current && `#/${current.screen}${current.params.size ? `?${current.params}` : ""}`;
    if (browser.location.hash !== expected) read();
  }
}
