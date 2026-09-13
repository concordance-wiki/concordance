import { describe, expect, it } from "vitest";

import {
  TOC_ROOT_MARGIN,
  wireToc,
  type TocElement,
  type TocEntryChange,
  type TocLink,
  type TocObserverCallback,
  type TocObserverFactory,
} from "../../src/islands/toc.js";
import { renderSlot } from "../../src/render.js";
import { entityPage } from "../../src/gallery/fixtures.js";
import { TOC_CURRENT, TableOfContents } from "../../src/theme/default/toc.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import { renderToString } from "preact-render-to-string";
import { h } from "preact";

interface FakeLink extends TocLink {
  attributes: Map<string, string>;
}

function link(href: string, current = false): FakeLink {
  const attributes = new Map(
    current
      ? [
          ["href", href],
          ["aria-current", TOC_CURRENT],
        ]
      : [["href", href]],
  );
  return {
    attributes,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
  };
}

/** A section as the document hands it to the island, which only compares identities. */
function section(id: string): Element {
  // Only identity matters to the island: a section is whatever the document returns for its id.
  return { id } as Element;
}

/** A table of three sections, the second one absent from the document, and the observer the island builds. */
function fixture(): {
  links: FakeLink[];
  scope: Element;
  history: Element;
  sections: Record<string, Element>;
  observed: Element[];
  options: { rootMargin: string }[];
  fire: (changes: TocEntryChange[]) => void;
  observe: TocObserverFactory;
  element: TocElement;
} {
  const links = [link("#scope", true), link("#missing"), link("#history")];
  const scope = section("scope");
  const history = section("history");
  const sections: Record<string, Element> = { scope, history };
  const observed: Element[] = [];
  const options: { rootMargin: string }[] = [];
  let callback: TocObserverCallback = () => undefined;
  const observe: TocObserverFactory = (given, opts) => {
    callback = given;
    options.push(opts);
    return {
      observe(target) {
        observed.push(target);
      },
    };
  };
  return {
    links,
    scope,
    history,
    sections,
    observed,
    options,
    fire: (changes) => {
      callback(changes);
    },
    observe,
    element: { querySelectorAll: () => links },
  };
}

const current = (links: FakeLink[]): (string | undefined)[] =>
  links.map((entry) => entry.attributes.get("aria-current"));

describe("The table of contents marks the section being read", () => {
  it("observes the sections the links point at, in the top third of the viewport, and leaves the first entry current until one enters", () => {
    const { links, scope, history, sections, observed, options, fire, observe, element } =
      fixture();
    expect(wireToc(element, { getElementById: (id) => sections[id] ?? null }, observe)).toBe(true);
    expect(observed).toEqual([scope, history]);
    expect(options).toEqual([{ rootMargin: TOC_ROOT_MARGIN }]);
    expect(TOC_ROOT_MARGIN).toBe("0px 0px -66% 0px");
    fire([{ target: history, isIntersecting: false }]);
    expect(current(links)).toEqual([TOC_CURRENT, undefined, undefined]);
  });

  it("moves the mark to the last section in the band, then back as sections leave it", () => {
    const { links, scope, history, sections, fire, observe, element } = fixture();
    wireToc(element, { getElementById: (id) => sections[id] ?? null }, observe);
    fire([
      { target: scope, isIntersecting: true },
      { target: history, isIntersecting: true },
    ]);
    expect(current(links)).toEqual([undefined, undefined, TOC_CURRENT]);
    fire([{ target: history, isIntersecting: false }]);
    expect(current(links)).toEqual([TOC_CURRENT, undefined, undefined]);
    fire([{ target: scope, isIntersecting: false }]);
    expect(current(links)).toEqual([TOC_CURRENT, undefined, undefined]);
  });

  it("leaves the served mark alone without an observer, or when no link points at a section of the document", () => {
    const { links, sections, element } = fixture();
    expect(wireToc(element, { getElementById: (id) => sections[id] ?? null }, undefined)).toBe(
      false,
    );
    expect(wireToc(element, { getElementById: () => null }, fixture().observe)).toBe(false);
    expect(current(links)).toEqual([TOC_CURRENT, undefined, undefined]);
    const bare = link("");
    // A link without an href is still a link of the list: it points at no section.
    bare.attributes.delete("href");
    expect(
      wireToc(
        { querySelectorAll: () => [bare] },
        { getElementById: () => null },
        fixture().observe,
      ),
    ).toBe(false);
  });

  it("serves the list as an island with its entries, the first one current, counted after the heading of the block", () => {
    const html = renderToString(
      h(TableOfContents, {
        heading: "On this page",
        sections: [
          { id: "scope", heading: "Scope", html: "" },
          { id: "lead", html: "" },
          { id: "history", heading: "History", html: "" },
        ],
      }),
    );
    expect(html).toBe(
      '<section class="panel-block entity-toc" aria-labelledby="entity-toc"><details class="panel-fold"><summary><h2 id="entity-toc">On this page<span class="count panel-count">2</span></h2></summary><concordance-island data-island="toc" data-props="{&quot;entries&quot;:[{&quot;id&quot;:&quot;scope&quot;,&quot;heading&quot;:&quot;Scope&quot;},{&quot;id&quot;:&quot;history&quot;,&quot;heading&quot;:&quot;History&quot;}]}"><ol class="toc-list"><li><a href="#scope" aria-current="location">Scope</a></li><li><a href="#history">History</a></li></ol></concordance-island></details></section>',
    );
    const page = renderSlot("EntityPage", entityPage, defaultTheme);
    expect(page).toContain('<a href="#not-to-be-confused-with" aria-current="location">');
  });
});
