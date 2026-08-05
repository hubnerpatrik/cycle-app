// domain.js — Cycle detection and column building
// ─────────────────────────────────────────────
// Owns all cycle logic: detecting cycle starts,
// resolving cycle IDs and cycle-day numbers,
// and building the column array consumed by render.

import { store } from "./store.js";
import { normalize, parseDateKey, columnX, columnCenterX, isFertileDay, getTimeAdjustment, getAdjustedTemp } from "./app.js";

/* ─── cycle detection ─────────────────────── */

/**
 * Returns a sorted array of cycle start dates.
 * A cycle start is the first menstruation day after a non-menstruation day.
 */
export function getCycleStartDates() {
  const keys   = Object.keys(store.entries).sort();
  const starts = [];

  keys.forEach((key, i) => {
    if (store.entries[key]?.bleeding !== "menstruation") return;
    const prevIsPeriod = store.entries[keys[i - 1]]?.bleeding === "menstruation";
    if (!prevIsPeriod) starts.push(normalize(parseDateKey(key)));
  });

  return starts;
}

/**
 * Returns the cycle-day number for a given date relative to the most
 * recent cycle start that is ≤ that date. Falls back to entry index + 1
 * if no cycle start has been recorded yet.
 */
export function resolveCycleDay(date, starts, fallbackIndex) {
  const d           = normalize(date);
  const latestStart = [...starts].reverse().find(s => normalize(s) <= d);
  if (latestStart) {
    return Math.floor((d - normalize(latestStart)) / 86_400_000) + 1;
  }
  return fallbackIndex + 1;
}

/**
 * Returns a stable cycle ID string (e.g. "cycle-2") for a given date.
 * Increments each time a new cycle start is detected before that date.
 */
export function resolveCycleId(date) {
  const starts = getCycleStartDates();
  let cycleIndex = 0;
  for (let i = 0; i < starts.length; i++) {
    if (normalize(starts[i]) <= normalize(date)) cycleIndex = i + 1;
  }
  return `cycle-${cycleIndex || 1}`;
}

/* ─── column building ─────────────────────── */

/**
 * Builds the column array from store.entries.
 * Each column is a flat object merging entry data with
 * computed layout positions and cycle metadata.
 * Consumed by all render functions each cycle.
 */
export function buildColumns() {
  const keys = Object.keys(store.entries).sort();
  if (!keys.length) return [];

  const starts = getCycleStartDates();

  return keys.map((key, index) => {
    const raw  = store.entries[key];
    const date = parseDateKey(key);

    return {
      key, date, index,

      // layout
      x:       columnX(index),
      centerX: columnCenterX(index),

      // cycle metadata
      cycleId:  resolveCycleId(date),
      cycleDay: resolveCycleDay(date, starts, index),

      // observation data
      temp:            raw.temp             ?? null,
      tempFactors:     raw.tempFactors      ?? "",
      measurementTime: raw.measurementTime  ?? "",
      timeAdjustment:  getTimeAdjustment(raw.measurementTime, store.profile.usualMeasurementTime),
      adjustedTemp:    getAdjustedTemp(raw.temp, raw.measurementTime, store.profile.usualMeasurementTime),

      bleeding:        raw.bleeding         ?? "none",
      discharge:       raw.discharge        ?? "none",

      sensation:       raw.sensation       ?? "",

      stretch:         raw.stretch          ?? false,
      visible:         raw.visible          ?? false,

      consistency:     raw.consistency      ?? "",
      color:           raw.color            ?? "",

      sediment:        raw.sediment         ?? false,

      cervixFirmness:  raw.cervixFirmness   ?? "",
      cervixHeight:    raw.cervixHeight     ?? "",
      cervixOpenness:  raw.cervixOpenness   ?? "",

      other:           raw.other            ?? "",

      isFertile:       isFertileDay(key, store.entries),
      isPeak:          raw.isPeak           ?? false,
      marker:          raw.marker           ?? "",
      markerColor:     raw.markerColor      ?? "blue",

      manualCoverline: raw.manualCoverline  ?? null,
      coverlineStart:  raw.coverlineStart   ?? false,
          };
  });
}
/**
 * Returns all columns for a specific cycle by index (0-based).
 * If cycleIndex is null, returns the latest cycle.
 * Falls back to all columns if no cycles detected.
 */
/**
 * Returns all columns for a specific cycle by index (0-based).
 * If cycleIndex is null, returns the latest cycle.
 * Falls back to all columns if no cycles detected.
 */
export function buildCycleColumns() {
  const allKeys = Object.keys(store.entries).sort();
  if (!allKeys.length) return [];

  const starts = getCycleStartDates();

  // no cycles detected yet — return all entries
  if (!starts.length) {
    return buildColumns();
  }

  const index = store.currentCycleIndex ?? starts.length - 1;
  const clampedIndex = Math.max(0, Math.min(index, starts.length - 1));

  // determine date range for this cycle
  const cycleStart = starts[clampedIndex];
  const cycleEnd   = starts[clampedIndex + 1]
    ? new Date(starts[clampedIndex + 1].getTime() - 86_400_000)
    : null; // null means open-ended (current cycle)

  // filter keys belonging to this cycle
  const cycleKeys = allKeys.filter(key => {
    const d = normalize(parseDateKey(key));
    if (d < normalize(cycleStart)) return false;
    if (cycleEnd && d > normalize(cycleEnd)) return false;
    return true;
  });

  const allStarts = starts;

  // build columns with correct positions (reset index per cycle)
  return cycleKeys.map((key, index) => {
    const raw  = store.entries[key];
    const date = parseDateKey(key);
    return {
      key, date, index,
      x:       columnX(index),
      centerX: columnCenterX(index),
      cycleId:  resolveCycleId(date),
      cycleDay: resolveCycleDay(date, allStarts, index),
      temp:            raw.temp            ?? null,
      tempFactors:     raw.tempFactors     ?? "",
      measurementTime: raw.measurementTime ?? "",
      timeAdjustment:  getTimeAdjustment(raw.measurementTime, store.profile.usualMeasurementTime),
      adjustedTemp:    getAdjustedTemp(raw.temp, raw.measurementTime, store.profile.usualMeasurementTime),
      bleeding:        raw.bleeding        ?? "none",
      discharge:       raw.discharge       ?? "none",
      sensation:       raw.sensation       ?? "",
      stretch:         raw.stretch         ?? false,
      visible:         raw.visible         ?? false,
      consistency:     raw.consistency     ?? "",
      color:           raw.color           ?? "",
      sediment:        raw.sediment        ?? false,
      cervixFirmness:  raw.cervixFirmness  ?? "",
      cervixHeight:    raw.cervixHeight    ?? "",
      cervixOpenness:  raw.cervixOpenness  ?? "",
      other:           raw.other           ?? "",
      isFertile:       isFertileDay(key, store.entries),
      isPeak:          raw.isPeak          ?? false,
      marker:          raw.marker          ?? "",
      markerColor:     raw.markerColor     ?? "blue",
    };
  });
}

/** Returns total number of detected cycles. */
export function getCycleCount() {
  return Math.max(getCycleStartDates().length, 1);
}