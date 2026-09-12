import { describe, expect, it } from "vitest";

import { compareEntities, type Entity } from "../../src/model/entity.js";

function entity(id: string): Entity {
  return {
    id,
    type: "term",
    title: id,
    aliases: [],
    locale: "en",
    status: "valid",
    type_origin: "source",
    graph: "full",
    attributes: {},
    source: { name: "glossary", path: `${id}.md`, line: 1, last_modified: "2026-03-12T00:00:00Z" },
  };
}

describe("compareEntities", () => {
  it("orders entities by identifier in code unit order, independent of any locale", () => {
    const ids = ["specs/b", "specs/a-b", "specs/ab", "glossary/z", "specs/a", "specs/Z"];
    expect(
      ids
        .map(entity)
        .sort(compareEntities)
        .map((e) => e.id),
    ).toEqual(["glossary/z", "specs/Z", "specs/a", "specs/a-b", "specs/ab", "specs/b"]);
  });

  it("returns a negative, zero or positive number like a comparator", () => {
    expect(compareEntities(entity("specs/a"), entity("specs/b"))).toBe(-1);
    expect(compareEntities(entity("specs/b"), entity("specs/a"))).toBe(1);
    expect(compareEntities(entity("specs/a"), entity("specs/a"))).toBe(0);
  });
});
