import { describe, expect, it } from "vitest";

import { buildGraph } from "../../src/domains/graph.js";
import { comparePivots, selectPivots } from "../../src/domains/pivots.js";
import type { DomainEdge, DomainNode } from "../../src/domains/types.js";

const term = (id: string): DomainNode => ({ id, candidate: true, attachable: false });
const note = (id: string): DomainNode => ({ id, candidate: false, attachable: true });
const candidatesOf = (nodes: readonly DomainNode[]): Set<string> =>
  new Set(nodes.filter((node) => node.candidate).map((node) => node.id));

/** A star around `centre` with `count` leaves. */
function star(centre: string, count: number): DomainEdge[] {
  return Array.from({ length: count }, (_, index) => ({
    a: centre,
    b: `specs/${centre.slice(centre.indexOf("/") + 1)}-${String(index)}`,
  }));
}

describe("the pivots of the proposal", () => {
  it("keeps the candidates whose degree reaches the threshold, and never a note", () => {
    const edges = [
      ...star("glossary/finding", 3),
      ...star("glossary/check", 2),
      ...star("specs/build", 4),
    ];
    const nodes = [
      term("glossary/finding"),
      term("glossary/check"),
      note("specs/build"),
      ...edges.map((edge) => note(edge.b)),
    ];
    const graph = buildGraph(nodes, edges);
    const candidates = candidatesOf(nodes);
    expect(selectPivots(candidates, graph, 3)).toEqual([{ id: "glossary/finding", degree: 3 }]);
    expect(selectPivots(candidates, graph, 2)).toEqual([
      { id: "glossary/finding", degree: 3 },
      { id: "glossary/check", degree: 2 },
    ]);
    expect(selectPivots(candidates, graph, 4)).toEqual([]);
  });

  it("counts distinct neighbours, an edge repeated in both directions once", () => {
    const nodes = [term("glossary/finding"), note("specs/build")];
    const graph = buildGraph(nodes, [
      { a: "glossary/finding", b: "specs/build" },
      { a: "specs/build", b: "glossary/finding" },
    ]);
    expect(selectPivots(candidatesOf(nodes), graph, 1)).toEqual([
      { id: "glossary/finding", degree: 1 },
    ]);
    expect(selectPivots(candidatesOf(nodes), graph, 2)).toEqual([]);
  });

  it("gives a candidate without any edge the degree zero", () => {
    const nodes = [term("glossary/cue")];
    expect(selectPivots(candidatesOf(nodes), buildGraph(nodes, []), 1)).toEqual([]);
  });

  it("orders the pivots by degree, largest first, then by identifier in code-unit order", () => {
    const pivots = [
      { id: "glossary/b", degree: 2 },
      { id: "glossary/a", degree: 2 },
      { id: "glossary/Z", degree: 2 },
      { id: "glossary/c", degree: 5 },
    ];
    expect([...pivots].sort(comparePivots).map((pivot) => pivot.id)).toEqual([
      "glossary/c",
      "glossary/Z",
      "glossary/a",
      "glossary/b",
    ]);
  });
});
