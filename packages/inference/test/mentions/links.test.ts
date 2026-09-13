import { loadDefaultProfile, type Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import type { LinkableEntity } from "../../src/explicit/types.js";
import { mentionLinks, type MentionOccurrence } from "../../src/mentions/links.js";

const profile = loadDefaultProfile();

function entity(id: string, type: string, source = "specs"): LinkableEntity {
  const path = id.split("/").slice(1).join("/");
  return { id, type, title: path, attributes: {}, source: { name: source, path: `${path}.md` } };
}

const screen = entity("specs/screens/entry", "screen");
const summary = entity("specs/screens/summary", "screen");
const object = entity("specs/objects/link", "business_object");
const rule = entity("specs/rules/cap", "rule");
const term = entity("glossary/link", "term", "glossary");
const batch = entity("specs/batches/nightly", "batch");
const entities = [screen, summary, object, rule, term, batch];

/** A mention of `to` read in the note of `from`. */
function mention(
  from: LinkableEntity,
  to: LinkableEntity,
  line: number,
  section?: string,
): MentionOccurrence {
  return {
    target: { id: to.id },
    source: from.source.name,
    path: from.source.path,
    line,
    ...(section === undefined ? {} : { section }),
  };
}

function run(occurrences: MentionOccurrence[], custom: Profile = profile) {
  return mentionLinks({ occurrences, entities, profile: custom });
}

describe("mentionLinks", () => {
  it("sections mapped in the profile yield the declared relation for every mention they contain", () => {
    const { links } = run([
      mention(screen, object, 8, "Objects"),
      mention(screen, summary, 12, "Actions"),
      mention(batch, object, 6, "Reads"),
    ]);
    expect(links.map((link) => [link.from, link.to, link.relation])).toEqual([
      ["specs/batches/nightly", "specs/objects/link", "accesses"],
      ["specs/screens/entry", "specs/objects/link", "accesses"],
      ["specs/screens/entry", "specs/screens/summary", "triggers"],
    ]);
  });

  it("confidence 0.70, method section_mention, provenance on the section name and line", () => {
    const { links } = run([mention(screen, object, 8, "Objects")]);
    expect(links).toEqual([
      {
        from: "specs/screens/entry",
        to: "specs/objects/link",
        relation: "accesses",
        attributes: {},
        confidence: 0.7,
        provenance: [
          {
            method: "section_mention",
            confidence: 0.7,
            path: "screens/entry.md",
            line: 8,
            section: "objects",
          },
        ],
      },
    ]);
  });

  it.each(["Objects", "Objets", "OBJECTS", "objets"])(
    "section heading matching is case- and accent-insensitive, and accepts the labels of every profile locale: %s",
    (heading) => {
      const { links } = run([mention(screen, object, 8, heading)]);
      expect(links.map((link) => [link.relation, link.provenance[0]?.method])).toEqual([
        ["accesses", "section_mention"],
      ]);
    },
  );

  it("a mention outside a mapped section falls back to glossary_occurrence", () => {
    const { links } = run([mention(screen, summary, 3), mention(screen, term, 20, "See also")]);
    expect(links).toEqual([
      {
        from: "glossary/link",
        to: "specs/screens/entry",
        relation: "related",
        attributes: {},
        confidence: 0.6,
        provenance: [
          { method: "glossary_occurrence", confidence: 0.6, path: "screens/entry.md", line: 20 },
        ],
      },
      {
        from: "specs/screens/entry",
        to: "specs/screens/summary",
        relation: "related",
        attributes: {},
        confidence: 0.6,
        provenance: [
          { method: "glossary_occurrence", confidence: 0.6, path: "screens/entry.md", line: 3 },
        ],
      },
    ]);
  });

  it("a mention carries the confidence the scan gave it: a type prefix bonus or a halved homonym", () => {
    const announced = { ...mention(screen, summary, 3), confidence: 0.7 };
    const homonym = { ...mention(screen, term, 20), confidence: 0.3 };
    const { links } = run([announced, homonym]);
    expect(links.map((link) => [link.to, link.provenance[0]?.confidence])).toEqual([
      ["specs/screens/entry", 0.3],
      ["specs/screens/summary", 0.7],
    ]);
  });

  it("a section of another type's vocabulary does not map: Applies to under a screen is a plain mention", () => {
    const { links } = run([mention(screen, object, 8, "Applies to")]);
    expect(links.map((link) => [link.relation, link.provenance[0]?.method])).toEqual([
      ["related", "glossary_occurrence"],
    ]);
  });

  it("a mapped section whose relation does not join the two types counts as a plain mention", () => {
    // A screen accesses objects, not terms: the term mentioned under Objects stays related.
    const { links } = run([mention(screen, term, 8, "Objects")]);
    expect(links.map((link) => [link.from, link.relation, link.provenance[0]?.method])).toEqual([
      ["glossary/link", "related", "glossary_occurrence"],
    ]);
  });

  it("an inverse section links the mentioned entity to the note, as a rule under Rules constrains the screen", () => {
    const { links } = run([mention(screen, rule, 16, "Rules")]);
    expect(links).toEqual([
      {
        from: "specs/rules/cap",
        to: "specs/screens/entry",
        relation: "constrains",
        attributes: {},
        confidence: 0.7,
        provenance: [
          {
            method: "section_mention",
            confidence: 0.7,
            path: "screens/entry.md",
            line: 16,
            section: "rules",
          },
        ],
      },
    ]);
  });

  it("carries the attributes of the section and keeps two attribute sets of one relation as two links in attribute order", () => {
    const { links } = run([
      mention(batch, object, 10, "Writes"),
      mention(batch, object, 6, "Reads"),
    ]);
    expect(
      links.map((link) => [link.relation, link.attributes, link.provenance[0]?.section]),
    ).toEqual([
      ["accesses", { mode: "read" }, "reads"],
      ["accesses", { mode: "write" }, "writes"],
    ]);
  });

  it("orients an undirected relation from the smaller identifier, so that reciprocal mentions merge into one link", () => {
    const { links } = run([mention(screen, term, 3), mention(term, screen, 5)]);
    expect(links.map((link) => [link.from, link.to, link.provenance.map((p) => p.path)])).toEqual([
      ["glossary/link", "specs/screens/entry", ["link.md", "screens/entry.md"]],
    ]);
  });

  it("keeps a directed relation from the note to the mentioned entity whatever their identifiers", () => {
    const { links } = run([mention(summary, object, 8, "Objects")]);
    expect(links.map((link) => [link.from, link.to])).toEqual([
      ["specs/screens/summary", "specs/objects/link"],
    ]);
  });

  it("drops a self-mention", () => {
    const { links } = run([mention(screen, screen, 1), mention(screen, screen, 8, "Actions")]);
    expect(links).toEqual([]);
  });

  it("ignores a mention read in a file that is no entity and a mention of an unknown target", () => {
    const { links } = run([
      { target: { id: object.id }, source: "specs", path: "readme.md", line: 1 },
      {
        target: { id: "specs/objects/unknown" },
        source: "specs",
        path: "screens/entry.md",
        line: 1,
      },
    ]);
    expect(links).toEqual([]);
  });

  it("tells files apart by source: the same path in another source is no entity", () => {
    const { links } = run([
      { target: { id: object.id }, source: "other", path: "screens/entry.md", line: 1 },
    ]);
    expect(links).toEqual([]);
  });

  it("merges several mentions of the same target in the same relation into one link with one provenance per mention, in line order", () => {
    const { links } = run([
      mention(screen, object, 9, "Objects"),
      mention(screen, object, 8, "objets"),
      mention(screen, summary, 3),
      mention(screen, summary, 12, "Actions"),
      mention(screen, summary, 1),
    ]);
    expect(links.map((link) => [link.relation, link.provenance.map((p) => p.line)])).toEqual([
      ["accesses", [8, 9]],
      ["related", [1, 3]],
      ["triggers", [12]],
    ]);
  });

  it("orders links by from, to and relation whatever the order of the mentions", () => {
    const { links } = run([
      mention(screen, summary, 12, "Actions"),
      mention(batch, object, 6, "Reads"),
      mention(screen, object, 3),
      mention(screen, object, 8, "Objects"),
    ]);
    expect(links.map((link) => `${link.from} ${link.to} ${link.relation}`)).toEqual([
      "specs/batches/nightly specs/objects/link accesses",
      "specs/objects/link specs/screens/entry related",
      "specs/screens/entry specs/objects/link accesses",
      "specs/screens/entry specs/screens/summary triggers",
    ]);
  });

  it("reads both confidences from the profile and falls back to 0.7 and 0.6 without them", () => {
    const custom: Profile = {
      ...profile,
      confidence: {
        section_mention: 0.75,
        glossary_occurrence: { base: 0.5, per_occurrence: 0.05, cap: 0.8 },
      },
    };
    const { links } = run(
      [mention(screen, object, 8, "Objects"), mention(screen, summary, 3)],
      custom,
    );
    expect(links.map((link) => link.confidence)).toEqual([0.75, 0.5]);
    const bare = run([mention(screen, object, 8, "Objects"), mention(screen, summary, 3)], {
      ...profile,
      confidence: {},
    });
    expect(bare.links.map((link) => link.confidence)).toEqual([0.7, 0.6]);
  });

  it("keeps the direction of a relation the profile does not declare, since nothing says it is undirected", () => {
    const relations = Object.fromEntries(
      Object.entries(profile.relations).filter(([slug]) => slug !== "related"),
    );
    const { links } = run([mention(screen, term, 3)], { ...profile, relations });
    expect(links.map((link) => [link.from, link.to])).toEqual([
      ["specs/screens/entry", "glossary/link"],
    ]);
  });

  it("treats a section under a type the profile does not declare as unmapped", () => {
    const { links } = mentionLinks({
      occurrences: [mention(screen, object, 8, "Objects")],
      entities: [{ ...screen, type: "widget" }, object],
      profile,
    });
    expect(links.map((link) => [link.relation, link.provenance[0]?.method])).toEqual([
      ["related", "glossary_occurrence"],
    ]);
  });

  it("keeps the passage of a mention on its provenance, with its position and heading, so that the mentions panel can show it", () => {
    const { links } = run([
      {
        ...mention(screen, object, 8, "Objects"),
        position: 14,
        text: "links",
        context: "…the entry screen lists every link of the model…",
      },
      { ...mention(screen, term, 3), context: "A link joins two entities." },
      mention(screen, summary, 12),
    ]);
    // Strict: an absent position, heading or text must not be written as undefined into the model.
    expect(links.map((link) => link.provenance)).toStrictEqual([
      [
        {
          method: "glossary_occurrence",
          confidence: 0.6,
          path: "screens/entry.md",
          line: 3,
          occurrences: [{ line: 3, context: "A link joins two entities." }],
        },
      ],
      [
        {
          method: "section_mention",
          confidence: 0.7,
          path: "screens/entry.md",
          line: 8,
          section: "objects",
          text: "links",
          occurrences: [
            {
              line: 8,
              position: 14,
              context: "…the entry screen lists every link of the model…",
              section: "Objects",
            },
          ],
        },
      ],
      [{ method: "glossary_occurrence", confidence: 0.6, path: "screens/entry.md", line: 12 }],
    ]);
  });
});
