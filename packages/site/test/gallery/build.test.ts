import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { importPlugin, loadPlugins, memoryFileSystem } from "@concordance-wiki/core";
import { h, type JSX } from "preact";
import { beforeAll, describe, expect, it } from "vitest";

import { fontFiles } from "../../src/css/fonts.js";
import { buildGallery, GALLERY_PAGE_BUDGET, type GalleryReport } from "../../src/gallery/build.js";
import { GALLERY_BOARDS } from "../../src/gallery/boards.js";
import { galleryTheme } from "../../src/gallery/fixtures.js";
import { galleryPages } from "../../src/gallery/pages.js";
import { MODE_SCRIPT } from "../../src/mode.js";
import { PANELS_SCRIPT } from "../../src/panels.js";
import { SLOT_NAMES } from "../../src/slots.js";
import { defaultComponents } from "../../src/theme/default/index.js";
import { importThemeModule } from "../../src/theme/node-loader.js";
import { defaultTheme, resolveTheme } from "../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../src/theme/types.js";
import { count, expectBalanced } from "../helpers/html.js";

const root = resolve(fileURLToPath(import.meta.url), "../../../../..");
const fixturePlugin = pathToFileURL(resolve(root, "fixtures/plugins/theme-example/index.mjs")).href;

async function build(theme: ResolvedTheme = defaultTheme, maxPageBytes = GALLERY_PAGE_BUDGET) {
  const fileSystem = memoryFileSystem();
  const report = await buildGallery({ output: "/out", theme, fileSystem, maxPageBytes });
  return { fileSystem, report };
}

describe("A concordance gallery command renders every slot with fixture view models into a static page set", () => {
  let fileSystem: ReturnType<typeof memoryFileSystem>;
  let report: GalleryReport;

  beforeAll(async () => {
    ({ fileSystem, report } = await build());
  });

  it("writes one page per gallery entry, the index, the stylesheet and the island bundles", () => {
    const files = fileSystem.listFiles("/out");
    expect(files).toEqual(
      [
        ...galleryPages.map((page) => page.file),
        "index.html",
        "assets/site.css",
        ...fontFiles().map((file) => `assets/fonts/${file}`),
        ...report.budget.islands.map((island) => `assets/${island.file}`),
      ].sort(),
    );
    expect(report.budget.islands.map((island) => island.name)).toEqual([
      "category-list",
      "contract-viewer",
      "document-viewer",
      "gallery-width",
      "mentions-panel",
      "mode-switch",
      "panels",
      "pins",
      "search",
      "tabs",
      "toc",
    ]);
    expect(fileSystem.readText("/out/assets/site.css")).toContain(
      "@layer tokens, base, components, project;",
    );
  });

  it("groups the states of the index by board in the order of the boards, each with its caption, its width, its frame and the screen note of its board", () => {
    const html = fileSystem.readText("/out/index.html");
    expect(html).toContain("<h1>Component gallery</h1>");
    const headings = [...html.matchAll(/<h2 id="board-([a-z0-9]+)">([^<]+)<\/h2>/g)].map(
      (match) => [match[1], match[2]],
    );
    expect(headings).toEqual(
      GALLERY_BOARDS.map((board) => [
        board.id.toLowerCase(),
        board.id.startsWith("B") ? `${board.id} · ${board.title}` : board.title,
      ]),
    );
    expect(html).toContain(
      '<h2 id="board-b1">B1 · Home</h2><p class="gallery-board-caption">Two ways into a corpus: a word in the search field, or a space among the rows. <a href="https://concordance-wiki.github.io/demo-wiki/specs/screens/pages/home/">Screen note</a></p>',
    );
    expect(html).toContain(
      '<h2 id="board-b4">B4 · Accessibility</h2><p class="gallery-board-caption">No state of its own: every state of the gallery passes the accessibility audit and the contrast check of the command.</p></section><section',
    );
    const states = [
      ...html.matchAll(/<article class="gallery-state" aria-labelledby="state-([a-z0-9-]+)">/g),
    ].map((match) => `${match[1] ?? ""}.html`);
    expect(states).toEqual(galleryPages.map((page) => page.file));
    for (const page of galleryPages) {
      const width = page.width ?? 1440;
      const height = { 390: 844, 834: 1194, 1440: 900 }[width];
      const title = `${page.slot}, ${page.state}`;
      expect(html).toContain(
        `<h3 id="state-${page.file.slice(0, -5)}"><a href="${page.file}">${title}</a></h3><p class="gallery-caption">${page.description}</p><p class="gallery-meta"><span class="gallery-width-value">${String(width)} px</span> · <span class="gallery-provenance">Rendered by the default theme.</span></p><div class="gallery-stage"><iframe class="gallery-frame" src="${page.file}" width="${String(width)}" height="${String(height)}" loading="lazy" title="${title}"></iframe></div>`,
      );
    }
    expect(count(html, ' width="390"')).toBe(2);
    expect(count(html, ' width="834"')).toBe(1);
    expect(count(html, ' width="1440"')).toBe(galleryPages.length - 3);
    expect(html).toContain("<code>data-mode=&quot;dark&quot;</code>");
    expect(html).toContain("The labels are those of the default theme.");
    expect(html).not.toMatch(/design file|reference-design/);
    expectBalanced(html);
  });

  it("offers the width switch as a classic island served hidden, and lists every slot with who renders it", () => {
    const html = fileSystem.readText("/out/index.html");
    expect(html).toContain(
      '<concordance-island data-island="gallery-width" data-props="{&quot;label&quot;:&quot;Width of the frames&quot;,&quot;widths&quot;:[390,834,1440]}"><div class="gallery-widths" role="group" aria-label="Width of the frames" hidden><button type="button" class="gallery-width" data-width="390" aria-pressed="false">390 px</button><button type="button" class="gallery-width" data-width="834" aria-pressed="false">834 px</button><button type="button" class="gallery-width" data-width="1440" aria-pressed="false">1440 px</button></div></concordance-island>',
    );
    expect(html).toMatch(/<script defer src="assets\/gallery-width-[A-Z0-9]{8}\.js"><\/script>/);
    for (const page of galleryPages) {
      expect(fileSystem.readText(`/out/${page.file}`)).not.toContain("gallery-width");
    }
    expect(html).toContain('<h2 id="gallery-slots">Slots</h2>');
    for (const slot of SLOT_NAMES) {
      expect(html).toContain(
        `<li id="slot-${slot.toLowerCase()}">${slot}: <span class="gallery-provenance">Rendered by the default theme.</span>`,
      );
    }
    expect(count(html, " Seen on every page of the gallery.</li>")).toBe(3);
    expect(count(html, "Rendered by the default theme.")).toBe(
      SLOT_NAMES.length + galleryPages.length,
    );
  });

  it("renders every page through the theme with the stylesheet and the fixture chrome", () => {
    for (const page of galleryPages) {
      const html = fileSystem.readText(`/out/${page.file}`);
      expect(html.startsWith("<!doctype html>\n<html lang=")).toBe(true);
      expect(html).toContain('<link rel="stylesheet" href="assets/site.css"');
      expect(html).toContain('<main id="main">');
      expect(html).toContain(`<title>${page.slot}, ${page.state}</title>`);
      expectBalanced(html);
    }
  });

  it("shows the states: an empty mentions list, more than twenty mentions behind the island, a right-to-left page", () => {
    const empty = fileSystem.readText("/out/mentions-panel-empty.html");
    expect(empty).toContain('<p class="empty">No other page evokes this one yet.</p>');
    expect(empty).not.toContain("mentions-panel-");
    const island = fileSystem.readText("/out/mentions-panel-island.html");
    expect(count(island, '<li class="related-page')).toBe(7);
    expect(island).toContain(
      '<h2 id="mentions-title">Related pages <span class="count">9</span></h2>',
    );
    expect(island).toContain('<concordance-island data-island="mentions-panel"');
    expect(island).toContain('<script type="application/json" id="mentions-embedded">');
    expect(island).toMatch(/<script defer src="assets\/mentions-panel-[A-Z0-9]{8}\.js"><\/script>/);
    expect(fileSystem.readText("/out/shell-rtl.html")).toContain('<html lang="ar" dir="rtl">');
    expect(fileSystem.readText("/out/header-logo.html")).toContain('<img class="site-logo"');
    expect(fileSystem.readText("/out/footer-text.html")).toContain(
      "Documentation of the build pipeline, kept by its maintainers.",
    );
  });

  it("serves a no-script state with its island elements and without their scripts, the boot script of the colour scheme kept", () => {
    const noScript = galleryPages.filter((page) => page.scripts === false);
    expect(noScript.map((page) => page.file)).toEqual([
      "home-no-script.html",
      "entity-page-no-script.html",
      "search-results-no-script.html",
      "keyword-page-no-script.html",
      "meeting-page-no-script.html",
      "api-page-no-script.html",
      "document-page-no-script.html",
      "entity-page-panel-folded.html",
    ]);
    for (const page of noScript) {
      const html = fileSystem.readText(`/out/${page.file}`);
      expect(html, page.file).not.toMatch(/<script [^>]*src=/);
      expect(html, page.file).not.toContain("modulepreload");
      expect(html, page.file).toContain("<script>(function(){");
      expect(html, page.file).toContain("<concordance-island data-island=");
      expect(page.description.startsWith("server HTML only: "), page.file).toBe(true);
    }
    expect(fileSystem.readText("/out/api-page-no-script.html")).toContain("Contract data (JSON)");
    expect(fileSystem.readText("/out/api-page-corporate.html")).toMatch(
      /<script defer src="assets\/contract-viewer-[A-Z0-9]{8}\.js"><\/script>/,
    );
  });

  it("serves the states of the dark board with the dark scheme forced on the root, no boot script overriding it, the one of the panels kept, the switch still bundled", () => {
    for (const file of ["entity-page-dark.html", "home-dark.html"]) {
      const html = fileSystem.readText(`/out/${file}`);
      expect(html, file).toContain('<html lang="en" dir="ltr" data-mode="dark"><head>');
      expect(html, file).not.toContain(MODE_SCRIPT);
      expect(html, file).toContain(`<script>${PANELS_SCRIPT}</script>`);
      expect(html, file).toMatch(
        /<script defer src="assets\/mode-switch-[A-Z0-9]{8}\.js"><\/script>/,
      );
      expect(html, file).toContain(
        '<button type="button" class="mode-switch" aria-pressed="false" title="Dark mode" hidden>',
      );
    }
    expect(fileSystem.readText("/out/entity-page-corporate.html")).toContain(
      '<html lang="en" dir="ltr"><head>',
    );
    const css = fileSystem.readText("/out/assets/site.css");
    expect(css).toContain(
      ':root[data-mode="dark"] {\n  color-scheme: dark;\n  --scheme: dark;\n  --color-bg: #0F1113;',
    );
  });

  it("frames the panels under a heading so that each page carries one h1", () => {
    const html = fileSystem.readText("/out/neighbourhood.html");
    expect(html).toContain('<div class="gallery-panel"><h1>Neighbourhood, default</h1>');
    expect(html).toContain('<section class="neighbourhood"');
    expect(count(html, "<h1>")).toBe(1);
  });

  it("reports every page sorted by path with its size and no problem", () => {
    expect(report.pages.map((page) => page.path)).toEqual(
      [...galleryPages.map((page) => page.file), "index.html"].sort(),
    );
    for (const page of report.pages) {
      expect(page.bytes).toBe(Buffer.byteLength(fileSystem.readText(`/out/${page.path}`)));
    }
    expect(report.problems).toEqual([]);
    expect(report.overrides).toEqual([]);
    expect(report.summary).toEqual([
      `gallery: ${String(galleryPages.length + 1)} pages written to /out`,
      expect.stringMatching(/^island category-list: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island contract-viewer: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island document-viewer: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island gallery-width: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island mentions-panel: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island mode-switch: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island panels: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island pins: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island search: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island tabs: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island toc: \d+\.\d kB$/) as string,
      expect.stringMatching(
        new RegExp(
          `^pages: ${String(galleryPages.length + 1)}, largest \\d+\\.\\d kB, budget 150\\.0 kB$`,
        ),
      ) as string,
      "accessibility: 0 findings",
      "contrast: 0 pairs below the minimum",
    ]);
    expect(report.contrast).toEqual([]);
  });

  it("gives the same bytes from one build to the next", async () => {
    const again = await build();
    expect(again.report).toEqual(report);
    for (const file of fileSystem.listFiles("/out")) {
      expect(again.fileSystem.readText(`/out/${file}`)).toBe(fileSystem.readText(`/out/${file}`));
    }
  });
});

describe("Every theme override is visible there", () => {
  it("renders the overridden slot on every page and names the plugin and theme in the index", async () => {
    const { registry } = await loadPlugins([fixturePlugin], {
      load: importPlugin,
      commandAvailable: () => Promise.resolve(true),
    });
    const theme = await resolveTheme(registry, { load: importThemeModule });
    const { fileSystem, report } = await build(theme);
    expect(report.overrides).toEqual([
      {
        slot: "Footer",
        plugin: "@concordance-wiki/fixture-plugin-theme-example",
        theme: "example",
      },
    ]);
    expect(report.summary[1]).toBe(
      "override Footer: plugin @concordance-wiki/fixture-plugin-theme-example, theme example",
    );
    const index = fileSystem.readText("/out/index.html");
    expect(index).toContain(
      '<li id="slot-footer">Footer: <span class="gallery-provenance">Overridden by plugin <code>@concordance-wiki/fixture-plugin-theme-example</code>, theme <code>example</code>.</span> Seen on every page of the gallery.</li>',
    );
    expect(index).toContain(
      '<span class="gallery-width-value">1440 px</span> · <span class="gallery-provenance">Overridden by plugin <code>@concordance-wiki/fixture-plugin-theme-example</code>, theme <code>example</code>.</span>',
    );
    expect(count(index, "Rendered by the default theme.")).toBe(
      SLOT_NAMES.length - 1 + galleryPages.filter((page) => page.slot !== "Footer").length,
    );
    for (const file of fileSystem.listFiles("/out").filter((path) => path.endsWith(".html"))) {
      expect(fileSystem.readText(`/out/${file}`)).toContain("example theme, version 0.1.0");
    }
    expect(report.problems).toEqual([]);
  });
});

describe("The gallery is built in CI and its pages pass the accessibility checks", () => {
  it("finds no accessibility finding on any page of the default theme", async () => {
    const { report } = await build();
    for (const page of report.pages) {
      expect(page.findings, page.path).toEqual([]);
    }
  });

  it("turns an accessibility finding of an overriding component into a problem naming the page and the rule", async () => {
    const Footer = (): JSX.Element => h("footer", null, h("a", { href: "nowhere" }));
    const theme: ResolvedTheme = {
      components: { ...defaultComponents, Footer },
      overrides: [{ slot: "Footer", plugin: "@example/theme", theme: "broken" }],
    };
    const { report } = await build(theme);
    expect(report.problems).toEqual(
      report.pages.map((page) => `${page.path}: link-text: <a href="nowhere"> has no text`),
    );
    expect(report.summary.at(-2)).toBe(
      `accessibility: ${String(galleryPages.length + 1)} findings`,
    );
  });

  it("warns in the summary about a palette whose text falls under the contrast minimum, without failing", async () => {
    const fileSystem = memoryFileSystem();
    const report = await buildGallery({
      output: "/out",
      theme: {
        ...defaultTheme,
        config: {
          config: { ...galleryTheme, light: { ...galleryTheme.light, muted: "#9A9A9A" } },
          file: "/theme.yaml",
          fileSystem,
          assets: [],
        },
      },
      fileSystem,
    });
    expect(report.contrast.map((finding) => finding.message)).toEqual([
      "light muted text: muted on bg is 2.41:1, below 4.5:1",
      "light muted text: muted on surface is 2.81:1, below 4.5:1",
      "light muted text: muted on soft is 2.60:1, below 4.5:1",
    ]);
    expect(report.summary.slice(-4)).toEqual([
      "contrast: 3 pairs below the minimum",
      "warning: contrast: light muted text: muted on bg is 2.41:1, below 4.5:1",
      "warning: contrast: light muted text: muted on surface is 2.81:1, below 4.5:1",
      "warning: contrast: light muted text: muted on soft is 2.60:1, below 4.5:1",
    ]);
    expect(report.problems).toEqual([]);
    expect(fileSystem.readText("/out/assets/site.css")).toContain("--color-muted: #9A9A9A;");
  });

  it("keeps every page under the budget and turns an exceeded budget into a problem", async () => {
    const report = await buildGallery({
      output: "/out",
      theme: defaultTheme,
      fileSystem: memoryFileSystem(),
    });
    expect(report.budget.maxPageBytes).toBe(GALLERY_PAGE_BUDGET);
    expect(report.budget.overBudget).toEqual([]);
    const tight = await build(defaultTheme, 1);
    expect(tight.report.problems).toEqual(
      tight.report.pages.map((page) => `${page.path}: over budget`),
    );
    expect(tight.report.budget.summary.at(-1)).toMatch(/ over budget$/);
  });

  it("is a step of the continuous integration workflow that publishes the pages as an artifact", () => {
    const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("gallery --output reports/gallery");
    expect(workflow).toContain("path: reports/gallery");
  });
});
