import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  ageNoticeOf,
  NOT_FOUND_PAGE,
  notFoundBase,
  notFoundOf,
  repositoryHrefOf,
  sitePathOf,
} from "../../src/build/not-found.js";
import { siteDocuments, type SiteInput } from "../../src/build/site.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import { fragments, model, profile, tokenize } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}) {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

const bundles = [
  { name: "age", file: "age-00000000.js", bytes: 0 },
  { name: "mentions-panel", file: "mentions-panel-00000000.js", bytes: 0 },
  { name: "mode-switch", file: "mode-switch-00000000.js", bytes: 0 },
  { name: "not-found", file: "not-found-00000000.js", bytes: 0 },
  { name: "panels", file: "panels-00000000.js", bytes: 0 },
  { name: "pins", file: "pins-00000000.js", bytes: 0 },
  { name: "search", file: "search-00000000.js", bytes: 0 },
  { name: "toc", file: "toc-00000000.js", bytes: 0 },
];

function input(overrides: Partial<SiteInput> = {}): SiteInput {
  return {
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

function pageOf(overrides: Partial<SiteInput>, path: string): string {
  const { documents } = siteDocuments(input(overrides), bundles);
  return documents.find((document) => document.path === path)?.content ?? "";
}

describe("The page served for a missing address", () => {
  it("stands at the root of the site, where the hosts of static sites look for it", () => {
    expect(NOT_FOUND_PAGE).toBe("404.html");
  });

  it("names its own address as its base from the published address of the site, the root of the host without one", () => {
    expect(sitePathOf(undefined)).toBe("/");
    expect(sitePathOf("https://example.org")).toBe("/");
    expect(sitePathOf("https://example.org/handbook")).toBe("/handbook/");
    expect(sitePathOf("https://example.org/handbook/")).toBe("/handbook/");
    expect(notFoundBase(undefined)).toBe("/404.html");
    expect(notFoundBase("https://example.org/handbook")).toBe("/handbook/404.html");
  });

  it("words the cause, what stays reachable and the two exits in the site language, the hrefs from the root", () => {
    expect(notFoundOf(context())).toEqual({
      label: "Page not found",
      title: "This address matches no page of the last publication.",
      cause:
        "The file may have been renamed or moved, or its word fell under the publication threshold. The content stays in the repository and its text stays searchable.",
      nearbyLabel: "Nearby addresses",
      searchHref: "search/index.html",
      searchLabel: "Search the documentation",
      searchQueryLabel: "Search “{query}”",
      browse: { label: "Browse the spaces", href: "spaces/index.html" },
      root: "",
    });
    expect(notFoundOf(context({ catalogue: loadCatalogue("fr") }))).toMatchObject({
      label: "Page introuvable",
      title: "Cette adresse ne correspond à aucune page de la dernière publication.",
      searchQueryLabel: "Chercher « {query} »",
      browse: { label: "Parcourir les espaces", href: "spaces/index.html" },
    });
  });

  it("is written by the site with the chrome of every page, its base, its island and its title, hidden nearby addresses and the two exits", () => {
    const html = pageOf({ siteUrl: "https://example.org/handbook" }, NOT_FOUND_PAGE);
    expect(html).toContain('<base href="/handbook/404.html"/>');
    expect(html).toContain("<title>Page not found – Concordance notes</title>");
    expect(html).toContain('<link rel="stylesheet" href="assets/site.css"/>');
    expect(html).toContain('<script defer src="assets/not-found-00000000.js"></script>');
    expect(html).toContain('<header class="site-header">');
    expect(html).toContain('<footer class="site-footer">');
    expect(html).toContain(
      '<main id="main"><div class="not-found"><p class="section-label">Page not found</p><h1>This address matches no page of the last publication.</h1><p class="not-found-cause">',
    );
    expect(html).toContain(
      '<section class="not-found-nearby" aria-labelledby="not-found-nearby" hidden><h2 id="not-found-nearby" class="section-label">Nearby addresses</h2><ul></ul></section>',
    );
    expect(html).toContain(
      '<p class="not-found-exits"><a class="button-primary" href="search/index.html">Search the documentation</a><a class="button-secondary" href="spaces/index.html">Browse the spaces</a></p>',
    );
    expect(pageOf({}, NOT_FOUND_PAGE)).toContain('<base href="/404.html"/>');
  });
});

describe("The notice on the age of the site", () => {
  it("links the repository of the first source with an address, in name order, and nothing without one", () => {
    expect(repositoryHrefOf(context())).toBeUndefined();
    const sources = [
      { name: "specs", url: "https://forge.example/specs.git" },
      { name: "glossary", url: "https://forge.example/glossary" },
      { name: "framing" },
    ];
    expect(
      repositoryHrefOf(context({ model: model({ build: { ...model().build, sources } }) })),
    ).toBe("https://forge.example/glossary");
  });

  it("carries the publication instant, the cadence worded, the exits and the plural forms of the days", () => {
    expect(ageNoticeOf(context(), "glossary/page/index.html", 1)).toEqual({
      publishedAt: "2026-09-12T12:00:00.000Z",
      everyDays: 1,
      locale: "en",
      sourcesHref: "../../spaces/index.html",
      labels: {
        notice: "Notice",
        published: {
          one: "This version was published # day ago.",
          other: "This version was published # days ago.",
        },
        cadence: "Publications are declared daily in the configuration.",
        missing: "A recent change of the repositories may therefore be missing here.",
        sources: "See the sources and their versions",
        or: "or",
        repositories: "consult the repositories directly",
        close: "Close this notice",
      },
    });
    const weekly = ageNoticeOf(
      context({
        catalogue: loadCatalogue("fr"),
        model: model({
          build: {
            ...model().build,
            sources: [{ name: "glossary", url: "https://forge.example/glossary" }],
          },
        }),
      }),
      "index.html",
      7,
    );
    expect(weekly.labels.cadence).toBe(
      "Les publications sont annoncées tous les 7 jours dans la configuration.",
    );
    expect(weekly.repositoryHref).toBe("https://forge.example/glossary");
    expect(weekly.sourcesHref).toBe("spaces/index.html");
    expect(weekly.labels.published).toEqual({
      many: "Cette version a été publiée il y a # jours.",
      one: "Cette version a été publiée il y a # jour.",
      other: "Cette version a été publiée il y a # jours.",
    });
  });

  it("stands hidden between the bar and the page on every page when the site declares its cadence, and nowhere without", () => {
    const html = pageOf({ publishEveryDays: 1 }, "glossary/page/index.html");
    expect(html).toContain(
      '</header><concordance-island data-island="age" data-props="{&quot;publishedAt&quot;:&quot;2026-09-12T12:00:00.000Z&quot;,&quot;everyDays&quot;:1,',
    );
    expect(html).toContain('<aside class="age-notice" aria-label="Notice" hidden>');
    expect(html).toContain('<script defer src="../../assets/age-00000000.js"></script>');
    expect(pageOf({ publishEveryDays: 1 }, "index.html")).toContain('<aside class="age-notice"');
    expect(pageOf({ publishEveryDays: 1 }, NOT_FOUND_PAGE)).toContain('<aside class="age-notice"');
    const silent = pageOf({}, "glossary/page/index.html");
    expect(silent).not.toContain("age-notice");
    expect(silent).not.toContain("age-00000000.js");
  });
});
