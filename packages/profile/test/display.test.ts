import { describe, expect, it } from "vitest";

import { neighbourOrder } from "../src/display.js";
import { loadDefaultProfile, resolveProfile } from "../src/load.js";

const profile = loadDefaultProfile();

describe("neighbourOrder", () => {
  it("declares, per entity type, the priority order of neighbour types in the panel", () => {
    expect(neighbourOrder(profile, "api")).toEqual([
      "endpoint",
      "screen",
      "business_object",
      "rule",
      "decision",
    ]);
    expect(neighbourOrder(profile, "screen")).toEqual([
      "business_object",
      "data_object",
      "screen",
      "api",
      "rule",
      "process",
    ]);
    expect(neighbourOrder(profile, "rule")).toEqual([
      "screen",
      "process",
      "api",
      "business_object",
      "decision",
    ]);
  });

  it("lists first, on a rule, every type its applies_to attribute targets", () => {
    const targets = profile.types["rule"]?.attributes?.["applies_to"]?.target;
    expect(Array.isArray(targets)).toBe(true);
    const order = neighbourOrder(profile, "rule");
    const leading = order.slice(0, Array.isArray(targets) ? targets.length : 0);
    expect([...leading].sort()).toEqual([...(Array.isArray(targets) ? targets : [])].sort());
  });

  it("is empty for a type without a declaration and for a type unknown to the profile", () => {
    expect(profile.types["domain"]?.display?.neighbours_order).toBeUndefined();
    expect(neighbourOrder(profile, "domain")).toEqual([]);
    expect(neighbourOrder(profile, "keyword")).toEqual([]);
  });

  it("returns a copy the caller may sort without touching the frozen profile", () => {
    const order = neighbourOrder(profile, "api");
    order.sort();
    expect(neighbourOrder(profile, "api")[0]).toBe("endpoint");
  });

  it("follows the order a project profile replaces", () => {
    const resolved = resolveProfile(
      "types:\n  api:\n    display:\n      neighbours_order: [decision, endpoint]\n",
    );
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(neighbourOrder(resolved.profile, "api")).toEqual(["decision", "endpoint"]);
    }
  });
});
