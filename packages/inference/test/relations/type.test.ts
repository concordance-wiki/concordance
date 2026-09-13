import type { Finding, Link, Provenance } from "@concordance-wiki/core";
import { loadDefaultProfile, resolveProfile, type Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import {
  FALLBACK_RELATION,
  RELATION_ORIGIN,
  typeRelations,
  type TypedEntity,
} from "../../src/relations/type.js";

const profile = loadDefaultProfile();

/** Nine notes of the tool's own documentation, one per type the tests need. */
const entities: TypedEntity[] = [
  {
    id: "decisions/static-site-with-islands",
    type: "decision",
    source: { name: "decisions", path: "static-site-with-islands.md" },
  },
  {
    id: "decisions/fonts-from-a-third-party-host",
    type: "decision",
    source: { name: "decisions", path: "fonts-from-a-third-party-host.md" },
  },
  {
    id: "glossary/keyword-page",
    type: "term",
    source: { name: "glossary", path: "keyword-page.md" },
  },
  {
    id: "specs/api/model-query",
    type: "api",
    source: { name: "specs", path: "api/model-query.md" },
  },
  {
    id: "specs/objects/entity",
    type: "business_object",
    source: { name: "specs", path: "objects/entity.md" },
  },
  {
    id: "specs/processes/build-pipeline",
    type: "process",
    source: { name: "specs", path: "processes/build-pipeline.md" },
  },
  {
    id: "specs/roles/maintainer",
    type: "role",
    source: { name: "specs", path: "roles/maintainer.md" },
  },
  {
    id: "specs/rules/publication-threshold",
    type: "rule",
    source: { name: "specs", path: "rules/publication-threshold.rule.md" },
  },
  {
    id: "specs/screens/entity-page",
    type: "screen",
    source: { name: "specs", path: "screens/entity-page.md" },
  },
  {
    id: "specs/screens/search-results",
    type: "screen",
    source: { name: "specs", path: "screens/search-results.md" },
  },
];

const SCREEN = "specs/screens/entity-page";
const RULE = "specs/rules/publication-threshold";
const OBJECT = "specs/objects/entity";
const TERM = "glossary/keyword-page";

function explicit(line: number, path = "screens/entity-page.md"): Provenance {
  return { method: "explicit_link", confidence: 1, path, line, text: "note" };
}

function frontmatter(attribute: string, path = "screens/entity-page.md"): Provenance {
  return { method: "frontmatter_ref", confidence: 0.9, path, line: 1, attribute };
}

function section(line: number, name: string, path = "screens/entity-page.md"): Provenance {
  return { method: "section_mention", confidence: 0.7, path, line, section: name };
}

function mention(line: number, path = "screens/entity-page.md"): Provenance {
  return { method: "glossary_occurrence", confidence: 0.6, path, line };
}

const cooccurrence: Provenance = { method: "cooccurrence", confidence: 0.4, count: 2 };

function link(
  from: string,
  to: string,
  relation: string,
  provenance: Provenance[],
  attributes: Record<string, unknown> = {},
): Link {
  return {
    from,
    to,
    relation,
    attributes,
    confidence: provenance[0]?.confidence ?? 0,
    provenance,
  };
}

function shape(links: readonly Link[]): unknown[] {
  return links.map(({ from, to, relation, attributes, confidence }) => ({
    from,
    to,
    relation,
    attributes,
    confidence,
  }));
}

function run(links: Link[], options: { profile?: Profile; entities?: TypedEntity[] } = {}) {
  return typeRelations({
    links,
    entities: options.entities ?? entities,
    profile: options.profile ?? profile,
  });
}

/** The default profile plus a second relation between a role and a screen, so that the pair is ambiguous. */
function ambiguousProfile(): Profile {
  const resolved = resolveProfile(
    "relations:\n  reviews:\n    label: { en: reviews }\n    directed: true\n    allowed: [[role, screen]]\n",
  );
  if (!resolved.ok) throw new Error("the extension is valid");
  return resolved.profile;
}

describe("the order of application", () => {
  it("applies the mapped section, then the typed frontmatter attribute, then a type pair admitting a single relation, then related", () => {
    const { links, findings } = run([
      // A mapped section named the relation and its mode: the pair alone would only say `accesses`.
      link(SCREEN, OBJECT, "accesses", [section(14, "writes")], { mode: "write" }),
      // A frontmatter attribute named `supersedes` where the pair alone would say `affects`.
      link(
        "decisions/static-site-with-islands",
        "decisions/fonts-from-a-third-party-host",
        "supersedes",
        [frontmatter("supersedes", "static-site-with-islands.md")],
      ),
      // A prose mention of an object in a screen: the pair admits `accesses` alone.
      link(OBJECT, SCREEN, FALLBACK_RELATION, [mention(30)]),
      // A prose mention of a term in a screen: the pair admits nothing, so the link stays `related`.
      link(TERM, SCREEN, FALLBACK_RELATION, [mention(31)]),
    ]);
    expect(shape(links)).toEqual([
      {
        from: "decisions/static-site-with-islands",
        to: "decisions/fonts-from-a-third-party-host",
        relation: "supersedes",
        attributes: {},
        confidence: 0.9,
      },
      { from: TERM, to: SCREEN, relation: "related", attributes: {}, confidence: 0.6 },
      {
        from: SCREEN,
        to: OBJECT,
        relation: "accesses",
        attributes: { mode: "write" },
        confidence: 0.7,
      },
      // Only the pair-named link carries the marker.
      {
        from: SCREEN,
        to: OBJECT,
        relation: "accesses",
        attributes: { [RELATION_ORIGIN]: "pair" },
        confidence: 0.6,
      },
    ]);
    expect(findings.map((finding) => [finding.check, finding.entity])).toEqual([
      ["I-REL-AMBIGUOUS", SCREEN],
    ]);
  });

  it("turns a related link around when only the reverse pair admits a single directed relation", () => {
    const { links } = run([link(SCREEN, RULE, FALLBACK_RELATION, [explicit(8)])]);
    expect(shape(links)).toEqual([
      {
        from: RULE,
        to: SCREEN,
        relation: "constrains",
        attributes: { relation_origin: "pair" },
        confidence: 1,
      },
    ]);
    expect(links[0]?.provenance).toEqual([explicit(8)]);
  });

  it("prefers the relation the pair admits in the written direction over the reverse one", () => {
    // A decision affects anything, and a meeting documents anything: the written direction decides.
    const meeting: TypedEntity = { id: "meetings/2026-03-12-links-workshop", type: "meeting" };
    const { links } = run(
      [
        link("decisions/static-site-with-islands", meeting.id, FALLBACK_RELATION, [
          explicit(3, "static-site-with-islands.md"),
        ]),
      ],
      { entities: [...entities, meeting] },
    );
    expect(links.map((l) => [l.from, l.to, l.relation])).toEqual([
      ["decisions/static-site-with-islands", meeting.id, "affects"],
    ]);
  });

  it("leaves a related link as related when the profile admits several relations for the pair", () => {
    const extended = ambiguousProfile();
    const { links, findings } = run(
      [
        link("specs/roles/maintainer", SCREEN, FALLBACK_RELATION, [
          mention(4, "roles/maintainer.md"),
        ]),
      ],
      { profile: extended },
    );
    expect(links.map((l) => l.relation)).toEqual(["related"]);
    expect(findings.map((f) => f.check)).toEqual(["I-REL-AMBIGUOUS"]);
    expect(
      run([
        link("specs/roles/maintainer", SCREEN, FALLBACK_RELATION, [
          mention(4, "roles/maintainer.md"),
        ]),
      ]).links.map((l) => l.relation),
    ).toEqual(["assigned_to"]);
  });

  it("folds a pair-named link into the declared link of the same triple and attributes, without the marker", () => {
    const { links } = run([
      link(RULE, SCREEN, "constrains", [section(23, "rules")]),
      link(SCREEN, RULE, FALLBACK_RELATION, [explicit(8)]),
      link(RULE, SCREEN, FALLBACK_RELATION, [mention(30)]),
    ]);
    expect(shape(links)).toEqual([
      { from: RULE, to: SCREEN, relation: "constrains", attributes: {}, confidence: 1 },
    ]);
    expect(links[0]?.provenance.map((p) => [p.method, p.line])).toEqual([
      ["explicit_link", 8],
      ["glossary_occurrence", 30],
      ["section_mention", 23],
    ]);
  });

  it("keeps a pair-named link apart from a declared link whose attributes say more", () => {
    const { links } = run([
      link(SCREEN, OBJECT, "accesses", [frontmatter("reads")], { mode: "read" }),
      link(OBJECT, SCREEN, FALLBACK_RELATION, [mention(30)]),
    ]);
    expect(shape(links)).toEqual([
      {
        from: SCREEN,
        to: OBJECT,
        relation: "accesses",
        attributes: { mode: "read" },
        confidence: 0.9,
      },
      {
        from: SCREEN,
        to: OBJECT,
        relation: "accesses",
        attributes: { relation_origin: "pair" },
        confidence: 0.6,
      },
    ]);
  });

  it("keeps a link with an endpoint the entity list does not type as produced", () => {
    const resource = "specs/api/contracts/model-query-openapi";
    const { links, findings } = run([
      link(resource, "specs/api/model-query", "documents", [explicit(5, "api/model-query.md")]),
      link(resource, SCREEN, FALLBACK_RELATION, [cooccurrence]),
      link(SCREEN, resource, "accesses", [frontmatter("reads")], { mode: "read" }),
      link(SCREEN, resource, FALLBACK_RELATION, [mention(6)]),
    ]);
    expect(links.map((l) => [l.from, l.to, l.relation, l.confidence])).toEqual([
      [resource, "specs/api/model-query", "documents", 1],
      [resource, SCREEN, "related", 0.6],
      [SCREEN, resource, "accesses", 0.9],
    ]);
    expect(findings.map((f) => [f.check, f.entity, f.source, f.path, f.line])).toEqual([
      ["I-REL-AMBIGUOUS", SCREEN, "specs", "screens/entity-page.md", 6],
    ]);
  });

  it("orients an undirected relation from the smaller identifier so that both readings of a pair merge", () => {
    const { links } = run([
      link(TERM, SCREEN, FALLBACK_RELATION, [mention(31)]),
      link(SCREEN, TERM, FALLBACK_RELATION, [explicit(31)]),
    ]);
    expect(links.map((l) => [l.from, l.to, l.provenance.length])).toEqual([[TERM, SCREEN, 2]]);
  });
});

describe("the related relation", () => {
  it("caps a related relation at 0.6 and yields an I-REL-AMBIGUOUS finding", () => {
    const { links, findings } = run([
      link(TERM, SCREEN, FALLBACK_RELATION, [explicit(31), mention(31), mention(40)]),
    ]);
    expect(links.map((l) => l.confidence)).toEqual([0.6]);
    expect(findings).toEqual<Finding[]>([
      {
        check: "I-REL-AMBIGUOUS",
        severity: "info",
        source: "specs",
        path: "screens/entity-page.md",
        line: 31,
        entity: SCREEN,
        message: `the link from ${TERM} to ${SCREEN} fell back to the generic related relation`,
        remediation:
          "Move the mention under a mapped section, or declare the reference in frontmatter.",
      },
    ]);
  });

  it("applies the cap after the combination, so that many weak methods never exceed it", () => {
    const { links } = run([
      link(TERM, SCREEN, FALLBACK_RELATION, [mention(31)]),
      link(TERM, SCREEN, FALLBACK_RELATION, [cooccurrence]),
    ]);
    // 1 − 0.4 × 0.6 = 0.76 before the cap.
    expect(links.map((l) => l.confidence)).toEqual([0.6]);
  });

  it("reads the cap from the profile and leaves an uncapped relation alone", () => {
    const resolved = resolveProfile("relations:\n  related:\n    cap: 0.5\n");
    if (!resolved.ok) throw new Error("the extension is valid");
    const { links } = run(
      [
        link(TERM, SCREEN, FALLBACK_RELATION, [explicit(31)]),
        link(SCREEN, OBJECT, "accesses", [explicit(12)], { mode: "read" }),
      ],
      { profile: resolved.profile },
    );
    expect(links.map((l) => [l.relation, l.confidence])).toEqual([
      ["related", 0.5],
      ["accesses", 1],
    ]);
  });

  it("yields one finding per related link, located on the first provenance that names a file", () => {
    const { findings } = run([
      link(TERM, SCREEN, FALLBACK_RELATION, [cooccurrence, mention(31)]),
      link(TERM, "specs/roles/maintainer", FALLBACK_RELATION, [
        mention(4, "roles/maintainer.md"),
        mention(2, "keyword-page.md"),
      ]),
    ]);
    expect(findings.map((f) => [f.source, f.path, f.line, f.entity])).toEqual([
      ["glossary", "keyword-page.md", 2, TERM],
      ["specs", "screens/entity-page.md", 31, SCREEN],
    ]);
  });

  it("locates a link without any file in its provenance on its source end", () => {
    const unlocated: Provenance = { method: "glossary_occurrence", confidence: 0.6, line: 3 };
    const { findings } = run([
      link(TERM, SCREEN, FALLBACK_RELATION, [unlocated]),
      link(SCREEN, TERM, "accesses", [], { mode: "read" }),
    ]);
    expect(findings.map((f) => [f.check, f.source, f.path, f.line, f.entity])).toEqual([
      ["E-META-REL", "specs", undefined, undefined, SCREEN],
      ["I-REL-AMBIGUOUS", "glossary", undefined, 3, TERM],
    ]);
    expect(findings[0]?.message).toBe(
      `relation accesses from screen ${SCREEN} to term ${TERM} is not allowed between these types`,
    );
  });

  it("raises nothing for a related link that co-occurrence alone knows, and keeps the link capped", () => {
    const { links, findings } = run([
      link(TERM, SCREEN, FALLBACK_RELATION, [cooccurrence]),
      link(TERM, "specs/roles/maintainer", FALLBACK_RELATION, [cooccurrence, mention(4)]),
    ]);
    expect(links.map((l) => [l.from, l.to, l.relation, l.confidence, l.provenance.length])).toEqual(
      [
        [TERM, "specs/roles/maintainer", "related", 0.6, 2],
        [TERM, SCREEN, "related", 0.4, 1],
      ],
    );
    expect(findings.map((f) => [f.check, f.entity, f.line])).toEqual([
      ["I-REL-AMBIGUOUS", TERM, 4],
    ]);
  });

  it("sorts the findings canonically, by source and path rather than by link", () => {
    const { findings } = run([
      link(TERM, "specs/roles/maintainer", FALLBACK_RELATION, [mention(4, "roles/maintainer.md")]),
      link(TERM, SCREEN, FALLBACK_RELATION, [mention(2, "keyword-page.md")]),
    ]);
    expect(findings.map((f) => [f.source, f.path, f.entity])).toEqual([
      ["glossary", "keyword-page.md", TERM],
      ["specs", "roles/maintainer.md", "specs/roles/maintainer"],
    ]);
  });
});

describe("a relation outside the profile matrix", () => {
  it("drops a relation declared outside the profile matrix with an E-META-REL finding", () => {
    const { links, findings } = run([
      link(SCREEN, TERM, "accesses", [frontmatter("reads")], { mode: "read" }),
      link(SCREEN, OBJECT, "accesses", [frontmatter("reads")], { mode: "read" }),
    ]);
    expect(links.map((l) => [l.to, l.relation])).toEqual([[OBJECT, "accesses"]]);
    expect(findings).toEqual<Finding[]>([
      {
        check: "E-META-REL",
        severity: "error",
        source: "specs",
        path: "screens/entity-page.md",
        line: 1,
        entity: SCREEN,
        message: `relation accesses from screen ${SCREEN} to term ${TERM} is not allowed between these types (attribute reads)`,
        remediation:
          "Point the reference at an entity of an allowed type, or extend the profile's allowed pairs for that relation.",
      },
    ]);
  });

  it("drops a relation the profile does not declare, naming the untyped ends by identifier alone", () => {
    const { links, findings } = run(
      [link("specs/screens/search", SCREEN, "displays", [explicit(2, "screens/search.md")])],
      { entities: [] },
    );
    expect(links).toEqual([]);
    expect(findings.map((f) => [f.entity, f.source, f.message])).toEqual([
      [
        "specs/screens/search",
        undefined,
        `relation displays from specs/screens/search to ${SCREEN} is not a relation of the profile`,
      ],
    ]);
  });

  it("accepts an undirected relation whose pair the profile lists the other way round", () => {
    const resolved = resolveProfile(
      "relations:\n  pairs_with:\n    label: { en: pairs with }\n    directed: false\n    allowed: [[screen, api]]\n",
    );
    if (!resolved.ok) throw new Error("the extension is valid");
    const { links, findings } = run(
      [
        link("specs/api/model-query", SCREEN, "pairs_with", [
          frontmatter("pairs_with", "api/model-query.md"),
        ]),
      ],
      { profile: resolved.profile },
    );
    expect(findings).toEqual([]);
    expect(links.map((l) => [l.from, l.to, l.relation])).toEqual([
      ["specs/api/model-query", SCREEN, "pairs_with"],
    ]);
  });

  it("refuses a directed relation written against its pair even when a section produced it", () => {
    const { links, findings } = run([link(SCREEN, RULE, "constrains", [section(23, "rules")])]);
    expect(links).toEqual([]);
    expect(findings.map((f) => [f.check, f.line, f.message])).toEqual([
      [
        "E-META-REL",
        23,
        `relation constrains from screen ${SCREEN} to rule ${RULE} is not allowed between these types`,
      ],
    ]);
  });
});

describe("the step as a function", () => {
  const sample = (): Link[] => [
    link(SCREEN, OBJECT, "accesses", [section(14, "writes")], { mode: "write" }),
    link(OBJECT, SCREEN, FALLBACK_RELATION, [mention(30)]),
    link(TERM, SCREEN, FALLBACK_RELATION, [mention(31), cooccurrence]),
    link(SCREEN, RULE, FALLBACK_RELATION, [explicit(8)]),
    link(RULE, SCREEN, "constrains", [section(23, "rules")]),
    link(SCREEN, TERM, "accesses", [frontmatter("reads")], { mode: "read" }),
  ];

  it("is idempotent: typing its own output changes nothing", () => {
    const once = run(sample());
    const twice = run(once.links);
    expect(twice.links).toEqual(once.links);
    expect(twice.findings).toEqual(once.findings.filter((f) => f.check !== "E-META-REL"));
  });

  it("returns the same sorted output whatever the input order and leaves the input untouched", () => {
    const forward = sample();
    const before = JSON.stringify(forward);
    const reversed = [...sample()].reverse();
    expect(run(reversed)).toEqual(run(forward));
    expect(JSON.stringify(forward)).toBe(before);
    const { links, findings } = run(forward);
    expect(links.map((l) => `${l.from} ${l.to} ${l.relation}`)).toEqual([
      `${TERM} ${SCREEN} related`,
      `${RULE} ${SCREEN} constrains`,
      `${SCREEN} ${OBJECT} accesses`,
      `${SCREEN} ${OBJECT} accesses`,
    ]);
    expect(findings.map((f) => f.check)).toEqual(["E-META-REL", "I-REL-AMBIGUOUS"]);
  });

  it("groups links on their attributes whatever the key order, and reads a link without attributes as bare", () => {
    const search = "specs/screens/search-results";
    const bare: Link = {
      from: SCREEN,
      to: search,
      relation: "triggers",
      confidence: 1,
      provenance: [explicit(9)],
    };
    const { links } = run([
      link(SCREEN, search, "triggers", [section(40, "flows")], {
        condition: "a hit",
        label: "open",
      }),
      link(SCREEN, search, "triggers", [frontmatter("flows")], {
        label: "open",
        condition: "a hit",
      }),
      bare,
    ]);
    expect(shape(links)).toEqual([
      {
        from: SCREEN,
        to: search,
        relation: "triggers",
        attributes: { condition: "a hit", label: "open" },
        confidence: 0.97,
      },
      { from: SCREEN, to: search, relation: "triggers", attributes: {}, confidence: 1 },
    ]);
  });

  it("recognises its own marker on a link fed back, so that a pair-named link never turns declared", () => {
    const marked = link(SCREEN, OBJECT, "accesses", [mention(30)], { [RELATION_ORIGIN]: "pair" });
    expect(run([marked]).links.map((l) => l.attributes)).toEqual([{ [RELATION_ORIGIN]: "pair" }]);
    const { links } = run([marked, link(SCREEN, OBJECT, "accesses", [section(14, "objects")])]);
    expect(links.map((l) => [l.attributes, l.provenance.length])).toEqual([[{}, 2]]);
  });
});
