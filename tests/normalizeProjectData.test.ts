import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInitialProject, normalizeProjectData } from "../src/data/defaults";

describe("normalizeProjectData scope defaults", () => {
  it("keeps site overhead lines as project scope when legacy scope is missing", () => {
    const project = createInitialProject();
    const legacy = {
      ...project,
      workItems: project.workItems.map((item) =>
        item.id === "portable-toilet" ? { ...item, scope: undefined } : item
      )
    };

    const normalized = normalizeProjectData(legacy);
    const portableToilet = normalized.workItems.find((item) => item.id === "portable-toilet");

    assert.equal(portableToilet?.scope, "project");
  });

  it("defaults room modules to room scope when missing", () => {
    const project = createInitialProject();
    const legacy = {
      ...project,
      workItems: project.workItems.map((item) =>
        item.id === "skim-plaster-walls" ? { ...item, scope: undefined } : item
      )
    };

    const normalized = normalizeProjectData(legacy);
    const skimWalls = normalized.workItems.find((item) => item.id === "skim-plaster-walls");

    assert.equal(skimWalls?.scope, "room");
  });

  it("repairs misplaced built-in project lines saved as room lines", () => {
    const project = createInitialProject();
    const broken = {
      ...project,
      workItems: project.workItems.map((item) =>
        item.id === "portable-toilet"
          ? { ...item, scope: "room" as const, moduleId: "enabling-works" }
          : item
      )
    };

    const normalized = normalizeProjectData(broken);
    const portableToilet = normalized.workItems.find((item) => item.id === "portable-toilet");

    assert.equal(portableToilet?.scope, "project");
    assert.equal(portableToilet?.moduleId, "site-overheads-setup");
  });

  it("repairs custom-id project lines when the name matches a built-in project line", () => {
    const project = createInitialProject();
    const broken = {
      ...project,
      workItems: project.workItems.map((item) =>
        item.id === "portable-toilet"
          ? { ...item, id: "custom-portable-toilet", scope: "room" as const, moduleId: "enabling-works" }
          : item
      )
    };

    const normalized = normalizeProjectData(broken);
    const portableToilet = normalized.workItems.find((item) => item.id === "custom-portable-toilet");

    assert.equal(portableToilet?.scope, "project");
    assert.equal(portableToilet?.moduleId, "site-overheads-setup");
  });

  it("moves profit-like room lines to project overheads section", () => {
    const project = createInitialProject();
    const withProfit = {
      ...project,
      workItems: [
        ...project.workItems,
        {
          id: "custom-profit-line",
          name: "Profit",
          unitType: "fixed" as const,
          defaultRateKey: "custom" as const,
          quantitySource: "manual" as const,
          allowManualQty: true,
          category: "Other" as const,
          scope: "room" as const,
          moduleId: "enabling-works",
          customRate: 0
        }
      ]
    };

    const normalized = normalizeProjectData(withProfit);
    const profit = normalized.workItems.find((item) => item.id === "custom-profit-line");

    assert.equal(profit?.scope, "project");
    assert.equal(profit?.moduleId, "site-overheads-setup");
  });
});
