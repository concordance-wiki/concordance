import { describe, expect, it } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { NEIGHBOURHOOD_LIST } from "../../../src/theme/default/neighbourhood.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { neighbourhood } from "../../../src/gallery/fixtures.js";
import { expectBalanced } from "../../helpers/html.js";

describe("Neighbourhood", () => {
  it("lists every neighbour with its type, relation and weight, as the textual equivalent of the map", () => {
    const html = renderSlot("Neighbourhood", neighbourhood, defaultTheme);
    expect(html).toContain(
      '<h2 id="neighbourhood-title">Neighbourhood <span class="neighbourhood-centre">Keyword page</span></h2>',
    );
    expect(html).toContain('<ul id="neighbourhood-list" class="neighbour-list">');
    expect(html).toContain(
      '<li class="neighbour"><a href="../page/">page</a><span class="badge">term</span><span class="weight">12</span></li>',
    );
    expect(html).toContain(
      '<a href="../mentions-panel/">Mentions panel</a><span class="relation">displays</span><span class="weight">4</span>',
    );
    expectBalanced(html);
  });

  it("renders the neighbours in the order it receives and separates the priority groups by rank", () => {
    const neighbours = [
      {
        id: "specs/api/model-query/get-entity",
        label: "getEntity",
        href: "../get-entity/",
        weight: 2,
        rank: 0,
      },
      {
        id: "specs/api/model-query/list-entities",
        label: "listEntities",
        href: "../list-entities/",
        weight: 5,
        rank: 0,
      },
      {
        id: "specs/screens/search",
        label: "Search results",
        href: "../search/",
        weight: 9,
        rank: 1,
      },
      { id: "glossary/endpoint", label: "endpoint", href: "../endpoint/", weight: 12, rank: 5 },
      {
        id: "words/build-summary",
        label: "build summary",
        href: "../build-summary/",
        weight: 7,
        rank: 5,
      },
    ];
    const html = renderSlot("Neighbourhood", { centre: "Model query", neighbours }, defaultTheme);
    const items = html.match(/<li class="neighbour[^"]*"><a href="[^"]+">[^<]+<\/a>/g) ?? [];
    expect(items).toEqual([
      '<li class="neighbour"><a href="../get-entity/">getEntity</a>',
      '<li class="neighbour"><a href="../list-entities/">listEntities</a>',
      '<li class="neighbour group-start"><a href="../search/">Search results</a>',
      '<li class="neighbour group-start"><a href="../endpoint/">endpoint</a>',
      '<li class="neighbour"><a href="../build-summary/">build summary</a>',
    ]);
  });

  it("draws no separator when the neighbours carry no rank", () => {
    const neighbours = [
      { id: "glossary/page", label: "page", href: "../page/", weight: 12 },
      { id: "glossary/note", label: "note", href: "../note/", weight: 4 },
    ];
    const html = renderSlot("Neighbourhood", { centre: "Keyword page", neighbours }, defaultTheme);
    expect(html).not.toContain("group-start");
    expect(html.match(/<li class="neighbour">/g)).toHaveLength(2);
  });

  it("draws a star map hidden from assistive technologies, described by the list, one row per neighbour side", () => {
    expect(NEIGHBOURHOOD_LIST).toBe("neighbourhood-list");
    const html = renderSlot("Neighbourhood", neighbourhood, defaultTheme);
    expect(html).toContain(
      '<figure class="neighbourhood-map" aria-describedby="neighbourhood-list"><svg class="neighbourhood-graph" viewBox="0 0 480 64" aria-hidden="true" focusable="false">',
    );
    expect(html).toContain('<line class="map-edge" x1="240" y1="32" x2="120" y2="32"></line>');
    expect(html).toContain('<line class="map-edge" x1="240" y1="32" x2="360" y2="32"></line>');
    expect(html).toContain(
      '<g class="map-node" data-weight="12"><circle cx="120" cy="32" r="5"></circle><text x="108" y="32" dy="0.35em" text-anchor="end">page</text></g>',
    );
    expect(html).toContain(
      '<g class="map-node" data-weight="4"><circle cx="360" cy="32" r="5"></circle><text x="372" y="32" dy="0.35em" text-anchor="start">Mentions panel</text></g>',
    );
    expect(html).toContain(
      '<g class="map-centre"><circle cx="240" cy="32" r="7"></circle><text x="240" y="44" dy="0.9em" text-anchor="middle">Keyword page</text></g></svg>',
    );
    expect(html).toContain(
      "<figcaption>Map of the neighbourhood. The list below carries the same information as the map.</figcaption></figure>",
    );
    expect(html.indexOf("</figure>")).toBeLessThan(html.indexOf('<ul id="neighbourhood-list"'));
  });

  it("adds a row every two neighbours and keeps integer coordinates", () => {
    const five = Array.from({ length: 5 }, (_, index) => ({
      id: `glossary/term-${String(index)}`,
      label: `term ${String(index)}`,
      href: `../term-${String(index)}/`,
      weight: index + 1,
    }));
    const html = renderSlot("Neighbourhood", { centre: "check", neighbours: five }, defaultTheme);
    expect(html).toContain('viewBox="0 0 480 128"');
    expect(html).toContain('<circle cx="240" cy="64" r="7"></circle>');
    expect(html).toContain('<circle cx="120" cy="96" r="5"></circle>');
    expect(html).toContain('<text x="108" y="96" dy="0.35em" text-anchor="end">term 4</text>');
    expect(html).not.toMatch(/="\d+\.\d+"/);
  });

  it("says when there is no neighbour and draws no map", () => {
    const html = renderSlot("Neighbourhood", { centre: "x", neighbours: [] }, defaultTheme);
    expect(html).toContain('<p class="empty">No neighbour recorded.</p>');
    expect(html).not.toContain("<figure");
    expect(html).not.toContain("<svg");
  });
});
