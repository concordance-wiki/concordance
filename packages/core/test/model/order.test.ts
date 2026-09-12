import { describe, expect, it } from "vitest";

import {
  compareLinks,
  compareProvenances,
  sortCanonically,
  type LinkOrder,
  type ProvenanceOrder,
} from "../../src/model/order.js";

describe("Entities are sorted by identifier, links by the source-target-relation triple, provenances by method, path and line", () => {
  // The entity model does not exist yet; its comparator will order by identifier the same way.
  it("sorts entities by identifier with sortCanonically", () => {
    const entities = [{ id: "specs/b" }, { id: "glossary/z" }, { id: "specs/a" }];
    expect(sortCanonically(entities, (a, b) => Number(a.id > b.id) - Number(a.id < b.id))).toEqual([
      { id: "glossary/z" },
      { id: "specs/a" },
      { id: "specs/b" },
    ]);
  });

  it("sorts links by source, then target, then relation", () => {
    const links: LinkOrder[] = [
      { from: "b", to: "a", relation: "uses" },
      { from: "a", to: "b", relation: "uses" },
      { from: "a", to: "b", relation: "mentions" },
      { from: "a", to: "a", relation: "uses" },
    ];
    expect(sortCanonically(links, compareLinks)).toEqual([
      { from: "a", to: "a", relation: "uses" },
      { from: "a", to: "b", relation: "mentions" },
      { from: "a", to: "b", relation: "uses" },
      { from: "b", to: "a", relation: "uses" },
    ]);
  });

  it("sorts provenances by method, then path, then line, a missing path or line first", () => {
    const provenances: ProvenanceOrder[] = [
      { method: "occurrence", path: "b.md", line: 2 },
      { method: "occurrence", path: "b.md", line: 1 },
      { method: "occurrence", path: "b.md" },
      { method: "occurrence", path: "a.md", line: 9 },
      { method: "occurrence" },
      { method: "link", path: "z.md", line: 3 },
    ];
    expect(sortCanonically(provenances, compareProvenances)).toEqual([
      { method: "link", path: "z.md", line: 3 },
      { method: "occurrence" },
      { method: "occurrence", path: "a.md", line: 9 },
      { method: "occurrence", path: "b.md" },
      { method: "occurrence", path: "b.md", line: 1 },
      { method: "occurrence", path: "b.md", line: 2 },
    ]);
  });

  it("places a provenance without path or line before one with them, whichever side it is on", () => {
    const bare: ProvenanceOrder = { method: "m" };
    const located: ProvenanceOrder = { method: "m", path: "a.md", line: 1 };
    const unnumbered: ProvenanceOrder = { method: "m", path: "a.md" };
    expect(compareProvenances(bare, located)).toBe(-1);
    expect(compareProvenances(located, bare)).toBe(1);
    expect(compareProvenances(unnumbered, located)).toBe(-1);
    expect(compareProvenances(located, unnumbered)).toBe(1);
  });

  it("orders by code unit, so that an uppercase letter sorts before a lowercase one", () => {
    expect(
      compareLinks({ from: "B", to: "", relation: "" }, { from: "a", to: "", relation: "" }),
    ).toBe(-1);
    expect(compareProvenances({ method: "Z" }, { method: "a" })).toBe(-1);
    expect(
      compareLinks({ from: "a", to: "b", relation: "" }, { from: "a", to: "a", relation: "" }),
    ).toBe(1);
  });

  it("treats two identical items as equal", () => {
    expect(compareProvenances({ method: "m" }, { method: "m" })).toBe(0);
    expect(
      compareLinks({ from: "a", to: "b", relation: "r" }, { from: "a", to: "b", relation: "r" }),
    ).toBe(0);
    expect(
      compareProvenances({ method: "m", path: "p", line: 1 }, { method: "m", path: "p", line: 1 }),
    ).toBe(0);
  });

  it("returns a sorted copy and leaves the input untouched", () => {
    const items = [3, 1, 2];
    const sorted = sortCanonically(items, (a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3]);
    expect(items).toEqual([3, 1, 2]);
    expect(sorted).not.toBe(items);
  });
});
