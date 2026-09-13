import type { Entity } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import { categoryOf, topFoldersOf } from "../../src/build/space.js";
import {
  categoriesOf,
  citedInSpace,
  contentOf,
  repositoryOf,
  SPACE_CONTENT_TYPES,
  SPACE_RECENT,
  SPACE_WORDS,
  spaceLabels,
  spacePageOf,
  spaceRecentOf,
  spaceRowsOf,
  spacesLabels,
  spacesPageOf,
  spaceWordsOf,
} from "../../src/build/spaces.js";
import { entity, fragments, keyword, model, page, profile, screen, term } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

/** A note of `source` changed at `changed`, filed under `path`. */
function dated(id: string, source: string, path: string, changed: string): Entity {
  return entity({
    id,
    type: "term",
    title: id.split("/").pop() ?? id,
    source: { name: source, path, line: 1, last_modified: changed },
  });
}

const SPACE_PAGE = "specs/index.html";

describe("spaceRowsOf", () => {
  it("lists every space in the order of the home page with its initials, its content, its page count and the href of its page, keyword pages left out", () => {
    const rows = spaceRowsOf(context());
    expect(rows).toEqual([
      {
        name: "glossary",
        href: "../glossary/index.html",
        initials: "GL",
        content: "Term",
        count: 2,
        stale: false,
      },
      {
        name: "framing",
        href: "../framing/index.html",
        initials: "FR",
        content: "Document",
        count: 1,
        stale: false,
      },
      {
        name: "specs",
        href: "../specs/index.html",
        initials: "SP",
        content: "Business rule, Screen",
        count: 2,
        stale: false,
      },
    ]);
  });

  it("dates a space from its newest note, worded relative to the build, and in days once past the threshold", () => {
    const fresh = dated("specs/a/fresh", "specs", "a/fresh.md", "2026-09-10T00:00:00.000Z");
    const old = dated("specs/a/old", "specs", "a/old.md", "2026-01-01T00:00:00.000Z");
    const dormant = dated("notes/dormant", "notes", "dormant.md", "2026-03-03T00:00:00.000Z");
    const rows = spaceRowsOf(context({ model: model({ entities: [fresh, old, dormant] }) }));
    expect(rows.map((row) => [row.name, row.date, row.dateLabel, row.stale])).toEqual([
      ["framing", undefined, undefined, false],
      ["glossary", undefined, undefined, false],
      ["notes", "2026-03-03", "193 days ago", true],
      ["specs", "2026-09-10", "2 days ago", false],
    ]);
    const french = spaceRowsOf(
      context({
        model: model({ entities: [fresh, old, dormant] }),
        catalogue: loadCatalogue("fr"),
        locale: "fr",
      }),
    );
    expect(french.map((row) => row.dateLabel)).toEqual([
      undefined,
      undefined,
      "il y a 193 jours",
      "avant-hier",
    ]);
  });
});

describe("contentOf", () => {
  it("takes the sentence the configuration declares for the source", () => {
    const ctx = context({
      sourceDescriptions: { specs: "Screens, rules and objects of the tool." },
    });
    expect(contentOf(ctx, "specs")).toBe("Screens, rules and objects of the tool.");
    expect(contentOf(ctx, "glossary")).toBe("Term");
  });

  it("names the dominant types of the space otherwise, the most frequent first, the slug breaking ties, three at most, an undeclared type by its slug", () => {
    const note = (id: string, type: string): Entity => entity({ id, type, title: id });
    const ctx = context({
      model: model({
        entities: [
          note("specs/a", "rule"),
          note("specs/b", "rule"),
          note("specs/c", "screen"),
          note("specs/d", "process"),
          note("specs/e", "process"),
          note("specs/f", "widget"),
          note("specs/g", "role"),
        ],
      }),
    });
    expect(SPACE_CONTENT_TYPES).toBe(3);
    expect(contentOf(ctx, "specs")).toBe("Process, Business rule, Role");
    expect(contentOf(ctx, "framing")).toBe("");
    expect(
      contentOf(context({ model: model({ entities: [note("specs/f", "widget")] }) }), "specs"),
    ).toBe("widget");
  });
});

describe("spacesPageOf", () => {
  it("words the title, the lead counting the spaces, the columns and the note naming the default threshold", () => {
    const props = spacesPageOf(context());
    expect(props.spaces).toHaveLength(3);
    expect(props.labels).toEqual({
      title: "Spaces",
      lead: "3 spaces, fed by the repositories declared in the configuration. A repository may carry several spaces, and a space may spread over several repositories.",
      space: "Space",
      content: "Content",
      pages: "Pages",
      lastUpdate: "Last update",
      datesNote:
        "The dates come from the git history, so they are always exact. A space past the freshness threshold — 180 days by default — is marked in accent, the only case where colour carries an alert, doubled by the value in days.",
    });
    expect(spacesLabels(context({ catalogue: loadCatalogue("fr") }), 1).lead).toBe(
      "1 espace, alimenté par les dépôts déclarés dans la configuration. Un dépôt peut porter plusieurs espaces, et un espace se répartir sur plusieurs dépôts.",
    );
  });
});

describe("categoriesOf", () => {
  it("lists the top-level folders of the space by name with their page counts, folders included, each linking to its list, or to the page the tree lists first under it when a note takes the address of the list", () => {
    expect(categoryOf("screens/service/home.md")).toBe("screens");
    expect(categoryOf("readme.md")).toBeUndefined();
    const deep = dated("specs/a/b/c/deep", "specs", "a/b/c/deep.md", "2026-09-01T00:00:00.000Z");
    const shallow = dated("specs/a/shallow", "specs", "a/shallow.md", "2026-09-01T00:00:00.000Z");
    const zed = dated("specs/a/aaa", "specs", "a/zed.md", "2026-09-01T00:00:00.000Z");
    const root = dated("specs/readme", "specs", "readme.md", "2026-09-01T00:00:00.000Z");
    const ctx = context({ model: model({ entities: [deep, shallow, zed, root, screen] }) });
    expect(
      topFoldersOf(ctx, "specs").map(({ name, count, first }) => [name, count, first.id]),
    ).toEqual([
      ["a", 3, "specs/a/b/c/deep"],
      ["screens", 1, "specs/screens/mentions-panel"],
    ]);
    expect(categoriesOf(ctx, SPACE_PAGE, "specs")).toEqual([
      { label: "a", href: "a/index.html", count: 3 },
      { label: "screens", href: "screens/index.html", count: 1 },
    ]);
    // A note at the address of the list: the category leads to the first page of the folder instead,
    // two folders under one ordered by name, the first one leading.
    const taken = dated("specs/a", "specs", "a.md", "2026-09-01T00:00:00.000Z");
    const early = dated("specs/a/aa/x", "specs", "a/aa/x.md", "2026-09-01T00:00:00.000Z");
    expect(
      categoriesOf(
        context({ model: model({ entities: [deep, early, taken] }) }),
        SPACE_PAGE,
        "specs",
      ),
    ).toEqual([{ label: "a", href: "a/aa/x/index.html", count: 2 }]);
    // Two files of one folder: the file name orders them, then the identifier.
    const twin = dated("specs/a/aab", "specs", "a/zed.md", "2026-09-01T00:00:00.000Z");
    expect(
      topFoldersOf(context({ model: model({ entities: [zed, twin] }) }), "specs")[0]?.first.id,
    ).toBe("specs/a/aaa");
    expect(categoriesOf(ctx, SPACE_PAGE, "framing")).toEqual([]);
  });
});

describe("spaceRecentOf", () => {
  it("lists the notes of the space changed last, newest first then by identifier, with their category and their change worded, four at most", () => {
    const at = (day: number): string => `2026-09-${String(day).padStart(2, "0")}T00:00:00.000Z`;
    const notes = [
      dated("specs/rules/b", "specs", "rules/b.md", at(10)),
      dated("specs/rules/a", "specs", "rules/a.md", at(10)),
      dated("specs/readme", "specs", "readme.md", at(11)),
      dated("specs/screens/c", "specs", "screens/c.md", at(1)),
      dated("specs/screens/d", "specs", "screens/d.md", at(2)),
      dated("glossary/other", "glossary", "other.md", at(12)),
      entity({ id: "specs/undated", type: "rule", title: "undated" }),
    ];
    const recent = spaceRecentOf(
      context({ model: model({ entities: notes }) }),
      SPACE_PAGE,
      "specs",
    );
    expect(SPACE_RECENT).toBe(4);
    expect(recent).toEqual([
      { label: "readme", href: "readme/index.html", date: "2026-09-11", dateLabel: "yesterday" },
      {
        label: "a",
        href: "rules/a/index.html",
        category: "rules",
        date: "2026-09-10",
        dateLabel: "2 days ago",
      },
      {
        label: "b",
        href: "rules/b/index.html",
        category: "rules",
        date: "2026-09-10",
        dateLabel: "2 days ago",
      },
      {
        label: "d",
        href: "screens/d/index.html",
        category: "screens",
        date: "2026-09-02",
        dateLabel: "last week",
      },
    ]);
  });
});

describe("spaceWordsOf", () => {
  it("counts a note by the links from the notes of the space and a keyword page by its passages read there", () => {
    const ctx = context();
    expect(citedInSpace(ctx, "specs", term)).toBe(2);
    expect(citedInSpace(ctx, "glossary", term)).toBe(1);
    expect(citedInSpace(ctx, "glossary", page)).toBe(1);
    expect(citedInSpace(ctx, "specs", page)).toBe(0);
    expect(citedInSpace(ctx, "specs", keyword)).toBe(3);
    expect(citedInSpace(ctx, "glossary", keyword)).toBe(1);
    expect(citedInSpace(ctx, "framing", keyword)).toBe(0);
    expect(citedInSpace(ctx, "specs", screen)).toBe(0);
    // A keyword page without a fragment is cited nowhere.
    expect(citedInSpace(context({ fragments: new Map() }), "specs", keyword)).toBe(0);
  });

  it("offers the most cited pages, the identifier breaking ties, a keyword page marked as such, five at most, a page never cited left out", () => {
    expect(spaceWordsOf(context(), SPACE_PAGE, "specs")).toEqual([
      {
        label: "build summary",
        href: "../keywords/build-summary/index.html",
        count: 3,
        keyword: true,
      },
      { label: "Keyword page", href: "../glossary/keyword-page/index.html", count: 2 },
    ]);
    expect(spaceWordsOf(context(), SPACE_PAGE, "glossary")).toEqual([
      { label: "vision", href: "../framing/vision/index.html", count: 1 },
      { label: "Keyword page", href: "../glossary/keyword-page/index.html", count: 1 },
      { label: "Page", href: "../glossary/page/index.html", count: 1 },
      {
        label: "build summary",
        href: "../keywords/build-summary/index.html",
        count: 1,
        keyword: true,
      },
    ]);
    const targets = Array.from({ length: 7 }, (_, index) =>
      entity({ id: `glossary/word-${String(index)}`, type: "term", title: "w" }),
    );
    const many = context({
      model: model({
        entities: [...targets, screen],
        links: targets.map((target) => ({
          from: screen.id,
          to: target.id,
          relation: "related",
          confidence: 0.5,
          provenance: [],
        })),
      }),
    });
    expect(SPACE_WORDS).toBe(5);
    expect(spaceWordsOf(many, SPACE_PAGE, "specs").map((word) => word.href)).toEqual([
      "../glossary/word-0/index.html",
      "../glossary/word-1/index.html",
      "../glossary/word-2/index.html",
      "../glossary/word-3/index.html",
      "../glossary/word-4/index.html",
    ]);
  });
});

describe("repositoryOf", () => {
  it("names the repository from the URL the build recorded, without its .git suffix or trailing slash, else by the name of the source", () => {
    const withUrl = model();
    withUrl.build.sources = [
      { name: "glossary", url: "https://github.com/concordance-wiki/demo-glossary.git" },
      { name: "specs", url: "https://gitlab.com/concordance-wiki/demo-specs/" },
      { name: "framing", url: "" },
    ];
    const ctx = context({ model: withUrl });
    expect(repositoryOf(ctx, "glossary")).toBe("demo-glossary");
    expect(repositoryOf(ctx, "specs")).toBe("demo-specs");
    expect(repositoryOf(ctx, "framing")).toBe("framing");
    expect(repositoryOf(context(), "specs")).toBe("specs");
    expect(repositoryOf(context(), "notes")).toBe("notes");
  });
});

describe("spacePageOf", () => {
  it("gathers the badge, the description of the configuration, the counts, the repository, the newest change, the categories, the recent changes, the words and the labels of one space", () => {
    const changed = dated(
      "specs/rules/publication-threshold",
      "specs",
      "rules/publication-threshold.md",
      "2026-09-09T00:00:00.000Z",
    );
    const ctx = context({
      model: model({ entities: [changed, screen, term, page, keyword] }),
      sourceDescriptions: { specs: "Screens and rules of the tool." },
    });
    const props = spacePageOf(ctx, "specs");
    expect(props).toEqual({
      name: "specs",
      initials: "SP",
      description: "Screens and rules of the tool.",
      spacesHref: "../spaces/index.html",
      repository: "specs",
      count: 2,
      date: "2026-09-09",
      categories: [
        { label: "rules", href: "rules/index.html", count: 1 },
        { label: "screens", href: "screens/index.html", count: 1 },
      ],
      recent: [
        {
          label: "publication-threshold",
          href: "rules/publication-threshold/index.html",
          category: "rules",
          date: "2026-09-09",
          dateLabel: "3 days ago",
        },
      ],
      words: [
        {
          label: "build summary",
          href: "../keywords/build-summary/index.html",
          count: 3,
          keyword: true,
        },
        { label: "Keyword page", href: "../glossary/keyword-page/index.html", count: 2 },
      ],
      labels: {
        breadcrumb: "You are here",
        spaces: "Spaces",
        pages: "2 pages",
        repository: "repository",
        updated: "updated 3 days ago",
        browse: "Browse",
        categoriesLead: "2 categories, as filed in the repository",
        categoriesNote:
          "Each category opens its own list. The tree on the left appears only once in a page, so that nothing has to be unfolded from the home page.",
        recent: "Recently changed",
        mostCited: "The most cited words here",
        wordsNote: "Counted in this space only, which gives its own vocabulary.",
        footer:
          "A space reads like a small wiki within the wiki: its own search, its own vocabulary, its own news.",
      },
    });
  });

  it("leaves out the description, the date and the updated label when the configuration and the git history give none", () => {
    const props = spacePageOf(context(), "framing");
    expect(props.description).toBeUndefined();
    expect(props.date).toBeUndefined();
    expect(props.labels?.updated).toBeUndefined();
    expect(props.labels?.pages).toBe("1 page");
    expect(props.labels?.categoriesLead).toBe("0 categories, as filed in the repository");
    expect(
      spaceLabels(
        context({ catalogue: loadCatalogue("fr") }),
        { pages: 1, categories: 1 },
        undefined,
      ),
    ).toMatchObject({
      pages: "1 page",
      categoriesLead: "1 catégorie, telle que rangée dans le dépôt",
      browse: "Parcourir",
    });
  });
});
