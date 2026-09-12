import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/site", () => {
  it("exposes the slots, the default theme, the islands, the renderer, the stylesheet and the budget", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CSS_LAYERS",
      "ISLAND_ELEMENT",
      "SLOT_NAMES",
      "ThemeContext",
      "ThemeResolutionError",
      "baseStylesheet",
      "bundleIslands",
      "componentsStylesheet",
      "defaultComponents",
      "defaultIslands",
      "defaultTheme",
      "directionOf",
      "formatKilobytes",
      "importThemeModule",
      "isSlotName",
      "island",
      "islandsUsed",
      "measureBudget",
      "mountIslands",
      "packageRootOf",
      "renderPage",
      "renderSlot",
      "resolveTheme",
      "siteStylesheet",
      "tokensStylesheet",
      "useSlot",
    ]);
  });
});
