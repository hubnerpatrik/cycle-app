// store.js — Application state and persistence coordination
// ─────────────────────────────────────────────
// Owns the Store class and the singleton store instance.
// Active-map data is exposed through store.entries for compatibility.

import {
  ACTIVE_MAP_ID_STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  LocalStorageAdapter,
  MAPS_STORAGE_KEY,
  PROFILE_STORAGE_KEY,
} from "./storage/local-storage-adapter.js";
import {
  CROSSABLE_ROW_IDS,
  MARKER_TYPES,
  emptyProfile,
  isPlainObject,
  normalizeApplicationData,
  normalizeCrossedChartTemps,
  normalizeCrossedRows,
  normalizeDayMarkers,
  normalizeMap,
  normalizeProfile,
} from "./data-validation.js";
import { parseBackup, serializeBackup } from "./backup.js";

function clonePersistentState(state) {
  return JSON.parse(JSON.stringify(state));
}

export {
  ACTIVE_MAP_ID_STORAGE_KEY,
  CROSSABLE_ROW_IDS,
  LEGACY_STORAGE_KEY,
  MAPS_STORAGE_KEY,
  MARKER_TYPES,
  PROFILE_STORAGE_KEY,
  isPlainObject,
  normalizeCrossedChartTemps,
  normalizeCrossedRows,
  normalizeDayMarkers,
};

/* ─── store ───────────────────────────────── */

export class Store {
  constructor(persistence = new LocalStorageAdapter()) {
    this.persistence = persistence;
    this.selectedKey = null;
    this.selectedPointType = "temp";
    this.hoveredKey = null;

    this.month = new Date().getMonth();
    this.year = new Date().getFullYear();

    this.modal = this._emptyModal();

    this.horizontalCoverlineMode = false;
    this.verticalCoverlineMode = false;
    this.markerSelectionMode = false;
    this.crossCellSelectionMode = false;
    this.crossCellDraft = null;

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
    this._durableState = clonePersistentState(this.getPersistentState());
  }

  /** Returns a blank profile state object. */
  _emptyProfile() {
    return emptyProfile();
  }

  /** Returns a blank modal state object. */
  _emptyModal() {
    return {
      temp: null,
      tempFactors: "",
      measurementTime: "",
      measurementTimeEnabled: false,
      bleeding: "none",
      sensation: "",

      stretch: false,
      visible: false,

      consistency: "",
      color: "",
      colorOther: "",

      sediment: false,
      marker: "",
      markers: normalizeDayMarkers(),
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
      profileSnapshot: { ...this.profile },
      profileSnapshotLocked: false,
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
    return normalizeProfile(profile);
  }

  _isProfileComplete(profile = this.profile) {
    return profile?.setupCompleted === true;
  }

  _normalizeMap(map, fallbackId, fallbackName = "") {
    return normalizeMap(map, fallbackId, fallbackName);
  }

  _generateMapId() {
    return `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  _persistAll() {
    const nextState = this.getPersistentState();
    try {
      this.persistence.saveState(nextState);
      this._durableState = clonePersistentState(nextState);
    } catch (error) {
      // The adapter has already rolled storage back. Restore the matching
      // in-memory snapshot so an unsaved change is never presented as durable.
      if (this._durableState) {
        this._applyRestoredState(clonePersistentState(this._durableState), { clearTransient: false });
      } else {
        this._load({ skipMigration: true });
      }
      throw error;
    }
  }

  _clearTransientSelection() {
    this.selectedKey = null;
    this.hoveredKey = null;
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
    const raw = this.persistence.read(LEGACY_STORAGE_KEY);
    if (!raw || this.persistence.read(MAPS_STORAGE_KEY)) return false;

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
    this._syncActiveMapState();
    this._persistAll();
    return true;
  }

  /** Loads profile + maps and migrates legacy single-map data if needed. */
  _load({ skipMigration = false } = {}) {
    const migrated = skipMigration ? false : this._migrateLegacyData();

    const rawProfile = this.persistence.read(PROFILE_STORAGE_KEY);
    const storedProfile = this._safeParse(rawProfile, null);
    const storedMaps = this._safeParse(this.persistence.read(MAPS_STORAGE_KEY), {});
    const storedActiveMapId = this.persistence.read(ACTIVE_MAP_ID_STORAGE_KEY);

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
      this.persistence.remove(LEGACY_STORAGE_KEY);
    }
  }

  hasProfile() {
    return this._isProfileComplete();
  }

  getProfile() {
    return this.profile;
  }

  /** Returns the profile captured with the active map, falling back for older maps. */
  getActiveMapProfile() {
    const mapProfile = this.activeMapId ? this.maps[this.activeMapId]?.profileSnapshot : null;
    return mapProfile || this.profile;
  }

  /** Returns all state required to restore the application. */
  getPersistentState() {
    const maps = { ...this.maps };
    if (this.activeMapId && maps[this.activeMapId]) {
      maps[this.activeMapId] = {
        ...maps[this.activeMapId],
        entries: this.entries,
        coverlines: this.coverlines,
        fertileRange: this.fertileRange,
      };
    }
    return { profile: this.profile, maps, activeMapId: this.activeMapId };
  }

  createBackup(exportedAt) {
    return serializeBackup(this.getPersistentState(), exportedAt);
  }

  /** Creates a portable backup containing one selected map and its profile context. */
  createMapBackup(mapId, exportedAt) {
    const state = this.getPersistentState();
    const map = state.maps[mapId];
    if (!map) throw new Error("The selected map no longer exists.");
    const profileSnapshot = map.profileSnapshot || state.profile;
    const portableMap = { ...map, profileSnapshot };
    return serializeBackup({
      profile: profileSnapshot,
      maps: { [mapId]: portableMap },
      activeMapId: state.activeMapId === mapId ? mapId : null,
    }, exportedAt);
  }

  validateBackup(json) {
    return parseBackup(json);
  }

  validateMapBackup(json) {
    const state = parseBackup(json);
    if (Object.keys(state.maps).length !== 1) {
      throw new Error("A shared-map backup must contain exactly one map.");
    }
    return state;
  }

  _applyRestoredState(nextState, { clearTransient = true } = {}) {
    this.profile = nextState.profile;
    this.maps = nextState.maps;
    this.activeMapId = nextState.activeMapId;
    if (clearTransient) this._clearTransientSelection();
    this._syncActiveMapState();
  }

  /** Replaces persisted state only after complete validation and successful storage. */
  restoreBackup(json) {
    const nextState = parseBackup(json);
    this.persistence.saveState(nextState);
    this._applyRestoredState(nextState);
    this._durableState = clonePersistentState(this.getPersistentState());
    return this.getPersistentState();
  }

  /** Adds one shared-map backup without replacing the recipient's profile or maps. */
  importMapBackup(json) {
    const importedState = this.validateMapBackup(json);
    const importedMaps = Object.values(importedState.maps);
    const sourceMap = importedMaps[0];
    const mapId = this.maps[sourceMap.id] ? this._generateMapId() : sourceMap.id;
    const importedMap = {
      ...sourceMap,
      id: mapId,
      status: "closed",
      profileSnapshot: sourceMap.profileSnapshot || importedState.profile,
      profileSnapshotLocked: true,
    };
    const currentState = this.getPersistentState();
    const nextState = {
      profile: currentState.profile,
      maps: { ...currentState.maps, [mapId]: importedMap },
      activeMapId: currentState.activeMapId,
    };

    this.persistence.saveState(nextState);
    this.maps = nextState.maps;
    this._durableState = clonePersistentState(this.getPersistentState());
    return this.getMap(mapId);
  }

  restoreData(data) {
    const nextState = normalizeApplicationData(data, { strict: true });
    this.persistence.saveState(nextState);
    this._applyRestoredState(nextState);
    this._durableState = clonePersistentState(this.getPersistentState());
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
    return Object.hasOwn(this.maps, mapId) ? this._normalizeMap(this.maps[mapId], mapId, this.maps[mapId].name) : null;
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

  deleteMap(mapId) {
    if (!this.maps[mapId]) return false;
    delete this.maps[mapId];

    if (this.activeMapId === mapId) {
      this.activeMapId = null;
      this._clearTransientSelection();
      this._syncActiveMapState();
    }

    this._persistAll();
    return true;
  }

  getActiveMapId() {
    return this.activeMapId;
  }

  setActiveMapId(mapId) {
    if (!Object.hasOwn(this.maps, mapId)) return false;
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

  /** Persists current entries through the configured storage adapter. */
  save() {
    if (this.activeMapId && this.maps[this.activeMapId]) {
      const activeMap = this.maps[this.activeMapId];
      this.maps[this.activeMapId] = {
        ...activeMap,
        entries: this.entries,
        coverlines: this.coverlines,
        fertileRange: this.fertileRange,
        profileSnapshot: activeMap.profileSnapshotLocked
          ? activeMap.profileSnapshot
          : { ...this.profile },
      };
    }

    this._persistAll();
  }

  beginCrossCellSelection() {
    this.crossCellDraft = Object.fromEntries(
      Object.entries(this.entries).map(([key, entry]) => [key, normalizeCrossedChartTemps(entry.crossedChartTemps)]),
    );
    this.crossCellSelectionMode = true;
  }

  toggleCrossedCell(key, temp) {
    const normalizedTemp = normalizeCrossedChartTemps([temp])[0];
    if (!this.crossCellSelectionMode || normalizedTemp == null) return;
    const temps = new Set(this.crossCellDraft?.[key] || []);
    if (temps.has(normalizedTemp)) temps.delete(normalizedTemp);
    else temps.add(normalizedTemp);
    this.crossCellDraft[key] = [...temps];
  }

  commitCrossCellSelection() {
    if (!this.crossCellSelectionMode) return;
    const draft = Object.fromEntries(
      Object.entries(this.crossCellDraft || {}).map(([key, temps]) => [key, [...temps]]),
    );
    Object.entries(draft).forEach(([key, temps]) => {
      const crossedChartTemps = normalizeCrossedChartTemps(temps);
      if (!this.entries[key] && crossedChartTemps.length === 0) return;
      this.entries[key] = { ...(this.entries[key] || {}), crossedChartTemps };
    });
    this.cancelCrossCellSelection();
    try {
      this.save();
    } catch (error) {
      this.crossCellDraft = draft;
      this.crossCellSelectionMode = true;
      throw error;
    }
  }

  cancelCrossCellSelection() {
    this.crossCellSelectionMode = false;
    this.crossCellDraft = null;
  }

  /** Clears all data and resets state to defaults. */
  reset() {
    this.persistence.clear();
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
    this.markerSelectionMode     = false;
    this.crossCellSelectionMode = false;
    this.crossCellDraft          = null;
    this.coverlines              = {};
    this.fertileRange            = { start: null, end: null };
    this.profile                 = this._emptyProfile();
    this.selectedPointType       = "temp";
    this.modal = this._emptyModal();
    this._durableState = clonePersistentState(this.getPersistentState());
  }

  resetModal() {
    this.modal = this._emptyModal();
  }

  updateEntry(key, patch) {
    if (!key || !isPlainObject(patch)) return null;
    this.entries[key] = {
      ...(this.entries[key] || {}),
      ...patch,
    };
    return this.entries[key];
  }
}

/* ─── singleton ───────────────────────────── */

export const store = new Store();
