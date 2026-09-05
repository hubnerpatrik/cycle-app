import { store } from "../store.js";
import { qs, qsa } from "../core.js";
import { showMessage } from "./toast.js";

let navigation = null;
export function configureModalNavigation(callbacks) {
  navigation = callbacks;
}

export function hideAllModals() {
  qsa(".modal").forEach(modal => {
    modal.classList.remove("show");
    modal.classList.add("hidden");
  });
}

export function showModal(modalId) {
  const modal = qs(modalId);
  if (!modal) return;
  hideAllModals();
  modal.classList.remove("hidden");
  modal.classList.add("show");
  navigation?.modalOpened(modalId);
}

export function hideModal(modalId) {
  const modal = qs(modalId);
  if (!modal) return;
  const wasOpen = !modal.classList.contains("hidden");
  modal.classList.remove("show");
  modal.classList.add("hidden");
  if (wasOpen) navigation?.modalClosed(modalId);
}

export function afterModalSave(modalId, render, reopen) {
  render();
  if (!navigation && reopen) reopen();
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
