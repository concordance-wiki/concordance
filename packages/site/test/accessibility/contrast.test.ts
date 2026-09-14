import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTheme } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  checkContrast,
  contrastPairs,
  contrastRatio,
  type ColourScheme,
  type ContrastPair,
} from "../../src/a11y/contrast.js";
import type { ThemeConfig } from "../../src/css/theme-config.js";
import { paletteColours, type PaletteColour } from "../../src/css/tokens.js";

const here = fileURLToPath(new URL(".", import.meta.url));

/** A `theme.yaml` read as the build reads it: the schema validates the file before a colour is measured. */
function themeFile(path: string): ThemeConfig {
  const parsed = parseTheme(readFileSync(path, "utf8"));
  if (!parsed.ok) {
    throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
  }
  return parsed.theme;
}

/** The two palettes verified: the default theme's, and the one of a project publishing its own documentation. */
const PALETTES: Readonly<Record<"default" | "project", ThemeConfig>> = {
  default: themeFile(resolve(here, "../../../../brand/theme.yaml")),
  project: themeFile(resolve(here, "project-theme.yaml")),
};

const BODY_MINIMUM = 4.5;

/** The five reference pairs of a palette, each rounded to two decimals as the checker reports them. */
function referenceRatios(
  theme: ThemeConfig,
  scheme: ColourScheme,
): Record<"inkOnBg" | "mutedOnBg" | "labelOnSurface" | "accentOnBg" | "inkOnHighlight", number> {
  const palette = paletteColours(theme[scheme]);
  const ratio = (foreground: PaletteColour, background: PaletteColour): number =>
    Math.round(contrastRatio(palette[foreground], palette[background]) * 100) / 100;
  return {
    inkOnBg: ratio("ink", "bg"),
    mutedOnBg: ratio("muted", "bg"),
    labelOnSurface: ratio("label", "surface"),
    accentOnBg: ratio("accent", "bg"),
    inkOnHighlight: ratio("ink", "highlight"),
  };
}

/** The text pairs read at body size: every use but the headings and the focus ring. */
function textPairs(theme: ThemeConfig): ContrastPair[] {
  return contrastPairs(theme).filter((pair) => pair.minimum === BODY_MINIMUM);
}

describe("L9-08 contrasts: measured by the checker on both palettes, no text under 4.5:1, the light grounds included", () => {
  for (const [name, theme] of Object.entries(PALETTES)) {
    it(`finds no pair below its minimum in the ${name} palette, light and dark`, () => {
      expect(checkContrast(theme)).toEqual([]);
    });

    it(`reads every text of the ${name} palette at 4.5:1 or more over the page, the surface, the soft ground and the highlight of a mark`, () => {
      const pairs = textPairs(theme);
      const grounds = new Set(pairs.map((pair) => pair.background));
      expect([...grounds].sort()).toEqual(["bg", "highlight", "soft", "surface"]);
      expect(pairs.filter((pair) => pair.background === "soft")).toHaveLength(8);
      expect(pairs.filter((pair) => pair.background === "highlight")).toHaveLength(2);
      for (const pair of pairs) {
        expect(
          pair.ratio,
          `${pair.scheme} ${pair.use}: ${pair.foreground} on ${pair.background}`,
        ).toBeGreaterThanOrEqual(BODY_MINIMUM);
      }
    });
  }

  it("pins the reference ratios of the default palette: ink, muted and accent on the page, label on a surface, ink on the highlight", () => {
    expect(referenceRatios(PALETTES.default, "light")).toEqual({
      inkOnBg: 13.8,
      mutedOnBg: 9.2,
      labelOnSurface: 5.28,
      accentOnBg: 5.15,
      inkOnHighlight: 13.09,
    });
    expect(referenceRatios(PALETTES.default, "dark")).toEqual({
      inkOnBg: 15.06,
      mutedOnBg: 10.27,
      labelOnSurface: 6.29,
      accentOnBg: 7.31,
      inkOnHighlight: 10.66,
    });
  });

  it("pins the same five ratios of the project palette, whose accent over the page is the closest pair of either palette", () => {
    expect(referenceRatios(PALETTES.project, "light")).toEqual({
      inkOnBg: 16.32,
      mutedOnBg: 9.87,
      labelOnSurface: 6.05,
      accentOnBg: 4.83,
      inkOnHighlight: 14.43,
    });
    expect(referenceRatios(PALETTES.project, "dark")).toEqual({
      inkOnBg: 15.38,
      mutedOnBg: 8.48,
      labelOnSurface: 5.6,
      accentOnBg: 6.22,
      inkOnHighlight: 10.28,
    });
    const lowest = (theme: ThemeConfig): number =>
      Math.min(...textPairs(theme).map((pair) => pair.ratio));
    expect(lowest(PALETTES.default)).toBe(4.52);
    expect(lowest(PALETTES.project)).toBe(4.63);
  });

  it("reports a project palette whose accent falls under 4.5:1 over the soft ground, the pair a theme author changes first", () => {
    const paler: ThemeConfig = {
      ...PALETTES.project,
      light: { ...PALETTES.project.light, accent: "#C24E24" },
    };
    expect(checkContrast(paler).map((finding) => finding.message)).toEqual([
      "light link text: accent on bg is 4.37:1, below 4.5:1",
      "light link text: accent on soft is 4.18:1, below 4.5:1",
    ]);
  });
});
