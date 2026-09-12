import { describe, expect, it } from "vitest";

import {
  CSS_LAYERS,
  baseStylesheet,
  componentsStylesheet,
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
  it("declares the four cascade layers first, then fills them in that order", () => {
    const css = siteStylesheet({ theme, project: ".site-header { background: red; }" });
    expect(CSS_LAYERS).toEqual(["tokens", "base", "components", "project"]);
    expect(css.startsWith("@layer tokens, base, components, project;\n")).toBe(true);
    const positions = CSS_LAYERS.map((layer) => css.indexOf(`@layer ${layer} {`));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("puts the project stylesheet in the project layer, and leaves the layer empty without one", () => {
    const css = siteStylesheet({ theme, project: ".site-header { background: red; }\n" });
    expect(css).toContain("@layer project {\n.site-header { background: red; }\n}\n");
    expect(siteStylesheet({ theme })).not.toContain("@layer project {");
  });

  it("carries the colour scheme, the reduced-motion query and the island element rule", () => {
    const css = siteStylesheet({ theme });
    expect(css).toContain("color-scheme: light dark;");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("concordance-island {\n  display: block;\n}");
    expect(css).toContain(".skip-link");
    expect(css).toContain(":focus-visible");
  });

  it("reads the base and components layers from the package assets", () => {
    expect(baseStylesheet()).toContain("box-sizing: border-box;");
    expect(componentsStylesheet()).toContain(".mentions-more");
    expect(componentsStylesheet()).not.toMatch(/style="/);
  });
});
