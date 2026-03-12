import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInitialProject } from "../src/data/defaults";
import { validateFullBackupImportShape, validateProjectImportShape } from "../src/lib/importValidation";

describe("validateProjectImportShape", () => {
  it("accepts a valid project shape", () => {
    const project = createInitialProject();
    assert.doesNotThrow(() => validateProjectImportShape(project));
  });

  it("rejects objects without rooms array", () => {
    const project = createInitialProject();
    const invalid = { ...project, rooms: undefined };
    assert.throws(() => validateProjectImportShape(invalid), /rooms/);
  });
});

describe("validateFullBackupImportShape", () => {
  it("accepts a valid full backup shape", () => {
    const project = createInitialProject();
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      project,
      snapshots: [],
      projectTemplates: [],
      uiPrefs: {}
    };
    assert.doesNotThrow(() => validateFullBackupImportShape(backup));
  });

  it("rejects unsupported version", () => {
    const project = createInitialProject();
    const backup = {
      version: 2,
      project
    };
    assert.throws(() => validateFullBackupImportShape(backup), /version/);
  });
});
