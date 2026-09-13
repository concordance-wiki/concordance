import type { CanonicalModel, Entity, Link } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import type { Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_SOURCE_REF,
  citations,
  createNoteHref,
  editHref,
  forgeEditHref,
  forgeNewFileHref,
  glyphNameOf,
  glyphOf,
  relationLabel,
  siteContext,
  typeLabel,
  type SiteContext,
  type SiteContextInput,
} from "../../src/build/context.js";
import {
  changedOf,
  contractOf,
  declarationOf,
  entityPageOf,
  highlightsOf,
  neighbourhoodLabels,
  neighbourhoodOf,
  neighbourPages,
  othersOf,
  panelOf,
  sectionsOf,
  sourcesOf,
} from "../../src/build/entity-page.js";
import type {
  EntityFragment,
  FragmentDocument,
  FragmentPassage,
} from "../../src/build/fragments.js";
import {
  KEYWORD_NEIGHBOURS_MAX,
  keywordNeighbourhoodOf,
  keywordPageLabels,
  keywordPageOf,
  keywordSpaceOf,
  passageGroupsOf,
  passageLocationOf,
  similarOf,
  usedSinceOf,
} from "../../src/build/keyword-page.js";
import { DEFAULT_MENTIONS_INLINE, mentionsPanelOf } from "../../src/build/mentions.js";
import {
  breadcrumbOf,
  initialsOf,
  SPACE_PAGES_MAX,
  spaceCountsOf,
  spaceLinksOf,
  spaceOf,
} from "../../src/build/space.js";
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
  it("shows the highlights the profile names for the type, in its order, labelled by the profile, an identifier value becoming a link", () => {
    expect(highlightsOf(context(), pagePath, term)).toEqual([
      { name: "aliases", label: "aliases", values: [{ text: "word page" }] },
      {
        name: "broader",
        label: "Broader term",
        values: [{ text: "Page", href: "../page/index.html" }],
      },
    ]);
    expect(highlightsOf(context(), "specs/screens/mentions-panel/index.html", screen)).toEqual([
      { name: "roles", label: "Roles", values: [{ text: "roles/reader" }] },
      { name: "url_pattern", label: "URL pattern", values: [{ text: "/{id}/" }] },
      { name: "status", label: "Status", values: [{ text: "active" }] },
    ]);
    expect(highlightsOf(context(), pagePath, entity({ ...term, type: "unknown_type" }))).toEqual(
      [],
    );
  });

  it("labels an attribute in the site language, falling back to English then to the key itself", () => {
    const french = context({ catalogue: loadCatalogue("fr") });
    expect(highlightsOf(french, pagePath, term)[1]?.label).toBe("Terme générique");
    const englishOnly = context({
      profile: {
        ...profile,
        types: {
          ...profile.types,
          term: {
            label: { en: "Term" },
            group: "business",
            attributes: { broader: { type: "ref", label: { en: "Broader" } } },
            display: { highlight: ["broader"] },
          },
        },
      },
      catalogue: loadCatalogue("fr"),
    });
    expect(highlightsOf(englishOnly, pagePath, term)[0]?.label).toBe("Broader");
  });

  it("fills the side panel with the common properties, the declared attributes of the type in declaration order, then the declared common ones", () => {
    const declaredCommon = entity({
      ...term,
      attributes: { ...term.attributes, superseded_by: "glossary/page", locale: "en" },
    });
    expect(panelOf(context(), pagePath, declaredCommon)).toEqual([
      { name: "application", label: "Application", values: [{ text: "concordance-cli" }] },
      { name: "domain", label: "Domain", values: [{ text: "publication" }] },
      { name: "status", label: "Status", values: [{ text: "active" }] },
      {
        name: "broader",
        label: "Broader term",
        values: [{ text: "Page", href: "../page/index.html" }],
      },
      { name: "locale", label: "locale", values: [{ text: "en" }] },
      {
        name: "superseded_by",
        label: "superseded by",
        values: [{ text: "Page", href: "../page/index.html" }],
      },
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

  it("keeps the attributes the profile does not declare apart, as written, in key order", () => {
    expect(othersOf(context(), term)).toEqual([
      { name: "note", label: "note", values: [{ text: "true" }] },
      { name: "supersedes", label: "supersedes", values: [{ text: "unknown/thing" }] },
      { name: "weight", label: "weight", values: [{ text: "3" }] },
    ]);
    const nested = entity({
      ...term,
      attributes: {
        steps: [{ action: "rebuild" }, "check", 2],
        owner: { team: "quality" },
        empty: null,
        none: [],
      },
    });
    expect(othersOf(context(), nested)).toEqual([
      { name: "owner", label: "owner", values: [{ text: '{"team":"quality"}' }] },
      {
        name: "steps",
        label: "steps",
        values: [{ text: '{"action":"rebuild"}' }, { text: "check" }, { text: "2" }],
      },
    ]);
    expect(othersOf(context(), screen)).toEqual([]);
    expect(othersOf(context(), entity({ ...term, type: "unknown_type" }))).toEqual([
      { name: "broader", label: "broader", values: [{ text: "glossary/page" }] },
      { name: "note", label: "note", values: [{ text: "true" }] },
      { name: "supersedes", label: "supersedes", values: [{ text: "unknown/thing" }] },
      { name: "weight", label: "weight", values: [{ text: "3" }] },
    ]);
  });

  it("shows a declared number or boolean as text, and reads every key as declared by the type when the profile has no common attributes", () => {
    const report = entity({
      id: "framing/lint-report",
      type: "document",
      title: "Lint report",
      attributes: { pages: 3, preview_available: true, author: "Participant-1" },
    });
    expect(
      panelOf(context(), pagePath, report).map((attribute) => [
        attribute.label,
        attribute.values[0]?.text,
      ]),
    ).toEqual([
      ["Status", "active"],
      ["Author", "Participant-1"],
      ["Pages", "3"],
      ["Preview available", "true"],
    ]);
    const withoutCommon: Profile = { ...profile };
    delete withoutCommon.common_attributes;
    const ctx = context({ profile: withoutCommon });
    expect(othersOf(ctx, term).map((attribute) => attribute.name)).toEqual([
      "note",
      "supersedes",
      "weight",
    ]);
    expect(panelOf(ctx, pagePath, term).map((attribute) => attribute.name)).toEqual([
      "application",
      "domain",
      "status",
      "broader",
    ]);
  });

  it("builds the page of an entity of an undeclared type without a declaration, every attribute among the others", () => {
    const stranger = entityPageOf(context(), entity({ ...term, type: "unknown_type" }));
    expect(stranger.declaration).toBeUndefined();
    expect(stranger.entity.typeLabel).toBe("unknown_type");
    expect(stranger.highlights).toEqual([]);
    expect(stranger.otherAttributes?.map((attribute) => attribute.name)).toEqual([
      "broader",
      "note",
      "supersedes",
      "weight",
    ]);
    expect(stranger.labels).toEqual({
      properties: "Properties",
      declaredAtTop: "3 declared keys. The rest of the file is free text.",
      otherAttributes: "Other attributes",
      onThisPage: "On this page",
      spaceTree: "Tree of the space",
      breadcrumb: "You are here",
      correction: "Something to correct?",
      edit: "Edit this page",
      seeNeighbourhood: "See the neighbourhood map",
      neighbourPages: "3 pages",
      legendWritten: "written link",
      legendRecognised: "recognised word, existing note",
      legendKeyword: "recognised word, no note",
      imageNote: "Image of the repository, shown in the flow of the text",
    });
    expect(stranger.attributes).toHaveLength(3);
    expect(stranger.neighbours.total).toBe(3);
    const declared = entityPageOf(context(), screen);
    expect(declared.declaration?.type).toBe("screen");
    expect(declared.otherAttributes).toBeUndefined();
  });

  it("words the last change of the note relative to the build instant, in the project locale, and none without a git date", () => {
    const dated = entity({
      ...term,
      source: { ...term.source, last_modified: "2026-09-09T08:00:00.000Z" },
    });
    expect(changedOf(context(), dated)).toEqual({
      date: "2026-09-09",
      label: "Changed 3 days ago",
      short: "3 days ago",
    });
    // The project locale words the duration; the language of the catalogue when the context names none.
    expect(changedOf(context({ locale: "fr" }), dated)?.label).toBe("Changed il y a 3 jours");
    const french = changedOf(context({ catalogue: loadCatalogue("fr") }), dated);
    expect(french?.label).toBe("Modifié il y a 3 jours");
    expect(french?.short).toBe("il y a 3\u00a0j");
    expect(changedOf(context(), term)).toBeUndefined();
    expect(entityPageOf(context(), dated).changed?.date).toBe("2026-09-09");
    expect(entityPageOf(context(), term).changed).toBeUndefined();
  });

  it("counts the pages of the neighbourhood from the neighbours listed, never from the total the model holds beyond them", () => {
    expect(neighbourPages({ centre: "x", neighbours: [], total: 7 })).toBe(0);
    expect(
      neighbourPages({
        centre: "x",
        neighbours: [{ id: "a", label: "a", href: "a/", weight: 1 }],
        total: 7,
      }),
    ).toBe(1);
    expect(
      neighbourPages({
        centre: "x",
        neighbours: [{ id: "a", label: "a", href: "a/", weight: 1 }],
      }),
    ).toBe(1);
  });

  it("gives every page the tree of its space and its breadcrumb: the folders on the way open, the page marked current, the space linked to its page, every folder and every step to their lists", () => {
    const props = entityPageOf(context(), screen);
    expect(props.space).toEqual({
      name: "specs",
      initials: "SP",
      href: "../../index.html",
      nodes: [
        { label: "rules", count: 1, href: "../../rules/index.html" },
        {
          label: "screens",
          count: 1,
          children: [{ label: "Mentions panel", current: true }],
          href: "../index.html",
        },
      ],
    });
    expect(props.breadcrumb).toEqual([
      { label: "specs", href: "../../index.html" },
      { label: "screens", href: "../index.html" },
      { label: "Mentions panel" },
    ]);
    const glossary = spaceOf(context(), pagePath, term);
    expect(glossary).toEqual({
      name: "glossary",
      initials: "GL",
      href: "../index.html",
      nodes: [
        { label: "Keyword page", current: true },
        { label: "Page", href: "../page/index.html" },
      ],
    });
    expect(breadcrumbOf(context(), pagePath, term)).toEqual([
      { label: "glossary", href: "../index.html" },
      { label: "Keyword page" },
    ]);
    // A page two folders deep opens both, its siblings listed at every level, every folder linked to its list.
    const deep = entity({
      ...screen,
      id: "specs/screens/service/query",
      title: "Query",
      source: { name: "specs", path: "screens/service/query.md", line: 1 },
      representations: [],
    });
    const sibling = entity({
      ...screen,
      id: "specs/screens/service/other",
      title: "Other",
      source: { name: "specs", path: "screens/service/other.md", line: 1 },
      representations: [],
    });
    const nested = context({ model: model({ entities: [...model().entities, deep, sibling] }) });
    expect(spaceOf(nested, "specs/screens/service/query/index.html", deep).nodes).toEqual([
      { label: "rules", count: 1, href: "../../../rules/index.html" },
      {
        label: "screens",
        count: 3,
        href: "../../index.html",
        children: [
          {
            label: "service",
            count: 2,
            href: "../index.html",
            children: [
              { label: "Other", href: "../other/index.html" },
              { label: "Query", current: true },
            ],
          },
          { label: "Mentions panel", href: "../../mentions-panel/index.html" },
        ],
      },
    ]);
    expect(breadcrumbOf(nested, "specs/screens/service/query/index.html", deep)).toEqual([
      { label: "specs", href: "../../../index.html" },
      { label: "screens", href: "../../index.html" },
      { label: "service", href: "../index.html" },
      { label: "Query" },
    ]);
    // A note that takes the address of a deeper folder: that folder alone has no list to link to.
    const service = entity({
      id: "specs/screens/service",
      type: "document",
      title: "Service",
      source: { name: "specs", path: "screens/service.md", line: 1 },
    });
    const shadowedDeep = context({
      model: model({ entities: [...model().entities, deep, sibling, service] }),
    });
    expect(breadcrumbOf(shadowedDeep, "specs/screens/service/query/index.html", deep)).toEqual([
      { label: "specs", href: "../../../index.html" },
      { label: "screens", href: "../../index.html" },
      { label: "service" },
      { label: "Query" },
    ]);
    const [, screensNode] = spaceOf(
      shadowedDeep,
      "specs/screens/service/query/index.html",
      deep,
    ).nodes;
    expect(screensNode?.children?.[0]).toEqual({
      label: "service",
      count: 2,
      children: [
        { label: "Other", href: "../other/index.html" },
        { label: "Query", current: true },
      ],
    });
    // A note that takes the address of a folder at the top: the folder has no list to link to.
    const taken = entity({
      id: "specs/screens",
      type: "document",
      title: "Screens",
      source: { name: "specs", path: "screens.md", line: 1 },
    });
    const shadowed = context({ model: model({ entities: [...model().entities, taken] }) });
    const page = "specs/screens/mentions-panel/index.html";
    expect(spaceOf(shadowed, page, screen).nodes).toEqual([
      { label: "rules", count: 1, href: "../../rules/index.html" },
      { label: "screens", count: 1, children: [{ label: "Mentions panel", current: true }] },
      { label: "Screens", href: "../index.html" },
    ]);
    expect(breadcrumbOf(shadowed, page, screen)).toEqual([
      { label: "specs", href: "../../index.html" },
      { label: "screens" },
      { label: "Mentions panel" },
    ]);
    expect(initialsOf("demo-specs")).toBe("DS");
    expect(SPACE_PAGES_MAX).toBe(40);
    expect(initialsOf("Glossary of the tool")).toBe("GO");
    expect(initialsOf("x")).toBe("X");
    expect(initialsOf("--")).toBe("--");
  });

  it("counts the notes of every space for the drawer, a declared source without any at zero, a source met on a note alone counted too, each linked to its page", () => {
    expect(spaceCountsOf(context())).toEqual([
      { name: "framing", initials: "FR", count: 1 },
      { name: "glossary", initials: "GL", count: 2 },
      { name: "specs", initials: "SP", count: 2 },
    ]);
    const empty = context({
      model: model({
        build: { ...model().build, sources: [...model().build.sources, { name: "briefs" }] },
      }),
    });
    expect(spaceCountsOf(empty).map(({ name, count }) => `${name}:${String(count)}`)).toEqual([
      "briefs:0",
      "framing:1",
      "glossary:2",
      "specs:2",
    ]);
    const stray = entity({
      ...page,
      id: "notes/stray",
      title: "Stray",
      source: { name: "notes", path: "stray.md", line: 1 },
    });
    const extra = context({ model: model({ entities: [...model().entities, stray] }) });
    expect(spaceCountsOf(extra).map(({ name, count }) => `${name}:${String(count)}`)).toEqual([
      "framing:1",
      "glossary:2",
      "notes:1",
      "specs:2",
    ]);
    expect(spaceLinksOf(context(), pagePath, spaceCountsOf(context()).slice(1))).toEqual([
      { label: "glossary", href: "../index.html", initials: "GL", count: 2 },
      { label: "specs", href: "../../specs/index.html", initials: "SP", count: 2 },
    ]);
  });

  it("lists at most forty pages of a folder, a window around the current page, the pages left out counted at each end", () => {
    const notes = Array.from({ length: 100 }, (_, index) =>
      entity({
        ...page,
        id: `glossary/note-${String(index).padStart(3, "0")}`,
        title: `Note ${String(index)}`,
        source: { name: "glossary", path: `note-${String(index).padStart(3, "0")}.md`, line: 1 },
      }),
    );
    const nested = entity({
      ...page,
      id: "glossary/deep/note",
      title: "Deep note",
      source: { name: "glossary", path: "deep/note.md", line: 1 },
    });
    const ctx = context({ model: model({ entities: [...notes, nested] }) });
    const labels = (nodes: ReturnType<typeof spaceOf>["nodes"]): string[] =>
      nodes.map((node) => (node.omitted === true ? `[${node.label}]` : node.label));
    const middle = labels(spaceOf(ctx, "glossary/note-050/index.html", notes[50] as Entity).nodes);
    expect(middle).toHaveLength(43);
    expect(middle[0]).toBe("deep");
    expect(middle[1]).toBe("[30 other pages]");
    expect(middle[2]).toBe("Note 30");
    expect(middle[41]).toBe("Note 69");
    expect(middle[42]).toBe("[30 other pages]");
    const first = labels(spaceOf(ctx, "glossary/note-003/index.html", notes[3] as Entity).nodes);
    expect(first.slice(0, 2)).toEqual(["deep", "Note 0"]);
    expect(first.at(-1)).toBe("[60 other pages]");
    const last = labels(spaceOf(ctx, "glossary/note-099/index.html", notes[99] as Entity).nodes);
    expect(last[1]).toBe("[60 other pages]");
    expect(last.at(-1)).toBe("Note 99");
    // From a page deeper down, the folder above lists its first pages.
    const deep = labels(spaceOf(ctx, "glossary/deep/note/index.html", nested).nodes);
    expect(deep.slice(0, 2)).toEqual(["deep", "Note 0"]);
    expect(deep.at(-1)).toBe("[60 other pages]");
    expect(spaceOf(ctx, "glossary/deep/note/index.html", nested).nodes[0]?.children).toEqual([
      { label: "Deep note", current: true },
    ]);
    // One page short of the cap lists everything.
    const few = context({ model: model({ entities: notes.slice(0, 40) }) });
    expect(spaceOf(few, "glossary/note-000/index.html", notes[0] as Entity).nodes).toHaveLength(40);
    const one = labels(
      spaceOf(
        context({ model: model({ entities: notes.slice(0, 41) }) }),
        "glossary/note-000/index.html",
        notes[0] as Entity,
      ).nodes,
    );
    expect(one.at(-1)).toBe("[1 other page]");
  });

  it("exposes the declaration of the type, labelled in the site language, and none for an undeclared type", () => {
    const declaration = declarationOf(context(), "screen");
    expect(declaration?.type).toBe("screen");
    expect(declaration?.label).toBe("Screen");
    expect(declaration?.group).toBe("application");
    expect(declaration?.glyph).toBe("screen");
    expect(declaration?.attributes.map((attribute) => attribute.name)).toEqual([
      "roles",
      "reads",
      "writes",
      "actions",
      "rules",
      "url_pattern",
    ]);
    expect(declaration?.attributes[0]).toEqual({
      name: "roles",
      label: "Roles",
      type: "ref[]",
      target: ["role"],
      relation: "assigned_to",
    });
    expect(declaration?.attributes[1]?.target).toEqual(["business_object", "data_object"]);
    expect(declaration?.attributes[3]).toEqual({ name: "actions", label: "Actions", type: "list" });
    expect(declaration?.sections).toEqual([
      { key: "objects", heading: "Objects", parse: "bullet-list", produces: "accesses" },
      { key: "actions", heading: "Actions", parse: "ordered-list", produces: "triggers" },
      { key: "rules", heading: "Rules", parse: "bullet-list", produces: "constrains" },
    ]);
    expect(declaration?.display).toEqual({
      highlight: ["roles", "url_pattern", "status"],
      neighboursOrder: ["business_object", "data_object", "screen", "api", "rule", "process"],
    });
    expect(
      declarationOf(context({ catalogue: loadCatalogue("fr") }), "screen")?.sections[0],
    ).toEqual({ key: "objects", heading: "Objets", parse: "bullet-list", produces: "accesses" });
    const api = declarationOf(context(), "api");
    expect(api?.attributes[0]?.values).toEqual(["rest", "soap", "graphql", "grpc"]);
    expect(declarationOf(context(), "goal")).toEqual({
      type: "goal",
      label: "Goal",
      group: "motivation",
      glyph: "goal",
      attributes: [],
      sections: [],
      display: { highlight: [], neighboursOrder: [] },
    });
    expect(declarationOf(context(), "unknown_type")).toBeUndefined();
  });

  it("marks the sections of the note whose heading the type maps, in any language or by the key, and leaves the others", () => {
    const fragments = new Map<string, EntityFragment>([
      [
        screen.id,
        {
          id: screen.id,
          sections: [
            { id: "section-lead", html: "<p>lead</p>" },
            { id: "section-objects", heading: "  OBJETS ", html: "<ul></ul>" },
            { id: "section-rules", heading: "rules", html: "<ul></ul>" },
            { id: "section-notes", heading: "Notes", html: "<p></p>" },
          ],
        },
      ],
    ]);
    expect(sectionsOf(context({ fragments }), screen)).toEqual([
      { id: "section-lead", html: "<p>lead</p>" },
      { id: "section-objects", heading: "  OBJETS ", html: "<ul></ul>", key: "objects" },
      { id: "section-rules", heading: "rules", html: "<ul></ul>", key: "rules" },
      { id: "section-notes", heading: "Notes", html: "<p></p>" },
    ]);
    expect(sectionsOf(context(), screen)).toEqual([]);
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
    const empty = neighbourhoodOf(context(), "glossary/page/index.html", page);
    expect(empty).toMatchObject({ centre: "Page", neighbours: [], total: 2 });
    expect(empty.labels).toEqual({
      map: "Neighbourhood map",
      mapCaption: "The list below carries the same information as the map.",
      distance: "Distance",
      hop: "1 hop",
      types: "Types",
      existingPage: "existing page",
      noteless: "word without a note",
      neighbours: "The 0 neighbours",
      textualEquivalent: "textual equivalent",
      capNote:
        "Six neighbours at most, always named. Beyond that the map teaches nothing: the list takes over.",
      noNeighbour: "No neighbour recorded.",
      total: "2 neighbours in total, more than the map shows",
      seeMentions: "See the mentions panel",
    });
    expect(neighbourhood.labels).toMatchObject({
      neighbours: "The 3 neighbours",
      total: "3 neighbours in total, more than the map shows",
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
    const french = neighbourhoodOf(fr, pagePath, term);
    expect(french.neighbours[0]?.relation).toBe("est accédé par");
    expect(french.labels).toMatchObject({
      map: "Carte du voisinage",
      hop: "1 saut",
      types: "Types",
      neighbours: "Les 4 voisins",
      noteless: "mot sans définition",
    });
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

  it("names the source file and its other representations, the note linked to its forge page with the edit link on it, else the contribution address behind the edit link alone, and takes the sections from the fragment", () => {
    const props = entityPageOf(
      context({ editUrl: "https://forge.example/{source}/{path}" }),
      screen,
    );
    expect(props.sources).toEqual([
      {
        source: "specs",
        path: "screens/mentions-panel.md",
        href: "https://forge.example/specs/screens/mentions-panel.md",
        editHref: "https://forge.example/specs/screens/mentions-panel.md",
      },
      { source: "specs", path: "screens/mentions-panel.pptx" },
    ]);
    expect(sourcesOf(context(), screen)).toEqual([
      { source: "specs", path: "screens/mentions-panel.md" },
      { source: "specs", path: "screens/mentions-panel.pptx" },
    ]);
    expect(
      sourcesOf(context({ contributeUrl: "https://forge.example/wiki/contribute" }), screen),
    ).toEqual([
      {
        source: "specs",
        path: "screens/mentions-panel.md",
        editHref: "https://forge.example/wiki/contribute",
      },
      { source: "specs", path: "screens/mentions-panel.pptx" },
    ]);
    expect(props.sections).toEqual([]);
    expect(props.mentions).toMatchObject({
      mentions: [],
      initial: DEFAULT_MENTIONS_INLINE,
      pages: 0,
    });
    expect(props.mentions.labels?.related).toBe("Related pages");
    expect(props.mentions.fragmentHref).toBeUndefined();
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

describe("contractOf", () => {
  const modelQuery = entity({
    id: "specs/api/model-query",
    type: "api",
    title: "Model query API",
    attributes: { contract: "contracts/model-query.openapi.json" },
  });
  const forgeBridge = entity({
    id: "specs/api/forge-bridge",
    type: "api",
    title: "Forge bridge API",
    attributes: { contract: "https://example.invalid/forge-bridge.wsdl" },
  });
  const listEntities = entity({
    id: "specs/endpoints/list-entities",
    type: "endpoint",
    title: "List the entities",
    summary: "Returns the entities of the last build.",
    type_origin: "rule#7",
    attributes: {
      api: "api/model-query",
      method: "get",
      path: "/entities",
      operation_id: "listEntities",
    },
    representations: [
      { path: "endpoints/list-entities.md", format: "markdown" },
      {
        path: "contracts/model-query.openapi.json",
        format: "json",
        kind: "contract",
        operation: "listEntities",
      },
    ],
  });
  const searchModel = entity({
    id: "specs/api/model-query/searchmodel",
    type: "endpoint",
    title: "GET /search",
    type_origin: "contract",
    attributes: { method: "GET", path: "/search", style: "http" },
  });
  const suggestLinks = entity({
    id: "specs/endpoints/suggest-links",
    type: "endpoint",
    title: "Suggest links",
    summary: "Proposes the links a note could write.",
    type_origin: "rule#7",
    attributes: { api: "api/model-query", operation_id: "suggestLinks" },
  });
  const notifyBuild = entity({
    id: "specs/endpoints/notify-build",
    type: "endpoint",
    title: "Notify a build",
    type_origin: "rule#7",
    attributes: { api: "Forge bridge API", method: "POST", path: " " },
  });
  /** A finding of the check that names no entity: nothing to attach it to. */
  const anonymous: CanonicalModel["findings"][number] = {
    check: "W-OPERATION-UNMATCHED",
    severity: "warning",
    message: "operation note x matches no operation",
    remediation: "Compare the note with the contract.",
    source: "specs",
    path: "endpoints/x.md",
  };
  const unmatched = (id: string): CanonicalModel["findings"][number] => ({
    check: "W-OPERATION-UNMATCHED",
    severity: "warning",
    message: `operation note ${id} matches no operation`,
    remediation: "Compare the note with the contract.",
    source: "specs",
    path: "endpoints/x.md",
    entity: id,
  });
  const exposes = (to: string, operation?: string, provenance = "contract_import"): Link => ({
    from: "specs/api/model-query",
    to,
    relation: "exposes",
    confidence: 0.95,
    provenance: [
      {
        // The test writes the method it needs; the model only ever carries known methods.
        method: provenance as Link["provenance"][number]["method"],
        confidence: 0.95,
        path: "contracts/model-query.openapi.json",
        ...(operation === undefined ? {} : { operation }),
      },
    ],
  });
  /** A screen whose note links to the operation: one page citing it. */
  const cites = (to: string): Link => ({
    from: "specs/screens/mentions-panel",
    to,
    relation: "displays",
    confidence: 1,
    provenance: [
      { method: "explicit_link", confidence: 1, path: "screens/mentions-panel.md", line: 3 },
    ],
  });
  const contracts = [
    {
      api: "specs/api/forge-bridge",
      location: "https://example.invalid/forge-bridge.wsdl",
      title: "Forge bridge",
      version: "",
      format: "wsdl 1.1",
      fingerprint: "b".repeat(64),
      imported_at: "2026-09-12T10:00:00.000Z",
    },
    {
      api: "specs/api/model-query",
      location: "contracts/model-query.openapi.json",
      title: "Model query API",
      version: "0.1.0",
      format: "openapi 3.1",
      fingerprint: "a".repeat(64),
      imported_at: "2026-09-12T10:00:00.000Z",
    },
  ];
  const withContracts = (
    links: Link[],
    findings: CanonicalModel["findings"] = [],
    entities: Entity[] = [],
  ): SiteContext =>
    context({
      model: model({
        build: { ...model().build, contracts },
        entities: [
          modelQuery,
          forgeBridge,
          listEntities,
          searchModel,
          screen,
          term,
          page,
          ...entities,
        ],
        links,
        findings,
      }),
    });
  const labels = {
    operations: "Operations",
    operationsLead: "Matched to the contract by operation name.",
    gapsLead:
      "The rows in italics are gaps: present in the contract without a page, or described without existing in the contract.",
    method: "Method",
    path: "Path",
    operation: "Operation",
    callersColumn: "Callers",
    noOperation: "The contract declares no operation.",
    withoutPage: "present in the contract, without a page",
    notInContract: "described, absent from the contract",
    unknownPath: "unknown path",
    contract: "Interface contract",
    download: "Download the contract",
    viewerNote:
      "No schema is copied into the text: the page shows the contract, it does not duplicate it.",
    fiveKeys: "Five keys, no more. The operations come from the contract, not from the header.",
    operationsFirst:
      "On an interface the operations rise to the top: that is the grain we work at.",
  };

  it("describes the contract of an api page from the record of the model: title, version, format, the import worded relative to the build, the copy of a path contract next to the page, the view under fragments/ and the labels of the site language", () => {
    const ctx = withContracts([
      exposes("specs/endpoints/list-entities", "listEntities"),
      exposes("specs/api/model-query/searchmodel", "searchModel"),
      cites("specs/endpoints/list-entities"),
    ]);
    const props = entityPageOf(ctx, modelQuery);
    expect(props.contract).toEqual({
      title: "Model query API",
      version: "0.1.0",
      format: "openapi 3.1",
      importedAt: "2026-09-12T10:00:00.000Z",
      imported: { date: "2026-09-12", label: "imported 2 hours ago", short: "2 hr. ago" },
      location: "contracts/model-query.openapi.json",
      downloadHref: "model-query.openapi.json",
      fragmentHref: "../../../fragments/specs/api/model-query.contract.json",
      operations: [
        {
          name: "listEntities",
          title: "List the entities",
          summary: "Returns the entities of the last build.",
          href: "../../endpoints/list-entities/index.html",
          documented: true,
          method: "get",
          path: "/entities",
          callers: "1 caller",
        },
        {
          name: "searchModel",
          title: "GET /search",
          href: "searchmodel/index.html",
          documented: false,
          method: "GET",
          path: "/search",
          callers: "0 callers",
        },
      ],
      labels,
    });
  });

  it("words the import in the language of the site, in French as in English", () => {
    const ctx = context({
      model: model({ build: { ...model().build, contracts }, entities: [modelQuery], links: [] }),
      catalogue: loadCatalogue("fr"),
      locale: "fr",
    });
    const props = contractOf(ctx, "specs/api/model-query/index.html", modelQuery);
    expect(props?.imported?.label).toBe("importé il y a 2 heures");
    expect(props?.labels?.contract).toBe("Contrat d’interface");
    expect(props?.labels?.withoutPage).toBe("présente au contrat, sans page");
  });

  it("keeps the declared URL of a remote contract as the download link", () => {
    const props = contractOf(withContracts([]), "specs/api/forge-bridge/index.html", forgeBridge);
    expect(props?.downloadHref).toBe("https://example.invalid/forge-bridge.wsdl");
    expect(props?.operations).toEqual([]);
    expect(props?.version).toBe("");
    expect(props?.format).toBe("wsdl 1.1");
    expect(props).not.toHaveProperty("unmatched");
  });

  it("lists the operations the contract import exposed only: a link of another provenance, towards the api or towards a lost entity is left out, and the title stands in for a missing operation name", () => {
    const ctx = withContracts([
      exposes("specs/endpoints/list-entities", undefined),
      exposes("specs/api/model-query/searchmodel", "searchModel", "frontmatter_ref"),
      exposes("specs/api/model-query/gone", "gone"),
      {
        from: "glossary/keyword-page",
        to: "specs/api/model-query",
        relation: "exposes",
        confidence: 0.95,
        provenance: [{ method: "contract_import", confidence: 0.95, operation: "x" }],
      },
    ]);
    expect(contractOf(ctx, "specs/api/model-query/index.html", modelQuery)?.operations).toEqual([
      {
        name: "List the entities",
        title: "List the entities",
        summary: "Returns the entities of the last build.",
        href: "../../endpoints/list-entities/index.html",
        documented: true,
        method: "get",
        path: "/entities",
        callers: "0 callers",
      },
    ]);
  });

  it("counts as callers the pages citing the operation, the api and the contract left out, as the related pages of its page count them", () => {
    const ctx = withContracts([
      exposes("specs/endpoints/list-entities", "listEntities"),
      cites("specs/endpoints/list-entities"),
      {
        from: "glossary/page",
        to: "specs/endpoints/list-entities",
        relation: "related",
        confidence: 0.6,
        provenance: [
          { method: "glossary_occurrence", confidence: 0.6, path: "page.md", line: 4 },
          { method: "glossary_occurrence", confidence: 0.6, path: "page.md", line: 9 },
        ],
      },
    ]);
    const props = contractOf(ctx, "specs/api/model-query/index.html", modelQuery);
    expect(props?.operations.map((operation) => operation.callers)).toEqual(["2 callers"]);
    expect(
      mentionsPanelOf(ctx, "specs/endpoints/list-entities/index.html", listEntities).pages,
    ).toBe(2);
  });

  it("adds as unmatched the operation notes a W-OPERATION-UNMATCHED finding names that name the api, by identifier within the source or by title, in identifier order, with the name the note gives its operation", () => {
    const ctx = withContracts(
      [exposes("specs/endpoints/list-entities", "listEntities")],
      [
        unmatched("specs/endpoints/suggest-links"),
        unmatched("specs/endpoints/notify-build"),
        unmatched("specs/api/model-query/searchmodel"),
        unmatched("specs/screens/mentions-panel"),
        unmatched("specs/endpoints/lost"),
        { ...unmatched("specs/endpoints/suggest-links"), check: "W-API-NOCONSUMER" },
        anonymous,
      ],
      [suggestLinks, notifyBuild],
    );
    expect(contractOf(ctx, "specs/api/model-query/index.html", modelQuery)?.unmatched).toEqual([
      {
        name: "suggestLinks",
        title: "Suggest links",
        summary: "Proposes the links a note could write.",
        href: "../../endpoints/suggest-links/index.html",
        documented: true,
        callers: "0 callers",
      },
    ]);
    expect(contractOf(ctx, "specs/api/forge-bridge/index.html", forgeBridge)?.unmatched).toEqual([
      {
        name: "Notify a build",
        title: "Notify a build",
        href: "../../endpoints/notify-build/index.html",
        documented: true,
        method: "POST",
        callers: "0 callers",
      },
    ]);
  });

  it("takes a note that names its api by full identifier, by path, through a list, or through a recorded link, and leaves out one that names another", () => {
    const byPath = entity({
      ...suggestLinks,
      id: "specs/endpoints/a",
      attributes: { api: "api/model-query.md" },
    });
    const byId = entity({
      ...suggestLinks,
      id: "specs/endpoints/b",
      attributes: { api: ["specs/api/model-query"] },
    });
    const other = entity({
      ...suggestLinks,
      id: "specs/endpoints/c",
      attributes: { api: "api/canonical-model" },
    });
    const linked = entity({ ...suggestLinks, id: "specs/endpoints/d", attributes: { api: 3 } });
    const silent = entity({ ...suggestLinks, id: "specs/endpoints/e", attributes: {} });
    const ctx = withContracts(
      [
        {
          from: "specs/endpoints/d",
          to: "specs/api/model-query",
          relation: "related",
          confidence: 0.5,
          provenance: [
            { method: "explicit_link", confidence: 0.5, path: "endpoints/d.md", line: 1 },
          ],
        },
      ],
      ["a", "b", "c", "d", "e"].map((slug) => unmatched(`specs/endpoints/${slug}`)),
      [byPath, byId, other, linked, silent],
    );
    expect(
      contractOf(ctx, "specs/api/model-query/index.html", modelQuery)?.unmatched?.map(
        (operation) => operation.href,
      ),
    ).toEqual([
      "../../endpoints/a/index.html",
      "../../endpoints/b/index.html",
      "../../endpoints/d/index.html",
    ]);
  });

  it("reads no reference attribute when the profile declares none for the operation type, or none targeting an api", () => {
    const bare: Profile = {
      ...profile,
      types: {
        ...profile.types,
        endpoint: {
          ...(profile.types["endpoint"] ?? { label: { en: "Operation" }, group: "application" }),
          attributes: {
            path: { type: "string" },
            screen: { type: "ref", target: ["screen"] },
            owner: { type: "ref" },
          },
        },
      },
    };
    const ctx = context({
      profile: bare,
      model: model({
        build: { ...model().build, contracts },
        entities: [modelQuery, suggestLinks],
        links: [],
        findings: [unmatched("specs/endpoints/suggest-links")],
      }),
    });
    expect(
      contractOf(ctx, "specs/api/model-query/index.html", modelQuery)?.unmatched,
    ).toBeUndefined();
    const untyped = context({
      profile: { ...profile, types: {} },
      model: model({
        build: { ...model().build, contracts },
        entities: [modelQuery, suggestLinks],
        links: [],
        findings: [unmatched("specs/endpoints/suggest-links")],
      }),
    });
    expect(
      contractOf(untyped, "specs/api/model-query/index.html", modelQuery)?.unmatched,
    ).toBeUndefined();
  });

  it("hangs the operations of the api under its node in the tree of its space, in model order, whatever folder they are filed in", () => {
    const ctx = withContracts([
      exposes("specs/endpoints/list-entities", "listEntities"),
      exposes("specs/api/model-query/searchmodel", "searchModel"),
    ]);
    const tree = spaceOf(ctx, "specs/api/model-query/index.html", modelQuery);
    const api = tree.nodes.find((node) => node.label === "api");
    expect(api?.children?.find((node) => node.current === true)).toEqual({
      label: "Model query API",
      current: true,
      children: [
        { label: "List the entities", href: "../../endpoints/list-entities/index.html" },
        { label: "GET /search", href: "searchmodel/index.html" },
      ],
    });
    const alone = spaceOf(withContracts([]), "specs/api/model-query/index.html", modelQuery);
    expect(
      alone.nodes.find((node) => node.label === "api")?.children?.find((node) => node.current),
    ).toEqual({ label: "Model query API", current: true });
  });

  it("cites the api from the notes of its operations: one written mention per documented operation quoting its summary, or its title, the imported ones left out; nothing on the page of the operation", () => {
    const ctx = withContracts(
      [
        exposes("specs/endpoints/list-entities", "listEntities"),
        exposes("specs/api/model-query/searchmodel", "searchModel"),
        exposes("specs/endpoints/suggest-links", "suggestLinks"),
      ],
      [],
      [entity({ id: "specs/endpoints/suggest-links", type: "endpoint", title: "Suggest links" })],
    );
    const panel = mentionsPanelOf(ctx, "specs/api/model-query/index.html", modelQuery);
    expect(panel.mentions).toEqual([
      {
        kind: "written",
        file: {
          label: "endpoints/list-entities.md",
          href: "../../endpoints/list-entities/index.html",
        },
        title: "List the entities",
        type: "endpoint",
        typeLabel: "Operation",
        context: "Returns the entities of the last build.",
        line: 1,
        href: "../../endpoints/list-entities/index.html#L1",
      },
      {
        kind: "written",
        file: {
          label: "endpoints/suggest-links.md",
          href: "../../endpoints/suggest-links/index.html",
        },
        title: "Suggest links",
        type: "endpoint",
        typeLabel: "Operation",
        context: "Suggest links",
        line: 1,
        href: "../../endpoints/suggest-links/index.html#L1",
      },
    ]);
    expect(panel.pages).toBe(2);
    expect(panel.fragmentHref).toBe("../../../fragments/specs/api/model-query.mentions.json");
    expect(
      mentionsPanelOf(ctx, "specs/endpoints/list-entities/index.html", listEntities).mentions,
    ).toEqual([]);
  });

  it("gives no contract section to a page without a record, and none when the model has no contracts block", () => {
    expect(contractOf(withContracts([]), "glossary/keyword-page/index.html", term)).toBeUndefined();
    expect(entityPageOf(context(), term)).not.toHaveProperty("contract");
  });
});

describe("keywordPageOf", () => {
  it("counts from the entity and states the three numbers only: occurrences, files, sources", () => {
    const props = keywordPageOf(context(), keyword);
    expect(props.entity).toEqual({
      id: "keywords/build-summary",
      title: "build summary",
      locale: "en",
      typeLabel: "Keyword",
    });
    expect(props.counts).toEqual({ occurrences: 5, files: 2, sources: 2 });
    expect(Object.keys(props.counts)).toEqual(["occurrences", "files", "sources"]);
    expect(props.spaces).toEqual(["glossary", "specs"]);
    expect(props.summary).toBe("2 files.");
    const orphan = keywordPageOf(context(), orphanKeyword);
    expect(orphan.counts).toEqual({ occurrences: 0, files: 0, sources: 0 });
    expect(orphan.spaces).toEqual([]);
    expect(orphan.summary).toBe("0 files.");
    expect(orphan.passages).toEqual([]);
    expect(orphan.neighbours).toMatchObject({ centre: "#hash", neighbours: [], total: 0 });
    expect(orphan.similar).toEqual([]);
    const one = { ...keyword, attributes: { ...keyword.attributes, documents: 1 } };
    expect(keywordPageOf(context(), one).summary).toBe("1 file.");
  });

  it("writes the notice from the catalogue with the number of passages that use the word, in the language of the site", () => {
    const { banner } = keywordPageOf(context(), keyword);
    expect(banner.text).toBe("Nobody has written a definition, but 5 passages use this word.");
    expect(banner.detail).toBe(
      "This page is built from those passages alone. If someone creates the note in the glossary, its text will take its place here and the rest of the page will not change.",
    );
    const one = { ...keyword, attributes: { ...keyword.attributes, occurrences: 1 } };
    expect(keywordPageOf(context(), one).banner.text).toBe(
      "Nobody has written a definition, but 1 passage uses this word.",
    );
    const fr = keywordPageOf(context({ catalogue: loadCatalogue("fr") }), keyword);
    expect(fr.banner.text).toBe(
      "Personne n’a écrit de définition, mais 5 passages emploient ce mot.",
    );
    expect(fr.entity.typeLabel).toBe("Mot-clé");
    expect(fr.summary).toBe("2 fichiers.");
    expect(fr.similarLead).toBe(
      "Expressions voisines en forme et en contexte. Une piste, pas une affirmation.",
    );
    expect(fr.labels).toEqual({
      spaceTree: "Arborescence de l’espace",
      breadcrumb: "Vous êtes ici",
      noDefinition: "Sans définition",
      passages: "Les passages, dans l’ordre du corpus",
      whatWeKnow: "Ce qu’on sait",
      occurrences: "Occurrences",
      files: "Fichiers",
      spaces: "Espaces",
      noProperty: "Aucune propriété déclarée\u00a0: il n’existe pas de fichier pour ce mot.",
      maybeSame: "Peut-être la même chose",
      seeNeighbourhood: "Voir la carte du voisinage",
      neighbourPages: "2 pages",
    });
  });

  it("labels the page in the site language, the neighbour count worded", () => {
    expect(keywordPageOf(context(), keyword).labels).toEqual({
      spaceTree: "Tree of the space",
      breadcrumb: "You are here",
      noDefinition: "No definition",
      passages: "The passages, in corpus order",
      whatWeKnow: "What we know",
      occurrences: "Occurrences",
      files: "Files",
      spaces: "Spaces",
      noProperty: "No declared property: there is no file for this word.",
      maybeSame: "Maybe the same thing",
      seeNeighbourhood: "See the neighbourhood map",
      neighbourPages: "2 pages",
    });
    expect(keywordPageLabels(context(), 1).neighbourPages).toBe("1 page");
  });

  it("offers to propose a definition on the forge of the first glossary source it knows, else at the contribution address, else without an address", () => {
    expect(keywordPageOf(context(), keyword).banner.createNote).toEqual({
      label: "Propose a definition",
    });
    expect(
      keywordPageOf(context({ contributeUrl: "https://forge.example/wiki/contribute" }), keyword)
        .banner.createNote,
    ).toEqual({ label: "Propose a definition", href: "https://forge.example/wiki/contribute" });
    const sources = [
      { name: "framing", url: "https://example.org/wiki/framing.git" },
      { name: "glossary", url: "https://github.com/concordance-wiki/demo-glossary.git", files: 2 },
      { name: "specs", url: "https://gitlab.com/concordance-wiki/demo-specs", files: 3 },
    ];
    const withForge = context({
      model: model({ build: { ...model().build, sources } }),
      glossarySources: ["framing", "glossary", "specs"],
      sourceRefs: { glossary: "v2" },
    });
    expect(keywordPageOf(withForge, keyword).banner.createNote).toEqual({
      label: "Propose a definition",
      href: "https://github.com/concordance-wiki/demo-glossary/new/v2?filename=build-summary.md",
    });
    expect(createNoteHref(withForge, "build-summary")).toBe(
      "https://github.com/concordance-wiki/demo-glossary/new/v2?filename=build-summary.md",
    );
    expect(createNoteHref({ ...withForge, glossarySources: ["specs"] }, "cold-start")).toBe(
      "https://gitlab.com/concordance-wiki/demo-specs/-/new/main?file_name=cold-start.md",
    );
    expect(createNoteHref({ ...withForge, glossarySources: ["framing"] }, "x")).toBeUndefined();
    expect(createNoteHref({ ...withForge, glossarySources: ["nowhere"] }, "x")).toBeUndefined();
    expect(forgeNewFileHref("not a url", "main", "a.md")).toBeUndefined();
    expect(forgeNewFileHref("https://gitlab.example.org/wiki/glossary/", "main", "a b.md")).toBe(
      "https://gitlab.example.org/wiki/glossary/-/new/main?file_name=a%20b.md",
    );
  });

  it("files the word in the first glossary source the model knows, its tree with the word at its place, with the breadcrumb space › terms › word", () => {
    const glossary = context({ glossarySources: ["nowhere", "glossary"] });
    const props = keywordPageOf(glossary, keyword);
    expect(props.breadcrumb).toEqual([
      { label: "glossary", href: "../../glossary/index.html" },
      { label: "Terms" },
      { label: "build summary" },
    ]);
    expect(props.space).toEqual({
      name: "glossary",
      initials: "GL",
      href: "../../glossary/index.html",
      nodes: [
        { label: "build summary", current: true },
        { label: "Keyword page", href: "../../glossary/keyword-page/index.html" },
        { label: "Page", href: "../../glossary/page/index.html" },
      ],
    });
    const fr = keywordPageOf(
      context({ glossarySources: ["glossary"], catalogue: loadCatalogue("fr") }),
      keyword,
    );
    expect(fr.breadcrumb?.[1]).toEqual({ label: "Termes" });
  });

  it("files the word in the space of its first passage when no glossary source is known, and nowhere without a passage", () => {
    const props = keywordPageOf(context(), keyword);
    expect(props.breadcrumb?.[0]).toEqual({
      label: "glossary",
      href: "../../glossary/index.html",
    });
    expect(props.space?.name).toBe("glossary");
    const build = model().build;
    const reversed = context({
      model: model({ build: { ...build, sources: [...build.sources].reverse() } }),
      glossarySources: ["nowhere"],
    });
    const specs = keywordPageOf(reversed, keyword);
    expect(specs.space?.name).toBe("specs");
    expect(specs.space?.nodes).toEqual([
      { label: "rules", count: 1, href: "../../specs/rules/index.html" },
      { label: "screens", count: 1, href: "../../specs/screens/index.html" },
      { label: "build summary", current: true },
    ]);
    const orphan = keywordPageOf(context(), orphanKeyword);
    expect(orphan.space).toBeUndefined();
    expect(orphan.breadcrumb).toBeUndefined();
    expect(keywordSpaceOf(context(), [])).toBeUndefined();
  });

  it("says since when the word is used from the oldest git date among the files of its passages, by month in the project locale, and nothing without a date", () => {
    expect(keywordPageOf(context(), keyword).usedSince).toBeUndefined();
    const dated = context({
      model: model({
        entities: model().entities.map((candidate) =>
          candidate.id === "glossary/page"
            ? {
                ...candidate,
                source: { ...candidate.source, last_modified: "2026-06-30T23:30:00Z" },
              }
            : candidate.id === "specs/screens/mentions-panel"
              ? {
                  ...candidate,
                  source: { ...candidate.source, last_modified: "2026-03-12T09:00:00Z" },
                }
              : candidate,
        ),
      }),
    });
    expect(keywordPageOf(dated, keyword).usedSince).toEqual({
      date: "2026-03-12",
      label: "Used since March 2026",
    });
    expect(keywordPageOf({ ...dated, locale: "fr" }, keyword).usedSince?.label).toBe(
      "Used since mars 2026",
    );
    const passages = fragments.get("keywords/build-summary")?.passages ?? [];
    expect(usedSinceOf(dated, [...passages].reverse())?.date).toBe("2026-03-12");
    expect(usedSinceOf(dated, passages.slice(2, 3))?.date).toBe("2026-06-30");
  });

  it("lists the passages grouped by file in corpus order, sources as declared then paths, with the title and the type of the page, their text and their line, and leaves out a file that is no page", () => {
    const props = keywordPageOf(context(), keyword);
    expect(props.passages).toEqual([
      {
        file: { label: "page.md", href: "../../glossary/page/index.html" },
        title: "Page",
        typeLabel: "Term",
        passages: [
          {
            context: "the build summary is printed",
            line: 3,
            href: "../../glossary/page/index.html#L3",
            location: "line 3",
          },
        ],
      },
      {
        file: {
          label: "screens/mentions-panel.md",
          href: "../../specs/screens/mentions-panel/index.html",
        },
        title: "Mentions panel",
        typeLabel: "Screen",
        passages: [
          {
            context: "after the Build summaries",
            text: "Build summaries",
            line: 12,
            href: "../../specs/screens/mentions-panel/index.html#L12",
            location: "line 12",
          },
          {
            context: "the build summary again",
            text: "build summary",
            line: 40,
            href: "../../specs/screens/mentions-panel/index.html#L40",
            location: "line 40",
          },
        ],
      },
    ]);
    expect(
      keywordPageOf(context({ catalogue: loadCatalogue("fr") }), keyword).passages[0]?.passages[0]
        ?.location,
    ).toBe("ligne 3");
    // Declaration order, not name order: specs before glossary once the build block says so.
    const build = model().build;
    const reversed = context({
      model: model({ build: { ...build, sources: [...build.sources].reverse() } }),
    });
    expect(keywordPageOf(reversed, keyword).passages.map((group) => group.file.label)).toEqual([
      "screens/mentions-panel.md",
      "page.md",
    ]);
    // A source the build block does not name comes last, sources then paths by code unit.
    const passages = [
      { source: "zeta", path: "b.md", line: 1, context: "c" },
      { source: "zeta", path: "a.md", line: 1, context: "c" },
      { source: "alpha", path: "z.md", line: 1, context: "c" },
    ];
    const extra = context({
      model: model({
        entities: [
          ...model().entities,
          entity({ id: "zeta/a", type: "term", title: "a" }),
          entity({ id: "zeta/b", type: "term", title: "b" }),
          entity({ id: "alpha/z", type: "term", title: "z" }),
        ],
      }),
    });
    expect(
      passageGroupsOf(extra, "keywords/x/index.html", passages).map((group) => group.file.href),
    ).toEqual(["../../alpha/z/index.html", "../../zeta/a/index.html", "../../zeta/b/index.html"]);
  });

  it("words where a passage of a document stands from the fragment of its page: the timecode of a cue, the page, the slide; the line when the position is unknown", () => {
    const withDocument = (unit: FragmentDocument["unit"]): SiteContext => {
      const document: FragmentDocument = {
        source: "specs",
        path: "screens/mentions-panel.pptx",
        format: "pptx",
        target: "specs/screens/mentions-panel/screens/mentions-panel.pptx",
        unit,
        pages: [
          { number: 2, label: "slide 2", text: "the build summary on a slide" },
          { number: 3, label: "00:12:04", text: "spoken" },
          { number: 4, label: "01:02:03", text: "spoken later" },
        ],
      };
      const fragment: EntityFragment = {
        id: "specs/screens/mentions-panel",
        sections: [],
        documents: [document],
      };
      return context({
        fragments: new Map<string, EntityFragment>([...fragments, [fragment.id, fragment]]),
      });
    };
    const at = (line: number): FragmentPassage => ({
      source: "specs",
      path: "screens/mentions-panel.pptx",
      line,
      context: "c",
    });
    expect(passageLocationOf(withDocument("slide"), screen, at(2))).toBe("slide 2");
    expect(passageLocationOf(withDocument("page"), screen, at(2))).toBe("p. 2");
    expect(passageLocationOf(withDocument("cue"), screen, at(3))).toBe("12:04");
    expect(passageLocationOf(withDocument("cue"), screen, at(4))).toBe("01:02:03");
    expect(passageLocationOf(withDocument("slide"), screen, at(9))).toBe("line 9");
    expect(passageLocationOf(context(), screen, at(2))).toBe("line 2");
    const fr = { ...withDocument("slide"), catalogue: loadCatalogue("fr") };
    expect(passageLocationOf(fr, screen, at(2))).toBe("diapo 2");
    expect(
      passageLocationOf({ ...withDocument("page"), catalogue: fr.catalogue }, screen, at(2)),
    ).toBe("p. 2");
    const grouped = passageGroupsOf(withDocument("slide"), "keywords/x/index.html", [at(2)]);
    expect(grouped[0]?.passages[0]?.location).toBe("slide 2");
    expect(grouped[0]?.file).toEqual({
      label: "screens/mentions-panel.pptx",
      href: "../../specs/screens/mentions-panel/index.html",
    });
  });

  it("draws the neighbourhood of a keyword page from its co-occurrences, the most frequent first, a page as a full node and a noteless word as a dashed one, a neighbour the model lost left out", () => {
    const neighbourhood = keywordNeighbourhoodOf(
      context(),
      "keywords/build-summary/index.html",
      keyword,
    );
    expect(neighbourhood).toEqual({
      centre: "build summary",
      neighbours: [
        {
          id: "specs/screens/mentions-panel",
          label: "Mentions panel",
          href: "../../specs/screens/mentions-panel/index.html",
          typeLabel: "Screen",
          typeGlyph: "screen",
          weight: 6,
          kind: "entity",
        },
        {
          id: "glossary/keyword-page",
          label: "Keyword page",
          href: "../../glossary/keyword-page/index.html",
          typeLabel: "Term",
          typeGlyph: "term",
          weight: 3,
          kind: "entity",
        },
      ],
      total: 2,
      labels: neighbourhoodLabels(context(), 2, 2),
    });
    expect(neighbourhood.labels).toMatchObject({
      neighbours: "The 2 neighbours",
      total: "2 neighbours in total, more than the map shows",
    });
    const fellow = model({
      neighbours: { [keyword.id]: [{ id: orphanKeyword.id, count: 2 }] },
    });
    const [word] = keywordNeighbourhoodOf(
      context({ model: fellow }),
      "keywords/build-summary/index.html",
      keyword,
    ).neighbours;
    expect(word).toEqual({
      id: "keywords/zzz",
      label: "#hash",
      href: "../zzz/index.html",
      typeLabel: "Keyword",
      weight: 2,
      kind: "keyword",
    });
    const fr = keywordNeighbourhoodOf(
      context({ model: fellow, catalogue: loadCatalogue("fr") }),
      "keywords/build-summary/index.html",
      keyword,
    );
    expect(fr.neighbours[0]?.typeLabel).toBe("Mot-clé");
    expect(fr.labels?.map).toBe("Carte du voisinage");
    const untyped = context({
      profile: {
        ...profile,
        types: { ...profile.types, term: { label: { en: "Term" }, group: "business" } },
      },
    });
    const [, term] = keywordNeighbourhoodOf(
      untyped,
      "keywords/build-summary/index.html",
      keyword,
    ).neighbours;
    expect(term).not.toHaveProperty("typeGlyph");
    expect(term?.kind).toBe("entity");
  });

  it("draws six nodes at most on a keyword page and counts every co-occurrence neighbour the model holds as the total, none without a neighbours block", () => {
    expect(KEYWORD_NEIGHBOURS_MAX).toBe(6);
    const many = Array.from({ length: 9 }, (_, index) => ({
      id: index % 2 === 0 ? "glossary/page" : "specs/screens/mentions-panel",
      count: 30 - index,
    }));
    const crowded = keywordNeighbourhoodOf(
      context({ model: model({ neighbours: { [keyword.id]: many } }) }),
      "keywords/build-summary/index.html",
      keyword,
    );
    expect(crowded.neighbours).toHaveLength(6);
    expect(crowded.neighbours.map((neighbour) => neighbour.weight)).toEqual([
      30, 29, 28, 27, 26, 25,
    ]);
    expect(crowded.total).toBe(9);
    expect(crowded.labels?.neighbours).toBe("The 6 neighbours");
    expect(crowded.labels?.total).toBe("9 neighbours in total, more than the map shows");
    const bare = model();
    delete bare.neighbours;
    const none = keywordNeighbourhoodOf(
      context({ model: bare }),
      "keywords/build-summary/index.html",
      keyword,
    );
    expect(none).toMatchObject({ neighbours: [], total: 0 });
  });

  it("turns the leads of the fragment into links, a keyword page among them with its occurrences, a lead to a page the model lost being left out", () => {
    expect(keywordPageOf(context(), keyword).similar).toEqual([
      { label: "Keyword page", href: "../../glossary/keyword-page/index.html" },
    ]);
    expect(keywordPageOf(context(), keyword).similarLead).toBe(
      "Expressions close in form and context. A lead, not a claim.",
    );
    const leads = new Map<string, EntityFragment>([
      ...fragments,
      [
        "keywords/zzz",
        {
          id: "keywords/zzz",
          sections: [],
          leads: [
            { id: "keywords/build-summary", title: "build summary" },
            { id: "glossary/page", title: "Page" },
          ],
        },
      ],
    ]);
    expect(
      similarOf(context({ fragments: leads }), "keywords/zzz/index.html", orphanKeyword),
    ).toEqual([
      { label: "build summary", href: "../build-summary/index.html", count: 5 },
      { label: "Page", href: "../../glossary/page/index.html" },
    ]);
  });

  it("gives the keyword page the neighbourhood and the mentions of the entity page, with the inline count and the note that none is cited", () => {
    const props = keywordPageOf(context(), keyword, { mentionsInline: 4 });
    expect(props.neighbours).toEqual(
      keywordNeighbourhoodOf(context(), "keywords/build-summary/index.html", keyword),
    );
    expect(props.neighbours.neighbours).toHaveLength(2);
    expect(props.labels?.neighbourPages).toBe("2 pages");
    const mentions = mentionsPanelOf(context(), "keywords/build-summary/index.html", keyword, 4);
    expect(props.mentions).toEqual({
      ...mentions,
      labels: {
        ...mentions.labels,
        orderNote:
          "Ordered by number of passages. None is “cited”: this word has no note to carry links.",
      },
    });
    expect(keywordPageOf(context(), keyword).mentions.initial).toBe(DEFAULT_MENTIONS_INLINE);
    expect(
      keywordPageOf(context({ catalogue: loadCatalogue("fr") }), keyword).mentions.labels
        ?.orderNote,
    ).toBe(
      "Ordonnées par nombre de passages. Aucune n’est « citée »\u00a0: ce mot n’a pas de fiche pour porter des liens.",
    );
  });
});
