import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import {
  MAX_DISPLAYED_NEIGHBOURS,
  displayedNeighbourhood,
} from "../../src/display/neighbourhood.js";
import type { DisplayedNeighbour } from "../../src/display/types.js";
import { generator } from "../neighbourhood/fixtures.js";
import { entity, link, shuffled } from "./fixtures.js";

const profile = loadDefaultProfile();

function ids(neighbours: readonly DisplayedNeighbour[] | undefined): string[] {
  return (neighbours ?? []).map((neighbour) => neighbour.id);
}

describe("the displayed neighbourhood", () => {
  it("is computed at one hop, sorted by decreasing confidence then by identifier within a group", () => {
    const entities = [
      entity("specs/cap"),
      entity("specs/entry"),
      entity("specs/rate"),
      entity("specs/zone"),
      entity("specs/far"),
    ];
    const links = [
      link("specs/cap", "specs/zone", 0.4),
      link("specs/cap", "specs/rate", 0.9),
      link("specs/cap", "specs/entry", 0.4),
      link("specs/rate", "specs/far", 0.9),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(ids(neighbourhood.get("specs/cap"))).toEqual([
      "specs/rate",
      "specs/entry",
      "specs/zone",
    ]);
    expect(neighbourhood.get("specs/cap")).toEqual([
      {
        id: "specs/rate",
        title: "Rate",
        type: "screen",
        kind: "entity",
        relation: "related",
        direction: "out",
        confidence: 0.9,
        rank: 2,
      },
      {
        id: "specs/entry",
        title: "Entry",
        type: "screen",
        kind: "entity",
        relation: "related",
        direction: "out",
        confidence: 0.4,
        rank: 2,
      },
      {
        id: "specs/zone",
        title: "Zone",
        type: "screen",
        kind: "entity",
        relation: "related",
        direction: "out",
        confidence: 0.4,
        rank: 2,
      },
    ]);
  });

  it("shows six nodes at most; the number is configurable but capped", () => {
    const others = Array.from({ length: 14 }, (_, i) => `specs/n${String(i).padStart(2, "0")}`);
    const entities = [entity("specs/hub"), ...others.map((id) => entity(id))];
    const links = others.map((id, i) => link("specs/hub", id, 1 - i / 100));
    const withDefault = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(ids(withDefault.get("specs/hub"))).toEqual(others.slice(0, 6));
    const withNine = displayedNeighbourhood({ entities, links, profile, size: 9 });
    expect(ids(withNine.get("specs/hub"))).toEqual(others.slice(0, 9));
    const beyondTheCap = displayedNeighbourhood({ entities, links, profile, size: 14 });
    expect(MAX_DISPLAYED_NEIGHBOURS).toBe(12);
    expect(ids(beyondTheCap.get("specs/hub"))).toEqual(others.slice(0, 12));
  });

  it("makes typed entities and noteless words both eligible, and distinguishes them", () => {
    const entities = [
      entity("specs/cap"),
      entity("glossary/rate", "term"),
      entity("words/quota", "keyword", true),
    ];
    const links = [
      link("specs/cap", "glossary/rate", 0.6, "mentions"),
      link("specs/cap", "words/quota", 0.6, "mentions"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(neighbourhood.get("specs/cap")).toEqual([
      {
        id: "glossary/rate",
        title: "Rate",
        type: "term",
        kind: "entity",
        relation: "mentions",
        direction: "out",
        confidence: 0.6,
        rank: 6,
      },
      {
        id: "words/quota",
        title: "Quota",
        type: "keyword",
        kind: "keyword",
        relation: "mentions",
        direction: "out",
        confidence: 0.6,
        rank: 6,
      },
    ]);
  });

  it("is precomputed at build as a pure function of the model, one list per entity", () => {
    const entities = [entity("specs/b"), entity("specs/a"), entity("specs/c")];
    const links = [link("specs/a", "specs/b", 0.5)];
    const first = displayedNeighbourhood({ entities, links, profile, size: 6 });
    const second = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect([...first.keys()]).toEqual(["specs/a", "specs/b", "specs/c"]);
    expect(first).toEqual(second);
    expect(first.get("specs/c")).toEqual([]);
  });

  it("keeps the largest confidence over several links to the same neighbour", () => {
    const entities = [entity("specs/cap"), entity("specs/rate")];
    const links = [
      link("specs/cap", "specs/rate", 0.4, "related"),
      link("specs/cap", "specs/rate", 0.9, "reads"),
      link("specs/cap", "specs/rate", 0.6, "consumes"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(neighbourhood.get("specs/cap")?.[0]).toMatchObject({
      relation: "reads",
      confidence: 0.9,
      direction: "out",
    });
    expect(neighbourhood.get("specs/rate")?.[0]).toMatchObject({
      relation: "reads",
      confidence: 0.9,
      direction: "in",
    });
  });

  it("shows the first relation in code-unit order when several links tie on confidence", () => {
    const entities = [entity("specs/cap"), entity("specs/rate")];
    const links = [
      link("specs/cap", "specs/rate", 0.9, "reads"),
      link("specs/cap", "specs/rate", 0.9, "consumes"),
      link("specs/cap", "specs/rate", 0.9, "related"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(neighbourhood.get("specs/cap")?.[0]?.relation).toBe("consumes");
  });

  it("does not let a later link with a lower confidence and an earlier relation win", () => {
    const entities = [entity("specs/cap"), entity("specs/rate")];
    const links = [
      link("specs/cap", "specs/rate", 0.9, "reads"),
      link("specs/cap", "specs/rate", 0.5, "consumes"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(neighbourhood.get("specs/cap")?.[0]).toMatchObject({
      relation: "reads",
      confidence: 0.9,
    });
  });

  it("marks the direction out from the source, in from the target and both when links go each way", () => {
    const entities = [entity("specs/cap"), entity("specs/rate"), entity("specs/entry")];
    const links = [
      link("specs/cap", "specs/rate", 0.9, "reads"),
      link("specs/rate", "specs/cap", 0.5, "feeds"),
      link("specs/cap", "specs/entry", 0.7, "reads"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(neighbourhood.get("specs/cap")?.map((n) => [n.id, n.direction])).toEqual([
      ["specs/rate", "both"],
      ["specs/entry", "out"],
    ]);
    expect(neighbourhood.get("specs/rate")?.map((n) => [n.id, n.direction])).toEqual([
      ["specs/cap", "both"],
    ]);
    expect(neighbourhood.get("specs/entry")?.map((n) => [n.id, n.direction])).toEqual([
      ["specs/cap", "in"],
    ]);
  });

  it("keeps the direction of two links pointing the same way", () => {
    const entities = [entity("specs/cap"), entity("specs/rate")];
    const links = [
      link("specs/cap", "specs/rate", 0.9, "reads"),
      link("specs/cap", "specs/rate", 0.5, "consumes"),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(neighbourhood.get("specs/cap")?.[0]?.direction).toBe("out");
    expect(neighbourhood.get("specs/rate")?.[0]?.direction).toBe("in");
  });

  it("flags a noteless word as a keyword neighbour and a typed entity as an entity", () => {
    const entities = [entity("specs/cap"), entity("words/quota", "keyword", true)];
    const links = [link("words/quota", "specs/cap", 0.3, "mentions")];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(neighbourhood.get("specs/cap")?.[0]).toMatchObject({
      id: "words/quota",
      kind: "keyword",
      direction: "in",
    });
    expect(neighbourhood.get("words/quota")?.[0]).toMatchObject({
      id: "specs/cap",
      kind: "entity",
      direction: "out",
    });
  });

  it("truncates each list to the size after sorting", () => {
    const entities = [entity("specs/hub"), entity("specs/a"), entity("specs/b"), entity("specs/c")];
    const links = [
      link("specs/hub", "specs/a", 0.2),
      link("specs/hub", "specs/b", 0.8),
      link("specs/hub", "specs/c", 0.5),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 2 });
    expect(ids(neighbourhood.get("specs/hub"))).toEqual(["specs/b", "specs/c"]);
    expect(ids(neighbourhood.get("specs/a"))).toEqual(["specs/hub"]);
  });

  it("lists an entity without any neighbour with an empty list", () => {
    const entities = [entity("specs/alone"), entity("specs/cap"), entity("specs/rate")];
    const links = [link("specs/cap", "specs/rate", 0.5)];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect(neighbourhood.has("specs/alone")).toBe(true);
    expect(neighbourhood.get("specs/alone")).toEqual([]);
  });

  it("ignores a link whose end is not an entity of the model or which loops on its node", () => {
    const entities = [entity("specs/cap"), entity("specs/rate")];
    const links = [
      link("specs/cap", "specs/gone", 0.9),
      link("specs/gone", "specs/cap", 0.9),
      link("specs/cap", "specs/cap", 0.9),
      link("specs/cap", "specs/rate", 0.5),
    ];
    const neighbourhood = displayedNeighbourhood({ entities, links, profile, size: 6 });
    expect([...neighbourhood.keys()]).toEqual(["specs/cap", "specs/rate"]);
    expect(ids(neighbourhood.get("specs/cap"))).toEqual(["specs/rate"]);
  });

  it("gives the same result whatever the order of the entities and links", () => {
    const entities = Array.from({ length: 20 }, (_, i) =>
      entity(`specs/e${String(i).padStart(2, "0")}`, i % 3 === 0 ? "keyword" : "api", i % 3 === 0),
    );
    const next = generator(7);
    const relations = ["related", "reads", "consumes", "feeds"];
    const links = Array.from({ length: 120 }, () => {
      const from = entities[Math.floor(next() * entities.length)]?.id ?? "specs/e00";
      const to = entities[Math.floor(next() * entities.length)]?.id ?? "specs/e00";
      const confidence = Math.round(next() * 10) / 10;
      return link(from, to, confidence, relations[Math.floor(next() * relations.length)]);
    });
    const reference = displayedNeighbourhood({ entities, links, profile, size: 6 });
    const shuffle = generator(99);
    for (let round = 0; round < 5; round += 1) {
      const permuted = displayedNeighbourhood({
        entities: shuffled(entities, shuffle),
        links: shuffled(links, shuffle),
        profile,
        size: 6,
      });
      expect(permuted).toEqual(reference);
    }
    expect([...reference.values()].some((neighbours) => neighbours.length === 6)).toBe(true);
    expect(
      [...reference.values()].some((neighbours) =>
        neighbours.some((neighbour) => neighbour.direction === "both"),
      ),
    ).toBe(true);
  });
});
