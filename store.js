export const STORAGE_KEY = "cycleData";

export class Store {
  constructor() {
    this.entries     = this._load();
    this.selectedKey = null;
    this.hoveredKey  = null;
    this.month       = new Date().getMonth();
    this.year        = new Date().getFullYear();
    this.modal       = this._emptyModal();
    this.horizontalCoverlineMode = false;
    this.verticalCoverlineMode   = false;
  }

  _emptyModal() {
    return { temp: null, bleeding: "none", discharge: "none", sediment: false, other: "" };
  }

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

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
  }

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

export const store = new Store();