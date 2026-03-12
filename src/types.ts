export type Level =
  | "Lower Ground Floor / Basement"
  | "Ground Floor"
  | "First Floor"
  | "Second Floor"
  | "Loft";
export type UnitType = "m2" | "lm" | "each" | "fixed";
export type WorkCategory =
  | "Plastering"
  | "Painting"
  | "Flooring"
  | "Joinery"
  | "Electrical"
  | "Heating"
  | "Plumbing"
  | "Demolition"
  | "Tiling"
  | "Carpentry"
  | "Decoration"
  | "Other";
export type QuantitySource =
  | "floorArea"
  | "ceilingArea"
  | "wallArea"
  | "skirtingLM"
  | "architraveLM"
  | "doorCount"
  | "manual";
export type WorkScope = "room" | "project";

export interface UnitRatesGBP {
  plasterSkimPerM2: number;
  paintPerM2: number;
  ply6mmPerM2: number;
  lvtLayPerM2: number;
  skirtingArchitravePerLM: number;
  doorHangPerDoor: number;
  electricalPointPerEach: number;
  electricalFirstFixPerPoint: number;
  electricalSecondFixPerPoint: number;
  plumbingFirstFixPerPoint: number;
  plumbingSecondFixPerPoint: number;
  radiatorChangeNoAdjustPerEach: number;
  radiatorChangeAdjustPerEach: number;
  wallpaperPerM2: number;
  wallTilingPerM2: number;
  floorTilingPerM2: number;
  dadoRailPerLM: number;
  pictureRailPerLM: number;
  wallPanelsPerM2: number;
  ceilingPlasterboardSinglePerM2: number;
  ceilingPlasterboardDoublePerM2: number;
  soundInsulationCeilingPerM2: number;
  boilerReplaceFixed: number;
  boilerMoveFixed: number;
  consumerUnitFixed: number;
  demolitionFixed: number;
}

export interface ProjectSettings {
  dayRateGBP: number;
  ceilingHeightM: number;
  defaultDoorCountPerRoom: number;
  unitRatesGBP: UnitRatesGBP;
}

export interface Room {
  id: string;
  name: string;
  level: Level;
  lengthM?: number;
  widthM?: number;
  manualFloorAreaM2?: number;
  manualCeilingAreaM2?: number;
  manualWallAreaM2?: number;
  manualSkirtingLM?: number;
  manualArchitraveLM?: number;
  doorCount: number;
  excludeFromTotals: boolean;
}

export interface WorkItem {
  id: string;
  name: string;
  unitType: UnitType;
  defaultRateKey: keyof UnitRatesGBP | "custom";
  quantitySource: QuantitySource;
  allowManualQty: boolean;
  category: WorkCategory;
  scope?: WorkScope;
  moduleId?: string;
  customRate?: number;
}

export interface ModuleTemplate {
  id: string;
  name: string;
  order: number;
  defaultVisible: boolean;
  items: WorkItem[];
}

export interface RoomWorkSelection {
  roomId: string;
  workItemId: string;
  qtyOverride?: number;
  rateOverride?: number;
  titleOverride?: string;
  isSelected: boolean;
  isDone: boolean;
  notes: string;
}

export interface RoomComputed {
  floorAreaM2: number;
  ceilingAreaM2: number;
  wallAreaM2: number;
  skirtingLM: number;
  architraveLM: number;
  perimeterM: number;
}

export interface ProjectSection {
  id: string;
  name: string;
  order: number;
}

export interface ProjectInfo {
  clientName: string;
  address: string;
  description: string;
  date: string;
}

export type WallConstructionType =
  | "block_brick_cavity"
  | "block_render"
  | "double_brick_cavity"
  | "timber_frame";
export type RoofType = "warm_flat" | "sloping";
export type FlatRoofFinish = "tiles" | "grp" | "zinc" | "felt" | "other";
export type SlopingRoofFinish = "slates" | "tiles" | "zinc" | "other";
export type RoofLightType = "velux" | "flat_rooflight" | "lantern";

export interface RoofLightSpec {
  type: RoofLightType;
  qty: number;
  unitCostGBP: number;
}

export interface StructuralOpening {
  id: string;
  label: string;
  widthM: number;
}

export interface ExtensionAddon {
  id: string;
  name: string;
  unit: UnitType;
  qty: number;
  unitCostGBP: number;
  enabled: boolean;
}

export type FoundationsLabourMethod = "hand_dig_2people" | "mini_digger";

export interface ExtensionQuote {
  floorLengthM: number;
  floorWidthM: number;
  wallRunsM: number[];
  floorAreaOverrideM2?: number;
  wallHeightM: number;
  wallType: WallConstructionType;
  openingToHouseM: number;
  openingToGardenM: number;
  foundations: {
    trenchWidthM: number;
    trenchDepthM: number;
    trenchFillRatePerM3: number;
    // Per-linear-metre cost breakdown (new)
    skipCostPerLM: number;
    concreteCostPerM3: number;
    concretePumpDeliveryFixedGBP: number;
    labourMethod: FoundationsLabourMethod;
    handDigDaysPerLM: number;
    handDigDailyRateGBP: number;
    miniDiggerCostPerWeek: number;
    miniDiggerDaysRequired: number;
  };
  walls: {
    underDpcHeightM: number;
    underDpcCostPerLM: number;
    aboveDpcCostPerM2: number;
  };
  rates: {
    brickBlockUnitPrice: number;
    steelPricePerM: number;
    goalpostAllowanceGBP: number;
    secondGoalpostAllowanceGBP: number;
    screedRatePerM2: number;
    screedLabourPct: number;
    roofBaseRatePerM2: number;
    slopingRoofRatePerM2: number;
  };
  roof: {
    type: RoofType;
    flatFinish: FlatRoofFinish;
    slopingFinish: SlopingRoofFinish;
    roofLights: RoofLightSpec[];
  };
  structure: {
    steelLengthM: number;
    steelPricePerMOverride?: number;
  };
  addons: ExtensionAddon[];
  overheadPct: number;
  profitPct: number;
  mainOverheadPct?: number;
  mainProfitPct?: number;
}

export interface ExtensionQuoteTemplate {
  id: string;
  name: string;
  quote: ExtensionQuote;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  createdAt: string;
  lastModifiedAt: string;
  project: ProjectData;
}

export interface UiPrefs {
  collapsedLevelGroups: Partial<Record<Level, boolean>>;
  dashboardPanelsCollapsed: Record<string, boolean>;
  roomPanelsCollapsed: Record<string, boolean>;
  sectionsPanelsCollapsed: Record<string, boolean>;
  savesPanelsCollapsed: Record<string, boolean>;
  extensionPanelsCollapsed: Record<string, boolean>;
  summaryPanelsCollapsed: Record<string, boolean>;
}

export interface ProjectData {
  info: ProjectInfo;
  extensionQuote: ExtensionQuote;
  extensionTemplates: ExtensionQuoteTemplate[];
  projectTemplates: ProjectTemplate[];
  settings: ProjectSettings;
  rooms: Room[];
  sections: ProjectSection[];
  workItems: WorkItem[];
  selections: RoomWorkSelection[];
}

export type RoomPresetType = "Bedroom" | "Hall/Corridor" | "Landing" | "Reception" | "Custom";
