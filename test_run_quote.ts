import { calculateExtensionQuote } from './src/lib/extensionCalculations';
import { defaultExtensionQuote } from './src/data/defaults';

const quote = { ...defaultExtensionQuote } as any;
quote.floorLengthM = 6;
quote.floorWidthM = 3;
quote.wallRunsM = [3, 6];
quote.wallHeightM = 2.8;
quote.openingToHouseM = 4.5;
quote.openingToGardenM = 4.5;
quote.foundations = {
  trenchWidthM: 0.6,
  trenchDepthM: 1.0,
  trenchFillRatePerM3: 190,
  skipCostPerLM: 60,
  concreteCostPerM3: 115,
  concretePumpDeliveryFixedGBP: 400,
  labourMethod: 'hand_dig_2people',
  handDigDaysPerLM: 3 / 11,
  handDigDailyRateGBP: 500,
  miniDiggerCostPerWeek: 240,
  miniDiggerDaysRequired: 3
};
quote.walls = {
  underDpcHeightM: 1.0,
  underDpcCostPerLM: 160,
  aboveDpcCostPerM2: 300
};
quote.rates = { ...quote.rates, screedRatePerM2: 360 };

// Addons from user input
quote.addons = [
  { id: 'bifold-install', name: 'Bifold/sliding door installation', unit: 'fixed', qty: 1, unitCostGBP: 2400, enabled: true },
  { id: 'adjacent-floor-upgrade', name: 'Adjacent room floor upgrade', unit: 'm2', qty: 10, unitCostGBP: 65, enabled: true },
  { id: 'underpinning', name: 'Underpinning', unit: 'lm', qty: 0, unitCostGBP: 1200, enabled: false },
  { id: 'parapet-walls', name: 'Parapet walls', unit: 'lm', qty: 0, unitCostGBP: 180, enabled: false },
  { id: 'cappings', name: 'Cappings', unit: 'lm', qty: 0, unitCostGBP: 95, enabled: false },
  { id: 'internal-gutter', name: 'Internal gutter', unit: 'fixed', qty: 1, unitCostGBP: 2000, enabled: true },
  { id: 'external-gutter', name: 'External gutter', unit: 'fixed', qty: 1, unitCostGBP: 600, enabled: true },
  { id: 'drainage', name: 'Drainage works', unit: 'fixed', qty: 1, unitCostGBP: 1500, enabled: true },
  { id: 'manhole-relocation', name: 'Manhole relocation', unit: 'each', qty: 0, unitCostGBP: 950, enabled: false },
  { id: 'gully-relocation', name: 'Rainwater gully relocation', unit: 'each', qty: 0, unitCostGBP: 200, enabled: false },
  { id: 'sloping-roof-conversion', name: 'Sloping roof conversion', unit: 'm2', qty: 0, unitCostGBP: 250, enabled: false },
  { id: 'additional-steels', name: 'Additional steels', unit: 'each', qty: 0, unitCostGBP: 1000, enabled: false }
];

const summary = calculateExtensionQuote(quote as any);

console.log('PerimeterM:', summary.perimeterM);
console.log('TrenchVolumeM3:', summary.trenchVolumeM3);
console.log('Foundations Breakdown:', summary.foundationsBreakdown);
console.log('Wall Breakdown:', summary.wallBreakdown);
console.log('Categories:');
summary.categories.forEach(c => console.log(`- ${c.category}: total £${c.totalCost}, materials £${c.materials}, labour £${c.labour}`));
console.log('Direct cost:', summary.directCost);
console.log('Subcontractor price (direct + overhead):', summary.subcontractorPrice);
console.log('Client price (with profit):', summary.clientPrice);
