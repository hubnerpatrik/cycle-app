export const CROSSABLE_ROW_IDS = Object.freeze([
  "cycleDayRow", "bleedingRow", "spottingRow", "sedimentRow", "sensationRow",
  "stretchRow", "visibleRow", "consistencyRow", "colorRow", "blueMarkerRow",
  "cervixFirmnessRow", "cervixHeightRow", "cervixOpennessRow", "orangeMarkerRow",
  "otherRow", "sexRow",
]);

export const MARKER_TYPES = Object.freeze(["bbt", "mucus", "cervix"]);
const VALID_MARKER_VALUES = new Set(["", "P", "1", "2", "3", "4", "5", "6"]);
const PROFILE_DEFAULTS = Object.freeze({
  name: "",
  consultantName: "",
  age: "",
  usualMeasurementTime: "",
  goal: "",
  measurementMethod: "",
});

export class DataValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "DataValidationError";
  }
}

export function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizeCrossedRows(rows) {
  if (!Array.isArray(rows)) return [];
  return [...new Set(rows.filter(rowId => CROSSABLE_ROW_IDS.includes(rowId)))];
}

export function normalizeCrossedChartTemps(temps) {
  if (!Array.isArray(temps)) return [];
  return [...new Set(temps
    .filter(temp => typeof temp === "number" && Number.isFinite(temp) && temp >= 36 && temp <= 37.4)
    .map(temp => Math.round(temp * 100) / 100))];
}

function normalizeMarkerValue(value) {
  const normalized = String(value ?? "");
  return VALID_MARKER_VALUES.has(normalized) ? normalized : "";
}

export function normalizeDayMarkers(markers, legacyEntry = {}) {
  const normalized = Object.fromEntries(MARKER_TYPES.map(type => [type, {
    value: "",
    pointType: "temp",
  }]));

  if (isPlainObject(markers)) {
    MARKER_TYPES.forEach(type => {
      const marker = isPlainObject(markers[type]) ? markers[type] : {};
      normalized[type] = {
        value: normalizeMarkerValue(marker.value),
        pointType: marker.pointType === "adjusted" ? "adjusted" : "temp",
      };
    });
    return normalized;
  }

  const legacyValue = normalizeMarkerValue(legacyEntry.marker);
  const legacyType = legacyEntry.markerColor === "green"
    ? "bbt"
    : legacyEntry.markerColor === "orange" ? "cervix" : "mucus";
  normalized[legacyType] = {
    value: legacyValue,
    pointType: legacyEntry.markerPointType === "adjusted" ? "adjusted" : "temp",
  };
  return normalized;
}

export function emptyProfile() {
  return { ...PROFILE_DEFAULTS };
}

export function normalizeProfile(profile, { strict = false } = {}) {
  if (strict && !isPlainObject(profile)) {
    throw new DataValidationError("The backup profile is malformed.");
  }
  const source = isPlainObject(profile) ? profile : {};
  if (strict) {
    Object.keys(PROFILE_DEFAULTS).forEach(key => {
      const isLegacyNumericAge = key === "age" && typeof source[key] === "number" && Number.isFinite(source[key]);
      if (key in source && typeof source[key] !== "string" && !isLegacyNumericAge) {
        throw new DataValidationError(`The profile field “${key}” is malformed.`);
      }
    });
    if ("setupCompleted" in source && typeof source.setupCompleted !== "boolean") {
      throw new DataValidationError("The profile completion value is malformed.");
    }
  }
  const normalized = { ...PROFILE_DEFAULTS, ...source };
  if (typeof normalized.age === "number" && Number.isFinite(normalized.age)) {
    normalized.age = String(normalized.age);
  }
  return normalized;
}

function isDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeEntries(entries, strict) {
  if (entries == null) return {};
  if (strict && !isPlainObject(entries)) {
    throw new DataValidationError("A map's observations are malformed.");
  }
  if (!isPlainObject(entries)) return {};

  const normalized = {};
  Object.entries(entries).forEach(([key, entry]) => {
    if (!isDateKey(key) || !isPlainObject(entry)) {
      if (strict) throw new DataValidationError(`The observation for “${key}” is malformed.`);
      return;
    }
    if (strict && "markers" in entry && !isPlainObject(entry.markers)) {
      throw new DataValidationError(`The markers for “${key}” are malformed.`);
    }
    if (strict && isPlainObject(entry.markers)) {
      MARKER_TYPES.forEach(type => {
        if (type in entry.markers && !isPlainObject(entry.markers[type])) {
          throw new DataValidationError(`The ${type} marker for “${key}” is malformed.`);
        }
      });
    }
    normalized[key] = {
      ...entry,
      crossedRows: normalizeCrossedRows(entry.crossedRows),
      crossedChartTemps: normalizeCrossedChartTemps(entry.crossedChartTemps),
      markers: normalizeDayMarkers(entry.markers, entry),
    };
  });
  return normalized;
}

function normalizeCoverlines(coverlines, strict) {
  if (coverlines == null) return {};
  if (strict && !isPlainObject(coverlines)) {
    throw new DataValidationError("A map's coverlines are malformed.");
  }
  if (!isPlainObject(coverlines)) return {};

  const normalized = {};
  Object.entries(coverlines).forEach(([key, value]) => {
    const validKey = key === "default" || /^cycle-\d+$/.test(key);
    const validValue = isPlainObject(value)
      && (value.horizontalTemp == null || (typeof value.horizontalTemp === "number" && Number.isFinite(value.horizontalTemp)))
      && (value.verticalKey == null || isDateKey(value.verticalKey));
    if (!validKey || !validValue) {
      if (strict) throw new DataValidationError(`The coverline “${key}” is malformed.`);
      return;
    }
    normalized[key] = { ...value };
  });
  return normalized;
}

function normalizeFertileRange(range, strict) {
  if (range == null) return { start: null, end: null };
  if (!isPlainObject(range)) {
    if (strict) throw new DataValidationError("A map's fertile range is malformed.");
    return { start: null, end: null };
  }
  const start = range.start ?? null;
  const end = range.end ?? null;
  if ((start !== null && !isDateKey(start)) || (end !== null && !isDateKey(end))) {
    if (strict) throw new DataValidationError("A map's fertile range contains an invalid date.");
    return { start: null, end: null };
  }
  return { start, end };
}

export function normalizeMap(map, fallbackId, fallbackName = "", { strict = false } = {}) {
  if (strict && !isPlainObject(map)) throw new DataValidationError(`Map “${fallbackId}” is malformed.`);
  const source = isPlainObject(map) ? map : {};
  if (strict && (typeof fallbackId !== "string" || !fallbackId.trim() || /[\u0000-\u001f]/.test(fallbackId))) {
    throw new DataValidationError("A map ID is invalid.");
  }
  if (strict && "id" in source && source.id !== fallbackId) {
    throw new DataValidationError(`Map “${fallbackId}” has a mismatched ID.`);
  }
  if (strict && "name" in source && typeof source.name !== "string") {
    throw new DataValidationError(`Map “${fallbackId}” has a malformed name.`);
  }
  if (strict && "profileSnapshot" in source && source.profileSnapshot !== null && !isPlainObject(source.profileSnapshot)) {
    throw new DataValidationError(`Map “${fallbackId}” has a malformed profile snapshot.`);
  }
  if (strict && "profileSnapshotLocked" in source && typeof source.profileSnapshotLocked !== "boolean") {
    throw new DataValidationError(`Map “${fallbackId}” has a malformed profile ownership value.`);
  }

  return {
    id: fallbackId,
    name: typeof source.name === "string" ? source.name : fallbackName,
    createdAt: typeof source.createdAt === "string" ? source.createdAt : new Date().toISOString(),
    status: source.status === "closed" ? "closed" : "open",
    closedAt: typeof source.closedAt === "string" ? source.closedAt : null,
    entries: normalizeEntries(source.entries, strict),
    coverlines: normalizeCoverlines(source.coverlines, strict),
    fertileRange: normalizeFertileRange(source.fertileRange, strict),
    profileSnapshot: isPlainObject(source.profileSnapshot)
      ? normalizeProfile(source.profileSnapshot, { strict })
      : null,
    profileSnapshotLocked: source.profileSnapshotLocked === true,
  };
}

export function normalizeApplicationData(data, { strict = false } = {}) {
  if (strict && !isPlainObject(data)) throw new DataValidationError("The backup data is malformed.");
  const source = isPlainObject(data) ? data : {};
  if (strict && !isPlainObject(source.maps)) throw new DataValidationError("The backup maps collection is malformed.");
  const rawMaps = isPlainObject(source.maps) ? source.maps : {};
  const maps = Object.fromEntries(Object.entries(rawMaps).map(([id, map]) => [
    id,
    normalizeMap(map, id, map?.name || "", { strict }),
  ]));

  let activeMapId = source.activeMapId ?? null;
  if (activeMapId !== null && (typeof activeMapId !== "string" || !maps[activeMapId])) {
    if (strict) throw new DataValidationError("The active map ID does not identify an imported map.");
    activeMapId = null;
  }

  return {
    profile: normalizeProfile(source.profile, { strict }),
    maps,
    activeMapId,
  };
}
