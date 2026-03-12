import { ExtensionAddon, ExtensionQuote } from "../types";

const round2 = (n: number): number => Math.round(n * 100) / 100;
const nonNeg = (n?: number): number => (n === undefined || Number.isNaN(n) ? 0 : Math.max(0, n));

const slopingFinishFactor: Record<ExtensionQuote["roof"]["slopingFinish"], number> = {
  slates: 1.05,
  tiles: 1,
  zinc: 1.2,
  other: 1
};
const flatFinishFactor: Record<ExtensionQuote["roof"]["flatFinish"], number> = {
  tiles: 1.1,
  grp: 1,
  zinc: 1.25,
  felt: 0.9,
  other: 1
};

export interface FoundationsBreakdown {
  skipCost: number;
  concreteCost: number;
  labourCost: number;
  labourMethod: string;
}

export interface WallBreakdown {
  underDpcLength: number;
  underDpcCost: number;
  aboveDpcArea: number;
  aboveDpcCost: number;
}

export interface ExtensionCategoryRow {
  category: string;
  materials: number;
  labour: number;
  totalCost: number;
}

export interface ExtensionSummary {
  perimeterM: number;
  wallAreaGrossM2: number;
  wallAreaNetM2: number;
  floorAreaM2: number;
  trenchVolumeM3: number;
  roofLightCost: number;
  structuralCost: number;
  addonsTotal: number;
  categories: ExtensionCategoryRow[];
  materialsTotal: number;
  labourTotal: number;
  directCost: number;
  overhead: number;
  profit: number;
  subcontractorPrice: number;
  mainOverhead: number;
  mainProfit: number;
  clientPrice: number;
  foundationsBreakdown: FoundationsBreakdown;
  wallBreakdown: WallBreakdown;
}

const splitLabourMaterial = (total: number, labourPct: number) => {
  const labour = round2(total * nonNeg(labourPct) / 100);
  const materials = round2(total - labour);
  return { labour, materials };
};

const addonTotal = (addon: ExtensionAddon) => round2(nonNeg(addon.qty) * nonNeg(addon.unitCostGBP));

export const calculateExtensionQuote = (quote: ExtensionQuote): ExtensionSummary => {
  const perimeterM = round2((quote.wallRunsM ?? []).reduce((sum, length) => sum + nonNeg(length), 0));
  const wallHeightM = nonNeg(quote.wallHeightM) || 2.8;
  const wallAreaGrossM2 = round2(perimeterM * wallHeightM);

  // Only deduct opening to garden (opening to house is in existing wall, not extension)
  const openingsWidth = nonNeg(quote.openingToGardenM);
  const openingsArea = openingsWidth * wallHeightM;
  const wallAreaNetM2 = round2(Math.max(0, wallAreaGrossM2 - openingsArea));

  const defaultFloorArea = nonNeg(quote.floorLengthM) * nonNeg(quote.floorWidthM);
  const floorAreaM2 = round2(quote.floorAreaOverrideM2 !== undefined ? nonNeg(quote.floorAreaOverrideM2) : defaultFloorArea);

  const trenchVolumeM3 = round2(perimeterM * nonNeg(quote.foundations.trenchWidthM) * nonNeg(quote.foundations.trenchDepthM));

  // Foundations cost: skip + concrete + labour (per-LM breakdown)
  const skipCost = round2(perimeterM * nonNeg(quote.foundations.skipCostPerLM));
  const concreteCost = round2(trenchVolumeM3 * nonNeg(quote.foundations.concreteCostPerM3) + nonNeg(quote.foundations.concretePumpDeliveryFixedGBP));
  
  let labourCost: number;
  if (quote.foundations.labourMethod === "mini_digger") {
    labourCost = round2(nonNeg(quote.foundations.miniDiggerCostPerWeek) * (nonNeg(quote.foundations.miniDiggerDaysRequired) / 7));
  } else {
    // hand_dig_2people: labour per LM
    const daysRequired = round2(perimeterM * nonNeg(quote.foundations.handDigDaysPerLM));
    labourCost = round2(daysRequired * nonNeg(quote.foundations.handDigDailyRateGBP));
  }
  
  const foundationsCost = round2(skipCost + concreteCost + labourCost);

  // Split wall calculation: under DPC and above DPC (cavity)
  const underDpcHeightM = nonNeg(quote.walls.underDpcHeightM) || 1.0;
  const underDpcCost = round2(perimeterM * nonNeg(quote.walls.underDpcCostPerLM));
  
  const aboveDpcHeightM = wallHeightM - underDpcHeightM;
  const aboveDpcGrossArea = round2(perimeterM * aboveDpcHeightM);
  const aboveDpcOpeningsArea = nonNeg(quote.openingToGardenM) * aboveDpcHeightM;
  const aboveDpcNetArea = round2(Math.max(0, aboveDpcGrossArea - aboveDpcOpeningsArea));
  const aboveDpcCost = round2(aboveDpcNetArea * nonNeg(quote.walls.aboveDpcCostPerM2));
  
  const wallCost = round2(underDpcCost + aboveDpcCost);
  
  const floorCost = round2(floorAreaM2 * nonNeg(quote.rates.screedRatePerM2));

  const roofBaseRate = quote.roof.type === "sloping"
    ? nonNeg(quote.rates.slopingRoofRatePerM2) * slopingFinishFactor[quote.roof.slopingFinish]
    : nonNeg(quote.rates.roofBaseRatePerM2) * flatFinishFactor[quote.roof.flatFinish];
  const roofBaseCost = round2(floorAreaM2 * roofBaseRate);
  const roofLightCost = round2((quote.roof.roofLights ?? []).reduce((sum, rl) => sum + nonNeg(rl.qty) * nonNeg(rl.unitCostGBP), 0));
  const roofCost = round2(roofBaseCost + roofLightCost);

  const steelRate = quote.structure.steelPricePerMOverride !== undefined ? nonNeg(quote.structure.steelPricePerMOverride) : nonNeg(quote.rates.steelPricePerM);
  const steelCost = round2(nonNeg(quote.structure.steelLengthM) * steelRate);
  const goalpostBase = nonNeg(quote.rates.goalpostAllowanceGBP);
  const secondGoalpost = nonNeg(quote.openingToGardenM) > 0
    ? nonNeg(quote.rates.secondGoalpostAllowanceGBP)
    : 0;
  const structuralCost = round2(steelCost + goalpostBase + secondGoalpost);

  const addonsTotal = round2((quote.addons ?? []).filter((a) => a.enabled).reduce((sum, a) => sum + addonTotal(a), 0));

  const foundationsSplit = splitLabourMaterial(foundationsCost, 40);
  const underDpcSplit = splitLabourMaterial(underDpcCost, 50);
  const aboveDpcSplit = splitLabourMaterial(aboveDpcCost, 45);
  const screedSplit = splitLabourMaterial(floorCost, nonNeg(quote.rates.screedLabourPct));
  const roofSplit = splitLabourMaterial(roofCost, 50);
  const structuralSplit = splitLabourMaterial(structuralCost, 55);
  const addonsSplit = splitLabourMaterial(addonsTotal, 50);

  const categories: ExtensionCategoryRow[] = [
    { category: "Foundations", materials: foundationsSplit.materials, labour: foundationsSplit.labour, totalCost: foundationsCost },
    { category: "Walls below DPC", materials: underDpcSplit.materials, labour: underDpcSplit.labour, totalCost: underDpcCost },
    { category: "Cavity walls above DPC", materials: aboveDpcSplit.materials, labour: aboveDpcSplit.labour, totalCost: aboveDpcCost },
    { category: "Floor", materials: screedSplit.materials, labour: screedSplit.labour, totalCost: floorCost },
    { category: "Roof", materials: roofSplit.materials, labour: roofSplit.labour, totalCost: roofCost },
    { category: "Structural openings", materials: structuralSplit.materials, labour: structuralSplit.labour, totalCost: structuralCost },
    { category: "Add-ons", materials: addonsSplit.materials, labour: addonsSplit.labour, totalCost: addonsTotal }
  ];

  const materialsTotal = round2(categories.reduce((sum, c) => sum + c.materials, 0));
  const labourTotal = round2(categories.reduce((sum, c) => sum + c.labour, 0));
  const directCost = round2(categories.reduce((sum, c) => sum + c.totalCost, 0));
  const overhead = round2(directCost * nonNeg(quote.overheadPct) / 100);
  const subcontractorPrice = round2(directCost + overhead);
  const profit = round2(subcontractorPrice * nonNeg(quote.profitPct) / 100);
  // Main contractor level (applied on top of subcontractor price)
  const mainOverhead = round2(subcontractorPrice * nonNeg(quote.mainOverheadPct) / 100);
  const mainProfit = round2((subcontractorPrice + mainOverhead) * nonNeg(quote.mainProfitPct) / 100);
  const clientPrice = round2(subcontractorPrice + mainOverhead + mainProfit + profit);

  return {
    perimeterM,
    wallAreaGrossM2,
    wallAreaNetM2,
    floorAreaM2,
    trenchVolumeM3,
    roofLightCost,
    structuralCost,
    addonsTotal,
    categories,
    materialsTotal,
    labourTotal,
    directCost,
    overhead,
    profit,
    subcontractorPrice,
    mainOverhead,
    mainProfit,
    clientPrice,
    foundationsBreakdown: {
      skipCost,
      concreteCost,
      labourCost,
      labourMethod: quote.foundations.labourMethod
    },
    wallBreakdown: {
      underDpcLength: perimeterM,
      underDpcCost,
      aboveDpcArea: aboveDpcNetArea,
      aboveDpcCost
    }
  };
};
