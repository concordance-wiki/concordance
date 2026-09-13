import { loadCatalogue } from "@concordance-wiki/i18n";
import { languagePack } from "@concordance-wiki/nlp";
import { describe, expect, it } from "vitest";

import {
  defaultCollation,
  siteContext,
  type SiteContext,
  type SiteContextInput,
} from "../../src/build/context.js";
import {
  filedEntities,
  foldTitle,
  INDEX_LETTERS,
  INDEX_SEGMENT_BYTES,
  indexOf,
  letterHref,
  letterOf,
  letterPagePath,
  letterSlug,
  planIndex,
} from "../../src/build/index-page.js";
import { HOME_PAGE, INDEX_PAGE } from "../../src/build/paths.js";
import { entity, fragments, model, page, profile } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

function titled(id: string, title: string) {
  return entity({ id, type: "term", title });
}

describe("letters", () => {
  it("folds case and accents to pick the letter, other openings gathering under #", () => {
    expect(foldTitle("Épreuve du Seuil")).toBe("epreuve du seuil");
    expect(letterOf("Épreuve")).toBe("E");
    expect(letterOf("  build")).toBe("B");
    expect(letterOf("#hash")).toBe("#");
    expect(letterOf("42")).toBe("#");
    expect(INDEX_LETTERS).toHaveLength(27);
    expect(INDEX_LETTERS[26]).toBe("#");
  });

  it("names the page and the anchor of a letter in lowercase, the # bucket as other", () => {
    expect(letterSlug("A")).toBe("a");
    expect(letterSlug("#")).toBe("other");
    expect(letterPagePath("K")).toBe("index/k/index.html");
    expect(letterPagePath("#")).toBe("index/other/index.html");
    expect(letterHref(HOME_PAGE, "K", false)).toBe("index/index.html#k");
    expect(letterHref(HOME_PAGE, "K", true)).toBe("index/k/index.html");
    expect(letterHref(INDEX_PAGE, "#", false)).toBe("index.html#other");
    expect(letterHref("index/a/index.html", "#", true)).toBe("../other/index.html");
  });
});

describe("filedEntities", () => {
  const entities = [
    titled("glossary/note-10", "note 10"),
    titled("glossary/event", "event"),
    titled("glossary/etude", "étude"),
    titled("glossary/estimate", "estimate"),
    titled("glossary/note-2", "note 2"),
    titled("glossary/zebre", "Zèbre"),
  ];
  const collated = [
    ["estimate", "E"],
    ["étude", "E"],
    ["event", "E"],
    ["note 2", "N"],
    ["note 10", "N"],
    ["Zèbre", "Z"],
  ];

  it("orders the entries by the collation of the language pack of the project locale, accents included, numbers by their value", () => {
    const fr = filedEntities(
      context({
        model: model({ entities }),
        catalogue: loadCatalogue("fr"),
        locale: "fr",
        collate: languagePack("fr").compare,
      }),
    );
    expect(fr.map(({ entity: filed, letter }) => [filed.title, letter])).toEqual(collated);
    const en = filedEntities(
      context({ model: model({ entities }), collate: languagePack("en").compare }),
    );
    expect(en.map(({ entity: filed }) => filed.title)).toEqual(collated.map(([title]) => title));
  });

  it("collates like the shipped packs when no collation is given: by the locale, accents folded, digits by value", () => {
    const fr = filedEntities(
      context({ model: model({ entities }), catalogue: loadCatalogue("fr"), locale: "fr-CA" }),
    );
    expect(fr.map(({ entity: filed, letter }) => [filed.title, letter])).toEqual(collated);
    const byLanguage = filedEntities(context({ model: model({ entities }) }));
    expect(byLanguage.map(({ entity: filed }) => filed.title)).toEqual(
      collated.map(([title]) => title),
    );
    expect(defaultCollation("en")("Étude", "etude")).toBe(0);
    expect(defaultCollation("en")("note 10", "note 9")).toBeGreaterThan(0);
  });

  it("orders two titles that collate alike by identifier", () => {
    const twin = { ...page, id: "specs/objects/page", title: "page" };
    const filed = filedEntities(context({ model: model({ entities: [twin, page], links: [] }) }));
    expect(filed.map(({ entity: item }) => item.id)).toEqual([
      "glossary/page",
      "specs/objects/page",
    ]);
  });
});

describe("indexOf", () => {
  it("lists every page with its glyph or the noteless mark and its citation count, the first entry of each letter anchored", () => {
    const index = indexOf(context());
    expect(index.current).toBeUndefined();
    expect(index.entries).toEqual([
      { label: "#hash", href: "../keywords/zzz/index.html", anchor: "other", count: 0 },
      {
        label: "build summary",
        href: "../keywords/build-summary/index.html",
        anchor: "b",
        count: 0,
      },
      {
        label: "Épreuve du seuil",
        href: "../specs/rules/publication-threshold/index.html",
        glyph: "R",
        anchor: "e",
        count: 0,
      },
      {
        label: "Keyword page",
        href: "../glossary/keyword-page/index.html",
        glyph: "T",
        anchor: "k",
        count: 4,
      },
      {
        label: "Mentions panel",
        href: "../specs/screens/mentions-panel/index.html",
        glyph: "S",
        anchor: "m",
        count: 0,
      },
      { label: "Page", href: "../glossary/page/index.html", glyph: "T", anchor: "p", count: 1 },
      { label: "vision", href: "../framing/vision/index.html", glyph: "D", anchor: "v", count: 1 },
    ]);
  });

  it("links the letters that have entries to their anchor and leaves the others inactive", () => {
    const index = indexOf(context());
    expect(index.letters).toHaveLength(27);
    expect(index.letters.filter((letter) => letter.href !== undefined)).toEqual([
      { letter: "B", href: "index.html#b", count: 1 },
      { letter: "E", href: "index.html#e", count: 1 },
      { letter: "K", href: "index.html#k", count: 1 },
      { letter: "M", href: "index.html#m", count: 1 },
      { letter: "P", href: "index.html#p", count: 1 },
      { letter: "V", href: "index.html#v", count: 1 },
      { letter: "#", href: "index.html#other", count: 1 },
    ]);
    expect(index.letters[0]).toEqual({ letter: "A", count: 0 });
    const twoUnderP = indexOf(
      context({
        model: model({ entities: [page, titled("glossary/passage", "Passage")], links: [] }),
      }),
    );
    expect(twoUnderP.entries.map((entry) => entry.anchor)).toEqual(["p", undefined]);
  });
});

describe("planIndex", () => {
  it("keeps the whole index in one page while its weight stays under the segment size", () => {
    const weights: number[] = [];
    const plan = planIndex(context(), (props) => {
      weights.push(props.entries.length);
      return INDEX_SEGMENT_BYTES;
    });
    expect(INDEX_SEGMENT_BYTES).toBe(100_000);
    expect(weights).toEqual([7]);
    expect(plan.segmented).toBe(false);
    expect(plan.pages.map((item) => [item.path, item.letter])).toEqual([[INDEX_PAGE, undefined]]);
    expect(plan.pages[0]?.props).toEqual(indexOf(context()));
    expect(plan.counts.filter(({ count }) => count > 0)).toEqual([
      { letter: "B", count: 1 },
      { letter: "E", count: 1 },
      { letter: "K", count: 1 },
      { letter: "M", count: 1 },
      { letter: "P", count: 1 },
      { letter: "V", count: 1 },
      { letter: "#", count: 1 },
    ]);
  });

  it("gives every letter with entries its own page past the segment size, the index address repeating the first letter", () => {
    const plan = planIndex(context(), () => INDEX_SEGMENT_BYTES + 1);
    expect(plan.segmented).toBe(true);
    expect(plan.pages.map((item) => [item.path, item.letter])).toEqual([
      [INDEX_PAGE, "B"],
      ["index/b/index.html", "B"],
      ["index/e/index.html", "E"],
      ["index/k/index.html", "K"],
      ["index/m/index.html", "M"],
      ["index/p/index.html", "P"],
      ["index/v/index.html", "V"],
      ["index/other/index.html", "#"],
    ]);
    const [entry, first, , , , , , other] = plan.pages;
    expect(entry?.props.current).toBe("B");
    expect(entry?.props.entries).toEqual([
      { label: "build summary", href: "../keywords/build-summary/index.html", count: 0 },
    ]);
    expect(entry?.props.letters.filter((letter) => letter.href !== undefined)).toEqual([
      { letter: "B", href: "b/index.html", count: 1 },
      { letter: "E", href: "e/index.html", count: 1 },
      { letter: "K", href: "k/index.html", count: 1 },
      { letter: "M", href: "m/index.html", count: 1 },
      { letter: "P", href: "p/index.html", count: 1 },
      { letter: "V", href: "v/index.html", count: 1 },
      { letter: "#", href: "other/index.html", count: 1 },
    ]);
    expect(first?.props.current).toBe("B");
    expect(first?.props.entries).toEqual([
      { label: "build summary", href: "../../keywords/build-summary/index.html", count: 0 },
    ]);
    expect(first?.props.letters[1]).toEqual({ letter: "B", href: "index.html", count: 1 });
    expect(first?.props.letters[4]).toEqual({ letter: "E", href: "../e/index.html", count: 1 });
    expect(first?.props.letters[0]).toEqual({ letter: "A", count: 0 });
    expect(other?.props.current).toBe("#");
    expect(other?.props.entries).toEqual([
      { label: "#hash", href: "../../keywords/zzz/index.html", count: 0 },
    ]);
    expect(other?.props.letters[1]).toEqual({ letter: "B", href: "../b/index.html", count: 1 });
  });
});
