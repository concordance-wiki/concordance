import { describe, expect, it } from "vitest";

import { buildGraph, distancesFrom } from "../../src/domains/graph.js";
import type { DomainNode } from "../../src/domains/types.js";

const node = (id: string): DomainNode => ({ id, candidate: false, attachable: false });

describe("the neighbourhood graph of the proposal", () => {
  it("joins both ends of every edge once, neighbours in code-unit order", () => {
    const graph = buildGraph(
      [node("glossary/note"), node("glossary/finding"), node("glossary/check")],
      [
        { a: "glossary/note", b: "glossary/finding" },
        { a: "glossary/finding", b: "glossary/note" },
        { a: "glossary/check", b: "glossary/finding" },
      ],
    );
    expect([...graph]).toEqual([
      ["glossary/note", ["glossary/finding"]],
      ["glossary/finding", ["glossary/check", "glossary/note"]],
      ["glossary/check", ["glossary/finding"]],
    ]);
  });

  it("drops an edge naming an unknown node or joining a node to itself", () => {
    const graph = buildGraph(
      [node("glossary/note"), node("glossary/check")],
      [
        { a: "glossary/note", b: "keywords/build-summary" },
        { a: "keywords/build-summary", b: "glossary/check" },
        { a: "glossary/note", b: "glossary/note" },
      ],
    );
    expect([...graph]).toEqual([
      ["glossary/note", []],
      ["glossary/check", []],
    ]);
  });

  it("walks breadth first up to the radius, the start at distance zero", () => {
    const graph = buildGraph(
      ["a", "b", "c", "d", "e"].map((id) => node(`glossary/${id}`)),
      [
        { a: "glossary/a", b: "glossary/b" },
        { a: "glossary/b", b: "glossary/c" },
        { a: "glossary/c", b: "glossary/d" },
        { a: "glossary/a", b: "glossary/c" },
      ],
    );
    expect([...distancesFrom(graph, "glossary/a", 2)]).toEqual([
      ["glossary/a", 0],
      ["glossary/b", 1],
      ["glossary/c", 1],
      ["glossary/d", 2],
    ]);
    expect([...distancesFrom(graph, "glossary/a", 1)]).toEqual([
      ["glossary/a", 0],
      ["glossary/b", 1],
      ["glossary/c", 1],
    ]);
    expect([...distancesFrom(graph, "glossary/e", 3)]).toEqual([["glossary/e", 0]]);
  });

  it("gives a start the graph does not know no neighbour", () => {
    expect([...distancesFrom(buildGraph([], []), "glossary/a", 3)]).toEqual([["glossary/a", 0]]);
  });

  it("stops when nothing is left to visit before the radius is spent", () => {
    const graph = buildGraph(
      [node("glossary/a"), node("glossary/b")],
      [{ a: "glossary/a", b: "glossary/b" }],
    );
    expect([...distancesFrom(graph, "glossary/a", 3)]).toEqual([
      ["glossary/a", 0],
      ["glossary/b", 1],
    ]);
  });
});
