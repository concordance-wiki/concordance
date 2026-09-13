import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { siteDocuments } from "../../../src/build/site.js";
import { componentsStylesheet } from "../../../src/css/stylesheet.js";
import { buildGallery } from "../../../src/gallery/build.js";
import {
  corporateEntityPage,
  corporateEntityPageMap,
  neighbourhood,
  neighbourhoodFull,
  neighbourhoodOverflow,
} from "../../../src/gallery/fixtures.js";
import { LABEL_MAX } from "../../../src/neighbourhood/layout.js";
import { renderSlot } from "../../../src/render.js";
import { GLYPH_SHAPES, initialOfGlyph, shapeOfGlyph } from "../../../src/theme/default/glyphs.js";
import {
  defaultNeighbourhoodLabels,
  NEIGHBOURHOOD_LIST,
  typesOf,
} from "../../../src/theme/default/neighbourhood.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import type { Neighbour } from "../../../src/slots.js";
import { fragments, model, profile, tokenize } from "../../build/fixture.js";
import { count, expectBalanced } from "../../helpers/html.js";
import { NEIGHBOURHOOD_ICON } from "../../helpers/neighbourhood-icon.js";

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
      '<h2 id="neighbourhood-title">Neighbourhood map <span class="neighbourhood-centre">Keyword page</span></h2>',
    );
    expect(html).toContain(
      '<p class="neighbourhood-list-head"><span class="section-label">The 2 neighbours</span><span class="neighbourhood-equivalent">textual equivalent</span></p><ul id="neighbourhood-list" class="neighbour-list">',
    );
    expect(html).toContain(
      '<li class="neighbour" data-type="1"><a href="../page/">page</a><span class="neighbour-type">term</span><span class="weight">12</span></li>',
    );
    expect(html).toContain(
      '<li class="neighbour group-start"><a href="../mentions-panel/">Mentions panel</a><span class="relation">displays</span><span class="weight">4</span></li>',
    );
    expect(html).toContain(
      '</ul><p class="neighbourhood-note">Six neighbours at most, always named. Beyond that the map teaches nothing: the list takes over.</p></section>',
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

  it("says when there is no neighbour, points at the mentions panel and draws no map", () => {
    const html = render({ centre: "x", neighbours: [] });
    expect(html).toContain(
      '<p class="empty">No neighbour recorded. <a href="#mentions-title">See the mentions panel</a>.</p></section>',
    );
    expect(html).not.toContain("<figure");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("neighbourhood-controls");
    expect(html).not.toContain("neighbourhood-total");
  });
});

describe("Readable rendering of the neighbourhood map", () => {
  it("carries the label of every node in plain text next to it, the centre included", () => {
    const html = render(neighbourhoodFull);
    expect(html).toContain(
      '<figure class="neighbourhood-map" aria-describedby="neighbourhood-list"><svg class="neighbourhood-graph" viewBox="0 0 404 274" font-size="12" aria-hidden="true" focusable="false">',
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
      '<g class="map-centre"><circle class="map-shape" cx="202" cy="137" r="10"></circle><text class="map-label" x="202" y="158" dy="0.35em" text-anchor="middle">Model query</text></g></svg>',
    );
    expect(html).not.toContain("<title>Model query</title>");
  });

  it("cuts a label beyond 28 characters with an ellipsis and keeps the full title in a title element and in the list", () => {
    const html = render(neighbourhoodFull);
    const full = "Identifier pattern: lowercase, hyphens, one slash";
    expect(full.length).toBeGreaterThan(LABEL_MAX);
    expect(html).toContain(
      `<text class="map-label" x="202" y="259" dy="0.35em" text-anchor="middle"><title>${full}</title>Identifier pattern: lowerca…</text>`,
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
      '<g class="map-node map-node-entity" data-weight="5" data-glyph="endpoint" data-type="1"><circle class="map-shape" cx="202" cy="33" r="6"></circle><use class="map-glyph" href="#glyph-hexagon" x="198" y="29" width="8" height="8"></use>',
    );
    expect(html).toContain(
      '<g class="map-node map-node-entity" data-weight="9" data-glyph="screen" data-type="2"><circle class="map-shape" cx="292" cy="189" r="6"></circle><use class="map-glyph" href="#glyph-rectangle"',
    );
    expect(html).toContain(
      'data-glyph="rule" data-type="3"><circle class="map-shape" cx="202" cy="241" r="6"></circle><use class="map-glyph" href="#glyph-shield"',
    );
    expect(html).toContain(
      '<g class="map-node map-node-keyword" data-weight="7" data-type="5"><rect class="map-shape" x="106" y="79" width="12" height="12" stroke-dasharray="4 3"></rect><text class="map-label"',
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
      'data-glyph="role" data-type="4"><circle class="map-shape" cx="112" cy="189" r="6"></circle><text class="map-glyph" x="112" y="189" dy="0.35em" text-anchor="middle">R</text>',
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
      '<line class="map-edge map-edge-keyword" x1="202" y1="137" x2="112" y2="85" stroke-dasharray="4 3" data-type="5"></line>',
    );
    expect(count(html, '<line class="map-edge"')).toBe(5);
    expect(count(html, "stroke-dasharray")).toBe(2);
    expect(html).toContain(
      '<line class="map-edge" x1="202" y1="137" x2="202" y2="33" data-type="1"></line>',
    );
    const edges = html.indexOf('<line class="map-edge"');
    const nodes = html.indexOf('<g class="map-node');
    expect(edges).toBeLessThan(nodes);
    expect(html.lastIndexOf("<line ")).toBeLessThan(nodes);
  });

  it("draws the map of the neighbours listed when the model holds more, and says the total under it before the list", () => {
    const html = render(neighbourhoodOverflow);
    expect(html).toContain("<svg");
    expect(html).toContain("neighbourhood-controls");
    expect(html).toContain(
      '</figure><p class="neighbourhood-total">14 neighbours in total, more than the map shows.</p><p class="neighbourhood-list-head"><span class="section-label">The 6 neighbours</span>',
    );
    expect(html).not.toContain("#mentions-title");
    expect(count(html, '<g class="map-node')).toBe(6);
    expect(html.match(/<li class="neighbour[ "]/g)).toHaveLength(6);
    expect(html).toContain('<p class="neighbourhood-note">Six neighbours at most');
    expectBalanced(html);
  });

  it("draws the map from one neighbour on and says no total when every neighbour of the model is shown or the total is unknown", () => {
    expect(render(neighbourhoodFull)).not.toContain("neighbourhood-total");
    expect(render({ ...neighbourhoodFull, total: 5 })).not.toContain("neighbourhood-total");
    const unknown = { centre: neighbourhoodFull.centre, neighbours: neighbourhoodFull.neighbours };
    expect(render(unknown)).not.toContain("neighbourhood-total");
    expect(render({ ...neighbourhoodFull, total: 7 })).toContain(
      '<p class="neighbourhood-total">7 neighbours in total, more than the map shows.</p>',
    );
    const one = render({ centre: "check", neighbours: [neighbour(0)], total: 9 });
    expect(one).toContain("<svg");
    expect(one).toContain(
      '<p class="neighbourhood-total">9 neighbours in total, more than the map shows.</p>',
    );
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
    expect(html.slice(end + "</figure>".length, list)).toBe(
      '<p class="neighbourhood-list-head"><span class="section-label">The 6 neighbours</span><span class="neighbourhood-equivalent">textual equivalent</span></p>',
    );
    expect(html.slice(list)).not.toContain("hidden");
    expect(
      html.endsWith(
        '</ul><p class="neighbourhood-note">Six neighbours at most, always named. Beyond that the map teaches nothing: the list takes over.</p></section>',
      ),
    ).toBe(true);
    expect(count(html, "aria-hidden")).toBe(1);
    expect(html).toContain(
      '<figcaption><span class="visually-hidden">Neighbourhood map. The list below carries the same information as the map.</span><span class="map-legend"><span class="map-legend-entity">existing page</span><span class="map-legend-keyword">word without a note</span></span></figcaption></figure>',
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
      '<li class="neighbour" data-type="1"><a href="../term-0/">Mentions panel</a><span class="neighbour-type">Écran</span><span class="relation">est accédé par</span><span class="weight">1</span></li>',
    );
    expect(html).toContain(
      '<li class="neighbour neighbour-noteless" data-type="2"><a href="../term-1/">build summary</a><span class="neighbour-type">Mot-clé</span><span class="weight">2</span></li>',
    );
    expect(html).toContain(
      '<li class="neighbour"><a href="../term-2/">Page</a><span class="relation">broader</span><span class="weight">3</span></li>',
    );
    const list = html.slice(
      html.indexOf('<ul id="neighbourhood-list"'),
      html.indexOf('<p class="neighbourhood-note">'),
    );
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
        { name: "search", file: "search-00000000.js", bytes: 0 },
        { name: "toc", file: "toc-00000000.js", bytes: 0 },
        { name: "trail", file: "trail-00000000.js", bytes: 0 },
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

describe("The neighbourhood map in the panel", () => {
  it("shows the distance the model records, one hop, before a type filter served as a disclosure of checkboxes all ticked, each labelled with its type and its count", () => {
    const html = render(neighbourhoodFull);
    expect(html).toContain(
      '</h2><div class="neighbourhood-controls"><p class="neighbourhood-distance"><span class="neighbourhood-distance-label">Distance</span><span class="neighbourhood-hop" aria-current="true">1 hop</span></p><details class="related-types neighbourhood-types"><summary>Types</summary><div class="related-type-menu"><ul class="related-type-list">',
    );
    expect(html).toContain(
      '<li class="neighbourhood-type"><input type="checkbox" id="neighbourhood-type-1" checked/><label for="neighbourhood-type-1">Endpoint <span class="count">2</span></label></li><li class="neighbourhood-type"><input type="checkbox" id="neighbourhood-type-2" checked/><label for="neighbourhood-type-2">Screen <span class="count">1</span></label></li>',
    );
    expect(html).toContain(
      '<label for="neighbourhood-type-5">Keyword <span class="count">1</span></label></li></ul></div></details></div><figure',
    );
    expect(count(html, '<input type="checkbox"')).toBe(5);
    expect(count(html, "checked")).toBe(5);
  });

  it("ranks the types in the order they first appear and writes the rank on the edge, the node and the row of every neighbour of that type, nothing on a neighbour without a type", () => {
    expect(typesOf(neighbourhoodFull.neighbours)).toEqual([
      { label: "Endpoint", count: 2, rank: 1 },
      { label: "Screen", count: 1, rank: 2 },
      { label: "Rule", count: 1, rank: 3 },
      { label: "Role", count: 1, rank: 4 },
      { label: "Keyword", count: 1, rank: 5 },
    ]);
    expect(typesOf([])).toEqual([]);
    const html = render(neighbourhoodFull);
    expect(count(html, 'data-type="1"')).toBe(6);
    expect(count(html, 'data-type="5"')).toBe(3);
    const mixed = render({
      centre: "Keyword page",
      neighbours: [neighbour(0, { typeLabel: "Term" }), neighbour(1)],
    });
    expect(mixed).toContain(
      '<line class="map-edge" x1="160" y1="97" x2="160" y2="33" data-type="1"></line><line class="map-edge" x1="160" y1="97" x2="160" y2="161"></line>',
    );
    expect(count(mixed, "data-type")).toBe(3);
    expect(mixed).toContain('<li class="neighbour"><a href="../term-1/">term 1</a>');
    expect(mixed).not.toContain("neighbourhood-type-2");
  });

  it("draws the legend under the map, a plain rule for an existing page and a dashed one for a word without a note, the caption kept for assistive technology", () => {
    const html = render(neighbourhoodFull);
    expect(html).toContain(
      '<figcaption><span class="visually-hidden">Neighbourhood map. The list below carries the same information as the map.</span><span class="map-legend"><span class="map-legend-entity">existing page</span><span class="map-legend-keyword">word without a note</span></span></figcaption>',
    );
    const css = componentsStylesheet();
    expect(css).toContain(
      '.map-legend-entity::before,\n.map-legend-keyword::before {\n  content: "";',
    );
    expect(css).toContain(".map-legend-keyword::before {\n  border-block-end-style: dashed;\n}");
    expect(css).toContain(
      '.neighbour::before {\n  content: "●" / "";\n  flex: none;\n  color: var(--color-accent);',
    );
    expect(css).not.toContain("◌");
  });

  it("hides the nodes, edges and rows of an unticked type from the stylesheet alone, one rule per rank up to the twelve nodes the map may hold", () => {
    const css = componentsStylesheet();
    for (let rank = 1; rank <= 12; rank += 1) {
      expect(css).toContain(
        `.neighbourhood:has(.neighbourhood-type:nth-child(${String(rank)}) > input:not(:checked)) [data-type="${String(rank)}"]`,
      );
    }
    expect(css).not.toContain('[data-type="13"]');
    expect(css).toContain('[data-type="12"] {\n  display: none;\n}');
  });

  it("heads the list with the number of neighbours and the words textual equivalent, then closes on the note saying why the map stops at six", () => {
    const html = render(neighbourhoodFull);
    expect(html).toContain(
      '</figure><p class="neighbourhood-list-head"><span class="section-label">The 6 neighbours</span><span class="neighbourhood-equivalent">textual equivalent</span></p><ul id="neighbourhood-list"',
    );
    expect(render({ centre: "Keyword page", neighbours: [neighbour(0)] })).toContain(
      '<span class="section-label">The neighbour</span>',
    );
    expect(defaultNeighbourhoodLabels(1, 1).neighbours).toBe("The neighbour");
    expect(defaultNeighbourhoodLabels(6, 14)).toMatchObject({
      neighbours: "The 6 neighbours",
      total: "14 neighbours in total, more than the map shows",
      hop: "1 hop",
      types: "Types",
    });
  });

  it("writes the labels it receives in place of its own, every one of them", () => {
    const labels = {
      map: "Carte du voisinage",
      mapCaption: "La liste porte la même information.",
      distance: "Distance",
      hop: "1 saut",
      types: "Types",
      existingPage: "page existante",
      noteless: "mot sans définition",
      neighbours: "Les 6 voisins",
      textualEquivalent: "équivalent textuel",
      capNote: "Six voisins au plus.",
      noNeighbour: "Aucun voisin.",
      total: "14 voisins en tout",
      seeMentions: "voir le volet",
    };
    const html = render({ ...neighbourhoodFull, labels });
    for (const label of Object.values(labels).filter(
      (value) =>
        value !== labels.noNeighbour && value !== labels.total && value !== labels.seeMentions,
    )) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain(labels.total);
    expect(html).toContain(
      '<h2 id="neighbourhood-title">Carte du voisinage <span class="neighbourhood-centre">Model query</span></h2>',
    );
    expect(html).not.toContain("Neighbourhood map");
    const overflow = render({ ...neighbourhoodOverflow, labels });
    expect(overflow).toContain('<p class="neighbourhood-total">14 voisins en tout.</p>');
    expect(render({ centre: "x", neighbours: [], labels })).toContain(
      '<p class="empty">Aucun voisin. <a href="#mentions-title">voir le volet</a>.</p>',
    );
    expect(render({ ...neighbourhoodFull, labels: { hop: "1 saut" } })).toContain(
      '<span class="neighbourhood-hop" aria-current="true">1 saut</span></p><details class="related-types neighbourhood-types"><summary>Types</summary>',
    );
  });

  it("swaps the wording of the fold on its state from the stylesheet: the lead and the count closed, the back control, the title and the page name open; the heading of the section kept for assistive technology", () => {
    const css = componentsStylesheet();
    expect(css).toContain(
      ".neighbourhood-head,\n.neighbourhood-page,\n.neighbourhood-fold[open] > summary > .neighbourhood-lead,\n.neighbourhood-fold[open] > summary > .neighbourhood-count {\n  display: none;\n}",
    );
    expect(css).toContain(
      ".neighbourhood-fold[open] > summary > .neighbourhood-head {\n  display: inline;",
    );
    expect(css).toContain(
      '.neighbourhood-fold[open] > summary::before {\n  content: "◂" / "";\n  order: 0;',
    );
    expect(css).toContain(
      ".neighbourhood-fold .neighbourhood > h2 {\n  position: absolute;\n  inline-size: 1px;",
    );
  });

  it("replaces the blocks of the panel by the open map where the panel has a column, and leaves the phone and the tablet as they are", () => {
    const css = componentsStylesheet();
    const desktopStart = css.indexOf(
      "@media (min-width: 68.75rem) {",
      css.indexOf("/* Neighbourhood map, unfolded."),
    );
    const desktop = css.slice(desktopStart, css.indexOf("}\n}\n", desktopStart) + 4);
    expect(desktop).toBe(
      "@media (min-width: 68.75rem) {\n  .entity-side:has(> .neighbourhood-fold[open]) > .panel-block {\n    display: none;\n  }\n\n  .entity:has(> .entity-side > .neighbourhood-fold[open]) {\n    grid-template-columns: minmax(0, 1fr) 26.875rem;\n  }\n\n  .entity-with-space:has(> .entity-side > .neighbourhood-fold[open]) {\n    grid-template-columns: 16rem minmax(0, 1fr) 26.875rem;\n  }\n}\n",
    );
    expect(count(css, ".neighbourhood-fold[open]) > .panel-block")).toBe(1);
    const tabletStart = css.indexOf(
      "@media (43.75rem <= width < 68.75rem) {",
      css.indexOf("/* The neighbourhood, folded behind its line at the foot of the panel. */"),
    );
    const tablet = css.slice(
      tabletStart,
      css.indexOf("@media (min-width: 68.75rem) {", tabletStart),
    );
    expect(tablet).toContain(".entity-side > .neighbourhood-fold {\n    grid-area: 7 / 1 / 8 / 3;");
    expect(tablet).not.toContain("neighbourhood-fold[open]");
  });

  it("serves the corporate page with the fold open in the gallery, six neighbours with a word without a note, and passes the accessibility checker", async () => {
    const fileSystem = memoryFileSystem();
    const report = await buildGallery({ output: "/out", theme: defaultTheme, fileSystem });
    expect(report.problems).toEqual([]);
    const html = fileSystem.readText("/out/entity-page-map.html");
    expect(html).toContain("<title>EntityPage, map</title>");
    expect(html).toContain(
      `<details class="neighbourhood-fold" open><summary>${NEIGHBOURHOOD_ICON}<span class="neighbourhood-lead">See the neighbourhood map</span><span class="neighbourhood-count">6 pages</span><span class="count panel-count neighbourhood-number">6</span><span class="neighbourhood-head">Neighbourhood map</span><span class="neighbourhood-page">Publication threshold</span></summary>`,
    );
    expect(count(html, '<g class="map-node')).toBe(6);
    expect(count(html, '<g class="map-node map-node-keyword"')).toBe(1);
    expect(html.match(/<li class="neighbour[ "]/g)).toHaveLength(6);
    expect(count(html, '<li class="neighbourhood-type">')).toBe(6);
    expect(html).toContain('<span class="section-label">The 6 neighbours</span>');
    expect(html).toContain("Publication threshold</text>");
    expect(corporateEntityPageMap.neighbours.neighbours).toHaveLength(6);
    expect(corporateEntityPage.neighbours.neighbours).toHaveLength(5);
    expect(fileSystem.readText("/out/entity-page-corporate.html")).not.toContain(
      '<details class="neighbourhood-fold" open>',
    );
  });
});
