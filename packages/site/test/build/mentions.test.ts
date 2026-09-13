import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  DEFAULT_MENTIONS_INLINE,
  locationOf,
  mentionsFragmentOf,
  mentionsOf,
  mentionsPanelOf,
  serializeMentionsFragment,
  surfaceOf,
} from "../../src/build/mentions.js";
import { mentionsFragmentPath } from "../../src/build/paths.js";
import { fragments, model, orphanKeyword, page, profile, term } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

const pagePath = "glossary/keyword-page/index.html";

describe("mentionsOf", () => {
  it("turns the located provenances of the links into mentions, written links first, then by file and line, a lost source left out", () => {
    expect(mentionsOf(context(), pagePath, term)).toEqual([
      {
        kind: "written",
        file: {
          label: "rules/publication-threshold.md",
          href: "../../specs/rules/publication-threshold/index.html",
        },
        title: "Épreuve du seuil",
        type: "rule",
        typeLabel: "Business rule",
        context: "applies_to",
        line: 1,
        href: "../../specs/rules/publication-threshold/index.html#L1",
      },
      {
        kind: "written",
        file: {
          label: "screens/mentions-panel.md",
          href: "../../specs/screens/mentions-panel/index.html",
        },
        title: "Mentions panel",
        type: "screen",
        typeLabel: "Screen",
        context: "keyword pages",
        line: 7,
        href: "../../specs/screens/mentions-panel/index.html#L7",
      },
      {
        kind: "recognised",
        file: { label: "page.md", href: "../page/index.html" },
        title: "Page",
        type: "term",
        typeLabel: "Term",
        context: "in section See also",
        line: 5,
        href: "../page/index.html#L5",
      },
      {
        kind: "recognised",
        file: {
          label: "screens/mentions-panel.md",
          href: "../../specs/screens/mentions-panel/index.html",
        },
        title: "Mentions panel",
        type: "screen",
        typeLabel: "Screen",
        context: "Keyword page",
        line: 9,
        href: "../../specs/screens/mentions-panel/index.html#L9",
      },
      {
        kind: "recognised",
        file: {
          label: "screens/mentions-panel.md",
          href: "../../specs/screens/mentions-panel/index.html",
        },
        title: "Mentions panel",
        type: "screen",
        typeLabel: "Screen",
        context: "…lists the keyword pages that cite the entity, grouped by file…",
        line: 15,
        href: "../../specs/screens/mentions-panel/index.html#L15",
        surface: "keyword page",
      },
    ]);
    expect(mentionsOf(context(), "keywords/zzz/index.html", orphanKeyword)).toEqual([]);
  });

  it("locates the citing note by the provenance path whichever end relation typing put first, and never cites a page from its own note", () => {
    // The frontmatter of keyword-page.md names Page: a mention of Page, listed nowhere on Keyword page.
    expect(mentionsOf(context(), "glossary/page/index.html", page)).toEqual([
      {
        kind: "written",
        file: { label: "keyword-page.md", href: "../keyword-page/index.html" },
        title: "Keyword page",
        type: "term",
        typeLabel: "Term",
        context: "broader",
        line: 2,
        href: "../keyword-page/index.html#L2",
      },
    ]);
    const own = mentionsOf(context(), pagePath, term);
    expect(own.some((mention) => mention.file.label === "keyword-page.md")).toBe(false);
    // A co-occurrence has no file; a provenance without a path locates nothing.
    const pathless = context({
      model: model({
        links: [
          {
            from: "glossary/page",
            to: "glossary/keyword-page",
            relation: "related",
            confidence: 0.5,
            provenance: [
              { method: "cooccurrence", confidence: 0.5, count: 1 },
              { method: "glossary_occurrence", confidence: 0.5, line: 4 },
            ],
          },
        ],
      }),
    });
    expect(mentionsOf(pathless, pagePath, term)).toEqual([]);
  });

  it("shows the passage the scan kept as the context, and names the words of it that name the entity", () => {
    const passage = (context: string) => ({
      method: "glossary_occurrence" as const,
      confidence: 0.6,
      path: "page.md",
      line: 3,
      occurrences: [{ line: 3, context }],
    });
    expect(surfaceOf(term, passage("Every Word Page cites its keyword page once."))).toBe(
      "keyword page",
    );
    // The scan says what it matched: the plural or any other form as written wins over a search by name.
    expect(
      surfaceOf(term, { ...passage("Two keyword pages cite the panel."), text: "keyword pages" }),
    ).toBe("keyword pages");
    expect(
      surfaceOf(term, { ...passage("A cut passage…"), text: "keyword pages" }),
    ).toBeUndefined();
    expect(surfaceOf(term, passage("Every WORD PAGE cites the panel."))).toBe("WORD PAGE");
    expect(surfaceOf(term, passage("A page cites nothing."))).toBeUndefined();
    expect(surfaceOf({ ...term, title: "" }, passage("A word page."))).toBe("word page");
    // Names of one length are tried in code unit order, so that the result never depends on the alias order.
    const twin = { ...term, aliases: ["word page", "note page"] };
    expect(surfaceOf(twin, passage("A note page or a word page."))).toBe("note page");
    expect(
      surfaceOf({ ...twin, aliases: ["note page", "word page"] }, passage("word page, note page")),
    ).toBe("note page");
    expect(
      surfaceOf(term, { method: "glossary_occurrence", confidence: 0.6, path: "page.md", line: 3 }),
    ).toBeUndefined();
  });
});

describe("mentions read from a document", () => {
  it("names the position of a mention read from a deck, a PDF or a transcript instead of a line, and keeps the line for a note", () => {
    const cited = context({
      model: model({
        links: [
          {
            from: "specs/screens/mentions-panel",
            to: "glossary/keyword-page",
            relation: "related",
            confidence: 0.6,
            provenance: [
              {
                method: "glossary_occurrence",
                confidence: 0.6,
                path: "screens/mentions-panel.pptx",
                line: 3,
                occurrences: [
                  { line: 3, context: "The keyword page on a slide", section: "slide 3" },
                ],
              },
              {
                method: "glossary_occurrence",
                confidence: 0.6,
                path: "screens/mentions-panel.md",
                line: 12,
                occurrences: [{ line: 12, context: "The keyword page in prose", section: "Steps" }],
              },
            ],
          },
        ],
      }),
    });
    expect(
      mentionsOf(cited, pagePath, term).map((mention) => [
        mention.file.label,
        mention.line,
        mention.href,
        mention.location,
      ]),
    ).toEqual([
      [
        "screens/mentions-panel.md",
        12,
        "../../specs/screens/mentions-panel/index.html#L12",
        undefined,
      ],
      [
        "screens/mentions-panel.pptx",
        3,
        "../../specs/screens/mentions-panel/index.html#L3",
        "slide 3",
      ],
    ]);
  });

  it("takes the label from the passage first, then from the provenance section, and only for a file that is not a note", () => {
    const base = { method: "glossary_occurrence" as const, confidence: 0.6, line: 1 };
    expect(locationOf({ ...base, path: "a.vtt", section: "00:00:04" })).toBe("00:00:04");
    expect(
      locationOf({
        ...base,
        path: "a.pdf",
        section: "old",
        occurrences: [{ line: 1, context: "c", section: "page 1" }],
      }),
    ).toBe("page 1");
    expect(
      locationOf({ ...base, path: "a.pdf", occurrences: [{ line: 1, context: "c" }] }),
    ).toBeUndefined();
    expect(locationOf({ ...base, path: "a.md", section: "Steps" })).toBeUndefined();
    expect(locationOf({ ...base, section: "Steps" })).toBeUndefined();
  });
});

describe("mentionsPanelOf", () => {
  it("carries the mentions, the inline threshold, the number of citing pages, the labels of the site locale and the href of the fragment of the entity", () => {
    const panel = mentionsPanelOf(context(), pagePath, term, 3);
    expect(panel.mentions).toHaveLength(5);
    expect(panel.initial).toBe(3);
    expect(panel.pages).toBe(3);
    expect(panel.labels).toEqual({
      related: "Related pages",
      filterPages: "Filter these pages",
      types: "Types",
      pagesOf: "{shown} of {total} pages",
      clearAll: "Clear all",
      cited: "Cited",
      passage: "passage",
      passages: "passages",
      showOthers: "Show the {count} others",
      loadingOthers: "Loading the other pages…",
      othersUnavailable: "The other pages could not be loaded.",
      fullList: "Open the full list (JSON)",
      orderNote:
        "Ordered by number of passages, written and recognised alike. “Cited” marks a link present in the text.",
      noRelated: "No other page evokes this one yet.",
      noMatch: "No page matches the filter.",
    });
    expect(panel.fragmentHref).toBe("../../fragments/glossary/keyword-page.mentions.json");
    const french = mentionsPanelOf(
      context({ catalogue: loadCatalogue("fr") }),
      pagePath,
      term,
    ).labels;
    expect(french?.related).toBe("Pages en relation");
    expect(french?.pagesOf).toBe("{shown} pages sur {total}");
    expect(french?.showOthers).toBe("Afficher les {count} autres");
    expect(french?.orderNote).toBe(
      "Ordonnées par nombre de passages, écrits et relevés confondus. « Cité » signale un lien présent dans le texte.",
    );
  });

  it("defaults the threshold to twenty and names no fragment for an entity without a mention", () => {
    const panel = mentionsPanelOf(context(), "keywords/zzz/index.html", orphanKeyword);
    expect(DEFAULT_MENTIONS_INLINE).toBe(20);
    expect(panel.initial).toBe(20);
    expect(panel.mentions).toEqual([]);
    expect(panel.pages).toBe(0);
    expect(panel.fragmentHref).toBeUndefined();
  });
});

describe("mentionsFragmentOf", () => {
  it("holds every mention of the entity with hrefs relative to its page, serialised as canonical JSON", () => {
    const fragment = mentionsFragmentOf(context(), term);
    expect(fragment?.id).toBe("glossary/keyword-page");
    expect(fragment?.mentions).toEqual(mentionsOf(context(), pagePath, term));
    expect(mentionsFragmentPath("glossary/keyword-page")).toBe(
      "fragments/glossary/keyword-page.mentions.json",
    );
    const text = serializeMentionsFragment({
      id: "glossary/keyword-page",
      mentions: [
        {
          kind: "written",
          href: "../page/index.html#L2",
          line: 2,
          context: "broader",
          file: { label: "page.md", href: "../page/index.html" },
        },
      ],
    });
    expect(text).toBe(
      [
        "{",
        '  "id": "glossary/keyword-page",',
        '  "mentions": [',
        "    {",
        '      "context": "broader",',
        '      "file": {',
        '        "href": "../page/index.html",',
        '        "label": "page.md"',
        "      },",
        '      "href": "../page/index.html#L2",',
        '      "kind": "written",',
        '      "line": 2',
        "    }",
        "  ]",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("writes nothing for an entity without a mention", () => {
    expect(mentionsFragmentOf(context(), orphanKeyword)).toBeUndefined();
  });
});
