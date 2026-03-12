const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const validateProjectImportShape = (value: unknown): void => {
  if (!isRecord(value)) {
    throw new Error("Import failed: expected a JSON object.");
  }
  if (!Array.isArray(value.rooms)) {
    throw new Error("Import failed: missing or invalid 'rooms' array.");
  }
  if (!Array.isArray(value.workItems)) {
    throw new Error("Import failed: missing or invalid 'workItems' array.");
  }
  if (!isRecord(value.settings)) {
    throw new Error("Import failed: missing or invalid 'settings' object.");
  }
};

export const validateFullBackupImportShape = (value: unknown): void => {
  if (!isRecord(value)) {
    throw new Error("Full backup import failed: expected a JSON object.");
  }
  if (value.version !== 1) {
    throw new Error("Full backup import failed: unsupported backup version.");
  }
  validateProjectImportShape(value.project);
  if (value.snapshots !== undefined && !Array.isArray(value.snapshots)) {
    throw new Error("Full backup import failed: invalid 'snapshots' format.");
  }
  if (value.projectTemplates !== undefined && !Array.isArray(value.projectTemplates)) {
    throw new Error("Full backup import failed: invalid 'projectTemplates' format.");
  }
  if (value.uiPrefs !== undefined && !isRecord(value.uiPrefs)) {
    throw new Error("Full backup import failed: invalid 'uiPrefs' format.");
  }
};
