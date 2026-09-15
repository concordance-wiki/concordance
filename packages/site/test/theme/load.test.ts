import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { memoryFileSystem, nodeFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { loadTheme } from "../../src/theme/load.js";

const root = resolve(fileURLToPath(import.meta.url), "../../../../..");

const palette =
  "{ bg: '#F4F7FB', surface: '#FFFFFF', border: '#D5DCE6', ink: '#101820', muted: '#4A5566', accent: '#1F5FA8' }";

function theme(extra = ""): string {
  return `name: Pipeline notes\nlight: ${palette}\ndark: ${palette}\n${extra}`;
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';

describe("The project name, logo, accent colour, corner radius and font families come from theme.yaml, validated by schemas/theme.schema.json", () => {
  it("reads and validates the file and resolves its paths against it", () => {
    const fileSystem = memoryFileSystem({
      "/project/brand/theme.yaml": theme(
        "logo: img/mark.png\nfavicon: img/favicon.svg\nstylesheet: css/site.css\nassets: static\nradius: 2\nfont: { display: Pipeline Serif }\n",
      ),
      "/project/brand/img/mark.png": "png",
      "/project/brand/img/favicon.svg": svg,
      "/project/brand/css/site.css": ".site-header { border: 0 }\n",
      "/project/brand/static/fonts/b.woff2": "b",
      "/project/brand/static/fonts/a.woff2": "a",
    });
    const result = loadTheme(fileSystem, "/project/brand/theme.yaml");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.issues).toEqual([]);
      expect(result.theme.file).toBe("/project/brand/theme.yaml");
      expect(result.theme.fileSystem).toBe(fileSystem);
      expect(result.theme.config.name).toBe("Pipeline notes");
      expect(result.theme.config.radius).toBe(2);
      expect(result.theme.config.font?.display).toBe("Pipeline Serif");
      expect(result.theme.logo).toEqual({ path: "/project/brand/img/mark.png", file: "mark.png" });
      expect(result.theme.favicon).toEqual({
        path: "/project/brand/img/favicon.svg",
        file: "favicon.svg",
      });
      expect(result.theme.stylesheet).toEqual({
        path: "/project/brand/css/site.css",
        content: ".site-header { border: 0 }\n",
      });
      expect(result.theme.assets).toEqual([
        { path: "/project/brand/img/favicon.svg", file: "favicon.svg" },
        { path: "/project/brand/static/fonts/a.woff2", file: "fonts/a.woff2" },
        { path: "/project/brand/static/fonts/b.woff2", file: "fonts/b.woff2" },
        { path: "/project/brand/img/mark.png", file: "mark.png" },
      ]);
    }
  });

  it("inlines an SVG logo without its XML prolog and comments, and copies nothing for it", () => {
    const fileSystem = memoryFileSystem({
      "/t/theme.yaml": theme("logo: mark.svg\n"),
      "/t/mark.svg": `<?xml version="1.0"?>\n<!-- the mark -->\n${svg}\n`,
    });
    const result = loadTheme(fileSystem, "/t/theme.yaml");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.theme.logo).toEqual({ path: "/t/mark.svg", file: "mark.svg", svg });
      expect(result.theme.assets).toEqual([]);
    }
  });

  it("reports schema errors with the path of the key, like the configuration", () => {
    const fileSystem = memoryFileSystem({
      "/t/theme.yaml": theme("radius: -1\nfooter: { mention_tool: true }\n"),
    });
    const result = loadTheme(fileSystem, "/t/theme.yaml");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "radius",
        message: "must be >= 0",
        received: -1,
      },
      {
        severity: "error",
        path: "footer.mention_tool",
        message: "unknown key",
        expected: "one of the documented keys",
      },
    ]);
  });

  it("reports a missing theme file, and YAML that cannot be parsed", () => {
    expect(loadTheme(memoryFileSystem(), "/t/theme.yaml")).toEqual({
      ok: false,
      missing: true,
      issues: [
        { severity: "error", path: "", message: "theme file not found", received: "/t/theme.yaml" },
      ],
    });
    const result = loadTheme(
      memoryFileSystem({ "/t/theme.yaml": "name: [oops\n" }),
      "/t/theme.yaml",
    );
    expect(result.ok).toBe(false);
    expect("missing" in result).toBe(false);
    expect(result.issues[0]?.message).toMatch(/^not valid YAML: /);
  });

  it("reports every file the theme names and cannot find, with the key and the path as written", () => {
    const fileSystem = memoryFileSystem({
      "/t/theme.yaml": theme(
        "logo: mark.svg\nfavicon: icon.svg\nstylesheet: site.css\nassets: static\n",
      ),
    });
    const result = loadTheme(fileSystem, "/t/theme.yaml");
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      ["logo", "favicon", "stylesheet", "assets"].map((key, index) => ({
        severity: "error",
        path: key,
        message: "file not found",
        received: ["mark.svg", "icon.svg", "site.css", "static"][index],
        expected: "a path relative to /t",
      })),
    );
  });

  it("refuses an SVG logo file without an svg element", () => {
    const fileSystem = memoryFileSystem({
      "/t/theme.yaml": theme("logo: mark.svg\n"),
      "/t/mark.svg": "<html></html>",
    });
    expect(loadTheme(fileSystem, "/t/theme.yaml").issues).toEqual([
      {
        severity: "error",
        path: "logo",
        message: "not an SVG document",
        received: "mark.svg",
        expected: "a file holding an <svg> element",
      },
    ]);
  });

  it("validates the label overrides against the shipped catalogues", () => {
    const fileSystem = memoryFileSystem({
      "/t/theme.yaml": theme("labels: { en: { 'site.nowhere': 'x' } }\n"),
    });
    const result = loadTheme(fileSystem, "/t/theme.yaml");
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(["labels.en.site.nowhere"]);
  });

  it("takes the stylesheet and assets of a plugin contribution, the file's own stylesheet winning", () => {
    const fileSystem = memoryFileSystem({
      "/p/theme.yaml": theme("stylesheet: own.css\nassets: static\n"),
      "/p/own.css": "own",
      "/p/plugin.css": "plugin",
      "/p/static/a.svg": "a",
      "/p/more/b.svg": "b",
      "/p/more/a.svg": "duplicate",
    });
    const both = loadTheme(fileSystem, "/p/theme.yaml", {
      stylesheet: "/p/plugin.css",
      assets: "/p/more",
    });
    expect(both.ok).toBe(true);
    if (both.ok) {
      expect(both.theme.stylesheet?.content).toBe("own");
      expect(both.theme.assets).toEqual([
        { path: "/p/static/a.svg", file: "a.svg" },
        { path: "/p/more/b.svg", file: "b.svg" },
      ]);
    }
    const bare = memoryFileSystem({ "/p/theme.yaml": theme(), "/p/plugin.css": "plugin" });
    const fromPlugin = loadTheme(bare, "/p/theme.yaml", { stylesheet: "/p/plugin.css" });
    expect(fromPlugin.ok && fromPlugin.theme.stylesheet?.content).toBe("plugin");
    const missing = loadTheme(bare, "/p/theme.yaml", {
      stylesheet: "/p/none.css",
      assets: "/p/none",
    });
    expect(missing.issues.map((issue) => [issue.path, issue.received])).toEqual([
      ["stylesheet", "/p/none.css"],
      ["assets", "/p/none"],
    ]);
  });

  it("loads the brand theme of the repository from the real file system, the mark inlined", () => {
    const result = loadTheme(nodeFileSystem, resolve(root, "brand/theme.yaml"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.theme.config.name).toBe("Concordance");
      expect(result.theme.logo?.svg?.startsWith("<svg")).toBe(true);
      expect(result.theme.favicon?.file).toBe("favicon.svg");
      expect(result.theme.assets.map((asset) => asset.file)).toEqual(["favicon.svg"]);
    }
  });
});
