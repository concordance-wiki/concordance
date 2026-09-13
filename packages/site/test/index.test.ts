import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/site", () => {
  it("exposes the slots, the default theme, the islands, the renderer, the stylesheet, the budget, the gallery, the accessibility checker and the contrast check", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "A11Y_RULES",
      "CONTRAST_MINIMUMS",
      "CSS_LAYERS",
      "GALLERY_PAGE_BUDGET",
      "ISLAND_ELEMENT",
      "SLOT_NAMES",
      "ThemeContext",
      "ThemeResolutionError",
      "baseStylesheet",
      "buildGallery",
      "bundleIslands",
      "checkAccessibility",
      "checkContrast",
      "componentsStylesheet",
      "contrastPairs",
      "contrastRatio",
      "defaultComponents",
      "defaultIslands",
      "defaultTheme",
      "directionOf",
      "formatKilobytes",
      "galleryDocuments",
      "galleryFixtures",
      "galleryPages",
      "importThemeModule",
      "isSlotName",
      "island",
      "islandsUsed",
      "measureBudget",
      "mountIslands",
      "packageRootOf",
      "relativeLuminance",
      "renderDocument",
      "renderPage",
      "renderSlot",
      "resolveTheme",
      "siteStylesheet",
      "tokensStylesheet",
      "useSlot",
    ]);
  });
});
