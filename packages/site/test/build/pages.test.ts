import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SOURCE_REF,
  citations,
  editHref,
  forgeEditHref,
  glyphNameOf,
  glyphOf,
  relationLabel,
  siteContext,
  typeLabel,
  type SiteContext,
  type SiteContextInput,
} from "../../src/build/context.js";
import {
  entityPageOf,
  highlightsOf,
  neighbourhoodOf,
  panelOf,
  sourcesOf,
} from "../../src/build/entity-page.js";
import { DEFAULT_MENTIONS_INLINE } from "../../src/build/mentions.js";
import { companionsOf, keywordPageOf } from "../../src/build/keyword-page.js";
import {
  entity,
  fragments,
  keyword,
  links,
  model,
  orphanKeyword,
  page,
  profile,
  screen,
  term,
  untyped,
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

/** A displayed neighbour reached through `accesses`, a relation the profile declares with an inverse label. */
const accessed = {
  id: "specs/screens/mentions-panel",
  title: "Mentions panel",
  type: "screen",
  kind: "entity",
  relation: "accesses",
  confidence: 1,
  rank: 0,
} as const;

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

  it("keeps the neighbours in the order of the model with their rank, kind and type glyph, labels the type and the relation, and weighs them by co-occurrence", () => {
    const neighbourhood = neighbourhoodOf(context(), pagePath, term);
    expect(neighbourhood.centre).toBe("Keyword page");
    expect(neighbourhood.neighbours).toEqual([
      {
        id: "glossary/page",
        label: "Page",
        href: "../page/index.html",
        typeLabel: "Term",
        typeGlyph: "term",
        kind: "entity",
        relation: "broader",
        weight: 2,
        rank: 0,
      },
      {
        id: "specs/screens/mentions-panel",
        label: "Mentions panel",
        href: "../../specs/screens/mentions-panel/index.html",
        typeLabel: "Screen",
        typeGlyph: "screen",
        kind: "entity",
        relation: "displays",
        weight: 4,
        rank: 2,
      },
      {
        id: "keywords/build-summary",
        label: "build summary",
        href: "../../keywords/build-summary/index.html",
        typeLabel: "Keyword",
        kind: "keyword",
        relation: "unknown_relation",
        weight: 1,
        rank: 4,
      },
    ]);
    expect(neighbourhoodOf(context(), "glossary/page/index.html", page)).toEqual({
      centre: "Page",
      neighbours: [],
      total: 2,
    });
    const bare = model();
    delete bare.neighbours;
    delete bare.displayed_neighbourhood;
    const bareContext = context({ model: bare });
    expect(neighbourhoodOf(bareContext, pagePath, term).neighbours).toEqual([]);
  });

  it("counts every one-hop neighbour of the model as the total, a lost end or a loop counting for none, never under the number shown", () => {
    // Three links touch the page: the panel, the page and the rule; the ghost is no entity of the model.
    expect(neighbourhoodOf(context(), pagePath, term).total).toBe(3);
    const looped = model({
      links: [
        ...links,
        { from: term.id, to: term.id, relation: "related", confidence: 0.5, provenance: [] },
        { from: untyped.id, to: term.id, relation: "related", confidence: 0.5, provenance: [] },
      ],
    });
    expect(neighbourhoodOf(context({ model: looped }), pagePath, term).total).toBe(4);
    const unlinked = model({ links: [] });
    expect(neighbourhoodOf(context({ model: unlinked }), pagePath, term).total).toBe(3);
  });

  it("names the relation from the page: the inverse label for a link pointing at the page, the plain one otherwise or when the relation has no inverse", () => {
    const [page, screen, keyword] = neighbourhoodOf(context(), pagePath, term).neighbours;
    // `broader` and `displays` are not declared by the profile: their slugs stand in both directions.
    expect(page?.relation).toBe("broader");
    expect(screen?.relation).toBe("displays");
    expect(keyword?.relation).toBe("unknown_relation");
    const declared = model({
      displayed_neighbourhood: {
        [term.id]: [
          { ...accessed, direction: "in" },
          { ...accessed, id: "glossary/page", direction: "out" },
          { ...accessed, id: "framing/vision", direction: "both" },
          { ...accessed, id: "keywords/build-summary", relation: "related", direction: "in" },
        ],
      },
    });
    const relations = neighbourhoodOf(context({ model: declared }), pagePath, term).neighbours.map(
      (neighbour) => neighbour.relation,
    );
    expect(relations).toEqual(["is accessed by", "accesses", "accesses", "is related to"]);
    const fr = context({ model: declared, catalogue: loadCatalogue("fr") });
    expect(neighbourhoodOf(fr, pagePath, term).neighbours[0]?.relation).toBe("est accédé par");
    expect(relationLabel(context(), "accesses", { inverse: true })).toBe("is accessed by");
    expect(relationLabel(context(), "accesses", { inverse: false })).toBe("accesses");
    expect(relationLabel(context(), "unknown_relation", { inverse: true })).toBe(
      "unknown_relation",
    );
  });

  it("passes no type glyph for a type the profile gives none, nor for a noteless word", () => {
    const ctx = context({
      profile: {
        ...profile,
        types: { ...profile.types, term: { label: { en: "Term" }, group: "business" } },
      },
    });
    const [first] = neighbourhoodOf(ctx, pagePath, term).neighbours;
    expect(first).not.toHaveProperty("typeGlyph");
    expect(first?.kind).toBe("entity");
    expect(glyphNameOf(ctx, "term")).toBeUndefined();
    expect(glyphNameOf(context(), "term")).toBe("term");
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
    expect(props.mentions).toEqual({
      mentions: [],
      initial: DEFAULT_MENTIONS_INLINE,
      headings: { written: "Explicit mentions", recognised: "Inferred mentions" },
    });
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
    expect(withNote.mentions.fragmentHref).toBe(
      "../../fragments/glossary/keyword-page.mentions.json",
    );
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
