import type { CanonicalModel } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  DEFAULT_MENTIONS_INLINE,
  evokedMentionsOf,
  locationOf,
  mentionsFragmentOf,
  mentionsOf,
  mentionsPanelOf,
  relatedMentionsOf,
  relatedViewOf,
  serializeMentionsFragment,
  surfaceOf,
} from "../../src/build/mentions.js";
import type { EntityFragment, FragmentDocument } from "../../src/build/fragments.js";
import { mentionsFragmentPath } from "../../src/build/paths.js";
import type { Mention } from "../../src/slots.js";
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

const pagePath = "glossary/keyword-page/index.html";

describe("mentionsOf", () => {
  it("turns the located provenances of the links into mentions, the first passage of each page first, the pages by number of passages, the corpus order breaking ties and ordering the passages of a page, a lost source left out", () => {
    const panel = {
      file: {
        label: "screens/mentions-panel.md",
        href: "../../specs/screens/mentions-panel/index.html",
      },
      title: "Mentions panel",
      type: "screen",
      typeLabel: "Screen",
      passages: 3,
    };
    expect(mentionsOf(context(), pagePath, term)).toEqual([
      {
        kind: "written",
        ...panel,
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
        kind: "recognised",
        ...panel,
        context: "Keyword page",
        line: 9,
        href: "../../specs/screens/mentions-panel/index.html#L9",
      },
      {
        kind: "recognised",
        ...panel,
        context: "…lists the keyword pages that cite the entity, grouped by file…",
        line: 15,
        href: "../../specs/screens/mentions-panel/index.html#L15",
        surface: "keyword page",
      },
    ]);
    expect(mentionsOf(context(), "keywords/zzz/index.html", orphanKeyword)).toEqual([]);
  });

  it("serves the other passages page by page beyond the first passages of the six pages listed first", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      from: `specs/rules/publication-threshold`,
      to: "glossary/keyword-page",
      relation: "related",
      confidence: 0.6,
      provenance: Array.from({ length: index + 1 }, (_, line) => ({
        method: "glossary_occurrence" as const,
        confidence: 0.6,
        path: `rules/rule-${String(index)}.md`,
        line: line + 1,
      })),
    }));
    const rules = many.map((_, index) =>
      entity({
        id: `specs/rules/rule-${String(index)}`,
        type: "rule",
        title: `Rule ${String(index)}`,
        source: { name: "specs", path: `rules/rule-${String(index)}.md`, line: 1 },
      }),
    );
    const ctx = context({
      model: model({ entities: [...model().entities, ...rules], links: many }),
    });
    const served = mentionsOf(ctx, pagePath, term).map(
      (mention) =>
        `${mention.title ?? ""} ${String(mention.line)}/${String(mention.passages ?? 1)}`,
    );
    expect(served).toEqual([
      "Rule 7 1/8",
      "Rule 6 1/7",
      "Rule 5 1/6",
      "Rule 4 1/5",
      "Rule 3 1/4",
      "Rule 2 1/3",
      ...[2, 3, 4, 5, 6, 7, 8].map((line) => `Rule 7 ${String(line)}/8`),
      ...[2, 3, 4, 5, 6, 7].map((line) => `Rule 6 ${String(line)}/7`),
      ...[2, 3, 4, 5, 6].map((line) => `Rule 5 ${String(line)}/6`),
      ...[2, 3, 4, 5].map((line) => `Rule 4 ${String(line)}/5`),
      ...[2, 3, 4].map((line) => `Rule 3 ${String(line)}/4`),
      ...[2, 3].map((line) => `Rule 2 ${String(line)}/3`),
      "Rule 1 1/2",
      "Rule 1 2/2",
      "Rule 0 1/1",
    ]);
  });

  it("puts the pages of the lead type first in the list, whatever their count, so that the served slice starts with them", () => {
    const ordered = mentionsOf(context(), pagePath, term, "rule").map((mention) => mention.line);
    expect(ordered).toEqual([1, 7, 5, 9, 15]);
  });

  it("quotes the sentence of the citing note around a written link, cut to the width of a scanned passage, and names the link text in it", () => {
    const withText = (text: string): SiteContext =>
      context({
        fragments: new Map([
          ...fragments,
          [
            "specs/screens/mentions-panel",
            { id: "specs/screens/mentions-panel", sections: [], text },
          ],
        ]),
      });
    const first = (ctx: SiteContext): Mention => {
      const [head] = mentionsOf(ctx, pagePath, term);
      if (head === undefined) throw new Error("a mention expected");
      return head;
    };
    expect(
      first(withText("The panel.\nThe panel lists the keyword pages that cite the entity.")),
    ).toMatchObject({
      context: "The panel lists the keyword pages that cite the entity.",
      surface: "keyword pages",
    });
    const long = `${"a".repeat(60)} keyword pages ${"b".repeat(60)}`;
    expect(first(withText(long)).context).toBe(
      `…${"a".repeat(33)} keyword pages ${"b".repeat(32)}…`,
    );
    const late = `${"a".repeat(100)} keyword pages.`;
    expect(first(withText(late)).context).toBe(`…${"a".repeat(65)} keyword pages.`);
    const early = `keyword pages ${"b".repeat(100)}`;
    expect(first(withText(early)).context).toBe(`keyword pages ${"b".repeat(66)}…`);
    // A note whose text never holds the link text quotes the link text alone, as a note without text does.
    expect(first(withText("Nothing of the kind."))).toMatchObject({ context: "keyword pages" });
    expect(first(withText("Nothing of the kind.")).surface).toBeUndefined();
    const empty = context({
      model: model({
        links: [
          {
            from: "specs/screens/mentions-panel",
            to: "glossary/keyword-page",
            relation: "displays",
            confidence: 1,
            provenance: [
              {
                method: "explicit_link",
                confidence: 1,
                path: "screens/mentions-panel.md",
                line: 7,
                text: "",
              },
            ],
          },
        ],
      }),
      fragments: new Map([
        ...fragments,
        [
          "specs/screens/mentions-panel",
          { id: "specs/screens/mentions-panel", sections: [], text: "Some text." },
        ],
      ]),
    });
    expect(first(empty)).toMatchObject({ context: "" });
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
      other: "{count} other",
      others: "{count} others",
      loadingOthers: "Loading the other pages…",
      othersUnavailable: "The other pages could not be loaded.",
      fullList: "Open the full list (JSON)",
      orderNote:
        "Ordered by number of passages, written and recognised together. “Cited” marks a link present in the text.",
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
    expect(french?.other).toBe("{count} autre");
    expect(french?.others).toBe("{count} autres");
    expect(french?.orderNote).toBe(
      "Ordonnées par nombre de passages, écrits et relevés confondus. « Cité » signale un lien présent dans le texte.",
    );
    expect(panel.leadType).toBeUndefined();
    expect(mentionsPanelOf(context(), pagePath, term, 3, "rule").leadType).toBe("rule");
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

/** A meeting of the fixtures: its minutes and its transcript evoke the keyword page and the page. */
const review = entity({
  id: "specs/meetings/keyword-page-review",
  type: "meeting",
  title: "Keyword page review",
  source: { name: "specs", path: "meetings/keyword-page-review.md", line: 1 },
  representations: [
    { path: "meetings/keyword-page-review.md", format: "markdown" },
    { path: "meetings/keyword-page-review.vtt", format: "vtt" },
  ],
});

const reviewPage = "specs/meetings/keyword-page-review/index.html";

function evoking(links: CanonicalModel["links"], documents?: FragmentDocument[]): SiteContext {
  const fragment: EntityFragment = {
    id: review.id,
    sections: [],
    text: "The review settled the keyword page threshold.",
    ...(documents === undefined ? {} : { documents }),
  };
  return context({
    model: model({ entities: [...model().entities, review], links: [...model().links, ...links] }),
    fragments: new Map([...fragments, [review.id, fragment]]),
  });
}

const transcript: FragmentDocument = {
  source: "specs",
  path: "meetings/keyword-page-review.vtt",
  format: "vtt",
  target: "fragments/specs/meetings/keyword-page-review.vtt",
  unit: "cue",
  pages: [{ number: 4, label: "00:12:04", text: "the keyword page" }],
};

describe("evokedMentionsOf", () => {
  const links: CanonicalModel["links"] = [
    {
      from: review.id,
      to: "glossary/keyword-page",
      relation: "related",
      confidence: 0.6,
      provenance: [
        {
          method: "glossary_occurrence",
          confidence: 0.6,
          path: "meetings/keyword-page-review.vtt",
          line: 4,
          occurrences: [{ line: 4, context: "the keyword page is settled", section: "00:12:04" }],
        },
        {
          method: "explicit_link",
          confidence: 1,
          path: "meetings/keyword-page-review.md",
          line: 3,
          text: "keyword page",
        },
        // Read from the note of the other end: a citation of the meeting, not a page it evokes.
        {
          method: "explicit_link",
          confidence: 1,
          path: "keyword-page.md",
          line: 8,
          text: "review",
        },
        { method: "cooccurrence", confidence: 0.3, count: 1 },
      ],
    },
    {
      from: "glossary/page",
      to: review.id,
      relation: "related",
      confidence: 0.6,
      provenance: [
        {
          method: "section_mention",
          confidence: 0.6,
          path: "meetings/keyword-page-review.md",
          section: "Decisions",
        },
      ],
    },
    {
      from: review.id,
      to: "unknown/ghost",
      relation: "related",
      confidence: 0.6,
      provenance: [
        {
          method: "explicit_link",
          confidence: 1,
          path: "meetings/keyword-page-review.md",
          line: 5,
        },
      ],
    },
  ];

  it("lists the pages the files of the entity evoke, whichever end the link puts first, the excerpt linking to the passage on the page itself and naming its position in a document", () => {
    expect(evokedMentionsOf(evoking(links), reviewPage, review)).toEqual([
      {
        kind: "written",
        file: { label: "keyword-page.md", href: "../../../glossary/keyword-page/index.html" },
        title: "Keyword page",
        type: "term",
        typeLabel: "Term",
        context: "The review settled the keyword page threshold.",
        surface: "keyword page",
        line: 3,
        href: "#L3",
        passages: 2,
      },
      {
        kind: "recognised",
        file: { label: "page.md", href: "../../../glossary/page/index.html" },
        title: "Page",
        type: "term",
        typeLabel: "Term",
        context: "in section Decisions",
        line: 1,
        href: "#L1",
      },
      {
        kind: "recognised",
        file: { label: "keyword-page.md", href: "../../../glossary/keyword-page/index.html" },
        title: "Keyword page",
        type: "term",
        typeLabel: "Term",
        context: "the keyword page is settled",
        surface: "keyword page",
        line: 4,
        href: "#L4",
        location: "00:12:04",
        passages: 2,
      },
    ]);
    // The frontmatter of a note evokes the page it names; a keyword without a link evokes nothing.
    expect(evokedMentionsOf(context(), pagePath, term).map((mention) => mention.href)).toEqual([
      "#L2",
    ]);
    expect(evokedMentionsOf(context(), "keywords/zzz/index.html", orphanKeyword)).toEqual([]);
  });

  it("joins the pages the entity evokes to the pages citing it for a meeting, and lists only the citing ones for a note of the model", () => {
    const ctx = evoking(links);
    expect(relatedMentionsOf(ctx, reviewPage, review).map((mention) => mention.href)).toEqual([
      "../../../glossary/keyword-page/index.html#L8",
      "#L1",
      "#L3",
      "#L4",
    ]);
    expect(relatedMentionsOf(ctx, pagePath, term)).toEqual(mentionsOf(ctx, pagePath, term));
    expect(mentionsFragmentOf(ctx, review)?.mentions).toHaveLength(4);
  });
});

describe("relatedViewOf", () => {
  it("takes a keyword page, a meeting and a document page outside the model, a note with a transcript or with notes alone inside it", () => {
    expect(relatedViewOf(context(), orphanKeyword)).toBe("evoked");
    expect(relatedViewOf(context(), review)).toBe("evoked");
    expect(relatedViewOf(context(), term)).toBe("citing");
    const deck: FragmentDocument = { ...transcript, unit: "slide", format: "pptx" };
    const withDeck = evoking([], [deck]);
    const brief = { ...review, type: "document" };
    expect(relatedViewOf(withDeck, brief)).toBe("evoked");
    expect(relatedViewOf(evoking([], [deck, transcript]), brief)).toBe("citing");
    expect(relatedViewOf(evoking([], []), brief)).toBe("citing");
    expect(mentionsPanelOf(withDeck, reviewPage, brief).labels?.orderNote).toBe(
      "A document does not enter the model: its pages bring passages, and the note that describes it stands among its files.",
    );
    expect(mentionsPanelOf(evoking([]), reviewPage, review).labels?.orderNote).toBe(
      "A meeting does not enter the model: it brings passages, and sometimes a decision someone took the trouble to write elsewhere.",
    );
  });
});

describe("the related pages of a keyword page", () => {
  it("lists the pages where the word is used, from the passages of its fragment, most passages first, the words marked and the position named in a document, a file that is no page left out", () => {
    const page = "keywords/build-summary/index.html";
    const passages = [
      ...(fragments.get("keywords/build-summary")?.passages ?? []),
      {
        source: "specs",
        path: "screens/mentions-panel.pptx",
        line: 2,
        text: "build summary",
        context: "a cut passage…",
      },
    ];
    const deck: FragmentDocument = {
      source: "specs",
      path: "screens/mentions-panel.pptx",
      format: "pptx",
      target: "fragments/specs/screens/mentions-panel.pptx",
      unit: "slide",
      pages: [{ number: 2, label: "slide 2", text: "the build summary" }],
    };
    const ctx = context({
      fragments: new Map([
        ...fragments,
        ["keywords/build-summary", { id: "keywords/build-summary", sections: [], passages }],
        [
          "specs/screens/mentions-panel",
          { id: "specs/screens/mentions-panel", sections: [], documents: [deck] },
        ],
      ]),
    });
    const screen = {
      kind: "recognised",
      title: "Mentions panel",
      type: "screen",
      typeLabel: "Screen",
      passages: 3,
    };
    expect(relatedMentionsOf(ctx, page, keyword)).toEqual([
      {
        ...screen,
        file: {
          label: "screens/mentions-panel.md",
          href: "../../specs/screens/mentions-panel/index.html",
        },
        context: "after the Build summaries",
        line: 12,
        href: "../../specs/screens/mentions-panel/index.html#L12",
        surface: "Build summaries",
      },
      {
        kind: "recognised",
        file: { label: "page.md", href: "../../glossary/page/index.html" },
        title: "Page",
        type: "term",
        typeLabel: "Term",
        context: "the build summary is printed",
        line: 3,
        href: "../../glossary/page/index.html#L3",
      },
      {
        ...screen,
        file: {
          label: "screens/mentions-panel.md",
          href: "../../specs/screens/mentions-panel/index.html",
        },
        context: "the build summary again",
        line: 40,
        href: "../../specs/screens/mentions-panel/index.html#L40",
        surface: "build summary",
      },
      {
        ...screen,
        file: {
          label: "screens/mentions-panel.pptx",
          href: "../../specs/screens/mentions-panel/index.html",
        },
        context: "a cut passage…",
        line: 2,
        href: "../../specs/screens/mentions-panel/index.html#L2",
        location: "slide 2",
      },
    ]);
    const panel = mentionsPanelOf(ctx, page, keyword);
    expect(panel.pages).toBe(2);
    expect(panel.labels?.orderNote).toBe(
      "Ordered by number of passages. None is “cited”: this word has no note to carry links.",
    );
    expect(panel.fragmentHref).toBe("../../fragments/keywords/build-summary.mentions.json");
    expect(mentionsFragmentOf(ctx, keyword)?.mentions).toHaveLength(4);
    expect(relatedMentionsOf(context(), "keywords/zzz/index.html", orphanKeyword)).toEqual([]);
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
