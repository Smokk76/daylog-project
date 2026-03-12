import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeRoom, summaryTotals } from "../src/lib/calculations";
import { defaultSettings, defaultWorkItems } from "../src/data/defaults";

describe("computeRoom", () => {
  it("derives areas from dimensions and height", () => {
    const room = {
      id: "r1",
      name: "Bed1",
      level: "First Floor" as const,
      lengthM: 4,
      widthM: 3,
      doorCount: 1,
      excludeFromTotals: false
    };

    const computed = computeRoom(room, defaultSettings);

    assert.equal(computed.floorAreaM2, 12);
    assert.equal(computed.ceilingAreaM2, 12);
    assert.equal(computed.perimeterM, 14);
    assert.equal(computed.wallAreaM2, 35);
    assert.equal(computed.skirtingLM, 14);
    assert.equal(computed.architraveLM, 5);
  });

  it("uses overrides when set", () => {
    const room = {
      id: "r2",
      name: "Bed2",
      level: "First Floor" as const,
      lengthM: 4,
      widthM: 3,
      manualFloorAreaM2: 20,
      manualCeilingAreaM2: 19,
      manualWallAreaM2: 44,
      manualSkirtingLM: 12,
      manualArchitraveLM: 9,
      doorCount: 2,
      excludeFromTotals: false
    };

    const computed = computeRoom(room, defaultSettings);

    assert.equal(computed.floorAreaM2, 20);
    assert.equal(computed.ceilingAreaM2, 19);
    assert.equal(computed.wallAreaM2, 44);
    assert.equal(computed.skirtingLM, 12);
    assert.equal(computed.architraveLM, 9);
  });
});

describe("summary totals", () => {
  it("computes grand total and man-days excluding excluded rooms", () => {
    const dayRate = 185;
    const lineItems = [
      {
        workItemId: defaultWorkItems[0].id,
        roomId: "r1",
        category: "Flooring" as const,
        workName: defaultWorkItems[0].name,
        unit: "m2",
        qty: 10,
        rate: 6,
        lineTotal: 60,
        done: false,
        notes: "",
        excluded: false
      },
      {
        workItemId: defaultWorkItems[1].id,
        roomId: "r2",
        category: "Flooring" as const,
        workName: defaultWorkItems[1].name,
        unit: "m2",
        qty: 5,
        rate: 8,
        lineTotal: 40,
        done: false,
        notes: "",
        excluded: true
      }
    ];

    const result = summaryTotals(lineItems, dayRate);

    assert.equal(result.grandTotal, 60);
    assert.equal(result.manDays, 0.32);
    assert.equal(result.byCategory.get("Flooring"), 60);
  });
});
