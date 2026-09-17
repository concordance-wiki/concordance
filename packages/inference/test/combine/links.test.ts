import type { Link, Provenance } from "@concordance-wiki/core";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { combineLinks, combineOptions } from "../../src/combine/links.js";
import { generator } from "../neighbourhood/fixtures.js";

const options = { glossary: { bonus: 0.05, cap: 0.8 } };

function link(
  relation: string,
  provenance: Provenance[],
  extra: Partial<Pick<Link, "from" | "to" | "attributes">> = {},
): Link {
  const confidence = provenance[0]?.confidence ?? 0;
  return {
    from: "specs/entry",
    to: "specs/cap",
    relation,
    attributes: {},
    confidence,
    provenance,
    ...extra,
  };
}

const explicit: Provenance = {
  method: "explicit_link",
  confidence: 1,
  path: "specs/entry.md",
  line: 12,
  text: "cap",
};
const frontmatter: Provenance = {
  method: "frontmatter_ref",
  confidence: 0.9,
  path: "specs/entry.md",
  attribute: "uses",
};
const section: Provenance = {
  method: "section_mention",
  confidence: 0.7,
  path: "specs/entry.md",
  line: 20,
  section: "Data",
};
const cooccurrence: Provenance = { method: "cooccurrence", confidence: 0.4, count: 2 };

function glossary(line: number, extra: Partial<Provenance> = {}): Provenance {
  return { method: "glossary_occurrence", confidence: 0.6, path: "specs/entry.md", line, ...extra };
}

const positionOfTest = (provenance: Provenance): number | undefined =>
  provenance.occurrences?.[0]?.position;

describe("the combination of links", () => {
  it("retains 1 − Π(1 − cᵢ), capped at 1, when several methods yield the same triple", () => {
    const [two] = combineLinks([link("uses", [frontmatter]), link("uses", [glossary(3)])], options);
    expect(two?.confidence).toBe(0.96);
    const [three] = combineLinks(
      [link("uses", [explicit]), link("uses", [section]), link("uses", [cooccurrence])],
      options,
    );
    expect(three?.confidence).toBe(1);
    const [below] = combineLinks(
      [link("uses", [section]), link("uses", [glossary(3)]), link("uses", [cooccurrence])],
      options,
    );
    expect(below?.confidence).toBe(0.928);
  });

  it("keeps every provenance, none overwritten, in canonical order", () => {
    const combined = combineLinks(
      [
        link("uses", [glossary(3)]),
        link("uses", [frontmatter, section]),
        link("uses", [cooccurrence]),
      ],
      options,
    );
    expect(combined).toEqual([
      {
        from: "specs/entry",
        to: "specs/cap",
        relation: "uses",
        attributes: {},
        confidence: 0.9928,
        provenance: [cooccurrence, frontmatter, glossary(3), section],
      },
    ]);
  });

  it("adds 0.05 per additional glossary occurrence, capped at 0.80", () => {
    const occurrences = (count: number): Link[] =>
      Array.from({ length: count }, (_, n) => link("uses", [glossary(n + 1)]));
    expect(combineLinks(occurrences(1), options)[0]?.confidence).toBe(0.6);
    expect(combineLinks(occurrences(2), options)[0]?.confidence).toBe(0.65);
    expect(combineLinks(occurrences(3), options)[0]?.confidence).toBe(0.7);
    expect(combineLinks(occurrences(5), options)[0]?.confidence).toBe(0.8);
    expect(combineLinks(occurrences(9), options)[0]?.confidence).toBe(0.8);
  });

  it("counts every listed occurrence of a glossary provenance", () => {
    const listed = glossary(3, {
      occurrences: [
        { line: 3, context: "the cap" },
        { line: 8, context: "a cap" },
        { line: 15, context: "the cap" },
      ],
    });
    expect(combineLinks([link("uses", [listed])], options)[0]?.confidence).toBe(0.7);
    const empty = glossary(9, { occurrences: [] });
    expect(
      combineLinks([link("uses", [listed]), link("uses", [empty])], options)[0]?.confidence,
    ).toBe(0.75);
  });

  it("grows the glossary confidence from the base of the strongest provenance, whatever its position", () => {
    const later = glossary(30, { confidence: 0.3 });
    const first = glossary(2, { confidence: 0.5 });
    const [combined] = combineLinks([link("uses", [later]), link("uses", [first])], options);
    expect(combined?.confidence).toBe(0.55);
    expect(combined?.provenance).toEqual([first, later]);
    // A later mention announced by a type prefix lifts the whole group.
    const announced = glossary(30, { confidence: 0.7 });
    const [lifted] = combineLinks([link("uses", [first]), link("uses", [announced])], options);
    expect(lifted?.confidence).toBe(0.75);
  });

  it("treats the glossary occurrences as one method beside the others", () => {
    const [combined] = combineLinks(
      [link("uses", [glossary(1), glossary(2), glossary(3)]), link("uses", [section])],
      options,
    );
    // 1 − (1 − 0.7)(1 − 0.7), not one factor per occurrence.
    expect(combined?.confidence).toBe(0.91);
  });

  it("lists an exact duplicate provenance once and counts it once", () => {
    const combined = combineLinks(
      [link("uses", [explicit, glossary(3)]), link("uses", [explicit, glossary(3)])],
      options,
    );
    expect(combined[0]?.provenance).toEqual([explicit, glossary(3)]);
    expect(combined[0]?.confidence).toBe(1);
    const [glossaryOnly] = combineLinks([link("uses", [glossary(3), glossary(3)])], options);
    expect(glossaryOnly?.confidence).toBe(0.6);
    const reworded = { ...explicit, text: "the cap" };
    const [first] = combineLinks([link("uses", [explicit]), link("uses", [reworded])], options);
    expect(first?.provenance).toEqual([explicit]);
  });

  it("never lets neighbouring fields of a key run into each other", () => {
    const combined = combineLinks(
      [
        link("uses", [explicit], { from: "a", to: "bc" }),
        link("uses", [explicit], { from: "ab", to: "c" }),
      ],
      options,
    );
    expect(combined.map((l) => `${l.from}>${l.to}`)).toEqual(["a>bc", "ab>c"]);
    const shifted = { ...explicit, path: "specs/entry.md1", line: 2 };
    const [one] = combineLinks([link("uses", [explicit, shifted])], options);
    expect(one?.provenance).toEqual([explicit, shifted]);
  });

  it("keeps two provenances of one method at the same line but in different sections", () => {
    const other = { ...section, section: "Rules" };
    const { section: unsectioned, ...bare } = section;
    expect(unsectioned).toBe("Data");
    const [combined] = combineLinks(
      [link("uses", [other]), link("uses", [section]), link("uses", [bare])],
      options,
    );
    expect(combined?.provenance).toEqual([bare, section, other]);
    expect(combined?.confidence).toBe(0.973);
    const [reversed] = combineLinks([link("uses", [section, bare, other])], options);
    expect(reversed?.provenance).toEqual([bare, section, other]);
  });

  it("keeps two mentions of one term in one paragraph as two provenances that both count", () => {
    const at = (position: number): Provenance =>
      glossary(7, { occurrences: [{ line: 7, position, context: "…" }] });
    const [combined] = combineLinks([link("related", [at(3)]), link("related", [at(40)])], options);
    expect(combined?.provenance.map(positionOfTest)).toEqual([3, 40]);
    const [once] = combineLinks([link("related", [at(3)])], options);
    expect(combined?.confidence).toBeGreaterThan(once?.confidence ?? 1);
    const [same] = combineLinks([link("related", [at(3)]), link("related", [at(3)])], options);
    expect(same?.provenance).toHaveLength(1);
    const [reversed] = combineLinks([link("related", [at(40)]), link("related", [at(3)])], options);
    expect(reversed?.provenance.map(positionOfTest)).toEqual([3, 40]);
    const unplaced = glossary(7, { occurrences: [] });
    const [empty] = combineLinks(
      [link("related", [unplaced]), link("related", [glossary(7)])],
      options,
    );
    expect(empty?.provenance).toHaveLength(1);
  });

  it("preserves the count of provenances minus the exact duplicates", () => {
    const next = generator(17);
    const methods: Provenance[] = [explicit, frontmatter, section, cooccurrence];
    for (let round = 0; round < 50; round += 1) {
      const links: Link[] = [];
      const distinct = new Set<string>();
      const size = 1 + Math.floor(next() * 8);
      for (let n = 0; n < size; n += 1) {
        const line = 1 + Math.floor(next() * 4);
        const provenance =
          next() < 0.5
            ? glossary(line)
            : { ...(methods[Math.floor(next() * 4)] ?? explicit), line };
        distinct.add(`${provenance.method} ${String(line)}`);
        links.push(link("uses", [provenance]));
      }
      const [combined] = combineLinks(links, options);
      expect(combined?.provenance).toHaveLength(distinct.size);
    }
  });

  it("is idempotent on an already combined input", () => {
    const once = combineLinks(
      [
        link("uses", [glossary(3), glossary(5)]),
        link("uses", [explicit, section]),
        link("related", [cooccurrence], { from: "specs/cap", to: "specs/rate" }),
        link("uses", [section], { to: "specs/rate" }),
      ],
      options,
    );
    expect(combineLinks(once, options)).toEqual(once);
  });

  it("orders the links by source, target and relation", () => {
    const combined = combineLinks(
      [
        link("uses", [section], { to: "specs/rate" }),
        link("related", [cooccurrence], { from: "specs/cap", to: "specs/rate" }),
        link("uses", [explicit]),
        link("documents", [explicit]),
      ],
      options,
    );
    expect(combined.map((l) => `${l.from} ${l.to} ${l.relation}`)).toEqual([
      "specs/cap specs/rate related",
      "specs/entry specs/cap documents",
      "specs/entry specs/cap uses",
      "specs/entry specs/rate uses",
    ]);
  });

  it("keeps a reads and a writes link between the same notes separate", () => {
    const reads = link("accesses", [explicit], { attributes: { mode: "reads" } });
    const writes = link("accesses", [section], { attributes: { mode: "writes" } });
    const combined = combineLinks([writes, reads], options);
    expect(combined).toEqual([
      { ...reads, confidence: 1, provenance: [explicit] },
      { ...writes, confidence: 0.7, provenance: [section] },
    ]);
  });

  it("groups attributes whatever the order of their keys and absent attributes with empty ones", () => {
    const one = link("accesses", [explicit], { attributes: { mode: "reads", scope: "all" } });
    const two = link("accesses", [section], { attributes: { scope: "all", mode: "reads" } });
    expect(combineLinks([one, two], options)).toEqual([
      { ...one, confidence: 1, provenance: [explicit, section] },
    ]);
    const { attributes, ...bare } = link("uses", [section]);
    expect(attributes).toEqual({});
    expect(combineLinks([bare, link("uses", [explicit])], options)).toEqual([
      { ...bare, attributes: {}, confidence: 1, provenance: [explicit, section] },
    ]);
  });

  it("gives the same output whatever the order of the input", () => {
    const next = generator(23);
    const inputs: Link[] = [
      link("uses", [glossary(3)]),
      link("uses", [explicit]),
      link("uses", [section]),
      link("accesses", [explicit], { attributes: { mode: "reads" } }),
      link("accesses", [section], { attributes: { mode: "writes" } }),
      link("related", [cooccurrence], { from: "specs/cap", to: "specs/rate" }),
      link("uses", [{ ...section, section: "Rules" }]),
    ];
    const expected = combineLinks(inputs, options);
    for (let round = 0; round < 20; round += 1) {
      const shuffled = [...inputs].sort(() => next() - 0.5);
      expect(combineLinks(shuffled, options)).toEqual(expected);
    }
  });

  it("leaves the input untouched", () => {
    const provenance = [section, explicit];
    const input = link("uses", provenance);
    const snapshot = structuredClone(input);
    const [combined] = combineLinks([input, link("uses", [cooccurrence])], options);
    expect(input).toEqual(snapshot);
    expect(input.provenance).toBe(provenance);
    expect(combined?.provenance[0]).not.toBe(cooccurrence);
  });
});

describe("the combination options", () => {
  it("read the bonus and the cap from the glossary occurrence scale of the profile", () => {
    const profile = loadDefaultProfile();
    expect(combineOptions(profile)).toEqual({ glossary: { bonus: 0.05, cap: 0.8 } });
    const custom = {
      ...profile,
      confidence: {
        ...profile.confidence,
        glossary_occurrence: { base: 0.5, per_occurrence: 0.1, cap: 0.9 },
      },
    };
    expect(combineOptions(custom)).toEqual({ glossary: { bonus: 0.1, cap: 0.9 } });
  });

  it("fall back to 0.05 and 0.80 when the profile has no glossary occurrence scale", () => {
    const { glossary_occurrence, ...scale } = loadDefaultProfile().confidence;
    expect(glossary_occurrence?.cap).toBe(0.8);
    expect(combineOptions({ ...loadDefaultProfile(), confidence: scale })).toEqual({
      glossary: { bonus: 0.05, cap: 0.8 },
    });
  });
});
