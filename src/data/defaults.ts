import { ExtensionQuote, ExtensionQuoteTemplate, ModuleTemplate, ProjectData, ProjectSection, ProjectSettings, RoomPresetType, WorkItem } from "../types";

export const defaultProjectInfo = {
  clientName: "",
  address: "",
  description: "",
  date: new Date().toISOString().slice(0, 10)
};

export const defaultExtensionQuote: ExtensionQuote = {
  floorLengthM: 5,
  floorWidthM: 3,
  wallRunsM: [3, 3, 5],
  wallHeightM: 3.2,
  wallType: "block_brick_cavity",
  openingToHouseM: 2.4,
  openingToGardenM: 2.4,
  foundations: {
    trenchWidthM: 0.6,
    trenchDepthM: 1.0,
    trenchFillRatePerM3: 190,
    skipCostPerLM: 60,
    concreteCostPerM3: 115,
    concretePumpDeliveryFixedGBP: 400,
    labourMethod: "hand_dig_2people",
    handDigDaysPerLM: 0.273, // 3 days / 11 lm
    handDigDailyRateGBP: 500, // 2 people × £250/day
    miniDiggerCostPerWeek: 240,
    miniDiggerDaysRequired: 3
  },
  walls: {
    underDpcHeightM: 1.0,
    underDpcCostPerLM: 160,
    aboveDpcCostPerM2: 300
  },
  rates: {
    brickBlockUnitPrice: 65,
    steelPricePerM: 220,
    goalpostAllowanceGBP: 1400,
    secondGoalpostAllowanceGBP: 1200,
    screedRatePerM2: 360,
    screedLabourPct: 50,
    roofBaseRatePerM2: 180,
    slopingRoofRatePerM2: 245
  },
  roof: {
    type: "warm_flat",
    flatFinish: "felt",
    slopingFinish: "tiles",
    roofLights: [
      { type: "velux", qty: 0, unitCostGBP: 850 },
      { type: "flat_rooflight", qty: 0, unitCostGBP: 1100 },
      { type: "lantern", qty: 0, unitCostGBP: 2200 }
    ]
  },
  structure: {
    steelLengthM: 5
  },
  addons: [
    { id: "bifold-install", name: "Bifold/sliding door installation", unit: "fixed", qty: 1, unitCostGBP: 2400, enabled: false },
    { id: "adjacent-floor-upgrade", name: "Adjacent room floor upgrade", unit: "m2", qty: 10, unitCostGBP: 65, enabled: false },
    { id: "underpinning", name: "Underpinning", unit: "lm", qty: 0, unitCostGBP: 1200, enabled: false },
    { id: "parapet-walls", name: "Parapet walls", unit: "lm", qty: 0, unitCostGBP: 180, enabled: false },
    { id: "cappings", name: "Cappings", unit: "lm", qty: 0, unitCostGBP: 95, enabled: false },
    { id: "internal-gutter", name: "Internal gutter", unit: "fixed", qty: 1, unitCostGBP: 2000, enabled: false },
    { id: "external-gutter", name: "External gutter", unit: "fixed", qty: 1, unitCostGBP: 600, enabled: false },
    { id: "drainage", name: "Drainage works", unit: "fixed", qty: 1, unitCostGBP: 1500, enabled: false },
    { id: "manhole-relocation", name: "Manhole relocation", unit: "each", qty: 0, unitCostGBP: 950, enabled: false },
    { id: "gully-relocation", name: "Rainwater gully relocation", unit: "each", qty: 0, unitCostGBP: 200, enabled: false },
    { id: "sloping-roof-conversion", name: "Sloping roof conversion", unit: "m2", qty: 0, unitCostGBP: 250, enabled: false },
    { id: "additional-steels", name: "Additional steels", unit: "each", qty: 0, unitCostGBP: 1000, enabled: false }
  ],
  overheadPct: 12,
  profitPct: 15
  ,mainOverheadPct: 0,
  mainProfitPct: 0
};

export const cloneExtensionQuote = (quote: ExtensionQuote): ExtensionQuote => ({
  ...quote,
  wallRunsM: [...quote.wallRunsM],
  foundations: { ...quote.foundations },
  walls: { ...quote.walls },
  rates: { ...quote.rates },
  roof: {
    ...quote.roof,
    roofLights: quote.roof.roofLights.map((r) => ({ ...r }))
  },
  structure: { ...quote.structure },
  addons: quote.addons.map((a) => ({ ...a }))
});

const extensionTemplate28dr: ExtensionQuote = {
  ...cloneExtensionQuote(defaultExtensionQuote),
  floorLengthM: 3,
  floorWidthM: 6,
  wallRunsM: [3, 6, 3, 0],
  wallHeightM: 3.2,
  wallType: "block_brick_cavity",
  openingToHouseM: 4.5,
  openingToGardenM: 4.5,
  foundations: {
    ...defaultExtensionQuote.foundations,
    trenchWidthM: 0.6,
    trenchDepthM: 1,
    trenchFillRatePerM3: 190
  },
  roof: {
    ...defaultExtensionQuote.roof,
    type: "warm_flat",
    flatFinish: "felt",
    roofLights: [
      { type: "velux", qty: 0, unitCostGBP: 849.92 },
      { type: "flat_rooflight", qty: 2, unitCostGBP: 650 },
      { type: "lantern", qty: 0, unitCostGBP: 220 }
    ]
  },
  structure: {
    steelLengthM: 17.97
  },
  rates: {
    ...defaultExtensionQuote.rates,
    steelPricePerM: 220,
    screedRatePerM2: 40,
    screedLabourPct: 49.96
  },
  addons: [
    { id: "bifold-install", name: "Bifold/sliding door installation", unit: "fixed", qty: 1, unitCostGBP: 600, enabled: true },
    { id: "adjacent-floor-upgrade", name: "Adjacent room floor upgrade", unit: "m2", qty: 14, unitCostGBP: 94.99, enabled: true },
    { id: "underpinning", name: "Underpinning", unit: "lm", qty: 3, unitCostGBP: 800, enabled: true },
    { id: "parapet-walls", name: "Parapet walls", unit: "lm", qty: 0, unitCostGBP: 180, enabled: false },
    { id: "cappings", name: "Cappings", unit: "lm", qty: 0, unitCostGBP: 95, enabled: false },
    { id: "internal-gutter", name: "Internal gutter", unit: "fixed", qty: 1, unitCostGBP: 2000, enabled: true },
    { id: "external-gutter", name: "External gutter", unit: "fixed", qty: 1, unitCostGBP: 850, enabled: true },
    { id: "drainage", name: "Drainage works", unit: "fixed", qty: 1, unitCostGBP: 850, enabled: true },
    { id: "manhole-relocation", name: "Manhole relocation", unit: "each", qty: 1, unitCostGBP: 950, enabled: true },
    { id: "gully-relocation", name: "Rainwater gully relocation", unit: "each", qty: 1, unitCostGBP: 200, enabled: true },
    { id: "sloping-roof-conversion", name: "Sloping roof conversion", unit: "m2", qty: 0, unitCostGBP: 250, enabled: false },
    { id: "additional-steels", name: "Additional steels", unit: "each", qty: 0, unitCostGBP: 1000, enabled: false }
  ],
  overheadPct: 12,
  profitPct: 15,
  mainOverheadPct: 0,
  mainProfitPct: 0
};

export const defaultExtensionTemplates: ExtensionQuoteTemplate[] = [
  {
    id: "standard-extension",
    name: "Standard Extension (Default)",
    quote: cloneExtensionQuote(defaultExtensionQuote)
  },
  {
    id: "template-28dr",
    name: "28DR Project",
    quote: cloneExtensionQuote(extensionTemplate28dr)
  }
];

export const defaultSettings: ProjectSettings = {
  dayRateGBP: 185,
  ceilingHeightM: 2.5,
  defaultDoorCountPerRoom: 1,
  unitRatesGBP: {
    plasterSkimPerM2: 5,
    paintPerM2: 7.5,
    ply6mmPerM2: 6,
    lvtLayPerM2: 8,
    skirtingArchitravePerLM: 3.75,
    doorHangPerDoor: 85,
    electricalPointPerEach: 85,
    electricalFirstFixPerPoint: 50,
    electricalSecondFixPerPoint: 35,
    plumbingFirstFixPerPoint: 100,
    plumbingSecondFixPerPoint: 100,
    radiatorChangeNoAdjustPerEach: 120,
    radiatorChangeAdjustPerEach: 180,
    wallpaperPerM2: 0,
    wallTilingPerM2: 0,
    floorTilingPerM2: 0,
    dadoRailPerLM: 0,
    pictureRailPerLM: 0,
    wallPanelsPerM2: 0,
    ceilingPlasterboardSinglePerM2: 0,
    ceilingPlasterboardDoublePerM2: 0,
    soundInsulationCeilingPerM2: 0,
    boilerReplaceFixed: 0,
    boilerMoveFixed: 0,
    consumerUnitFixed: 0,
    demolitionFixed: 0
  }
};

export const defaultModules: ModuleTemplate[] = [
  {
    id: "enabling-works",
    name: "Enabling works and Demolitions",
    order: 1,
    defaultVisible: true,
    items: [
      {
        id: "demolition-works",
        name: "Demolition works",
        unitType: "fixed",
        defaultRateKey: "demolitionFixed",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Demolition",
        scope: "room",
        moduleId: "enabling-works"
      }
    ]
  },
  {
    id: "site-overheads-setup",
    name: "Site Overheads and Setup",
    order: 2,
    defaultVisible: true,
    items: [
      {
        id: "portable-toilet",
        name: "Portable toilet",
        unitType: "fixed",
        defaultRateKey: "custom",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Other",
        scope: "project",
        moduleId: "site-overheads-setup",
        customRate: 0
      },
      {
        id: "mobilisation",
        name: "Mobilisation",
        unitType: "fixed",
        defaultRateKey: "custom",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Other",
        scope: "project",
        moduleId: "site-overheads-setup",
        customRate: 0
      },
      {
        id: "scaffold",
        name: "Scaffold",
        unitType: "fixed",
        defaultRateKey: "custom",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Other",
        scope: "project",
        moduleId: "site-overheads-setup",
        customRate: 0
      },
      {
        id: "skip-licence",
        name: "Skip licence",
        unitType: "fixed",
        defaultRateKey: "custom",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Other",
        scope: "project",
        moduleId: "site-overheads-setup",
        customRate: 0
      },
      {
        id: "management",
        name: "Management",
        unitType: "fixed",
        defaultRateKey: "custom",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Other",
        scope: "project",
        moduleId: "site-overheads-setup",
        customRate: 0
      },
      {
        id: "final-cleaning",
        name: "Final cleaning",
        unitType: "fixed",
        defaultRateKey: "custom",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Other",
        scope: "project",
        moduleId: "site-overheads-setup",
        customRate: 0
      },
      {
        id: "parking",
        name: "Parking",
        unitType: "fixed",
        defaultRateKey: "custom",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Other",
        scope: "project",
        moduleId: "site-overheads-setup",
        customRate: 0
      },
      {
        id: "temporary-fence-and-protection",
        name: "Temporary fence and protection",
        unitType: "fixed",
        defaultRateKey: "custom",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Other",
        scope: "project",
        moduleId: "site-overheads-setup",
        customRate: 0
      }
    ]
  },
  {
    id: "internal-joinery",
    name: "Internal Joinery",
    order: 3,
    defaultVisible: true,
    items: [
      {
        id: "fit-skirting",
        name: "Fit skirting",
        unitType: "lm",
        defaultRateKey: "skirtingArchitravePerLM",
        quantitySource: "skirtingLM",
        allowManualQty: true,
        category: "Joinery",
        moduleId: "internal-joinery"
      },
      {
        id: "fit-architraves",
        name: "Fit architraves",
        unitType: "lm",
        defaultRateKey: "skirtingArchitravePerLM",
        quantitySource: "architraveLM",
        allowManualQty: true,
        category: "Joinery",
        moduleId: "internal-joinery"
      },
      {
        id: "hang-internal-door",
        name: "Hang internal door",
        unitType: "each",
        defaultRateKey: "doorHangPerDoor",
        quantitySource: "doorCount",
        allowManualQty: true,
        category: "Joinery",
        moduleId: "internal-joinery"
      },
      {
        id: "fit-dado-rail",
        name: "Fit dado rail",
        unitType: "lm",
        defaultRateKey: "dadoRailPerLM",
        quantitySource: "skirtingLM",
        allowManualQty: true,
        category: "Carpentry",
        moduleId: "internal-joinery"
      },
      {
        id: "fit-picture-rail",
        name: "Fit picture rail",
        unitType: "lm",
        defaultRateKey: "pictureRailPerLM",
        quantitySource: "skirtingLM",
        allowManualQty: true,
        category: "Carpentry",
        moduleId: "internal-joinery"
      },
      {
        id: "fit-wall-panels",
        name: "Fit wall panels",
        unitType: "m2",
        defaultRateKey: "wallPanelsPerM2",
        quantitySource: "wallArea",
        allowManualQty: true,
        category: "Carpentry",
        moduleId: "internal-joinery"
      }
    ]
  },
  {
    id: "plastering-insulation",
    name: "Plastering and Insulation",
    order: 4,
    defaultVisible: true,
    items: [
      {
        id: "skim-plaster-ceilings",
        name: "Skim plaster ceilings",
        unitType: "m2",
        defaultRateKey: "plasterSkimPerM2",
        quantitySource: "ceilingArea",
        allowManualQty: true,
        category: "Plastering",
        moduleId: "plastering-insulation"
      },
      {
        id: "skim-plaster-walls",
        name: "Skim plaster walls",
        unitType: "m2",
        defaultRateKey: "plasterSkimPerM2",
        quantitySource: "wallArea",
        allowManualQty: true,
        category: "Plastering",
        moduleId: "plastering-insulation"
      },
      {
        id: "ceiling-single-plasterboard",
        name: "Replace ceiling with single plasterboard layer",
        unitType: "m2",
        defaultRateKey: "ceilingPlasterboardSinglePerM2",
        quantitySource: "ceilingArea",
        allowManualQty: true,
        category: "Plastering",
        moduleId: "plastering-insulation"
      },
      {
        id: "ceiling-double-plasterboard",
        name: "Replace ceiling with double plasterboard layer",
        unitType: "m2",
        defaultRateKey: "ceilingPlasterboardDoublePerM2",
        quantitySource: "ceilingArea",
        allowManualQty: true,
        category: "Plastering",
        moduleId: "plastering-insulation"
      },
      {
        id: "ceiling-sound-insulation",
        name: "Add ceiling sound insulation",
        unitType: "m2",
        defaultRateKey: "soundInsulationCeilingPerM2",
        quantitySource: "ceilingArea",
        allowManualQty: true,
        category: "Plastering",
        moduleId: "plastering-insulation"
      }
    ]
  },
  {
    id: "electrical",
    name: "Electrical",
    order: 5,
    defaultVisible: false,
    items: [
      {
        id: "electrical-point-standard",
        name: "Electrical point (standard)",
        unitType: "each",
        defaultRateKey: "electricalPointPerEach",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Electrical",
        moduleId: "electrical"
      },
      {
        id: "electrical-first-fix-points",
        name: "Electrical first fix points",
        unitType: "each",
        defaultRateKey: "electricalFirstFixPerPoint",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Electrical",
        moduleId: "electrical"
      },
      {
        id: "electrical-second-fix-points",
        name: "Electrical second fix points",
        unitType: "each",
        defaultRateKey: "electricalSecondFixPerPoint",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Electrical",
        moduleId: "electrical"
      },
      {
        id: "consumer-unit",
        name: "Consumer unit",
        unitType: "fixed",
        defaultRateKey: "consumerUnitFixed",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Electrical",
        moduleId: "electrical"
      }
    ]
  },
  {
    id: "heating",
    name: "Heating",
    order: 6,
    defaultVisible: false,
    items: [
      {
        id: "radiator-change-no-adjust",
        name: "Radiator change (no adjustment)",
        unitType: "each",
        defaultRateKey: "radiatorChangeNoAdjustPerEach",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Heating",
        moduleId: "heating"
      },
      {
        id: "radiator-change-adjust",
        name: "Radiator change (with adjustment)",
        unitType: "each",
        defaultRateKey: "radiatorChangeAdjustPerEach",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Heating",
        moduleId: "heating"
      },
      {
        id: "boiler-replace",
        name: "Replace boiler",
        unitType: "fixed",
        defaultRateKey: "boilerReplaceFixed",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Heating",
        moduleId: "heating"
      },
      {
        id: "boiler-move",
        name: "Move boiler",
        unitType: "fixed",
        defaultRateKey: "boilerMoveFixed",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Heating",
        moduleId: "heating"
      }
    ]
  },
  {
    id: "plumbing",
    name: "Plumbing",
    order: 7,
    defaultVisible: false,
    items: [
      {
        id: "plumbing-first-fix-points",
        name: "Plumbing first fix points",
        unitType: "each",
        defaultRateKey: "plumbingFirstFixPerPoint",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Plumbing",
        moduleId: "plumbing"
      },
      {
        id: "plumbing-second-fix-points",
        name: "Plumbing second fix points",
        unitType: "each",
        defaultRateKey: "plumbingSecondFixPerPoint",
        quantitySource: "manual",
        allowManualQty: true,
        category: "Plumbing",
        moduleId: "plumbing"
      }
    ]
  },
  {
    id: "floor-finishes",
    name: "Floor Finishes",
    order: 8,
    defaultVisible: true,
    items: [
      {
        id: "floor-prep-ply-6mm",
        name: "Floor prep with 6 mm ply",
        unitType: "m2",
        defaultRateKey: "ply6mmPerM2",
        quantitySource: "floorArea",
        allowManualQty: true,
        category: "Flooring",
        moduleId: "floor-finishes"
      },
      {
        id: "floor-finish",
        name: "Floor finish",
        unitType: "m2",
        defaultRateKey: "lvtLayPerM2",
        quantitySource: "floorArea",
        allowManualQty: true,
        category: "Flooring",
        moduleId: "floor-finishes"
      }
    ]
  },
  {
    id: "tiling",
    name: "Tiling",
    order: 9,
    defaultVisible: false,
    items: [
      {
        id: "wall-tiling",
        name: "Wall tiling",
        unitType: "m2",
        defaultRateKey: "wallTilingPerM2",
        quantitySource: "wallArea",
        allowManualQty: true,
        category: "Tiling",
        moduleId: "tiling"
      },
      {
        id: "floor-tiling",
        name: "Floor tiling",
        unitType: "m2",
        defaultRateKey: "floorTilingPerM2",
        quantitySource: "floorArea",
        allowManualQty: true,
        category: "Tiling",
        moduleId: "tiling"
      }
    ]
  },
  {
    id: "painting-decorating",
    name: "Painting and Decorating",
    order: 10,
    defaultVisible: true,
    items: [
      {
        id: "paint-ceilings",
        name: "Painting ceilings (prep + mist + 2 coats)",
        unitType: "m2",
        defaultRateKey: "paintPerM2",
        quantitySource: "ceilingArea",
        allowManualQty: true,
        category: "Painting",
        moduleId: "painting-decorating"
      },
      {
        id: "paint-walls",
        name: "Painting walls (prep + mist + 2 coats)",
        unitType: "m2",
        defaultRateKey: "paintPerM2",
        quantitySource: "wallArea",
        allowManualQty: true,
        category: "Painting",
        moduleId: "painting-decorating"
      },
      {
        id: "wallpaper",
        name: "Wallpaper",
        unitType: "m2",
        defaultRateKey: "wallpaperPerM2",
        quantitySource: "wallArea",
        allowManualQty: true,
        category: "Decoration",
        moduleId: "painting-decorating"
      }
    ]
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    order: 99,
    defaultVisible: true,
    items: []
  }
];

const moduleById = new Map(defaultModules.map((m) => [m.id, m]));
const moduleItemById = new Map(
  defaultModules.flatMap((module) =>
    module.items.map((item) => [item.id, { ...item, moduleId: module.id }] as const)
  )
);
const moduleItemByName = (() => {
  const unique = new Map<string, WorkItem & { moduleId?: string }>();
  const duplicates = new Set<string>();
  for (const module of defaultModules) {
    for (const item of module.items) {
      const key = item.name.trim().toLowerCase();
      const fullItem = { ...item, moduleId: module.id };
      if (duplicates.has(key)) continue;
      if (unique.has(key)) {
        unique.delete(key);
        duplicates.add(key);
      } else {
        unique.set(key, fullItem);
      }
    }
  }
  return unique;
})();
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

export const moduleCatalog = [...defaultModules].sort((a, b) => a.order - b.order);
export const defaultSections: ProjectSection[] = moduleCatalog.map((m) => ({
  id: m.id,
  name: m.name,
  order: m.order
}));

const cloneWorkItem = (item: WorkItem): WorkItem => ({ ...item });

const defaultVisibleItems = (): WorkItem[] =>
  moduleCatalog
    .filter((m) => m.defaultVisible)
    .flatMap((m) => m.items.map(cloneWorkItem));

const inferModuleScope = (moduleId: string | undefined): "room" | "project" | undefined => {
  if (!moduleId) return undefined;
  const moduleTemplate = moduleById.get(moduleId);
  if (!moduleTemplate?.items.length) return undefined;
  const scopes = new Set(moduleTemplate.items.map((item) => item.scope ?? "room"));
  if (scopes.size !== 1) return undefined;
  return Array.from(scopes)[0] as "room" | "project";
};

export const defaultWorkItems: WorkItem[] = defaultVisibleItems();

export const allModuleWorkItems = (): WorkItem[] => moduleCatalog.flatMap((module) => module.items.map(cloneWorkItem));

export const presetDoorCount = (preset: RoomPresetType, fallback: number): number => {
  if (preset === "Bedroom") return 1;
  if (preset === "Hall/Corridor" || preset === "Landing") return 0;
  if (preset === "Reception") return 1;
  return fallback;
};

const sampleRooms = [
  { id: "r1", name: "Loft bedroom", level: "Loft", lengthM: 4.8, widthM: 3.9, doorCount: 1, excludeFromTotals: false },
  { id: "r2", name: "Bed1", level: "First Floor", lengthM: 4.2, widthM: 3.8, doorCount: 1, excludeFromTotals: false },
  { id: "r3", name: "Bed2", level: "First Floor", lengthM: 3.9, widthM: 3.5, doorCount: 1, excludeFromTotals: false },
  { id: "r4", name: "Bed3", level: "First Floor", lengthM: 3.4, widthM: 3.1, doorCount: 1, excludeFromTotals: false },
  { id: "r5", name: "Landing", level: "First Floor", lengthM: 3.5, widthM: 1.8, doorCount: 0, excludeFromTotals: false },
  { id: "r6", name: "Reception", level: "Ground Floor", lengthM: 5.6, widthM: 4.1, doorCount: 1, excludeFromTotals: false },
  { id: "r7", name: "Hall/Corridor", level: "Ground Floor", lengthM: 4.3, widthM: 1.6, doorCount: 0, excludeFromTotals: false },
  { id: "r8", name: "Stairwell", level: "Ground Floor", lengthM: 2.7, widthM: 1.2, doorCount: 0, excludeFromTotals: false },
  { id: "r9", name: "Kitchen", level: "Ground Floor", lengthM: 3.5, widthM: 2.8, doorCount: 1, excludeFromTotals: true },
  { id: "r10", name: "Bathroom", level: "First Floor", lengthM: 2.4, widthM: 2.0, doorCount: 1, excludeFromTotals: true },
  { id: "r11", name: "Conservatory", level: "Ground Floor", lengthM: 3.2, widthM: 2.6, doorCount: 1, excludeFromTotals: true }
] as const;

const normalizeLevel = (level: string | undefined) => {
  if (level === "Ground" || level === "Ground Floor") return "Ground Floor";
  if (level === "First" || level === "First Floor") return "First Floor";
  if (level === "Second" || level === "Second Floor") return "Second Floor";
  if (level === "Lower Ground/Basement" || level === "Lower Ground Floor / Basement") {
    return "Lower Ground Floor / Basement";
  }
  if (level === "Loft") return "Loft";
  return "Ground Floor";
};

export const normalizeProjectData = (raw: ProjectData): ProjectData => {
  const mergedSettings: ProjectSettings = {
    ...defaultSettings,
    ...raw.settings,
    unitRatesGBP: {
      ...defaultSettings.unitRatesGBP,
      ...(raw.settings?.unitRatesGBP ?? {})
    }
  };

  const workMap = new Map<string, WorkItem>();
  for (const item of defaultVisibleItems()) workMap.set(item.id, cloneWorkItem(item));
  for (const item of raw.workItems ?? []) {
    const moduleItem = item.moduleId ? moduleById.get(item.moduleId)?.items.find((w) => w.id === item.id) : undefined;
    const catalogItem = moduleItemById.get(item.id);
    const catalogItemByName = moduleItemByName.get((item.name ?? "").trim().toLowerCase());
    const merged = moduleItem ? { ...moduleItem, ...item } : { ...item };
    let scope = merged.scope ?? inferModuleScope(merged.moduleId) ?? "room";
    let moduleId = merged.moduleId;

    // Keep built-in template lines aligned with their canonical scope/module.
    // This fixes legacy data where project-wide lines were saved as room lines.
    if (catalogItem) {
      const canonicalScope = catalogItem.scope ?? "room";
      scope = canonicalScope;
      if (canonicalScope === "project" && catalogItem.moduleId) {
        moduleId = catalogItem.moduleId;
      }
    }

    // Also repair renamed IDs of built-in project-wide lines by matching unique names.
    if (!catalogItem && catalogItemByName && (catalogItemByName.scope ?? "room") === "project") {
      scope = "project";
      moduleId = catalogItemByName.moduleId;
    }
    if (!catalogItem && !catalogItemByName && isLikelyProjectWideName(merged.name ?? "")) {
      scope = "project";
      moduleId = "site-overheads-setup";
    }

    workMap.set(item.id, { ...merged, moduleId, scope });
  }

  const sectionMap = new Map<string, ProjectSection>();
  for (const section of defaultSections) sectionMap.set(section.id, { ...section });
  for (const section of raw.sections ?? []) {
    sectionMap.set(section.id, { ...section });
  }
  const enablingSection = sectionMap.get("enabling-works");
  if (enablingSection && enablingSection.name === "Enabling Works") {
    sectionMap.set("enabling-works", { ...enablingSection, name: "Enabling works and Demolitions" });
  }
  for (const work of workMap.values()) {
    const sectionId = work.moduleId ?? "miscellaneous";
    if (!sectionMap.has(sectionId)) {
      sectionMap.set(sectionId, {
        id: sectionId,
        name: sectionId,
        order: 500
      });
    }
  }

  const legacySegments = (raw.extensionQuote as { wallSegmentsM?: number[] } | undefined)?.wallSegmentsM ?? [];
  const legacyFloorLength = legacySegments[0];
  const legacyFloorWidth = legacySegments[1];
  const legacyWallRuns = legacySegments.length ? legacySegments : defaultExtensionQuote.wallRunsM;

  return {
    ...raw,
    info: {
      ...defaultProjectInfo,
      ...(raw.info ?? {})
    },
    extensionQuote: {
      ...defaultExtensionQuote,
      ...(raw.extensionQuote ?? {}),
      floorLengthM: raw.extensionQuote?.floorLengthM ?? legacyFloorLength ?? defaultExtensionQuote.floorLengthM,
      floorWidthM: raw.extensionQuote?.floorWidthM ?? legacyFloorWidth ?? defaultExtensionQuote.floorWidthM,
      wallRunsM: raw.extensionQuote?.wallRunsM?.length ? [...raw.extensionQuote.wallRunsM] : [...legacyWallRuns],
      foundations: {
        ...defaultExtensionQuote.foundations,
        ...(raw.extensionQuote?.foundations ?? {})
      },
      rates: {
        ...defaultExtensionQuote.rates,
        ...(raw.extensionQuote?.rates ?? {})
      },
      roof: {
        ...defaultExtensionQuote.roof,
        ...(raw.extensionQuote?.roof ?? {}),
        flatFinish: raw.extensionQuote?.roof?.flatFinish ?? defaultExtensionQuote.roof.flatFinish,
        slopingFinish: raw.extensionQuote?.roof?.slopingFinish ?? defaultExtensionQuote.roof.slopingFinish,
        roofLights: raw.extensionQuote?.roof?.roofLights?.length
          ? raw.extensionQuote.roof.roofLights.map((r) => ({ ...r }))
          : defaultExtensionQuote.roof.roofLights.map((r) => ({ ...r }))
      },
      structure: {
        ...defaultExtensionQuote.structure,
        ...(raw.extensionQuote?.structure ?? {})
      },
      addons: raw.extensionQuote?.addons?.length
        ? raw.extensionQuote.addons.map((a) => ({ ...a }))
        : defaultExtensionQuote.addons.map((a) => ({ ...a }))
    },
    extensionTemplates: raw.extensionTemplates?.length
      ? raw.extensionTemplates.map((t) => ({
        ...t,
        quote: cloneExtensionQuote({
          ...defaultExtensionQuote,
          ...t.quote,
          wallRunsM: t.quote?.wallRunsM?.length ? [...t.quote.wallRunsM] : [...defaultExtensionQuote.wallRunsM],
          foundations: { ...defaultExtensionQuote.foundations, ...(t.quote?.foundations ?? {}) },
          walls: { ...defaultExtensionQuote.walls, ...(t.quote?.walls ?? {}) },
          rates: { ...defaultExtensionQuote.rates, ...(t.quote?.rates ?? {}) },
          roof: {
            ...defaultExtensionQuote.roof,
            ...(t.quote?.roof ?? {}),
            roofLights: t.quote?.roof?.roofLights?.length
              ? t.quote.roof.roofLights.map((r) => ({ ...r }))
              : defaultExtensionQuote.roof.roofLights.map((r) => ({ ...r }))
          },
          structure: { ...defaultExtensionQuote.structure, ...(t.quote?.structure ?? {}) },
          addons: t.quote?.addons?.length
            ? t.quote.addons.map((a) => ({ ...a }))
            : defaultExtensionQuote.addons.map((a) => ({ ...a }))
        })
      }))
      : defaultExtensionTemplates.map((t) => ({ ...t, quote: cloneExtensionQuote(t.quote) })),
    projectTemplates: raw.projectTemplates ?? [],
    settings: mergedSettings,
    rooms: (raw.rooms ?? []).map((room) => ({ ...room, level: normalizeLevel(room.level) })),
    sections: Array.from(sectionMap.values()),
    workItems: Array.from(workMap.values()),
    selections: raw.selections ?? []
  };
};

export const createInitialProject = (): ProjectData => {
  const rooms = sampleRooms.map((r) => ({ ...r }));
  return {
    info: { ...defaultProjectInfo },
    extensionQuote: {
      ...cloneExtensionQuote(defaultExtensionQuote)
    },
    extensionTemplates: defaultExtensionTemplates.map((t) => ({ ...t, quote: cloneExtensionQuote(t.quote) })),
    projectTemplates: [],
    settings: { ...defaultSettings, unitRatesGBP: { ...defaultSettings.unitRatesGBP } },
    rooms,
    sections: defaultSections.map((s) => ({ ...s })),
    workItems: defaultVisibleItems(),
    selections: []
  };
};
