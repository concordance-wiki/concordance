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
import { paletteColours, tokensStylesheet } from "../../src/css/tokens.js";
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

  it("asks 4.5:1 of body, muted, label and link text and of a marked passage, 3:1 of headings and the focus ring", () => {
    expect(CONTRAST_MINIMUMS).toEqual({
      body: 4.5,
      muted: 4.5,
      label: 4.5,
      link: 4.5,
      mark: 4.5,
      heading: 3,
      focus: 3,
    });
  });

  it("lists every text and background pair of both schemes with its ratio and minimum: the page, a surface and a soft surface, and the highlight of a mark", () => {
    const pairs = contrastPairs(brand);
    expect(pairs).toHaveLength(38);
    expect(pairs.slice(0, 3)).toEqual([
      {
        scheme: "light",
        use: "body",
        foreground: "ink",
        background: "bg",
        ratio: 13.8,
        minimum: 4.5,
      },
      {
        scheme: "light",
        use: "body",
        foreground: "ink",
        background: "surface",
        ratio: 16.14,
        minimum: 4.5,
      },
      {
        scheme: "light",
        use: "body",
        foreground: "ink",
        background: "soft",
        ratio: 14.93,
        minimum: 4.5,
      },
    ]);
    expect(pairs.filter((pair) => pair.use === "mark")).toEqual([
      {
        scheme: "light",
        use: "mark",
        foreground: "ink",
        background: "highlight",
        ratio: 13.09,
        minimum: 4.5,
      },
      {
        scheme: "dark",
        use: "mark",
        foreground: "ink",
        background: "highlight",
        ratio: 10.67,
        minimum: 4.5,
      },
    ]);
    expect(pairs.filter((pair) => pair.scheme === "dark")).toHaveLength(19);
  });

  it("derives the soft, label and highlight colours of a theme that declares none, so that its pairs are those of bg, muted and border", () => {
    const { label, soft, highlight, ...six } = brand.light;
    expect([label, soft, highlight].every((colour) => colour !== undefined)).toBe(true);
    const pairs = contrastPairs({ ...brand, light: six });
    const light = pairs.filter((pair) => pair.scheme === "light");
    expect(light.find((pair) => pair.use === "label" && pair.background === "soft")?.ratio).toBe(
      Math.round(contrastRatio(six.muted, six.bg) * 100) / 100,
    );
    expect(light.find((pair) => pair.use === "mark")?.ratio).toBe(
      Math.round(contrastRatio(six.ink, six.border) * 100) / 100,
    );
  });

  /** The measured contrasts of both palettes of the default theme, pinned: a change of colour is a change of these numbers. */
  it("pins the measured contrasts of the default theme: body text at least 11:1, secondary text 6:1, the lightest labels 4.5:1, nothing under 4.5:1 in either palette", () => {
    const ratios = (scheme: "light" | "dark", use: ContrastUse): number[] =>
      contrastPairs(brand)
        .filter((pair) => pair.scheme === scheme && pair.use === use)
        .map((pair) => pair.ratio);
    expect(ratios("light", "body")).toEqual([13.8, 16.14, 14.93]);
    expect(ratios("light", "muted")).toEqual([9.2, 10.76, 9.95]);
    expect(ratios("light", "label")).toEqual([4.52, 5.28, 4.89]);
    expect(ratios("light", "link")).toEqual([5.15, 6.03, 5.58]);
    expect(ratios("dark", "body")).toEqual([15.75, 14.39, 12.68]);
    expect(ratios("dark", "muted")).toEqual([8.46, 7.74, 6.81]);
    expect(ratios("dark", "label")).toEqual([6.11, 5.58, 4.92]);
    expect(ratios("dark", "link")).toEqual([6.14, 5.61, 4.94]);
    for (const scheme of ["light", "dark"] as const) {
      const colours = declared(brand, scheme);
      expect(colours).toEqual(paletteColours(brand[scheme]));
      for (const ratio of ratios(scheme, "body")) expect(ratio).toBeGreaterThanOrEqual(11);
      for (const ratio of ratios(scheme, "muted")) expect(ratio).toBeGreaterThanOrEqual(6);
      for (const ratio of ratios(scheme, "label")) expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    for (const pair of contrastPairs(brand)) {
      expect(pair.ratio, `${pair.scheme} ${pair.use}`).toBeGreaterThanOrEqual(4.5);
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
      light: { ...brand.light, muted: "#9A9A9A", label: "#9A9A9A", accent: "#C24E24" },
      dark: { ...brand.dark, ink: "#4A4A4A" },
    };
    const findings = checkContrast(pale);
    expect(findings.map((finding) => finding.message)).toEqual([
      "light muted text: muted on bg is 2.41:1, below 4.5:1",
      "light muted text: muted on surface is 2.81:1, below 4.5:1",
      "light muted text: muted on soft is 2.60:1, below 4.5:1",
      "light label text: label on bg is 2.41:1, below 4.5:1",
      "light label text: label on surface is 2.81:1, below 4.5:1",
      "light label text: label on soft is 2.60:1, below 4.5:1",
      "light link text: accent on bg is 4.07:1, below 4.5:1",
      "light link text: accent on soft is 4.41:1, below 4.5:1",
      "dark body text: ink on bg is 2.13:1, below 4.5:1",
      "dark body text: ink on surface is 1.95:1, below 4.5:1",
      "dark body text: ink on soft is 1.72:1, below 4.5:1",
      "dark mark text: ink on highlight is 1.45:1, below 4.5:1",
      "dark heading text: ink on bg is 2.13:1, below 3:1",
      "dark heading text: ink on surface is 1.95:1, below 3:1",
      "dark heading text: ink on soft is 1.72:1, below 3:1",
    ]);
    const use: ContrastUse = findings[0]?.pair.use ?? "body";
    expect(findings[0]?.pair).toEqual({
      scheme: "light",
      use,
      foreground: "muted",
      background: "bg",
      ratio: 2.41,
      minimum: 4.5,
    });
  });
});
