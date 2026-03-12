import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { cloneExtensionQuote, createInitialProject, defaultSettings, moduleCatalog, normalizeProjectData, presetDoorCount } from "./data/defaults";
import { downloadTextFile, lineItemsToCsv } from "./lib/csv";
import { validateFullBackupImportShape, validateProjectImportShape } from "./lib/importValidation";
import { buildLineItems, computeRoom, getQtyForWork, getRateForWork, PROJECT_SCOPE_ROOM_ID, roomTotals, summaryTotals } from "./lib/calculations";
import { calculateExtensionQuote } from "./lib/extensionCalculations";
import { FullBackup, ProjectSnapshot, applyFullBackup, createFullBackup, deserializeFullBackup, deserializeProject, loadBackupMeta, loadProject, loadProjectTemplates, loadSnapshots, saveBackupMeta, saveProject, saveProjectTemplate, saveSnapshot, saveUiPrefs, serializeFullBackup, serializeProject, deleteProjectTemplate, loadUiPrefs } from "./lib/storage";
import { Level, ProjectData, ProjectTemplate, QuantitySource, Room, RoomPresetType, RoomWorkSelection, UnitType, UiPrefs, WorkCategory, WorkItem, WorkScope } from "./types";

type Screen = "dashboard" | "room" | "summary" | "sections" | "extension" | "saves";
const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_BACKUP_DAYS = 7;

const levels: Level[] = ["Lower Ground Floor / Basement", "Ground Floor", "First Floor", "Second Floor", "Loft"];
const categoryOrder: WorkCategory[] = [
  "Plastering",
  "Painting",
  "Decoration",
  "Flooring",
  "Tiling",
  "Joinery",
  "Carpentry",
  "Electrical",
  "Heating",
  "Plumbing",
  "Demolition",
  "Other"
];
type CollapseGroupName =
  | "level"
  | "dashboard"
  | "room"
  | "sections"
  | "saves"
  | "extension"
  | "summary";

const toNumber = (value: string): number | undefined => {
  if (value.trim() === "") return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) return undefined;
  return n;
};

const parseIntSafe = (value: string): number => Math.max(0, Math.floor(Number(value) || 0));

type QuickAddDraft = {
  name: string;
  unitType: UnitType;
  quantitySource: QuantitySource;
  category: WorkCategory;
  rate: number;
};

const defaultQuickAddDraft = (): QuickAddDraft => ({
  name: "",
  unitType: "fixed",
  quantitySource: "manual",
  category: "Other",
  rate: 0
});
const projectWideNameKeywords = [
  "portable toilet",
  "mobilisation",
  "scaffold",
  "skip licence",
  "management",
  "final cleaning",
  "parking",
  "temporary fence",
  "overhead",
  "profit"
];
const isLikelyProjectWideName = (name: string): boolean => {
  const lowered = name.trim().toLowerCase();
  return projectWideNameKeywords.some((keyword) => lowered.includes(keyword));
};

const buildAutosaveNote = (previous: ProjectData | undefined, current: ProjectData): string => {
  if (!previous) return "Autosave: initial snapshot";

  const changes: string[] = [];

  const deltaRooms = current.rooms.length - previous.rooms.length;
  const deltaSections = current.sections.length - previous.sections.length;
  const deltaWorkItems = current.workItems.length - previous.workItems.length;
  const deltaSelections = current.selections.length - previous.selections.length;

  if (deltaRooms !== 0) changes.push(`rooms ${deltaRooms > 0 ? "+" : ""}${deltaRooms}`);
  if (deltaSections !== 0) changes.push(`sections ${deltaSections > 0 ? "+" : ""}${deltaSections}`);
  if (deltaWorkItems !== 0) changes.push(`work items ${deltaWorkItems > 0 ? "+" : ""}${deltaWorkItems}`);
  if (deltaSelections !== 0) changes.push(`checklist lines ${deltaSelections > 0 ? "+" : ""}${deltaSelections}`);

  if (changes.length < 3 && JSON.stringify(previous.info) !== JSON.stringify(current.info)) {
    changes.push("changes to project details");
  }
  if (changes.length < 3 && JSON.stringify(previous.rooms) !== JSON.stringify(current.rooms)) {
    changes.push("changes to rooms");
  }
  if (changes.length < 3 && JSON.stringify(previous.settings) !== JSON.stringify(current.settings)) {
    changes.push("changes to rates/settings");
  }
  if (changes.length < 3 && JSON.stringify(previous.extensionQuote) !== JSON.stringify(current.extensionQuote)) {
    changes.push("changes to extension module");
  }
  if (changes.length < 3 && JSON.stringify(previous.workItems) !== JSON.stringify(current.workItems)) {
    changes.push("changes to work items");
  }
  if (changes.length < 3 && JSON.stringify(previous.selections) !== JSON.stringify(current.selections)) {
    changes.push("changes to room checklist");
  }

  return changes.length ? `Autosave: ${changes.slice(0, 3).join(", ")}` : "Autosave: changes detected";
};

export default function App() {
  const [project, setProject] = useState<ProjectData>(() => {
    const loaded = loadProject();
    return loaded ? normalizeProjectData(loaded) : createInitialProject();
  });
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(project.rooms[0]?.id ?? null);

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomLevel, setNewRoomLevel] = useState<Level>("Ground Floor");
  const [newRoomPreset, setNewRoomPreset] = useState<RoomPresetType>("Bedroom");

  const [showCustomWorkForm, setShowCustomWorkForm] = useState(false);
  const [customWorkName, setCustomWorkName] = useState("");
  const [customWorkUnit, setCustomWorkUnit] = useState<UnitType>("m2");
  const [customWorkSource, setCustomWorkSource] = useState<QuantitySource>("manual");
  const [customWorkQty, setCustomWorkQty] = useState<number>(0);
  const [customWorkRate, setCustomWorkRate] = useState<number>(0);
  const [customWorkCategory, setCustomWorkCategory] = useState<WorkCategory>("Other");
  const [customWorkModuleId, setCustomWorkModuleId] = useState<string>("miscellaneous");
  const [applyCustomToRoom, setApplyCustomToRoom] = useState(true);
  const [applyCustomToAllRooms, setApplyCustomToAllRooms] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("enabling-works");
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [collapsedWorkRows, setCollapsedWorkRows] = useState<Record<string, boolean>>({});
  const [quickAddBySectionScope, setQuickAddBySectionScope] = useState<Record<string, QuickAddDraft>>({});
  const [hiddenModulesByRoom, setHiddenModulesByRoom] = useState<Record<string, string[]>>({});
  const [newSectionName, setNewSectionName] = useState("");
  const [sectionItemsSectionId, setSectionItemsSectionId] = useState<string>("enabling-works");
  const [newItemSectionId, setNewItemSectionId] = useState<string>("miscellaneous");
  const [newItemName, setNewItemName] = useState("");
  const [newItemUnit, setNewItemUnit] = useState<UnitType>("each");
  const [newItemCategory, setNewItemCategory] = useState<WorkCategory>("Other");
  const [newItemQtySource, setNewItemQtySource] = useState<QuantitySource>("manual");
  const [newItemRate, setNewItemRate] = useState<number>(0);
  const initialUiPrefs = useMemo(() => loadUiPrefs(), []);
  const [collapsedLevelGroups, setCollapsedLevelGroups] = useState<Record<Level, boolean>>(
    () => ({ ...initialUiPrefs.collapsedLevelGroups } as Record<Level, boolean>)
  );
  const [dashboardPanelsCollapsed, setDashboardPanelsCollapsed] = useState<Record<string, boolean>>(
    () => ({ ...initialUiPrefs.dashboardPanelsCollapsed })
  );
  const [roomPanelsCollapsed, setRoomPanelsCollapsed] = useState<Record<string, boolean>>(
    () => ({ ...initialUiPrefs.roomPanelsCollapsed })
  );
  const [sectionsPanelsCollapsed, setSectionsPanelsCollapsed] = useState<Record<string, boolean>>(
    () => ({ ...initialUiPrefs.sectionsPanelsCollapsed })
  );
  const [savesPanelsCollapsed, setSavesPanelsCollapsed] = useState<Record<string, boolean>>(
    () => ({ ...initialUiPrefs.savesPanelsCollapsed })
  );
  const [extensionPanelsCollapsed, setExtensionPanelsCollapsed] = useState<Record<string, boolean>>(
    () => ({ ...initialUiPrefs.extensionPanelsCollapsed })
  );
  const [summaryPanelsCollapsed, setSummaryPanelsCollapsed] = useState<Record<string, boolean>>(
    () => ({ ...initialUiPrefs.summaryPanelsCollapsed })
  );
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>(() => loadSnapshots());
  const [snapshotNote, setSnapshotNote] = useState("");
  const [sectionsSearch, setSectionsSearch] = useState("");
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [newExtensionTemplateName, setNewExtensionTemplateName] = useState("");
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>(() => loadProjectTemplates());
  const [newProjectTemplateName, setNewProjectTemplateName] = useState("");
  const [showApplyTemplateDialog, setShowApplyTemplateDialog] = useState(false);
  const [templateToApply, setTemplateToApply] = useState<ProjectTemplate | null>(null);
  const [lastFullBackupExportedAt, setLastFullBackupExportedAt] = useState<string | null>(
    () => loadBackupMeta().lastFullBackupExportedAt ?? null
  );
  const [savesMessage, setSavesMessage] = useState<string>("");
  const [backupReminderVisible, setBackupReminderVisible] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fullBackupInputRef = useRef<HTMLInputElement | null>(null);
  const lastAutosaveMsRef = useRef<number>(Date.now());
  const pendingAutosaveLabelsRef = useRef<string[]>([]);

  const markAutosaveLabel = (label: string) => {
    if (!pendingAutosaveLabelsRef.current.includes(label)) {
      pendingAutosaveLabelsRef.current.push(label);
    }
  };

  const isBackupRecent = (hours: number): boolean => {
    if (!lastFullBackupExportedAt) return false;
    const exportedAtMs = new Date(lastFullBackupExportedAt).getTime();
    if (Number.isNaN(exportedAtMs)) return false;
    return Date.now() - exportedAtMs <= hours * 60 * 60 * 1000;
  };

  const shouldPromptBackupAfterEdit = (autosaveLabel?: string): boolean => {
    if (!autosaveLabel) return false;
    const majorEditLabels = new Set([
      "changes to project details",
      "changes to rooms",
      "changes to work items",
      "changes to sections/search setup",
      "changes to rates/settings",
      "changes to extension module",
      "changes from import",
      "changes from applied project template",
      "changes to custom work"
    ]);
    return majorEditLabels.has(autosaveLabel) && !isBackupRecent(24);
  };

  const persist = (next: ProjectData, autosaveLabel?: string) => {
    if (autosaveLabel) markAutosaveLabel(autosaveLabel);
    setProject(next);
    saveProject(next);
    if (shouldPromptBackupAfterEdit(autosaveLabel)) {
      setBackupReminderVisible(true);
    }
  };

  const clearStoredProject = () => {
    const confirmed = window.confirm("Reset stored project data and reload? This will clear project, snapshots, and UI preferences for this origin.");
    if (!confirmed) return;
    try {
      localStorage.removeItem("daylog-project-v1");
      localStorage.removeItem("daylog-project-snapshots-v1");
      localStorage.removeItem("daylog-project-templates-v1");
      localStorage.removeItem("daylog-project-ui-prefs-v1");
      localStorage.removeItem("daylog-project-backup-meta-v1");
      localStorage.removeItem("roomworks-estimator-v1");
      localStorage.removeItem("roomworks-estimator-snapshots-v1");
      localStorage.removeItem("roomworks-estimator-project-templates-v1");
      localStorage.removeItem("roomworks-estimator-ui-prefs-v1");
      localStorage.removeItem("roomworks-estimator-backup-meta-v1");
    } catch (e) {
      // ignore
    }
    const fresh = createInitialProject();
    setProject(fresh);
    setSnapshots([]);
    // reload so UI picks up defaults and clears any derived state
    window.location.reload();
  };

  const lineItems = useMemo(
    () => buildLineItems(project.rooms, project.workItems, project.selections, project.settings),
    [project]
  );

  const totals = useMemo(() => summaryTotals(lineItems, project.settings.dayRateGBP), [lineItems, project.settings.dayRateGBP]);
  const extensionSummary = useMemo(() => calculateExtensionQuote(project.extensionQuote), [project.extensionQuote]);
  const extensionTemplatesSorted = useMemo(
    () => [...project.extensionTemplates].sort((a, b) => a.name.localeCompare(b.name)),
    [project.extensionTemplates]
  );
  const projectCategories = useMemo(() => {
    const existing = new Set(project.workItems.map((w) => w.category));
    return categoryOrder.filter((c) => existing.has(c));
  }, [project.workItems]);
  const roomScopeWorkItems = useMemo(
    () => project.workItems.filter((w) => (w.scope ?? "room") === "room"),
    [project.workItems]
  );
  const projectScopeWorkItems = useMemo(
    () => project.workItems.filter((w) => w.scope === "project"),
    [project.workItems]
  );

  const activeRoom = project.rooms.find((r) => r.id === activeRoomId) ?? null;
  const moduleNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of project.sections) map.set(m.id, m.name);
    return map;
  }, [project.sections]);
  const sectionsSorted = useMemo(
    () => [...project.sections].sort((a, b) => a.order - b.order),
    [project.sections]
  );
  const sectionItemsForSelectedSection = useMemo(
    () => project.workItems
      .filter((item) => (item.moduleId ?? "miscellaneous") === sectionItemsSectionId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [project.workItems, sectionItemsSectionId]
  );
  const workItemsByCategoryForSections = useMemo(() => {
    const grouped = new Map<string, WorkItem[]>();
    for (const work of project.workItems) {
      const category = String((work as { category: unknown }).category ?? "Other");
      const list = grouped.get(category) ?? [];
      list.push(work);
      grouped.set(category, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return grouped;
  }, [project.workItems]);
  const sectionsFilteredByCategory = useMemo(() => {
    const query = sectionsSearch.trim().toLowerCase().replace(/\s+/g, " ");
    const filtered = new Map<string, WorkItem[]>();

    for (const category of workItemsByCategoryForSections.keys()) {
      const items = workItemsByCategoryForSections.get(category) ?? [];
      if (!query) {
        if (items.length) filtered.set(category, items);
        continue;
      }

      const matched = items.filter((work) => {
        const sectionName = (moduleNameById.get(work.moduleId ?? "miscellaneous") ?? "miscellaneous").toLowerCase();
        const workName = work.name.toLowerCase();
        const categoryName = category.toLowerCase();
        return workName.includes(query) || sectionName.includes(query) || categoryName.includes(query);
      });

      if (matched.length) filtered.set(category, matched);
    }

    return filtered;
  }, [sectionsSearch, workItemsByCategoryForSections, moduleNameById]);
  const sectionsCategoryOrder = useMemo(() => {
    const present = Array.from(sectionsFilteredByCategory.keys());
    const known = categoryOrder.filter((cat) => present.includes(cat));
    const unknown = present
      .filter((cat) => !categoryOrder.includes(cat as WorkCategory))
      .sort((a, b) => a.localeCompare(b));
    return [...known, ...unknown];
  }, [sectionsFilteredByCategory]);
  const roomSectionIds = useMemo(() => {
    const ids = new Set(roomScopeWorkItems.map((w) => w.moduleId ?? "miscellaneous"));
    ids.add("miscellaneous");
    return ids;
  }, [roomScopeWorkItems]);
  const sectionsSortedForRooms = useMemo(
    () => sectionsSorted.filter((section) => roomSectionIds.has(section.id)),
    [sectionsSorted, roomSectionIds]
  );
  const effectiveSelectedSectionId = sectionsSortedForRooms.some((s) => s.id === selectedModuleId)
    ? selectedModuleId
    : sectionsSortedForRooms[0]?.id ?? "miscellaneous";
  const sectionTotals = useMemo(() => {
    const workById = new Map(project.workItems.map((w) => [w.id, w]));
    const sectionMap = new Map<string, number>();
    for (const item of lineItems) {
      if (item.excluded) continue;
      const sectionId = workById.get(item.workItemId)?.moduleId ?? "miscellaneous";
      sectionMap.set(sectionId, (sectionMap.get(sectionId) ?? 0) + item.lineTotal);
    }
    return sectionMap;
  }, [lineItems, project.workItems]);
  const defaultVisibleSectionIds = useMemo(
    () => new Set(moduleCatalog.filter((m) => m.defaultVisible).map((m) => m.id)),
    []
  );
  const extensionClientPrice = extensionSummary.clientPrice ?? 0;
  const combinedProjectTotal = totals.grandTotal + extensionClientPrice;
  const combinedProjectManDays = project.settings.dayRateGBP > 0
    ? combinedProjectTotal / project.settings.dayRateGBP
    : 0;
  const projectScopeRoom: Room = {
    id: PROJECT_SCOPE_ROOM_ID,
    name: "Project-wide",
    level: "Ground Floor",
    doorCount: 0,
    excludeFromTotals: false
  };
  const backupAgeDays = useMemo(() => {
    if (!lastFullBackupExportedAt) return null;
    const exportedAtMs = new Date(lastFullBackupExportedAt).getTime();
    if (Number.isNaN(exportedAtMs)) return null;
    return Math.floor((Date.now() - exportedAtMs) / DAY_MS);
  }, [lastFullBackupExportedAt]);
  const isBackupStale = backupAgeDays === null || backupAgeDays >= STALE_BACKUP_DAYS;
  const isCollapsed = (groupName: CollapseGroupName, key: string): boolean => {
    if (groupName === "level") return collapsedLevelGroups[key as Level] ?? false;
    if (groupName === "dashboard") return dashboardPanelsCollapsed[key] ?? false;
    if (groupName === "room") return roomPanelsCollapsed[key] ?? false;
    if (groupName === "sections") return sectionsPanelsCollapsed[key] ?? false;
    if (groupName === "saves") return savesPanelsCollapsed[key] ?? false;
    if (groupName === "extension") return extensionPanelsCollapsed[key] ?? false;
    return summaryPanelsCollapsed[key] ?? false;
  };

  const toggleCollapse = (groupName: CollapseGroupName, key: string) => {
    if (groupName === "level") {
      setCollapsedLevelGroups((prev) => ({ ...prev, [key]: !(prev[key as Level] ?? false) }));
      return;
    }
    if (groupName === "dashboard") {
      setDashboardPanelsCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
      return;
    }
    if (groupName === "room") {
      setRoomPanelsCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
      return;
    }
    if (groupName === "sections") {
      setSectionsPanelsCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
      return;
    }
    if (groupName === "saves") {
      setSavesPanelsCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
      return;
    }
    if (groupName === "extension") {
      setExtensionPanelsCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
      return;
    }
    setSummaryPanelsCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };

  const setAllLevelsCollapsed = (collapsed: boolean) => {
    const next: Record<Level, boolean> = {} as Record<Level, boolean>;
    for (const level of levels) next[level] = collapsed;
    setCollapsedLevelGroups(next);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = Date.now();
      if (now - lastAutosaveMsRef.current >= AUTOSAVE_INTERVAL_MS) {
        const tagged = pendingAutosaveLabelsRef.current.slice(0, 4);
        const note = tagged.length
          ? `Autosave: ${tagged.join(", ")}`
          : buildAutosaveNote(snapshots[0]?.data, project);
        setSnapshots(saveSnapshot(project, note));
        pendingAutosaveLabelsRef.current = [];
        lastAutosaveMsRef.current = now;
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [project, snapshots]);

  useEffect(() => {
    const prefs: UiPrefs = {
      collapsedLevelGroups,
      dashboardPanelsCollapsed,
      roomPanelsCollapsed,
      sectionsPanelsCollapsed,
      savesPanelsCollapsed,
      extensionPanelsCollapsed,
      summaryPanelsCollapsed
    };
    saveUiPrefs(prefs);
  }, [
    collapsedLevelGroups,
    dashboardPanelsCollapsed,
    roomPanelsCollapsed,
    sectionsPanelsCollapsed,
    savesPanelsCollapsed,
    extensionPanelsCollapsed,
    summaryPanelsCollapsed
  ]);

  useEffect(() => {
    const catalogById = new Map(moduleCatalog.flatMap((module) => module.items.map((item) => [item.id, { ...item, moduleId: module.id }] as const)));
    const uniqueByName = new Map<string, { moduleId: string }>();
    const duplicateNames = new Set<string>();
    for (const module of moduleCatalog) {
      for (const item of module.items) {
        if ((item.scope ?? "room") !== "project") continue;
        const key = item.name.trim().toLowerCase();
        if (duplicateNames.has(key)) continue;
        if (uniqueByName.has(key)) {
          uniqueByName.delete(key);
          duplicateNames.add(key);
        } else {
          uniqueByName.set(key, { moduleId: module.id });
        }
      }
    }

    let changed = false;
    const repaired = project.workItems.map((item) => {
      const byId = catalogById.get(item.id);
      const byName = uniqueByName.get(item.name.trim().toLowerCase());
      const shouldBeProject = (byId?.scope ?? "room") === "project" || Boolean(byName) || isLikelyProjectWideName(item.name ?? "");
      if (!shouldBeProject) return item;
      const targetModuleId = (byId?.moduleId ?? byName?.moduleId ?? item.moduleId ?? "site-overheads-setup") as string | undefined;
      if (item.scope === "project" && item.moduleId === targetModuleId) return item;
      changed = true;
      return { ...item, scope: "project" as const, moduleId: targetModuleId };
    });

    if (!changed) return;
    const next = { ...project, workItems: repaired };
    setProject(next);
    saveProject(next);
  }, [project]);

  const upsertSelection = (roomId: string, workItemId: string, patch: Partial<RoomWorkSelection>) => {
    const selections = [...project.selections];
    const idx = selections.findIndex((s) => s.roomId === roomId && s.workItemId === workItemId);

    if (idx >= 0) {
      selections[idx] = { ...selections[idx], ...patch };
    } else {
      selections.push({
        roomId,
        workItemId,
        qtyOverride: undefined,
        rateOverride: undefined,
        titleOverride: undefined,
        isSelected: false,
        isDone: false,
        notes: "",
        ...patch
      });
    }

    persist({ ...project, selections }, "changes to room checklist");
  };

  const upsertProjectSelection = (workItemId: string, patch: Partial<RoomWorkSelection>) => {
    const selections = [...project.selections];
    const idx = selections.findIndex((s) => s.roomId === PROJECT_SCOPE_ROOM_ID && s.workItemId === workItemId);

    if (idx >= 0) {
      selections[idx] = { ...selections[idx], ...patch };
    } else {
      selections.push({
        roomId: PROJECT_SCOPE_ROOM_ID,
        workItemId,
        qtyOverride: undefined,
        rateOverride: undefined,
        titleOverride: undefined,
        isSelected: false,
        isDone: false,
        notes: "",
        ...patch
      });
    }

    persist({ ...project, selections }, "changes to project checklist");
  };

  const updateRoom = (roomId: string, patch: Partial<Room>) => {
    const rooms = project.rooms.map((r) => (r.id === roomId ? { ...r, ...patch } : r));
    persist({ ...project, rooms }, "changes to rooms");
  };

  const bulkSetRoomSelection = (roomId: string, isSelected: boolean) => {
    const selectionMap = new Map(project.selections.map((s) => [`${s.roomId}:${s.workItemId}`, s]));
    const nextSelections = [...project.selections];

    for (const work of roomScopeWorkItems) {
      const key = `${roomId}:${work.id}`;
      const existing = selectionMap.get(key);
      if (existing) {
        const updated: RoomWorkSelection = {
          ...existing,
          isSelected,
          isDone: isSelected ? existing.isDone : false
        };
        const idx = nextSelections.findIndex((s) => s.roomId === roomId && s.workItemId === work.id);
        nextSelections[idx] = updated;
      } else if (isSelected) {
        nextSelections.push({
          roomId,
          workItemId: work.id,
          qtyOverride: undefined,
          rateOverride: undefined,
          titleOverride: undefined,
          isSelected: true,
          isDone: false,
          notes: ""
        });
      }
    }

    persist({ ...project, selections: nextSelections }, "changes to room checklist");
  };

  const bulkSetModuleDone = (roomId: string, workItemIds: string[], isDone: boolean) => {
    if (!workItemIds.length) return;
    const targetIds = new Set(workItemIds);
    const selectionMap = new Map(project.selections.map((s) => [`${s.roomId}:${s.workItemId}`, s]));
    const nextSelections = [...project.selections];

    for (const work of project.workItems) {
      if (!targetIds.has(work.id)) continue;
      const key = `${roomId}:${work.id}`;
      const existing = selectionMap.get(key);
      if (existing) {
        const updated: RoomWorkSelection = {
          ...existing,
          isDone,
          isSelected: isDone ? true : existing.isSelected
        };
        const idx = nextSelections.findIndex((s) => s.roomId === roomId && s.workItemId === work.id);
        nextSelections[idx] = updated;
      } else if (isDone) {
        nextSelections.push({
          roomId,
          workItemId: work.id,
          qtyOverride: undefined,
          rateOverride: undefined,
          titleOverride: undefined,
          isSelected: true,
          isDone: true,
          notes: ""
        });
      }
    }

    persist({ ...project, selections: nextSelections }, "changes to room checklist");
  };

  const bulkSetProjectModuleDone = (workItemIds: string[], isDone: boolean) => {
    if (!workItemIds.length) return;
    const targetIds = new Set(workItemIds);
    const selectionMap = new Map(project.selections.map((s) => [`${s.roomId}:${s.workItemId}`, s]));
    const nextSelections = [...project.selections];

    for (const work of projectScopeWorkItems) {
      if (!targetIds.has(work.id)) continue;
      const key = `${PROJECT_SCOPE_ROOM_ID}:${work.id}`;
      const existing = selectionMap.get(key);
      if (existing) {
        const updated: RoomWorkSelection = {
          ...existing,
          isDone,
          isSelected: isDone ? true : existing.isSelected
        };
        const idx = nextSelections.findIndex((s) => s.roomId === PROJECT_SCOPE_ROOM_ID && s.workItemId === work.id);
        nextSelections[idx] = updated;
      } else if (isDone) {
        nextSelections.push({
          roomId: PROJECT_SCOPE_ROOM_ID,
          workItemId: work.id,
          qtyOverride: undefined,
          rateOverride: undefined,
          titleOverride: undefined,
          isSelected: true,
          isDone: true,
          notes: ""
        });
      }
    }

    persist({ ...project, selections: nextSelections }, "changes to project checklist");
  };

  const addRoom = () => {
    const id = `room-${Date.now()}`;
    const name = newRoomName.trim() || `${newRoomPreset} ${project.rooms.length + 1}`;

    const room: Room = {
      id,
      name,
      level: newRoomLevel,
      doorCount: presetDoorCount(newRoomPreset, project.settings.defaultDoorCountPerRoom),
      excludeFromTotals: false
    };

    const next = { ...project, rooms: [...project.rooms, room] };
    persist(next, "changes to rooms");
    setNewRoomName("");
    setActiveRoomId(id);
    setScreen("room");
  };

  const removeRoom = (roomId: string) => {
    const rooms = project.rooms.filter((r) => r.id !== roomId);
    const selections = project.selections.filter((s) => s.roomId !== roomId);
    const next = { ...project, rooms, selections };
    persist(next, "changes to rooms");
    if (activeRoomId === roomId) {
      setActiveRoomId(rooms[0]?.id ?? null);
      setScreen("dashboard");
    }
  };

  const addModuleToRooms = (moduleId: string, roomIds: string[]) => {
    const module = moduleCatalog.find((m) => m.id === moduleId);
    if (!module || roomIds.length === 0) return;

    const workById = new Map(project.workItems.map((w) => [w.id, w]));
    const workItems = [...project.workItems];
    for (const item of module.items) {
      if (!workById.has(item.id)) {
        workItems.push({ ...item });
        workById.set(item.id, item);
      }
    }

    const selectionMap = new Map(project.selections.map((s) => [`${s.roomId}:${s.workItemId}`, s]));
    const selections = [...project.selections];

    for (const item of module.items) {
      if (item.scope === "project") {
        const key = `${PROJECT_SCOPE_ROOM_ID}:${item.id}`;
        if (selectionMap.has(key)) {
          const idx = selections.findIndex((s) => s.roomId === PROJECT_SCOPE_ROOM_ID && s.workItemId === item.id);
          selections[idx] = { ...selections[idx], isSelected: true };
        } else {
          selections.push({
            roomId: PROJECT_SCOPE_ROOM_ID,
            workItemId: item.id,
            qtyOverride: undefined,
            rateOverride: undefined,
            titleOverride: undefined,
            isSelected: true,
            isDone: false,
            notes: ""
          });
        }
        continue;
      }

      for (const roomId of roomIds) {
        const key = `${roomId}:${item.id}`;
        if (selectionMap.has(key)) {
          const idx = selections.findIndex((s) => s.roomId === roomId && s.workItemId === item.id);
          selections[idx] = { ...selections[idx], isSelected: true };
        } else {
          selections.push({
            roomId,
            workItemId: item.id,
            qtyOverride: undefined,
            rateOverride: undefined,
            titleOverride: undefined,
            isSelected: true,
            isDone: false,
            notes: ""
          });
        }
      }
    }

    setHiddenModulesByRoom((prev) => {
      const next = { ...prev };
      for (const roomId of roomIds) {
        const current = new Set(next[roomId] ?? []);
        current.delete(moduleId);
        next[roomId] = Array.from(current);
      }
      return next;
    });

    persist({ ...project, workItems, selections }, "changes to modules");
  };

  const removeModuleFromRooms = (moduleId: string, roomIds: string[]) => {
    const moduleItemIds = new Set(project.workItems.filter((w) => w.moduleId === moduleId).map((w) => w.id));
    if (!moduleItemIds.size || !roomIds.length) return;

    const roomSet = new Set(roomIds);
    const selections = project.selections.map((s) => {
      if (!roomSet.has(s.roomId) || !moduleItemIds.has(s.workItemId)) return s;
      return {
        ...s,
        isSelected: false,
        isDone: false
      };
    });

    setHiddenModulesByRoom((prev) => {
      const next = { ...prev };
      for (const roomId of roomIds) {
        const current = new Set(next[roomId] ?? []);
        current.add(moduleId);
        next[roomId] = Array.from(current);
      }
      return next;
    });

    persist({ ...project, selections }, "changes to modules");
  };

  const toggleModuleCollapsed = (moduleId: string) => {
    setCollapsedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const isWorkRowCollapsed = (roomId: string, workItemId: string): boolean =>
    collapsedWorkRows[`${roomId}:${workItemId}`] ?? false;

  const toggleWorkRowCollapsed = (roomId: string, workItemId: string) => {
    const key = `${roomId}:${workItemId}`;
    setCollapsedWorkRows((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }));
  };

  const inferSectionScope = (sectionId: string): WorkScope => {
    const template = moduleCatalog.find((m) => m.id === sectionId);
    if (template?.items.length) {
      const templateScopes = new Set(template.items.map((item) => item.scope ?? "room"));
      if (templateScopes.size === 1) {
        return Array.from(templateScopes)[0] as WorkScope;
      }
    }

    const existingItems = project.workItems.filter((item) => (item.moduleId ?? "miscellaneous") === sectionId);
    if (existingItems.length) {
      const existingScopes = new Set(existingItems.map((item) => item.scope ?? "room"));
      if (existingScopes.size === 1) {
        return Array.from(existingScopes)[0] as WorkScope;
      }
    }

    return "room";
  };

  const quickAddKey = (sectionId: string, scope: WorkScope): string => `${scope}:${sectionId}`;

  const getQuickAddDraft = (sectionId: string, scope: WorkScope): QuickAddDraft =>
    quickAddBySectionScope[quickAddKey(sectionId, scope)] ?? defaultQuickAddDraft();

  const updateQuickAddDraft = (sectionId: string, scope: WorkScope, patch: Partial<QuickAddDraft>) => {
    const key = quickAddKey(sectionId, scope);
    setQuickAddBySectionScope((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? defaultQuickAddDraft()),
        ...patch
      }
    }));
  };

  const addQuickWorkItem = (sectionId: string, scope: WorkScope) => {
    const key = quickAddKey(sectionId, scope);
    const draft = quickAddBySectionScope[key] ?? defaultQuickAddDraft();
    const name = draft.name.trim();
    if (!name) return;

    const item: WorkItem = {
      id: `work-${Date.now()}`,
      name,
      unitType: draft.unitType,
      defaultRateKey: "custom",
      quantitySource: draft.quantitySource,
      allowManualQty: true,
      category: draft.category,
      moduleId: sectionId,
      scope,
      customRate: draft.rate
    };

    persist({ ...project, workItems: [...project.workItems, item] }, "changes to work items");
    setQuickAddBySectionScope((prev) => ({
      ...prev,
      [key]: defaultQuickAddDraft()
    }));
  };

  const toggleModuleHiddenForRoom = (roomId: string, moduleId: string) => {
    setHiddenModulesByRoom((prev) => {
      const current = new Set(prev[roomId] ?? []);
      if (current.has(moduleId)) current.delete(moduleId);
      else current.add(moduleId);
      return { ...prev, [roomId]: Array.from(current) };
    });
  };

  const collapseAllModules = () => {
    const next: Record<string, boolean> = {};
    for (const m of sectionsSorted) next[m.id] = true;
    setCollapsedModules(next);
  };

  const expandAllModules = () => {
    const next: Record<string, boolean> = {};
    for (const m of sectionsSorted) next[m.id] = false;
    setCollapsedModules(next);
  };

  const hideAllModulesForRoom = (roomId: string) => {
    setHiddenModulesByRoom((prev) => ({ ...prev, [roomId]: sectionsSortedForRooms.map((m) => m.id) }));
  };

  const showAllModulesForRoom = (roomId: string) => {
    setHiddenModulesByRoom((prev) => ({ ...prev, [roomId]: [] }));
  };

  const reassignWorkModule = (workId: string, moduleId: string) => {
    const scope = inferSectionScope(moduleId);
    const workItems = project.workItems.map((w) => (w.id === workId ? { ...w, moduleId, scope } : w));
    persist({ ...project, workItems }, "changes to work items");
  };

  const renameSection = (sectionId: string, name: string) => {
    const sections = project.sections.map((s) => (s.id === sectionId ? { ...s, name } : s));
    persist({ ...project, sections }, "changes to sections/search setup");
  };

  const addSection = () => {
    const name = newSectionName.trim();
    if (!name) return;
    const id = `section-${Date.now()}`;
    const maxOrder = project.sections.reduce((max, s) => Math.max(max, s.order), 0);
    const sections = [...project.sections, { id, name, order: maxOrder + 1 }];
    persist({ ...project, sections }, "changes to sections/search setup");
    setNewSectionName("");
    setSelectedModuleId(id);
  };

  const removeSection = (sectionId: string) => {
    if (sectionId === "miscellaneous") return;
    const sections = project.sections.filter((s) => s.id !== sectionId);
    const workItems = project.workItems.map((w) => (w.moduleId === sectionId ? { ...w, moduleId: "miscellaneous" } : w));
    const collapsed = { ...collapsedModules };
    delete collapsed[sectionId];
    const hidden: Record<string, string[]> = {};
    for (const roomId of Object.keys(hiddenModulesByRoom)) {
      hidden[roomId] = (hiddenModulesByRoom[roomId] ?? []).filter((id) => id !== sectionId);
    }
    setCollapsedModules(collapsed);
    setHiddenModulesByRoom(hidden);
    persist({ ...project, sections, workItems }, "changes to sections/search setup");
  };

  const addWorkItemFromSections = () => {
    const name = newItemName.trim();
    if (!name) return;
    const workId = `work-${Date.now()}`;
    const scope = inferSectionScope(newItemSectionId);
    const item: WorkItem = {
      id: workId,
      name,
      unitType: newItemUnit,
      defaultRateKey: "custom",
      quantitySource: newItemQtySource,
      allowManualQty: true,
      category: newItemCategory,
      moduleId: newItemSectionId,
      scope,
      customRate: newItemRate
    };
    persist({ ...project, workItems: [...project.workItems, item] }, "changes to work items");
    setNewItemName("");
    setNewItemUnit("each");
    setNewItemCategory("Other");
    setNewItemQtySource("manual");
    setNewItemRate(0);
  };

  const removeWorkItemFromProject = (workId: string) => {
    const workItems = project.workItems.filter((w) => w.id !== workId);
    const selections = project.selections.filter((s) => s.workItemId !== workId);
    persist({ ...project, workItems, selections }, "changes to work items");
  };

  const renameWorkItem = (workId: string, name: string) => {
    const workItems = project.workItems.map((w) => (w.id === workId ? { ...w, name } : w));
    persist({ ...project, workItems }, "changes to work items");
  };

  const createSnapshotNow = () => {
    const note = snapshotNote.trim() || "Manual snapshot";
    setSnapshots(saveSnapshot(project, note));
    setSnapshotNote("");
    pendingAutosaveLabelsRef.current = [];
    lastAutosaveMsRef.current = Date.now();
    setSavesMessage("Snapshot saved.");
  };

  const restoreSnapshot = (snapshot: ProjectSnapshot) => {
    const confirmed = window.confirm("Restore this snapshot? Current unsaved changes in this origin will be overwritten.");
    if (!confirmed) return;
    const next = normalizeProjectData(snapshot.data);
    persist(next, "changes from restored snapshot");
    setActiveRoomId(next.rooms[0]?.id ?? null);
    setScreen("dashboard");
    setSavesMessage(`Snapshot restored: ${new Date(snapshot.createdAt).toLocaleString()}`);
  };

  const updateExtension = (patch: Partial<ProjectData["extensionQuote"]>) => {
    persist({ ...project, extensionQuote: { ...project.extensionQuote, ...patch } }, "changes to extension module");
  };

  const saveCurrentExtensionAsTemplate = () => {
    const name = newExtensionTemplateName.trim() || `Extension Template ${project.extensionTemplates.length + 1}`;
    const templateId = `ext-template-${Date.now()}`;
    const extensionTemplates = [
      ...project.extensionTemplates,
      { id: templateId, name, quote: cloneExtensionQuote(project.extensionQuote) }
    ];
    persist({ ...project, extensionTemplates }, "changes to extension templates");
    setNewExtensionTemplateName("");
  };

  const applyExtensionTemplate = (templateId: string) => {
    const template = project.extensionTemplates.find((t) => t.id === templateId);
    if (!template) return;
    persist({ ...project, extensionQuote: cloneExtensionQuote(template.quote) }, "changes to extension module");
  };

  const deleteExtensionTemplate = (templateId: string) => {
    const extensionTemplates = project.extensionTemplates.filter((t) => t.id !== templateId);
    persist({ ...project, extensionTemplates }, "changes to extension templates");
  };

  const saveCurrentProjectAsTemplate = () => {
    const name = newProjectTemplateName.trim() || `Project Template ${projectTemplates.length + 1}`;
    const templateId = `proj-template-${Date.now()}`;
    const template: ProjectTemplate = {
      id: templateId,
      name,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      project: {
        ...project,
        extensionTemplates: project.extensionTemplates.map((t) => ({ ...t, quote: cloneExtensionQuote(t.quote) })),
        projectTemplates: [] // Don't nest templates
      }
    };
    const updated = saveProjectTemplate(template);
    setProjectTemplates(updated);
    setNewProjectTemplateName("");
  };

  const applyProjectTemplate = (template: ProjectTemplate) => {
    const appliedProject = {
      ...JSON.parse(JSON.stringify(template.project)),
      extensionTemplates: template.project.extensionTemplates.map((t: any) => ({
        ...t,
        quote: cloneExtensionQuote(t.quote)
      })),
      projectTemplates: projectTemplates.map((pt) => ({
        ...pt,
        project: { ...pt.project, projectTemplates: [] }
      }))
    };
    persist(normalizeProjectData(appliedProject), "changes from applied project template");
    setShowApplyTemplateDialog(false);
    setTemplateToApply(null);
    setActiveRoomId(appliedProject.rooms[0]?.id ?? null);
  };

  const deleteProjectTemplateLocal = (templateId: string) => {
    const updated = deleteProjectTemplate(templateId);
    setProjectTemplates(updated);
  };

  const updateProjectTemplateName = (templateId: string, newName: string) => {
    const updated = projectTemplates.map((t) =>
      t.id === templateId
        ? { ...t, name: newName, lastModifiedAt: new Date().toISOString() }
        : t
    );
    const toSave = updated.find((t) => t.id === templateId);
    if (toSave) saveProjectTemplate(toSave);
    setProjectTemplates(updated);
  };

  const reorderSections = (dragId: string, targetId: string) => {
    if (dragId === targetId) return;
    const current = [...sectionsSorted];
    const dragIndex = current.findIndex((s) => s.id === dragId);
    const targetIndex = current.findIndex((s) => s.id === targetId);
    if (dragIndex < 0 || targetIndex < 0) return;

    const [moved] = current.splice(dragIndex, 1);
    current.splice(targetIndex, 0, moved);
    const reordered = current.map((s, idx) => ({ ...s, order: idx + 1 }));
    persist({ ...project, sections: reordered }, "changes to section order");
  };

  const onSectionDragStart = (sectionId: string) => {
    setDraggedSectionId(sectionId);
  };

  const onSectionDrop = (event: DragEvent<HTMLDivElement>, sectionId: string) => {
    event.preventDefault();
    if (!draggedSectionId) return;
    reorderSections(draggedSectionId, sectionId);
    setDraggedSectionId(null);
  };

  const resetSettings = () => {
    persist({
      ...project,
      settings: { ...defaultSettings, unitRatesGBP: { ...defaultSettings.unitRatesGBP } }
    }, "changes to rates/settings");
  };

  const handleExportJson = () => {
    downloadTextFile("daylog-project.json", serializeProject(project), "application/json");
    setSavesMessage("Project JSON exported.");
  };

  const handleExportCsv = () => {
    const roomMap = new Map(project.rooms.map((r) => [r.id, r.name]));
    roomMap.set(PROJECT_SCOPE_ROOM_ID, "Project-wide");
    const rows = lineItems.map((i) => ({ ...i, roomName: roomMap.get(i.roomId) ?? i.roomId }));
    const csv = lineItemsToCsv(rows);
    downloadTextFile("daylog-summary.csv", csv, "text/csv;charset=utf-8");
  };

  const handleImportJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const confirmed = window.confirm("Import project JSON and replace the current project?");
    if (!confirmed) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = deserializeProject(String(reader.result ?? ""));
        validateProjectImportShape(raw);
        const next = normalizeProjectData(raw);
        persist(next, "changes from import");
        setActiveRoomId(next.rooms[0]?.id ?? null);
        setScreen("dashboard");
        setSavesMessage("Project JSON imported.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import failed: invalid JSON file.";
        alert(message);
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const applyImportedUiPrefs = (prefs: UiPrefs) => {
    setCollapsedLevelGroups({ ...(prefs.collapsedLevelGroups as Record<Level, boolean>) });
    setDashboardPanelsCollapsed({ ...prefs.dashboardPanelsCollapsed });
    setRoomPanelsCollapsed({ ...prefs.roomPanelsCollapsed });
    setSectionsPanelsCollapsed({ ...prefs.sectionsPanelsCollapsed });
    setSavesPanelsCollapsed({ ...prefs.savesPanelsCollapsed });
    setExtensionPanelsCollapsed({ ...prefs.extensionPanelsCollapsed });
    setSummaryPanelsCollapsed({ ...prefs.summaryPanelsCollapsed });
  };

  const normalizeImportedBackup = (backup: FullBackup): FullBackup => {
    const snapshots = Array.isArray(backup.snapshots)
      ? backup.snapshots.map((snapshot) => ({
        ...snapshot,
        data: normalizeProjectData(snapshot.data)
      }))
      : [];
    const projectTemplates = Array.isArray(backup.projectTemplates)
      ? backup.projectTemplates.map((template) => ({
        ...template,
        project: normalizeProjectData(template.project)
      }))
      : [];
    const normalizedProject = normalizeProjectData(backup.project);
    const uiPrefs: UiPrefs = {
      collapsedLevelGroups: backup.uiPrefs?.collapsedLevelGroups ?? {},
      dashboardPanelsCollapsed: backup.uiPrefs?.dashboardPanelsCollapsed ?? {},
      roomPanelsCollapsed: backup.uiPrefs?.roomPanelsCollapsed ?? {},
      sectionsPanelsCollapsed: backup.uiPrefs?.sectionsPanelsCollapsed ?? {},
      savesPanelsCollapsed: backup.uiPrefs?.savesPanelsCollapsed ?? {},
      extensionPanelsCollapsed: backup.uiPrefs?.extensionPanelsCollapsed ?? {},
      summaryPanelsCollapsed: backup.uiPrefs?.summaryPanelsCollapsed ?? {}
    };
    return {
      version: 1,
      exportedAt: backup.exportedAt || new Date().toISOString(),
      project: normalizedProject,
      snapshots,
      projectTemplates,
      uiPrefs
    };
  };

  const handleExportFullBackup = () => {
    const backup = createFullBackup(project);
    downloadTextFile("daylog-project-full-backup.json", serializeFullBackup(backup), "application/json");
    const exportedAt = new Date().toISOString();
    setLastFullBackupExportedAt(exportedAt);
    saveBackupMeta({ lastFullBackupExportedAt: exportedAt });
    setSavesMessage("Full backup exported.");
    setBackupReminderVisible(false);
  };

  const handleImportFullBackup = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const confirmed = window.confirm("Import full backup and replace current project, snapshots, templates, and UI state?");
    if (!confirmed) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = deserializeFullBackup(String(reader.result ?? ""));
        validateFullBackupImportShape(raw);
        const backup = normalizeImportedBackup(raw);
        applyFullBackup(backup);
        setProject(backup.project);
        setSnapshots(backup.snapshots);
        setProjectTemplates(backup.projectTemplates);
        applyImportedUiPrefs(backup.uiPrefs);
        setActiveRoomId(backup.project.rooms[0]?.id ?? null);
        setScreen("dashboard");
        setSavesMessage("Full backup imported.");
        setBackupReminderVisible(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Full backup import failed: invalid JSON file.";
        alert(message);
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  };

  const addCustomWork = () => {
    if (!activeRoom || !customWorkName.trim()) return;

    const workId = `custom-${Date.now()}`;
    const scope = inferSectionScope(customWorkModuleId);
    const work: WorkItem = {
      id: workId,
      name: customWorkName.trim(),
      unitType: customWorkUnit,
      defaultRateKey: "custom",
      quantitySource: customWorkSource,
      allowManualQty: true,
      category: customWorkCategory,
      moduleId: customWorkModuleId,
      scope,
      customRate: customWorkRate
    };

    const workItems = [...project.workItems, work];
    let selections = [...project.selections];

    const targetRoomIds = applyCustomToAllRooms
      ? project.rooms.map((r) => r.id)
      : applyCustomToRoom
        ? [activeRoom.id]
        : [];

    for (const roomId of targetRoomIds) {
      selections.push({
        roomId,
        workItemId: workId,
        qtyOverride: customWorkSource === "manual" ? customWorkQty : undefined,
        rateOverride: customWorkRate,
        titleOverride: undefined,
        isSelected: true,
        isDone: false,
        notes: ""
      });
    }

    persist({ ...project, workItems, selections }, "changes to custom work");

    setCustomWorkName("");
    setCustomWorkSource("manual");
    setCustomWorkQty(0);
    setCustomWorkRate(0);
    setCustomWorkCategory("Other");
    setCustomWorkModuleId("miscellaneous");
    setApplyCustomToRoom(true);
    setApplyCustomToAllRooms(false);
    setShowCustomWorkForm(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>DayLog</h1>
        <nav className="tabs">
          <button className={screen === "dashboard" ? "active" : ""} onClick={() => setScreen("dashboard")}>Dashboard</button>
          <button className={screen === "extension" ? "active" : ""} onClick={() => setScreen("extension")}>Extension</button>
          <button className={screen === "sections" ? "active" : ""} onClick={() => setScreen("sections")}>Sections & Rates</button>
          <button className={screen === "saves" ? "active" : ""} onClick={() => setScreen("saves")}>Saves</button>
          <button className={screen === "summary" ? "active" : ""} onClick={() => setScreen("summary")}>Summary & Reports</button>
        </nav>
        <div className="topbar-total" aria-live="polite">
          <span><strong>Project total:</strong> £{combinedProjectTotal.toFixed(2)}</span>
          <span className="muted">Refurb: £{totals.grandTotal.toFixed(2)}</span>
          <span className="muted">Extension: £{extensionClientPrice.toFixed(2)}</span>
        </div>
        {(backupReminderVisible || isBackupStale) && (
          <div className="topbar-notice" role="status">
            <span>
              {backupReminderVisible
                ? "Major edits detected. Export a Full Backup soon."
                : `Full backup is stale (${backupAgeDays ?? "unknown"} day(s) old).`}
            </span>
            <button className="small" onClick={() => setScreen("saves")}>Open Saves</button>
            {backupReminderVisible && (
              <button className="small" onClick={() => setBackupReminderVisible(false)}>Dismiss</button>
            )}
          </div>
        )}
        <div className="topbar-actions">
          <button className="small" onClick={() => window.open("/README.md", "_blank", "noopener,noreferrer")}>Help (README)</button>
          <button className="small danger" onClick={clearStoredProject} title="Clear saved project data from localStorage and reload">Reset Stored Project</button>
        </div>
      </header>

      <main className="content">
        {screen === "dashboard" && (
          <section>
            <div className="panel">
              <div className="row spread">
                <h2>Project Details</h2>
                <button className="small" onClick={() => toggleCollapse("dashboard", "project-details")}>
                  {isCollapsed("dashboard", "project-details") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("dashboard", "project-details") && (
                <div className="grid two">
                  <label>
                    Client Name
                    <input
                      value={project.info.clientName}
                      onChange={(e) => persist({ ...project, info: { ...project.info, clientName: e.target.value } }, "changes to project details")}
                      placeholder="Client name"
                    />
                  </label>
                  <label>
                    Project Date
                    <input
                      type="date"
                      value={project.info.date}
                      onChange={(e) => persist({ ...project, info: { ...project.info, date: e.target.value } }, "changes to project details")}
                    />
                  </label>
                  <label className="full">
                    Address
                    <input
                      value={project.info.address}
                      onChange={(e) => persist({ ...project, info: { ...project.info, address: e.target.value } }, "changes to project details")}
                      placeholder="Project address"
                    />
                  </label>
                  <label className="full">
                    Project Description
                    <textarea
                      value={project.info.description}
                      onChange={(e) => persist({ ...project, info: { ...project.info, description: e.target.value } }, "changes to project details")}
                      placeholder="Scope / notes"
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="panel add-room">
              <div className="row spread">
                <h2>Add Room</h2>
                <button className="small" onClick={() => toggleCollapse("dashboard", "add-room")}>
                  {isCollapsed("dashboard", "add-room") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("dashboard", "add-room") && (
                <>
                  <div className="grid two">
                    <label>
                      Preset
                      <select value={newRoomPreset} onChange={(e) => setNewRoomPreset(e.target.value as RoomPresetType)}>
                        <option>Bedroom</option>
                        <option>Hall/Corridor</option>
                        <option>Landing</option>
                        <option>Reception</option>
                        <option>Custom</option>
                      </select>
                    </label>
                    <label>
                      Level
                      <select value={newRoomLevel} onChange={(e) => setNewRoomLevel(e.target.value as Level)}>
                        {levels.map((level) => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </label>
                    <label className="full">
                      Name (optional)
                      <input value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g. Bed 4" />
                    </label>
                  </div>
                  <button onClick={addRoom}>Add Room</button>
                </>
              )}
            </div>
            <div className="panel">
              <div className="row spread">
                <h2>Project-wide Works</h2>
                <button className="small" onClick={() => toggleCollapse("dashboard", "project-wide-works")}>
                  {isCollapsed("dashboard", "project-wide-works") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("dashboard", "project-wide-works") && (
                <>
                  <p className="muted">These items are priced once for the whole project, not per room.</p>
                  {sectionsSorted.map((module) => {
                const items = projectScopeWorkItems.filter((w) =>
                  module.id === "miscellaneous" ? !w.moduleId || w.moduleId === "miscellaneous" : w.moduleId === module.id
                );
                if (!items.length) return null;

                const isCollapsed = collapsedModules[module.id] ?? false;
                const selectedItems = items.filter((w) =>
                  project.selections.some((s) => s.roomId === PROJECT_SCOPE_ROOM_ID && s.workItemId === w.id && s.isSelected)
                );
                const moduleAllDone = selectedItems.length > 0 && selectedItems.every((w) =>
                  project.selections.some((s) => s.roomId === PROJECT_SCOPE_ROOM_ID && s.workItemId === w.id && s.isSelected && s.isDone)
                );
                const projectComputed = computeRoom(projectScopeRoom, project.settings);
                const moduleTotal = items.reduce((sum, work) => {
                  const selection = project.selections.find((s) => s.roomId === PROJECT_SCOPE_ROOM_ID && s.workItemId === work.id);
                  if (!(selection?.isSelected ?? false)) return sum;
                  const qty = getQtyForWork(projectScopeRoom, work, projectComputed, selection);
                  const rate = getRateForWork(work, project.settings, selection);
                  return sum + qty * rate;
                }, 0);

                return (
                  <div key={module.id} className="category-block">
                    <div
                      className="module-header"
                      onClick={() => toggleModuleCollapsed(module.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleModuleCollapsed(module.id);
                        }
                      }}
                    >
                      <h4>{module.name}</h4>
                      <div className="row wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="check small-check">
                          <input
                            type="checkbox"
                            checked={moduleAllDone}
                            onChange={(e) => bulkSetProjectModuleDone(items.map((w) => w.id), e.target.checked)}
                          />
                          Done
                        </label>
                        <span className="module-sum">£{moduleTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    {!isCollapsed && items.map((work) => {
                      const selection = project.selections.find((s) => s.roomId === PROJECT_SCOPE_ROOM_ID && s.workItemId === work.id);
                      const qty = getQtyForWork(projectScopeRoom, work, projectComputed, selection);
                      const rate = getRateForWork(work, project.settings, selection);
                      const lineTotal = qty * rate;
                      const lineName = selection?.titleOverride?.trim() || work.name;
                      const rowCollapsed = isWorkRowCollapsed(PROJECT_SCOPE_ROOM_ID, work.id);

                      return (
                        <div key={work.id} className="work-row">
                          <div className="work-checks">
                            <button
                              type="button"
                              className="work-name-button"
                              aria-expanded={!rowCollapsed}
                              onClick={() => toggleWorkRowCollapsed(PROJECT_SCOPE_ROOM_ID, work.id)}
                            >
                              {rowCollapsed ? "[+] " : "[-] "}
                              {lineName}
                            </button>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={selection?.isSelected ?? false}
                                onChange={(e) => upsertProjectSelection(work.id, { isSelected: e.target.checked })}
                              />
                              Include
                            </label>

                            <label className="check">
                              <input
                                type="checkbox"
                                checked={selection?.isDone ?? false}
                                onChange={(e) =>
                                  upsertProjectSelection(work.id, {
                                    isDone: e.target.checked,
                                    isSelected: selection?.isSelected ?? true
                                  })
                                }
                                disabled={!(selection?.isSelected ?? false)}
                              />
                              Done
                            </label>
                          </div>

                          {!rowCollapsed && (
                            <>
                              <label>
                                Work title override
                                <input
                                  value={selection?.titleOverride ?? ""}
                                  onChange={(e) =>
                                    upsertProjectSelection(work.id, {
                                      isSelected: selection?.isSelected ?? true,
                                      titleOverride: e.target.value
                                    })
                                  }
                                  placeholder={work.name}
                                />
                              </label>

                              <div className="inline-fields">
                                <label>
                                  Qty ({work.quantitySource === "manual" ? "manual" : work.quantitySource})
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={selection?.qtyOverride ?? qty}
                                    disabled={!work.allowManualQty || !(selection?.isSelected ?? false)}
                                    onChange={(e) =>
                                      upsertProjectSelection(work.id, {
                                        isSelected: selection?.isSelected ?? true,
                                        qtyOverride: Number(e.target.value)
                                      })
                                    }
                                  />
                                </label>
                                {work.allowManualQty && (
                                  <button
                                    className="small"
                                    disabled={!(selection?.isSelected ?? false)}
                                    onClick={() =>
                                      upsertProjectSelection(work.id, {
                                        isSelected: selection?.isSelected ?? true,
                                        qtyOverride: undefined
                                      })
                                    }
                                  >
                                    Auto
                                  </button>
                                )}
                                <label>
                                  Rate £
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={selection?.rateOverride ?? rate}
                                    disabled={!(selection?.isSelected ?? false)}
                                    onChange={(e) =>
                                      upsertProjectSelection(work.id, {
                                        isSelected: selection?.isSelected ?? true,
                                        rateOverride: Number(e.target.value)
                                      })
                                    }
                                  />
                                </label>
                                <button
                                  className="small"
                                  disabled={!(selection?.isSelected ?? false)}
                                  onClick={() =>
                                    upsertProjectSelection(work.id, {
                                      isSelected: selection?.isSelected ?? true,
                                      rateOverride: undefined
                                    })
                                  }
                                >
                                  Default
                                </button>
                                <span className="line-total">£{lineTotal.toFixed(2)}</span>
                              </div>

                              <label>
                                Notes
                                <input
                                  value={selection?.notes ?? ""}
                                  onChange={(e) =>
                                    upsertProjectSelection(work.id, {
                                      isSelected: selection?.isSelected ?? true,
                                      notes: e.target.value
                                    })
                                  }
                                  placeholder="Optional"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {!isCollapsed && (
                      <div className="work-row work-row-add">
                        <div className="quick-add-grid">
                          <input
                            placeholder={`Add line to ${module.name}`}
                            value={getQuickAddDraft(module.id, "project").name}
                            onChange={(e) => updateQuickAddDraft(module.id, "project", { name: e.target.value })}
                          />
                          <select
                            value={getQuickAddDraft(module.id, "project").unitType}
                            onChange={(e) => updateQuickAddDraft(module.id, "project", { unitType: e.target.value as UnitType })}
                          >
                            <option value="fixed">fixed</option>
                            <option value="each">each</option>
                            <option value="m2">m2</option>
                            <option value="lm">lm</option>
                          </select>
                          <select
                            value={getQuickAddDraft(module.id, "project").quantitySource}
                            onChange={(e) => updateQuickAddDraft(module.id, "project", { quantitySource: e.target.value as QuantitySource })}
                          >
                            <option value="manual">Manual</option>
                            <option value="floorArea">Floor area m2</option>
                            <option value="ceilingArea">Ceiling area m2</option>
                            <option value="wallArea">Wall area m2</option>
                            <option value="skirtingLM">Skirting LM</option>
                            <option value="architraveLM">Architrave LM</option>
                            <option value="doorCount">Door count</option>
                          </select>
                          <select
                            value={getQuickAddDraft(module.id, "project").category}
                            onChange={(e) => updateQuickAddDraft(module.id, "project", { category: e.target.value as WorkCategory })}
                          >
                            {categoryOrder.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Rate £"
                            value={getQuickAddDraft(module.id, "project").rate}
                            onChange={(e) => updateQuickAddDraft(module.id, "project", { rate: Number(e.target.value) || 0 })}
                          />
                          <button className="small" onClick={() => addQuickWorkItem(module.id, "project")}>Add line</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
                  })}
                  {projectScopeWorkItems.length === 0 && <p className="muted">No project-wide works defined.</p>}
                </>
              )}
            </div>
            <div className="row wrap">
              <button className="small" onClick={() => setAllLevelsCollapsed(true)}>Collapse All Levels</button>
              <button className="small" onClick={() => setAllLevelsCollapsed(false)}>Expand All Levels</button>
            </div>

            {levels.map((level) => {
              const rooms = project.rooms.filter((r) => r.level === level);
              if (!rooms.length) return null;
              const levelSubtotal = rooms.reduce((sum, room) => {
                const rt = roomTotals(room.id, lineItems, project.settings.dayRateGBP);
                return sum + rt.total;
              }, 0);

              return (
                <div key={level} className="level-group">
                  <div className="row spread">
                    <h2>{level}</h2>
                    <div className="row">
                      <span className="muted">{rooms.length} room(s) | £{levelSubtotal.toFixed(2)}</span>
                      <button className="small" onClick={() => toggleCollapse("level", level)}>
                        {isCollapsed("level", level) ? "Expand" : "Collapse"}
                      </button>
                    </div>
                  </div>
                  {!isCollapsed("level", level) && <div className="cards">
                    {rooms.map((room) => {
                      const computed = computeRoom(room, project.settings);
                      const rt = roomTotals(room.id, lineItems, project.settings.dayRateGBP);
                      return (
                        <article key={room.id} className="panel room-card">
                          <div className="row spread">
                            <h3>{room.name}</h3>
                            <label className="inline-toggle">
                              <input
                                type="checkbox"
                                checked={room.excludeFromTotals}
                                onChange={(e) => updateRoom(room.id, { excludeFromTotals: e.target.checked })}
                              />
                              Exclude
                            </label>
                          </div>
                          <p className="muted">Floor {computed.floorAreaM2} m2 | Walls {computed.wallAreaM2} m2 | Ceiling {computed.ceilingAreaM2} m2</p>
                          <p className="muted">Works {rt.doneCount}/{rt.selectedCount} done</p>
                          <p><strong>Labour £{rt.total.toFixed(2)}</strong> | {rt.manDays.toFixed(2)} man-days</p>
                          <button
                            onClick={() => {
                              setActiveRoomId(room.id);
                              setScreen("room");
                            }}
                          >
                            Open Room
                          </button>
                          <button className="small" onClick={() => removeRoom(room.id)}>
                            Remove Room
                          </button>
                        </article>
                      );
                    })}
                  </div>}
                </div>
              );
            })}
          </section>
        )}

        {screen === "room" && activeRoom && (
          <section>
            <div className="panel">
              <div className="row spread">
                <h2>{activeRoom.name}</h2>
                <div className="row">
                  <button className="small" onClick={() => removeRoom(activeRoom.id)}>Remove Room</button>
                  <button onClick={() => setScreen("dashboard")}>Back</button>
                </div>
              </div>
              <div className="grid two">
                <label>
                  Room Name
                  <input value={activeRoom.name} onChange={(e) => updateRoom(activeRoom.id, { name: e.target.value })} />
                </label>
                <label>
                  Level
                  <select value={activeRoom.level} onChange={(e) => updateRoom(activeRoom.id, { level: e.target.value as Level })}>
                    {levels.map((level) => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Length (m)
                  <input
                    type="number"
                    step="0.01"
                    value={activeRoom.lengthM ?? ""}
                    onChange={(e) => updateRoom(activeRoom.id, { lengthM: toNumber(e.target.value) })}
                  />
                </label>
                <label>
                  Width (m)
                  <input
                    type="number"
                    step="0.01"
                    value={activeRoom.widthM ?? ""}
                    onChange={(e) => updateRoom(activeRoom.id, { widthM: toNumber(e.target.value) })}
                  />
                </label>
                <label>
                  Door Count
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={activeRoom.doorCount}
                    onChange={(e) => updateRoom(activeRoom.id, { doorCount: parseIntSafe(e.target.value) })}
                  />
                </label>
                <label>
                  Exclude from totals
                  <input
                    type="checkbox"
                    checked={activeRoom.excludeFromTotals}
                    onChange={(e) => updateRoom(activeRoom.id, { excludeFromTotals: e.target.checked })}
                  />
                </label>
              </div>

              <div className="row spread">
                <h3>Computed Areas (Editable Overrides)</h3>
                <button className="small" onClick={() => toggleCollapse("room", "computed-areas")}>
                  {isCollapsed("room", "computed-areas") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("room", "computed-areas") && (() => {
                const computed = computeRoom(activeRoom, project.settings);
                return (
                  <div className="grid two">
                    <label>
                      Floor area m2 (auto {computed.floorAreaM2})
                      <input
                        type="number"
                        step="0.01"
                        value={activeRoom.manualFloorAreaM2 ?? ""}
                        placeholder="Auto"
                        onChange={(e) => updateRoom(activeRoom.id, { manualFloorAreaM2: toNumber(e.target.value) })}
                      />
                    </label>
                    <label>
                      Ceiling area m2 (auto {computed.ceilingAreaM2})
                      <input
                        type="number"
                        step="0.01"
                        value={activeRoom.manualCeilingAreaM2 ?? ""}
                        placeholder="Auto"
                        onChange={(e) => updateRoom(activeRoom.id, { manualCeilingAreaM2: toNumber(e.target.value) })}
                      />
                    </label>
                    <label>
                      Wall area m2 (auto {computed.wallAreaM2})
                      <input
                        type="number"
                        step="0.01"
                        value={activeRoom.manualWallAreaM2 ?? ""}
                        placeholder="Auto"
                        onChange={(e) => updateRoom(activeRoom.id, { manualWallAreaM2: toNumber(e.target.value) })}
                      />
                    </label>
                    <label>
                      Skirting LM (auto {computed.skirtingLM})
                      <input
                        type="number"
                        step="0.01"
                        value={activeRoom.manualSkirtingLM ?? ""}
                        placeholder="Auto"
                        onChange={(e) => updateRoom(activeRoom.id, { manualSkirtingLM: toNumber(e.target.value) })}
                      />
                    </label>
                    <label className="full">
                      Architrave LM (auto {computed.architraveLM})
                      <input
                        type="number"
                        step="0.01"
                        value={activeRoom.manualArchitraveLM ?? ""}
                        placeholder="Auto"
                        onChange={(e) => updateRoom(activeRoom.id, { manualArchitraveLM: toNumber(e.target.value) })}
                      />
                    </label>
                  </div>
                );
              })()}
            </div>

            <div className="panel">
              <div className="row spread">
                <h3>Work Checklist</h3>
                <div className="row">
                  <button className="small" onClick={() => toggleCollapse("room", "work-checklist")}>
                    {isCollapsed("room", "work-checklist") ? "Expand" : "Collapse"}
                  </button>
                </div>
              </div>
              {!isCollapsed("room", "work-checklist") && (
                <>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <button className="small" onClick={() => bulkSetRoomSelection(activeRoom.id, true)}>Include All</button>
                    <button className="small" onClick={() => bulkSetRoomSelection(activeRoom.id, false)}>Exclude All</button>
                    <button onClick={() => setShowCustomWorkForm((s) => !s)}>Add Custom Work</button>
                  </div>
              <div className="subpanel">
                <h4>Add Module</h4>
                <div className="row wrap">
                  <select value={effectiveSelectedSectionId} onChange={(e) => setSelectedModuleId(e.target.value)}>
                    {sectionsSortedForRooms.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.name}
                      </option>
                    ))}
                  </select>
                  <button className="small" onClick={() => addModuleToRooms(effectiveSelectedSectionId, [activeRoom.id])}>
                    Add Module to This Room
                  </button>
                  <button className="small" onClick={() => addModuleToRooms(effectiveSelectedSectionId, project.rooms.map((r) => r.id))}>
                    Add Module to All Rooms
                  </button>
                  <button className="small" onClick={() => removeModuleFromRooms(effectiveSelectedSectionId, [activeRoom.id])}>
                    Remove Module From This Room
                  </button>
                  <button className="small" onClick={() => removeModuleFromRooms(effectiveSelectedSectionId, project.rooms.map((r) => r.id))}>
                    Remove Module From Project
                  </button>
                  <button className="small" onClick={collapseAllModules}>Collapse All</button>
                  <button className="small" onClick={expandAllModules}>Expand All</button>
                  <button className="small" onClick={() => hideAllModulesForRoom(activeRoom.id)}>Hide All</button>
                  <button className="small" onClick={() => showAllModulesForRoom(activeRoom.id)}>Show All</button>
                </div>
                {(hiddenModulesByRoom[activeRoom.id]?.length ?? 0) > 0 && (
                  <div className="row wrap">
                    <span className="muted">Hidden in this room:</span>
                    {hiddenModulesByRoom[activeRoom.id].map((moduleId) => {
                      const module = sectionsSorted.find((m) => m.id === moduleId);
                      if (!module) return null;
                      return (
                        <button
                          key={moduleId}
                          className="small"
                          onClick={() => toggleModuleHiddenForRoom(activeRoom.id, moduleId)}
                        >
                          Show {module.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {showCustomWorkForm && (
                <div className="subpanel">
                  <div className="grid two">
                    <label>
                      Name
                      <input value={customWorkName} onChange={(e) => setCustomWorkName(e.target.value)} />
                    </label>
                    <label>
                      Module
                      <select value={customWorkModuleId} onChange={(e) => setCustomWorkModuleId(e.target.value)}>
                        {sectionsSortedForRooms.map((module) => (
                          <option key={module.id} value={module.id}>{module.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Category
                      <select value={customWorkCategory} onChange={(e) => setCustomWorkCategory(e.target.value as WorkCategory)}>
                        {categoryOrder.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Unit
                      <select value={customWorkUnit} onChange={(e) => setCustomWorkUnit(e.target.value as UnitType)}>
                        <option value="m2">m2</option>
                        <option value="lm">lm</option>
                        <option value="each">each</option>
                        <option value="fixed">fixed</option>
                      </select>
                    </label>
                    <label>
                      Quantity source
                      <select value={customWorkSource} onChange={(e) => setCustomWorkSource(e.target.value as QuantitySource)}>
                        <option value="manual">Manual</option>
                        <option value="floorArea">Floor area m2</option>
                        <option value="ceilingArea">Ceiling area m2</option>
                        <option value="wallArea">Wall area m2</option>
                        <option value="skirtingLM">Skirting LM</option>
                        <option value="architraveLM">Architrave LM</option>
                        <option value="doorCount">Door count</option>
                      </select>
                    </label>
                    <label>
                      Manual qty
                      <input
                        type="number"
                        step="0.01"
                        value={customWorkQty}
                        disabled={customWorkSource !== "manual"}
                        onChange={(e) => setCustomWorkQty(Number(e.target.value) || 0)}
                      />
                    </label>
                    <label>
                      Rate (£)
                      <input type="number" step="0.01" value={customWorkRate} onChange={(e) => setCustomWorkRate(Number(e.target.value) || 0)} />
                    </label>
                    <label>
                      <input type="checkbox" checked={applyCustomToRoom} onChange={(e) => setApplyCustomToRoom(e.target.checked)} /> Apply to this room now
                    </label>
                    <label>
                      <input type="checkbox" checked={applyCustomToAllRooms} onChange={(e) => setApplyCustomToAllRooms(e.target.checked)} /> Apply to all rooms now
                    </label>
                  </div>
                  <button onClick={addCustomWork}>Save Custom Work</button>
                </div>
              )}

              {sectionsSortedForRooms.map((module) => {
                const items = roomScopeWorkItems.filter((w) =>
                  module.id === "miscellaneous" ? !w.moduleId || w.moduleId === "miscellaneous" : w.moduleId === module.id
                );
                if (!items.length) return null;

                const hasSelectedInRoom = project.selections.some(
                  (s) => s.roomId === activeRoom.id && s.isSelected && items.some((w) => w.id === s.workItemId)
                );
                const hiddenForRoom = hiddenModulesByRoom[activeRoom.id]?.includes(module.id) ?? false;
                if (!defaultVisibleSectionIds.has(module.id) && !hasSelectedInRoom && !hiddenForRoom) return null;
                if (hiddenForRoom) return null;

                const isCollapsed = collapsedModules[module.id] ?? true;
                const itemIds = items.map((w) => w.id);
                const selectedItems = items.filter((w) =>
                  project.selections.some((s) => s.roomId === activeRoom.id && s.workItemId === w.id && s.isSelected)
                );
                const moduleAllDone = selectedItems.length > 0 && selectedItems.every((w) =>
                  project.selections.some((s) => s.roomId === activeRoom.id && s.workItemId === w.id && s.isSelected && s.isDone)
                );
                const computed = computeRoom(activeRoom, project.settings);
                const moduleTotal = items.reduce((sum, work) => {
                  const selection = project.selections.find((s) => s.roomId === activeRoom.id && s.workItemId === work.id);
                  if (!(selection?.isSelected ?? false)) return sum;
                  const qty = getQtyForWork(activeRoom, work, computed, selection);
                  const rate = getRateForWork(work, project.settings, selection);
                  return sum + qty * rate;
                }, 0);

                return (
                  <div key={module.id} className="category-block">
                    <div
                      className="module-header"
                      onClick={() => toggleModuleCollapsed(module.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleModuleCollapsed(module.id);
                        }
                      }}
                    >
                      <h4>{module.name}</h4>
                      <div className="row wrap" onClick={(e) => e.stopPropagation()}>
                        <label className="check small-check">
                          <input
                            type="checkbox"
                            checked={moduleAllDone}
                            onChange={(e) => bulkSetModuleDone(activeRoom.id, itemIds, e.target.checked)}
                          />
                          Done
                        </label>
                        <label className="check small-check">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => toggleModuleHiddenForRoom(activeRoom.id, module.id)}
                          />
                          Hide
                        </label>
                        <span className="module-sum">£{moduleTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    {!isCollapsed && items.map((work) => {
                      const selection = project.selections.find((s) => s.roomId === activeRoom.id && s.workItemId === work.id);
                      const qty = getQtyForWork(activeRoom, work, computed, selection);
                      const rate = getRateForWork(work, project.settings, selection);
                      const lineTotal = qty * rate;
                      const lineName = selection?.titleOverride?.trim() || work.name;
                      const rowCollapsed = isWorkRowCollapsed(activeRoom.id, work.id);

                      return (
                        <div key={work.id} className="work-row">
                          <div className="work-checks">
                            <button
                              type="button"
                              className="work-name-button"
                              aria-expanded={!rowCollapsed}
                              onClick={() => toggleWorkRowCollapsed(activeRoom.id, work.id)}
                            >
                              {rowCollapsed ? "[+] " : "[-] "}
                              {lineName}
                            </button>
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={selection?.isSelected ?? false}
                                onChange={(e) => upsertSelection(activeRoom.id, work.id, { isSelected: e.target.checked })}
                              />
                              Include
                            </label>

                            <label className="check">
                              <input
                                type="checkbox"
                                checked={selection?.isDone ?? false}
                                onChange={(e) =>
                                  upsertSelection(activeRoom.id, work.id, {
                                    isDone: e.target.checked,
                                    isSelected: selection?.isSelected ?? true
                                  })
                                }
                                disabled={!(selection?.isSelected ?? false)}
                              />
                              Done
                            </label>
                          </div>

                          {!rowCollapsed && (
                            <>
                              <label>
                                Work title override
                                <input
                                  value={selection?.titleOverride ?? ""}
                                  onChange={(e) =>
                                    upsertSelection(activeRoom.id, work.id, {
                                      isSelected: selection?.isSelected ?? true,
                                      titleOverride: e.target.value
                                    })
                                  }
                                  placeholder={work.name}
                                />
                              </label>

                              <div className="inline-fields">
                                <label>
                                  Qty ({work.quantitySource === "manual" ? "manual" : work.quantitySource})
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={selection?.qtyOverride ?? qty}
                                    disabled={!work.allowManualQty || !(selection?.isSelected ?? false)}
                                    onChange={(e) =>
                                      upsertSelection(activeRoom.id, work.id, {
                                        isSelected: selection?.isSelected ?? true,
                                        qtyOverride: Number(e.target.value)
                                      })
                                    }
                                  />
                                </label>
                                {work.allowManualQty && (
                                  <button
                                    className="small"
                                    disabled={!(selection?.isSelected ?? false)}
                                    onClick={() =>
                                      upsertSelection(activeRoom.id, work.id, {
                                        isSelected: selection?.isSelected ?? true,
                                        qtyOverride: undefined
                                      })
                                    }
                                  >
                                    Auto
                                  </button>
                                )}
                                <label>
                                  Rate £
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={selection?.rateOverride ?? rate}
                                    disabled={!(selection?.isSelected ?? false)}
                                    onChange={(e) =>
                                      upsertSelection(activeRoom.id, work.id, {
                                        isSelected: selection?.isSelected ?? true,
                                        rateOverride: Number(e.target.value)
                                      })
                                    }
                                  />
                                </label>
                                <button
                                  className="small"
                                  disabled={!(selection?.isSelected ?? false)}
                                  onClick={() =>
                                    upsertSelection(activeRoom.id, work.id, {
                                      isSelected: selection?.isSelected ?? true,
                                      rateOverride: undefined
                                    })
                                  }
                                >
                                  Default
                                </button>
                                <span className="line-total">£{lineTotal.toFixed(2)}</span>
                              </div>

                              <label>
                                Notes
                                <input
                                  value={selection?.notes ?? ""}
                                  onChange={(e) =>
                                    upsertSelection(activeRoom.id, work.id, {
                                      isSelected: selection?.isSelected ?? true,
                                      notes: e.target.value
                                    })
                                  }
                                  placeholder="Optional"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {!isCollapsed && (
                      <div className="work-row work-row-add">
                        <div className="quick-add-grid">
                          <input
                            placeholder={`Add line to ${module.name}`}
                            value={getQuickAddDraft(module.id, "room").name}
                            onChange={(e) => updateQuickAddDraft(module.id, "room", { name: e.target.value })}
                          />
                          <select
                            value={getQuickAddDraft(module.id, "room").unitType}
                            onChange={(e) => updateQuickAddDraft(module.id, "room", { unitType: e.target.value as UnitType })}
                          >
                            <option value="fixed">fixed</option>
                            <option value="each">each</option>
                            <option value="m2">m2</option>
                            <option value="lm">lm</option>
                          </select>
                          <select
                            value={getQuickAddDraft(module.id, "room").quantitySource}
                            onChange={(e) => updateQuickAddDraft(module.id, "room", { quantitySource: e.target.value as QuantitySource })}
                          >
                            <option value="manual">Manual</option>
                            <option value="floorArea">Floor area m2</option>
                            <option value="ceilingArea">Ceiling area m2</option>
                            <option value="wallArea">Wall area m2</option>
                            <option value="skirtingLM">Skirting LM</option>
                            <option value="architraveLM">Architrave LM</option>
                            <option value="doorCount">Door count</option>
                          </select>
                          <select
                            value={getQuickAddDraft(module.id, "room").category}
                            onChange={(e) => updateQuickAddDraft(module.id, "room", { category: e.target.value as WorkCategory })}
                          >
                            {categoryOrder.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Rate £"
                            value={getQuickAddDraft(module.id, "room").rate}
                            onChange={(e) => updateQuickAddDraft(module.id, "room", { rate: Number(e.target.value) || 0 })}
                          />
                          <button className="small" onClick={() => addQuickWorkItem(module.id, "room")}>Add line</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {(() => {
                const activeRoomLines = lineItems.filter((i) => i.roomId === activeRoom.id);
                const activeRoomTotals = roomTotals(activeRoom.id, activeRoomLines, project.settings.dayRateGBP);
                return (
                  <div className="subpanel room-checklist-summary">
                    <h4>Room Summary</h4>
                    <p><strong>Total for {activeRoom.name}: £{activeRoomTotals.total.toFixed(2)}</strong></p>
                    <p>Equivalent man-days: {activeRoomTotals.manDays.toFixed(2)}</p>
                    {activeRoom.excludeFromTotals && <p className="muted">This room is currently excluded from project totals.</p>}
                  </div>
                );
              })()}
                </>
              )}
            </div>
          </section>
        )}

        {screen === "extension" && (
          <section>
            <div className="panel">
              <div className="row spread">
                <h3>Extension Templates</h3>
                <button className="small" onClick={() => toggleCollapse("extension", "extension-templates")}>
                  {isCollapsed("extension", "extension-templates") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("extension", "extension-templates") && (
                <>
                  <div className="row wrap">
                <input
                  value={newExtensionTemplateName}
                  onChange={(e) => setNewExtensionTemplateName(e.target.value)}
                  placeholder="Template name (e.g. 28DR rear extension)"
                />
                <button onClick={saveCurrentExtensionAsTemplate}>Save current as template</button>
              </div>
                  {extensionTemplatesSorted.length === 0 ? (
                    <p className="muted">No templates saved yet.</p>
                  ) : (
                    <div className="sections-list">
                      {extensionTemplatesSorted.map((template) => (
                        <div key={template.id} className="sections-list-row">
                          <span>{template.name}</span>
                          <div className="row">
                            <button className="small" onClick={() => applyExtensionTemplate(template.id)}>Apply</button>
                            <button className="small danger" onClick={() => deleteExtensionTemplate(template.id)}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h2>Extension Quoting</h2>
                <button className="small" onClick={() => toggleCollapse("extension", "extension-quoting")}>
                  {isCollapsed("extension", "extension-quoting") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("extension", "extension-quoting") && (
                <>
              <div className="grid two">
                <label>
                  Wall height (m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.wallHeightM}
                    onChange={(e) => updateExtension({ wallHeightM: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Wall construction type
                  <select
                    value={project.extensionQuote.wallType}
                    onChange={(e) => updateExtension({ wallType: e.target.value as ProjectData["extensionQuote"]["wallType"] })}
                  >
                    <option value="block_brick_cavity">Block + brick cavity</option>
                    <option value="block_render">Block + render</option>
                    <option value="double_brick_cavity">Double brick cavity</option>
                    <option value="timber_frame">Timber frame</option>
                  </select>
                </label>
                <label>
                  Floor length (m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.floorLengthM}
                    onChange={(e) => updateExtension({ floorLengthM: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Floor width (m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.floorWidthM}
                    onChange={(e) => updateExtension({ floorWidthM: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Opening to house (m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.openingToHouseM}
                    onChange={(e) => updateExtension({ openingToHouseM: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Opening to garden (m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.openingToGardenM}
                    onChange={(e) => updateExtension({ openingToGardenM: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Floor area override (m2)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.floorAreaOverrideM2 ?? ""}
                    placeholder="Auto from floor length × floor width"
                    onChange={(e) => updateExtension({ floorAreaOverrideM2: toNumber(e.target.value) })}
                  />
                </label>
              </div>
              <h4>Constructed wall runs (m)</h4>
              {project.extensionQuote.wallRunsM.map((run, idx) => (
                <div key={`run-${idx}`} className="row wrap">
                  <label>
                    Wall run {idx + 1} (m)
                    <input
                      type="number"
                      step="0.01"
                      value={run}
                      onChange={(e) => {
                        const wallRunsM = [...project.extensionQuote.wallRunsM];
                        wallRunsM[idx] = Number(e.target.value) || 0;
                        updateExtension({ wallRunsM });
                      }}
                    />
                  </label>
                  <button
                    className="small"
                    disabled={project.extensionQuote.wallRunsM.length <= 1}
                    onClick={() => {
                      const wallRunsM = project.extensionQuote.wallRunsM.filter((_, i) => i !== idx);
                      updateExtension({ wallRunsM });
                    }}
                  >
                    Remove wall run
                  </button>
                </div>
              ))}
              <button
                className="small"
                onClick={() => updateExtension({ wallRunsM: [...project.extensionQuote.wallRunsM, 0] })}
              >
                Add wall run
              </button>
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h3>Foundations, Roof and Structure</h3>
                <button className="small" onClick={() => toggleCollapse("extension", "foundations-roof-structure")}>
                  {isCollapsed("extension", "foundations-roof-structure") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("extension", "foundations-roof-structure") && (
                <>
              <div className="grid two">
                <label>
                  Trench width (m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.foundations.trenchWidthM}
                    onChange={(e) =>
                      updateExtension({
                        foundations: { ...project.extensionQuote.foundations, trenchWidthM: Number(e.target.value) || 0 }
                      })
                    }
                  />
                </label>
                <label>
                  Trench depth (m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.foundations.trenchDepthM}
                    onChange={(e) =>
                      updateExtension({
                        foundations: { ...project.extensionQuote.foundations, trenchDepthM: Number(e.target.value) || 0 }
                      })
                    }
                  />
                </label>
                <label>
                  Trench fill rate (£/m3)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.foundations.trenchFillRatePerM3}
                    onChange={(e) =>
                      updateExtension({
                        foundations: { ...project.extensionQuote.foundations, trenchFillRatePerM3: Number(e.target.value) || 0 }
                      })
                    }
                  />
                </label>
                <label>
                  Roof type
                  <select
                    value={project.extensionQuote.roof.type}
                    onChange={(e) =>
                      updateExtension({ roof: { ...project.extensionQuote.roof, type: e.target.value as ProjectData["extensionQuote"]["roof"]["type"] } })
                    }
                  >
                    <option value="warm_flat">Warm flat roof</option>
                    <option value="sloping">Sloping roof</option>
                  </select>
                </label>
                <label>
                  {project.extensionQuote.roof.type === "warm_flat" ? "Flat roof finish" : "Sloping roof finish"}
                  {project.extensionQuote.roof.type === "warm_flat" ? (
                    <select
                      value={project.extensionQuote.roof.flatFinish}
                      onChange={(e) =>
                        updateExtension({
                          roof: { ...project.extensionQuote.roof, flatFinish: e.target.value as ProjectData["extensionQuote"]["roof"]["flatFinish"] }
                        })
                      }
                    >
                      <option value="tiles">Tiles</option>
                      <option value="grp">GRP</option>
                      <option value="zinc">Zinc</option>
                      <option value="felt">Felt</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <select
                      value={project.extensionQuote.roof.slopingFinish}
                      onChange={(e) =>
                        updateExtension({
                          roof: { ...project.extensionQuote.roof, slopingFinish: e.target.value as ProjectData["extensionQuote"]["roof"]["slopingFinish"] }
                        })
                      }
                    >
                      <option value="slates">Slates</option>
                      <option value="tiles">Tiles</option>
                      <option value="zinc">Zinc</option>
                      <option value="other">Other</option>
                    </select>
                  )}
                </label>
                <label>
                  Steel length (m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.structure.steelLengthM}
                    onChange={(e) =>
                      updateExtension({ structure: { ...project.extensionQuote.structure, steelLengthM: Number(e.target.value) || 0 } })
                    }
                  />
                </label>
              </div>
              <h4>Roof lights</h4>
              {project.extensionQuote.roof.roofLights.map((light, idx) => (
                <div key={light.type} className="grid two">
                  <label>
                    {light.type} qty
                    <input
                      type="number"
                      step={1}
                      value={light.qty}
                      onChange={(e) => {
                        const roofLights = [...project.extensionQuote.roof.roofLights];
                        roofLights[idx] = { ...roofLights[idx], qty: parseIntSafe(e.target.value) };
                        updateExtension({ roof: { ...project.extensionQuote.roof, roofLights } });
                      }}
                    />
                  </label>
                  <label>
                    {light.type} unit cost (£)
                    <input
                      type="number"
                      step="0.01"
                      value={light.unitCostGBP}
                      onChange={(e) => {
                        const roofLights = [...project.extensionQuote.roof.roofLights];
                        roofLights[idx] = { ...roofLights[idx], unitCostGBP: Number(e.target.value) || 0 };
                        updateExtension({ roof: { ...project.extensionQuote.roof, roofLights } });
                      }}
                    />
                  </label>
                </div>
              ))}
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h3>Rates and Add-ons</h3>
                <button className="small" onClick={() => toggleCollapse("extension", "rates-add-ons")}>
                  {isCollapsed("extension", "rates-add-ons") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("extension", "rates-add-ons") && (
                <>
              <div className="grid two">
                <label>
                  Brick/block unit price (£/m2)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.rates.brickBlockUnitPrice}
                    onChange={(e) =>
                      updateExtension({ rates: { ...project.extensionQuote.rates, brickBlockUnitPrice: Number(e.target.value) || 0 } })
                    }
                  />
                </label>
                <label>
                  Steel price (£/m)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.rates.steelPricePerM}
                    onChange={(e) => updateExtension({ rates: { ...project.extensionQuote.rates, steelPricePerM: Number(e.target.value) || 0 } })}
                  />
                </label>
                <label>
                  Screed rate (£/m2)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.rates.screedRatePerM2}
                    onChange={(e) => updateExtension({ rates: { ...project.extensionQuote.rates, screedRatePerM2: Number(e.target.value) || 0 } })}
                  />
                </label>
                <label>
                  Screed labour split (%)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.rates.screedLabourPct}
                    onChange={(e) => updateExtension({ rates: { ...project.extensionQuote.rates, screedLabourPct: Number(e.target.value) || 0 } })}
                  />
                </label>
                <label>
                  Overheads (%)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.overheadPct}
                    onChange={(e) => updateExtension({ overheadPct: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Profit (%)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.profitPct}
                    onChange={(e) => updateExtension({ profitPct: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Main contractor overhead (%)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.mainOverheadPct ?? 0}
                    onChange={(e) => updateExtension({ mainOverheadPct: Number(e.target.value) || 0 })}
                  />
                </label>
                <label>
                  Main contractor profit (%)
                  <input
                    type="number"
                    step="0.01"
                    value={project.extensionQuote.mainProfitPct ?? 0}
                    onChange={(e) => updateExtension({ mainProfitPct: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>

              <h4>Add-ons</h4>
              {project.extensionQuote.addons.map((addon, idx) => (
                <div key={addon.id} className="grid two">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={addon.enabled}
                      onChange={(e) => {
                        const addons = [...project.extensionQuote.addons];
                        addons[idx] = { ...addons[idx], enabled: e.target.checked };
                        updateExtension({ addons });
                      }}
                    />
                    {addon.name}
                  </label>
                  <label>
                    Qty ({addon.unit})
                    <input
                      type="number"
                      step="0.01"
                      value={addon.qty}
                      onChange={(e) => {
                        const addons = [...project.extensionQuote.addons];
                        addons[idx] = { ...addons[idx], qty: Number(e.target.value) || 0 };
                        updateExtension({ addons });
                      }}
                    />
                  </label>
                  <label className="full">
                    Unit cost (£)
                    <input
                      type="number"
                      step="0.01"
                      value={addon.unitCostGBP}
                      onChange={(e) => {
                        const addons = [...project.extensionQuote.addons];
                        addons[idx] = { ...addons[idx], unitCostGBP: Number(e.target.value) || 0 };
                        updateExtension({ addons });
                      }}
                    />
                  </label>
                </div>
              ))}
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h3>Extension Output</h3>
                <button className="small" onClick={() => toggleCollapse("extension", "extension-output")}>
                  {isCollapsed("extension", "extension-output") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("extension", "extension-output") && (
                <>
              <p>Perimeter: {extensionSummary.perimeterM.toFixed(2)} m</p>
              <p>Wall area gross/net: {extensionSummary.wallAreaGrossM2.toFixed(2)} / {extensionSummary.wallAreaNetM2.toFixed(2)} m2</p>
              <p>Floor area: {extensionSummary.floorAreaM2.toFixed(2)} m2</p>
              <p>Trench volume: {extensionSummary.trenchVolumeM3.toFixed(2)} m3</p>
              <p>Roof lights: £{extensionSummary.roofLightCost.toFixed(2)}</p>
              <p>Structural openings: £{extensionSummary.structuralCost.toFixed(2)}</p>
              <p>Add-ons total: £{extensionSummary.addonsTotal.toFixed(2)}</p>
              <h4>Category breakdown</h4>
              {extensionSummary.categories.map((row) => (
                <p key={row.category}>
                  {row.category}: materials £{row.materials.toFixed(2)} | labour £{row.labour.toFixed(2)} | total £{row.totalCost.toFixed(2)}
                </p>
              ))}
              <h4>Commercial summary</h4>
              <p>Materials: £{extensionSummary.materialsTotal.toFixed(2)}</p>
              <p>Labour: £{extensionSummary.labourTotal.toFixed(2)}</p>
              <p>Direct cost: £{extensionSummary.directCost.toFixed(2)}</p>
              <p>Overheads (subcontractor): £{(extensionSummary.overhead ?? 0).toFixed(2)}</p>
              <p>Subcontractor price: £{(extensionSummary.subcontractorPrice ?? 0).toFixed(2)}</p>
              <p>Subcontractor profit: £{(extensionSummary.profit ?? 0).toFixed(2)}</p>
              <p>Main contractor overhead: £{(extensionSummary.mainOverhead ?? 0).toFixed(2)}</p>
              <p>Main contractor profit: £{(extensionSummary.mainProfit ?? 0).toFixed(2)}</p>
              <p><strong>Client price: £{(extensionSummary.clientPrice ?? 0).toFixed(2)}</strong></p>
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h3>Calculation Sheet (Step by Step)</h3>
                <button className="small" onClick={() => toggleCollapse("extension", "calculation-sheet")}>
                  {isCollapsed("extension", "calculation-sheet") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("extension", "calculation-sheet") && (
                <>
              <p className="muted">All values below are calculated from current Extension inputs.</p>

              <h4>1. Geometry</h4>
              <p className="math-row">
                Perimeter = sum(wall runs) = {project.extensionQuote.wallRunsM.map((v) => v.toFixed(2)).join(" + ")} ={" "}
                <strong>{extensionSummary.perimeterM.toFixed(2)} m</strong>
              </p>
              <p className="math-row">
                Wall gross area = perimeter × wall height = {extensionSummary.perimeterM.toFixed(2)} ×{" "}
                {project.extensionQuote.wallHeightM.toFixed(2)} = <strong>{extensionSummary.wallAreaGrossM2.toFixed(2)} m2</strong>
              </p>
              <p className="math-row">
                Wall net area = gross area - opening to garden area = {extensionSummary.wallAreaGrossM2.toFixed(2)} - (
                {project.extensionQuote.openingToGardenM.toFixed(2)} × {project.extensionQuote.wallHeightM.toFixed(2)}) ={" "}
                <strong>{extensionSummary.wallAreaNetM2.toFixed(2)} m2</strong>
              </p>
              <p className="math-row">
                Floor area = {project.extensionQuote.floorAreaOverrideM2 !== undefined ? "override" : "length × width"} ={" "}
                {project.extensionQuote.floorAreaOverrideM2 !== undefined
                  ? `${project.extensionQuote.floorAreaOverrideM2.toFixed(2)}`
                  : `${project.extensionQuote.floorLengthM.toFixed(2)} × ${project.extensionQuote.floorWidthM.toFixed(2)}`}{" "}
                = <strong>{extensionSummary.floorAreaM2.toFixed(2)} m2</strong>
              </p>
              <p className="math-row">
                Trench volume = perimeter × width × depth = {extensionSummary.perimeterM.toFixed(2)} ×{" "}
                {project.extensionQuote.foundations.trenchWidthM.toFixed(2)} ×{" "}
                {project.extensionQuote.foundations.trenchDepthM.toFixed(2)} ={" "}
                <strong>{extensionSummary.trenchVolumeM3.toFixed(2)} m3</strong>
              </p>

              <h4>2. Foundations</h4>
              <p className="math-row">
                Skip = perimeter × skip £/lm = {extensionSummary.perimeterM.toFixed(2)} ×{" "}
                {project.extensionQuote.foundations.skipCostPerLM.toFixed(2)} = £
                {extensionSummary.foundationsBreakdown.skipCost.toFixed(2)}
              </p>
              <p className="math-row">
                Concrete = trench volume × concrete £/m3 + fixed pump = {extensionSummary.trenchVolumeM3.toFixed(2)} ×{" "}
                {project.extensionQuote.foundations.concreteCostPerM3.toFixed(2)} +{" "}
                {project.extensionQuote.foundations.concretePumpDeliveryFixedGBP.toFixed(2)} = £
                {extensionSummary.foundationsBreakdown.concreteCost.toFixed(2)}
              </p>
              <p className="math-row">
                Labour ({extensionSummary.foundationsBreakdown.labourMethod}) = £
                {extensionSummary.foundationsBreakdown.labourCost.toFixed(2)}
              </p>
              <p className="math-row">
                Foundations total = £{extensionSummary.categories.find((c) => c.category === "Foundations")?.totalCost.toFixed(2)}
              </p>

              <h4>3. Walls</h4>
              <p className="math-row">
                Below DPC = perimeter × under-DPC £/lm = {extensionSummary.wallBreakdown.underDpcLength.toFixed(2)} ×{" "}
                {project.extensionQuote.walls.underDpcCostPerLM.toFixed(2)} = £
                {extensionSummary.wallBreakdown.underDpcCost.toFixed(2)}
              </p>
              <p className="math-row">
                Above DPC = net area × above-DPC £/m2 = {extensionSummary.wallBreakdown.aboveDpcArea.toFixed(2)} ×{" "}
                {project.extensionQuote.walls.aboveDpcCostPerM2.toFixed(2)} = £
                {extensionSummary.wallBreakdown.aboveDpcCost.toFixed(2)}
              </p>

              <h4>4. Floor, Roof, Structure, Add-ons</h4>
              <p className="math-row">
                Floor (screed) = floor area × screed £/m2 = {extensionSummary.floorAreaM2.toFixed(2)} ×{" "}
                {project.extensionQuote.rates.screedRatePerM2.toFixed(2)} = £
                {extensionSummary.categories.find((c) => c.category === "Floor")?.totalCost.toFixed(2)}
              </p>
              <p className="math-row">
                Roof total = £{extensionSummary.categories.find((c) => c.category === "Roof")?.totalCost.toFixed(2)}{" "}
                {project.extensionQuote.roof.type === "warm_flat"
                  ? `(warm flat, ${project.extensionQuote.roof.flatFinish} finish)`
                  : `(sloping, ${project.extensionQuote.roof.slopingFinish} finish)`}
              </p>
              <p className="math-row">
                Structural openings total = £{extensionSummary.structuralCost.toFixed(2)}
              </p>
              <p className="math-row">
                Add-ons total = £{extensionSummary.addonsTotal.toFixed(2)}
              </p>

              <h4>5. Commercial</h4>
              <p className="math-row">Direct cost = £{extensionSummary.directCost.toFixed(2)}</p>
              <p className="math-row">
                Overheads = direct × {project.extensionQuote.overheadPct.toFixed(2)}% = £{(extensionSummary.overhead ?? 0).toFixed(2)}
              </p>
              <p className="math-row">
                Subcontractor price = direct + overhead = £{extensionSummary.subcontractorPrice.toFixed(2)}
              </p>
              <p className="math-row">
                Profit (subcontractor) = subcontractor × {project.extensionQuote.profitPct.toFixed(2)}% = £{extensionSummary.profit.toFixed(2)}
              </p>
              <p className="math-row">
                Main contractor overhead = subcontractor × {String(project.extensionQuote.mainOverheadPct ?? 0)}% = £{(extensionSummary.mainOverhead ?? 0).toFixed(2)}
              </p>
              <p className="math-row">
                Main contractor profit = (subcontractor + main overhead) × {String(project.extensionQuote.mainProfitPct ?? 0)}% = £{(extensionSummary.mainProfit ?? 0).toFixed(2)}
              </p>
              <p className="math-row">
                <strong>Client price = subcontractor + profit + main overhead + main profit = £{(extensionSummary.clientPrice ?? 0).toFixed(2)}</strong>
              </p>
                </>
              )}
            </div>
          </section>
        )}

        {screen === "sections" && (
          <section className="panel">
            <h2>Sections Manager</h2>
            <p className="muted">Rename, add, remove sections and assign work lines.</p>
            <div className="subpanel">
              <div className="row spread">
                <h4>Section List</h4>
                <button className="small" onClick={() => toggleCollapse("sections", "manage-sections")}>
                  {isCollapsed("sections", "manage-sections") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("sections", "manage-sections") && (
                <>
              <div className="row wrap">
                <input
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="New section name"
                />
                <button onClick={addSection}>Add Section</button>
              </div>
              <div className="sections-list">
                {sectionsSorted.map((section) => (
                  <div
                    key={section.id}
                    className={`sections-list-row ${draggedSectionId === section.id ? "dragging" : ""}`}
                    draggable
                    onDragStart={() => onSectionDragStart(section.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onSectionDrop(e, section.id)}
                  >
                    <span className="drag-handle" title="Drag to reorder">::</span>
                    <input
                      value={section.name}
                      onChange={(e) => renameSection(section.id, e.target.value)}
                    />
                    <button
                      className="small"
                      disabled={section.id === "miscellaneous"}
                      onClick={() => removeSection(section.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
                </>
              )}
            </div>
            <div className="subpanel">
              <div className="row spread">
                <h4>Add Work Item To Section</h4>
                <button className="small" onClick={() => toggleCollapse("sections", "add-work-item")}>
                  {isCollapsed("sections", "add-work-item") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("sections", "add-work-item") && (
                <>
              <div className="grid two">
                <label>
                  Section
                  <select value={newItemSectionId} onChange={(e) => setNewItemSectionId(e.target.value)}>
                    {sectionsSorted.map((section) => (
                      <option key={section.id} value={section.id}>{section.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Name
                  <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g. Consumer unit upgrade" />
                </label>
                <label>
                  Unit
                  <select value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value as UnitType)}>
                    <option value="m2">m2</option>
                    <option value="lm">lm</option>
                    <option value="each">each</option>
                    <option value="fixed">fixed</option>
                  </select>
                </label>
                <label>
                  Category
                  <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value as WorkCategory)}>
                    {categoryOrder.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity source
                  <select value={newItemQtySource} onChange={(e) => setNewItemQtySource(e.target.value as QuantitySource)}>
                    <option value="manual">Manual</option>
                    <option value="floorArea">Floor area m2</option>
                    <option value="ceilingArea">Ceiling area m2</option>
                    <option value="wallArea">Wall area m2</option>
                    <option value="skirtingLM">Skirting LM</option>
                    <option value="architraveLM">Architrave LM</option>
                    <option value="doorCount">Door count</option>
                  </select>
                </label>
                <label>
                  Default rate (£)
                  <input type="number" step="0.01" value={newItemRate} onChange={(e) => setNewItemRate(Number(e.target.value) || 0)} />
                </label>
              </div>
              <button onClick={addWorkItemFromSections}>Add Work Item</button>
                </>
              )}
            </div>
            <div className="subpanel">
              <div className="row spread">
                <h4>Section Items</h4>
                <button className="small" onClick={() => toggleCollapse("sections", "section-items")}>
                  {isCollapsed("sections", "section-items") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("sections", "section-items") && (
                <>
                  <div className="row wrap">
                    <label>
                      Section
                      <select value={sectionItemsSectionId} onChange={(e) => setSectionItemsSectionId(e.target.value)}>
                        {sectionsSorted.map((section) => (
                          <option key={section.id} value={section.id}>{section.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {sectionItemsForSelectedSection.length === 0 ? (
                    <p className="muted">No items in this section.</p>
                  ) : (
                    <div className="sections-grid">
                      <div className="sections-head">Item</div>
                      <div className="sections-head">Scope</div>
                      <div className="sections-head">Action</div>
                      {sectionItemsForSelectedSection.map((work) => (
                        <div key={work.id} className="sections-row">
                          <div className="sections-cell">{work.name}</div>
                          <div className="sections-cell">{work.scope ?? "room"}</div>
                          <div className="sections-cell">
                            <button className="small" onClick={() => removeWorkItemFromProject(work.id)}>Remove Work Item</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="subpanel">
              <div className="row spread">
                <h4>Search Work Items</h4>
                <button className="small" onClick={() => toggleCollapse("sections", "reassign-work-items")}>
                  {isCollapsed("sections", "reassign-work-items") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("sections", "reassign-work-items") && (
                <>
                  <input
                    value={sectionsSearch}
                    onChange={(e) => setSectionsSearch(e.target.value)}
                    placeholder="Search by work item, category, or section"
                  />
                </>
              )}
            </div>
            {!isCollapsed("sections", "reassign-work-items") && (
              <>
            <p className="muted">Assign each work line to the correct module/section.</p>
            <div className="sections-grid">
              <div className="sections-head">Work Item</div>
              <div className="sections-head">Current Section</div>
              <div className="sections-head">Move To</div>
              <div className="sections-head">Actions</div>
              {sectionsCategoryOrder.map((category) => {
                const filteredItems = sectionsFilteredByCategory.get(category) ?? [];
                if (!filteredItems.length) return null;
                return (
                  <div key={category} className="sections-category">
                    <div className="sections-category-title">{category}</div>
                    {filteredItems.map((work) => (
                      <div key={work.id} className="sections-row">
                        <div className="sections-cell">
                          <input value={work.name} onChange={(e) => renameWorkItem(work.id, e.target.value)} />
                        </div>
                        <div className="sections-cell">
                          {moduleNameById.get(work.moduleId ?? "miscellaneous") ?? "Miscellaneous"}
                        </div>
                        <div className="sections-cell">
                          <select
                            value={work.moduleId ?? "miscellaneous"}
                            onChange={(e) => reassignWorkModule(work.id, e.target.value)}
                          >
                            {sectionsSorted.map((module) => (
                              <option key={module.id} value={module.id}>{module.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="sections-cell">
                          <button className="small" onClick={() => removeWorkItemFromProject(work.id)}>Remove Work Item</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            {sectionsFilteredByCategory.size === 0 && (
              <p className="muted">No work items match your search.</p>
            )}
              </>
            )}
          </section>
        )}

        {screen === "sections" && (
          <section className="panel">
            <h2>Rates and Settings</h2>
            <div className="grid two">
              <label>
                Day rate (£, fixed for man-days)
                <input type="number" step="0.01" value={project.settings.dayRateGBP} readOnly disabled />
              </label>
              <label>
                Ceiling height (m)
                <input
                  type="number"
                  step="0.01"
                  value={project.settings.ceilingHeightM}
                  onChange={(e) =>
                    persist({ ...project, settings: { ...project.settings, ceilingHeightM: Number(e.target.value) || 0 } }, "changes to rates/settings")
                  }
                />
              </label>
              <label>
                Default door count per room
                <input
                  type="number"
                  step={1}
                  min={0}
                  value={project.settings.defaultDoorCountPerRoom}
                  onChange={(e) =>
                    persist({
                      ...project,
                      settings: { ...project.settings, defaultDoorCountPerRoom: parseIntSafe(e.target.value) }
                    }, "changes to rates/settings")
                  }
                />
              </label>
            </div>

            <h3>Unit rates (£)</h3>
            <div className="grid two">
              {(
                Object.keys(project.settings.unitRatesGBP) as Array<keyof ProjectData["settings"]["unitRatesGBP"]>
              ).map((key) => (
                <label key={key}>
                  {key}
                  <input
                    type="number"
                    step="0.01"
                    value={project.settings.unitRatesGBP[key]}
                    onChange={(e) =>
                      persist({
                        ...project,
                        settings: {
                          ...project.settings,
                          unitRatesGBP: {
                            ...project.settings.unitRatesGBP,
                            [key]: Number(e.target.value) || 0
                          }
                        }
                      }, "changes to rates/settings")
                    }
                  />
                </label>
              ))}
            </div>
            <button onClick={resetSettings}>Reset to defaults</button>
          </section>
        )}

        {screen === "saves" && (
          <section>
            <div className="panel">
              <div className="row spread">
                <h2>Save Status</h2>
                <button className="small" onClick={() => toggleCollapse("saves", "status")}>
                  {isCollapsed("saves", "status") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("saves", "status") && (
                <>
                  <p className="muted"><strong>Snapshots:</strong> {snapshots.length}</p>
                  <p className="muted"><strong>Templates:</strong> {projectTemplates.length}</p>
                  <p className="muted"><strong>Last autosave:</strong> {snapshots[0]?.createdAt ? new Date(snapshots[0].createdAt).toLocaleString() : "Not yet"}</p>
                  <p className="muted"><strong>Last full backup export:</strong> {lastFullBackupExportedAt ? new Date(lastFullBackupExportedAt).toLocaleString() : "Not yet"}</p>
                  <p className={isBackupStale ? "warn-text" : "muted"}>
                    <strong>Backup health:</strong> {isBackupStale
                      ? `Needs refresh (older than ${STALE_BACKUP_DAYS} days or missing).`
                      : "Healthy"}
                  </p>
                  {savesMessage && <p className="muted"><strong>Status:</strong> {savesMessage}</p>}
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h2>Backups</h2>
                <button className="small" onClick={() => toggleCollapse("saves", "backups")}>
                  {isCollapsed("saves", "backups") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("saves", "backups") && (
                <>
                  <p className="muted">Full backup is the durable option (project + snapshots + templates + UI state).</p>
                  <div className="actions">
                    <button onClick={handleExportJson}>Export JSON (project only)</button>
                    <button onClick={() => fileInputRef.current?.click()}>Import JSON (project only)</button>
                    <button onClick={handleExportFullBackup}>Export Full Backup</button>
                    <button onClick={() => fullBackupInputRef.current?.click()}>Import Full Backup</button>
                    <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportJson} />
                    <input ref={fullBackupInputRef} type="file" accept="application/json" hidden onChange={handleImportFullBackup} />
                  </div>
                  <p className="muted">`Export JSON` / `Import JSON`: project only.</p>
                  <p className="muted">`Export Full Backup` / `Import Full Backup`: project + snapshots + templates + UI state.</p>
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h2>Project Templates</h2>
                <button className="small" onClick={() => toggleCollapse("saves", "project-templates")}>
                  {isCollapsed("saves", "project-templates") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("saves", "project-templates") && (
                <>
                  <p className="muted">Save reusable project setups and apply them later.</p>
                  <div className="row wrap">
                    <input
                      value={newProjectTemplateName}
                      onChange={(e) => setNewProjectTemplateName(e.target.value)}
                      placeholder="Template name (e.g. 28DR with 4 rooms)"
                    />
                    <button onClick={saveCurrentProjectAsTemplate}>Save current as template</button>
                  </div>
                  {projectTemplates.length === 0 ? (
                    <p className="muted">No project templates saved yet.</p>
                  ) : (
                    <div className="sections-list">
                      {projectTemplates.map((template) => (
                        <div key={template.id} className="sections-list-row">
                          <div style={{ flex: 1 }}>
                            <input
                              value={template.name}
                              onChange={(e) => updateProjectTemplateName(template.id, e.target.value)}
                              style={{ width: "100%", marginBottom: "4px" }}
                            />
                            <p className="muted" style={{ margin: 0, fontSize: "0.85em" }}>
                              Modified: {new Date(template.lastModifiedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="row">
                            <button className="small" onClick={() => {
                              setTemplateToApply(template);
                              setShowApplyTemplateDialog(true);
                            }}>Apply</button>
                            <button className="small danger" onClick={() => deleteProjectTemplateLocal(template.id)}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h2>Autosave Snapshots</h2>
                <button className="small" onClick={() => toggleCollapse("saves", "autosave-snapshots")}>
                  {isCollapsed("saves", "autosave-snapshots") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("saves", "autosave-snapshots") && (
                <>
                  <p className="muted">Snapshots are for quick undo/restore within this browser origin.</p>
                  <div className="row wrap">
                    <input
                      value={snapshotNote}
                      onChange={(e) => setSnapshotNote(e.target.value)}
                      placeholder="Snapshot note (optional)"
                    />
                    <button className="small" onClick={createSnapshotNow}>Save Snapshot Now</button>
                  </div>
                  {!snapshots.length && <p className="muted">No snapshots yet. Autosave creates up to 30 recent snapshots.</p>}
                  {snapshots.map((snapshot) => (
                    <div key={snapshot.id} className="row spread snapshot-row">
                      <span>
                        {new Date(snapshot.createdAt).toLocaleString()}
                        {snapshot.note ? <> <strong>| {snapshot.note}</strong></> : ""}
                      </span>
                      <button className="small" onClick={() => restoreSnapshot(snapshot)}>Restore</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        )}

        {screen === "summary" && (
          <section>
            <div className="panel">
              <h2>Summary</h2>
              <p><strong>Client:</strong> {project.info.clientName || "-"}</p>
              <p><strong>Date:</strong> {project.info.date || "-"}</p>
              <p><strong>Address:</strong> {project.info.address || "-"}</p>
              {project.info.description && <p><strong>Description:</strong> {project.info.description}</p>}
              <h3>Combined Project Total</h3>
              <p>Room refurbishment labour total: £{totals.grandTotal.toFixed(2)}</p>
              <p>Extension client total: £{extensionClientPrice.toFixed(2)}</p>
              <p>
                <strong>Combined total (refurb + extension): £{combinedProjectTotal.toFixed(2)}</strong>
              </p>
              <p>Combined equivalent man-days: {combinedProjectManDays.toFixed(2)}</p>
              <p>
                <strong>Grand total labour: £{totals.grandTotal.toFixed(2)}</strong>
              </p>
              <p>Total man-days: {totals.manDays.toFixed(2)}</p>
              <div className="actions">
                <button onClick={() => window.print()}>Print-friendly view</button>
                <button onClick={handleExportCsv}>Export CSV</button>
              </div>
            </div>

            <div className="panel">
              <div className="row spread">
                <h3>Totals by category</h3>
                <button className="small" onClick={() => toggleCollapse("summary", "totals-by-category")}>
                  {isCollapsed("summary", "totals-by-category") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("summary", "totals-by-category") && (
                <>
              {projectCategories.map((cat) => {
                const value = totals.byCategory.get(cat) ?? 0;
                return (
                  <p key={cat}>
                    {cat}: £{value.toFixed(2)}
                  </p>
                );
              })}
                </>
              )}
            </div>

            <div className="panel">
              <div className="row spread">
                <h3>Totals by room</h3>
                <button className="small" onClick={() => toggleCollapse("summary", "totals-by-room")}>
                  {isCollapsed("summary", "totals-by-room") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("summary", "totals-by-room") && (
                <>
              {project.rooms.map((room) => {
                const rt = roomTotals(room.id, lineItems.filter((i) => !i.excluded || i.roomId === room.id), project.settings.dayRateGBP);
                return (
                  <p key={room.id}>
                    {room.name} {room.excludeFromTotals ? "(excluded)" : ""}: £{rt.total.toFixed(2)} ({rt.manDays.toFixed(2)} md)
                  </p>
                );
              })}
              <p>
                Project-wide works: £
                {lineItems
                  .filter((i) => i.roomId === PROJECT_SCOPE_ROOM_ID && !i.excluded)
                  .reduce((sum, i) => sum + i.lineTotal, 0)
                  .toFixed(2)}
              </p>
                </>
              )}
            </div>
            <div className="panel">
              <div className="row spread">
                <h3>Totals by section</h3>
                <button className="small" onClick={() => toggleCollapse("summary", "totals-by-section")}>
                  {isCollapsed("summary", "totals-by-section") ? "Expand" : "Collapse"}
                </button>
              </div>
              {!isCollapsed("summary", "totals-by-section") && (
                <>
              {sectionsSorted.map((section) => {
                const total = sectionTotals.get(section.id) ?? 0;
                if (total === 0) return null;
                return <p key={section.id}>{section.name}: £{total.toFixed(2)}</p>;
              })}
                </>
              )}
            </div>
          </section>
        )}

        {showApplyTemplateDialog && templateToApply && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "8px",
              maxWidth: "500px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
            }}>
              <h3>Apply Project Template?</h3>
              <p>
                This will replace your current project with the template "<strong>{templateToApply.name}</strong>".
              </p>
              <p className="muted">
                You can edit the client name and date after applying.
              </p>
              <div className="row" style={{ gap: "12px", justifyContent: "flex-end" }}>
                <button onClick={() => {
                  setShowApplyTemplateDialog(false);
                  setTemplateToApply(null);
                }}>Cancel</button>
                <button style={{ backgroundColor: "#4CAF50", color: "white" }} onClick={() => applyProjectTemplate(templateToApply)}>
                  Apply Template
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
