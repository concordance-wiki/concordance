import type { ThemeConfig, ThemePalette } from "../css/theme-config.js";

export type ColourScheme = "light" | "dark";

/** What a pair of tokens is used for; each use has its own minimum ratio. */
export type ContrastUse = "body" | "muted" | "link" | "heading" | "focus";

export interface ContrastPair {
  scheme: ColourScheme;
  use: ContrastUse;
  foreground: keyof ThemePalette;
  background: keyof ThemePalette;
  /** Rounded to two decimals. */
  ratio: number;
  minimum: number;
}

export interface ContrastFinding {
  pair: ContrastPair;
  message: string;
}

const BODY_MINIMUM = 4.5;
const LARGE_MINIMUM = 3;

/** The minimum of each use: body, muted and link text are read at body size; headings and the focus ring are large or non-text. */
export const CONTRAST_MINIMUMS: Readonly<Record<ContrastUse, number>> = {
  body: BODY_MINIMUM,
  muted: BODY_MINIMUM,
  link: BODY_MINIMUM,
  heading: LARGE_MINIMUM,
  focus: LARGE_MINIMUM,
};

/** The text colour of each use; every one is read over the page background and over a surface. */
const FOREGROUNDS: Readonly<Record<ContrastUse, keyof ThemePalette>> = {
  body: "ink",
  muted: "muted",
  link: "accent",
  heading: "ink",
  focus: "accent",
};

const USES = Object.keys(CONTRAST_MINIMUMS) as ContrastUse[];
const BACKGROUNDS = ["bg", "surface"] as const;
const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function channel(hex: string): number {
  const value = Number.parseInt(hex, 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** The relative luminance of an sRGB colour written `#RRGGBB`, from 0 for black to 1 for white. */
export function relativeLuminance(colour: string): number {
  const match = HEX.exec(colour);
  if (match === null) {
    throw new Error(`relativeLuminance: ${colour} is not a #RRGGBB colour`);
  }
  const [, red, green, blue] = match;
  // The three groups are unconditional in the pattern: a match always carries them.
  return (
    0.2126 * channel(red as string) +
    0.7152 * channel(green as string) +
    0.0722 * channel(blue as string)
  );
}

/** The contrast ratio of two colours, from 1 to 21, whatever their order. */
export function contrastRatio(first: string, second: string): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Every text and background pair the default theme draws from a palette, in both schemes, with its ratio. */
export function contrastPairs(theme: ThemeConfig): ContrastPair[] {
  const pairs: ContrastPair[] = [];
  for (const scheme of ["light", "dark"] as const) {
    const palette = theme[scheme];
    for (const use of USES) {
      const foreground = FOREGROUNDS[use];
      for (const background of BACKGROUNDS) {
        const ratio = contrastRatio(palette[foreground], palette[background]);
        pairs.push({
          scheme,
          use,
          foreground,
          background,
          ratio: Math.round(ratio * 100) / 100,
          minimum: CONTRAST_MINIMUMS[use],
        });
      }
    }
  }
  return pairs;
}

/** The pairs of a palette below their minimum; an empty list means every text of the theme is readable. */
export function checkContrast(theme: ThemeConfig): ContrastFinding[] {
  return contrastPairs(theme)
    .filter((pair) => pair.ratio < pair.minimum)
    .map((pair) => ({
      pair,
      message: `${pair.scheme} ${pair.use} text: ${pair.foreground} on ${pair.background} is ${pair.ratio.toFixed(2)}:1, below ${String(pair.minimum)}:1`,
    }));
}
