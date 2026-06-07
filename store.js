// store.js — Application state and localStorage persistence
// ─────────────────────────────────────────────
// Owns the Store class and the singleton store instance.
// All observation data lives in store.entries keyed by "YYYY-MM-DD".

/* ─── storage key ─────────────────────────── */

export const STORAGE_KEY = "cycleData";

/* ─── store ───────────────────────────────── */

export class Store {
  constructor() {
    this.entries     = this._load();

    this.selectedKey = null; // currently selected day key
    this.hoveredKey  = null; // currently hovered day key

    this.month = new Date().getMonth();
    this.year  = new Date().getFullYear();

    this.modal = this._emptyModal();

    this.horizontalCoverlineMode = false; // true while user is placing horizontal coverline
    this.verticalCoverlineMode   = false; // true while user is placing vertical coverline
  }

  /** Returns a blank modal state object. */
 _emptyModal() {
  return {
    temp: null,
    tempFactors: "",
    bleeding: "none",
    discharge: "none",
    sediment: false,
    other: "",
  };
}

  /** Loads entries from localStorage. Returns empty object on parse failure. */
  _load() {
    try {
      const raw    = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      console.warn("cycleData corrupted — resetting.");
      return {};
    }
  }

  /** Persists current entries to localStorage. */
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
  }

  /** Clears all data and resets state to defaults. */
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.entries     = {};
    this.selectedKey = null;
    this.hoveredKey  = null;
    const now        = new Date();
    this.month       = now.getMonth();
    this.year        = now.getFullYear();
  }
}

/* ─── singleton ───────────────────────────── */

export const store = new Store();