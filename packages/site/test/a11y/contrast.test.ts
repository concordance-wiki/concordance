import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import {
  CONTRAST_MINIMUMS,
  checkContrast,
  contrastPairs,
  contrastRatio,
  relativeLuminance,
  type ContrastUse,
} from "../../src/a11y/contrast.js";
import type { ThemeConfig } from "../../src/css/theme-config.js";
import { tokensStylesheet } from "../../src/css/tokens.js";
import { galleryTheme } from "../../src/gallery/fixtures.js";

const root = resolve(fileURLToPath(import.meta.url), "../../../../..");
// The brand tokens are the default palette of a project; the file is validated by the theme schema elsewhere.
const brand = parse(readFileSync(resolve(root, "brand/theme.yaml"), "utf8")) as ThemeConfig;

/** The six colours of one scheme as the generated stylesheet declares them. */
function declared(theme: ThemeConfig, scheme: "light" | "dark"): Record<string, string> {
  const css = tokensStylesheet(theme);
  const block =
    scheme === "light"
      ? css.slice(0, css.indexOf("@media"))
      : css.slice(css.indexOf('[data-mode="dark"]'));
  return Object.fromEntries(
    [...block.matchAll(/--color-([a-z]+): (#[0-9A-F]{6});/g)].map((match) => [
      match[1] ?? "",
      match[2] ?? "",
    ]),
  );
}

describe("Minimum contrast of 4.5:1 for body text, 3:1 for headings", () => {
  it("computes the relative luminance and the contrast ratio of the WCAG definition", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#FFFFFF")).toBe(1);
    expect(relativeLuminance("#ff0000")).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance("#0A0A0A")).toBeCloseTo(0.003035, 6);
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    expect(contrastRatio("#FFFFFF", "#000000")).toBe(21);
    expect(contrastRatio("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
    expect(() => relativeLuminance("red")).toThrow(
      "relativeLuminance: red is not a #RRGGBB colour",
    );
  });

  it("asks 4.5:1 of body, muted and link text and 3:1 of headings and the focus ring", () => {
    expect(CONTRAST_MINIMUMS).toEqual({ body: 4.5, muted: 4.5, link: 4.5, heading: 3, focus: 3 });
  });

  it("lists every text and background pair of both schemes with its ratio and minimum", () => {
    const pairs = contrastPairs(brand);
    expect(pairs).toHaveLength(20);
    expect(pairs.slice(0, 4)).toEqual([
      {
        scheme: "light",
        use: "body",
        foreground: "ink",
        background: "bg",
        ratio: 16.32,
        minimum: 4.5,
      },
      {
        scheme: "light",
        use: "body",
        foreground: "ink",
        background: "surface",
        ratio: 17.79,
        minimum: 4.5,
      },
      {
        scheme: "light",
        use: "muted",
        foreground: "muted",
        background: "bg",
        ratio: 7.2,
        minimum: 4.5,
      },
      {
        scheme: "light",
        use: "muted",
        foreground: "muted",
        background: "surface",
        ratio: 7.85,
        minimum: 4.5,
      },
    ]);
    expect(pairs.filter((pair) => pair.scheme === "dark")).toHaveLength(10);
  });

  it("gives the default palette at least 4.5:1 for body, muted and link text on both surfaces of both schemes, as the stylesheet declares them", () => {
    for (const scheme of ["light", "dark"] as const) {
      const colours = declared(brand, scheme);
      expect(colours).toEqual({ ...brand[scheme] });
      for (const [use, foreground] of [
        ["body", "ink"],
        ["muted", "muted"],
        ["link", "accent"],
      ] as const) {
        for (const background of ["bg", "surface"] as const) {
          const ratio = contrastRatio(colours[foreground] ?? "", colours[background] ?? "");
          expect(ratio, `${scheme} ${use} ${foreground} on ${background}`).toBeGreaterThanOrEqual(
            4.5,
          );
        }
      }
    }
  });

  it("gives the default palette at least 3:1 for headings and the focus ring on both surfaces of both schemes", () => {
    for (const scheme of ["light", "dark"] as const) {
      const colours = declared(brand, scheme);
      for (const foreground of ["ink", "accent"] as const) {
        for (const background of ["bg", "surface"] as const) {
          const ratio = contrastRatio(colours[foreground] ?? "", colours[background] ?? "");
          expect(ratio, `${scheme} ${foreground} on ${background}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("passes the brand palette and the gallery palette, which are the same colours", () => {
    expect(checkContrast(brand)).toEqual([]);
    expect(galleryTheme.light).toEqual(brand.light);
    expect(galleryTheme.dark).toEqual(brand.dark);
  });

  it("names every pair below its minimum with the scheme, the use, the colours and the ratio", () => {
    const pale: ThemeConfig = {
      ...brand,
      light: { ...brand.light, muted: "#9A9A9A", accent: "#C24E24" },
      dark: { ...brand.dark, ink: "#4A4A4A" },
    };
    const findings = checkContrast(pale);
    expect(findings.map((finding) => finding.message)).toEqual([
      "light muted text: muted on bg is 2.58:1, below 4.5:1",
      "light muted text: muted on surface is 2.81:1, below 4.5:1",
      "light link text: accent on bg is 4.37:1, below 4.5:1",
      "dark body text: ink on bg is 2.16:1, below 4.5:1",
      "dark body text: ink on surface is 2.01:1, below 4.5:1",
      "dark heading text: ink on bg is 2.16:1, below 3:1",
      "dark heading text: ink on surface is 2.01:1, below 3:1",
    ]);
    const uses = findings.map((finding) => finding.pair.use);
    expect(uses).toEqual(["muted", "muted", "link", "body", "body", "heading", "heading"]);
    const use: ContrastUse = findings[0]?.pair.use ?? "body";
    expect(findings[0]?.pair).toEqual({
      scheme: "light",
      use,
      foreground: "muted",
      background: "bg",
      ratio: 2.58,
      minimum: 4.5,
    });
  });
});
