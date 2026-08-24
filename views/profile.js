const GOAL_OPTIONS = [
  ["", "Not set"],
  ["avoid", "Avoid pregnancy"],
  ["achieve", "Achieve pregnancy"],
  ["observation", "Observation only"],
];

const METHOD_OPTIONS = [
  ["", "Not set"],
  ["oral", "Oral"],
  ["vaginal", "Vaginal"],
  ["rectal", "Rectal"],
];

function renderOptions(options, selectedValue) {
  return options
    .map(([value, label]) => {
      const selected = value === selectedValue ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function readProfile(container) {
  return {
    name: container.querySelector("[name='name']")?.value ?? "",
    consultantName: container.querySelector("[name='consultantName']")?.value ?? "",
    age: container.querySelector("[name='age']")?.value ?? "",
    usualMeasurementTime: container.querySelector("[name='usualMeasurementTime']")?.value ?? "",
    goal: container.querySelector("[name='goal']")?.value ?? "",
    measurementMethod: container.querySelector("[name='measurementMethod']")?.value ?? "",
  };
}

export function renderProfileScreen(container, {
  title,
  subtitle,
  profile,
  submitLabel,
  showCancel,
  onSave,
  onCancel,
}) {
  container.innerHTML = `
    <section class="screen screen-form" aria-label="${escapeHtml(title)}">
      <div class="screen-shell">
        <div class="screen-hero">
          <p class="screen-kicker">Profile</p>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>

        <form class="screen-card screen-form-card profile-editor-card" id="profileScreenForm">
          <div class="profile-editor-layout">
            <div class="profile-fields">
              <div class="modal-section">
                <div class="input-label">Name</div>
                <input name="name" type="text" placeholder="Name and surname" value="${escapeHtml(profile.name)}">
              </div>

              <div class="modal-section">
                <div class="input-label">Consultant name</div>
                <input name="consultantName" type="text" placeholder="Name Surname" value="${escapeHtml(profile.consultantName)}">
              </div>

              <div class="modal-section">
                <div class="input-label">Age</div>
                <input name="age" type="number" min="10" max="60" placeholder="e.g. 30" value="${escapeHtml(profile.age)}">
              </div>

              <div class="modal-section">
                <div class="input-label">Usual measurement time</div>
                <input name="usualMeasurementTime" type="time" value="${escapeHtml(profile.usualMeasurementTime)}">
              </div>

              <div class="modal-section">
                <div class="input-label">Goal</div>
                <select name="goal">${renderOptions(GOAL_OPTIONS, profile.goal)}</select>
              </div>

              <div class="modal-section">
                <div class="input-label">Measurement method</div>
                <select name="measurementMethod">${renderOptions(METHOD_OPTIONS, profile.measurementMethod)}</select>
              </div>

              <div class="modal-actions screen-actions">
                ${showCancel ? '<button type="button" class="btn secondary" id="profileScreenCancelBtn">Back</button>' : ""}
                <button type="submit" class="btn primary">${escapeHtml(submitLabel)}</button>
              </div>
            </div>

            <aside class="profile-photo-panel" aria-label="Profile photo">
              <div class="profile-photo-placeholder" role="img" aria-label="Empty profile photo placeholder">
                <svg viewBox="0 0 96 96" aria-hidden="true">
                  <circle cx="48" cy="35" r="17"></circle>
                  <path d="M18 84c2-19 14-30 30-30s28 11 30 30"></path>
                </svg>
              </div>
              <div class="profile-photo-title">Profile photo</div>
              <p>Photo upload can be added here later.</p>
            </aside>
          </div>
        </form>

      </div>
    </section>
  `;

  const form = container.querySelector("#profileScreenForm");
  form?.addEventListener("submit", event => {
    event.preventDefault();
    onSave?.(readProfile(container));
  });

  container.querySelector("#profileScreenCancelBtn")?.addEventListener("click", () => onCancel?.());
}
import { escapeHtml } from "./view-utils.js";
