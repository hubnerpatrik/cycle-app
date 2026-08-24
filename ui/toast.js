import { qs } from "../core.js";

let toastTimer = null;
let toastTransitionHandler = null;

/** Hides the current message immediately, including persistent tool hints. */
export function hideMessage() {
  const toast = qs("toast");
  if (!toast) return;

  clearTimeout(toastTimer);
  toastTimer = null;
  if (toastTransitionHandler) {
    toast.removeEventListener("transitionend", toastTransitionHandler);
    toastTransitionHandler = null;
  }

  toast.classList.remove("show");
  if (toast.classList.contains("hidden")) return;

  toastTransitionHandler = () => {
    toast.classList.add("hidden");
    toastTransitionHandler = null;
  };
  toast.addEventListener("transitionend", toastTransitionHandler, { once: true });
}

/** Shows a temporary message banner. Used for blocked actions and validation errors. */
export function showMessage(text, duration = 2200) {
  const toast = qs("toast");
  if (!toast) return;

  clearTimeout(toastTimer);
  if (toastTransitionHandler) {
    toast.removeEventListener("transitionend", toastTransitionHandler);
    toastTransitionHandler = null;
  }
  toast.textContent = text;
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));

  if (duration != null) toastTimer = setTimeout(hideMessage, duration);
}
