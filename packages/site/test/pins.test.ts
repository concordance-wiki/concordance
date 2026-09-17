import { describe, expect, it } from "vitest";

import {
  countLabel,
  escape,
  fill,
  filterPins,
  fitCount,
  isPinned,
  parsePins,
  pinPage,
  PINS_STORAGE_KEY,
  pinsMarkup,
  pinsValue,
  spaceOf,
  unpinPage,
} from "../src/pins.js";
import type { PinnedPage } from "../src/slots.js";
import { defaultPinsLabels } from "../src/theme/default/pins.js";
import { count } from "./helpers/html.js";

const rule: PinnedPage = {
  id: "specs/rules/publication-threshold",
  title: "Publication threshold",
};
const term: PinnedPage = { id: "glossary/keyword-page", title: "Keyword page" };
const screen: PinnedPage = { id: "specs/screens/pages/entity-page", title: "Entity page" };

describe("The pages a reader pins, kept under one key in the order they were pinned", () => {
  it("reads the stored pages and their titles, and nothing from a value that is missing, malformed or of another shape", () => {
    expect(PINS_STORAGE_KEY).toBe("concordance-pins");
    expect(parsePins(null)).toEqual([]);
    expect(parsePins("{")).toEqual([]);
    expect(parsePins("42")).toEqual([]);
    expect(parsePins('{"entries":"none"}')).toEqual([]);
    expect(parsePins('{"entries":[{"id":"glossary/source"}]}')).toEqual([]);
    expect(parsePins('{"entries":[{"id":"glossary/source","title":"Source","extra":1}]}')).toEqual([
      { id: "glossary/source", title: "Source" },
    ]);
    expect(parsePins(pinsValue([rule, term]) ?? "")).toEqual([rule, term]);
    expect(pinsValue([])).toBeUndefined();
  });

  it("pins a page at the end, once, and unpins it without moving the others", () => {
    expect(isPinned([rule], rule.id)).toBe(true);
    expect(isPinned([rule], term.id)).toBe(false);
    expect(pinPage([rule], term)).toEqual([rule, term]);
    expect(pinPage([rule, term], rule)).toEqual([rule, term]);
    expect(unpinPage([rule, term, screen], term.id)).toEqual([rule, screen]);
    expect(unpinPage([rule], "glossary/none")).toEqual([rule]);
    expect(unpinPage([rule], null)).toEqual([rule]);
  });

  it("names the space of a page by the source its identifier starts with", () => {
    expect(spaceOf("specs/rules/publication-threshold")).toBe("specs");
    expect(spaceOf("keyword")).toBe("");
  });

  it("shows every pin that fits once the summary goes, else as many as fit before the summary", () => {
    expect(fitCount([100, 100, 100], 400, 60, 10)).toBe(3);
    expect(fitCount([100, 100, 100], 250, 60, 10)).toBe(3);
    expect(fitCount([100, 100, 100], 249, 60, 10)).toBe(2);
    expect(fitCount([100, 100, 100], 150, 60, 10)).toBe(1);
    expect(fitCount([100, 100, 100], 50, 60, 10)).toBe(0);
    expect(fitCount([], 0, 60, 10)).toBe(0);
  });

  it("keeps the pins whose title or space holds every word of the filter, whatever the case", () => {
    expect(filterPins([rule, term, screen], "")).toEqual([rule, term, screen]);
    expect(filterPins([rule, term, screen], "PAGE")).toEqual([term, screen]);
    expect(filterPins([rule, term, screen], "specs page")).toEqual([screen]);
    expect(filterPins([rule, term, screen], "  glossary ")).toEqual([term]);
    expect(filterPins([rule, term, screen], "nothing")).toEqual([]);
  });

  it("escapes the text of a title for an element and an attribute, and fills the placeholder of a label", () => {
    expect(escape('<b class="x">Tom & Jerry</b>')).toBe(
      "&lt;b class=&quot;x&quot;&gt;Tom &amp; Jerry&lt;/b&gt;",
    );
    expect(fill("Unpin {title}", "title", "Entity")).toBe("Unpin Entity");
    expect(fill("Unpin {title}", "title", "$& and $'")).toBe("Unpin $& and $'");
    expect(countLabel(defaultPinsLabels, 1)).toBe("1 pinned");
    expect(countLabel(defaultPinsLabels, 3)).toBe("3 pinned");
    expect(countLabel({ ...defaultPinsLabels, countOne: "{count} épinglée" }, 1)).toBe(
      "1 épinglée",
    );
  });

  it("writes no row without a pin, and otherwise the label, the chips with the current page marked, the summary and its menu, and the count", () => {
    expect(pinsMarkup({ base: "", entries: [], labels: defaultPinsLabels })).toBe("");
    const html = pinsMarkup({
      base: "../../",
      current: term.id,
      entries: [rule, term],
      labels: defaultPinsLabels,
    });
    expect(html.startsWith('<nav class="pins" aria-label="Pinned pages">')).toBe(true);
    expect(html.endsWith('<span class="pins-count">2 pinned</span></nav>')).toBe(true);
    expect(html).toContain('<span class="pins-label">Pinned</span>');
    expect(html).toContain(
      '<ul class="pins-list"><li class="pin"><a href="../../specs/rules/publication-threshold/index.html">Publication threshold</a><button type="button" class="pin-remove" data-id="specs/rules/publication-threshold" aria-label="Unpin Publication threshold">✕</button></li><li class="pin pin-current"><a href="../../glossary/keyword-page/index.html" aria-current="page">Keyword page</a><button type="button" class="pin-remove" data-id="glossary/keyword-page" aria-label="Unpin Keyword page">✕</button></li></ul>',
    );
    expect(html).toContain(
      '<details class="pins-more" hidden><summary class="pins-more-button"><span class="pins-more-count">+2</span><span class="pins-more-mark" aria-hidden="true">▾</span><span class="visually-hidden">All pinned</span></summary><div class="pins-menu">',
    );
    expect(html).toContain(
      '<p class="pins-menu-head"><span class="pins-menu-title">All pinned</span><span class="pins-menu-count">2</span></p><p class="pins-menu-filter"><span class="pins-menu-glyph" aria-hidden="true">⌕</span><input type="search" class="pins-filter" placeholder="Filter" aria-label="Filter" autocomplete="off"></p>',
    );
    expect(html).toContain(
      '<ul class="pins-menu-list"><li class="pins-row" data-id="specs/rules/publication-threshold"><a href="../../specs/rules/publication-threshold/index.html">Publication threshold</a><span class="pin-space">specs</span><button type="button" class="pin-remove" data-id="specs/rules/publication-threshold" aria-label="Unpin Publication threshold">✕</button></li><li class="pins-row pins-row-current" data-id="glossary/keyword-page"><a href="../../glossary/keyword-page/index.html" aria-current="page">Keyword page</a><span class="pin-space">glossary</span>',
    );
    expect(html).toContain(
      '<p class="pins-menu-foot"><button type="button" class="pins-remove-all">Remove all</button></p></div></details>',
    );
    expect(count(html, "<li")).toBe(4);
  });

  it("escapes a hostile title everywhere it is written", () => {
    const hostile: PinnedPage = { id: 'a/b"c', title: '<script>alert("x")</script>' };
    const html = pinsMarkup({ base: "", entries: [hostile], labels: defaultPinsLabels });
    expect(html).not.toContain("<script>");
    expect(html).toContain(">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</a>");
    expect(html).toContain('data-id="a/b&quot;c"');
    expect(html).toContain('aria-label="Unpin &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"');
  });
});
