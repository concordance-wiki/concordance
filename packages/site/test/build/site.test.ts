import { memoryFileSystem, pagePath } from "@concordance-wiki/core";
import { beforeAll, describe, expect, it } from "vitest";

import {
  fragmentPath,
  HOME_PAGE,
  INDEX_PAGE,
  mentionsFragmentPath,
  SEARCH_INDEX,
  TODO_PAGE,
} from "../../src/build/paths.js";
import {
  buildSite,
  SITE_PAGE_BUDGET,
  siteDocuments,
  type SiteOptions,
  type SiteReport,
} from "../../src/build/site.js";
import type { IslandBundle } from "../../src/islands/bundle.js";
import { defaultTheme } from "../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../src/theme/types.js";
import { count, expectBalanced } from "../helpers/html.js";
import { localTargets, references } from "../helpers/links.js";
import { fragments, model, profile, term } from "./fixture.js";

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

/** The entities of the fixture model that another note cites: those whose mentions fragment the build writes. */
const cited = ["framing/vision", "glossary/keyword-page", "glossary/page"];

describe("concordance render reads model.json and writes dist/: one HTML page per entity and per keyword, the JSON fragments, the search index, the previews and the static assets", () => {
  let fileSystem: ReturnType<typeof memoryFileSystem>;
  let report: SiteReport;

  beforeAll(async () => {
    ({ fileSystem, report } = await build());
  });

  it("writes the home, the index, the to-do page, one page per entity and per keyword, the search index and the assets", () => {
    const entities = model().entities.map((entity) => pagePath(entity.id));
    expect(fileSystem.listFiles("/dist")).toEqual(
      [
        HOME_PAGE,
        INDEX_PAGE,
        TODO_PAGE,
        SEARCH_INDEX,
        ...entities,
        ...cited.map(mentionsFragmentPath),
        "assets/site.css",
        ...report.budget.islands.map((island) => `assets/${island.file}`),
      ].sort(),
    );

    expect(report.files).toEqual(fileSystem.listFiles("/dist"));
    expect(report.pages.map((page) => page.path)).toEqual(
      [HOME_PAGE, ...entities, INDEX_PAGE, TODO_PAGE].sort(),
    );
    expect(report.budget.islands.map((island) => island.name)).toEqual([
      "mentions-panel",
      "mode-switch",
    ]);
  });

  it("writes the search index placeholder with one entry per page, keyword pages typed as such", () => {
    const index = JSON.parse(fileSystem.readText(`/dist/${SEARCH_INDEX}`)) as {
      entries: { id: string; title: string; type: string; url: string }[];
    };
    expect(index.entries).toHaveLength(7);
    expect(index.entries.find((entry) => entry.id === "keywords/build-summary")).toEqual({
      id: "keywords/build-summary",
      title: "build summary",
      type: "keyword",
      url: "keywords/build-summary/index.html",
    });
    expect(index.entries.find((entry) => entry.id === "glossary/keyword-page")?.type).toBe("term");
  });

  it("renders a typed entity through the entity page and a keyword through the keyword page, both complete documents", () => {
    const entity = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(entity.startsWith('<!doctype html>\n<html lang="en" dir="ltr">')).toBe(true);
    expect(entity).toContain("<title>Keyword page – Concordance notes</title>");
    expect(entity).toContain('<div class="entity">');
    expect(entity).toContain("<h1>Keyword page</h1>");
    expect(entity).toContain('<article class="entity-body">');
    expect(entity).toContain('<span class="badge">Term</span>');
    expect(entity).toContain("<p>An entity page.</p>");
    const keyword = fileSystem.readText("/dist/keywords/build-summary/index.html");
    expect(keyword).toContain('<article class="keyword">');
    expect(keyword).toContain("<h1>build summary</h1>");
    const rule = fileSystem.readText("/dist/specs/rules/publication-threshold/index.html");
    expect(rule.startsWith('<!doctype html>\n<html lang="fr" dir="ltr">')).toBe(true);
    for (const page of report.pages) {
      expectBalanced(fileSystem.readText(`/dist/${page.path}`));
    }
  });

  it("writes the project name as the site title, the index and to-do links with the count in the header, and no credit without a theme", () => {
    const home = fileSystem.readText(`/dist/${HOME_PAGE}`);
    expect(home).toContain("<title>Concordance notes</title>");
    expect(home).toContain('<a class="site-title" href="index.html">Concordance notes</a>');
    expect(home).toContain('<a href="index/index.html">Index</a>');
    expect(home).toContain('<a href="todo/index.html">To do<span class="count">5</span></a>');
    expect(home).not.toContain("Built with");
    expect(home).toContain("version 0.1.0");
    expect(home).toContain('<time datetime="2026-09-12T12:00:00.000Z">');
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
    expect(html).toContain('<script type="module" defer src="../../../assets/mode-switch-');
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
    expect(keyword).toContain("<q>the build summary is printed</q>");
    const index = withoutJavaScript(fileSystem.readText(`/dist/${INDEX_PAGE}`));
    expect(count(index, '<li class="index-entry">')).toBe(7);
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
    expect(report.summary[0]).toBe("site: 10 pages written to /dist");
    expect(report.summary.filter((line) => line.startsWith("island "))).toHaveLength(2);
    expect(
      report.summary.some((line) => /^pages: 10, largest \d+\.\d kB, budget 150\.0 kB$/.test(line)),
    ).toBe(true);
    expect(report.summary).toContain("accessibility: 0 findings");
    expect(report.summary).toContain("contrast: 0 pairs below the minimum");
  });

  it("warns about a page over the budget without failing the build", async () => {
    const { report, fileSystem } = await build({ maxPageBytes: 5_000 });
    expect(report.warnings).toContain("glossary/keyword-page/index.html: over budget");
    expect(fileSystem.exists("/dist/glossary/keyword-page/index.html")).toBe(true);
    expect(report.summary.some((line) => line.endsWith("over budget"))).toBe(true);
  });
});

describe("One mentions fragment per entity, never a global index", () => {
  it("writes fragments/<id>.mentions.json for every entity another note cites, holding all its mentions with hrefs relative to its page", async () => {
    const { fileSystem } = await build();
    const written = fileSystem.listFiles("/dist").filter((file) => file.endsWith(".mentions.json"));
    expect(written).toEqual(cited.map(mentionsFragmentPath));
    const fragment = JSON.parse(
      fileSystem.readText(`/dist/${mentionsFragmentPath("glossary/keyword-page")}`),
    ) as { id: string; mentions: unknown[] };
    expect(fragment.id).toBe("glossary/keyword-page");
    expect(fragment.mentions).toHaveLength(5);
    const page = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    for (const mention of fragment.mentions as { href: string; context: string }[]) {
      expect(page).toContain(`href="${mention.href}"`);
    }
    expect(page).toContain(
      "lists the <mark>keyword page</mark>s that cite the entity, grouped by file",
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
    expect(count(page, '<li class="mention')).toBe(20);
    expect(page).not.toContain('id="mentions-embedded"');
    expect(page).toContain('href="../../fragments/glossary/keyword-page.mentions.json"');
    expect(report.warnings).toEqual([]);
  });
});

describe("Without JavaScript, the first twenty mentions remain readable and the links work", () => {
  it("keeps the inline mentions, their file and passage links and the link to the fragment once scripts are removed, every target written", async () => {
    const { fileSystem } = await build({ mentionsInline: 3 });
    const path = "glossary/keyword-page/index.html";
    const html = fileSystem.readText(`/dist/${path}`).replace(/<script[\s\S]*?<\/script>/g, "");
    expect(html).not.toContain("<script");
    expect(count(html, '<li class="mention')).toBe(3);
    expect(html).toContain('<span class="mention-file">rules/publication-threshold.md</span>');
    expect(html).toContain(
      '<a class="mention-passage" href="../../specs/rules/publication-threshold/index.html#L1">line 1</a>',
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
      return count(fileSystem.readText(`/dist/${page}`), '<li class="mention');
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
    expect(home).toContain('<a href="index/index.html">Index</a>');
    expect(home).toContain('<a href="todo/index.html">À faire<span class="count">5</span></a>');
    expect(home).toContain(">Domaines</a>");
    expect(home).toContain(">Types</a>");
    expect(home).toContain(">Applications</a>");
    expect(home).toContain('<html lang="fr"');
    const entity = fileSystem.readText("/dist/glossary/keyword-page/index.html");
    expect(entity).toContain('<span class="badge">Terme</span>');
    expect(entity).toContain('<html lang="en"');
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
  ];

  it("renders the same documents as the build, in a fixed order, from the bundles it is given", () => {
    const documents = siteDocuments(options(), bundles);
    expect(documents.map((document) => document.path)).toEqual([
      HOME_PAGE,
      INDEX_PAGE,
      TODO_PAGE,
      ...model().entities.map((entity) => pagePath(entity.id)),
      SEARCH_INDEX,
      ...cited.map(mentionsFragmentPath),
    ]);
  });

  it("passes the mentions_inline, the edit link pattern and the names of the configuration to the pages", () => {
    const [home, , , , entity] = siteDocuments(
      options({
        mentionsInline: 1,
        editUrl: "https://forge.example/{source}/{path}",
        names: { domains: { publication: "Publication" } },
      }),
      bundles,
    );
    expect(count(entity?.content ?? "", '<li class="mention')).toBe(1);
    expect(entity?.content).toContain(
      '<a class="entity-edit" href="https://forge.example/glossary/keyword-page.md">',
    );
    expect(home?.content).toContain(">Publication</a>");
  });

  it("links the edit page of the forge from the source URL of the model and the declared refs when no pattern is configured", () => {
    const withForge = model();
    withForge.build.sources = [
      { name: "glossary", url: "https://github.com/concordance-wiki/demo-glossary.git" },
      { name: "specs", url: "https://gitlab.com/concordance-wiki/demo-specs" },
      { name: "framing" },
    ];
    const [, , , , entity, , , , , screen] = siteDocuments(
      options({ model: withForge, sourceRefs: { specs: "develop" } }),
      bundles,
    );
    expect(entity?.content).toContain(
      '<p class="entity-source">source: <code>glossary/keyword-page.md</code><a class="entity-edit" href="https://github.com/concordance-wiki/demo-glossary/edit/main/keyword-page.md">Edit in the forge</a></p>',
    );
    expect(screen?.content).toContain(
      '<a class="entity-edit" href="https://gitlab.com/concordance-wiki/demo-specs/-/edit/develop/screens/mentions-panel.md">',
    );
  });
});
