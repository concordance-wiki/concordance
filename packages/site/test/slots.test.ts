import { describe, expect, it } from "vitest";

import { SLOT_NAMES, isSlotName } from "../src/slots.js";
import { defaultComponents } from "../src/theme/default/index.js";

describe("slots", () => {
  it("names the eleven slots of the site, chrome first, then pages, then panels", () => {
    expect(SLOT_NAMES).toEqual([
      "Shell",
      "Header",
      "Footer",
      "Home",
      "EntityPage",
      "KeywordPage",
      "MentionsPanel",
      "Neighbourhood",
      "SearchResults",
      "Index",
      "Todo",
    ]);
  });

  it("recognises a slot name and rejects any other string", () => {
    expect(isSlotName("Footer")).toBe(true);
    expect(isSlotName("footer")).toBe(false);
  });

  it("has a default component for every slot and nothing else", () => {
    expect(Object.keys(defaultComponents)).toEqual([...SLOT_NAMES]);
    for (const slot of SLOT_NAMES) {
      expect(typeof defaultComponents[slot]).toBe("function");
    }
  });
});
