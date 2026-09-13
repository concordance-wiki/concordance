import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { importPlugin, loadPlugins, memoryFileSystem } from "@concordance-wiki/core";
import { h, type JSX } from "preact";
import { beforeAll, describe, expect, it } from "vitest";

import { buildGallery, GALLERY_PAGE_BUDGET, type GalleryReport } from "../../src/gallery/build.js";
import { galleryTheme } from "../../src/gallery/fixtures.js";
import { galleryPages } from "../../src/gallery/pages.js";
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
        ...report.budget.islands.map((island) => `assets/${island.file}`),
      ].sort(),
    );
    expect(report.budget.islands.map((island) => island.name)).toEqual([
      "contract-viewer",
      "document-viewer",
      "mentions-panel",
      "mode-switch",
      "search",
    ]);
    expect(fileSystem.readText("/out/assets/site.css")).toContain(
      "@layer tokens, base, components, project;",
    );
  });

  it("lists every slot in the index with one link per state and a note for the chrome slots", () => {
    const html = fileSystem.readText("/out/index.html");
    expect(html).toContain("<h1>Component gallery</h1>");
    for (const slot of SLOT_NAMES) {
      expect(html).toContain(`<h2 id="slot-${slot.toLowerCase()}">${slot}</h2>`);
    }
    for (const page of galleryPages) {
      expect(html).toContain(`<a href="${page.file}">${page.state}</a>: ${page.description}`);
    }
    expect(count(html, "<li>default: shown on every page of the gallery</li>")).toBe(3);
    expect(count(html, "Rendered by the default theme.")).toBe(SLOT_NAMES.length);
    expect(html).toContain("<code>data-mode=&quot;dark&quot;</code>");
    expect(html).toContain("The labels are those of the default theme.");
    expectBalanced(html);
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
    expect(empty).toContain('<p class="empty">No note links here.</p>');
    expect(empty).not.toContain("mentions-panel-");
    const island = fileSystem.readText("/out/mentions-panel-island.html");
    expect(count(island, '<li class="mention')).toBe(20);
    expect(count(island, '<details class="mention-group"')).toBe(8);
    expect(island).toContain('<concordance-island data-island="mentions-panel"');
    expect(island).toContain('<script type="application/json" id="mentions-embedded">');
    expect(island).toMatch(
      /<script type="module" defer src="assets\/mentions-panel-[A-Z0-9]{8}\.js"><\/script>/,
    );
    expect(fileSystem.readText("/out/shell-rtl.html")).toContain('<html lang="ar" dir="rtl">');
    expect(fileSystem.readText("/out/header-logo.html")).toContain('<img class="site-logo"');
    expect(fileSystem.readText("/out/footer-text.html")).toContain(
      "Documentation of the build pipeline, kept by its maintainers.",
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
      expect.stringMatching(/^island contract-viewer: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island document-viewer: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island mentions-panel: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island mode-switch: \d+\.\d kB$/) as string,
      expect.stringMatching(/^island search: \d+\.\d kB$/) as string,
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
      '<h2 id="slot-footer">Footer</h2><p class="gallery-provenance">Overridden by plugin <code>@concordance-wiki/fixture-plugin-theme-example</code>, theme <code>example</code>.</p>',
    );
    expect(count(index, "Rendered by the default theme.")).toBe(SLOT_NAMES.length - 1);
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
      "light muted text: muted on bg is 2.58:1, below 4.5:1",
      "light muted text: muted on surface is 2.81:1, below 4.5:1",
    ]);
    expect(report.summary.slice(-3)).toEqual([
      "contrast: 2 pairs below the minimum",
      "warning: contrast: light muted text: muted on bg is 2.58:1, below 4.5:1",
      "warning: contrast: light muted text: muted on surface is 2.81:1, below 4.5:1",
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
