import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultExtensionQuote } from "../src/data/defaults";
import { calculateExtensionQuote } from "../src/lib/extensionCalculations";

describe("calculateExtensionQuote", () => {
  it("derives geometry and totals", () => {
    const result = calculateExtensionQuote(defaultExtensionQuote);

    assert.equal(result.perimeterM, 11);
    assert.equal(result.wallAreaGrossM2, 35.2);
    assert.equal(result.wallAreaNetM2, 27.52);
    assert.equal(result.floorAreaM2, 15);
    assert.equal(result.trenchVolumeM3, 6.6);
    assert.ok(result.directCost > 0);
    assert.ok(result.clientPrice > result.subcontractorPrice);
  });

  it("adds second goalpost when two openings are present", () => {
    const twoOpenings = calculateExtensionQuote({
      ...defaultExtensionQuote,
      openingToHouseM: 2.4,
      openingToGardenM: 2
    });

    const oneOpening = calculateExtensionQuote({
      ...defaultExtensionQuote,
      openingToHouseM: 2.4,
      openingToGardenM: 0
    });

    assert.ok(twoOpenings.structuralCost > oneOpening.structuralCost);
  });
});
