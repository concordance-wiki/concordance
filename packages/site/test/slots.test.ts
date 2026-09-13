import { describe, expect, it } from "vitest";

import { PART_NAMES, SLOT_NAMES, isSlotName, parseComponentName } from "../src/slots.js";
import { defaultComponents } from "../src/theme/default/index.js";

describe("slots", () => {
  it("names the fourteen slots of the site, chrome first, then pages, then panels, the spaces pages and the category list last", () => {
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
      "Spaces",
      "Space",
      "CategoryList",
    ]);
  });

  it("recognises a slot name and rejects any other string", () => {
    expect(isSlotName("Footer")).toBe(true);
    expect(isSlotName("footer")).toBe(false);
  });

  it("names the two parts of an entity page a theme or a type module may render", () => {
    expect(PART_NAMES).toEqual(["Attribute", "Section"]);
  });

  it("reads a component name as a slot, the page of a type, an attribute or a section, and nothing else", () => {
    expect(parseComponentName("Footer")).toEqual({ kind: "slot", slot: "Footer" });
    expect(parseComponentName("EntityPage@runbook")).toEqual({ kind: "page", type: "runbook" });
    expect(parseComponentName("Attribute@url_pattern")).toEqual({
      kind: "attribute",
      name: "url_pattern",
    });
    expect(parseComponentName("Section@steps")).toEqual({ kind: "section", key: "steps" });
    for (const name of [
      "Sidebar",
      "footer",
      "Footer@runbook",
      "EntityPage@Run",
      "Attribute@",
      "@steps",
    ]) {
      expect(parseComponentName(name), name).toBeUndefined();
    }
  });

  it("has a default component for every slot and nothing else", () => {
    expect(Object.keys(defaultComponents)).toEqual([...SLOT_NAMES]);
    for (const slot of SLOT_NAMES) {
      expect(typeof defaultComponents[slot]).toBe("function");
    }
  });
});
