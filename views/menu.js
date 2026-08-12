function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const MENU_ITEMS = [
  {
    screen: "my-profile",
    title: "My Profile",
    description: "Review or edit your profile.",
  },
  {
    screen: "my-maps",
    title: "My Maps",
    description: "Browse saved cycle map.",
  },
  {
    screen: "create-map",
    title: "Create Map",
    description: "Start a new empty cycle map.",
  },
  {
    screen: "active-map",
    title: "Active Map",
    description: "Continue editing the currently active map.",
  },
];

export function renderMenuView(container, { activeMap, onNavigate }) {
  const activeMapName = activeMap?.name?.trim() || "No active map yet";
  const activeMapHint = activeMap ? "Your active map you're working on." : "Create a map first to see it here.";

  container.innerHTML = `
    <section class="screen screen-menu" aria-label="Main menu">
      <div class="screen-shell">
        <div class="screen-hero">
          <p class="screen-kicker">Main Menu</p>
          <h2>Start making maps</h2>
          <p>To start go to create map menu and make a new map.</p>
        </div>

        <div class="screen-card menu-summary-card">
          <div>
            <div class="menu-summary-label">Active map</div>
            <div class="menu-summary-value">${escapeHtml(activeMapName)}</div>
          </div>
          <div class="menu-summary-note">${escapeHtml(activeMapHint)}</div>
        </div>

        <div class="menu-grid">
          ${MENU_ITEMS.map(item => {
            const disabled = item.screen === "active-map" && !activeMap;
            return `
              <button
                type="button"
                class="screen-card menu-card${disabled ? " is-disabled" : ""}"
                data-screen="${item.screen}"
                ${disabled ? "disabled" : ""}
              >
                <span class="menu-card-index">${MENU_ITEMS.indexOf(item) + 1}</span>
                <span class="menu-card-title">${escapeHtml(item.title)}</span>
                <span class="menu-card-description">${escapeHtml(item.description)}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;

  container.querySelectorAll("[data-screen]").forEach(button => {
    button.addEventListener("click", () => onNavigate?.(button.dataset.screen));
  });
}
