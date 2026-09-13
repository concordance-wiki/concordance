import { runInNewContext } from "node:vm";

import { memoryFileSystem, pagePath } from "@concordance-wiki/core";
import { h, type JSX } from "preact";
import { beforeAll, describe, expect, it } from "vitest";

import {
  fragmentPath,
  HOME_PAGE,
  INDEX_PAGE,
  mentionsFragmentPath,
  SEARCH_PAGE,
  siteRootOf,
  SPACES_PAGE,
  spacePagePath,
  TODO_PAGE,
} from "../../src/build/paths.js";
import { fontFiles } from "../../src/css/fonts.js";
import {
  buildSite,
  SITE_PAGE_BUDGET,
  siteDocuments,
  type SiteOptions,
  type SiteReport,
} from "../../src/build/site.js";
import { defaultIslands, type IslandBundle } from "../../src/islands/bundle.js";
import { searchFilePath } from "../../src/search/build.js";
import { SEARCH_META, type SearchMeta, type ShardData } from "../../src/search/shared.js";
import type { EntityPageProps } from "../../src/slots.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../src/theme/types.js";
import { count, expectBalanced } from "../helpers/html.js";
import { localTargets, references } from "../helpers/links.js";
import { fragments, model, profile, screen as screenEntity, term, tokenize } from "./fixture.js";

type Options = SiteOptions & { fileSystem: ReturnType<typeof memoryFileSystem> };

function options(overrides: Partial<Omit<SiteOptions, "fileSystem">> = {}): Options {
  return {
    output: "/dist",
    fileSystem: memoryFileSystem(),
    model: model(),
    fragments,
    profile,
    theme: defaultTheme,
    locale: "en",
    projectName: "Concordance notes",
    tokenize,
    ...overrides,
  };
}

async function build(overrides: Partial<Omit<SiteOptions, "fileSystem">> = {}) {
  const site = options(overrides);
  const report = await buildSite(site);
  return { fileSystem: site.fileSystem, report };
}

/** The page without its scripts and islands: what a reader gets when no JavaScript runs. */
function withoutJavaScript(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[a-z-]+[^>]*\sdata-island="[^"]*"[^>]*>[\s\S]*?<\/[a-z-]+>/g, "");
}

/** How many mentions the served page carries inline: the props of the related pages island. */
function inlineMentions(html: string): number {
  const match = /<concordance-island data-island="mentions-panel" data-props="([^"]*)"/.exec(html);
  if (match === null) return 0;
  // The panel serialises its own props: the shape is the island's.
  const props = JSON.parse((match[1] ?? "").replaceAll("&quot;", '"')) as { mentions: unknown[] };
  return props.mentions.length;
}

/** The entities of the fixture model that another note cites: those whose mentions fragment the build writes. */
/** The entities with a related page: the notes another note cites, and the keyword whose passages name the pages using it. */
const cited = [
  "framing/vision",
  "glossary/keyword-page",
  "glossary/page",
  "keywords/build-summary",
];

/**
 * The pages of the lists of the folders at the top of the fixture model: the whole list by
 * title, then the one value of the highlighted attribute of each folder, the sort by links
 * on both; the value is written as the frontmatter has it, the model of the tests carrying no
 * frontmatter link.
 */
function categoryPages(folders: readonly string[]): string[] {
  const values: Record<string, string> = {
    "specs/rules": "severity-error",
    "specs/screens": "roles-roles-reader",
  };
  return folders.flatMap((folder) => [
    `${folder}/index.html`,
    `${folder}/-/${values[folder] ?? ""}/index.html`,
    `${folder}/-/links/index.html`,
    `${folder}/-/${values[folder] ?? ""}-links/index.html`,
  ]);
}

describe("concordance render reads model.json and writes dist/: one HTML page per entity and per keyword, the JSON fragments, the search index, the previews and the static assets", () => {
  let fileSystem: ReturnType<typeof memoryFileSystem>;
  let report: SiteReport;

  beforeAll(async () => {
    ({ fileSystem, report } = await build());
  });

  it("writes the home, the index, the to-do page, the search page, the spaces page and one page per space, one page per entity and per keyword, the search index and the assets", () => {
    const entities = model().entities.map((entity) => pagePath(entity.id));
    const spaces = ["framing", "glossary", "specs"].map(spacePagePath);
    const categories = categoryPages(["specs/rules", "specs/screens"]);
    const index = fileSystem.listFiles("/dist").filter((file) => /^search\/.*\.js$/.test(file));
    expect(index).toContain(searchFilePath(SEARCH_META));
    expect(index.length).toBeGreaterThan(10);
    expect(fileSystem.listFiles("/dist")).toEqual(
      [
        HOME_PAGE,
        INDEX_PAGE,
        TODO_PAGE,
        SEARCH_PAGE,
        SPACES_PAGE,
        ...spaces,
        ...entities,
        ...categories,
        ...index,
        ...cited.map(mentionsFragmentPath),
        "assets/site.css",
        ...fontFiles().map((file) => `assets/fonts/${file}`),
        ...report.budget.islands.map((island) => `assets/${island.file}`),
      ].sort(),
    );

    expect(report.files).toEqual(fileSystem.listFiles("/dist"));
    expect(report.pages.map((page) => page.path)).toEqual(
      [
        HOME_PAGE,
        ...entities,
        ...spaces,
        ...categories,
        INDEX_PAGE,
        SEARCH_PAGE,
        SPACES_PAGE,
        TODO_PAGE,
      ].sort(),
    );
    expect(report.budget.islands.map((island) => island.name)).toEqual([
      "category-list",
      "contract-viewer",
      "document-viewer",
      "mentions-panel",
      "mode-switch",
      "search",
      "trail",
    ]);
  });

  /** Reads an index file back the way the browser does: the script calls the global with its name and its data. */
  function readIndexFile(name: string): unknown {
    const script = fileSystem.readText(`/dist/${searchFilePath(name)}`);
    let received: unknown;
    const window = {
      __concordanceSearch: {
        shard: (_name: string, data: unknown) => {
          received = data;
        },
      },
    };
    runInNewContext(script, { window });
    return received;
  }

  it("writes the entity table with one row per page, keyword pages typed as such, and the labels the results show", () => {
    // The table is read back from the file the build wrote.
    const meta = readIndexFile(SEARCH_META) as SearchMeta;
    expect(meta.entities).toHaveLength(7);
    expect(meta.entities.map((entry) => entry.id)).toEqual(model().entities.map((e) => e.id));
    expect(meta.entities.find((entry) => entry.id === "keywords/build-summary")).toEqual({
      id: "keywords/build-summary",
      title: "build summary",
      type: "keyword",
      url: "keywords/build-summary/index.html",
      status: "valid",
      source: "specs",
      keyword: true,
      occurrences: 5,
      documents: 2,
    });
    expect(meta.entities.find((entry) => entry.id === "glossary/keyword-page")).toEqual({
      id: "glossary/keyword-page",
      title: "Keyword page",
      type: "term",
      url: "glossary/keyword-page/index.html",
      application: "concordance-cli",
      domain: "publication",
      status: "active",
      source: "glossary",
      aliases: ["word page"],
      broader: "Page",
      cited: 4,
    });
    expect(meta.types).toEqual({
      document: "Document",
      keyword: "Keyword",
      rule: "Business rule",
      screen: "Screen",
      term: "Term",
    });
    expect(meta.applications).toEqual({ "concordance-cli": "concordance-cli" });
    expect(meta.domains).toEqual({
      "inference/recognition": "inference/recognition",
      publication: "publication",
    });
    expect(meta.shards).toEqual(
      fileSystem
        .listFiles("/dist/search")
        .filter((file) => file.endsWith(".js") && file !== "meta.js")
        .map((file) => file.replace(/\.js$/, "")),
    );
    expect(meta.bytes).toBeGreaterThan(0);
    expect(report.search.shards).toBe(meta.shards.length);
    expect(report.search.bytes).toBeGreaterThan(meta.bytes);
  });

  it("writes one shard per two-character prefix, holding its tokens with the weight of every entity carrying them, in table order", () => {
    // The shard is read back from the file the build wrote.
    const shard = readIndexFile("ke") as ShardData;
    const ids = model().entities.map((entity) => entity.id);
    const term = ids.indexOf("glossary/keyword-page");
    const keyword = ids.indexOf("keywords/build-summary");
    const orphan = ids.indexOf("keywords/zzz");
    // In the title of the term (5); the type of both keyword pages (1).
    expect(shard["keyword"]).toEqual([
      [term, 5],
      [keyword, 1],
      [orphan, 1],
    ]);
    expect(Object.keys(shard).every((token) => token.startsWith("ke"))).toBe(true);
    expect(Object.keys(shard)).toEqual([...Object.keys(shard)].sort());
    // In the title (5), the alias "word page" (4) and the body (1) of the term; in the title of "Page" (5).
    const pa = readIndexFile("pa") as ShardData;
    expect(pa["page"]).toEqual([
      [term, 10],
      [ids.indexOf("glossary/page"), 5],
    ]);
  });

  it("reports the weight of the index and its number of shards in the summary", () => {
    expect(report.summary.at(-1)).toMatch(/^search index: \d+\.\d kB in \d+ shards$/);
    expect(report.summary.at(-1)).toBe(
      `search index: ${(report.search.bytes / 1000).toFixed(1)} kB in ${String(report.search.shards)} shards`,
    );
  });

  it("serves the results page empty, the field of the header carrying the root of the site and the results island waiting for the query", () => {
    const page = fileSystem.readText(`/dist/${SEARCH_PAGE}`);
    expect(page).toContain("<title>Search – Concordance notes</title>");
    expect(page).toContain(
      '<concordance-island data-island="search" data-props="{&quot;root&quot;:&quot;../&quot;,&quot;results&quot;:',
    );
    expect(page).toContain('<div class="search-results"><h1>Search</h1>');
    expect(page).toContain(
      '<form class="site-search" role="search" aria-label="Site search" action="index.html" method="get">',
    );
    expect(page).toContain('<label class="visually-hidden" for="site-search">Search</label>');
    expect(page).toMatch(/<script defer src="\.\.\/assets\/search-[A-Z0-9]+\.js"><\/script>/);
    const entity = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(entity).toContain(
      'data-props="{&quot;root&quot;:&quot;../../&quot;,&quot;search&quot;:{&quot;action&quot;:&quot;../../search/index.html&quot;',
    );
    expect(entity).toContain('placeholder="Search the documentation"');
    expect(entity).toContain(
      '<button type="button" class="search-clear" hidden><span aria-hidden="true">✕</span><span class="visually-hidden">Clear the search</span></button><kbd class="search-shortcut" aria-hidden="true">/</kbd>',
    );
    expect(entity).toContain('<div class="search-suggestions" hidden></div>');
    const home = fileSystem.readText(`/dist/${HOME_PAGE}`);
    expect(home).toContain(
      'data-props="{&quot;root&quot;:&quot;&quot;,&quot;search&quot;:{&quot;action&quot;:&quot;search/index.html&quot;',
    );
  });

  it("heads the home page with the same field as the header, drawn large and submitting to the results page, the strings of its live results travelling with the island", () => {
    const home = fileSystem.readText(`/dist/${HOME_PAGE}`);
    expect(home).toContain(
      '<h1 id="home-question">What are you looking for?</h1><p class="home-explanation">Type a word of the business. If it is used anywhere in the documentation, it has a page — even if nobody has defined it yet.</p><concordance-island data-island="search" data-props="{&quot;root&quot;:&quot;&quot;,&quot;search&quot;:{&quot;action&quot;:&quot;search/index.html&quot;,&quot;placeholder&quot;:&quot;Search the documentation&quot;,&quot;label&quot;:&quot;Search&quot;,&quot;clearLabel&quot;:&quot;Clear the search&quot;,&quot;root&quot;:&quot;&quot;,&quot;suggestions&quot;:{&quot;matches&quot;:{&quot;one&quot;:&quot;# match&quot;,&quot;other&quot;:&quot;# matches&quot;},&quot;usedIn&quot;:{&quot;one&quot;:&quot;Used in # document, never defined&quot;,&quot;other&quot;:&quot;Used in # documents, never defined&quot;},&quot;browse&quot;:&quot;browse&quot;,&quot;enter&quot;:&quot;Enter&quot;,&quot;open&quot;:&quot;open&quot;,&quot;seeResults&quot;:{&quot;one&quot;:&quot;See the # result&quot;,&quot;other&quot;:&quot;See the # results&quot;}}},&quot;home&quot;:true}"><form class="home-search" role="search" aria-label="Search" action="search/index.html" method="get">',
    );
    expect(home).toContain(
      '<input id="home-search" type="search" name="q" placeholder="Search the documentation" autocomplete="off"/><span class="search-count" aria-live="polite"></span><button type="button" class="search-clear" hidden><span aria-hidden="true">✕</span><span class="visually-hidden">Clear the search</span></button>',
    );
    expect(home).toContain('<div class="search-suggestions home-suggestions" hidden></div>');
    expect(home).toContain(
      '<nav class="home-most-cited" aria-label="Most cited"><span class="home-most-cited-lead">Most cited</span><ul class="home-shortcuts"><li><a class="chip" href="keywords/build-summary/index.html">build summary</a></li>',
    );
  });

  it("lists the spaces on the home page, each row leading to the page of its space, the recent changes, and no letter, no statistic and no to-do link outside the footer", () => {
    const home = fileSystem.readText(`/dist/${HOME_PAGE}`);
    expect(home).toContain(
      '<h2 id="home-tree">Spaces <span class="home-lead">fed by your repositories</span></h2><ul class="home-space-list"><li class="home-space"><a class="home-space-row" href="glossary/index.html"><span class="space-initials" aria-hidden="true">GL</span><span class="home-space-text"><span class="home-space-name">glossary</span><span class="home-space-meta">2 pages</span></span></a></li>',
    );
    expect(home).toContain(
      '<li class="home-space"><a class="home-space-row" href="specs/index.html"><span class="space-initials" aria-hidden="true">SP</span>',
    );
    expect(home).not.toContain("space-nodes");
    expect(home).toContain(
      '<p class="home-note">The dates come from the history of the repositories, so they are always right.</p>',
    );
    expect(home).toContain(
      '<h2 id="home-recent">Recently changed</h2><ul class="home-change-list"></ul>',
    );
    expect(home).not.toContain("home-more-spaces");
    expect(home).not.toContain("home-alert");
    expect(home).not.toContain('class="letter');
    expect(home).not.toContain("home-todo");
    expect(home).not.toContain("home-stats");
  });

  it("renders a typed entity through the entity page and a keyword through the keyword page, both complete documents", () => {
    const entity = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(entity.startsWith('<!doctype html>\n<html lang="en" dir="ltr">')).toBe(true);
    expect(entity).toContain("<title>Keyword page – Concordance notes</title>");
    expect(entity).toContain('<div class="entity entity-with-space">');
    expect(entity).toContain("<h1>Keyword page</h1>");
    expect(entity).toContain('<article class="entity-body">');
    expect(entity).toContain('<span class="badge">Term</span>');
    expect(entity).toContain("<p>An entity page.</p>");
    const keyword = fileSystem.readText("/dist/keywords/build-summary/index.html");
    expect(keyword).toContain('<div class="entity entity-with-space keyword">');
    expect(keyword).toContain('<h1 class="keyword-title">build summary</h1>');
    expect(keyword).toContain('<span class="badge badge-noteless">No definition</span>');
    expect(keyword).toContain("Nobody has written a definition, but 5 passages use this word.");
    const rule = fileSystem.readText("/dist/specs/rules/publication-threshold/index.html");
    expect(rule.startsWith('<!doctype html>\n<html lang="fr" dir="ltr">')).toBe(true);
    for (const page of report.pages) {
      expectBalanced(fileSystem.readText(`/dist/${page.path}`));
    }
  });

  it("renders the entities of a type through the page component resolved for that type, the others through the generic page", async () => {
    const TermPage = (props: EntityPageProps): JSX.Element =>
      h(
        "div",
        { class: "entity term-page" },
        h("h1", null, props.entity.title),
        h("p", null, `${String(props.declaration?.attributes.length)} declared attributes`),
        h("p", null, (props.otherAttributes ?? []).map((attribute) => attribute.name).join(", ")),
      );
    const theme: ResolvedTheme = {
      ...defaultTheme,
      typed: { pages: { term: TermPage }, parts: { attributes: {}, sections: {} }, typeParts: {} },
      overrides: [{ slot: "EntityPage@term", plugin: "@example/theme", theme: "custom" }],
    };
    const { fileSystem: files, report: typed } = await build({ theme });
    const page = files.readText("/dist/glossary/keyword-page/index.html");
    expect(page).toContain('<div class="entity term-page"><h1>Keyword page</h1>');
    expect(page).toContain("<p>4 declared attributes</p>");
    expect(page).toContain("<p>note, supersedes, weight</p>");
    expect(files.readText("/dist/specs/screens/mentions-panel/index.html")).toContain(
      '<div class="entity entity-with-space"><nav class="space" aria-label="Tree of the space">',
    );
    expect(typed.summary).toContain(
      "override EntityPage@term: plugin @example/theme, theme custom",
    );
  });

  it("names the attributes and the other attributes of a page, the declared ones by the profile in the site language, the others as written", () => {
    const page = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(page).toContain('<h2 id="entity-properties">Properties<span class="count panel-count">');
    expect(page).toContain("<dt>Broader term</dt>");
    expect(page).toContain(
      '<h2 id="entity-other-attributes">Other attributes<span class="count panel-count">',
    );
    expect(page).toContain('<dt>weight</dt><dd><span class="value">3</span></dd>');
  });

  it("writes the project name as the site title, the spaces, index and recent links in the top bar, the to-do link with its count in the footer, and no credit without a theme", () => {
    const home = fileSystem.readText(`/dist/${HOME_PAGE}`);
    expect(home).toContain("<title>Concordance notes</title>");
    expect(home).toContain('<a class="site-title" href="index.html">Concordance notes</a>');
    expect(home).toContain('<a class="drawer-spaces-title" href="spaces/index.html">Spaces</a>');
    expect(home).toContain(
      '<ul class="site-links"><li><a href="index/index.html">A–Z index</a></li><li><a href="index.html#home-recent">Recent</a></li></ul>',
    );
    expect(home).toContain('<h2 id="home-tree">');
    expect(home).toContain('<h2 id="home-recent">');
    const header = home.slice(home.indexOf("<header"), home.indexOf("</header>"));
    expect(header).not.toContain("todo/index.html");
    expect(home).toContain(
      '<li class="site-footer-todo"><a href="todo/index.html">To do<span class="count">5</span></a></li>',
    );
    expect(home).not.toContain("Built with");
    expect(home).toContain("version 0.1.0");
    expect(home).toContain('<time datetime="2026-09-12T12:00:00.000Z">');
  });

  it("lists every space in the drawer of every page with its initials and its note count, and the tree of the page on an entity page and a keyword page", () => {
    const home = fileSystem.readText(`/dist/${HOME_PAGE}`);
    expect(home).toContain(
      '<details class="site-drawer" aria-label="Menu"><summary class="site-menu">',
    );
    expect(home).toContain(
      '<ul class="drawer-space-list"><li><a href="framing/index.html"><span class="space-initials" aria-hidden="true">FR</span><span class="drawer-space-name">framing</span><span class="count">1</span></a></li><li><a href="glossary/index.html"><span class="space-initials" aria-hidden="true">GL</span><span class="drawer-space-name">glossary</span><span class="count">2</span></a></li><li><a href="specs/index.html"><span class="space-initials" aria-hidden="true">SP</span><span class="drawer-space-name">specs</span><span class="count">2</span></a></li></ul>',
    );
    expect(home).not.toContain('class="drawer-space"');
    expect(home).toContain(
      '<details class="site-search-fold"><summary class="site-search-button">',
    );
    const entity = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(entity).toContain(
      '<div class="drawer-space"><details class="space-tree" open><summary class="space-head"><span class="space-initials" aria-hidden="true">GL</span><span class="space-name">glossary</span></summary>',
    );
    // The tree of the column is the same, served closed under the link to the space; the drawer copy is no landmark.
    expect(entity).toContain(
      '<nav class="space" aria-label="Tree of the space"><a class="space-head space-head-link" href="../index.html"><span class="space-initials" aria-hidden="true">GL</span><span class="space-name">glossary</span></a><details class="space-tree"><summary class="space-head">',
    );
    expect(entity.match(/<nav class="space"/g)).toHaveLength(1);
    // A keyword page is filed in the glossary: its drawer carries that tree, the word at its place.
    const keyword = fileSystem.readText("/dist/keywords/build-summary/index.html");
    expect(keyword).toContain(
      '<div class="drawer-space"><details class="space-tree" open><summary class="space-head"><span class="space-initials" aria-hidden="true">GL</span><span class="space-name">glossary</span></summary>',
    );
    expect(keyword).toContain(
      '<nav class="space" aria-label="Tree of the space"><a class="space-head space-head-link" href="../../glossary/index.html">',
    );
    expect(keyword).toContain('<li class="space-page space-current"><span aria-current="page">');
    expect(keyword.match(/<nav class="space"/g)).toHaveLength(1);
  });

  it("writes nothing for the previews, which wait for the conversion of documents", () => {
    expect(fileSystem.listFiles("/dist").some((file) => file.includes("preview"))).toBe(false);
  });

  it("reads the fragments the build wrote: an entity without one has no section", () => {
    const html = fileSystem.readText("/dist/glossary/page/index.html");
    expect(html).not.toContain('class="markdown"');
    expect(fragmentPath("glossary/page")).toBe("fragments/glossary/page.json");
  });
});

describe("The site works over file:// as well as behind a server, without URL rewriting configuration", () => {
  it("writes every page as index.html in its own folder and every href and src relative to the page, resolving to a written file", async () => {
    const { fileSystem, report } = await build();
    const written = new Set(fileSystem.listFiles("/dist"));
    let checked = 0;
    for (const page of report.pages) {
      expect(page.path.endsWith("/index.html") || page.path === HOME_PAGE).toBe(true);
      const html = fileSystem.readText(`/dist/${page.path}`);
      for (const reference of references(html)) {
        expect(reference.startsWith("/")).toBe(false);
      }
      for (const { reference, target } of localTargets(page.path, html)) {
        expect(written.has(target), `${page.path}: ${reference} resolves to ${target}`).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it("climbs with .. from a nested page to the assets, the home and another entity", async () => {
    const { fileSystem } = await build();
    const html = fileSystem.readText("/dist/specs/screens/mentions-panel/index.html");
    expect(html).toContain('<link rel="stylesheet" href="../../../assets/site.css"');
    expect(html).toContain('href="../../../index.html"');
    expect(html).toContain('href="../../../glossary/keyword-page/index.html"');
    expect(html).toContain('<script defer src="../../../assets/mode-switch-');
  });
});

describe("URLs follow the entity identifier and stay stable from one build to the next", () => {
  it("places the page of an entity at <id>/index.html and writes the same bytes twice", async () => {
    const first = await build();
    const second = await build();
    expect(first.fileSystem.exists("/dist/glossary/keyword-page/index.html")).toBe(true);
    expect(first.fileSystem.exists("/dist/keywords/build-summary/index.html")).toBe(true);
    expect(first.fileSystem.listFiles("/dist")).toEqual(second.fileSystem.listFiles("/dist"));
    for (const file of first.fileSystem.listFiles("/dist")) {
      expect(second.fileSystem.readText(`/dist/${file}`)).toBe(
        first.fileSystem.readText(`/dist/${file}`),
      );
    }
  });

  it("keeps the URL of a keyword page when a note is created later: the address forwards to the note", async () => {
    const written = {
      ...term,
      id: "glossary/build-summary",
      title: "Build summary",
      source: { name: "glossary", path: "build-summary.md", line: 1 },
    };
    const later = model({
      entities: model().entities.filter((entity) => entity.id !== "keywords/build-summary"),
    });
    later.entities.push(written);
    const withNote = new Map(fragments);
    withNote.set("glossary/build-summary", {
      id: "glossary/build-summary",
      sections: [{ id: "section-lead", html: "<p>What the build prints last.</p>" }],
      keywords: ["keywords/build-summary", "keywords/zzz", "keywords/summary"],
    });
    // Another note claiming an address already taken keeps none of it.
    withNote.set("glossary/page", {
      id: "glossary/page",
      sections: [],
      keywords: ["keywords/summary"],
    });
    const { fileSystem, report } = await build({ model: later, fragments: withNote });
    const redirect = fileSystem.readText("/dist/keywords/build-summary/index.html");
    expect(redirect).toContain(
      '<meta http-equiv="refresh" content="0; url=../../glossary/build-summary/index.html"/>',
    );
    expect(redirect).toContain("<title>Build summary – Concordance notes</title>");
    expect(redirect).toContain(
      '<main id="main"><div class="redirect"><h1>Build summary</h1><p>A note now defines this expression: <a href="../../glossary/build-summary/index.html">Build summary</a></p></div></main>',
    );
    expect(redirect).not.toContain("Nobody has written a definition");
    // The address a keyword page of this build holds stays that page; a free one is claimed once.
    expect(fileSystem.readText("/dist/keywords/zzz/index.html")).toContain(
      '<h1 class="keyword-title">#hash</h1>',
    );
    const summary = fileSystem.readText("/dist/keywords/summary/index.html");
    expect(summary).toContain('url=../../glossary/build-summary/index.html"');
    expect(report.pages.map((page) => page.path)).toContain("keywords/build-summary/index.html");
    expect(report.redirects).toBe(2);
    expect(report.summary).toContain("redirects: 2 former keyword addresses forwarding to a note");
    expect(report.warnings).toEqual([]);
    expect(fileSystem.exists("/dist/keywords/build-summary/index.html")).toBe(true);
  });

  it("offers to create the missing note on the forge of the glossary source the configuration names", async () => {
    const block = model().build;
    const sources = block.sources.map((source) =>
      source.name === "glossary"
        ? { ...source, url: "https://github.com/concordance-wiki/demo-glossary" }
        : source,
    );
    const { fileSystem } = await build({
      model: model({ build: { ...block, sources } }),
      glossarySources: ["glossary"],
    });
    const keyword = fileSystem.readText("/dist/keywords/build-summary/index.html");
    expect(keyword).toContain(
      '<a class="create-note" href="https://github.com/concordance-wiki/demo-glossary/new/main?filename=build-summary.md">Propose a definition</a>',
    );
    const plain = (await build()).fileSystem.readText("/dist/keywords/build-summary/index.html");
    expect(plain).toContain('<span class="create-note">Propose a definition</span>');
  });

  it("keeps the same URL when the model gains an entity or a link", async () => {
    const base = model();
    const grown = model({
      entities: [...base.entities, { ...term, id: "glossary/another", title: "Another" }],
    });
    const { fileSystem } = await build({ model: grown });
    expect(fileSystem.exists("/dist/glossary/keyword-page/index.html")).toBe(true);
    expect(fileSystem.exists("/dist/glossary/another/index.html")).toBe(true);
  });
});

describe("The main content of every page is present in the served HTML, without executing JavaScript", () => {
  it("keeps the title, every section heading and the neighbour list once scripts and islands are stripped", async () => {
    const { fileSystem } = await build();
    const html = withoutJavaScript(fileSystem.readText("/dist/glossary/keyword-page/index.html"));
    expect(html).not.toContain("<script");
    expect(html).not.toContain("data-island");
    expect(html).toContain("<h1>Keyword page</h1>");
    expect(html).toContain("<h2>Not to be confused with</h2>");
    expect(html).toContain('<ul id="neighbourhood-list"');
    expect(html).toContain(">Page</a>");
    expect(html).toContain(">Mentions panel</a>");
    expect(html).toContain(">build summary</a>");
    expect(html).toContain("keyword pages");
  });

  it("keeps the passages of a keyword page and the entries of the index and the to-do page", async () => {
    const { fileSystem } = await build();
    const keyword = withoutJavaScript(
      fileSystem.readText("/dist/keywords/build-summary/index.html"),
    );
    expect(keyword).toContain('<q class="passage-text">the build summary is printed</q>');
    expect(keyword).toContain('<q class="passage-text">after the <mark>Build summaries</mark></q>');
    const index = withoutJavaScript(fileSystem.readText(`/dist/${INDEX_PAGE}`));
    expect(count(index, '<tr class="index-entry')).toBe(7);
    const todo = withoutJavaScript(fileSystem.readText(`/dist/${TODO_PAGE}`));
    expect(todo).toContain(">build summary</a>");
  });
});

describe("A page weighs under 150 KB excluding previews", () => {
  it("measures every page against the budget and reports the largest page and each island in the summary", async () => {
    const { report } = await build();
    expect(report.budget.maxPageBytes).toBe(SITE_PAGE_BUDGET);
    expect(report.budget.overBudget).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.summary[0]).toBe("site: 23 pages written to /dist");
    expect(report.summary[1]).toBe("redirects: 0 former keyword addresses forwarding to a note");
    expect(report.redirects).toBe(0);
    expect(report.summary.filter((line) => line.startsWith("island "))).toHaveLength(7);
    expect(
      report.summary.some((line) => /^pages: 23, largest \d+\.\d kB, budget 150\.0 kB$/.test(line)),
    ).toBe(true);
    expect(report.summary).toContain("accessibility: 0 findings");
    expect(report.summary).toContain("contrast: 0 pairs below the minimum");
  });

  it("bundles the UI components the theme resolution collected next to the default islands, the defaults keeping their name", async () => {
    const [mentions] = defaultIslands();
    const { report, fileSystem } = await build({
      theme: {
        ...defaultTheme,
        islands: [
          { name: "pdf-viewer", entry: mentions?.entry ?? "" },
          { name: "contract-viewer", entry: "/elsewhere/viewer.client" },
        ],
      },
    });
    expect(report.budget.islands.map((island) => island.name)).toEqual([
      "category-list",
      "contract-viewer",
      "document-viewer",
      "mentions-panel",
      "mode-switch",
      "pdf-viewer",
      "search",
      "trail",
    ]);
    const viewer = report.budget.islands.find((island) => island.name === "contract-viewer");
    expect(fileSystem.readText(`/dist/assets/${viewer?.file ?? ""}`)).toContain(
      "Show the contract",
    );
  });

  it("warns about a page over the budget without failing the build", async () => {
    const { report, fileSystem } = await build({ maxPageBytes: 5_000 });
    expect(report.warnings).toContain("glossary/keyword-page/index.html: over budget");
    expect(fileSystem.exists("/dist/glossary/keyword-page/index.html")).toBe(true);
    expect(report.summary.some((line) => line.endsWith("over budget"))).toBe(true);
  });
});

describe("One mentions fragment per entity, never a global index", () => {
  it("writes fragments/<id>.mentions.json for every entity with a related page, holding all its mentions with hrefs relative to its page", async () => {
    const { fileSystem } = await build();
    const written = fileSystem.listFiles("/dist").filter((file) => file.endsWith(".mentions.json"));
    expect(written).toEqual(cited.map(mentionsFragmentPath));
    const fragment = JSON.parse(
      fileSystem.readText(`/dist/${mentionsFragmentPath("glossary/keyword-page")}`),
    ) as { id: string; mentions: unknown[] };
    expect(fragment.id).toBe("glossary/keyword-page");
    expect(fragment.mentions).toHaveLength(5);
    const page = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    // Every inline mention travels in the props of the island; the served list quotes one passage per page.
    for (const mention of fragment.mentions as { href: string; context: string }[]) {
      expect(page).toContain(mention.href);
    }
    expect(page).toContain(
      '<a class="related-excerpt mention-passage" href="../../specs/screens/mentions-panel/index.html#L7"><span class="related-mark">Cited · </span><q class="mention-context">keyword pages</q></a>',
    );
  });

  it("writes no global mentions file and keeps every fragment far under two hundred kilobytes, even with many mentions", async () => {
    const many = Array.from({ length: 300 }, (_, index) => ({
      from: `glossary/page`,
      to: "glossary/keyword-page",
      relation: "related",
      confidence: 0.6,
      provenance: [
        {
          method: "glossary_occurrence" as const,
          confidence: 0.6,
          path: "page.md",
          line: index + 1,
          occurrences: [{ line: index + 1, context: `passage ${String(index + 1)} of the note` }],
        },
      ],
    }));
    const { fileSystem, report } = await build({
      model: model({ links: [...model().links, ...many] }),
    });
    const files = fileSystem.listFiles("/dist");
    expect(
      files.filter((file) => file.endsWith("mentions.json") && !file.startsWith("fragments/")),
    ).toEqual([]);
    expect(files.filter((file) => /^fragments\/[^/]*mentions[^/]*$/.test(file))).toEqual([]);
    for (const file of files.filter((file) => file.endsWith(".mentions.json"))) {
      expect(Buffer.byteLength(fileSystem.readText(`/dist/${file}`)), file).toBeLessThan(200_000);
    }
    const fragment = JSON.parse(
      fileSystem.readText(`/dist/${mentionsFragmentPath("glossary/keyword-page")}`),
    ) as { mentions: unknown[] };
    expect(fragment.mentions).toHaveLength(305);
    // From two hundred mentions on, the page embeds nothing: it stays small and the island fetches the fragment.
    const page = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(inlineMentions(page)).toBe(20);
    expect(page).not.toContain('id="mentions-embedded"');
    expect(page).toContain('href="../../fragments/glossary/keyword-page.mentions.json"');
    expect(report.warnings).toEqual([]);
  });
});

describe("Without JavaScript, the first twenty mentions remain readable and the links work", () => {
  it("keeps the related pages of the inline mentions, their title and passage links and the link to the fragment once scripts are removed, every target written", async () => {
    const { fileSystem } = await build({ mentionsInline: 3 });
    const path = "glossary/keyword-page/index.html";
    const html = fileSystem.readText(`/dist/${path}`).replace(/<script[\s\S]*?<\/script>/g, "");
    expect(html).not.toContain("<script");
    expect(inlineMentions(html)).toBe(3);
    // The three mentions served are the first passages of the three pages, each counting what it holds in all.
    expect(count(html, '<li class="related-page')).toBe(3);
    expect(html).toContain(
      '<a class="related-title" href="../../specs/screens/mentions-panel/index.html">Mentions panel</a><span class="related-type">Screen</span><span class="related-count">3<span class="visually-hidden"> passages</span></span>',
    );
    expect(html).toContain(
      '<a class="related-excerpt mention-passage" href="../../specs/screens/mentions-panel/index.html#L7"><span class="related-mark">Cited · </span>',
    );
    expect(html).toContain('<a href="../../fragments/glossary/keyword-page.mentions.json">');
    // The header carries the mode switch button on every page: only the main landmark is inspected.
    expect(html.slice(html.indexOf('<main id="main">'), html.indexOf("</main>"))).not.toContain(
      "<button",
    );
    const written = new Set(fileSystem.listFiles("/dist"));
    for (const { reference, target } of localTargets(path, html)) {
      expect(written.has(target), `${reference} resolves to ${target}`).toBe(true);
    }
  });
});

describe("The threshold of twenty is configurable (build.mentions_inline)", () => {
  it("serves as many mentions inline as the configuration says, twenty without it", async () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      from: `glossary/page`,
      to: "glossary/keyword-page",
      relation: "related",
      confidence: 0.6,
      provenance: [
        {
          method: "glossary_occurrence" as const,
          confidence: 0.6,
          path: "page.md",
          line: index + 1,
        },
      ],
    }));
    const grown = model({ links: [...model().links, ...many] });
    const page = "glossary/keyword-page/index.html";
    const inline = async (mentionsInline?: number): Promise<number> => {
      const { fileSystem } = await build({
        model: grown,
        ...(mentionsInline === undefined ? {} : { mentionsInline }),
      });
      return inlineMentions(fileSystem.readText(`/dist/${page}`));
    };
    expect(await inline()).toBe(20);
    expect(await inline(5)).toBe(5);
    expect(await inline(0)).toBe(0);
    expect(await inline(100)).toBe(35);
  });
});

describe("The labels of the site come from the message catalogue of the project locale", () => {
  it("writes the French labels of the chrome and the pages for a French project, the theme overriding a message", async () => {
    const { fileSystem } = await build({ locale: "fr" });
    const home = fileSystem.readText(`/dist/${HOME_PAGE}`);
    expect(home).toContain('<a class="drawer-spaces-title" href="spaces/index.html">Espaces</a>');
    expect(home).toContain(
      '<li><a href="index/index.html">Index A–Z</a></li><li><a href="index.html#home-recent">Récent</a></li>',
    );
    expect(home).toContain('<details class="site-drawer" aria-label="Menu">');
    expect(home).toContain('<summary class="site-search-button">');
    expect(home).toContain("</svg>Rechercher</summary>");
    expect(home).toContain('<a href="todo/index.html">À faire<span class="count">5</span></a>');
    expect(home).toContain('placeholder="Rechercher dans la documentation"');
    expect(home).toContain('<h1 id="home-question">Que cherchez-vous ?</h1>');
    expect(home).toContain(
      '<h2 id="home-tree">Espaces <span class="home-lead">alimentés par vos dépôts</span></h2>',
    );
    expect(home).toContain('<span class="home-space-meta">2 pages</span>');
    expect(home).toContain('aria-label="Les plus citées"');
    expect(home).toContain(">Modifié récemment</h2>");
    expect(home).toContain("&quot;enter&quot;:&quot;Entrée&quot;");
    expect(home).toContain('<html lang="fr"');
    const entity = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(entity).toContain('<span class="badge">Terme</span>');
    expect(entity).toContain('<html lang="en"');
    expect(entity).toContain('<nav class="space" aria-label="Arborescence de l’espace">');
    expect(entity).toContain('<nav class="breadcrumbs" aria-label="Vous êtes ici">');
    expect(entity).toContain('<h2 id="entity-toc">Sur cette page</h2>');
    expect(entity).toContain(
      '<p class="panel-note">4 clés déclarées. Le reste du fichier est du texte libre.</p>',
    );
    expect(entity).toContain(
      '<footer class="entity-footer"><p class="legend"><span class="legend-written">lien écrit</span><span class="legend-recognised">mot reconnu, fiche existante</span><span class="legend-keyword">mot reconnu, sans fiche</span></p>',
    );
    expect(entity).toContain(
      '<h2 id="mentions-title">Pages en relation <span class="count">3</span></h2>',
    );
    expect(entity).toContain(
      '<span class="neighbourhood-lead">Voir la carte du voisinage</span><span class="neighbourhood-count">3 pages</span>',
    );
  });

  it("takes the site title, favicon, stylesheets, footer and label overrides from the theme.yaml of the theme", async () => {
    const themeFiles = memoryFileSystem({
      "/theme/theme.yaml": "",
      "/theme/style.css": "body { color: red }",
      "/theme/icons/favicon.svg": "<svg xmlns='http://www.w3.org/2000/svg'></svg>",
      "/theme/logo.png": "PNG",
    });
    const theme: ResolvedTheme = {
      ...defaultTheme,
      config: {
        config: {
          name: "Concordance handbook",
          light: {
            bg: "#FFFFFF",
            surface: "#FFFFFF",
            border: "#DDDDDD",
            ink: "#111111",
            muted: "#444444",
            accent: "#0044AA",
          },
          dark: {
            bg: "#000000",
            surface: "#111111",
            border: "#333333",
            ink: "#EEEEEE",
            muted: "#BBBBBB",
            accent: "#77AAFF",
          },
          footer: {
            text: "Kept by its maintainers.",
            links: [{ label: "Forge", url: "https://forge.example/wiki" }],
            credit: true,
          },
          labels: { en: { "site.todo": "Backlog" } },
        },
        file: "/theme/theme.yaml",
        fileSystem: themeFiles,
        logo: { path: "/theme/logo.png", file: "logo.png" },
        favicon: { path: "/theme/icons/favicon.svg", file: "favicon.svg" },
        stylesheet: { path: "/theme/style.css", content: "body { color: red }" },
        assets: [
          { path: "/theme/icons/favicon.svg", file: "favicon.svg" },
          { path: "/theme/logo.png", file: "logo.png" },
        ],
      },
    };
    const { fileSystem, report } = await build({ theme });
    const home = fileSystem.readText(`/dist/${HOME_PAGE}`);
    expect(home).toContain("<title>Concordance handbook</title>");
    expect(home).toContain('<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"/>');
    expect(home).toContain('<link rel="stylesheet" href="assets/project.css"');
    expect(home).toContain("Kept by its maintainers.");
    expect(home).toContain('<a href="https://forge.example/wiki">Forge</a>');
    expect(home).toContain("Built with Concordance");
    expect(home).toContain('<a href="todo/index.html">Backlog<span class="count">5</span></a>');
    expect(home).toContain('<img class="site-logo" src="assets/logo.png" alt/>');
    expect(fileSystem.listFiles("/dist/assets")).toContain("favicon.svg");
    expect(fileSystem.listFiles("/dist/assets")).toContain("logo.png");
    expect(fileSystem.listFiles("/dist/assets")).toContain("project.css");
    expect(report.summary).toContain("theme: Concordance handbook, from /theme/theme.yaml");
    const entity = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(entity).toContain("<title>Keyword page – Concordance handbook</title>");
    expect(entity).toContain('<link rel="icon" href="../../assets/favicon.svg"');
  });
});

describe("siteDocuments", () => {
  const bundles: IslandBundle[] = [
    { name: "mentions-panel", file: "mentions-panel-ABC123.js", bytes: 1 },
    { name: "mode-switch", file: "mode-switch-DEF456.js", bytes: 1 },
    { name: "search", file: "search-0123ABCD.js", bytes: 1 },
    { name: "trail", file: "trail-789ABC.js", bytes: 1 },
  ];

  it("renders the same documents as the build, in a fixed order, from the bundles it is given", () => {
    const { documents, search } = siteDocuments(options(), bundles);
    const categories = categoryPages(["specs/rules", "specs/screens"]);
    const index = documents.filter(
      (document) => document.path.startsWith("search/") && document.path.endsWith(".js"),
    );
    expect(documents.map((document) => document.path)).toEqual([
      HOME_PAGE,
      INDEX_PAGE,
      TODO_PAGE,
      SPACES_PAGE,
      ...["framing", "glossary", "specs"].map(spacePagePath),
      SEARCH_PAGE,
      ...model().entities.map((entity) => pagePath(entity.id)),
      ...categories,
      ...index.map((document) => document.path),
      ...cited.map(mentionsFragmentPath),
    ]);
    expect(index[0]?.path).toBe(searchFilePath(SEARCH_META));
    expect(search).toEqual({
      bytes: index.reduce((total, document) => total + Buffer.byteLength(document.content), 0),
      shards: index.length - 1,
    });
  });

  it("cuts the body of the index at bodyMaxChars, the build.extracted_text_max_chars of the configuration", () => {
    const shardOf = (documents: ReturnType<typeof siteDocuments>["documents"], name: string) =>
      documents.find((document) => document.path === searchFilePath(name))?.content ?? "";
    const whole = siteDocuments(options(), bundles).documents;
    expect(shardOf(whole, "th")).toContain('"threshold"');
    const cut = siteDocuments(options({ bodyMaxChars: 20 }), bundles).documents;
    expect(shardOf(cut, "th")).not.toContain('"threshold"');
    expect(shardOf(cut, "bu")).toContain('"built"');
  });

  it("passes the mentions_inline, the edit link pattern, the names, the staleness thresholds, the source descriptions and the collation of the configuration to the pages", () => {
    const dated = {
      ...term,
      source: { ...term.source, last_modified: "2026-09-01T00:00:00.000Z" },
    };
    const { documents } = siteDocuments(
      options({
        mentionsInline: 1,
        editUrl: "https://forge.example/{source}/{path}",
        staleness: { warn_after_days: { default: 1 } },
        sourceDescriptions: { glossary: "The vocabulary of the tool." },
        names: { domains: { publication: "Publication" } },
        collate: (a, b) => b.localeCompare(a),
        model: model({
          entities: model().entities.map((entity) => (entity.id === term.id ? dated : entity)),
        }),
      }),
      bundles,
    );
    const home = documents.find((document) => document.path === HOME_PAGE);
    const entity = documents.find((document) => document.path === pagePath(term.id));
    const index = documents.find((document) => document.path === INDEX_PAGE);
    expect(index?.content.indexOf(">vision</a>")).toBeLessThan(
      index?.content.indexOf(">#hash</a>") ?? -1,
    );
    expect(entity?.content).toContain("<details");
    expect(inlineMentions(entity?.content ?? "")).toBe(1);
    expect(entity?.content).toContain(
      '<a class="entity-edit" href="https://forge.example/glossary/keyword-page.md">',
    );
    expect(home?.content).toContain(
      '<li class="home-space stale"><a class="home-space-row" href="glossary/index.html"><span class="space-initials" aria-hidden="true">GL</span><span class="home-space-text"><span class="home-space-name">glossary</span><span class="home-space-meta">2 pages · <time datetime="2026-09-01">2 weeks ago</time></span>',
    );
    expect(home?.content).toContain(
      '<li class="home-change"><a href="glossary/keyword-page/index.html"><span class="home-change-title">Keyword page</span><span class="home-change-meta">glossary · <time datetime="2026-09-01">2 weeks ago</time></span></a></li>',
    );
    expect(home?.content).toContain(
      '<div class="home-alert"><h3>A space has not moved for 11 days</h3><p>glossary. The alert threshold is set to 1 day in the configuration.</p></div>',
    );
    const spaces = documents.find((document) => document.path === SPACES_PAGE);
    expect(spaces?.content).toContain(
      '<tr class="spaces-row stale"><th scope="row" class="spaces-name"><span class="space-initials" aria-hidden="true">GL</span><a href="../glossary/index.html">glossary</a></th><td class="spaces-content">The vocabulary of the tool.</td><td class="spaces-count">2</td><td class="spaces-date"><time datetime="2026-09-01">11 days ago</time></td></tr>',
    );
    expect(spaces?.content).toContain(
      '<td class="spaces-content">Business rule, Screen</td><td class="spaces-count">2</td><td class="spaces-date"></td>',
    );
    const space = documents.find((document) => document.path === spacePagePath("glossary"));
    expect(space?.content).toContain("<title>glossary – Concordance notes</title>");
    expect(space?.content).toContain(
      '<h1>glossary</h1><p class="space-description">The vocabulary of the tool.</p><p class="space-meta"><span>2 pages</span><span>repository <code>glossary</code></span><time datetime="2026-09-01">updated 2 weeks ago</time></p>',
    );
    expect(space?.content).toContain('<input type="hidden" name="source" value="glossary"/>');
    expect(space?.content).toContain('placeholder="Search in this space"');
    expect(space?.content).not.toContain('class="drawer-space"');
  });

  it("passes the pseudonymisation flag of the configuration to the page of a meeting, which says that its participants are pseudonyms", () => {
    const meeting = {
      ...term,
      id: "meetings/2026-03-12-keyword-page-threshold-review",
      type: "meeting",
      title: "Keyword page threshold review",
      attributes: {},
      source: {
        name: "specs",
        path: "meetings/2026-03-12-keyword-page-threshold-review.md",
        line: 1,
      },
    };
    const render = (pseudonymized?: boolean): string =>
      siteDocuments(
        options({
          ...(pseudonymized === undefined ? {} : { pseudonymized }),
          model: model({ entities: [...model().entities, meeting] }),
        }),
        bundles,
      ).documents.find((document) => document.path === pagePath(meeting.id))?.content ?? "";
    expect(render(true)).toContain(
      '<span class="badge">Meeting</span><span class="meeting-participants">Pseudonymised participants</span>',
    );
    expect(render()).toContain('<span class="badge">Meeting</span></p>');
  });

  it("gives the trail of every page its labels in the site language, the way to the root and, on an entity page, the page itself", () => {
    const { documents } = siteDocuments(options({ locale: "fr" }), bundles);
    const trailOf = (path: string): unknown => {
      const html = documents.find((document) => document.path === path)?.content ?? "";
      const match =
        /<concordance-island data-island="trail" data-props="([^"]*)"><\/concordance-island>/.exec(
          html,
        );
      return JSON.parse((match?.[1] ?? "null").replaceAll("&quot;", '"'));
    };
    const labels = {
      title: "Parcours",
      pin: "Épingler",
      unpin: "Désépingler",
      empty: "Aucune page épinglée",
      earlier: "pages précédentes",
    };
    expect(trailOf(HOME_PAGE)).toEqual({ base: "", labels });
    expect(trailOf(TODO_PAGE)).toEqual({ base: "../", labels });
    expect(trailOf("glossary/keyword-page/index.html")).toEqual({
      base: "../../",
      labels,
      current: { id: "glossary/keyword-page", title: "Keyword page" },
    });
    expect(trailOf("specs/screens/mentions-panel/index.html")).toEqual({
      base: "../../../",
      labels,
      current: { id: "specs/screens/mentions-panel", title: "Mentions panel" },
    });
    expect(siteRootOf("index.html")).toBe("");
    expect(siteRootOf("todo/index.html")).toBe("../");
  });

  it("links the edit page of the forge from the source URL of the model and the declared refs when no pattern is configured", () => {
    const withForge = model();
    withForge.build.sources = [
      { name: "glossary", url: "https://github.com/concordance-wiki/demo-glossary.git" },
      { name: "specs", url: "https://gitlab.com/concordance-wiki/demo-specs" },
      { name: "framing" },
    ];
    const { documents } = siteDocuments(
      options({ model: withForge, sourceRefs: { specs: "develop" } }),
      bundles,
    );
    const entity = documents.find((document) => document.path === pagePath(term.id));
    const screen = documents.find((document) => document.path === pagePath(screenEntity.id));
    expect(entity?.content).toContain(
      '<p class="entity-source"><code>glossary/keyword-page.md</code><span class="entity-edit-lead">Something to correct? <a class="entity-edit" href="https://github.com/concordance-wiki/demo-glossary/edit/main/keyword-page.md">Edit this page</a></span></p>',
    );
    expect(screen?.content).toContain(
      '<a class="entity-edit" href="https://gitlab.com/concordance-wiki/demo-specs/-/edit/develop/screens/mentions-panel.md">',
    );
  });
});
