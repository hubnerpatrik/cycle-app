import { store } from "../store.js";
import { chartWidth, qs } from "../core.js";

const SIDEBAR_ACTIONS = [
  ["editBtn", "Edit Day", "chip-edit-special", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4Z"/><path d="M14 6l3 3"/></svg>`],
  ["dayInfoBtn", "Day Info", "chip-gray", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="16"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>`],
  ["fertileRangeActionBtn", "Fertile range", "chip-green", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2.5 3.5L16 11H5"/></svg>`],
];

const MODAL_ACTIONS = [
  ["temperatureActionBtn", "Temperature", "chip-orange", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>`],
  ["bleedingActionBtn", "Bleeding", "chip-red", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c4 5 7 8.5 7 12a7 7 0 1 1-14 0c0-3.5 3-7 7-12Z"/></svg>`],
  ["mucusActionBtn", "Mucus", "chip-blue", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9c1.5 1.6 3 1.6 4.5 0s3-1.6 4.5 0 3 1.6 4.5 0 3-1.6 4.5 0"/><path d="M3 15c1.5 1.6 3 1.6 4.5 0s3-1.6 4.5 0 3 1.6 4.5 0 3-1.6 4.5 0"/></svg>`],
  ["cervixActionBtn", "Cervix", "chip-teal", `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/></svg>`],
  ["otherActionBtn", "Other", "chip-purple", `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>`],
];

const LABELS = {
  sensation: { "": "", dry: "D", moist: "M", wet: "W" },
  consistency: { "": "", creamy: "CR", slightlyStretchy: "SS", stretchy: "ST" },
  color: { "": "", white: "W", whiteTranslucent: "WT", translucent: "T", other: "O" },
  firmness: { "": "", hard: "H", soft: "S" },
  height: { "": "", low: "L", medium: "M", high: "H" },
};

function createActionButton([id, label, iconClass, iconSvg]) {
  const button = document.createElement("button");
  button.id = id;
  button.className = "action-btn";
  button.type = "button";
  button.innerHTML = `
    <span class="action-icon ${iconClass}">${iconSvg}</span>
    <span class="action-label">${label}</span>
    <svg class="action-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
  `;
  return button;
}

export function renderActionButtons() {
  const targets = [
    [qs("sidebarActions"), SIDEBAR_ACTIONS],
    [qs("actionModalActions"), MODAL_ACTIONS],
  ];
  targets.forEach(([target, actions]) => {
    if (!target) return;
    target.className = "action-list";
    target.replaceChildren(...actions.map(createActionButton));
  });
}

export function renderProfileInfo() {
  const card = qs("profileInfoCard");
  if (!card) return;
  const profile = store.getActiveMapProfile();
  const rows = [
    ["Name", profile.name],
    ["Consultant", profile.consultantName],
    ["Age", profile.age],
    ["Time", profile.usualMeasurementTime],
    ["Goal", { avoid: "Avoid pregnancy", achieve: "Achieve pregnancy", observation: "Observation only" }[profile.goal]],
    ["Method", { oral: "Oral", vaginal: "Vaginal", rectal: "Rectal" }[profile.measurementMethod]],
  ].filter(([, value]) => value);

  if (!rows.length) {
    card.replaceChildren();
    return;
  }
  card.innerHTML = `
    <div class="profile-info-title">Profile</div>
    <div class="sidebar-profile-photo" role="img" aria-label="Empty profile photo placeholder">
      <svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="35" r="17"></circle><path d="M18 84c2-19 14-30 30-30s28 11 30 30"></path></svg>
    </div>
    <div class="profile-info-rows"></div>`;
  const container = card.querySelector(".profile-info-rows");
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    const name = document.createElement("span");
    const content = document.createElement("span");
    row.className = "profile-info-row";
    name.className = "profile-info-label";
    content.className = "profile-info-value";
    name.textContent = label;
    content.textContent = value;
    row.append(name, content);
    container.appendChild(row);
  });
}

function makeCell(text = "", selected = "", group = "", ...classes) {
  const cell = document.createElement("div");
  cell.className = [
    "map-cell",
    selected,
    group ? `map-cell-accent map-cell-accent-${group}` : "",
    group ? "map-cell-pill" : "",
    ...classes,
  ].filter(Boolean).join(" ");
  cell.textContent = text;
  return cell;
}

function createRowDefinitions() {
  return [
    ["cycleDayRow", "Cycle days", "", col => makeCell(col.cycleDay)],
    ["bleedingRow", "Bleeding", "red", col => makeCell(col.bleeding === "menstruation" ? "●" : "", "", "red", col.bleeding === "menstruation" ? "period" : "")],
    ["spottingRow", "Spotting", "red", col => makeCell(col.bleeding === "spotting" ? "◐" : "", "", "red", col.bleeding === "spotting" ? "spotting" : "")],
    ["sedimentRow", "Clots", "red", col => makeCell(col.sediment ? "✓" : "", "", "red")],
    ["sensationRow", "Sensation", "mucus", col => makeCell(LABELS.sensation[col.sensation] || "", "", "mucus")],
    ["stretchRow", "Slippery ", "mucus", col => makeCell(col.stretch ? "✓" : "", "", "mucus")],
    ["visibleRow", "Discharge", "mucus", col => makeCell(col.visible ? "✓" : "", "", "mucus")],
    ["consistencyRow", "Consistency", "mucus", col => makeCell(LABELS.consistency[col.consistency] || "", "", "mucus")],
    ["colorRow", "Color", "mucus", col => makeCell(LABELS.color[col.color] || "", "", "mucus")],
    ["blueMarkerRow", "Peak Mucus", "mucus", col => makeCell(col.markers?.mucus?.value || "", "", "mucus", col.markers?.mucus?.value ? "marker-blue" : "")],
    ["cervixFirmnessRow", "Firmness", "cervix", col => makeCell(LABELS.firmness[col.cervixFirmness] || "", "", "cervix")],
    ["cervixHeightRow", "Height", "cervix", col => makeCell(LABELS.height[col.cervixHeight] || "", "", "cervix")],
    ["cervixOpennessRow", "Openness", "cervix", col => {
      const cell = makeCell("", "", "cervix");
      if (col.cervixOpenness) {
        const indicator = document.createElement("span");
        indicator.className = `cervix-indicator ${col.cervixOpenness}`;
        indicator.title = `Openness: ${col.cervixOpenness}`;
        cell.appendChild(indicator);
      }
      return cell;
    }],
    ["orangeMarkerRow", "Peak Cervix", "cervix", col => makeCell(col.markers?.cervix?.value || "", "", "cervix", col.markers?.cervix?.value ? "marker-orange" : "")],
    ["otherRow", "Additional symptoms", "symptoms", col => makeCell(col.other ? "✓" : "", "", "symptoms")],
    ["sexRow", "Sex", "symptoms", col => makeCell(col.sex === true ? "✓" : "", "", "symptoms")],
  ].map(([id, label, group, render], index, definitions) => {
    if (!group) return { id, label, group, render, position: "none" };
    const previousGroup = definitions[index - 1]?.[2];
    const nextGroup = definitions[index + 1]?.[2];
    const start = previousGroup !== group;
    const end = nextGroup !== group;
    const position = start && end ? "single" : start ? "start" : end ? "end" : "middle";
    return { id, label, group, render, position };
  });
}

function createMapRow({ label, group, position }) {
  const row = document.createElement("div");
  row.className = [
    "map-row",
    group ? `map-row-group map-row-group-${group}` : "",
    group ? `map-row-group-${position}` : "",
  ].filter(Boolean).join(" ");
  const sideLabel = document.createElement("div");
  const spacer = document.createElement("div");
  const cells = document.createElement("div");
  sideLabel.className = "map-side-label";
  sideLabel.textContent = label;
  spacer.className = "map-temp-spacer";
  cells.className = ["map-cells", group ? `map-cells-group-${group}` : ""].filter(Boolean).join(" ");
  row.append(sideLabel, spacer, cells);
  qs("mapRows").appendChild(row);
  return cells;
}

export function renderMapRows(columns, selectColumn, hoverColumn, clearHover) {
  const dayNumbers = qs("dayNumbers");
  const mapRows = qs("mapRows");
  if (!dayNumbers || !mapRows) return;
  dayNumbers.replaceChildren();
  dayNumbers.style.width = `${chartWidth(columns)}px`;
  mapRows.replaceChildren();

  const definitions = createRowDefinitions();
  const rows = Object.fromEntries(definitions.map(definition => [definition.id, createMapRow(definition)]));
  const attach = (element, column) => {
    element.onmouseenter = () => hoverColumn(column.key);
    element.onmouseleave = clearHover;
    element.onclick = () => selectColumn(column.key);
  };

  columns.forEach(column => {
    const selected = store.selectedKey === column.key ? "selected-column" : "";
    const dayCell = document.createElement("div");
    dayCell.className = ["map-day", selected, column.isFertile ? "fertility-cell" : ""].filter(Boolean).join(" ");
    dayCell.textContent = column.date.getDate();
    attach(dayCell, column);
    dayNumbers.appendChild(dayCell);

    definitions.forEach(definition => {
      const cell = definition.render(column);
      if (selected) cell.classList.add(selected);
      if (column.isFertile) cell.classList.add("fertility-cell");
      if (store.entries[column.key]?.crossedRows?.includes(definition.id)) cell.classList.add("crossed-cell");
      attach(cell, column);
      rows[definition.id].appendChild(cell);
    });
  });
}
