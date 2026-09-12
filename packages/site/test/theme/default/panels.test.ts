import { renderToString } from "preact-render-to-string";
import { describe, expect, it, vi } from "vitest";

import { renderSlot } from "../../../src/render.js";
import { MENTIONS_ISLAND, MentionsMore } from "../../../src/theme/default/mentions-more.js";
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
      '<details class="mentions-more"><summary>Show the remaining mentions (5)</summary>',
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

  it("is the island named mentions-panel", () => {
    expect(MENTIONS_ISLAND).toBe("mentions-panel");
  });

  it("marks itself hydrated once mounted, so that the details element gives way to a button", () => {
    const component = new MentionsMore(props);
    const setState = vi.spyOn(component, "setState");
    component.componentDidMount();
    expect(setState).toHaveBeenCalledWith({ hydrated: true });
    const html = renderToString(component.render(props, { hydrated: true, expanded: false }));
    expect(html).toBe(
      '<div class="mentions-more"><button type="button" aria-expanded="false">Show the remaining mentions (2)</button></div>',
    );
  });

  it("reveals the remaining mentions when the button is activated", () => {
    const component = new MentionsMore(props);
    const setState = vi.spyOn(component, "setState");
    component.reveal();
    expect(setState).toHaveBeenCalledWith({ expanded: true });
    const html = renderToString(component.render(props, { hydrated: true, expanded: true }));
    expect(html).toContain('<div class="mentions-more"><ul class="mention-list">');
    expect(count(html, '<li class="mention')).toBe(2);
    expect(html).not.toContain("<button");
  });
});

describe("Neighbourhood", () => {
  it("lists every neighbour with its type, relation and weight, as the textual equivalent of the map", () => {
    const html = renderSlot("Neighbourhood", neighbourhood, defaultTheme);
    expect(html).toContain(
      '<h2 id="neighbourhood-title">Neighbourhood <span class="neighbourhood-centre">Free payment</span></h2>',
    );
    expect(html).toContain(
      '<li class="neighbour"><a href="../payment/">payment</a><span class="badge">term</span><span class="weight">12</span></li>',
    );
    expect(html).toContain(
      '<a href="../free-payment-entry/">Free payment entry</a><span class="relation">displays</span><span class="weight">4</span>',
    );
    expectBalanced(html);
  });

  it("says when there is no neighbour", () => {
    const html = renderSlot("Neighbourhood", { centre: "x", neighbours: [] }, defaultTheme);
    expect(html).toContain('<p class="empty">No neighbour recorded.</p>');
  });
});
