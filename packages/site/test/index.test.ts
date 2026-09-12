import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/site", () => {
  it("exposes the slots, the default theme, the islands, the renderer, the stylesheet, the budget, the gallery and the accessibility checker", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "A11Y_RULES",
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
      "componentsStylesheet",
      "defaultComponents",
      "defaultIslands",
      "defaultTheme",
      "directionOf",
      "formatKilobytes",
      "galleryFixtures",
      "galleryPages",
      "importThemeModule",
      "isSlotName",
      "island",
      "islandsUsed",
      "measureBudget",
      "mountIslands",
      "packageRootOf",
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
