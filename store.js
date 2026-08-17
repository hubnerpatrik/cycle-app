// store.js — Application state and localStorage persistence
// ─────────────────────────────────────────────
// Owns the Store class and the singleton store instance.
// Active-map data is exposed through store.entries for compatibility.

/* ─── storage keys ────────────────────────── */

export const LEGACY_STORAGE_KEY = "cycleData";
export const PROFILE_STORAGE_KEY = "profile";
export const MAPS_STORAGE_KEY = "maps";
export const ACTIVE_MAP_ID_STORAGE_KEY = "activeMapId";

export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/* ─── store ───────────────────────────────── */

export class Store {
constructor() {
  this.selectedKey = null;
  this.selectedPointType = "temp";
  this.hoveredKey = null;
  this.hoveredPointType = null;

  this.month = new Date().getMonth();
  this.year = new Date().getFullYear();

  this.modal = this._emptyModal();

  this.horizontalCoverlineMode = false;
  this.verticalCoverlineMode = false;

  // visual guides only
  this.coverlines = {};

  // manually picked fertile window — one active range at a time
  this.fertileRange = { start: null, end: null };

  // person-level info, not tied to any single day
  this.profile = this._emptyProfile();

  this.activeMapId = null;
  this.maps = {};
  this.entries = {};

  this._load();
}

  /** Returns a blank profile state object. */
  _emptyProfile() {
    return {
      name: "",
      consultantName: "",
      age: "",
      usualMeasurementTime: "",
      goal: "",
      measurementMethod: "",
    };
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

    sensation: "",

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

    markerColor: "blue",
    sex: false,
    other: "",
  };
}

  _emptyMap(id, name = "") {
    return {
      id,
      name,
      createdAt: new Date().toISOString(),
      status: "open",
      closedAt: null,
      entries: {},
      coverlines: {},
      fertileRange: { start: null, end: null },
    };
  }

  _safeParse(raw, fallback) {
    try {
      const parsed = raw ? JSON.parse(raw) : fallback;
      return isPlainObject(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  _normalizeProfile(profile) {
    return {
      ...this._emptyProfile(),
      ...(isPlainObject(profile) ? profile : {}),
    };
  }

  _isProfileComplete(profile = this.profile) {
    return profile?.setupCompleted === true;
  }

  _normalizeMap(map, fallbackId, fallbackName = "") {
    const normalized = isPlainObject(map) ? map : {};
    return {
      id: fallbackId,
      name: typeof normalized.name === "string" ? normalized.name : fallbackName,
      createdAt: normalized.createdAt || new Date().toISOString(),
      status: normalized.status === "closed" ? "closed" : "open",
      closedAt: normalized.closedAt ?? null,
      entries: isPlainObject(normalized.entries) ? normalized.entries : {},
      coverlines: isPlainObject(normalized.coverlines) ? normalized.coverlines : {},
      fertileRange: isPlainObject(normalized.fertileRange)
        ? {
            start: normalized.fertileRange.start ?? null,
            end: normalized.fertileRange.end ?? null,
          }
        : { start: null, end: null },
    };
  }

  _generateMapId() {
    return `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _persistAll() {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
    localStorage.setItem(MAPS_STORAGE_KEY, JSON.stringify(this.maps));

    if (this.activeMapId) {
      localStorage.setItem(ACTIVE_MAP_ID_STORAGE_KEY, this.activeMapId);
    } else {
      localStorage.removeItem(ACTIVE_MAP_ID_STORAGE_KEY);
    }
  }

  _clearTransientSelection() {
    this.selectedKey = null;
    this.hoveredKey = null;
    this.hoveredPointType = null;
    this.currentCycleIndex = null;
  }

  _syncActiveMapState() {
    const activeMap = this.activeMapId ? this.maps[this.activeMapId] : null;
    this.entries = activeMap?.entries ?? {};
    this.coverlines = activeMap?.coverlines ?? {};
    this.fertileRange = activeMap?.fertileRange ?? { start: null, end: null };
  }

  _ensureActiveMap() {
    if (this.activeMapId && this.maps[this.activeMapId]) {
      this._syncActiveMapState();
      return;
    }

    const firstMapId = Object.keys(this.maps)[0] ?? null;
    this.activeMapId = firstMapId;
    this._syncActiveMapState();
  }

  _migrateLegacyData() {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw || localStorage.getItem(MAPS_STORAGE_KEY)) return false;

    const parsed = this._safeParse(raw, null);
    if (!parsed) return false;

    const legacyEntries = "entries" in parsed
      ? (isPlainObject(parsed.entries) ? parsed.entries : {})
      : parsed;

    const mapId = this._generateMapId();
    this.maps = {
      [mapId]: this._normalizeMap({
        id: mapId,
        name: "My cycle",
        createdAt: new Date().toISOString(),
        entries: legacyEntries,
        coverlines: parsed.coverlines,
        fertileRange: parsed.fertileRange,
      }, mapId, "My cycle"),
    };
    this.activeMapId = mapId;
    this.profile = this._normalizeProfile(parsed.profile);
    this._persistAll();
    return true;
  }

  /** Loads profile + maps from localStorage and migrates legacy single-map data if needed. */
  _load() {
    const migrated = this._migrateLegacyData();

    const rawProfile = localStorage.getItem(PROFILE_STORAGE_KEY);
    const storedProfile = this._safeParse(rawProfile, null);
    const storedMaps = this._safeParse(localStorage.getItem(MAPS_STORAGE_KEY), {});
    const storedActiveMapId = localStorage.getItem(ACTIVE_MAP_ID_STORAGE_KEY);

    this.profile = this._normalizeProfile(storedProfile);
    if (isPlainObject(storedProfile) && storedProfile.setupCompleted !== false) {
      this.profile.setupCompleted = true;
    }
    this.maps = Object.fromEntries(
      Object.entries(storedMaps).map(([id, map]) => [id, this._normalizeMap(map, id, map?.name || "")]),
    );
    this.activeMapId = storedActiveMapId;

    this._ensureActiveMap();

    if (migrated) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }

  hasProfile() {
    return this._isProfileComplete();
  }

  getProfile() {
    return this.profile;
  }

  saveProfile(profile) {
    this.profile = {
      ...this._normalizeProfile(profile),
      setupCompleted: true,
    };
    this._persistAll();
  }

  listMaps() {
    return Object.values(this.maps)
      .map(map => this._normalizeMap(map, map.id, map.name))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  getMap(mapId) {
    return this.maps[mapId] ? this._normalizeMap(this.maps[mapId], mapId, this.maps[mapId].name) : null;
  }

  createMap(name) {
    const mapId = this._generateMapId();
    const map = this._emptyMap(mapId, name.trim());
    this.maps[mapId] = map;
    this.activeMapId = mapId;
    this._clearTransientSelection();
    this._syncActiveMapState();
    this._persistAll();
    return map;
  }

  saveMapEntries(mapId, entries) {
    if (!this.maps[mapId]) return;
    this.maps[mapId].entries = entries;
    if (this.activeMapId === mapId) {
      this.entries = this.maps[mapId].entries;
    }
    this._persistAll();
  }

  renameMap(mapId, name) {
    if (!this.maps[mapId]) return false;
    const nextName = String(name ?? "").trim();
    if (!nextName) return false;

    this.maps[mapId] = {
      ...this.maps[mapId],
      name: nextName,
    };

    this._persistAll();
    return true;
  }

  getActiveMapId() {
    return this.activeMapId;
  }

  setActiveMapId(mapId) {
    if (!this.maps[mapId]) return false;
    this.maps[mapId] = {
      ...this.maps[mapId],
      status: "open",
      closedAt: null,
    };
    this.activeMapId = mapId;
    this._clearTransientSelection();
    this._syncActiveMapState();
    this._persistAll();
    return true;
  }

  getActiveMap() {
    return this.activeMapId ? this.getMap(this.activeMapId) : null;
  }

  hasOpenActiveMap() {
    const map = this.getActiveMap();
    return Boolean(map && map.status !== "closed");
  }

  closeActiveMap() {
    if (!this.activeMapId || !this.maps[this.activeMapId]) return null;

    this.save();
    const closedMap = {
      ...this.maps[this.activeMapId],
      status: "closed",
      closedAt: new Date().toISOString(),
    };
    this.maps[this.activeMapId] = closedMap;
    this.activeMapId = null;
    this._clearTransientSelection();
    this._syncActiveMapState();
    this._persistAll();
    return closedMap;
  }

  /** Persists current entries to localStorage. */
  save() {
    if (this.activeMapId && this.maps[this.activeMapId]) {
      this.maps[this.activeMapId] = {
        ...this.maps[this.activeMapId],
        entries: this.entries,
        coverlines: this.coverlines,
        fertileRange: this.fertileRange,
      };
    }

    this._persistAll();
  }

  /** Clears all data and resets state to defaults. */
  reset() {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(PROFILE_STORAGE_KEY);
    localStorage.removeItem(MAPS_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_MAP_ID_STORAGE_KEY);
    this.maps        = {};
    this.activeMapId = null;
    this.entries     = {};
    this.selectedKey = null;
    this.hoveredKey  = null;
    const now        = new Date();
    this.month       = now.getMonth();
    this.year        = now.getFullYear();

    this.horizontalCoverlineMode = false;
    this.verticalCoverlineMode   = false;
    this.coverlines              = {};
    this.fertileRange            = { start: null, end: null };
    this.profile                 = this._emptyProfile();
    this.selectedPointType       = "temp";
    this.hoveredPointType        = null;
    this.currentCycleIndex       = null;
    this.modal = this._emptyModal();
  }
}

/* ─── singleton ───────────────────────────── */

export const store = new Store();
