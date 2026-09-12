import { describe, expect, it } from "vitest";

import { loadDefaultProfile, resolveProfile } from "../src/load.js";
import { allowedRelations, singleRelation } from "../src/relations.js";

const profile = loadDefaultProfile();

describe("allowedRelations", () => {
  it("returns the relations whose pairs name the two types, sorted", () => {
    expect(allowedRelations(profile, "api", "screen")).toEqual(["related", "serves"]);
    expect(allowedRelations(profile, "screen", "business_object")).toEqual(["accesses", "related"]);
  });

  it("matches any type with the any end and equal types with the same end", () => {
    expect(allowedRelations(profile, "term", "term")).toEqual([
      "related",
      "specializes",
      "supersedes",
    ]);
    expect(allowedRelations(profile, "decision", "term")).toEqual(["affects", "related"]);
    expect(allowedRelations(profile, "screen", "term")).toEqual(["related"]);
  });

  it("never matches an entity with the type end", () => {
    expect(allowedRelations(profile, "standard", "type")).toEqual(["related"]);
    expect(allowedRelations(profile, "standard", "screen")).toEqual(["related"]);
  });

  it("returns the relation a project profile allows on a new pair", () => {
    const resolved = resolveProfile(
      "relations:\n  constrains:\n    allowed: [[regulation, process]]\ntypes:\n  regulation: { label: { en: Regulation }, group: motivation }\n",
    );
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(allowedRelations(resolved.profile, "regulation", "process")).toEqual([
        "constrains",
        "related",
      ]);
      expect(allowedRelations(profile, "regulation", "process")).toEqual(["related"]);
    }
  });
});

describe("singleRelation", () => {
  it("returns the only relation a pair of types admits besides the universal ones", () => {
    expect(singleRelation(profile, "screen", "business_object")).toBe("accesses");
    expect(singleRelation(profile, "term", "term")).toBe("specializes");
    expect(singleRelation(profile, "api", "screen")).toBe("serves");
    expect(singleRelation(profile, "decision", "screen")).toBe("affects");
  });

  it("returns nothing when the pair admits no relation or more than one", () => {
    expect(singleRelation(profile, "screen", "term")).toBeUndefined();
    expect(singleRelation(profile, "process", "channel")).toBeUndefined();
    expect(allowedRelations(profile, "process", "channel")).toEqual([
      "publishes",
      "related",
      "subscribes",
    ]);
  });
});
