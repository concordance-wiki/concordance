import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { importPlugin, loadPlugins, memoryFileSystem } from "@concordance-wiki/core";
import { beforeAll, describe, expect, it } from "vitest";

import { buildGallery, type GalleryReport } from "../../src/gallery/build.js";
import { galleryPages } from "../../src/gallery/pages.js";
import { loadTheme } from "../../src/theme/load.js";
import { importThemeModule, packageDirectoryOf } from "../../src/theme/node-loader.js";
import { defaultTheme, resolveTheme } from "../../src/theme/resolve.js";
import type { ResolvedTheme } from "../../src/theme/types.js";
import { count, expectBalanced } from "../helpers/html.js";

const root = resolve(fileURLToPath(import.meta.url), "../../../../..");
const fixture = resolve(root, "fixtures/plugins/theme-white-label");

async function whiteLabelTheme(): Promise<ResolvedTheme> {
  const { registry } = await loadPlugins([pathToFileURL(resolve(fixture, "index.mjs")).href], {
    load: importPlugin,
    commandAvailable: () => Promise.resolve(true),
  });
  return resolveTheme(registry, {
    load: importThemeModule,
    rootOf: (plugin) => packageDirectoryOf(plugin),
  });
}

async function build(theme: ResolvedTheme) {
  const fileSystem = memoryFileSystem();
  const report = await buildGallery({ output: "/out", theme, fileSystem });
  const pages = new Map(
    fileSystem
      .listFiles("/out")
      .filter((file) => file.endsWith(".html"))
      .map((file) => [file, fileSystem.readText(`/out/${file}`)]),
  );
  return { fileSystem, report, pages };
}

/** The text a reader sees: tags removed, entities left as they are. */
function visibleText(html: string): string {
  return html.replace(/<script>.*?<\/script>/gs, "").replace(/<[^>]+>/g, " ");
}

/** Every URL the page or stylesheet would fetch: linked, scripted, embedded or imported resources. */
function fetched(html: string): string[] {
  return [
    ...html.matchAll(
      /<(?:link|script|img|iframe|source|video|audio)\b[^>]*\b(?:href|src)="([^"]+)"/g,
    ),
  ].map((match) => match[1] ?? "");
}

describe("the gallery renders the white-label fixture theme with --theme", () => {
  let theme: ResolvedTheme;
  let built: Awaited<ReturnType<typeof build>>;
  let report: GalleryReport;

  beforeAll(async () => {
    theme = await whiteLabelTheme();
    built = await build(theme);
    ({ report } = built);
  });

  it("carries the name of the fixture in the title and the header of every page, with its inline logo and favicon", () => {
    // The package is reached through node_modules: its path may be the real one rather than the fixture's.
    expect(theme.config?.file.endsWith("/theme-white-label/theme/theme.yaml")).toBe(true);
    for (const page of galleryPages) {
      const html = built.pages.get(page.file) ?? "";
      expect(html, page.file).toContain(
        `<title>${page.slot}, ${page.state} – Pipeline notes</title>`,
      );
      expect(html, page.file).toContain(
        '<a class="site-title" href="../"><span class="site-logo" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"',
      );
      expect(html, page.file).toContain('fill="currentColor"');
      expect(html, page.file).toContain("</svg></span>Pipeline notes</a>");
      expect(html, page.file).toContain(
        '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"/>',
      );
      expect(html, page.file).not.toContain('href="../">My wiki</a>');
      expectBalanced(html);
    }
    expect(built.pages.get("index.html")).toContain(
      "<title>Component gallery – Pipeline notes</title>",
    );
  });

  it("writes the palette, radius and font families of the fixture in the tokens layer", () => {
    const css = built.fileSystem.readText("/out/assets/site.css");
    expect(css).toContain("  --color-accent: #1F5FA8;");
    expect(css).toContain("  --color-bg: #0F1419;");
    expect(css).toContain("  --radius: 2px;");
    expect(css).toContain('  --font-display: "Pipeline Serif", Georgia');
    expect(css).toContain('  --font-ui: "Pipeline Sans", system-ui');
    expect(css).toContain('  --font-mono: "Pipeline Mono", ui-monospace');
  });

  it("links the project stylesheet after the tool's own, its rules in the project layer declared last, and copies the assets", () => {
    const files = built.fileSystem.listFiles("/out/assets");
    expect(files).toContain("project.css");
    expect(files).toContain("favicon.svg");
    expect(files).toContain("icons/stage.svg");
    const site = built.fileSystem.readText("/out/assets/site.css");
    const project = built.fileSystem.readText("/out/assets/project.css");
    expect(site.startsWith("@layer tokens, base, components, project;\n")).toBe(true);
    expect(site).not.toContain("@layer project {");
    expect(project.startsWith("@layer project {\n")).toBe(true);
    expect(project).toContain("@font-face");
    expect(project).toContain(".site-header {\n  border-block-end-width: 3px;\n}");
    for (const [file, html] of built.pages) {
      const own = html.indexOf('<link rel="stylesheet" href="assets/site.css"/>');
      const extra = html.indexOf('<link rel="stylesheet" href="assets/project.css"/>');
      expect(own, file).toBeGreaterThan(0);
      expect(extra, file).toBeGreaterThan(own);
    }
  });

  it("mentions the tool nowhere a reader can see when the credit is off, and shows the footer of the fixture", () => {
    for (const [file, html] of built.pages) {
      expect(visibleText(html), file).not.toMatch(/concordance/i);
      expect(html, file).not.toMatch(/href="[^"]*concordance/i);
      expect(html, file).not.toContain("site-footer-credit");
      expect(html, file).toContain(
        '<p class="site-footer-text">Notes on the build pipeline, kept by the maintainers of the wiki.</p>',
      );
      expect(html, file).toContain(
        '<a href="https://forge.example/pipeline">Pipeline repository</a>',
      );
    }
  });

  it("names the theme in the summary, passes the accessibility and contrast checks and gives the same bytes twice", async () => {
    expect(report.summary[1]).toBe(`theme: Pipeline notes, from ${theme.config?.file ?? ""}`);
    expect(report.summary.at(-1)).toBe("contrast: 0 pairs below the minimum");
    expect(report.contrast).toEqual([]);
    expect(report.overrides).toEqual([]);
    expect(report.problems).toEqual([]);
    const again = await build(theme);
    expect(again.report).toEqual(report);
    for (const file of built.fileSystem.listFiles("/out")) {
      expect(again.fileSystem.readText(`/out/${file}`), file).toBe(
        built.fileSystem.readText(`/out/${file}`),
      );
    }
  });
});

describe("a project theme without a logo", () => {
  it("shows the name alone in the header and links neither favicon nor project stylesheet", async () => {
    const fileSystem = memoryFileSystem({
      "/p/theme.yaml": [
        "name: Pipeline notes",
        "light: { bg: '#F4F7FB', surface: '#FFFFFF', border: '#D5DCE6', ink: '#101820', muted: '#4A5566', accent: '#1F5FA8' }",
        "dark: { bg: '#0F1419', surface: '#171E26', border: '#2A3441', ink: '#E6EBF2', muted: '#9AA7B8', accent: '#8FB8F0' }",
        "footer: { credit: true }",
        "",
      ].join("\n"),
    });
    const loaded = loadTheme(fileSystem, "/p/theme.yaml");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const { pages, report } = await build({ ...defaultTheme, config: loaded.theme });
    const logo = pages.get("header-logo.html") ?? "";
    expect(logo).toContain('<a class="site-title" href="../">Pipeline notes</a>');
    expect(logo).not.toContain("site-logo");
    expect(logo).not.toContain('rel="icon"');
    expect(logo).not.toContain("project.css");
    expect(logo).toContain(
      '<p class="site-footer-credit"><a href="https://github.com/concordance-wiki/concordance">Built with Concordance</a></p>',
    );
    expect(report.problems).toEqual([]);
  });
});

describe("no external request is ever emitted by the default theme", () => {
  it("fetches nothing from another host on any page or stylesheet, with or without a project theme", async () => {
    const themes = [defaultTheme, await whiteLabelTheme()];
    for (const theme of themes) {
      const { fileSystem, pages } = await build(theme);
      for (const [file, html] of pages) {
        const urls = fetched(html);
        expect(urls.length, file).toBeGreaterThan(0);
        expect(
          urls.filter((url) => /^(https?:)?\/\//i.test(url)),
          file,
        ).toEqual([]);
        expect(count(html, "<script>"), file).toBe(1);
      }
      for (const file of fileSystem
        .listFiles("/out/assets")
        .filter((name) => name.endsWith(".css"))) {
        const css = fileSystem.readText(`/out/assets/${file}`);
        expect(css, file).not.toMatch(/url\(\s*["']?(https?:)?\/\//i);
        expect(css, file).not.toContain("@import");
      }
    }
  });
});
