import { describe, expect, it } from "vitest";

import { shortestPath, within } from "../../src/query/graph.js";
import { entity, link, model } from "./fixture.js";

const a = entity("notes/a");
const b = entity("notes/b");
const c = entity("notes/c");
const d = entity("notes/d");
const e = entity("notes/e");
const provenance = [{ method: "explicit_link" as const, confidence: 0.6 }];

describe("shortestPath walks the links in either direction", () => {
  it("finds the fewest links first, walking against a link when it must, and names the way", () => {
    const graph = model(
      [a, b, c, d],
      [
        link(a.id, b.id, provenance, { relation: "cites", confidence: 0.6 }),
        link(c.id, b.id, provenance, { relation: "affects", confidence: 0.7 }),
        link(a.id, d.id, provenance, { confidence: 0.9 }),
        link(d.id, e.id, provenance, { confidence: 0.9 }),
      ],
    );
    expect(shortestPath(graph, a, c, 4)).toEqual({
      entities: [a, b, c],
      steps: [
        { from: a.id, to: b.id, relation: "cites", confidence: 0.6, direction: "out" },
        { from: b.id, to: c.id, relation: "affects", confidence: 0.7, direction: "in" },
      ],
    });
    expect(shortestPath(graph, a, a, 4)).toEqual({ entities: [a], steps: [] });
  });

  it("prefers, among ways of one length, the highest sum of confidences, then the first identifiers", () => {
    const graph = model(
      [a, b, c, d],
      [
        link(a.id, b.id, provenance, { confidence: 0.4 }),
        link(b.id, d.id, provenance, { confidence: 0.4 }),
        link(a.id, c.id, provenance, { confidence: 0.5 }),
        link(c.id, d.id, provenance, { confidence: 0.5 }),
      ],
    );
    expect(shortestPath(graph, a, d, 4)?.entities.map((node) => node.id)).toEqual([
      a.id,
      c.id,
      d.id,
    ]);
    const even = model(
      [a, b, c, d],
      [
        link(a.id, c.id, provenance, { confidence: 0.5 }),
        link(c.id, d.id, provenance, { confidence: 0.5 }),
        link(a.id, b.id, provenance, { confidence: 0.5 }),
        link(b.id, d.id, provenance, { confidence: 0.5 }),
      ],
    );
    expect(shortestPath(even, a, d, 4)?.entities.map((node) => node.id)).toEqual([
      a.id,
      b.id,
      d.id,
    ]);
  });

  it("stops at the depth, and finds nothing for an entity out of reach or a link to an entity outside the model", () => {
    const graph = model(
      [a, b, c, e],
      [
        link(a.id, b.id, provenance),
        link(b.id, c.id, provenance),
        link(c.id, "gone/note", provenance),
      ],
    );
    expect(shortestPath(graph, a, c, 1)).toBeUndefined();
    expect(shortestPath(graph, a, c, 2)?.steps).toHaveLength(2);
    expect(shortestPath(graph, a, e, 4)).toBeUndefined();
    expect(shortestPath(graph, e, a, 4)).toBeUndefined();
  });

  it("lists what lies within a radius, the closest first, the best way's confidences deciding among equals", () => {
    const graph = model(
      [a, b, c, d, e],
      [
        link(a.id, b.id, provenance, { confidence: 0.4 }),
        link(c.id, a.id, provenance, { confidence: 0.9 }),
        link(b.id, d.id, provenance, { confidence: 0.5 }),
        link(c.id, d.id, provenance, { confidence: 0.5 }),
        link(d.id, "gone/note", provenance),
        link(d.id, e.id, provenance),
      ],
    );
    expect(within(graph, a, 2).map((reach) => [reach.entity.id, reach.depth, reach.score])).toEqual(
      [
        [c.id, 1, 0.9],
        [b.id, 1, 0.4],
        [d.id, 2, 1.4],
      ],
    );
    expect(within(graph, a, 1).map((reach) => reach.entity.id)).toEqual([c.id, b.id]);
    expect(within(graph, e, 3).map((reach) => reach.entity.id)).toEqual([d.id, b.id, c.id, a.id]);
    expect(within(model([a, e]), e, 2)).toEqual([]);
  });
});
