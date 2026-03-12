import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadUiPrefs, saveUiPrefs } from "../src/lib/storage";
import { UiPrefs } from "../src/types";

const store = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string): string | null => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string): void => {
    store.set(key, value);
  },
  removeItem: (key: string): void => {
    store.delete(key);
  },
  clear: (): void => {
    store.clear();
  }
};

beforeEach(() => {
  store.clear();
  (globalThis as { localStorage: typeof localStorageMock }).localStorage = localStorageMock;
});

describe("ui prefs storage", () => {
  it("loads empty defaults when missing", () => {
    const prefs = loadUiPrefs();
    assert.deepEqual(prefs, {
      collapsedLevelGroups: {},
      dashboardPanelsCollapsed: {},
      roomPanelsCollapsed: {},
      sectionsPanelsCollapsed: {},
      savesPanelsCollapsed: {},
      extensionPanelsCollapsed: {},
      summaryPanelsCollapsed: {}
    });
  });

  it("loads empty defaults when stored JSON is invalid", () => {
    localStorage.setItem("roomworks-estimator-ui-prefs-v1", "{not-json");
    const prefs = loadUiPrefs();
    assert.deepEqual(prefs, {
      collapsedLevelGroups: {},
      dashboardPanelsCollapsed: {},
      roomPanelsCollapsed: {},
      sectionsPanelsCollapsed: {},
      savesPanelsCollapsed: {},
      extensionPanelsCollapsed: {},
      summaryPanelsCollapsed: {}
    });
  });

  it("saves and reloads exact values", () => {
    const expected: UiPrefs = {
      collapsedLevelGroups: {
        "Ground Floor": true,
        "First Floor": false
      },
      dashboardPanelsCollapsed: { "project-wide-works": true },
      roomPanelsCollapsed: { "work-checklist": false },
      sectionsPanelsCollapsed: { "manage-sections": true },
      savesPanelsCollapsed: { "saves-backups": true },
      extensionPanelsCollapsed: { "extension-quoting": true },
      summaryPanelsCollapsed: { "totals-by-room": true }
    };

    saveUiPrefs(expected);
    const actual = loadUiPrefs();

    assert.deepEqual(actual, expected);
  });
});
