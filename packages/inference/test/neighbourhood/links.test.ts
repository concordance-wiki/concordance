import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { accumulateCooccurrences } from "../../src/neighbourhood/accumulate.js";
import { cooccurrenceLinks } from "../../src/neighbourhood/links.js";
import type { Neighbourhood } from "../../src/neighbourhood/types.js";
import { paragraph } from "./fixtures.js";

const profile = loadDefaultProfile();

describe("the co-occurrence links", () => {
  it("gives one related link per pair at confidence 0.40 with method cooccurrence", () => {
    const occurrences = [
      ...paragraph("notes/a.md", 3, ["specs/cap", "specs/entry"]),
      ...paragraph("notes/a.md", 9, ["specs/cap", "specs/entry", "specs/rate"]),
    ];
    const links = cooccurrenceLinks(accumulateCooccurrences(occurrences, { k: 50 }), { profile });
    expect(links).toEqual([
      {
        from: "specs/cap",
        to: "specs/entry",
        relation: "related",
        attributes: {},
        confidence: 0.4,
        provenance: [{ method: "cooccurrence", confidence: 0.4, count: 2 }],
      },
      {
        from: "specs/cap",
        to: "specs/rate",
        relation: "related",
        attributes: {},
        confidence: 0.4,
        provenance: [{ method: "cooccurrence", confidence: 0.4, count: 1 }],
      },
      {
        from: "specs/entry",
        to: "specs/rate",
        relation: "related",
        attributes: {},
        confidence: 0.4,
        provenance: [{ method: "cooccurrence", confidence: 0.4, count: 1 }],
      },
    ]);
  });

  it("reads the confidence from the cooccurrence scale of the profile", () => {
    const neighbourhood: Neighbourhood = {
      k: 1,
      nodes: new Map([["a", [{ id: "b", count: 1 }]]]),
    };
    const custom = { ...profile, confidence: { ...profile.confidence, cooccurrence: 0.3 } };
    const [link] = cooccurrenceLinks(neighbourhood, { profile: custom });
    expect(link?.confidence).toBe(0.3);
    expect(link?.provenance).toEqual([{ method: "cooccurrence", confidence: 0.3, count: 1 }]);
    const { cooccurrence, ...scale } = profile.confidence;
    expect(cooccurrence).toBe(0.4);
    const unset = { ...profile, confidence: scale };
    expect(cooccurrenceLinks(neighbourhood, { profile: unset })[0]?.confidence).toBe(0.4);
  });

  it("emits a pair once, from the lower identifier, whichever row lists it", () => {
    const neighbourhood: Neighbourhood = {
      k: 1,
      nodes: new Map([
        ["a", [{ id: "b", count: 2 }]],
        ["b", [{ id: "a", count: 2 }]],
        ["c", [{ id: "a", count: 1 }]],
      ]),
    };
    const links = cooccurrenceLinks(neighbourhood, { profile });
    expect(links.map((link) => [link.from, link.to])).toEqual([
      ["a", "b"],
      ["a", "c"],
    ]);
  });

  it("keeps the larger count when the two rows of a pair disagree", () => {
    const neighbourhood: Neighbourhood = {
      k: 1,
      nodes: new Map([
        ["a", [{ id: "b", count: 2 }]],
        ["b", [{ id: "a", count: 5 }]],
      ]),
    };
    expect(cooccurrenceLinks(neighbourhood, { profile })[0]?.provenance[0]?.count).toBe(5);
    const reversed: Neighbourhood = {
      k: 1,
      nodes: new Map([
        ["a", [{ id: "b", count: 5 }]],
        ["b", [{ id: "a", count: 2 }]],
      ]),
    };
    expect(cooccurrenceLinks(reversed, { profile })[0]?.provenance[0]?.count).toBe(5);
  });

  it("sorts links by the source-target-relation triple", () => {
    const neighbourhood: Neighbourhood = {
      k: 2,
      nodes: new Map([
        [
          "z",
          [
            { id: "b", count: 1 },
            { id: "a", count: 1 },
          ],
        ],
        ["m", [{ id: "a", count: 1 }]],
      ]),
    };
    expect(
      cooccurrenceLinks(neighbourhood, { profile }).map((link) => `${link.from} ${link.to}`),
    ).toEqual(["a m", "a z", "b z"]);
  });
});
