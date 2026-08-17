export function renderCreateMapView(container, { onBack, onCreate }) {
  container.innerHTML = `
    <section class="screen screen-form" aria-label="Create map">
      <div class="screen-shell narrow-shell">
        <div class="screen-hero">
          <p class="screen-kicker">Create Map</p>
          <h2>Name your next map</h2>
          <p>Create an empty map and jump straight into the active chart.</p>
        </div>

        <form class="screen-card screen-form-card" id="createMapForm">
          <div class="modal-section">
            <div class="input-label">Map name</div>
            <input id="createMapNameInput" type="text" required maxlength="80">
          </div>

          <div class="modal-actions screen-actions">
            <button type="button" class="btn secondary" id="createMapBackBtn">Back</button>
            <button type="submit" class="btn primary">Create</button>
          </div>
        </form>
      </div>
    </section>
  `;

  const form = container.querySelector("#createMapForm");
  const input = container.querySelector("#createMapNameInput");

  form?.addEventListener("submit", event => {
    event.preventDefault();
    const name = input?.value.trim() ?? "";
    if (!name) {
      input?.focus();
      return;
    }
    onCreate?.(name);
  });

  container.querySelector("#createMapBackBtn")?.addEventListener("click", () => onBack?.());
}
