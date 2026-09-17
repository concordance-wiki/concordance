import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseTheme } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  checkContrast,
  contrastPairs,
  contrastRatio,
  relativeLuminance,
  type ColourScheme,
  type ContrastPair,
} from "../../src/a11y/contrast.js";
import { defaultThemeConfig } from "../../src/build/default-theme.js";
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

describe("contrasts: measured by the checker on both palettes, no text under 4.5:1, the light grounds included", () => {
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
      inkOnBg: 15.75,
      mutedOnBg: 8.46,
      labelOnSurface: 5.58,
      accentOnBg: 6.14,
      inkOnHighlight: 10.67,
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

describe("dark mode: a second palette measured on its own, never an inversion of the light one", () => {
  const { light, dark } = PALETTES.default;
  const shipped = defaultThemeConfig("Concordance");

  it("ships the dark palette of the reference design in the brand file and in the default theme alike", () => {
    expect(paletteColours(dark)).toEqual({
      bg: "#0F1113",
      surface: "#181B1E",
      soft: "#22262A",
      border: "#282C31",
      ink: "#ECEAE6",
      muted: "#A8AEB6",
      label: "#8D939B",
      accent: "#E8703A",
      highlight: "#4A2A1B",
    });
    expect(shipped.dark).toEqual(dark);
    expect(shipped.light).toEqual(light);
  });

  it("shares no colour with the light palette: the ground goes under the surface in both, the soft ground between them in light and above the surface in dark", () => {
    const lightColours = new Set(Object.values(paletteColours(light)));
    for (const colour of Object.values(paletteColours(dark))) {
      expect(lightColours.has(colour), colour).toBe(false);
    }
    const order = (scheme: ColourScheme): PaletteColour[] =>
      (["bg", "surface", "soft"] as const).toSorted(
        (a, b) =>
          relativeLuminance(paletteColours(PALETTES.default[scheme])[a]) -
          relativeLuminance(paletteColours(PALETTES.default[scheme])[b]),
      );
    expect(order("light")).toEqual(["bg", "soft", "surface"]);
    expect(order("dark")).toEqual(["bg", "surface", "soft"]);
  });

  it("raises the accent in lightness, #E8703A instead of #A8431C, so that a link holds 4.5:1 over every dark ground", () => {
    expect(light.accent).toBe("#A8431C");
    expect(dark.accent).toBe("#E8703A");
    expect(relativeLuminance(dark.accent)).toBeGreaterThan(relativeLuminance(light.accent));
    const links = textPairs(PALETTES.default).filter(
      (pair) => pair.scheme === "dark" && pair.use === "link",
    );
    expect(links.map((pair) => [pair.background, pair.ratio])).toEqual([
      ["bg", 6.14],
      ["surface", 5.61],
      ["soft", 4.94],
    ]);
  });

  it("pins every dark ratio the checker measures, none deduced from the light scheme, and finds none under its minimum", () => {
    const measured = contrastPairs(PALETTES.default)
      .filter((pair) => pair.scheme === "dark")
      .map((pair) => `${pair.use} ${pair.foreground} on ${pair.background} ${String(pair.ratio)}`);
    expect(measured).toEqual([
      "body ink on bg 15.75",
      "body ink on surface 14.39",
      "body ink on soft 12.68",
      "muted muted on bg 8.46",
      "muted muted on surface 7.74",
      "muted muted on soft 6.81",
      "label label on bg 6.11",
      "label label on surface 5.58",
      "label label on soft 4.92",
      "link accent on bg 6.14",
      "link accent on surface 5.61",
      "link accent on soft 4.94",
      "mark ink on highlight 10.67",
      "heading ink on bg 15.75",
      "heading ink on surface 14.39",
      "heading ink on soft 12.68",
      "focus accent on bg 6.14",
      "focus accent on surface 5.61",
      "focus accent on soft 4.94",
    ]);
    const keptAccent: ThemeConfig = {
      ...PALETTES.default,
      dark: { ...dark, accent: light.accent },
    };
    expect(checkContrast(keptAccent).map((finding) => finding.message)).toEqual([
      "dark link text: accent on bg is 3.14:1, below 4.5:1",
      "dark link text: accent on surface is 2.87:1, below 4.5:1",
      "dark link text: accent on soft is 2.53:1, below 4.5:1",
      "dark focus text: accent on surface is 2.87:1, below 3:1",
      "dark focus text: accent on soft is 2.53:1, below 3:1",
    ]);
  });
});
