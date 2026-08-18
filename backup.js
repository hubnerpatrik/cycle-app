import { DataValidationError, isPlainObject, normalizeApplicationData } from "./data-validation.js";

export const BACKUP_APP = "cycle-tracker";
export const BACKUP_VERSION = "0.10.0";

export class BackupFormatError extends Error {
  constructor(message, code = "malformed-data") {
    super(message);
    this.name = "BackupFormatError";
    this.code = code;
  }
}

export function createBackup(data, exportedAt = new Date().toISOString()) {
  const normalized = normalizeApplicationData(data, { strict: true });
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt,
    data: normalized,
  };
}

export function serializeBackup(data, exportedAt) {
  return JSON.stringify(createBackup(data, exportedAt), null, 2);
}

export function parseBackup(json) {
  let backup;
  try {
    backup = JSON.parse(json);
  } catch {
    throw new BackupFormatError("The selected file is not valid JSON.", "invalid-json");
  }

  if (!isPlainObject(backup) || backup.app !== BACKUP_APP || typeof backup.version !== "string") {
    throw new BackupFormatError("This file is not a supported Cycle Tracker backup.", "unsupported-format");
  }
  if (backup.version !== BACKUP_VERSION) {
    throw new BackupFormatError(`Backup version ${backup.version} is not supported.`, "unsupported-format");
  }

  try {
    return normalizeApplicationData(backup.data, { strict: true });
  } catch (error) {
    if (error instanceof DataValidationError) {
      throw new BackupFormatError(error.message, "malformed-data");
    }
    throw error;
  }
}

export function backupFilename(date = new Date(), mapName = "") {
  const mapSlug = String(mapName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  const mapPart = mapSlug ? `-${mapSlug}` : "";
  return `cycle-tracker${mapPart}-backup-${date.toISOString().slice(0, 10)}.json`;
}
