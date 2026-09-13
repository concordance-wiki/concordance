import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { galleryTheme } from "../../src/gallery/fixtures.js";
import { chromeOf, writeThemeAssets } from "../../src/theme/chrome.js";
import type { ResolvedThemeConfig } from "../../src/theme/load.js";

const source = memoryFileSystem({
  "/p/favicon.svg": "<svg/>",
  "/p/static/fonts/a.woff2": "font bytes",
});

const bare: ResolvedThemeConfig = {
  config: { ...galleryTheme, name: "Pipeline notes" },
  file: "/p/theme.yaml",
  fileSystem: source,
  assets: [],
};

const full: ResolvedThemeConfig = {
  config: {
    ...galleryTheme,
    name: "Pipeline notes",
    footer: {
      text: "Kept by the maintainers.",
      links: [{ label: "Forge", url: "https://forge.example/pipeline" }],
      credit: true,
    },
  },
  file: "/p/theme.yaml",
  fileSystem: source,
  logo: { path: "/p/mark.svg", file: "mark.svg", svg: "<svg></svg>" },
  favicon: { path: "/p/favicon.svg", file: "favicon.svg" },
  stylesheet: { path: "/p/site.css", content: ".site-header { border: 0 }\n" },
  assets: [
    { path: "/p/favicon.svg", file: "favicon.svg" },
    { path: "/p/static/fonts/a.woff2", file: "fonts/a.woff2" },
  ],
};

describe("chromeOf", () => {
  it("gives the name, the tool's stylesheet and no credit for a theme with nothing else", () => {
    expect(chromeOf(bare, "../assets/")).toEqual({
      siteTitle: "Pipeline notes",
      stylesheets: ["../assets/site.css"],
      footer: { credit: false },
    });
  });

  it("inlines an SVG logo, links the favicon and the project stylesheet after the tool's, and maps the footer", () => {
    expect(chromeOf(full, "assets/")).toEqual({
      siteTitle: "Pipeline notes",
      logo: { svg: "<svg></svg>" },
      favicon: "assets/favicon.svg",
      stylesheets: ["assets/site.css", "assets/project.css"],
      footer: {
        text: "Kept by the maintainers.",
        links: [{ label: "Forge", href: "https://forge.example/pipeline" }],
        credit: true,
      },
    });
  });

  it("links an image logo from the assets folder with an empty alt, the name following it as text", () => {
    const image: ResolvedThemeConfig = { ...bare, logo: { path: "/p/mark.png", file: "mark.png" } };
    expect(chromeOf(image, "../assets/").logo).toEqual({ src: "../assets/mark.png", alt: "" });
  });
});

describe("writeThemeAssets", () => {
  it("writes the tool's stylesheet alone for a theme without stylesheet or assets", () => {
    const fileSystem = memoryFileSystem();
    expect(writeThemeAssets(bare, fileSystem, "/out/assets")).toEqual(["site.css"]);
    expect(fileSystem.readText("/out/assets/site.css")).toContain(
      "@layer tokens, base, components, project;",
    );
  });

  it("writes the project stylesheet in its layer, copies every asset from the theme's file system and lists the files sorted", () => {
    const fileSystem = memoryFileSystem();
    expect(writeThemeAssets(full, fileSystem, "/out/assets")).toEqual([
      "favicon.svg",
      "fonts/a.woff2",
      "project.css",
      "site.css",
    ]);
    expect(fileSystem.readText("/out/assets/project.css")).toBe(
      "@layer project {\n.site-header { border: 0 }\n}\n",
    );
    expect(fileSystem.readText("/out/assets/fonts/a.woff2")).toBe("font bytes");
    expect(fileSystem.readText("/out/assets/favicon.svg")).toBe("<svg/>");
  });
});
