import { describe, expect, it } from "vitest";

import { accumulateCooccurrences } from "../../src/neighbourhood/accumulate.js";
import type { Neighbour, OccurrenceLike } from "../../src/neighbourhood/types.js";
import { generator, paragraph } from "./fixtures.js";

function neighbours(
  occurrences: readonly OccurrenceLike[],
  k: number,
): Record<string, Neighbour[]> {
  return Object.fromEntries(accumulateCooccurrences(occurrences, { k }).nodes);
}

/** The exact best `k` of every node, from the full matrix. */
function bruteForce(occurrences: readonly OccurrenceLike[], k: number): Map<string, Neighbour[]> {
  const byParagraph = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    const key = `${occurrence.source ?? ""} ${occurrence.path} ${String(occurrence.line)}`;
    byParagraph.set(key, (byParagraph.get(key) ?? new Set()).add(occurrence.target.id));
  }
  const matrix = new Map<string, Map<string, number>>();
  for (const members of byParagraph.values()) {
    for (const a of members) {
      for (const b of members) {
        if (a === b) continue;
        const row = matrix.get(a) ?? new Map<string, number>();
        row.set(b, (row.get(b) ?? 0) + 1);
        matrix.set(a, row);
      }
    }
  }
  return new Map(
    [...matrix]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, row]) => [
        id,
        [...row]
          .map(([neighbour, count]) => ({ id: neighbour, count }))
          .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
          .slice(0, k),
      ]),
  );
}

describe("the co-occurrence accumulation", () => {
  it("records co-occurrence per paragraph", () => {
    const occurrences = [
      ...paragraph("notes/a.md", 3, ["specs/cap", "specs/entry"]),
      ...paragraph("notes/a.md", 3, ["specs/cap"]),
      ...paragraph("notes/a.md", 9, ["specs/cap", "specs/entry", "specs/rate"]),
      ...paragraph("notes/b.md", 3, ["specs/rate", "specs/entry"]),
    ];
    expect(neighbours(occurrences, 50)).toEqual({
      "specs/cap": [
        { id: "specs/entry", count: 2 },
        { id: "specs/rate", count: 1 },
      ],
      "specs/entry": [
        { id: "specs/cap", count: 2 },
        { id: "specs/rate", count: 2 },
      ],
      "specs/rate": [
        { id: "specs/entry", count: 2 },
        { id: "specs/cap", count: 1 },
      ],
    });
  });

  it("counts a mention twice in one paragraph as one co-occurrence", () => {
    const occurrences = [
      ...paragraph("notes/a.md", 3, ["specs/cap", "specs/cap", "specs/entry", "specs/entry"]),
    ];
    expect(neighbours(occurrences, 50)).toEqual({
      "specs/cap": [{ id: "specs/entry", count: 1 }],
      "specs/entry": [{ id: "specs/cap", count: 1 }],
    });
  });

  it("tells apart the same path and line of two sources", () => {
    const occurrences = [
      ...paragraph("notes/a.md", 3, ["specs/cap", "specs/entry"], "specs"),
      ...paragraph("notes/a.md", 3, ["specs/cap", "specs/rate"], "glossary"),
    ];
    expect(neighbours(occurrences, 50)).toEqual({
      "specs/cap": [
        { id: "specs/entry", count: 1 },
        { id: "specs/rate", count: 1 },
      ],
      "specs/entry": [{ id: "specs/cap", count: 1 }],
      "specs/rate": [{ id: "specs/cap", count: 1 }],
    });
  });

  it("gives no neighbour to an entity alone in its paragraphs", () => {
    const occurrences = [
      ...paragraph("notes/a.md", 3, ["specs/cap"]),
      ...paragraph("notes/a.md", 5, ["specs/cap"]),
    ];
    const result = accumulateCooccurrences(occurrences, { k: 50 });
    expect(result.k).toBe(50);
    expect(result.nodes.size).toBe(0);
  });

  it("keeps only the K best neighbours of each node", () => {
    const occurrences = [
      ...paragraph("notes/a.md", 1, ["a", "b", "c", "d"]),
      ...paragraph("notes/a.md", 2, ["a", "c", "d"]),
      ...paragraph("notes/a.md", 3, ["a", "d"]),
    ];
    expect(neighbours(occurrences, 2)).toEqual({
      a: [
        { id: "d", count: 3 },
        { id: "c", count: 2 },
      ],
      b: [
        { id: "a", count: 1 },
        { id: "c", count: 1 },
      ],
      c: [
        { id: "a", count: 2 },
        { id: "d", count: 2 },
      ],
      d: [
        { id: "a", count: 3 },
        { id: "c", count: 2 },
      ],
    });
  });

  it("ranks by co-occurrence count, then by identifier on ties", () => {
    const occurrences = [
      ...paragraph("notes/a.md", 1, ["a", "e", "d", "b"]),
      ...paragraph("notes/a.md", 2, ["a", "c"]),
      ...paragraph("notes/a.md", 3, ["a", "c"]),
    ];
    expect(neighbours(occurrences, 2)["a"]).toEqual([
      { id: "c", count: 2 },
      { id: "b", count: 1 },
    ]);
    expect(neighbours(occurrences, 4)["a"]).toEqual([
      { id: "c", count: 2 },
      { id: "b", count: 1 },
      { id: "d", count: 1 },
      { id: "e", count: 1 },
    ]);
  });

  it("lists nodes in identifier order whatever the order of the occurrences", () => {
    const occurrences = [
      ...paragraph("notes/b.md", 1, ["z", "m"]),
      ...paragraph("notes/a.md", 1, ["y", "b", "a"]),
    ];
    expect([...accumulateCooccurrences(occurrences, { k: 50 }).nodes.keys()]).toEqual([
      "a",
      "b",
      "m",
      "y",
      "z",
    ]);
    const reversed = [...occurrences].reverse();
    expect(accumulateCooccurrences(reversed, { k: 50 })).toEqual(
      accumulateCooccurrences(occurrences, { k: 50 }),
    );
  });

  it("trims a row to the best K once it holds more than 2K neighbours", () => {
    // With K = 1 the row of `a` is trimmed at its third neighbour: `d` arrives while `c` leads.
    const occurrences = [
      ...paragraph("notes/a.md", 1, ["a", "b"]),
      ...paragraph("notes/a.md", 2, ["a", "c"]),
      ...paragraph("notes/a.md", 3, ["a", "c"]),
      ...paragraph("notes/a.md", 4, ["a", "d"]),
      ...paragraph("notes/a.md", 5, ["a", "b"]),
      ...paragraph("notes/a.md", 6, ["a", "b"]),
      ...paragraph("notes/a.md", 7, ["a", "b"]),
    ];
    // `b` was dropped with one paragraph and starts again: three of its four are counted.
    expect(neighbours(occurrences, 1)["a"]).toEqual([{ id: "b", count: 3 }]);
    // Paragraphs are visited in line order, not in the order the occurrences came in.
    expect(neighbours([...occurrences].reverse(), 1)["a"]).toEqual([{ id: "b", count: 3 }]);
    // Lines are numbers: line 10 comes after line 7, and a file or a source sorts before its lines.
    const later = [
      ...paragraph("notes/a.md", 10, ["a", "b"]),
      ...paragraph("notes/a.md", 12, ["a", "b"]),
      ...paragraph("notes/a.md", 14, ["a", "b"]),
    ];
    const first = occurrences.filter((occurrence) => occurrence.line <= 4);
    expect(neighbours([...later, ...first], 1)["a"]).toEqual([{ id: "b", count: 3 }]);
    const spread = [
      ...paragraph("notes/b.md", 1, ["a", "b"], "notes"),
      ...paragraph("notes/a.md", 1, ["a", "c"], "notes"),
      ...paragraph("notes/a.md", 2, ["a", "c"], "notes"),
      ...paragraph("notes/a.md", 3, ["a", "d"], "notes"),
      ...paragraph("notes/a.md", 1, ["a", "b"], "specs"),
      ...paragraph("notes/a.md", 2, ["a", "b"], "specs"),
      ...paragraph("notes/a.md", 3, ["a", "b"], "specs"),
    ];
    expect(neighbours(spread, 1)["a"]).toEqual([{ id: "b", count: 3 }]);
    // With K = 2 the row holds up to four neighbours and is never trimmed.
    expect(neighbours(occurrences, 2)["a"]).toEqual([
      { id: "b", count: 4 },
      { id: "c", count: 2 },
    ]);
  });

  it("keeps a neighbour that stays among the best through every trim", () => {
    const occurrences = [
      ...paragraph("notes/a.md", 1, ["a", "b"]),
      ...paragraph("notes/a.md", 2, ["a", "b"]),
      ...paragraph("notes/a.md", 3, ["a", "c"]),
      ...paragraph("notes/a.md", 4, ["a", "d"]),
      ...paragraph("notes/a.md", 5, ["a", "e"]),
      ...paragraph("notes/a.md", 6, ["a", "f"]),
      ...paragraph("notes/a.md", 7, ["a", "b"]),
    ];
    expect(neighbours(occurrences, 1)["a"]).toEqual([{ id: "b", count: 3 }]);
  });

  it("keeps the true best K of a seeded corpus where frequent pairs stand out", () => {
    const next = generator(11);
    const hubs = Array.from({ length: 6 }, (_, n) => `e/hub-${String(n)}`);
    const rare = (): string => `e/rare-${String(Math.floor(300 * next())).padStart(3, "0")}`;
    const occurrences: OccurrenceLike[] = [];
    // An overview names the core entities together before the body paragraphs mix them with others.
    for (let line = 1; line <= 5; line += 1) {
      occurrences.push(...paragraph("notes/a.md", line, hubs));
    }
    for (let line = 1; line <= 400; line += 1) {
      const ids = new Set<string>();
      while (ids.size < 2) ids.add(hubs[Math.floor(6 * next())] ?? "");
      while (ids.size < 6) ids.add(rare());
      occurrences.push(...paragraph("notes/b.md", line, [...ids]));
    }
    const k = 5;
    const exact = bruteForce(occurrences, k);
    const rows = bruteForce(occurrences, Number.POSITIVE_INFINITY);
    const result = accumulateCooccurrences(occurrences, { k }).nodes;

    // Every row of a hub was trimmed, and every one keeps its true best five with exact counts.
    for (const hub of hubs) {
      expect(rows.get(hub)?.length).toBeGreaterThan(2 * k);
      expect(result.get(hub)).toEqual(exact.get(hub));
    }
    expect(result.size).toBe(exact.size);
    let untrimmed = 0;
    for (const [id, neighbours] of result) {
      const truth = new Map(rows.get(id)?.map((neighbour) => [neighbour.id, neighbour.count]));
      expect(neighbours.length).toBeLessThanOrEqual(k);
      // A row that never grew past 2K is the exact best K; a trimmed row never overcounts.
      if (truth.size <= 2 * k) {
        untrimmed += 1;
        expect(neighbours).toEqual(exact.get(id));
      }
      for (const neighbour of neighbours) {
        expect(neighbour.count).toBeLessThanOrEqual(truth.get(neighbour.id) ?? 0);
      }
    }
    expect(untrimmed).toBeGreaterThan(0);
    expect(untrimmed).toBeLessThan(result.size);
  });

  it("pairs only the first 200 identifiers of a paragraph", () => {
    const ids = Array.from({ length: 201 }, (_, n) => `e/${String(200 - n).padStart(3, "0")}`);
    const result = accumulateCooccurrences(paragraph("notes/list.md", 1, ids), { k: 300 });
    expect(result.nodes.size).toBe(200);
    expect(result.nodes.has("e/200")).toBe(false);
    expect(result.nodes.get("e/000")?.length).toBe(199);
    expect(result.nodes.get("e/199")?.length).toBe(199);
  });
});
