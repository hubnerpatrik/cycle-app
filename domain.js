// domain.js — Cycle detection and column building
// ─────────────────────────────────────────────
// Owns all cycle logic: detecting cycle starts,
// resolving cycle IDs and cycle-day numbers,
// and building the column array consumed by render.

import { store } from "./store.js";
import { normalize, parseDateKey, columnX, columnCenterX } from "./app.js";

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
      bleeding:        raw.bleeding         ?? "none",
      discharge:       raw.discharge        ?? "none",
      sediment:        raw.sediment         ?? false,
      other:           raw.other            ?? "",
      isFertile:       raw.isFertile        ?? false,
      isPeak:          raw.isPeak           ?? false,
      marker:          raw.marker           ?? "",
      manualCoverline: raw.manualCoverline  ?? null,
      coverlineStart:  raw.coverlineStart   ?? false,
    };
  });
}