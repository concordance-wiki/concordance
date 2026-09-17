import { loadDefaultProfile, type Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import type { LinkableEntity } from "../../src/explicit/types.js";
import { frontmatterLinks } from "../../src/frontmatter/links.js";

const profile = loadDefaultProfile();

function note(
  path: string,
  type: string,
  title: string,
  attributes: Record<string, unknown> = {},
  source = "specs",
): LinkableEntity {
  return {
    id: `${source}/${path.replace(/(\.[a-z]+)?\.md$/, "")}`,
    type,
    title,
    attributes,
    source: { name: source, path },
  };
}

const role = note("roles/maintainer.md", "role", "Maintainer");
const object = note("objects/link.md", "business_object", "Link");
const build = note("objects/build.md", "business_object", "Build");
const table = note("tables/links.table.md", "data_object", "LINKS table", {
  business_object: "objects/link",
});
const cap = note("rules/related-cap.rule.md", "rule", "Related cap");

const REMEDIATION =
  "Write the identifier, the path relative to the source root or the exact title of an existing note, or remove the reference.";

function unresolved(entity: LinkableEntity, attribute: string, message: string) {
  return {
    check: "W-REF-UNRESOLVED",
    severity: "warning",
    source: entity.source.name,
    path: entity.source.path,
    line: 1,
    entity: entity.id,
    message: `${message} in attribute ${attribute} of ${entity.source.path}`,
    remediation: REMEDIATION,
  };
}

describe("frontmatterLinks", () => {
  it("reference-typed attributes of the profile are resolved by identifier, by path, then by exact title", () => {
    const screen = note("screens/entry.md", "screen", "Entry", {
      reads: ["specs/objects/link", "objects/build.md", "Related cap"],
      rules: ["Related cap"],
    });
    const { links, findings } = frontmatterLinks({
      entities: [screen, object, build, cap],
      profile,
    });
    expect(findings).toEqual([]);
    expect(links.map((link) => [link.from, link.to, link.relation])).toEqual([
      ["specs/rules/related-cap", "specs/screens/entry", "constrains"],
      ["specs/screens/entry", "specs/objects/build", "accesses"],
      ["specs/screens/entry", "specs/objects/link", "accesses"],
      ["specs/screens/entry", "specs/rules/related-cap", "accesses"],
    ]);
  });

  it("the produced relation is the one the profile associates with the attribute, with its attributes; thus reads yields accesses in read mode", () => {
    const screen = note("screens/entry.md", "screen", "Entry", {
      reads: ["objects/build"],
      writes: ["objects/link"],
    });
    const { links } = frontmatterLinks({ entities: [screen, object, build], profile });
    expect(links.map((link) => [link.to, link.relation, link.attributes])).toEqual([
      ["specs/objects/build", "accesses", { mode: "read" }],
      ["specs/objects/link", "accesses", { mode: "write" }],
    ]);
  });

  it("confidence 0.90, method frontmatter_ref, provenance on the attribute name", () => {
    const { links } = frontmatterLinks({ entities: [table, object], profile });
    expect(links).toStrictEqual([
      {
        from: "specs/tables/links",
        to: "specs/objects/link",
        relation: "represents",
        attributes: {},
        confidence: 0.9,
        provenance: [
          {
            method: "frontmatter_ref",
            confidence: 0.9,
            path: "tables/links.table.md",
            line: 1,
            attribute: "business_object",
          },
        ],
      },
    ]);
  });

  it("an unresolved reference yields a finding and no link", () => {
    const screen = note("screens/entry.md", "screen", "Entry", { roles: ["roles/nobody"] });
    const { links, findings } = frontmatterLinks({ entities: [screen, role], profile });
    expect(links).toEqual([]);
    expect(findings).toEqual([
      unresolved(screen, "roles", 'reference "roles/nobody" matches no identifier, path or title'),
    ]);
  });

  it("orders findings canonically whatever the order of the entities", () => {
    const later = note("screens/later.md", "screen", "Later", { roles: ["roles/nobody"] });
    const earlier = note("screens/earlier.md", "screen", "Earlier", { roles: ["roles/nobody"] });
    const { findings } = frontmatterLinks({ entities: [later, earlier], profile });
    expect(findings.map((finding) => finding.path)).toEqual([
      "screens/earlier.md",
      "screens/later.md",
    ]);
  });

  it("reports a title shared by several notes, naming the candidates, and gives no link", () => {
    const term = note("link.md", "term", "Link", {}, "glossary");
    const screen = note("screens/entry.md", "screen", "Entry", { writes: "Link" });
    const finding = unresolved(
      screen,
      "writes",
      'reference "Link" is the title of several notes (glossary/link, specs/objects/link)',
    );
    const { links, findings } = frontmatterLinks({ entities: [screen, object, term], profile });
    expect(links).toEqual([]);
    expect(findings).toEqual([finding]);
    expect(frontmatterLinks({ entities: [term, object, screen], profile }).findings).toEqual([
      finding,
    ]);
  });

  it("gives a reference to a note of a type the attribute does not accept its link, for the relation typing step to judge against the matrix", () => {
    const screen = note("screens/entry.md", "screen", "Entry", { roles: ["objects/link"] });
    const { links, findings } = frontmatterLinks({ entities: [screen, object], profile });
    expect(findings).toEqual([]);
    expect(links.map((link) => [link.from, link.to, link.relation, link.provenance])).toEqual([
      [
        "specs/objects/link",
        "specs/screens/entry",
        "assigned_to",
        [
          {
            method: "frontmatter_ref",
            confidence: 0.9,
            path: "screens/entry.md",
            line: 1,
            attribute: "roles",
          },
        ],
      ],
    ]);
  });

  it("resolves a target of any, of same and of a list alike: the target types of the attribute never refuse a note", () => {
    const custom: Profile = {
      ...profile,
      types: {
        ...profile.types,
        decision: {
          ...profile.types["decision"],
          label: { en: "Decision" },
          group: "governance",
          attributes: {
            affects: { type: "ref[]", target: "any", relation: "affects" },
            supersedes: { type: "ref", target: "same", relation: "supersedes" },
            open: { type: "ref", relation: "affects" },
            near: { type: "ref[]", target: ["same", "rule"], relation: "affects" },
          },
        },
      },
    };
    const older = note("older.md", "decision", "Older", {}, "decisions");
    const decision = note(
      "newer.md",
      "decision",
      "Newer",
      {
        affects: ["specs/objects/link"],
        supersedes: ["older", "specs/objects/link"],
        open: "specs/rules/related-cap",
        near: ["specs/rules/related-cap", "decisions/older", "specs/objects/link"],
      },
      "decisions",
    );
    const { links, findings } = frontmatterLinks({
      entities: [decision, older, object, cap],
      profile: custom,
    });
    expect(findings).toEqual([]);
    expect(links.map((link) => [link.to, link.relation, link.provenance.length])).toEqual([
      ["decisions/older", "affects", 1],
      ["decisions/older", "supersedes", 1],
      ["specs/objects/link", "affects", 2],
      ["specs/objects/link", "supersedes", 1],
      ["specs/rules/related-cap", "affects", 2],
    ]);
  });

  it("reverses the link when the attribute is declared inverse", () => {
    const screen = note("screens/entry.md", "screen", "Entry", {
      roles: ["roles/maintainer"],
    });
    const { links } = frontmatterLinks({ entities: [screen, role], profile });
    expect(links).toStrictEqual([
      {
        from: "specs/roles/maintainer",
        to: "specs/screens/entry",
        relation: "assigned_to",
        attributes: {},
        confidence: 0.9,
        provenance: [
          {
            method: "frontmatter_ref",
            confidence: 0.9,
            path: "screens/entry.md",
            line: 1,
            attribute: "roles",
          },
        ],
      },
    ]);
  });

  it("carries the attributes of the attribute definition on the link without sharing the profile's object", () => {
    const screen = note("screens/entry.md", "screen", "Entry", { reads: ["objects/link"] });
    const { links } = frontmatterLinks({ entities: [screen, object], profile });
    const [link] = links;
    expect(link?.attributes).toEqual({ mode: "read" });
    expect(link?.attributes).not.toBe(profile.types["screen"]?.attributes?.["reads"]?.attributes);
  });

  it("merges several references to the same target and relation into one link with every provenance", () => {
    const batch = note("batches/nightly.md", "batch", "Nightly", {
      reads: ["objects/link", "Link", "objects/link.md"],
      writes: ["objects/link"],
    });
    const { links } = frontmatterLinks({ entities: [batch, object], profile });
    expect(links.map((link) => [link.attributes, link.provenance.length])).toEqual([
      [{ mode: "read" }, 3],
      [{ mode: "write" }, 1],
    ]);
  });

  it("merges two attributes whose link attributes are equal whatever their key order", () => {
    const custom: Profile = {
      ...profile,
      types: {
        ...profile.types,
        batch: {
          label: { en: "Batch" },
          group: "application",
          attributes: {
            reads: {
              type: "ref[]",
              target: "any",
              relation: "accesses",
              attributes: { mode: "read", scope: "all" },
            },
            also: {
              type: "ref[]",
              target: "any",
              relation: "accesses",
              attributes: { scope: "all", mode: "read" },
            },
          },
        },
      },
    };
    const batch = note("batches/nightly.md", "batch", "Nightly", {
      reads: ["objects/link"],
      also: ["objects/link"],
    });
    const { links } = frontmatterLinks({ entities: [batch, object], profile: custom });
    expect(links.map((link) => link.provenance.map((p) => p.attribute))).toEqual([
      ["reads", "also"],
    ]);
  });

  it("orders links by source, target, relation, then attributes, and provenances canonically", () => {
    const custom: Profile = {
      ...profile,
      types: {
        ...profile.types,
        batch: {
          label: { en: "Batch" },
          group: "application",
          attributes: {
            writes: {
              type: "ref[]",
              target: "any",
              relation: "accesses",
              attributes: { mode: "write" },
            },
            reads: {
              type: "ref[]",
              target: "any",
              relation: "accesses",
              attributes: { mode: "read" },
            },
          },
        },
      },
    };
    const batch = note("batches/nightly.md", "batch", "Nightly", {
      writes: ["objects/link"],
      reads: ["objects/link"],
    });
    const { links } = frontmatterLinks({ entities: [batch, object], profile: custom });
    expect(links.map((link) => link.attributes)).toEqual([{ mode: "read" }, { mode: "write" }]);
  });

  it("reports a value that is neither a string nor a list of strings with the value received", () => {
    const screen = note("screens/entry.md", "screen", "Entry", {
      roles: [{ id: "roles/maintainer" }, "roles/maintainer"],
      rules: 42,
    });
    const { links, findings } = frontmatterLinks({ entities: [screen, role], profile });
    expect(links.map((link) => link.from)).toEqual(["specs/roles/maintainer"]);
    // Code-unit order of the messages: the digit of `42` sorts before the brace of the object.
    expect(findings).toEqual([
      unresolved(screen, "rules", "value 42 is neither a string nor a list of strings"),
      unresolved(
        screen,
        "roles",
        'value {"id":"roles/maintainer"} is neither a string nor a list of strings',
      ),
    ]);
  });

  it("ignores attributes that are not references, references without a relation, absent keys and unknown types", () => {
    const custom: Profile = {
      ...profile,
      types: {
        ...profile.types,
        gizmo: {
          label: { en: "Gizmo" },
          group: "application",
          attributes: { about: { type: "string", relation: "affects" } },
        },
      },
    };
    const term = note(
      "explicit-link.md",
      "term",
      "Explicit link",
      { narrower: ["link"] },
      "glossary",
    );
    const screen = note("screens/entry.md", "screen", "Entry", {
      url_pattern: "/mentions",
      actions: [{ label: "Confirm", to: "screens/summary" }],
    });
    const gizmo = note("misc/thing.md", "gizmo", "Thing", { about: "specs/objects/link" });
    const unknown = note("misc/other.md", "widget", "Other", { reads: ["objects/link"] });
    const linkTerm = note("link.md", "term", "Link", {}, "glossary");
    const { links, findings } = frontmatterLinks({
      entities: [term, screen, gizmo, unknown, linkTerm, object],
      profile: custom,
    });
    expect(links).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("ignores a reference of a note to itself", () => {
    const term = note("link.md", "term", "Link", { broader: "link" }, "glossary");
    const { links, findings } = frontmatterLinks({ entities: [term], profile });
    expect(links).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("takes the confidence from the input, then from the profile, then 0.9", () => {
    const entities = [table, object];
    expect(frontmatterLinks({ entities, profile, confidence: 0.5 }).links[0]).toMatchObject({
      confidence: 0.5,
      provenance: [{ confidence: 0.5 }],
    });
    const scaled: Profile = {
      ...profile,
      confidence: { ...profile.confidence, frontmatter_ref: 0.8 },
    };
    expect(frontmatterLinks({ entities, profile: scaled }).links[0]).toMatchObject({
      confidence: 0.8,
      provenance: [{ confidence: 0.8 }],
    });
    const rest = { ...profile.confidence };
    delete rest.frontmatter_ref;
    const unscaled: Profile = { ...profile, confidence: rest };
    expect(frontmatterLinks({ entities, profile: unscaled }).links[0]).toMatchObject({
      confidence: 0.9,
      provenance: [{ confidence: 0.9 }],
    });
  });
});
