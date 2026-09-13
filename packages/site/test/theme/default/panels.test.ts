import { renderToString } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";

import { renderSlot } from "../../../src/render.js";
import {
  MENTIONS_ISLAND,
  MENTIONS_MORE_LIST,
  MentionsMore,
} from "../../../src/theme/default/mentions-more.js";
import { NEIGHBOURHOOD_LIST } from "../../../src/theme/default/neighbourhood.js";
import { defaultTheme } from "../../../src/theme/resolve.js";
import { mentions, neighbourhood } from "../../../src/gallery/fixtures.js";
import { count, expectBalanced } from "../../helpers/html.js";

describe("MentionsPanel", () => {
  it("separates the links written in notes from the files that merely cite the entity", () => {
    const html = renderSlot("MentionsPanel", { mentions: mentions(3), initial: 20 }, defaultTheme);
    expect(html).toContain('<h2 id="mentions-title">Mentions <span class="count">3</span></h2>');
    expect(html).toContain(
      '<h3 id="mentions-written">Written in notes <span class="count">2</span></h3>',
    );
    expect(html).toContain(
      '<h3 id="mentions-recognised">Recognised in files <span class="count">1</span></h3>',
    );
    expect(html).toContain(
      '<li class="mention mention-written"><a class="mention-file" href="../notes/note-1/">note-1.md</a> <a class="mention-passage" href="../notes/note-1/#L1">line 1</a><q class="mention-context">passage 1 cites the entity</q></li>',
    );
    expect(html).not.toContain("<concordance-island");
    expectBalanced(html);
  });

  it("says when a section is empty", () => {
    const html = renderSlot("MentionsPanel", { mentions: [], initial: 20 }, defaultTheme);
    expect(html).toContain('<p class="empty">No note links here.</p>');
    expect(html).toContain('<p class="empty">No file cites this entity.</p>');
  });

  it("serves the first twenty mentions statically and the rest inside a details element of the island", () => {
    const html = renderSlot("MentionsPanel", { mentions: mentions(25), initial: 20 }, defaultTheme);
    expect(count(html, '<li class="mention')).toBe(25);
    const island = html.indexOf('<concordance-island data-island="mentions-panel"');
    expect(island).toBeGreaterThan(0);
    expect(count(html.slice(0, island), '<li class="mention')).toBe(20);
    expect(html).toContain(
      '<details class="mentions-more"><summary>Show the remaining mentions (5)</summary><ul class="mention-list">',
    );
    expect(html).toContain("passage 25 cites the entity");
    expect(html).not.toContain("<button");
    expectBalanced(html);
  });

  it("serialises only the remaining mentions as the props of the island", () => {
    const html = renderSlot("MentionsPanel", { mentions: mentions(21), initial: 20 }, defaultTheme);
    const match = /data-props="([^"]*)"/.exec(html);
    const props = JSON.parse((match?.[1] ?? "").replaceAll("&quot;", '"')) as {
      mentions: unknown[];
    };
    expect(props.mentions).toEqual([mentions(21)[20]]);
  });
});

describe("MentionsMore", () => {
  const props = { mentions: mentions(2) };

  it("is the island named mentions-panel, its button controlling the list mentions-more-list", () => {
    expect(MENTIONS_ISLAND).toBe("mentions-panel");
    expect(MENTIONS_MORE_LIST).toBe("mentions-more-list");
  });

  it("marks itself hydrated once mounted, so that the details element gives way to a disclosure button", () => {
    const component = new MentionsMore(props);
    const setState = vi.spyOn(component, "setState");
    component.componentDidMount();
    expect(setState).toHaveBeenCalledWith({ hydrated: true });
    const html = renderToString(component.render(props, { hydrated: true, expanded: false }));
    expect(html).toContain(
      '<div class="mentions-more"><button type="button" aria-expanded="false" aria-controls="mentions-more-list">Show the remaining mentions (2)</button><div id="mentions-more-list" hidden><ul class="mention-list">',
    );
    expect(count(html, '<li class="mention')).toBe(2);
    expect(html).not.toContain("<details");
  });

  it("toggles the remaining mentions when the button is activated, the state following", () => {
    const component = new MentionsMore(props);
    const setState = vi.spyOn(component, "setState");
    component.toggle();
    expect(setState).toHaveBeenCalledTimes(1);
    const update = setState.mock.calls[0]?.[0];
    expect(typeof update).toBe("function");
    if (typeof update === "function") {
      expect(update({ hydrated: true, expanded: false }, props)).toEqual({ expanded: true });
      expect(update({ hydrated: true, expanded: true }, props)).toEqual({ expanded: false });
    }
    const html = renderToString(component.render(props, { hydrated: true, expanded: true }));
    expect(html).toContain(
      '<button type="button" aria-expanded="true" aria-controls="mentions-more-list">Hide the remaining mentions (2)</button><div id="mentions-more-list"><ul class="mention-list">',
    );
    expect(html).not.toContain("hidden");
  });
});

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
