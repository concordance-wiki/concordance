import { describe, expect, it } from "vitest";

import {
  expectValid,
  fingerprintProfile,
  loadDefaultProfile,
  mergeProfiles,
  parseProfile,
  resolveProfile,
  validateProfile,
} from "../src/load.js";
import type { PartialProfile, Profile, ProfileIssue } from "../src/types.js";

const minimal: Profile = {
  version: 1,
  groups: { business: { label: { en: "Business" } } },
  types: {
    term: { label: { en: "Term" }, group: "business" },
    process: { label: { en: "Process" }, group: "business" },
  },
  relations: {
    related: { label: { en: "is related to" }, directed: false, allowed: [["any", "any"]] },
    specializes: { label: { en: "specializes" }, directed: true, allowed: [["term", "term"]] },
  },
  confidence: { explicit_link: 1 },
};

const regulationProfile = `
types:
  regulation:
    label: { en: Regulation, fr: Réglementation }
    group: motivation
    attributes:
      reference: { type: string }
    sections:
      applies_to:
        heading: { en: "Applies to", fr: "S'applique à" }
        parse: bullet-list
        produces: constrains
relations:
  constrains:
    allowed:
      - [regulation, process]
`;

function summarise(issues: ProfileIssue[]): Omit<ProfileIssue, "severity">[] {
  return issues.map(({ severity, ...rest }) => {
    expect(severity).toBe("error");
    return rest;
  });
}

function copy<T>(value: T): T {
  // A JSON round trip of a profile keeps every key, so the copy has the same type.
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("loadDefaultProfile", () => {
  it("loads the embedded default profile and validates it", () => {
    const profile = loadDefaultProfile();
    expect(profile.profile).toBe("default");
    expect(profile.version).toBe(1);
    expect(Object.keys(profile.types)).toHaveLength(35);
    expect(Object.keys(profile.relations)).toHaveLength(21);
    expect(validateProfile(profile)).toEqual({ ok: true, profile, issues: [] });
  });

  it("returns a frozen profile at every depth", () => {
    const profile = loadDefaultProfile();
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.types)).toBe(true);
    expect(Object.isFrozen(profile.types["screen"]?.attributes)).toBe(true);
    expect(Object.isFrozen(profile.relations["accesses"]?.allowed)).toBe(true);
    expect(Object.isFrozen(profile.relations["accesses"]?.allowed[0])).toBe(true);
  });

  it("keeps every planned type present but marked", () => {
    const profile = loadDefaultProfile();
    const planned = Object.entries(profile.types)
      .filter(([, type]) => type.status === "planned")
      .map(([slug]) => slug);
    expect(planned).toEqual([
      "actor",
      "application_event",
      "backlog_item",
      "business_event",
      "business_service",
      "channel",
      "constraint",
      "function",
      "gap",
      "goal",
      "message",
      "milestone",
      "plateau",
      "principle",
      "representation",
      "requirement",
      "standard",
      "test",
      "test_strategy",
      "work_package",
    ]);
    expect(planned).toHaveLength(20);
  });

  it("orders the keys of the embedded profile canonically", () => {
    const profile = loadDefaultProfile();
    expect(Object.keys(profile)).toEqual([
      "common_attributes",
      "confidence",
      "groups",
      "profile",
      "relations",
      "type_prefixes",
      "types",
      "version",
    ]);
    expect(Object.keys(profile.types).slice(0, 3)).toEqual(["actor", "api", "application"]);
  });

  it("throws with the issues when asked for a profile that failed validation", () => {
    const issues: ProfileIssue[] = [
      { severity: "error", path: "types", message: "required key is missing" },
      { severity: "error", path: "version", message: "value is not allowed" },
    ];
    expect(() => expectValid({ ok: false, issues })).toThrow(
      "default profile is invalid: types: required key is missing; version: value is not allowed",
    );
    expect(expectValid({ ok: true, profile: minimal, issues: [] })).toBe(minimal);
  });
});

describe("fingerprintProfile", () => {
  it("is stable across two loads of the default profile", () => {
    expect(fingerprintProfile(loadDefaultProfile())).toBe(fingerprintProfile(loadDefaultProfile()));
  });

  it("is a sha256 hex digest", () => {
    expect(fingerprintProfile(minimal)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not depend on the order of the keys", () => {
    const reordered: Profile = {
      confidence: { explicit_link: 1 },
      relations: {
        specializes: { allowed: [["term", "term"]], directed: true, label: { en: "specializes" } },
        related: { label: { en: "is related to" }, directed: false, allowed: [["any", "any"]] },
      },
      types: {
        process: { group: "business", label: { en: "Process" } },
        term: { label: { en: "Term" }, group: "business" },
      },
      groups: { business: { label: { en: "Business" } } },
      version: 1,
    };
    expect(fingerprintProfile(reordered)).toBe(fingerprintProfile(minimal));
  });

  it("changes when a key changes", () => {
    const changed = copy(minimal);
    changed.confidence.explicit_link = 0.99;
    expect(fingerprintProfile(changed)).not.toBe(fingerprintProfile(minimal));
  });
});

describe("mergeProfiles", () => {
  it("adds a type declared by the override", () => {
    const merged = mergeProfiles(minimal, {
      types: { rule: { label: { en: "Rule" }, group: "business" } },
    });
    expect(Object.keys(merged.types)).toEqual(["process", "rule", "term"]);
    expect(merged.types["rule"]).toEqual({ label: { en: "Rule" }, group: "business" });
    expect(merged.types["term"]).toEqual(minimal.types["term"]);
  });

  it("extends an attribute of an existing type without losing the others", () => {
    const base: Profile = copy(minimal);
    base.types["term"] = {
      label: { en: "Term" },
      group: "business",
      attributes: { definition: { type: "string" }, synonyms: { type: "string[]" } },
    };
    const merged = mergeProfiles(base, {
      types: {
        term: {
          label: { fr: "Terme" },
          attributes: { definition: { values: ["short", "long"] }, code: { type: "integer" } },
        },
      },
    });
    expect(merged.types["term"]).toEqual({
      label: { en: "Term", fr: "Terme" },
      group: "business",
      attributes: {
        code: { type: "integer" },
        definition: { type: "string", values: ["short", "long"] },
        synonyms: { type: "string[]" },
      },
    });
  });

  it("allows an existing relation on a new pair while keeping the base pairs, without duplicates", () => {
    const merged = mergeProfiles(minimal, {
      relations: {
        specializes: {
          allowed: [
            ["process", "process"],
            ["term", "term"],
            ["process", "process"],
          ],
        },
      },
    });
    expect(merged.relations["specializes"]).toEqual({
      label: { en: "specializes" },
      directed: true,
      allowed: [
        ["term", "term"],
        ["process", "process"],
      ],
    });
  });

  it("takes the pairs of the override when the base does not declare the relation", () => {
    const merged = mergeProfiles(minimal, {
      relations: {
        constrains: { label: { en: "constrains" }, directed: true, allowed: [["term", "process"]] },
      },
    });
    expect(merged.relations["constrains"]?.allowed).toEqual([["term", "process"]]);
  });

  it("replaces an array instead of concatenating it", () => {
    const base: Profile = copy(minimal);
    base.types["term"] = {
      label: { en: "Term" },
      group: "business",
      display: { highlight: ["aliases", "broader"] },
    };
    const merged = mergeProfiles(base, {
      types: { term: { display: { highlight: ["definition"] } } },
    });
    expect(merged.types["term"]?.display).toEqual({ highlight: ["definition"] });
  });

  it("replaces a scalar and an object with a scalar", () => {
    const merged = mergeProfiles(minimal, {
      profile: "project",
      confidence: { explicit_link: 0.5 },
    });
    expect(merged.profile).toBe("project");
    expect(merged.confidence).toEqual({ explicit_link: 0.5 });
  });

  it("sorts the keys of the result at every depth", () => {
    const merged = mergeProfiles(minimal, {
      types: { alpha: { label: { fr: "Alpha", en: "Alpha" }, group: "business" } },
    });
    expect(Object.keys(merged)).toEqual(["confidence", "groups", "relations", "types", "version"]);
    expect(Object.keys(merged.types)).toEqual(["alpha", "process", "term"]);
    expect(Object.keys(merged.types["alpha"]?.label ?? {})).toEqual(["en", "fr"]);
  });

  it("does not mutate its inputs", () => {
    const base = copy(minimal);
    const override: PartialProfile = {
      types: { rule: { label: { en: "Rule" }, group: "business" } },
      relations: { specializes: { allowed: [["process", "process"]] } },
    };
    const overrideBefore = copy(override);
    const merged = mergeProfiles(base, override);
    expect(base).toEqual(minimal);
    expect(override).toEqual(overrideBefore);
    expect(merged.types["rule"]).not.toBe(override.types?.["rule"]);
    expect(merged.relations["specializes"]?.allowed).not.toBe(
      base.relations["specializes"]?.allowed,
    );
  });
});

describe("validateProfile", () => {
  it("accepts a minimal profile and returns it typed", () => {
    expect(validateProfile(minimal)).toEqual({ ok: true, profile: minimal, issues: [] });
  });

  it("accepts a profile without groups", () => {
    const { types, relations, confidence } = minimal;
    expect(validateProfile({ version: 1, types, relations, confidence }).ok).toBe(true);
  });

  it("reports a wrong type definition with its path, message and expectation", () => {
    const document = {
      ...minimal,
      types: { ...minimal.types, rule: { label: "Rule", group: "business", glyph: 3 } },
    };
    const result = validateProfile(document);
    expect(result.ok).toBe(false);
    expect(summarise(result.issues)).toEqual([
      { path: "types.rule.label", message: "wrong type", received: "Rule", expected: "object" },
      { path: "types.rule.glyph", message: "wrong type", received: 3, expected: "string" },
    ]);
  });

  it("reports a missing key, an unknown key, a bad enumeration value and a bad slug", () => {
    const document = {
      ...minimal,
      types: {
        term: { label: { en: "Term" }, colour: "red", attributes: { code: { type: "text" } } },
        "Bad Slug": { label: { en: "Bad" }, group: "business" },
      },
    };
    const result = validateProfile(document);
    expect(result.ok).toBe(false);
    expect(summarise(result.issues)).toEqual([
      {
        path: "types.Bad Slug",
        message: "key is not allowed",
        received: "Bad Slug",
        expected: "a value matching ^[a-z][a-z0-9_]*$",
      },
      { path: "types.term.group", message: "required key is missing" },
      { path: "types.term.colour", message: "unknown key", expected: "one of the documented keys" },
      {
        path: "types.term.attributes.code.type",
        message: "value is not allowed",
        received: "text",
        expected:
          'one of "string", "string[]", "integer", "number", "boolean", "date", "enum", "ref", "ref[]", "list"',
      },
    ]);
  });

  it("accepts type prefixes for any language tag and rejects a key that is not one", () => {
    expect(validateProfile({ ...minimal, type_prefixes: { de: { term: ["term"] } } }).ok).toBe(
      true,
    );
    const result = validateProfile({ ...minimal, type_prefixes: { German: { term: ["term"] } } });
    expect(summarise(result.issues).map((issue) => issue.path)).toEqual(["type_prefixes.German"]);
  });

  it("reports an attribute target that is neither a slug nor a list once, without the branch details", () => {
    const document = {
      ...minimal,
      common_attributes: { owner: { type: "ref", target: 42 } },
    };
    const result = validateProfile(document);
    expect(summarise(result.issues)).toEqual([
      {
        path: "common_attributes.owner.target",
        message: "value matches none of the accepted shapes",
        received: 42,
      },
    ]);
  });

  it("reports a relation without any allowed pair and a confidence out of range", () => {
    const document = {
      ...minimal,
      relations: {
        ...minimal.relations,
        empty: { label: { en: "e" }, directed: true, allowed: [] },
      },
      confidence: { explicit_link: 1.5 },
    };
    expect(summarise(validateProfile(document).issues)).toEqual([
      {
        path: "relations.empty.allowed",
        message: "must NOT have fewer than 1 items",
        received: [],
      },
      { path: "confidence.explicit_link", message: "must be <= 1", received: 1.5 },
    ]);
  });

  it("reports a type whose group is not declared", () => {
    const document = {
      ...minimal,
      types: { ...minimal.types, rule: { label: { en: "Rule" }, group: "motivation" } },
    };
    expect(validateProfile(document)).toEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          path: "types.rule.group",
          message: "group is not declared",
          received: "motivation",
          expected: 'one of "business"',
        },
      ],
    });
  });

  it("reports an attribute or a mapped section naming a relation that is not declared", () => {
    const document = {
      ...minimal,
      types: {
        ...minimal.types,
        rule: {
          label: { en: "Rule" },
          group: "business",
          attributes: {
            applies_to: { type: "ref[]", target: "process", relation: "constrains" },
            severity: { type: "string" },
          },
          sections: {
            applies_to: { heading: { en: "Applies to" }, parse: "bullet-list", produces: "limits" },
            steps: { heading: { en: "Steps" }, parse: "ordered-list", produces: "related" },
          },
        },
      },
    };
    expect(summarise(validateProfile(document).issues)).toEqual([
      {
        path: "types.rule.attributes.applies_to.relation",
        message: "relation is not declared",
        received: "constrains",
        expected: 'one of "related", "specializes"',
      },
      {
        path: "types.rule.sections.applies_to.produces",
        message: "relation is not declared",
        received: "limits",
        expected: 'one of "related", "specializes"',
      },
    ]);
  });

  it("reports an allowed pair naming a type that is not declared, accepting the wildcards", () => {
    const document = {
      ...minimal,
      relations: {
        ...minimal.relations,
        applies_to: {
          label: { en: "applies to" },
          directed: true,
          allowed: [
            ["standard", "type"],
            ["any", "same"],
            ["term", "regulation"],
          ],
        },
      },
    };
    expect(summarise(validateProfile(document).issues)).toEqual([
      {
        path: "relations.applies_to.allowed[0][0]",
        message: "type is not declared",
        received: "standard",
        expected: 'a declared type, "any", "same" or "type"',
      },
      {
        path: "relations.applies_to.allowed[2][1]",
        message: "type is not declared",
        received: "regulation",
        expected: 'a declared type, "any", "same" or "type"',
      },
    ]);
  });
});

describe("parseProfile", () => {
  it("parses YAML then validates it", () => {
    const result = parseProfile(
      [
        "version: 1",
        "types: { term: { label: { en: Term }, group: business } }",
        "relations: { related: { label: { en: related }, directed: false, allowed: [[any, any]] } }",
        "confidence: {}",
      ].join("\n"),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.types["term"]?.group).toBe("business");
    }
  });

  it("reports YAML that cannot be parsed, with the parser's first line of explanation", () => {
    const result = parseProfile("version: 1\ntypes: [unclosed\n");
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ severity: "error", path: "" });
    expect(result.issues[0]?.message).toMatch(/^not valid YAML: .+/);
    expect(result.issues[0]?.message).not.toContain("\n");
  });

  it("reports a document that is not a mapping", () => {
    const result = parseProfile("just a string\n");
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ path: "", message: "wrong type", expected: "object" });
  });
});

describe("resolveProfile", () => {
  it("returns the default profile and its fingerprint when there is no project profile", () => {
    const base = loadDefaultProfile();
    expect(resolveProfile()).toEqual({
      ok: true,
      profile: base,
      fingerprint: fingerprintProfile(base),
      issues: [],
    });
  });

  it("merges a project profile adding a type on top of the default profile", () => {
    const result = resolveProfile(regulationProfile);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.profile.types)).toHaveLength(36);
      expect(result.profile.types["regulation"]).toEqual({
        label: { en: "Regulation", fr: "Réglementation" },
        group: "motivation",
        attributes: { reference: { type: "string" } },
        sections: {
          applies_to: {
            heading: { en: "Applies to", fr: "S'applique à" },
            parse: "bullet-list",
            produces: "constrains",
          },
        },
      });
      expect(result.profile.relations["constrains"]?.allowed).toEqual([
        ["rule", "screen"],
        ["rule", "process"],
        ["rule", "business_object"],
        ["rule", "api"],
        ["rule", "endpoint"],
        ["constraint", "requirement"],
        ["regulation", "process"],
      ]);
      expect(result.profile.types["screen"]).toEqual(loadDefaultProfile().types["screen"]);
      expect(Object.isFrozen(result.profile.types["regulation"])).toBe(true);
      expect(result.fingerprint).not.toBe(fingerprintProfile(loadDefaultProfile()));
      expect(result.issues).toEqual([]);
    }
  });

  it("gives the same fingerprint to two resolutions of the same project profile", () => {
    const first = resolveProfile(regulationProfile);
    const second = resolveProfile(`${regulationProfile}\n# a comment changes nothing\n`);
    expect(first.ok && second.ok && first.fingerprint === second.fingerprint).toBe(true);
  });

  it("reports the faulty keys of a project profile at their path", () => {
    const result = resolveProfile("types:\n  regulation:\n    label: { en: Regulation }\n");
    expect(result).toEqual({
      ok: false,
      issues: [
        { severity: "error", path: "types.regulation.group", message: "required key is missing" },
      ],
    });
  });

  it("reports a project profile that is not valid YAML", () => {
    const result = resolveProfile("types: [unclosed\n");
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.message).toMatch(/^not valid YAML: /);
  });

  it("reports a project profile that is not a mapping", () => {
    expect(resolveProfile("- regulation\n")).toEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          path: "",
          message: "wrong type",
          received: ["regulation"],
          expected: "object",
        },
      ],
    });
  });
});
