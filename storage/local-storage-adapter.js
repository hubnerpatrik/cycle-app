export const LEGACY_STORAGE_KEY = "cycleData";
export const PROFILE_STORAGE_KEY = "profile";
export const MAPS_STORAGE_KEY = "maps";
export const ACTIVE_MAP_ID_STORAGE_KEY = "activeMapId";

const CURRENT_KEYS = [PROFILE_STORAGE_KEY, MAPS_STORAGE_KEY, ACTIVE_MAP_ID_STORAGE_KEY];

export class LocalStorageAdapter {
  constructor(storage = globalThis.localStorage) {
    if (!storage) throw new Error("Browser storage is unavailable.");
    this.storage = storage;
  }

  read(key) {
    return this.storage.getItem(key);
  }

  remove(key) {
    this.storage.removeItem(key);
  }

  saveState({ profile, maps, activeMapId }) {
    const previous = Object.fromEntries(CURRENT_KEYS.map(key => [key, this.read(key)]));

    try {
      this.storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
      this.storage.setItem(MAPS_STORAGE_KEY, JSON.stringify(maps));
      if (activeMapId) this.storage.setItem(ACTIVE_MAP_ID_STORAGE_KEY, activeMapId);
      else this.storage.removeItem(ACTIVE_MAP_ID_STORAGE_KEY);
    } catch (error) {
      this._restore(previous);
      throw new Error("Application data could not be saved.", { cause: error });
    }
  }

  clear() {
    [...CURRENT_KEYS, LEGACY_STORAGE_KEY].forEach(key => this.storage.removeItem(key));
  }

  _restore(values) {
    Object.entries(values).forEach(([key, value]) => {
      try {
        if (value === null) this.storage.removeItem(key);
        else this.storage.setItem(key, value);
      } catch {
        // Best-effort rollback if the storage provider itself is failing.
      }
    });
  }
}
