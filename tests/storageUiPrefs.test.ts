import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadUiPrefs, saveUiPrefs } from "../src/lib/storage";
import { UiPrefs } from "../src/types";

const store = new Map<string, string>();
const NEW_UI_PREFS_KEY = "daylog-project-ui-prefs-v1";
const LEGACY_UI_PREFS_KEY = "roomworks-estimator-ui-prefs-v1";

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
    localStorage.setItem(NEW_UI_PREFS_KEY, "{not-json");
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

  it("loads legacy key values and promotes them to the new key", () => {
    const legacyPrefs: UiPrefs = {
      collapsedLevelGroups: { "Ground Floor": true },
      dashboardPanelsCollapsed: { "project-wide-works": false },
      roomPanelsCollapsed: { "work-checklist": true },
      sectionsPanelsCollapsed: { "manage-sections": false },
      savesPanelsCollapsed: { "saves-backups": false },
      extensionPanelsCollapsed: { "extension-quoting": true },
      summaryPanelsCollapsed: { "totals-by-room": false }
    };
    const legacyRaw = JSON.stringify(legacyPrefs);

    localStorage.setItem(LEGACY_UI_PREFS_KEY, legacyRaw);
    const prefs = loadUiPrefs();

    assert.deepEqual(prefs, legacyPrefs);
    assert.equal(localStorage.getItem(NEW_UI_PREFS_KEY), legacyRaw);
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
    assert.equal(localStorage.getItem(LEGACY_UI_PREFS_KEY), null);
  });
});
