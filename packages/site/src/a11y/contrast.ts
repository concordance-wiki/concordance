import type { ThemeConfig } from "../css/theme-config.js";
import { paletteColours, type PaletteColour } from "../css/tokens.js";

export type { PaletteColour } from "../css/tokens.js";

export type ColourScheme = "light" | "dark";

/** What a pair of tokens is used for; each use has its own minimum ratio. */
export type ContrastUse = "body" | "muted" | "label" | "link" | "mark" | "heading" | "focus";

export interface ContrastPair {
  scheme: ColourScheme;
  use: ContrastUse;
  foreground: PaletteColour;
  background: PaletteColour;
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

/**
 * The minimum of each use: body, muted, label and link text and a marked passage are read at
 * body size; headings and the focus ring are large or non-text.
 */
export const CONTRAST_MINIMUMS: Readonly<Record<ContrastUse, number>> = {
  body: BODY_MINIMUM,
  muted: BODY_MINIMUM,
  label: BODY_MINIMUM,
  link: BODY_MINIMUM,
  mark: BODY_MINIMUM,
  heading: LARGE_MINIMUM,
  focus: LARGE_MINIMUM,
};

/** The text colour of each use and the backgrounds it is read over: the page, a surface and a soft surface, or the highlight of a mark. */
const READ_OVER: Readonly<
  Record<ContrastUse, { foreground: PaletteColour; backgrounds: readonly PaletteColour[] }>
> = {
  body: { foreground: "ink", backgrounds: ["bg", "surface", "soft"] },
  muted: { foreground: "muted", backgrounds: ["bg", "surface", "soft"] },
  label: { foreground: "label", backgrounds: ["bg", "surface", "soft"] },
  link: { foreground: "accent", backgrounds: ["bg", "surface", "soft"] },
  mark: { foreground: "ink", backgrounds: ["highlight"] },
  heading: { foreground: "ink", backgrounds: ["bg", "surface", "soft"] },
  focus: { foreground: "accent", backgrounds: ["bg", "surface", "soft"] },
};

const USES = Object.keys(CONTRAST_MINIMUMS) as ContrastUse[];
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
    const palette = paletteColours(theme[scheme]);
    for (const use of USES) {
      const { foreground, backgrounds } = READ_OVER[use];
      for (const background of backgrounds) {
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
