import { store } from "./store.js";
import { normalize, parseDateKey } from "./app.js";
import { columnX, columnCenterX } from "./app.js";

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

export function resolveCycleDay(date, starts, fallbackIndex) {
  const d           = normalize(date);
  const latestStart = [...starts].reverse().find(s => normalize(s) <= d);
  if (latestStart) {
    return Math.floor((d - normalize(latestStart)) / 86_400_000) + 1;
  }
  return fallbackIndex + 1;
}

export function resolveCycleId(date) {
  const starts = getCycleStartDates();
  let cycleIndex = 0;
  for (let i = 0; i < starts.length; i++) {
    if (normalize(starts[i]) <= normalize(date)) cycleIndex = i + 1;
  }
  return `cycle-${cycleIndex || 1}`;
}

export function buildColumns() {
  const keys = Object.keys(store.entries).sort();
  if (!keys.length) return [];

  const starts = getCycleStartDates();

  return keys.map((key, index) => {
    const raw  = store.entries[key];
    const date = parseDateKey(key);

    return {
      key, date, index,
      x:        columnX(index),
      centerX:  columnCenterX(index),
      cycleId:  resolveCycleId(date),
      cycleDay: resolveCycleDay(date, starts, index),
      temp:           raw.temp          ?? null,
      bleeding:       raw.bleeding      ?? "none",
      discharge:      raw.discharge     ?? "none",
      sediment:       raw.sediment      ?? false,
      other:          raw.other         ?? "",
      isFertile:      raw.isFertile     ?? false,
      isPeak:         raw.isPeak        ?? false,
      marker:         raw.marker        ?? "",
      manualCoverline: raw.manualCoverline ?? null,
      coverlineStart:  raw.coverlineStart  ?? false,
    };
  });
}