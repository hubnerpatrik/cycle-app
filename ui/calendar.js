import { store } from "../store.js";
import {
  LAYOUT,
  TEMPERATURE_RANGE,
  TEMP_FACTORS,
  calendarDayDifference,
  chartY,
  formatDateKey,
  getDaysInMonth,
  getMonthOffset,
  qs,
} from "../core.js";
import { getCycleStartDates, isFertileDay } from "../domain.js";

export function renderMonth() {
  qs("monthLabel").innerText = new Date(store.year, store.month)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function renderTempScale() {
  const scale = qs("tempScale");
  if (!scale) return;
  scale.innerHTML = "";
  for (let temp = LAYOUT.maxTemp; temp >= LAYOUT.minTemp - LAYOUT.tempStep / 2; temp -= LAYOUT.tempStep) {
    const label = document.createElement("div");
    label.className = "temp-scale-label";
    label.textContent = Number(temp).toFixed(2);
    label.style.top = `${chartY(temp)}px`;
    scale.appendChild(label);
  }
}

export function renderCalendar(selectColumn) {
  const element = qs("calendar");
  element.innerHTML = "";

  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(day => {
    const weekday = document.createElement("div");
    weekday.textContent = day;
    weekday.className = "calendar-weekday";
    element.appendChild(weekday);
  });

  const totalDays = getDaysInMonth(store.year, store.month);
  const offset = getMonthOffset(store.year, store.month);
  const cycleStarts = getCycleStartDates();

  for (let index = 0; index < offset; index++) element.appendChild(document.createElement("div"));

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(store.year, store.month, day);
    const key = formatDateKey(date);
    const entry = store.entries[key];
    const cell = document.createElement("div");
    cell.className = "day";

    const latestCycleStart = [...cycleStarts].reverse().find(start => start <= date);
    if (latestCycleStart) {
      const cycleNumber = document.createElement("span");
      cycleNumber.className = "day-cycle-num";
      cycleNumber.textContent = calendarDayDifference(date, latestCycleStart) + 1;
      cell.appendChild(cycleNumber);
    }

    const dayNumber = document.createElement("span");
    dayNumber.textContent = day;
    cell.appendChild(dayNumber);

    if (entry?.bleeding === "menstruation") cell.classList.add("red");
    if (isFertileDay(key)) cell.classList.add("fertile-day");
    if (store.selectedKey === key) cell.classList.add("selected");

    cell.onclick = () => selectColumn(key);
    element.appendChild(cell);
  }
}

export function renderTempFactorsOptions() {
  const select = qs("tempFactorsInput");
  if (!select) return;
  const tempInput = qs("tempInput");
  if (tempInput) {
    tempInput.min = String(TEMPERATURE_RANGE.min);
    tempInput.max = String(TEMPERATURE_RANGE.max);
  }

  select.innerHTML = `<option value="">None</option>`
    + Object.entries(TEMP_FACTORS)
      .map(([value, label]) => `<option value="${value}">${label}</option>`)
      .join("");
}
