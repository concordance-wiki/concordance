import { describe, expect, it } from "vitest";

import {
  contains,
  intersects,
  LABEL_MAX,
  layoutNeighbourhood,
  truncate,
  type Box,
  type Layout,
} from "../../src/neighbourhood/layout.js";

const identity = (title: string): string => title;

function layout(centre: string, titles: string[]): Layout<string> {
  return layoutNeighbourhood(centre, titles, identity);
}

function boxes(placed: Layout<string>): Box[] {
  return [placed.centre.label.box, ...placed.nodes.map((node) => node.label.box)];
}

function viewBox(placed: Layout<string>): Box {
  return { left: 0, top: 0, right: placed.width, bottom: placed.height };
}

const SHORT = [
  "check",
  "finding",
  "build log",
  "Mentions panel",
  "Keyword page",
  "source",
  "provenance",
  "linter",
  "profile",
  "determinism",
  "Alphabetical index",
  "Search results",
];

const LONG = [
  "Publication threshold of the keyword pages",
  "Section headings matched without case or accents",
  "Identifiers derived from paths",
  "Cross-source links off by default",
  "Rejected terms never proposed again",
  "Twin size ratio under one half",
  "Fail-on policy of the build",
  "Staleness threshold of one hundred and eighty days",
  "Related relation capped at six tenths",
  "Keyword page identifier",
  "Markdown links are authoritative",
  "Static site with islands of interactivity",
];

describe("layoutNeighbourhood", () => {
  it("places the centre in the middle and the neighbours on a ring in rank order, clockwise from the top", () => {
    const placed = layout("Entity page", ["first", "second", "third", "fourth"]);
    const { centre, nodes } = placed;
    expect(centre.x).toBe(placed.width / 2);
    expect(nodes.map((node) => node.item)).toEqual(["first", "second", "third", "fourth"]);
    const [top, right, bottom, left] = nodes;
    expect(top).toMatchObject({ x: centre.x, y: centre.y - 70 });
    expect(right).toMatchObject({ x: centre.x + 70, y: centre.y });
    expect(bottom).toMatchObject({ x: centre.x, y: centre.y + 70 });
    expect(left).toMatchObject({ x: centre.x - 70, y: centre.y });
  });

  it("puts a label right of a node on the right half, left of it on the left half, above and below at the poles, the centre's title under the centre", () => {
    const placed = layout("Entity page", ["first", "second", "third", "fourth"]);
    const [top, right, bottom, left] = placed.nodes;
    expect(top?.label).toMatchObject({ side: "above", anchor: "middle", x: top?.x });
    expect(top?.label.box.bottom).toBeLessThan(top?.y ?? 0);
    expect(right?.label).toMatchObject({ side: "right", anchor: "start", y: right?.y });
    expect(right?.label.box.left).toBeGreaterThan(right?.x ?? 0);
    expect(bottom?.label).toMatchObject({ side: "below", anchor: "middle", x: bottom?.x });
    expect(bottom?.label.box.top).toBeGreaterThan(bottom?.y ?? 0);
    expect(left?.label).toMatchObject({ side: "left", anchor: "end", y: left?.y });
    expect(left?.label.box.right).toBeLessThan(left?.x ?? 0);
    expect(placed.centre.label).toMatchObject({
      side: "below",
      anchor: "middle",
      text: "Entity page",
    });
    expect(placed.centre.label.box.top).toBeGreaterThan(placed.centre.y);
  });

  it("widens the ring with the number of nodes, between sixty and one hundred units", () => {
    const radius = (count: number): number => {
      const placed = layout("c", SHORT.slice(0, count));
      return placed.centre.y - (placed.nodes[0]?.y ?? 0);
    };
    expect(radius(1)).toBe(60);
    expect(radius(2)).toBe(60);
    expect(radius(6)).toBe(82);
    expect(radius(9)).toBe(100);
    expect(radius(12)).toBe(100);
  });

  it("positions labels without overlap and inside the viewBox on six-node cases, short and long titles, one to twelve nodes", () => {
    const cases: { centre: string; titles: string[] }[] = [];
    for (let count = 1; count <= 12; count += 1) {
      cases.push({ centre: "Concordance", titles: SHORT.slice(0, count) });
      cases.push({ centre: "Concordance", titles: LONG.slice(0, count) });
      cases.push({
        centre: "Cross-source links off by default",
        titles: SHORT.slice(0, count).map((title, index) =>
          index % 2 === 0 ? (LONG[index] ?? title) : title,
        ),
      });
    }
    expect(cases.filter((item) => item.titles.length === 6)).toHaveLength(3);
    for (const { centre, titles } of cases) {
      const placed = layout(centre, titles);
      const all = boxes(placed);
      const frame = viewBox(placed);
      for (const [index, box] of all.entries()) {
        expect(
          contains(frame, box),
          `${String(titles.length)} nodes: label ${String(index)} leaves the viewBox`,
        ).toBe(true);
        for (const other of all.slice(index + 1)) {
          expect(
            intersects(box, other),
            `${String(titles.length)} nodes: label ${String(index)} overlaps another`,
          ).toBe(false);
        }
      }
    }
  });

  it("pushes a label below the one it would overlap, the centre's title crowding a node near the horizontal", () => {
    const placed = layout("Cross-source links off by default", ["source", "link", "default"]);
    const [, right] = placed.nodes;
    expect(right?.label.side).toBe("right");
    expect(right?.label.y).toBeGreaterThan(right?.y ?? 0);
    expect(right?.label.box.top).toBe(placed.centre.label.box.bottom + 2);
    const all = boxes(placed);
    for (const [index, box] of all.entries()) {
      for (const other of all.slice(index + 1)) {
        expect(intersects(box, other)).toBe(false);
      }
    }
  });

  it("keeps every coordinate an integer, so that two builds give the same bytes", () => {
    for (let count = 1; count <= 12; count += 1) {
      const placed = layout("Concordance", LONG.slice(0, count));
      const numbers: number[] = [placed.width, placed.height];
      for (const node of [placed.centre, ...placed.nodes]) {
        const { box } = node.label;
        numbers.push(node.x, node.y, node.label.x, node.label.y);
        numbers.push(box.left, box.top, box.right, box.bottom);
      }
      expect(numbers.every(Number.isInteger)).toBe(true);
    }
  });

  it("never draws narrower than 320 units and grows with long labels on both sides", () => {
    expect(layout("c", ["a", "b"]).width).toBe(320);
    const wide = layout("Concordance", [
      LONG[0] ?? "",
      LONG[1] ?? "",
      LONG[2] ?? "",
      LONG[3] ?? "",
    ]);
    expect(wide.width).toBeGreaterThan(320);
    expect(wide.width % 2).toBe(0);
  });

  it("cuts a title beyond 28 characters with an ellipsis and keeps the full title next to it", () => {
    expect(LABEL_MAX).toBe(28);
    expect(truncate("Publication threshold")).toEqual({ text: "Publication threshold" });
    expect(truncate("Section headings matched wit")).toEqual({
      text: "Section headings matched wit",
    });
    expect(truncate("Section headings matched without case")).toEqual({
      text: "Section headings matched wi…",
      full: "Section headings matched without case",
    });
    expect(truncate("Épreuve du seuil de publication des mots")).toEqual({
      text: "Épreuve du seuil de publica…",
      full: "Épreuve du seuil de publication des mots",
    });
    const placed = layout("Concordance", ["Section headings matched without case"]);
    expect(placed.nodes[0]?.label).toMatchObject({
      text: "Section headings matched wi…",
      full: "Section headings matched without case",
    });
  });

  it("tells whether two boxes intersect and whether one contains another", () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 };
    expect(intersects(a, { left: 9, top: 9, right: 20, bottom: 20 })).toBe(true);
    expect(intersects(a, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(intersects(a, { left: 0, top: 10, right: 10, bottom: 20 })).toBe(false);
    expect(contains(a, { left: 2, top: 2, right: 8, bottom: 8 })).toBe(true);
    expect(contains(a, { left: 2, top: 2, right: 11, bottom: 8 })).toBe(false);
    expect(contains(a, { left: -1, top: 2, right: 8, bottom: 8 })).toBe(false);
  });
});
