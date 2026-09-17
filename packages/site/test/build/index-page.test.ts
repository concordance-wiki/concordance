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
  citingPages,
  excerptOf,
  filedEntities,
  filtersOf,
  foldTitle,
  INDEX_LETTERS,
  INDEX_SEGMENT_BYTES,
  INDEX_SUMMARY_MAX_CHARS,
  indexLabels,
  indexOf,
  letterHref,
  letterOf,
  letterPagePath,
  letterSlug,
  mostCitedPassageOf,
  planIndex,
  summaryOf,
} from "../../src/build/index-page.js";
import { HOME_PAGE, INDEX_PAGE } from "../../src/build/paths.js";
import {
  entity,
  fragments,
  keyword,
  model,
  orphanKeyword,
  page,
  profile,
  term,
} from "./fixture.js";

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
    expect(defaultCollation()("Étude", "etude")).toBe(0);
    expect(defaultCollation()("note 10", "note 9")).toBeGreaterThan(0);
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

describe("citingPages", () => {
  it("counts the distinct pages linking to a note, and the files an expression is read in", () => {
    expect(citingPages(context(), term)).toBe(4);
    expect(citingPages(context(), page)).toBe(1);
    expect(citingPages(context(), keyword)).toBe(2);
    expect(citingPages(context(), orphanKeyword)).toBe(0);
    const twice = model();
    twice.links = [...twice.links, ...twice.links];
    expect(citingPages(context({ model: twice }), term)).toBe(4);
  });
});

describe("summaryOf", () => {
  it("cuts the summary of a note at a word before 200 characters, an ellipsis marking the cut", () => {
    expect(INDEX_SUMMARY_MAX_CHARS).toBe(200);
    expect(excerptOf("A short line.", 200)).toBe("A short line.");
    expect(excerptOf("one two three four", 10)).toBe("one two…");
    expect(excerptOf("onetwothreefour five", 10)).toBe("onetwothre…");
    const long = `${"word ".repeat(50)}end`;
    expect(summaryOf(context(), { ...page, summary: long })).toBe(`${"word ".repeat(39)}word…`);
    expect(summaryOf(context(), { ...page, summary: "A page of the site." })).toBe(
      "A page of the site.",
    );
    expect(summaryOf(context(), page)).toBeUndefined();
  });

  it("stands the passage that uses an expression most for its summary, quoted with the title of its file, the earliest line of the file that cites it most", () => {
    expect(mostCitedPassageOf(context(), keyword)).toBe(
      "“after the Build summaries” — Mentions panel",
    );
    expect(summaryOf(context(), keyword)).toBe("“after the Build summaries” — Mentions panel");
    expect(summaryOf(context({ catalogue: loadCatalogue("fr") }), keyword)).toBe(
      "« after the Build summaries » — Mentions panel",
    );
    expect(summaryOf(context(), orphanKeyword)).toBeUndefined();
    const onlyUnknownFiles = new Map(fragments);
    onlyUnknownFiles.set("keywords/build-summary", {
      id: "keywords/build-summary",
      sections: [],
      passages: [
        { source: "specs", path: "unknown.md", line: 1, context: "a file that is no page" },
      ],
    });
    expect(summaryOf(context({ fragments: onlyUnknownFiles }), keyword)).toBeUndefined();
    const inLineOrder = new Map(fragments);
    inLineOrder.set("keywords/build-summary", {
      id: "keywords/build-summary",
      sections: [],
      passages: [
        { source: "glossary", path: "page.md", line: 3, context: "the first line" },
        { source: "glossary", path: "page.md", line: 9, context: "a later line" },
        { source: "specs", path: "screens/mentions-panel.md", line: 1, context: "once" },
      ],
    });
    expect(summaryOf(context({ fragments: inLineOrder }), keyword)).toBe("“the first line” — Page");
  });
});

describe("filtersOf", () => {
  it("lists the types of the notes by label, the spaces by name and the words without a definition, each leading to the results page filtered by it", () => {
    const filters = filtersOf(context(), "index/a/index.html", filedEntities(context()));
    expect(filters.types).toEqual([
      { label: "Business rule", href: "../../search/index.html?type=rule", count: 1 },
      { label: "Document", href: "../../search/index.html?type=document", count: 1 },
      { label: "Screen", href: "../../search/index.html?type=screen", count: 1 },
      { label: "Term", href: "../../search/index.html?type=term", count: 2 },
    ]);
    expect(filters.spaces).toEqual([
      { label: "framing", href: "../../search/index.html?source=framing", count: 1 },
      { label: "glossary", href: "../../search/index.html?source=glossary", count: 2 },
      { label: "specs", href: "../../search/index.html?source=specs", count: 4 },
    ]);
    expect(filters.withoutDefinition).toEqual({
      label: "without a definition",
      href: "../../search/index.html?nonote=only",
      count: 2,
    });
    const titled = context({ names: { sources: { specs: "Specifications" } } });
    expect(
      filtersOf(titled, "index/a/index.html", filedEntities(titled)).spaces.find(
        (space) => space.href === "../../search/index.html?source=specs",
      ),
    ).toEqual({ label: "Specifications", href: "../../search/index.html?source=specs", count: 4 });
  });

  it("orders two types sharing a label by their address, and encodes a value the address could not carry as written", () => {
    const ctx = context({
      model: model({
        entities: [
          entity({ id: "specs/a", type: "term", title: "a" }),
          entity({ id: "specs/b", type: "unknown", title: "b" }),
          entity({
            id: "my space/c",
            type: "term",
            title: "c",
            source: { name: "my space", path: "c.md", line: 1 },
          }),
        ],
        links: [],
      }),
      profile: {
        ...profile,
        types: { ...profile.types, unknown: { label: { en: "Term" }, group: "business" } },
      },
    });
    const filters = filtersOf(ctx, INDEX_PAGE, filedEntities(ctx));
    expect(filters.types.map((value) => value.href)).toEqual([
      "../search/index.html?type=term",
      "../search/index.html?type=unknown",
    ]);
    expect(filters.spaces.map((value) => value.href)).toEqual([
      "../search/index.html?source=my%20space",
      "../search/index.html?source=specs",
    ]);
  });
});

describe("indexLabels", () => {
  it("words the sentence under the title with the counts of the words and the notes, and the letters without an entry, in the site language", () => {
    const labels = indexLabels(context(), filedEntities(context()), 20);
    expect(labels).toEqual({
      title: "A–Z index",
      lead: "7 words used in the documentation. 5 have a written page, the others exist through their uses alone.",
      filters: "Filters",
      byType: "By type",
      bySpace: "By space",
      letters: "Browse by initial letter",
      lettersWithout: "20 letters without an entry",
      word: "Word",
      type: "Type",
      description: "First line of the page, or most cited passage",
      pages: "Pages",
      noDefinition: "no definition",
      note: "Words without a definition sit in the index like the others, dotted, with the passage that uses them most in place of a definition. That is the working list of a glossary owner.",
    });
    const one = context({ model: model({ entities: [page], links: [] }) });
    const fr = indexLabels(
      context({ model: model({ entities: [page], links: [] }), catalogue: loadCatalogue("fr") }),
      filedEntities(one),
      1,
    );
    expect(fr.lead).toBe(
      "1 mot employé dans la documentation. 1 a une page rédigée, les autres existent par leurs seuls emplois.",
    );
    expect(fr.lettersWithout).toBe("1 lettre sans entrée");
    expect(fr.title).toBe("Index A–Z");
  });
});

describe("indexOf", () => {
  it("lists every page with its letter, its type label and glyph or nothing for a word without a definition, its summary and the pages citing it, the first entry of each letter anchored", () => {
    const index = indexOf(context());
    expect(index.current).toBeUndefined();
    expect(index.entries).toEqual([
      {
        label: "#hash",
        href: "../keywords/zzz/index.html",
        letter: "#",
        anchor: "other",
        count: 0,
      },
      {
        label: "build summary",
        href: "../keywords/build-summary/index.html",
        letter: "B",
        summary: "“after the Build summaries” — Mentions panel",
        anchor: "b",
        count: 2,
      },
      {
        label: "Épreuve du seuil",
        href: "../specs/rules/publication-threshold/index.html",
        letter: "E",
        glyph: "R",
        typeLabel: "Business rule",
        anchor: "e",
        count: 0,
      },
      {
        label: "Keyword page",
        href: "../glossary/keyword-page/index.html",
        letter: "K",
        glyph: "T",
        typeLabel: "Term",
        anchor: "k",
        count: 4,
      },
      {
        label: "Mentions panel",
        href: "../specs/screens/mentions-panel/index.html",
        letter: "M",
        glyph: "S",
        typeLabel: "Screen",
        anchor: "m",
        count: 0,
      },
      {
        label: "Page",
        href: "../glossary/page/index.html",
        letter: "P",
        glyph: "T",
        typeLabel: "Term",
        anchor: "p",
        count: 1,
      },
      {
        label: "vision",
        href: "../framing/vision/index.html",
        letter: "V",
        glyph: "D",
        typeLabel: "Document",
        anchor: "v",
        count: 1,
      },
    ]);
    expect(index.counts).toEqual({ words: 7, notes: 5 });
    expect(index.filters?.withoutDefinition.href).toBe("../search/index.html?nonote=only");
    expect(index.labels?.lettersWithout).toBe("20 letters without an entry");
  });

  it("carries the summary of a note as its first line", () => {
    const summarised = { ...page, summary: "A page of the site." };
    const index = indexOf(context({ model: model({ entities: [summarised], links: [] }) }));
    expect(index.entries[0]?.summary).toBe("A page of the site.");
  });

  it("links the letters that have entries to their anchor, their count worded, and leaves the others inactive", () => {
    const index = indexOf(context());
    expect(index.letters).toHaveLength(27);
    expect(index.letters.filter((letter) => letter.href !== undefined)).toEqual([
      { letter: "B", href: "index.html#b", count: 1, countLabel: "1 word" },
      { letter: "E", href: "index.html#e", count: 1, countLabel: "1 word" },
      { letter: "K", href: "index.html#k", count: 1, countLabel: "1 word" },
      { letter: "M", href: "index.html#m", count: 1, countLabel: "1 word" },
      { letter: "P", href: "index.html#p", count: 1, countLabel: "1 word" },
      { letter: "V", href: "index.html#v", count: 1, countLabel: "1 word" },
      { letter: "#", href: "index.html#other", count: 1, countLabel: "1 word" },
    ]);
    expect(index.letters[0]).toEqual({ letter: "A", count: 0 });
    const twoUnderP = indexOf(
      context({
        model: model({ entities: [page, titled("glossary/passage", "Passage")], links: [] }),
      }),
    );
    expect(twoUnderP.letters[15]?.countLabel).toBe("2 words");
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
      {
        label: "build summary",
        href: "../keywords/build-summary/index.html",
        letter: "B",
        summary: "“after the Build summaries” — Mentions panel",
        count: 2,
      },
    ]);
    const word = (letter: string, href: string) => ({
      letter,
      href,
      count: 1,
      countLabel: "1 word",
    });
    expect(entry?.props.letters.filter((letter) => letter.href !== undefined)).toEqual([
      word("B", "b/index.html"),
      word("E", "e/index.html"),
      word("K", "k/index.html"),
      word("M", "m/index.html"),
      word("P", "p/index.html"),
      word("V", "v/index.html"),
      word("#", "other/index.html"),
    ]);
    expect(entry?.props.counts).toEqual({ words: 7, notes: 5 });
    expect(entry?.props.filters?.types[0]?.href).toBe("../search/index.html?type=rule");
    expect(entry?.props.labels?.lead).toBe(
      "7 words used in the documentation. 5 have a written page, the others exist through their uses alone.",
    );
    expect(first?.props.current).toBe("B");
    expect(first?.props.entries).toEqual([
      {
        label: "build summary",
        href: "../../keywords/build-summary/index.html",
        letter: "B",
        summary: "“after the Build summaries” — Mentions panel",
        count: 2,
      },
    ]);
    expect(first?.props.letters[1]).toEqual(word("B", "index.html"));
    expect(first?.props.letters[4]).toEqual(word("E", "../e/index.html"));
    expect(first?.props.letters[0]).toEqual({ letter: "A", count: 0 });
    expect(first?.props.filters?.spaces[0]?.href).toBe("../../search/index.html?source=framing");
    expect(other?.props.current).toBe("#");
    expect(other?.props.entries).toEqual([
      { label: "#hash", href: "../../keywords/zzz/index.html", letter: "#", count: 0 },
    ]);
    expect(other?.props.letters[1]).toEqual(word("B", "../b/index.html"));
  });
});
