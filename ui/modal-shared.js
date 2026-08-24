import { store } from "../store.js";
import { qs, qsa } from "../core.js";
import { showMessage } from "./toast.js";

export function showModal(modalId) {
  const modal = qs(modalId);
  if (!modal) return;
  modal.classList.remove("hidden");
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add("show")));
}

export function hideModal(modalId) {
  const modal = qs(modalId);
  if (!modal) return;
  modal.classList.remove("show");
  modal.addEventListener("transitionend", () => modal.classList.add("hidden"), { once: true });
}

export function afterModalSave(modalId, render, reopen) {
  const modal = qs(modalId);
  if (!modal) {
    render();
    return;
  }
  modal.addEventListener("transitionend", () => {
    render();
    if (reopen) setTimeout(reopen, 200);
  }, { once: true });
}

export function syncModalUI() {
  qsa(".segmented button").forEach(button => {
    if (button.closest(".modal")?.classList.contains("hidden")) return;
    let value = button.dataset.value;
    if (value === "true") value = true;
    if (value === "false") value = false;
    button.classList.toggle("active", store.modal[button.dataset.group] === value);
  });
}

export function resetModalState() {
  store.resetModal();
}

export function updateSelectedEntry(patch) {
  return store.updateEntry(store.selectedKey, patch);
}

export function persistStore() {
  try {
    store.save();
    return true;
  } catch {
    showMessage("Changes could not be saved. Please try again.");
    return false;
  }
}
