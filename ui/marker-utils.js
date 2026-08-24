export function normalizeMarkerColor(value) {
  return ["green", "blue", "orange"].includes(value) ? value : "blue";
}

export function markerTypeFromColor(color) {
  if (color === "green") return "bbt";
  if (color === "orange") return "cervix";
  return "mucus";
}

export function markerColorFromType(type) {
  if (type === "bbt") return "green";
  if (type === "cervix") return "orange";
  return "blue";
}
