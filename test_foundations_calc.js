// Test foundations calculation with user's example
const perimeter = 11;
const skipCostPerLM = 60;
const concreteCostPerM3 = 115;
const concretePumpDeliveryFixedGBP = 400;
const handDigDaysPerLM = 3 / 11;
const handDigDailyRateGBP = 500;
const miniDiggerCostPerWeek = 240;
const miniDiggerDaysRequired = 3;

const round2 = (n) => Math.round(n * 100) / 100;

// Volumes
const trenchVolumeM3 = round2(perimeter * 0.6 * 1.0);

// Hand-dig option
const skipCost = perimeter * skipCostPerLM;
const concreteCost = round2(trenchVolumeM3 * concreteCostPerM3 + concretePumpDeliveryFixedGBP);
const daysRequired = round2(perimeter * handDigDaysPerLM);
const labourCostHandDig = round2(daysRequired * handDigDailyRateGBP);
const totalCostHandDig = round2(skipCost + concreteCost + labourCostHandDig);

// Mini-digger option
const labourCostMiniDigger = round2(miniDiggerCostPerWeek * (miniDiggerDaysRequired / 7));
const totalCostMiniDigger = round2(skipCost + concreteCost + labourCostMiniDigger);

console.log("=== HAND-DIG (11 lm) ===");
console.log(`Trench volume: ${trenchVolumeM3} m³`);
console.log(`Skip cost (£60/lm): £${skipCost}`);
console.log(`Concrete cost (£115/m3 + £400 fixed): £${concreteCost}`);
console.log(`Labour (${daysRequired} days × £${handDigDailyRateGBP}/day): £${labourCostHandDig}`);
console.log(`TOTAL: £${totalCostHandDig}`);
console.log(`Per LM: £${round2(totalCostHandDig / perimeter)}`);

console.log("\n=== MINI-DIGGER (11 lm) ===");
console.log(`Labour (3 days ÷ 7 × £240): £${labourCostMiniDigger}`);
console.log(`TOTAL: £${totalCostMiniDigger}`);
console.log(`Per LM: £${round2(totalCostMiniDigger / perimeter)}`);
console.log(`SAVINGS: £${totalCostHandDig - totalCostMiniDigger}`);
