import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SOURCE_REF,
  citations,
  editHref,
  forgeEditHref,
  glyphOf,
  relationLabel,
  siteContext,
  typeLabel,
  type SiteContext,
  type SiteContextInput,
} from "../../src/build/context.js";
import {
  DEFAULT_MENTIONS_INLINE,
  entityPageOf,
  highlightsOf,
  mentionsOf,
  neighbourhoodOf,
  panelOf,
  sourcesOf,
} from "../../src/build/entity-page.js";
import { entriesOf, homeOf, shortcutsOf } from "../../src/build/home.js";
import { foldTitle, indexOf, letterOf } from "../../src/build/index-page.js";
import { companionsOf, keywordPageOf } from "../../src/build/keyword-page.js";
import { documentsOf, termsOf } from "../../src/build/todo.js";
import {
  entity,
  fragments,
  keyword,
  model,
  orphanKeyword,
  page,
  profile,
  screen,
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

describe("siteContext", () => {
  it("indexes the entities by identifier and by file, the representations of a note included, and the links by target", () => {
    const ctx = context();
    expect(ctx.entities.get("glossary/page")?.title).toBe("Page");
    expect(ctx.byFile.get("specs/screens/mentions-panel.md")?.id).toBe(
      "specs/screens/mentions-panel",
    );
    expect(ctx.byFile.get("specs/screens/mentions-panel.pptx")?.id).toBe(
      "specs/screens/mentions-panel",
    );
    expect(ctx.byFile.has("specs/screens/mentions-panel.md")).toBe(true);
    // A keyword page has no file of its own: the note it is located on stays the note's.
    expect(ctx.byFile.get("specs/nowhere.md")).toBeUndefined();
    expect(citations(ctx, "glossary/keyword-page")).toBe(4);
    expect(citations(ctx, "keywords/build-summary")).toBe(0);
    expect(ctx.language).toBe("en");
  });

  it("labels types and relations in the catalogue language, falling back to English then to the slug", () => {
    const en = context();
    expect(typeLabel(en, "business_object")).toBe("Business object");
    expect(typeLabel(en, "unknown_type")).toBe("unknown_type");
    expect(relationLabel(en, "composes")).toBe("composes");
    expect(relationLabel(en, "unknown_relation")).toBe("unknown_relation");
    const fr = context({ catalogue: loadCatalogue("fr") });
    expect(typeLabel(fr, "business_object")).toBe("Objet métier");
    expect(relationLabel(fr, "composes")).toBe("compose");
    const untranslated = context({
      catalogue: loadCatalogue("fr"),
      profile: {
        ...profile,
        types: { ...profile.types, term: { label: { en: "Term" }, group: "business" } },
      },
    });
    expect(typeLabel(untranslated, "term")).toBe("Term");
    expect(context({ catalogue: loadCatalogue("de") }).language).toBe("en");
  });

  it("marks a type with the first letter of its glyph, and none for a type without a glyph", () => {
    const ctx = context({
      profile: {
        ...profile,
        types: { ...profile.types, plain: { label: { en: "Plain" }, group: "business" } },
      },
    });
    expect(glyphOf(ctx, "term")).toBe("T");
    expect(glyphOf(ctx, "business_object")).toBe("O");
    expect(glyphOf(ctx, "plain")).toBeUndefined();
    expect(glyphOf(ctx, "unknown")).toBeUndefined();
  });

  it("fills the edit link pattern with the source, the path and the commit, and gives none without a pattern or without the commit it needs", () => {
    expect(editHref(context(), term)).toBeUndefined();
    const pattern = "https://forge.example/{source}/blob/{commit}/{path}";
    expect(editHref(context({ editUrl: pattern }), term)).toBe(
      "https://forge.example/glossary/blob/0123456789abcdef0123456789abcdef01234567/keyword-page.md",
    );
    expect(editHref(context({ editUrl: pattern }), screen)).toBeUndefined();
    expect(editHref(context({ editUrl: "https://forge.example/{source}/{path}" }), screen)).toBe(
      "https://forge.example/specs/screens/mentions-panel.md",
    );
  });

  it("builds the edit link from the source URL of the model on GitHub and GitLab, on the declared ref or main, and gives none for a local source", () => {
    const sources = (url: string) =>
      context({
        model: model({
          build: { ...model().build, sources: [{ name: "glossary", url }, { name: "specs" }] },
        }),
        sourceRefs: { specs: "develop" },
      });
    expect(editHref(sources("https://github.com/concordance-wiki/demo-glossary.git"), term)).toBe(
      "https://github.com/concordance-wiki/demo-glossary/edit/main/keyword-page.md",
    );
    expect(
      editHref(
        {
          ...sources("https://gitlab.com/concordance-wiki/demo-glossary/"),
          sourceRefs: { glossary: "v1" },
        },
        term,
      ),
    ).toBe("https://gitlab.com/concordance-wiki/demo-glossary/-/edit/v1/keyword-page.md");
    expect(editHref(sources("https://gitlab.example.org/wiki/glossary"), term)).toBe(
      "https://gitlab.example.org/wiki/glossary/-/edit/main/keyword-page.md",
    );
    expect(editHref(sources("https://forge.example.org/wiki/glossary"), term)).toBeUndefined();
    expect(
      editHref(sources("git@github.com:concordance-wiki/demo-glossary.git"), term),
    ).toBeUndefined();
    expect(
      editHref(sources("http://github.com/concordance-wiki/demo-glossary"), term),
    ).toBeUndefined();
    expect(editHref(sources("https://github.com/x"), screen)).toBeUndefined();
    expect(editHref(context(), term)).toBeUndefined();
    expect(DEFAULT_SOURCE_REF).toBe("main");
    expect(forgeEditHref("https://github.com/o/r", "main", "a/b.md")).toBe(
      "https://github.com/o/r/edit/main/a/b.md",
    );
  });
});

describe("entityPageOf", () => {
  it("shows the highlights the profile names for the type, in its order, an identifier value becoming a link", () => {
    expect(highlightsOf(context(), pagePath, term)).toEqual([
      { name: "aliases", label: "aliases", values: [{ text: "word page" }] },
      { name: "broader", label: "broader", values: [{ text: "Page", href: "../page/index.html" }] },
    ]);
    expect(highlightsOf(context(), "specs/screens/mentions-panel/index.html", screen)).toEqual([
      { name: "roles", label: "roles", values: [{ text: "roles/reader" }] },
      { name: "url_pattern", label: "url pattern", values: [{ text: "/{id}/" }] },
      { name: "status", label: "Status", values: [{ text: "active" }] },
    ]);
    expect(highlightsOf(context(), pagePath, entity({ ...term, type: "unknown_type" }))).toEqual(
      [],
    );
  });

  it("fills the side panel with the common properties then every attribute in key order, scalars and lists only", () => {
    expect(panelOf(context(), pagePath, term)).toEqual([
      { name: "application", label: "Application", values: [{ text: "concordance-cli" }] },
      { name: "domain", label: "Domain", values: [{ text: "publication" }] },
      { name: "status", label: "Status", values: [{ text: "active" }] },
      { name: "broader", label: "broader", values: [{ text: "Page", href: "../page/index.html" }] },
      { name: "note", label: "note", values: [{ text: "true" }] },
      { name: "supersedes", label: "supersedes", values: [{ text: "unknown/thing" }] },
      { name: "weight", label: "weight", values: [{ text: "3" }] },
    ]);
    const panel = panelOf(context(), "specs/screens/mentions-panel/index.html", screen);
    expect(panel.map((attribute) => attribute.name)).toEqual([
      "application",
      "domain",
      "status",
      "roles",
      "url_pattern",
    ]);
  });

  it("lists a key once when the profile highlights a common property the frontmatter also carries", () => {
    const duplicated = entity({ ...term, attributes: { status: "draft" } });
    const ctx = context({
      profile: {
        ...profile,
        types: {
          ...profile.types,
          term: {
            label: { en: "Term" },
            group: "business",
            display: { highlight: ["status", "status"] },
          },
        },
      },
    });
    expect(highlightsOf(ctx, pagePath, duplicated)).toEqual([
      { name: "status", label: "Status", values: [{ text: "active" }] },
    ]);
  });

  it("keeps the neighbours in the order of the model with their rank, labels the type and the relation, and weighs them by co-occurrence", () => {
    const neighbourhood = neighbourhoodOf(context(), pagePath, term);
    expect(neighbourhood.centre).toBe("Keyword page");
    expect(neighbourhood.neighbours).toEqual([
      {
        id: "glossary/page",
        label: "Page",
        href: "../page/index.html",
        typeLabel: "Term",
        relation: "broader",
        weight: 2,
        rank: 0,
      },
      {
        id: "specs/screens/mentions-panel",
        label: "Mentions panel",
        href: "../../specs/screens/mentions-panel/index.html",
        typeLabel: "Screen",
        relation: "displays",
        weight: 4,
        rank: 2,
      },
      {
        id: "keywords/build-summary",
        label: "build summary",
        href: "../../keywords/build-summary/index.html",
        typeLabel: "Keyword",
        relation: "unknown_relation",
        weight: 1,
        rank: 4,
      },
    ]);
    expect(neighbourhoodOf(context(), "glossary/page/index.html", page)).toEqual({
      centre: "Page",
      neighbours: [],
    });
    const bare = model();
    delete bare.neighbours;
    delete bare.displayed_neighbourhood;
    const bareContext = context({ model: bare });
    expect(neighbourhoodOf(bareContext, pagePath, term).neighbours).toEqual([]);
  });

  it("turns the located provenances of the links into mentions, written links first, then by file and line, a lost source left out", () => {
    expect(mentionsOf(context(), pagePath, term)).toEqual([
      {
        kind: "written",
        file: {
          label: "rules/publication-threshold.md",
          href: "../../specs/rules/publication-threshold/index.html",
        },
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
        context: "keyword pages",
        line: 7,
        href: "../../specs/screens/mentions-panel/index.html#L7",
      },
      {
        kind: "recognised",
        file: { label: "page.md", href: "../page/index.html" },
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
        context: "Keyword page",
        line: 15,
        href: "../../specs/screens/mentions-panel/index.html#L15",
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

  it("names the source file and its other representations, the edit link on the note, and takes the sections from the fragment", () => {
    const props = entityPageOf(
      context({ editUrl: "https://forge.example/{source}/{path}" }),
      screen,
    );
    expect(props.sources).toEqual([
      {
        source: "specs",
        path: "screens/mentions-panel.md",
        editHref: "https://forge.example/specs/screens/mentions-panel.md",
      },
      { source: "specs", path: "screens/mentions-panel.pptx" },
    ]);
    expect(sourcesOf(context(), screen)).toEqual([
      { source: "specs", path: "screens/mentions-panel.md" },
      { source: "specs", path: "screens/mentions-panel.pptx" },
    ]);
    expect(props.sections).toEqual([]);
    expect(props.mentions).toEqual({ mentions: [], initial: DEFAULT_MENTIONS_INLINE });
    const withNote = entityPageOf(context(), term, { mentionsInline: 3 });
    expect(withNote.entity).toEqual({
      id: "glossary/keyword-page",
      type: "term",
      typeLabel: "Term",
      title: "Keyword page",
      locale: "en",
    });
    expect(withNote.sections.map((section) => section.id)).toEqual([
      "section-lead",
      "section-not-to-be-confused-with",
    ]);
    expect(withNote.mentions.initial).toBe(3);
    expect(withNote.sources).toEqual([{ source: "glossary", path: "keyword-page.md" }]);
  });
});

describe("keywordPageOf", () => {
  it("counts from the entity, groups the passages by file in corpus order and leaves out a file that is no page", () => {
    const props = keywordPageOf(context(), keyword);
    expect(props.entity).toEqual({
      id: "keywords/build-summary",
      title: "build summary",
      locale: "en",
    });
    expect(props.counts).toEqual({ occurrences: 5, files: 2, sources: 2 });
    expect(props.passages).toEqual([
      {
        file: { label: "page.md", href: "../../glossary/page/index.html" },
        passages: [
          {
            context: "the build summary is printed",
            line: 3,
            href: "../../glossary/page/index.html#L3",
          },
        ],
      },
      {
        file: {
          label: "screens/mentions-panel.md",
          href: "../../specs/screens/mentions-panel/index.html",
        },
        passages: [
          {
            context: "after the build summary",
            line: 12,
            href: "../../specs/screens/mentions-panel/index.html#L12",
          },
          {
            context: "the build summary again",
            line: 40,
            href: "../../specs/screens/mentions-panel/index.html#L40",
          },
        ],
      },
    ]);
    expect(props.similar).toEqual([]);
  });

  it("weighs the companions against the most frequent one, a neighbour the model lost keeping its identifier without a link", () => {
    expect(companionsOf(context(), "keywords/build-summary/index.html", keyword)).toEqual([
      { label: "Mentions panel", href: "../../specs/screens/mentions-panel/index.html", weight: 5 },
      { label: "Keyword page", href: "../../glossary/keyword-page/index.html", weight: 3 },
      { label: "unknown/ghost", weight: 1 },
    ]);
    const orphan = keywordPageOf(context(), orphanKeyword);
    expect(orphan.counts).toEqual({ occurrences: 0, files: 0, sources: 0 });
    expect(orphan.passages).toEqual([]);
    expect(orphan.companions).toEqual([]);
  });
});

describe("homeOf", () => {
  it("counts the sources and files of the build block and offers the most cited entities as shortcuts", () => {
    const home = homeOf(context(), "Concordance notes");
    expect(home.title).toBe("Concordance notes");
    expect(home.search).toBeUndefined();
    expect(home.stats).toEqual({ sources: 3, files: 5, builtAt: "2026-09-12T12:00:00.000Z" });
    expect(shortcutsOf(context())).toEqual([
      { label: "Keyword page", href: "glossary/keyword-page/index.html" },
      { label: "vision", href: "framing/vision/index.html" },
      { label: "Page", href: "glossary/page/index.html" },
    ]);
  });

  it("lists the domains, the types and the applications with their counts, named by the configuration when it names them", () => {
    const entries = entriesOf(
      context({
        names: {
          domains: { publication: "Publication" },
          applications: { "concordance-cli": "Command line" },
        },
      }),
    );
    expect(entries.map((entry) => [entry.kind, entry.title, entry.href])).toEqual([
      ["tree", "Domains", "index/index.html"],
      ["index", "Types", "index/index.html"],
      ["recent", "Applications", "index/index.html"],
    ]);
    expect(entries[0]?.items).toEqual([
      { label: "inference/recognition", href: "index/index.html", count: 1 },
      { label: "Publication", href: "index/index.html", count: 3 },
    ]);
    expect(entries[1]?.items.map((item) => [item.label, item.count])).toEqual([
      ["Document", 1],
      ["Business rule", 1],
      ["Screen", 1],
      ["Term", 4],
    ]);
    expect(entries[2]?.items).toEqual([
      { label: "Command line", href: "index/index.html", count: 3 },
    ]);
  });
});

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

describe("todoOf", () => {
  it("lists the keyword pages by decreasing occurrences then identifier", () => {
    expect(termsOf(context())).toEqual([
      { label: "build summary", href: "../keywords/build-summary/index.html", count: 5 },
      { label: "#hash", href: "../keywords/zzz/index.html", count: 0 },
    ]);
    const twin = { ...keyword, id: "keywords/aaa", title: "aaa" };
    const tied = context({ model: model({ entities: [keyword, twin], links: [] }) });
    expect(termsOf(tied).map((entry) => entry.label)).toEqual(["aaa", "build summary"]);
  });

  it("lists the entities the W-DOC-NOMD findings name by decreasing finding count then identifier, ignoring findings without a page", () => {
    expect(documentsOf(context())).toEqual([
      { label: "vision", href: "../framing/vision/index.html", count: 2 },
      { label: "Page", href: "../glossary/page/index.html", count: 1 },
      { label: "Mentions panel", href: "../specs/screens/mentions-panel/index.html", count: 1 },
    ]);
  });
});
