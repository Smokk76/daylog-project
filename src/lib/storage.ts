import { ProjectData, ProjectTemplate, UiPrefs } from "../types";

const STORAGE_KEY = "roomworks-estimator-v1";
const SNAPSHOT_KEY = "roomworks-estimator-snapshots-v1";
const PROJECT_TEMPLATES_KEY = "roomworks-estimator-project-templates-v1";
const UI_PREFS_KEY = "roomworks-estimator-ui-prefs-v1";
const BACKUP_META_KEY = "roomworks-estimator-backup-meta-v1";
const MAX_SNAPSHOTS = 30;

export interface ProjectSnapshot {
  id: string;
  createdAt: string;
  note?: string;
  data: ProjectData;
}

export interface FullBackup {
  version: 1;
  exportedAt: string;
  project: ProjectData;
  snapshots: ProjectSnapshot[];
  projectTemplates: ProjectTemplate[];
  uiPrefs: UiPrefs;
}

export interface BackupMeta {
  lastFullBackupExportedAt?: string;
}

export const saveProject = (data: ProjectData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const loadProject = (): ProjectData | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ProjectData;
  } catch {
    return null;
  }
};

export const serializeProject = (data: ProjectData): string => JSON.stringify(data, null, 2);

export const deserializeProject = (json: string): ProjectData => JSON.parse(json) as ProjectData;

export const loadSnapshots = (): ProjectSnapshot[] => {
  const raw = localStorage.getItem(SNAPSHOT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProjectSnapshot[];
  } catch {
    return [];
  }
};

export const saveSnapshot = (data: ProjectData, note?: string): ProjectSnapshot[] => {
  const next: ProjectSnapshot = {
    id: `snap-${Date.now()}`,
    createdAt: new Date().toISOString(),
    note,
    data
  };
  const current = loadSnapshots();
  const all = [next, ...current].slice(0, MAX_SNAPSHOTS);
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(all));
  return all;
};

export const saveSnapshots = (snapshots: ProjectSnapshot[]): void => {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
};

export const loadProjectTemplates = (): ProjectTemplate[] => {
  const raw = localStorage.getItem(PROJECT_TEMPLATES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ProjectTemplate[];
  } catch {
    return [];
  }
};

export const saveProjectTemplate = (template: ProjectTemplate): ProjectTemplate[] => {
  const current = loadProjectTemplates();
  const existing = current.findIndex((t) => t.id === template.id);
  let all: ProjectTemplate[];
  if (existing >= 0) {
    all = [...current];
    all[existing] = template;
  } else {
    all = [...current, template];
  }
  localStorage.setItem(PROJECT_TEMPLATES_KEY, JSON.stringify(all));
  return all;
};

export const deleteProjectTemplate = (templateId: string): ProjectTemplate[] => {
  const current = loadProjectTemplates();
  const all = current.filter((t) => t.id !== templateId);
  localStorage.setItem(PROJECT_TEMPLATES_KEY, JSON.stringify(all));
  return all;
};

export const saveProjectTemplates = (templates: ProjectTemplate[]): void => {
  localStorage.setItem(PROJECT_TEMPLATES_KEY, JSON.stringify(templates));
};

const emptyUiPrefs = (): UiPrefs => ({
  collapsedLevelGroups: {},
  dashboardPanelsCollapsed: {},
  roomPanelsCollapsed: {},
  sectionsPanelsCollapsed: {},
  savesPanelsCollapsed: {},
  extensionPanelsCollapsed: {},
  summaryPanelsCollapsed: {}
});

const normalizeUiPrefs = (parsed: Partial<UiPrefs> | null | undefined): UiPrefs => ({
  collapsedLevelGroups: parsed?.collapsedLevelGroups ?? {},
  dashboardPanelsCollapsed: parsed?.dashboardPanelsCollapsed ?? {},
  roomPanelsCollapsed: parsed?.roomPanelsCollapsed ?? {},
  sectionsPanelsCollapsed: parsed?.sectionsPanelsCollapsed ?? {},
  savesPanelsCollapsed: parsed?.savesPanelsCollapsed ?? {},
  extensionPanelsCollapsed: parsed?.extensionPanelsCollapsed ?? {},
  summaryPanelsCollapsed: parsed?.summaryPanelsCollapsed ?? {}
});

export const loadUiPrefs = (): UiPrefs => {
  const raw = localStorage.getItem(UI_PREFS_KEY);
  if (!raw) return emptyUiPrefs();
  try {
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return normalizeUiPrefs(parsed);
  } catch {
    return emptyUiPrefs();
  }
};

export const saveUiPrefs = (prefs: UiPrefs): void => {
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
};

export const loadBackupMeta = (): BackupMeta => {
  const raw = localStorage.getItem(BACKUP_META_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as BackupMeta;
    return {
      lastFullBackupExportedAt: parsed.lastFullBackupExportedAt
    };
  } catch {
    return {};
  }
};

export const saveBackupMeta = (meta: BackupMeta): void => {
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify(meta));
};

export const serializeFullBackup = (backup: FullBackup): string => JSON.stringify(backup, null, 2);

export const deserializeFullBackup = (json: string): FullBackup => JSON.parse(json) as FullBackup;

export const createFullBackup = (project: ProjectData): FullBackup => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  project,
  snapshots: loadSnapshots(),
  projectTemplates: loadProjectTemplates(),
  uiPrefs: loadUiPrefs()
});

export const applyFullBackup = (backup: FullBackup): void => {
  saveProject(backup.project);
  saveSnapshots(Array.isArray(backup.snapshots) ? backup.snapshots : []);
  saveProjectTemplates(Array.isArray(backup.projectTemplates) ? backup.projectTemplates : []);
  saveUiPrefs(normalizeUiPrefs(backup.uiPrefs));
};
