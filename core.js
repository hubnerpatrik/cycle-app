// Shared, side-effect-free constants and utilities.

export const qs = id => document.getElementById(id);
export const qsa = selector => document.querySelectorAll(selector);

export const LAYOUT = {
  columnWidth: 50,
  sideLabelWidth: 96,
  tempScaleWidth: 72,
  chartHeight: 840,
  chartPaddingTop: 12,
  chartPaddingBottom: 8,
  minTemp: 36.0,
  maxTemp: 37.4,
  tempStep: 0.05,
};

export const TEMPERATURE_RANGE = Object.freeze({
  min: LAYOUT.minTemp,
  max: LAYOUT.maxTemp,
});

const MILLISECONDS_PER_DAY = 86_400_000;

export const TEMP_FACTORS = {
  alcohol: "Alcohol", travel: "Travel", stress: "Stress", medication: "Medication",
  illness: "Illness", restlessSleep: "Restless sleep", newThermometer: "New thermometer",
  physicalActivity: "Physical activity", other: "Other",
};

const TEMP_ADJUSTMENT_PER_HOUR = 0.1;

function timeToMinutes(time) {
  if (typeof time !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function getTimeAdjustment(actualTime, usualTime) {
  const actual = timeToMinutes(actualTime);
  const usual = timeToMinutes(usualTime);
  if (actual == null || usual == null) return 0;
  return Math.round(-((actual - usual) / 60) * TEMP_ADJUSTMENT_PER_HOUR * 100) / 100;
}

export function getAdjustedTemp(temp, actualTime, usualTime) {
  if (temp == null) return null;
  const adjustment = getTimeAdjustment(actualTime, usualTime);
  return adjustment === 0 ? null : Math.round((temp + adjustment) * 100) / 100;
}

export function normalize(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a timezone-independent ordinal for the date's local calendar day. */
export function calendarDayNumber(date) {
  const d = new Date(date);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MILLISECONDS_PER_DAY);
}

/** Counts local calendar boundaries without assuming that every day has 24 hours. */
export function calendarDayDifference(later, earlier) {
  return calendarDayNumber(later) - calendarDayNumber(earlier);
}

export function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDateKey(date) {
  const d = normalize(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Uses the latest dated graph entry when available, otherwise local today. */
export function getCalendarFocusDate(entries, today = new Date()) {
  const latestKey = Object.keys(entries || {})
    .filter(key => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort()
    .at(-1);
  return latestKey ? parseDateKey(latestKey) : new Date(today);
}

export function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
export function getMonthOffset(year, month) { return (new Date(year, month, 1).getDay() + 6) % 7; }
export function formatTemp(temp) { return temp != null ? Number(temp).toFixed(2) : "-"; }
export function columnX(index) { return index * LAYOUT.columnWidth; }
export function columnCenterX(index) { return columnX(index) + LAYOUT.columnWidth / 2; }
export function chartWidth(columns) { return columns.length * LAYOUT.columnWidth; }
export function graphHeight() { return LAYOUT.chartHeight - LAYOUT.chartPaddingTop - LAYOUT.chartPaddingBottom; }
export function tempSlotCount() { return Math.round((LAYOUT.maxTemp - LAYOUT.minTemp) / LAYOUT.tempStep) + 1; }
export function tempSlotHeight() { return graphHeight() / tempSlotCount(); }
export function chartGridY(index) { return LAYOUT.chartPaddingTop + index * tempSlotHeight(); }

export function chartY(temp) {
  const slots = tempSlotCount();
  const index = Math.min(Math.max(Math.round((temp - LAYOUT.minTemp) / LAYOUT.tempStep), 0), slots - 1);
  return chartGridY(slots - 1 - index) + tempSlotHeight() / 2;
}

export function chartLineY(temp) {
  const slots = tempSlotCount();
  const index = Math.min(Math.max(Math.round((temp - LAYOUT.minTemp) / LAYOUT.tempStep), 0), slots);
  return chartGridY(slots - index);
}

export function pixelYToTemp(y) {
  const slots = tempSlotCount();
  const line = Math.min(Math.max(Math.round((y - LAYOUT.chartPaddingTop) / tempSlotHeight()), 0), slots);
  return LAYOUT.minTemp + (slots - line) * LAYOUT.tempStep;
}

/** Returns the temperature cell containing a canvas Y coordinate. */
export function pixelYToChartCellTemp(y) {
  const slots = tempSlotCount();
  const gridBottom = LAYOUT.chartHeight - LAYOUT.chartPaddingBottom;
  if (y < LAYOUT.chartPaddingTop || y >= gridBottom) return null;

  const row = Math.floor((y - LAYOUT.chartPaddingTop) / tempSlotHeight());
  const temp = LAYOUT.minTemp + (slots - 1 - row) * LAYOUT.tempStep;
  return Math.round(temp * 100) / 100;
}

export function pixelXToColumnKey(x, columns) {
  if (!columns.length) return null;
  return columns.reduce((closest, column) =>
    Math.abs(x - column.centerX) < Math.abs(x - closest.centerX) ? column : closest).key;
}

export function syncCSSVariables() {
  const root = document.documentElement;
  root.style.setProperty("--column-width", `${LAYOUT.columnWidth}px`);
  root.style.setProperty("--label-width", `${LAYOUT.sideLabelWidth}px`);
  root.style.setProperty("--temp-scale-width", `${LAYOUT.tempScaleWidth}px`);
  root.style.setProperty("--chart-height", `${LAYOUT.chartHeight}px`);
}
