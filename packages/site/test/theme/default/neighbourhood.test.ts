import { describe, expect, it } from "vitest";

import { siteDocuments } from "../../../src/build/site.js";
import {
  neighbourhood,
  neighbourhoodFull,
  neighbourhoodOverflow,
} from "../../../src/gallery/fixtures.js";
import { LABEL_MAX } from "../../../src/neighbourhood/layout.js";
import { renderSlot } from "../../../src/render.js";
import { GLYPH_SHAPES, initialOfGlyph, shapeOfGlyph } from "../../../src/theme/default/glyphs.js";
import { NEIGHBOURHOOD_LIST } from "../../../src/theme/default/neighbourhood.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import type { Neighbour } from "../../../src/slots.js";
import { fragments, model, profile, tokenize } from "../../build/fixture.js";
import { count, expectBalanced } from "../../helpers/html.js";

function render(props: Parameters<typeof renderSlot<"Neighbourhood">>[1]): string {
  return renderSlot("Neighbourhood", props, defaultTheme);
}

function neighbour(index: number, overrides: Partial<Neighbour> = {}): Neighbour {
  return {
    id: `glossary/term-${String(index)}`,
    label: `term ${String(index)}`,
    href: `../term-${String(index)}/`,
    weight: index + 1,
    ...overrides,
  };
}

describe("Neighbourhood", () => {
  it("lists every neighbour with its type, relation and weight, as the textual equivalent of the map", () => {
    const html = render(neighbourhood);
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
    const html = render({ centre: "Model query", neighbours });
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
    const html = render({ centre: "Keyword page", neighbours: [neighbour(0), neighbour(1)] });
    expect(html).not.toContain("group-start");
    expect(html.match(/<li class="neighbour">/g)).toHaveLength(2);
  });

  it("says when there is no neighbour and draws no map", () => {
    const html = render({ centre: "x", neighbours: [] });
    expect(html).toContain('<p class="empty">No neighbour recorded.</p>');
    expect(html).not.toContain("<figure");
    expect(html).not.toContain("<svg");
  });
});

describe("Readable rendering of the neighbourhood map", () => {
  it("carries the label of every node in plain text next to it, the centre included", () => {
    const html = render(neighbourhoodFull);
    expect(html).toContain(
      '<figure class="neighbourhood-map" aria-describedby="neighbourhood-list"><svg class="neighbourhood-graph" viewBox="0 0 372 236" font-size="12" aria-hidden="true" focusable="false">',
    );
    expect(count(html, '<g class="map-node')).toBe(6);
    expect(count(html, '<text class="map-label"')).toBe(7);
    for (const { label } of neighbourhoodFull.neighbours.slice(0, 3)) {
      expect(html).toMatch(
        new RegExp(
          `<text class="map-label" x="\\d+" y="\\d+" dy="0.35em" text-anchor="(start|middle|end)">${label}</text>`,
        ),
      );
    }
    expect(html).toContain(
      '<g class="map-centre"><circle class="map-shape" cx="186" cy="118" r="11"></circle><text class="map-label" x="186" y="140" dy="0.35em" text-anchor="middle">Model query</text></g></svg>',
    );
    expect(html).not.toContain("<title>Model query</title>");
  });

  it("cuts a label beyond 28 characters with an ellipsis and keeps the full title in a title element and in the list", () => {
    const html = render(neighbourhoodFull);
    const full = "Identifier pattern: lowercase, hyphens, one slash";
    expect(full.length).toBeGreaterThan(LABEL_MAX);
    expect(html).toContain(
      `<text class="map-label" x="186" y="221" dy="0.35em" text-anchor="middle"><title>${full}</title>Identifier pattern: lowerca…</text>`,
    );
    expect(html).toContain(`<a href="../identifier-pattern/">${full}</a>`);
    expect(count(html, "<title>")).toBe(1);
  });

  it("places the six nodes on a ring clockwise from the top with labels on the outer side, no label overlapping another", () => {
    const html = render(neighbourhoodFull);
    const nodes = [
      ...html.matchAll(
        /<(circle|rect) class="map-shape" (?:cx="(\d+)" cy="(\d+)"|x="(\d+)" y="(\d+)")/g,
      ),
    ];
    expect(nodes).toHaveLength(7);
    const anchors = [
      ...html.matchAll(/<text class="map-label"[^>]*text-anchor="(start|middle|end)"/g),
    ].map((match) => match[1]);
    expect(anchors).toEqual(["middle", "start", "start", "middle", "end", "end", "middle"]);
    expect(html).not.toMatch(/="-?\d+\.\d+"/);
  });

  it("carries the type by shape and glyph: a circle holding the shape of the glyph name for an entity, a dashed square for a noteless word", () => {
    const html = render(neighbourhoodFull);
    expect(html).toContain(
      '<g class="map-node map-node-entity" data-weight="5" data-glyph="endpoint"><circle class="map-shape" cx="186" cy="36" r="9"></circle><use class="map-glyph" href="#glyph-hexagon" x="181" y="31" width="10" height="10"></use>',
    );
    expect(html).toContain(
      '<g class="map-node map-node-entity" data-weight="9" data-glyph="screen"><circle class="map-shape" cx="257" cy="159" r="9"></circle><use class="map-glyph" href="#glyph-rectangle"',
    );
    expect(html).toContain(
      'data-glyph="rule"><circle class="map-shape" cx="186" cy="200" r="9"></circle><use class="map-glyph" href="#glyph-shield"',
    );
    expect(html).toContain(
      '<g class="map-node map-node-keyword" data-weight="7"><rect class="map-shape" x="106" y="68" width="18" height="18" stroke-dasharray="4 3"></rect><text class="map-label"',
    );
    expect(html).toContain(
      '<defs><symbol id="glyph-hexagon" viewBox="0 0 10 10"><path d="M5 .5 9.5 3v4L5 9.5.5 7V3z"></path></symbol><symbol id="glyph-rectangle" viewBox="0 0 10 10"><path d="M1 2h8v6H1z"></path></symbol><symbol id="glyph-shield" viewBox="0 0 10 10">',
    );
    expect(count(html, "<symbol ")).toBe(3);
    expect(html).not.toContain("fill=");
    expect(html).not.toContain("stroke=");
  });

  it("draws the initial of a glyph name the theme has no shape for, and no glyph on a node without a type glyph", () => {
    const html = render(neighbourhoodFull);
    expect(html).toContain(
      'data-glyph="role"><circle class="map-shape" cx="115" cy="159" r="9"></circle><text class="map-glyph" x="115" y="159" dy="0.35em" text-anchor="middle">R</text>',
    );
    expect(shapeOfGlyph("role")).toBeUndefined();
    expect(shapeOfGlyph("constructor")).toBeUndefined();
    expect(shapeOfGlyph("api")).toBe("hexagon");
    expect(initialOfGlyph("milestone")).toBe("M");
    expect(Object.keys(GLYPH_SHAPES)).toHaveLength(8);
    const plain = render({ centre: "check", neighbours: [neighbour(0)] });
    expect(plain).not.toContain("map-glyph");
    expect(plain).not.toContain("<defs>");
  });

  it("dashes the edge to a noteless word and draws the others plain", () => {
    const html = render(neighbourhoodFull);
    expect(html).toContain(
      '<line class="map-edge map-edge-keyword" x1="186" y1="118" x2="115" y2="77" stroke-dasharray="4 3"></line>',
    );
    expect(count(html, '<line class="map-edge"')).toBe(5);
    expect(count(html, "stroke-dasharray")).toBe(2);
    expect(html).toContain('<line class="map-edge" x1="186" y1="118" x2="186" y2="36"></line>');
  });

  it("replaces the map by a pointer to the mentions panel when the model holds more neighbours than shown, the list staying", () => {
    const html = render(neighbourhoodOverflow);
    expect(html).toContain(
      '</h2><p class="neighbourhood-overflow">14 neighbours in total, more than the map shows: <a href="#mentions-title">see the mentions panel</a>.</p><ul id="neighbourhood-list"',
    );
    expect(html).not.toContain("<figure");
    expect(html).not.toContain("<svg");
    expect(count(html, '<li class="neighbour')).toBe(6);
    expectBalanced(html);
  });

  it("draws the map when every neighbour of the model is shown, or when the total is unknown", () => {
    expect(render(neighbourhoodFull)).toContain("<svg");
    expect(render({ ...neighbourhoodFull, total: 5 })).toContain("<svg");
    const unknown = { centre: neighbourhoodFull.centre, neighbours: neighbourhoodFull.neighbours };
    expect(render(unknown)).toContain("<svg");
    expect(render({ ...neighbourhoodFull, total: 7 })).not.toContain("<svg");
  });

  it("keeps integer coordinates from one to twelve nodes and never overlaps two labels", () => {
    for (let size = 1; size <= 12; size += 1) {
      const neighbours = Array.from({ length: size }, (_, index) =>
        neighbour(
          index,
          index % 3 === 0 ? { label: `Publication threshold review ${String(index)}` } : {},
        ),
      );
      const html = render({ centre: "Neighbourhood cap", neighbours });
      expect(html).not.toMatch(/="-?\d+\.\d+"/);
      expect(count(html, '<g class="map-node')).toBe(size);
      expect(count(html, '<line class="map-edge"')).toBe(size);
    }
  });
});

describe("The textual equivalent of the neighbourhood map", () => {
  it("is right after the figure inside the same section, not hidden, the figure hidden from assistive technologies and described by it", () => {
    expect(NEIGHBOURHOOD_LIST).toBe("neighbourhood-list");
    const html = render(neighbourhoodFull);
    const figure = html.indexOf(
      '<figure class="neighbourhood-map" aria-describedby="neighbourhood-list">',
    );
    const svg = html.indexOf('aria-hidden="true" focusable="false">');
    const end = html.indexOf("</figure>");
    const list = html.indexOf('<ul id="neighbourhood-list" class="neighbour-list">');
    expect(figure).toBeGreaterThan(html.indexOf("</h2>"));
    expect(svg).toBeGreaterThan(figure);
    expect(end).toBeGreaterThan(svg);
    expect(html.slice(end + "</figure>".length, list)).toBe("");
    expect(html.slice(list)).not.toContain("hidden");
    expect(html.endsWith("</ul></section>")).toBe(true);
    expect(count(html, "aria-hidden")).toBe(1);
    expect(html).toContain(
      "<figcaption>Map of the neighbourhood. The list below carries the same information as the map.</figcaption></figure>",
    );
  });

  it("names in each entry the entity, its type and the nature of the link, with the wording of the view model only", () => {
    const neighbours: Neighbour[] = [
      neighbour(0, {
        label: "Mentions panel",
        typeLabel: "Écran",
        relation: "est accédé par",
        kind: "entity",
        typeGlyph: "screen",
      }),
      neighbour(1, { label: "build summary", typeLabel: "Mot-clé", kind: "keyword" }),
      neighbour(2, { label: "Page", relation: "broader" }),
    ];
    const html = render({ centre: "Page mot-clé", neighbours });
    expect(html).toContain(
      '<li class="neighbour"><a href="../term-0/">Mentions panel</a><span class="badge">Écran</span><span class="relation">est accédé par</span><span class="weight">1</span></li>',
    );
    expect(html).toContain(
      '<li class="neighbour"><a href="../term-1/">build summary</a><span class="badge">Mot-clé</span><span class="weight">2</span></li>',
    );
    expect(html).toContain(
      '<li class="neighbour"><a href="../term-2/">Page</a><span class="relation">broader</span><span class="weight">3</span></li>',
    );
    const list = html.slice(html.indexOf('<ul id="neighbourhood-list"'));
    const text = list
      .replaceAll(/<[^>]+>/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim();
    expect(text).toBe(
      "Mentions panel Écran est accédé par 1 build summary Mot-clé 2 Page broader 3",
    );
    expect(list).not.toContain("keyword");
    expect(list).not.toContain("screen");
    expect(list).not.toContain("entity");
  });
});

describe("The list of neighbours is indexed by search", () => {
  it("stays in the text content of the served page, every entry with its entity, type and relation, where the search index of the page body reads it", () => {
    const { documents } = siteDocuments(
      {
        model: model(),
        fragments,
        profile,
        theme: defaultTheme,
        locale: "en",
        projectName: "Concordance notes",
        tokenize,
      },
      [
        { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 0 },
        { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 0 },
        { name: "search", file: "search-00000000.js", bytes: 0, classic: true },
      ],
    );
    const page = documents.find((document) => document.path === "glossary/keyword-page/index.html");
    const html = page?.content ?? "";
    const list = html.slice(
      html.indexOf('<ul id="neighbourhood-list"'),
      html.indexOf("</ul>", html.indexOf('<ul id="neighbourhood-list"')),
    );
    const text = list
      .replaceAll(/<[^>]+>/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim();
    expect(text).toBe(
      "Page Term broader 2 Mentions panel Screen displays 4 build summary Keyword unknown_relation 1",
    );
    const body = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
    for (const entry of ["Page", "Term", "Mentions panel", "Screen", "build summary", "Keyword"]) {
      expect(body).toContain(entry);
    }
    expect(html).toContain(
      '<figure class="neighbourhood-map" aria-describedby="neighbourhood-list">',
    );
  });
});
