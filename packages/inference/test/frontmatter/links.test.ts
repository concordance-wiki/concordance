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

const role = note("roles/account-manager.md", "role", "Account manager");
const payment = note("objects/payment.md", "business_object", "Payment");
const contract = note("objects/contract.md", "business_object", "Contract");
const table = note("tables/payment.table.md", "data_object", "PAYMENT table", {
  business_object: "objects/payment",
});
const cap = note("rules/annual-cap.rule.md", "rule", "Annual cap");

const REMEDIATION =
  "Write the identifier, the path relative to the source root or the exact title of an existing note of a type the attribute accepts, or remove the reference.";

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
      reads: ["specs/objects/payment", "objects/contract.md", "Annual cap"],
      rules: ["Annual cap"],
    });
    const { links, findings } = frontmatterLinks({
      entities: [screen, payment, contract, cap],
      profile,
    });
    expect(findings).toEqual([
      unresolved(
        screen,
        "reads",
        'reference "Annual cap" names specs/rules/annual-cap of type rule where business_object or data_object is expected',
      ),
    ]);
    expect(links.map((link) => [link.from, link.to, link.relation])).toEqual([
      ["specs/rules/annual-cap", "specs/screens/entry", "constrains"],
      ["specs/screens/entry", "specs/objects/contract", "accesses"],
      ["specs/screens/entry", "specs/objects/payment", "accesses"],
    ]);
  });

  it("the produced relation is the one the profile associates with the attribute, with its attributes; thus reads yields accesses in read mode", () => {
    const screen = note("screens/entry.md", "screen", "Entry", {
      reads: ["objects/contract"],
      writes: ["objects/payment"],
    });
    const { links } = frontmatterLinks({ entities: [screen, payment, contract], profile });
    expect(links.map((link) => [link.to, link.relation, link.attributes])).toEqual([
      ["specs/objects/contract", "accesses", { mode: "read" }],
      ["specs/objects/payment", "accesses", { mode: "write" }],
    ]);
  });

  it("confidence 0.90, method frontmatter_ref, provenance on the attribute name", () => {
    const { links } = frontmatterLinks({ entities: [table, payment], profile });
    expect(links).toStrictEqual([
      {
        from: "specs/tables/payment",
        to: "specs/objects/payment",
        relation: "represents",
        attributes: {},
        confidence: 0.9,
        provenance: [
          {
            method: "frontmatter_ref",
            confidence: 0.9,
            path: "tables/payment.table.md",
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
    const term = note("payment.md", "term", "Payment", {}, "glossary");
    const screen = note("screens/entry.md", "screen", "Entry", { writes: "Payment" });
    const { links, findings } = frontmatterLinks({ entities: [screen, payment, term], profile });
    expect(links).toEqual([]);
    expect(findings).toEqual([
      unresolved(
        screen,
        "writes",
        'reference "Payment" is the title of several notes (specs/objects/payment, glossary/payment)',
      ),
    ]);
  });

  it("reports a reference to a note of a type the attribute does not accept, naming the expected types", () => {
    const screen = note("screens/entry.md", "screen", "Entry", { roles: ["objects/payment"] });
    const { links, findings } = frontmatterLinks({ entities: [screen, payment], profile });
    expect(links).toEqual([]);
    expect(findings).toEqual([
      unresolved(
        screen,
        "roles",
        'reference "objects/payment" names specs/objects/payment of type business_object where role is expected',
      ),
    ]);
  });

  it("accepts any type for a target of any and the type of the note for a target of same", () => {
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
        affects: ["specs/objects/payment"],
        supersedes: ["older", "specs/objects/payment"],
        open: "specs/rules/annual-cap",
        near: ["specs/rules/annual-cap", "decisions/older", "specs/objects/payment"],
      },
      "decisions",
    );
    const { links, findings } = frontmatterLinks({
      entities: [decision, older, payment, cap],
      profile: custom,
    });
    expect(findings.map((finding) => finding.message)).toEqual([
      'reference "specs/objects/payment" names specs/objects/payment of type business_object where decision is expected in attribute supersedes of newer.md',
      'reference "specs/objects/payment" names specs/objects/payment of type business_object where decision or rule is expected in attribute near of newer.md',
    ]);
    expect(links.map((link) => [link.to, link.relation, link.provenance.length])).toEqual([
      ["decisions/older", "affects", 1],
      ["decisions/older", "supersedes", 1],
      ["specs/objects/payment", "affects", 1],
      ["specs/rules/annual-cap", "affects", 2],
    ]);
  });

  it("reverses the link when the attribute is declared inverse", () => {
    const screen = note("screens/entry.md", "screen", "Entry", {
      roles: ["roles/account-manager"],
    });
    const { links } = frontmatterLinks({ entities: [screen, role], profile });
    expect(links).toStrictEqual([
      {
        from: "specs/roles/account-manager",
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
    const screen = note("screens/entry.md", "screen", "Entry", { reads: ["objects/payment"] });
    const { links } = frontmatterLinks({ entities: [screen, payment], profile });
    const [link] = links;
    expect(link?.attributes).toEqual({ mode: "read" });
    expect(link?.attributes).not.toBe(profile.types["screen"]?.attributes?.["reads"]?.attributes);
  });

  it("merges several references to the same target and relation into one link with every provenance", () => {
    const batch = note("batches/nightly.md", "batch", "Nightly", {
      reads: ["objects/payment", "Payment", "objects/payment.md"],
      writes: ["objects/payment"],
    });
    const { links } = frontmatterLinks({ entities: [batch, payment], profile });
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
      reads: ["objects/payment"],
      also: ["objects/payment"],
    });
    const { links } = frontmatterLinks({ entities: [batch, payment], profile: custom });
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
      writes: ["objects/payment"],
      reads: ["objects/payment"],
    });
    const { links } = frontmatterLinks({ entities: [batch, payment], profile: custom });
    expect(links.map((link) => link.attributes)).toEqual([{ mode: "read" }, { mode: "write" }]);
  });

  it("reports a value that is neither a string nor a list of strings with the value received", () => {
    const screen = note("screens/entry.md", "screen", "Entry", {
      roles: [{ id: "roles/account-manager" }, "roles/account-manager"],
      rules: 42,
    });
    const { links, findings } = frontmatterLinks({ entities: [screen, role], profile });
    expect(links.map((link) => link.from)).toEqual(["specs/roles/account-manager"]);
    expect(findings).toEqual([
      unresolved(
        screen,
        "roles",
        'value {"id":"roles/account-manager"} is neither a string nor a list of strings',
      ),
      unresolved(screen, "rules", "value 42 is neither a string nor a list of strings"),
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
      "free-payment.md",
      "term",
      "Free payment",
      { narrower: ["payment"] },
      "glossary",
    );
    const screen = note("screens/entry.md", "screen", "Entry", {
      url_pattern: "/pay",
      actions: [{ label: "Pay", to: "screens/summary" }],
    });
    const gizmo = note("misc/thing.md", "gizmo", "Thing", { about: "specs/objects/payment" });
    const unknown = note("misc/other.md", "widget", "Other", { reads: ["objects/payment"] });
    const paymentTerm = note("payment.md", "term", "Payment", {}, "glossary");
    const { links, findings } = frontmatterLinks({
      entities: [term, screen, gizmo, unknown, paymentTerm, payment],
      profile: custom,
    });
    expect(links).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("ignores a reference of a note to itself", () => {
    const term = note("payment.md", "term", "Payment", { broader: "payment" }, "glossary");
    const { links, findings } = frontmatterLinks({ entities: [term], profile });
    expect(links).toEqual([]);
    expect(findings).toEqual([]);
  });

  it("takes the confidence from the input, then from the profile, then 0.9", () => {
    const entities = [table, payment];
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
