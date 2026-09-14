import type { Entity, Link } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import type { Profile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import {
  CATEGORY_VARIANTS_MAX,
  attributeValuesOf,
  listedCategoriesOf,
  categoryBreadcrumb,
  categoryDocumentsOf,
  categoryLabels,
  categoryLead,
  categoryName,
  categoryNoun,
  categorySearchField,
  categoryTitle,
  categoryTreeOf,
  filterValuesOf,
  highlightOf,
  preRendered,
  rebasedRows,
  rowsOf,
  topFolderOf,
  valueKey,
  variantFile,
  variantPath,
  type Category,
} from "../../src/build/category.js";
import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import { CATEGORY_PAGE_SIZE } from "../../src/theme/default/category-island.js";
import { entity, fragments, model, profile, rule, screen } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

/** A screen note of the specifications space, filed under `screens/`. */
function screenNote(slug: string, title: string, overrides: Partial<Entity> = {}): Entity {
  return entity({
    id: `specs/screens/${slug}`,
    type: "screen",
    title,
    ...overrides,
  });
}

const author: Entity = entity({ id: "specs/roles/author", type: "role", title: "Author" });
const reader: Entity = entity({ id: "specs/roles/reader", type: "role", title: "Reader" });

/** The home screen names the reader in its frontmatter; the link the reference produced carries the attribute. */
const home: Entity = screenNote("home", "Home", {
  attributes: { roles: ["specs/roles/reader"] },
  summary: "Two ways into a corpus: a word, or a space.",
});

/** The search screen names both roles; the author link is written from the role's side, as an inverse attribute would. */
const search: Entity = screenNote("search", "Search", {
  attributes: { roles: ["specs/roles/author", "specs/roles/reader"] },
  summary: "Full-text search over the whole corpus, without a server.",
});

/** The gallery has no role and no summary; its frontmatter names a page the model lost. */
const gallery: Entity = screenNote("gallery-index", "Gallery index", {
  attributes: { roles: ["specs/roles/theme-author"] },
});

const roleLinks: Link[] = [
  {
    from: "specs/screens/home",
    to: "specs/roles/reader",
    relation: "assigned_to",
    confidence: 1,
    provenance: [
      { method: "frontmatter_ref", confidence: 1, path: "screens/home.md", attribute: "roles" },
    ],
  },
  {
    from: "specs/roles/author",
    to: "specs/screens/search",
    relation: "assigned_to",
    confidence: 1,
    provenance: [
      { method: "frontmatter_ref", confidence: 1, path: "screens/search.md", attribute: "roles" },
    ],
  },
  {
    from: "specs/screens/search",
    to: "specs/roles/reader",
    relation: "assigned_to",
    confidence: 1,
    provenance: [
      { method: "frontmatter_ref", confidence: 1, path: "screens/search.md", attribute: "roles" },
    ],
  },
  // A link the text produced, not the frontmatter: it counts as a neighbour, not as a value.
  {
    from: "specs/screens/search",
    to: "specs/screens/home",
    relation: "related",
    confidence: 0.5,
    provenance: [{ method: "explicit_link", confidence: 0.5, path: "screens/search.md", line: 3 }],
  },
  // A frontmatter link whose other end the model lost.
  {
    from: "specs/screens/gallery-index",
    to: "specs/roles/theme-author",
    relation: "assigned_to",
    confidence: 1,
    provenance: [
      {
        method: "frontmatter_ref",
        confidence: 1,
        path: "screens/gallery-index.md",
        attribute: "roles",
      },
    ],
  },
];

/** The specifications space with its screens and roles, a mixed folder, a folder typed by frontmatter alone, and a folder whose address a note takes. */
function screensContext(extra: Entity[] = []): SiteContext {
  return context({
    model: model({
      entities: [
        ...model().entities,
        home,
        search,
        gallery,
        author,
        reader,
        entity({ id: "specs/notes/a-decision", type: "decision", title: "A decision" }),
        entity({ id: "specs/notes/a-document", type: "document", title: "A document" }),
        entity({
          id: "specs/data/entities",
          type: "data_object",
          title: "Entities",
          type_origin: "frontmatter",
        }),
        entity({ id: "specs/viewers", type: "document", title: "Viewers" }),
        entity({ id: "specs/viewers/document-viewer", type: "screen", title: "Document viewer" }),
        ...extra,
      ],
      links: [...model().links, ...roleLinks],
    }),
  });
}

const screens = (all: SiteContext): Category => {
  const found = listedCategoriesOf(all).find(
    (category) => category.folders.join("/") === "screens",
  );
  if (found === undefined) throw new Error("screens: not found");
  return found;
};

describe("topFolderOf", () => {
  it("reads the folder at the top of the path of a note, none for a note at the root of its source", () => {
    expect(topFolderOf(screen)).toBe("screens");
    expect(topFolderOf(entity({ id: "specs/a/b/c", type: "term", title: "c" }))).toBe("a");
    expect(topFolderOf(entity({ id: "glossary/page", type: "term", title: "Page" }))).toBe(
      undefined,
    );
  });
});

describe("listedCategoriesOf", () => {
  it("groups the notes of every space by their folder at the top, sources and folders in code-unit order, the notes by title, and leaves out the keyword pages and the notes at the root", () => {
    expect(listedCategoriesOf(context())).toEqual([
      {
        source: "specs",
        folders: ["rules"],
        labels: ["rules"],
        heading: "Rules",
        type: "rule",
        notes: [rule],
        page: "specs/rules/index.html",
      },
      {
        source: "specs",
        folders: ["screens"],
        labels: ["screens"],
        heading: "Screens",
        type: "screen",
        notes: [screen],
        page: "specs/screens/index.html",
      },
    ]);
  });

  it("maps a folder to the one type its notes got from the source, and to none when they carry several or were all typed by their frontmatter", () => {
    const all = screensContext([
      screenNote("api-page", "API page", { type_origin: "frontmatter", type: "api" }),
    ]);
    const categories = listedCategoriesOf(all);
    expect(categories.map((category) => [category.folders.join("/"), category.type])).toEqual([
      ["data", undefined],
      ["notes", undefined],
      ["roles", "role"],
      ["rules", "rule"],
      ["screens", "screen"],
    ]);
    expect(screens(all).notes.map((note) => note.title)).toEqual([
      "API page",
      "Gallery index",
      "Home",
      "Mentions panel",
      "Search",
    ]);
  });

  it("orders the spaces by name, whatever the order of their notes", () => {
    const terms = entity({ id: "glossary/terms/alias", type: "term", title: "Alias" });
    const all = context({ model: model({ entities: [screen, terms, rule] }) });
    expect(
      listedCategoriesOf(all).map((category) => [category.source, category.folders.join("/")]),
    ).toEqual([
      ["glossary", "terms"],
      ["specs", "rules"],
      ["specs", "screens"],
    ]);
  });

  it("gives no list to a folder whose address a note takes", () => {
    const folders = listedCategoriesOf(screensContext()).map((category) =>
      category.folders.join("/"),
    );
    expect(folders).not.toContain("viewers");
  });

  it("sorts the notes of a folder by title with the collation of the site, the identifier breaking ties", () => {
    const twins = [
      screenNote("z-twin", "Twin"),
      screenNote("a-twin", "Twin"),
      screenNote("accent", "Écran"),
      screenNote("plain", "Ecran"),
    ];
    const all = context({ model: model({ entities: [screen, ...twins] }) });
    expect(screens(all).notes.map((note) => note.id)).toEqual([
      "specs/screens/accent",
      "specs/screens/plain",
      "specs/screens/mentions-panel",
      "specs/screens/a-twin",
      "specs/screens/z-twin",
    ]);
  });
});

describe("categoryTitle and categoryName", () => {
  it("capitalise the folder name for the title and lower it for a sentence, separators read as spaces", () => {
    expect(categoryTitle("screens")).toBe("Screens");
    expect(categoryName("screens")).toBe("screens");
    expect(categoryTitle("business-objects")).toBe("Business objects");
    expect(categoryName("business-objects")).toBe("business objects");
    expect(categoryTitle("Data_Objects")).toBe("Data Objects");
    expect(categoryName("Data_Objects")).toBe("data objects");
    expect(categoryTitle("")).toBe("");
  });
});

describe("highlightOf", () => {
  const category = (type?: string): Category => ({
    source: "specs",
    folders: ["screens"],
    labels: ["screens"],
    heading: "Screens",
    ...(type === undefined ? {} : { type }),
    notes: [],
    page: "specs/screens/index.html",
  });

  it("names the type and the first attribute it highlights", () => {
    expect(highlightOf(context(), category("screen"))).toEqual({
      type: "screen",
      attribute: "roles",
    });
  });

  it("finds none for a folder mapping to no type, an unknown type, or a type highlighting nothing", () => {
    const custom: Profile = {
      ...profile,
      types: {
        ...profile.types,
        plain: { label: { en: "Plain" }, group: "raw" },
        ordered: { label: { en: "Ordered" }, group: "raw", display: { neighbours_order: [] } },
        empty: { label: { en: "Empty" }, group: "raw", display: { highlight: [] } },
      },
    };
    const all = context({ profile: custom });
    expect(highlightOf(all, category())).toBe(undefined);
    expect(highlightOf(all, category("ghost"))).toBe(undefined);
    expect(highlightOf(all, category("plain"))).toBe(undefined);
    expect(highlightOf(all, category("ordered"))).toBe(undefined);
    expect(highlightOf(all, category("empty"))).toBe(undefined);
  });
});

describe("attributeValuesOf", () => {
  const page = "specs/screens/index.html";

  it("links the pages the frontmatter references name, whichever end of the link the note stands at, in model order", () => {
    const all = screensContext();
    expect(attributeValuesOf(all, page, home, "roles")).toEqual([
      { text: "Reader", href: "../roles/reader/index.html" },
    ]);
    expect(attributeValuesOf(all, page, search, "roles")).toEqual([
      { text: "Author", href: "../roles/author/index.html" },
      { text: "Reader", href: "../roles/reader/index.html" },
    ]);
  });

  it("falls back on the values as the page resolves them when no reference link carries the attribute: an identifier within the source linked, a page the model lost as written", () => {
    const all = screensContext();
    expect(attributeValuesOf(all, page, screen, "roles")).toEqual([
      { text: "Reader", href: "../roles/reader/index.html" },
    ]);
    expect(attributeValuesOf(all, page, gallery, "roles")).toEqual([
      { text: "specs/roles/theme-author" },
    ]);
    expect(attributeValuesOf(all, page, home, "url_pattern")).toEqual([]);
  });
});

describe("valueKey", () => {
  it("slugs the text of a value so that two spellings of one title meet", () => {
    expect(valueKey({ text: "Quality owner" })).toBe("quality-owner");
    expect(valueKey({ text: "Écran", href: "x" })).toBe("ecran");
  });
});

describe("rowsOf", () => {
  it("gives every note its title linked, the values and keys of the highlighted attribute, its summary and its number of related pages", () => {
    const all = screensContext();
    expect(rowsOf(all, screens(all))).toEqual([
      {
        title: "Gallery index",
        href: "gallery-index/index.html",
        values: [{ text: "specs/roles/theme-author" }],
        keys: ["specs-roles-theme-author"],
        links: 0,
      },
      {
        title: "Home",
        href: "home/index.html",
        values: [{ text: "Reader", href: "../roles/reader/index.html" }],
        keys: ["reader"],
        summary: "Two ways into a corpus: a word, or a space.",
        links: 2,
      },
      {
        title: "Mentions panel",
        href: "mentions-panel/index.html",
        values: [{ text: "Reader", href: "../roles/reader/index.html" }],
        keys: ["reader"],
        links: 1,
      },
      {
        title: "Search",
        href: "search/index.html",
        values: [
          { text: "Author", href: "../roles/author/index.html" },
          { text: "Reader", href: "../roles/reader/index.html" },
        ],
        keys: ["author", "reader"],
        summary: "Full-text search over the whole corpus, without a server.",
        links: 3,
      },
    ]);
  });

  it("leaves the values empty for a folder mapping to no type", () => {
    const all = screensContext();
    const notes = listedCategoriesOf(all).find(
      (category) => category.folders.join("/") === "notes",
    );
    expect(notes).toBeDefined();
    expect(rowsOf(all, notes as Category).map((row) => [row.values, row.keys])).toEqual([
      [[], []],
      [[], []],
    ]);
  });
});

describe("rebasedRows", () => {
  const rows = [
    {
      title: "Home",
      href: "home/index.html",
      values: [{ text: "Reader", href: "../roles/reader/index.html" }, { text: "plain" }],
      keys: ["reader", "plain"],
      links: 2,
    },
  ];

  it("copies the rows as they are from the page of the whole list", () => {
    const copy = rebasedRows(rows, "specs/screens/index.html", "specs/screens/index.html");
    expect(copy).toEqual(rows);
    expect(copy).not.toBe(rows);
  });

  it("rewrites the addresses from the page of a variant, which lies deeper, a value without address untouched", () => {
    expect(
      rebasedRows(rows, "specs/screens/index.html", "specs/screens/-/links/index.html"),
    ).toEqual([
      {
        title: "Home",
        href: "../../home/index.html",
        values: [{ text: "Reader", href: "../../../roles/reader/index.html" }, { text: "plain" }],
        keys: ["reader", "plain"],
        links: 2,
      },
    ]);
  });
});

describe("filterValuesOf", () => {
  it("lists every distinct value across the rows in collation order of their labels, the first spelling of a key kept", () => {
    const all = screensContext();
    expect(filterValuesOf(all, rowsOf(all, screens(all)))).toEqual([
      { key: "author", label: "Author" },
      { key: "reader", label: "Reader" },
      { key: "specs-roles-theme-author", label: "specs/roles/theme-author" },
    ]);
    expect(
      filterValuesOf(all, [
        { title: "a", href: "a/", values: [{ text: "Reader" }], keys: ["reader"], links: 0 },
        { title: "b", href: "b/", values: [{ text: "reader" }], keys: ["reader"], links: 0 },
        { title: "c", href: "c/", values: [{ text: "Écran" }], keys: [], links: 0 },
        { title: "d", href: "d/", values: [{ text: "ecran" }], keys: ["ecran"], links: 0 },
        // Two labels the collation reads alike, digits compared by value: the key breaks the tie.
        { title: "e", href: "e/", values: [{ text: "1" }], keys: ["1"], links: 0 },
        { title: "f", href: "f/", values: [{ text: "01" }], keys: ["01"], links: 0 },
      ]),
    ).toEqual([
      { key: "01", label: "01" },
      { key: "1", label: "1" },
      { key: "ecran", label: "Écran" },
      { key: "reader", label: "Reader" },
    ]);
  });
});

describe("variantFile and variantPath", () => {
  it("name the whole list by title index.html and every other state under a folder no identifier can take", () => {
    expect(variantFile("roles", { sort: "title", page: 1 })).toBe("index.html");
    expect(variantFile(undefined, { sort: "title", key: "reader", page: 1 })).toBe("index.html");
    expect(variantFile("roles", { sort: "links", page: 1 })).toBe("-/links/index.html");
    expect(variantFile("roles", { sort: "title", key: "reader", page: 1 })).toBe(
      "-/roles-reader/index.html",
    );
    expect(variantFile("roles", { sort: "links", key: "reader", page: 3 })).toBe(
      "-/roles-reader-links-page-3/index.html",
    );
    expect(variantFile(undefined, { sort: "title", page: 2 })).toBe("-/page-2/index.html");
  });

  it("put the state under the output folder of the list", () => {
    const category: Category = {
      source: "specs",
      folders: ["screens"],
      labels: ["screens"],
      heading: "Screens",
      notes: [],
      page: "specs/screens/index.html",
    };
    expect(variantPath(category, "roles", { sort: "links", key: "reader", page: 1 })).toBe(
      "specs/screens/-/roles-reader-links/index.html",
    );
  });
});

describe("preRendered", () => {
  it("pre-renders the two sorts times the whole list and every value while they stay within the limit", () => {
    expect(CATEGORY_VARIANTS_MAX).toBe(12);
    expect(preRendered(0)).toBe(true);
    expect(preRendered(5)).toBe(true);
    expect(preRendered(6)).toBe(false);
  });
});

describe("categoryLabels", () => {
  it("words every label of the list in the site language, the category name in the count and the note", () => {
    expect(categoryLabels(context(), "screens")).toEqual({
      spaceTree: "Tree of the space",
      breadcrumb: "You are here",
      sort: "Sort",
      sortTitle: "A–Z",
      sortLinks: "Links",
      all: "All",
      firstLine: "First line",
      links: "Links",
      pagination: "Pages of the list",
      shownOf: "{shown} screens of {total} — pagination by twenty.",
      note: "The Links column counts the related pages, which brings the most central screens of the journey to the top.",
    });
    expect(categoryLabels(context({ catalogue: loadCatalogue("fr") }), "écrans").shownOf).toBe(
      "{shown} écrans sur {total} — pagination par vingt.",
    );
  });
});

describe("categoryLead", () => {
  const category = (type: string | undefined, count: number): Category => ({
    source: "specs",
    folders: ["screens"],
    labels: ["screens"],
    heading: "Screens",
    ...(type === undefined ? {} : { type }),
    notes: Array.from({ length: count }, (_, index) => screenNote(String(index), "Screen")),
    page: "specs/screens/index.html",
  });

  it("counts the pages as the type words it, then describes the type, in the site language", () => {
    expect(categoryLead(context(), category("screen", 64))).toBe(
      "64 screens described. A screen is a page of the application, with what it shows and what it allows.",
    );
    expect(categoryLead(context(), category("screen", 1))).toBe(
      "1 screen described. A screen is a page of the application, with what it shows and what it allows.",
    );
    expect(categoryLead(context({ catalogue: loadCatalogue("fr") }), category("screen", 2))).toBe(
      "2 écrans décrits. Un écran est une page de l'application, avec ce qu'elle affiche et ce qu'elle permet.",
    );
  });

  it("counts the pages alone for a folder mapping to no type or a type without a count message, and skips the description a type lacks", () => {
    const custom: Profile = {
      ...profile,
      types: {
        ...profile.types,
        bare: { label: { en: "Bare" }, group: "raw" },
        counted: {
          label: { en: "Counted" },
          counted: { en: "{count, plural, one {# note kept} other {# notes kept}}" },
          group: "raw",
        },
        described: {
          label: { en: "Described" },
          description: { en: "A described note has a sentence but no count." },
          group: "raw",
        },
      },
    };
    const all = context({ profile: custom });
    expect(categoryLead(all, category(undefined, 3))).toBe("3 pages.");
    expect(categoryLead(all, category(undefined, 1))).toBe("1 page.");
    expect(categoryLead(all, category("bare", 2))).toBe("2 pages.");
    expect(categoryLead(all, category("counted", 2))).toBe("2 notes kept.");
    expect(categoryLead(all, category("described", 2))).toBe(
      "2 pages. A described note has a sentence but no count.",
    );
  });
});

describe("categoryTreeOf", () => {
  it("lists the folders at the top of the space with their counts and their lists, this one marked, then the notes at the root", () => {
    const all = screensContext();
    const category = screens(all);
    expect(categoryTreeOf(all, category.page, category)).toEqual({
      name: "specs",
      initials: "SP",
      href: "../index.html",
      nodes: [
        { label: "data", count: 1, href: "../data/index.html" },
        { label: "notes", count: 2, href: "../notes/index.html" },
        { label: "roles", count: 2, href: "../roles/index.html" },
        { label: "rules", count: 1, href: "../rules/index.html" },
        { label: "screens", count: 4, current: true },
        { label: "viewers", count: 1 },
        { label: "Viewers", href: "../viewers/index.html" },
      ],
    });
  });

  it("writes the addresses from the page of a variant", () => {
    const all = screensContext();
    const category = screens(all);
    const tree = categoryTreeOf(all, "specs/screens/-/links/index.html", category);
    expect(tree.nodes[0]).toEqual({ label: "data", count: 1, href: "../../../data/index.html" });
    expect(tree.nodes.at(-1)).toEqual({ label: "Viewers", href: "../../../viewers/index.html" });
  });

  it("orders the notes at the root by path, the identifier breaking ties", () => {
    const roots = [
      entity({ id: "specs/b-note", type: "document", title: "B" }),
      entity({ id: "specs/a-note", type: "document", title: "A" }),
      entity({
        id: "specs/twin-2",
        type: "document",
        title: "Twin",
        source: { name: "specs", path: "twin.md", line: 1 },
      }),
      entity({
        id: "specs/twin-1",
        type: "document",
        title: "Twin",
        source: { name: "specs", path: "twin.md", line: 1 },
      }),
    ];
    const all = context({ model: model({ entities: [screen, ...roots] }) });
    const category = screens(all);
    expect(categoryTreeOf(all, category.page, category).nodes.map((node) => node.label)).toEqual([
      "screens",
      "A",
      "B",
      "Twin",
      "Twin",
    ]);
    expect(categoryTreeOf(all, category.page, category).nodes.map((node) => node.href)).toEqual([
      undefined,
      "../a-note/index.html",
      "../b-note/index.html",
      "../twin-1/index.html",
      "../twin-2/index.html",
    ]);
  });
});

describe("categoryBreadcrumb", () => {
  it("leads from the spaces page to the page of the space and ends on the folder", () => {
    const all = context();
    expect(categoryBreadcrumb(all, "specs/screens/index.html", screens(all))).toEqual([
      { label: "Spaces", href: "../../spaces/index.html" },
      { label: "specs", href: "../index.html" },
      { label: "screens" },
    ]);
  });
});

describe("categorySearchField", () => {
  const field = { action: "../../search/index.html", placeholder: "Search the documentation" };

  it("asks to search in the category and submits with the space and the type of the folder", () => {
    const all = context();
    expect(categorySearchField(all, field, screens(all))).toEqual({
      action: "../../search/index.html",
      placeholder: "Search in screens",
      filters: { source: "specs", type: "screen" },
    });
    expect(
      categorySearchField(context({ catalogue: loadCatalogue("fr") }), field, screens(all))
        .placeholder,
    ).toBe("Rechercher dans les screens");
  });

  it("submits with the space alone for a folder mapping to no type", () => {
    const all = screensContext();
    const notes = listedCategoriesOf(all).find(
      (category) => category.folders.join("/") === "notes",
    );
    expect(categorySearchField(all, field, notes as Category).filters).toEqual({
      source: "specs",
    });
  });
});

/** The specifications space with a folder two levels deep, `rules/links`, and a note taking the address of a third one. */
function nestedContext(): SiteContext {
  return context({
    model: model({
      entities: [
        rule,
        entity({ id: "specs/rules/links/broken-link", type: "rule", title: "Broken link" }),
        entity({ id: "specs/rules/links/dead-end", type: "rule", title: "Dead end" }),
        entity({ id: "specs/rules/vocabulary", type: "decision", title: "Vocabulary" }),
        entity({ id: "specs/rules/vocabulary/stopword", type: "rule", title: "Stopword" }),
      ],
    }),
    folders: {
      specs: {
        rules: { title: "Rules", description: "What the build checks." },
        "rules/links": { title: "Links" },
      },
    },
  });
}

/** A space whose every note is dated: two months of one year and a note of the year before. */
function datedContext(): SiteContext {
  const dated = (day: string, title: string): Entity =>
    entity({
      id: `meetings/${day}-${title.toLowerCase().replaceAll(" ", "-")}`,
      type: "meeting",
      title,
      source: {
        name: "meetings",
        path: `${day}-${title.toLowerCase().replaceAll(" ", "-")}.md`,
        line: 1,
      },
    });
  return context({
    model: model({
      entities: [
        dated("2026-03-12", "Threshold review"),
        dated("2026-03-20", "Cap review"),
        dated("2026-02-05", "Theme workshop"),
        dated("2025-11-30", "Kick off"),
        screen,
      ],
    }),
  });
}

describe("listedCategoriesOf at every depth", () => {
  it("lists a folder at every depth with the notes under it, sources then paths in code-unit order, and skips a folder whose address a note takes", () => {
    const categories = listedCategoriesOf(nestedContext());
    expect(categories.map((category) => [category.folders, category.type, category.page])).toEqual([
      [["rules"], undefined, "specs/rules/index.html"],
      [["rules", "links"], "rule", "specs/rules/links/index.html"],
    ]);
    expect(categories[0]?.notes.map((note) => note.title)).toEqual([
      "Broken link",
      "Dead end",
      "Épreuve du seuil",
      "Stopword",
      "Vocabulary",
    ]);
    expect(categories[1]?.notes.map((note) => note.title)).toEqual(["Broken link", "Dead end"]);
  });

  it("lists the years and the months of a dated space, marked as dated, before its folders", () => {
    const categories = listedCategoriesOf(datedContext());
    expect(categories.map((category) => [category.folders, category.dated, category.page])).toEqual(
      [
        [["2025"], true, "meetings/2025/index.html"],
        [["2025", "11"], true, "meetings/2025/11/index.html"],
        [["2026"], true, "meetings/2026/index.html"],
        [["2026", "02"], true, "meetings/2026/02/index.html"],
        [["2026", "03"], true, "meetings/2026/03/index.html"],
        [["screens"], undefined, "specs/screens/index.html"],
      ],
    );
    expect(categories[2]?.notes.map((note) => note.title)).toEqual([
      "Cap review",
      "Theme workshop",
      "Threshold review",
    ]);
    expect(categories[2]?.type).toBe("meeting");
  });

  it("gives the address of a year or a month to its list before a folder of the same name", () => {
    const folder = entity({
      id: "meetings/2026/notes/late-note",
      type: "meeting",
      title: "Late note",
      attributes: { date: "2026-03-30" },
      source: { name: "meetings", path: "2026/notes/late-note.md", line: 1 },
    });
    const all = context({
      model: model({ entities: [...datedContext().model.entities, folder] }),
    });
    const listed = listedCategoriesOf(all).filter((category) => category.source === "meetings");
    expect(
      listed.map(
        (category) => `${category.folders.join("/")}${category.dated === true ? "*" : ""}`,
      ),
    ).toEqual(["2025*", "2025/11*", "2026*", "2026/03*", "2026/02*", "2026/notes"].sort());
    expect(listed.find((category) => category.folders.join("/") === "2026")?.dated).toBe(true);
  });
});

describe("the labels, the heading and the noun of a category", () => {
  it("label the folders on the way by their titles, else their names, capitalise the heading of an untitled folder and lower the noun", () => {
    const all = nestedContext();
    const [rules, links] = listedCategoriesOf(all);
    expect(rules?.labels).toEqual(["Rules"]);
    expect(links?.labels).toEqual(["Rules", "Links"]);
    expect(links?.heading).toBe("Links");
    expect(categoryNoun(all, links as Category)).toBe("links");
    const plain = context();
    const [, screens] = listedCategoriesOf(plain);
    expect(screens?.labels).toEqual(["screens"]);
    expect(screens?.heading).toBe("Screens");
    expect(categoryNoun(plain, screens as Category)).toBe("screens");
  });

  it("name a year by itself, a month by its name and with its year in the heading, in the language of the site, and count in pages", () => {
    const all = datedContext();
    const [, november, year, , march] = listedCategoriesOf(all);
    expect(year?.labels).toEqual(["2026"]);
    expect(march?.labels).toEqual(["2026", "March"]);
    expect(year?.heading).toBe("2026");
    expect(march?.heading).toBe("March 2026");
    expect(november?.heading).toBe("November 2025");
    expect(categoryNoun(all, march as Category)).toBe("pages");
    const fr = context({ ...datedContext(), catalogue: loadCatalogue("fr"), locale: "fr" });
    const [, novembre] = listedCategoriesOf(fr);
    expect(novembre?.labels).toEqual(["2025", "novembre"]);
    expect(novembre?.heading).toBe("novembre 2025");
  });
});

describe("categoryLead below the top", () => {
  it("counts the pages filed under the path for a deeper folder, a year or a month, then describes the type", () => {
    const nested = nestedContext();
    const [, links] = listedCategoriesOf(nested);
    expect(categoryLead(nested, links as Category)).toBe(
      "2 pages filed under Rules › Links. A business rule is a condition the business imposes, with what it constrains and what happens when it is broken.",
    );
    const dated = datedContext();
    const [, november, year] = listedCategoriesOf(dated);
    expect(categoryLead(dated, year as Category)).toMatch(/^3 pages filed under 2026\. /);
    expect(categoryLead(dated, november as Category)).toMatch(
      /^1 page filed under 2025 › November\. /,
    );
    const fr = context({ ...datedContext(), catalogue: loadCatalogue("fr"), locale: "fr" });
    const [, novembre] = listedCategoriesOf(fr);
    expect(categoryLead(fr, novembre as Category)).toMatch(
      /^1 page rangée sous 2025 › novembre\. /,
    );
  });
});

describe("categoryTreeOf below the top", () => {
  it("opens the folders on the way to a deeper folder, marks it closed, and links the others to their lists", () => {
    const all = nestedContext();
    const [, links] = listedCategoriesOf(all);
    expect(categoryTreeOf(all, "specs/rules/links/index.html", links as Category)).toEqual({
      name: "specs",
      initials: "SP",
      href: "../../index.html",
      nodes: [
        {
          label: "Rules",
          count: 5,
          href: "../index.html",
          children: [
            { label: "Links", count: 2, current: true },
            { label: "vocabulary", count: 1 },
            { label: "Épreuve du seuil", href: "../publication-threshold/index.html" },
            { label: "Vocabulary", href: "../vocabulary/index.html" },
          ],
        },
      ],
    });
  });

  it("draws the tree of a dated space by year and month from the list of a month", () => {
    const all = datedContext();
    const [, , , , march] = listedCategoriesOf(all);
    expect(categoryTreeOf(all, "meetings/2026/03/index.html", march as Category).nodes).toEqual([
      {
        label: "2026",
        count: 3,
        href: "../index.html",
        children: [
          { label: "March", count: 2, current: true },
          { label: "February", count: 1, href: "../02/index.html" },
        ],
      },
      { label: "2025", count: 1, href: "../../2025/index.html" },
    ]);
  });
});

describe("categoryBreadcrumb below the top", () => {
  it("leads through every folder on the way, each to its list, and ends on the folder by its title", () => {
    const all = nestedContext();
    const [, links] = listedCategoriesOf(all);
    expect(categoryBreadcrumb(all, "specs/rules/links/index.html", links as Category)).toEqual([
      { label: "Spaces", href: "../../../spaces/index.html" },
      { label: "specs", href: "../../index.html" },
      { label: "Rules", href: "../index.html" },
      { label: "Links" },
    ]);
  });

  it("names the year then the month of a dated list, the year linked to its list, and a folder whose address a note takes without a link", () => {
    const dated = datedContext();
    const [, , , , march] = listedCategoriesOf(dated);
    expect(categoryBreadcrumb(dated, "meetings/2026/03/index.html", march as Category)).toEqual([
      { label: "Spaces", href: "../../../spaces/index.html" },
      { label: "meetings", href: "../../index.html" },
      { label: "2026", href: "../index.html" },
      { label: "March" },
    ]);
    const shadowed = context({
      model: model({
        entities: [
          screen,
          entity({ id: "specs/screens/pages/home", type: "screen", title: "Home" }),
          entity({
            id: "specs/screens",
            type: "document",
            title: "Screens",
            source: { name: "specs", path: "screens.md", line: 1 },
          }),
        ],
      }),
    });
    const [pages] = listedCategoriesOf(shadowed);
    expect(pages?.folders).toEqual(["screens", "pages"]);
    expect(
      categoryBreadcrumb(shadowed, "specs/screens/pages/index.html", pages as Category),
    ).toEqual([
      { label: "Spaces", href: "../../../spaces/index.html" },
      { label: "specs", href: "../../index.html" },
      { label: "screens" },
      { label: "pages" },
    ]);
  });
});

describe("categorySearchField of a dated list", () => {
  it("asks to search in the month with its year and submits with the space and the type", () => {
    const all = datedContext();
    const [, , , , march] = listedCategoriesOf(all);
    expect(
      categorySearchField(
        all,
        { action: "../../../search/index.html", placeholder: "" },
        march as Category,
      ),
    ).toEqual({
      action: "../../../search/index.html",
      placeholder: "Search in March 2026",
      filters: { source: "meetings", type: "meeting" },
    });
  });
});

describe("categoryDocumentsOf", () => {
  it("pre-renders one page per sort and per value of the filter, every choice linking to its variant, the current one without address", () => {
    const all = screensContext();
    const documents = categoryDocumentsOf(all, screens(all));
    expect(documents.map((document) => document.path)).toEqual([
      "specs/screens/index.html",
      "specs/screens/-/roles-author/index.html",
      "specs/screens/-/roles-reader/index.html",
      "specs/screens/-/roles-specs-roles-theme-author/index.html",
      "specs/screens/-/links/index.html",
      "specs/screens/-/roles-author-links/index.html",
      "specs/screens/-/roles-reader-links/index.html",
      "specs/screens/-/roles-specs-roles-theme-author-links/index.html",
    ]);
    const [whole] = documents;
    expect(whole?.props).toMatchObject({
      title: "Screens",
      lead: "4 screens described. A screen is a page of the application, with what it shows and what it allows.",
      unit: "Screen",
      sort: "title",
      sorts: [
        { label: "A–Z", key: "title", active: true },
        { label: "Links", key: "links", href: "-/links/index.html", active: false },
      ],
      page: 1,
      pages: [{ number: 1 }],
      total: 4,
    });
    expect(whole?.props.island).toBe(undefined);
    expect(whole?.props.filter).toEqual({
      label: "Roles",
      choices: [
        { label: "All", active: true },
        { label: "Author", key: "author", href: "-/roles-author/index.html", active: false },
        { label: "Reader", key: "reader", href: "-/roles-reader/index.html", active: false },
        {
          label: "specs/roles/theme-author",
          key: "specs-roles-theme-author",
          href: "-/roles-specs-roles-theme-author/index.html",
          active: false,
        },
      ],
    });
    expect(whole?.props.rows.map((row) => row.title)).toEqual([
      "Gallery index",
      "Home",
      "Mentions panel",
      "Search",
    ]);
    expect(whole?.props.space.nodes.find((node) => node.current)).toEqual({
      label: "screens",
      count: 4,
      current: true,
    });
    expect(whole?.props.breadcrumb.at(-1)).toEqual({ label: "screens" });
    expect(whole?.props.labels?.shownOf).toBe("{shown} screens of {total} — pagination by twenty.");
  });

  it("keeps the rows of the value in a filtered variant, sorted by links most first when asked, its addresses rewritten from its depth", () => {
    const all = screensContext();
    const documents = categoryDocumentsOf(all, screens(all));
    const byLinks = documents.find(
      (document) => document.path === "specs/screens/-/roles-reader-links/index.html",
    );
    expect(byLinks?.props.rows.map((row) => [row.title, row.href, row.links])).toEqual([
      ["Search", "../../search/index.html", 3],
      ["Home", "../../home/index.html", 2],
      ["Mentions panel", "../../mentions-panel/index.html", 1],
    ]);
    expect(byLinks?.props.rows[0]?.values[0]).toEqual({
      text: "Author",
      href: "../../../roles/author/index.html",
    });
    expect(byLinks?.props.total).toBe(3);
    expect(byLinks?.props.sort).toBe("links");
    expect(byLinks?.props.sorts).toEqual([
      { label: "A–Z", key: "title", href: "../roles-reader/index.html", active: false },
      { label: "Links", key: "links", active: true },
    ]);
    expect(byLinks?.props.filter?.choices.map((choice) => [choice.label, choice.href])).toEqual([
      ["All", "../links/index.html"],
      ["Author", "../roles-author-links/index.html"],
      ["Reader", undefined],
      ["specs/roles/theme-author", "../roles-specs-roles-theme-author-links/index.html"],
    ]);
    expect(byLinks?.props.space.nodes[0]?.href).toBe("../../../data/index.html");
    expect(byLinks?.props.breadcrumb[0]?.href).toBe("../../../../spaces/index.html");
    expect(byLinks?.props.breadcrumb[1]?.href).toBe("../../../index.html");
  });

  it("pages a long list by twenty, the page links leading between the pages of one state", () => {
    const many = Array.from({ length: CATEGORY_PAGE_SIZE + 5 }, (_, index) =>
      screenNote(
        `screen-${String(index).padStart(2, "0")}`,
        `Screen ${String(index).padStart(2, "0")}`,
      ),
    );
    const all = context({ model: model({ entities: many }) });
    const documents = categoryDocumentsOf(all, screens(all));
    expect(documents.map((document) => document.path)).toEqual([
      "specs/screens/index.html",
      "specs/screens/-/page-2/index.html",
      "specs/screens/-/links/index.html",
      "specs/screens/-/links-page-2/index.html",
    ]);
    const [first, second] = documents;
    expect(first?.props.rows).toHaveLength(20);
    expect(first?.props.pages).toEqual([{ number: 1 }, { number: 2, href: "-/page-2/index.html" }]);
    expect(first?.props.total).toBe(25);
    // The type highlights an attribute no note sets: the column keeps its label, the selector has one entry.
    expect(first?.props.filter).toEqual({
      label: "Roles",
      choices: [{ label: "All", active: true }],
    });
    expect(second?.props.rows.map((row) => row.title)).toEqual([
      "Screen 20",
      "Screen 21",
      "Screen 22",
      "Screen 23",
      "Screen 24",
    ]);
    expect(second?.props.page).toBe(2);
    expect(second?.props.pages).toEqual([{ number: 1, href: "../../index.html" }, { number: 2 }]);
    expect(second?.props.sorts[1]?.href).toBe("../links/index.html");
  });

  it("hands every row to the island once the sorts times the values pass the limit, one page of the whole list by title per twenty rows, the choices without address", () => {
    const roles = ["a", "b", "c", "d", "e", "f"].map((letter) =>
      entity({ id: `specs/roles/${letter}`, type: "role", title: `Role ${letter}` }),
    );
    const many = Array.from({ length: CATEGORY_PAGE_SIZE + 1 }, (_, index) =>
      screenNote(
        `screen-${String(index).padStart(2, "0")}`,
        `Screen ${String(index).padStart(2, "0")}`,
        {
          attributes: { roles: [`specs/roles/${roles[index % 6]?.id.slice(-1) ?? "a"}`] },
        },
      ),
    );
    const all = context({ model: model({ entities: [...roles, ...many] }) });
    const documents = categoryDocumentsOf(all, screens(all));
    expect(documents.map((document) => document.path)).toEqual([
      "specs/screens/index.html",
      "specs/screens/-/page-2/index.html",
    ]);
    const [first, second] = documents;
    expect(first?.props.island).toBe(true);
    expect(first?.props.rows).toHaveLength(21);
    expect(first?.props.page).toBe(1);
    expect(first?.props.pages).toEqual([{ number: 1 }, { number: 2, href: "-/page-2/index.html" }]);
    expect(first?.props.total).toBe(21);
    expect(first?.props.sorts).toEqual([
      { label: "A–Z", key: "title", active: true },
      { label: "Links", key: "links", active: false },
    ]);
    expect(
      first?.props.filter?.choices.map((choice) => [choice.label, choice.key, choice.href]),
    ).toEqual([
      ["All", undefined, undefined],
      ["Role a", "role-a", undefined],
      ["Role b", "role-b", undefined],
      ["Role c", "role-c", undefined],
      ["Role d", "role-d", undefined],
      ["Role e", "role-e", undefined],
      ["Role f", "role-f", undefined],
    ]);
    expect(second?.props.rows).toHaveLength(21);
    expect(second?.props.page).toBe(2);
    expect(second?.props.rows[0]?.href).toBe("../../screen-00/index.html");
  });

  it("gives a folder mapping to no type the heading Page, no filter and the count of pages", () => {
    const all = screensContext();
    const notes = listedCategoriesOf(all).find(
      (category) => category.folders.join("/") === "notes",
    );
    const documents = categoryDocumentsOf(all, notes as Category);
    expect(documents.map((document) => document.path)).toEqual([
      "specs/notes/index.html",
      "specs/notes/-/links/index.html",
    ]);
    expect(documents[0]?.props).toMatchObject({
      title: "Notes",
      lead: "2 pages.",
      unit: "Page",
      total: 2,
    });
    expect(documents[0]?.props.filter).toBe(undefined);
  });
});
