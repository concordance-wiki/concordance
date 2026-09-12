import { loadDefaultProfile, type TypeDefinition } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { foldHeading, mappedSection } from "../../src/mentions/sections.js";

const profile = loadDefaultProfile();

function typeOf(slug: string): TypeDefinition {
  const type = profile.types[slug];
  if (type === undefined) throw new Error(`the default profile declares ${slug}`);
  return type;
}

describe("foldHeading", () => {
  it("folds accents, lower-cases, trims and collapses whitespace", () => {
    expect(foldHeading("  S'applique   À \t")).toBe("s'applique a");
    expect(foldHeading("Étapes")).toBe("etapes");
    expect(foldHeading("OBJECTS")).toBe("objects");
  });

  it("leaves a plain lower-case heading unchanged", () => {
    expect(foldHeading("objects")).toBe("objects");
  });
});

describe("mappedSection", () => {
  it("maps a heading written as the label of the profile to its section and relation", () => {
    expect(mappedSection("Objects", typeOf("screen"))).toEqual({
      name: "objects",
      definition: {
        heading: { en: "Objects", fr: "Objets" },
        parse: "bullet-list",
        produces: "accesses",
      },
    });
  });

  it.each(["Objets", "OBJECTS", "objets", " Objects ", "objects"])(
    "section heading matching is case- and accent-insensitive and accepts the labels of every profile locale: %j maps to objects",
    (heading) => {
      expect(mappedSection(heading, typeOf("screen"))?.name).toBe("objects");
    },
  );

  it("matches an accented label whatever the accent of the heading", () => {
    expect(mappedSection("regles", typeOf("screen"))?.name).toBe("rules");
    expect(mappedSection("Règles", typeOf("screen"))?.name).toBe("rules");
    expect(mappedSection("S'APPLIQUE A", typeOf("rule"))?.name).toBe("applies_to");
  });

  it("accepts the section key itself as a heading", () => {
    expect(mappedSection("applies_to", typeOf("rule"))?.name).toBe("applies_to");
  });

  it("does not map a heading of another type's vocabulary", () => {
    expect(mappedSection("Objects", typeOf("rule"))).toBeUndefined();
    expect(mappedSection("Applies to", typeOf("screen"))).toBeUndefined();
  });

  it("maps nothing for a type without sections", () => {
    expect(mappedSection("Objects", typeOf("term"))).toBeUndefined();
  });

  it("does not match a heading that only contains the label", () => {
    expect(mappedSection("Objects and more", typeOf("screen"))).toBeUndefined();
  });

  it("keeps the inverse flag and the attributes of the section definition", () => {
    expect(mappedSection("Rules", typeOf("screen"))?.definition.inverse).toBe(true);
    expect(mappedSection("Writes", typeOf("batch"))?.definition.attributes).toEqual({
      mode: "write",
    });
  });

  it("matches a section whose label exists in a single locale", () => {
    const type: TypeDefinition = {
      label: { en: "Widget" },
      group: "business",
      sections: { parts: { heading: { en: "Parts" }, parse: "bullet-list", produces: "related" } },
    };
    expect(mappedSection("parts", type)?.name).toBe("parts");
    expect(mappedSection("Parties", type)).toBeUndefined();
  });
});
