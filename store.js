// store.js — Application state and localStorage persistence
// ─────────────────────────────────────────────
// Owns the Store class and the singleton store instance.
// All observation data lives in store.entries keyed by "YYYY-MM-DD".

/* ─── storage key ─────────────────────────── */

export const STORAGE_KEY = "cycleData";

/* ─── store ───────────────────────────────── */

export class Store {
constructor() {
  this.entries = this._load();

  this.selectedKey = null;
  this.hoveredKey = null;

  this.month = new Date().getMonth();
  this.year = new Date().getFullYear();

  this.modal = this._emptyModal();

  this.horizontalCoverlineMode = false;
  this.verticalCoverlineMode = false;

  // visual guides only
  this.horizontalGuideY = null;
  this.verticalGuideX = null;
  this.coverlines = {};
}

  /** Returns a blank modal state object. */
_emptyModal() {
  return {
    temp: null,
    tempFactors: "",
    measurementTime: "",
    measurementTimeEnabled: false,
    bleeding: "none",
    discharge: "none",

    sensation: "dry",

    stretch: false,
    visible: false,

    consistency: "",
    color: "",
    colorOther: "",

    sediment: false,
    marker: "",
    isPeak: false,

    cervixFirmness: "",
    cervixHeight: "",
    cervixOpenness: "",

    fertileRangeStart: "",
    fertileRangeEnd: "",

    other: "",
  };
}

  /** Loads entries from localStorage. Returns empty object on parse failure. */
  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};

      if (typeof parsed !== "object" || parsed === null) {
        return {};
      }

      if (parsed.entries) {
        this.horizontalGuideY = parsed.horizontalGuideY ?? null;
        this.verticalGuideX = parsed.verticalGuideX ?? null;
        this.coverlines = parsed.coverlines ?? {};
        return parsed.entries;
      }

      return parsed;
    } catch {
      console.warn("cycleData corrupted — resetting.");
      return {};
    }
  }

  /** Persists current entries to localStorage. */
  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      entries: this.entries,
      horizontalGuideY: this.horizontalGuideY,
      verticalGuideX: this.verticalGuideX,
      coverlines: this.coverlines,
    }));
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

    this.horizontalCoverlineMode = false;
    this.verticalCoverlineMode   = false;
    this.horizontalGuideY        = null;
    this.verticalGuideX          = null;
    this.coverlines              = {};
    this.currentCycleIndex       = null;
    this.modal = this._emptyModal();
  }
}

/* ─── singleton ───────────────────────────── */

export const store = new Store();