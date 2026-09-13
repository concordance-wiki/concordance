import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import { foldTitle, indexOf, letterOf } from "../../src/build/index-page.js";
import { fragments, model, page, profile } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

describe("indexOf", () => {
  it("folds case and accents to order the titles and to pick the letter, other openings gathering under #", () => {
    expect(foldTitle("Épreuve du Seuil")).toBe("epreuve du seuil");
    expect(letterOf("Épreuve")).toBe("E");
    expect(letterOf("  build")).toBe("B");
    expect(letterOf("#hash")).toBe("#");
    expect(letterOf("42")).toBe("#");
  });

  it("lists every page by folded title with its glyph or the noteless mark and its citation count, and activates the letters that have entries", () => {
    const index = indexOf(context());
    expect(index.current).toBeUndefined();
    expect(index.entries).toEqual([
      { label: "#hash", href: "../keywords/zzz/index.html", count: 0 },
      { label: "build summary", href: "../keywords/build-summary/index.html", count: 0 },
      {
        label: "Épreuve du seuil",
        href: "../specs/rules/publication-threshold/index.html",
        glyph: "R",
        count: 0,
      },
      { label: "Keyword page", href: "../glossary/keyword-page/index.html", glyph: "T", count: 4 },
      {
        label: "Mentions panel",
        href: "../specs/screens/mentions-panel/index.html",
        glyph: "S",
        count: 0,
      },
      { label: "Page", href: "../glossary/page/index.html", glyph: "T", count: 1 },
      { label: "vision", href: "../framing/vision/index.html", glyph: "D", count: 1 },
    ]);
    expect(index.letters).toHaveLength(27);
    expect(index.letters.filter((letter) => letter.href !== undefined)).toEqual([
      { letter: "B", href: "index.html", count: 1 },
      { letter: "E", href: "index.html", count: 1 },
      { letter: "K", href: "index.html", count: 1 },
      { letter: "M", href: "index.html", count: 1 },
      { letter: "P", href: "index.html", count: 1 },
      { letter: "V", href: "index.html", count: 1 },
      { letter: "#", href: "index.html", count: 1 },
    ]);
    expect(index.letters[0]).toEqual({ letter: "A", count: 0 });
  });

  it("orders two titles that fold alike by identifier", () => {
    const twin = { ...page, id: "specs/objects/page", title: "page" };
    const index = indexOf(context({ model: model({ entities: [twin, page], links: [] }) }));
    expect(index.entries.map((entry) => entry.href)).toEqual([
      "../glossary/page/index.html",
      "../specs/objects/page/index.html",
    ]);
  });
});
