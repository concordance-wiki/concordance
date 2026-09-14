import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { FONT_FACES, fontFiles, readFontFile } from "../../src/css/fonts.js";
import {
  CSS_FILES,
  CSS_LAYERS,
  baseStylesheet,
  componentsStylesheet,
  projectStylesheet,
  siteStylesheet,
} from "../../src/css/stylesheet.js";
import type { ThemeConfig } from "../../src/css/theme-config.js";

const theme: ThemeConfig = {
  name: "Example",
  light: {
    bg: "#FFFFFF",
    surface: "#FFFFFF",
    border: "#DDDDDD",
    ink: "#111111",
    muted: "#555555",
    accent: "#0055AA",
  },
  dark: {
    bg: "#111111",
    surface: "#1A1A1A",
    border: "#333333",
    ink: "#EEEEEE",
    muted: "#AAAAAA",
    accent: "#66AAFF",
  },
};

describe("siteStylesheet", () => {
  it("declares the four cascade layers first, then fills the tool's three in that order", () => {
    const css = siteStylesheet({ theme });
    expect(CSS_LAYERS).toEqual(["tokens", "base", "components", "project"]);
    expect(css.startsWith("@layer tokens, base, components, project;\n")).toBe(true);
    const own = CSS_LAYERS.slice(0, 3);
    const positions = own.map((layer) => css.indexOf(`@layer ${layer} {`));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(css).not.toContain("@layer project {");
  });

  it("carries the colour scheme, the reduced-motion query and the island element rule", () => {
    const css = siteStylesheet({ theme });
    expect(css).toContain("color-scheme: light dark;");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("concordance-island {\n  display: block;\n}");
    expect(css).toContain(".skip-link");
    expect(css).toContain(":focus-visible");
  });

  it("wraps the project stylesheet in the project layer, declared last so that it wins every cascade", () => {
    expect(projectStylesheet(".site-header { background: red; }\n")).toBe(
      "@layer project {\n.site-header { background: red; }\n}\n",
    );
    const layers = siteStylesheet({ theme }).split("\n", 1)[0];
    expect(layers?.endsWith("project;")).toBe(true);
  });

  it("binds the shipped families with @font-face rules outside the layers, the files next to the stylesheet, and calls no font host", () => {
    const css = siteStylesheet({ theme });
    const faces = css.slice(css.indexOf("@font-face"), css.indexOf("@layer tokens {"));
    expect(FONT_FACES).toHaveLength(8);
    expect(FONT_FACES.map((face) => [face.family, face.style, face.weight])).toEqual([
      ["Instrument Sans", "normal", "400 700"],
      ["Instrument Sans", "normal", "400 700"],
      ["Instrument Sans", "italic", "400 700"],
      ["Instrument Sans", "italic", "400 700"],
      ["IBM Plex Mono", "normal", "400"],
      ["IBM Plex Mono", "normal", "400"],
      ["IBM Plex Mono", "normal", "500"],
      ["IBM Plex Mono", "normal", "500"],
    ]);
    expect(faces).toContain(
      '@font-face {\n  font-family: "Instrument Sans";\n  font-style: normal;\n  font-weight: 400 700;\n  font-display: swap;\n  src: url("fonts/instrument-sans-normal-400-700-latin.woff2") format("woff2");\n  unicode-range: U+0000-00FF,',
    );
    expect(faces).toContain(
      'src: url("fonts/ibm-plex-mono-normal-500-latin-ext.woff2") format("woff2");\n  unicode-range: U+0100-02BA,',
    );
    expect(faces.match(/@font-face/g)).toHaveLength(8);
    expect(css).not.toMatch(/https?:/);
    expect(fontFiles()).toEqual([...FONT_FACES.map((face) => face.file), "OFL.txt"]);
    for (const file of fontFiles()) {
      expect(readFontFile(file).byteLength, file).toBeGreaterThan(0);
    }
  });

  it("reads the base and components layers from the package assets", () => {
    expect(baseStylesheet()).toContain("box-sizing: border-box;");
    expect(componentsStylesheet()).toContain(".mentions-more");
    expect(componentsStylesheet()).not.toMatch(/style="/);
  });

  it("assembles each layer from its listed files, one per concept, in the listed order", () => {
    const assets = new URL("../../assets/css/", import.meta.url);
    const files = [...CSS_FILES.base, ...CSS_FILES.components];
    expect(new Set(files).size).toBe(files.length);
    const contents = files.map((file) => readFileSync(new URL(file, assets), "utf8"));
    for (const [index, content] of contents.entries()) {
      expect(content.endsWith("}\n"), files[index]).toBe(true);
      expect(content.endsWith("\n\n"), files[index]).toBe(false);
    }
    expect(baseStylesheet()).toBe(contents.slice(0, CSS_FILES.base.length).join("\n"));
    expect(componentsStylesheet()).toBe(contents.slice(CSS_FILES.base.length).join("\n"));
  });

  it("assembles the two layers into the very bytes of the sheets the files replaced", () => {
    const digest = (css: string): string => createHash("sha256").update(css).digest("hex");
    expect(digest(baseStylesheet())).toBe(
      "02b6181b31f87e19640a5b919866208bec9577581c89f25d32c3dcdf80df773b",
    );
    expect(digest(componentsStylesheet())).toBe(
      "307f63dd2710ab70b61379df0885bc0b780e21728cc8507d1473330469d1b9ab",
    );
  });
});
