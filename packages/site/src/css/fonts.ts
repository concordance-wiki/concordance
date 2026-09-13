import { readFileSync } from "node:fs";

/** The one family of the text of the default theme, headings included. */
export const TEXT_FAMILY = "Instrument Sans";
/** The family reserved to file paths and identifiers. */
export const MONO_FAMILY = "IBM Plex Mono";

/** Where the font files land under `assets/`, next to the stylesheet that binds them. */
export const FONTS_DIRECTORY = "fonts";

/** The licence of the shipped families, copied next to their files. */
export const FONTS_LICENCE = "OFL.txt";

const LATIN =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXTENDED =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

/** One `@font-face` rule: a family, a style, a weight or a range of weights, a subset in one woff2 file. */
export interface FontFace {
  family: string;
  style: "normal" | "italic";
  /** A single weight, or a `400 700` range for a variable file. */
  weight: string;
  file: string;
  unicodeRange: string;
}

function subsets(
  family: string,
  style: FontFace["style"],
  weight: string,
  stem: string,
): FontFace[] {
  return [
    { family, style, weight, file: `${stem}-latin.woff2`, unicodeRange: LATIN },
    { family, style, weight, file: `${stem}-latin-ext.woff2`, unicodeRange: LATIN_EXTENDED },
  ];
}

/**
 * The faces the default theme ships, self-hosted so that a page calls no font host: the variable
 * text family upright and italic, the monospace family at the two weights the identifiers use;
 * Latin and Latin Extended subsets only.
 */
export const FONT_FACES: readonly FontFace[] = [
  ...subsets(TEXT_FAMILY, "normal", "400 700", "instrument-sans-normal-400-700"),
  ...subsets(TEXT_FAMILY, "italic", "400 700", "instrument-sans-italic-400-700"),
  ...subsets(MONO_FAMILY, "normal", "400", "ibm-plex-mono-normal-400"),
  ...subsets(MONO_FAMILY, "normal", "500", "ibm-plex-mono-normal-500"),
];

/** The names of every file the fonts folder ships, the licence included, in the order written. */
export function fontFiles(): string[] {
  return [...FONT_FACES.map((face) => face.file), FONTS_LICENCE];
}

/** The `@font-face` rules, the files addressed relative to the stylesheet; `font-display: swap` so that text never waits. */
export function fontFacesStylesheet(): string {
  return FONT_FACES.map((face) =>
    [
      "@font-face {",
      `  font-family: ${JSON.stringify(face.family)};`,
      `  font-style: ${face.style};`,
      `  font-weight: ${face.weight};`,
      "  font-display: swap;",
      `  src: url("${FONTS_DIRECTORY}/${face.file}") format("woff2");`,
      `  unicode-range: ${face.unicodeRange};`,
      "}",
    ].join("\n"),
  ).join("\n");
}

const assets = new URL(`../../assets/${FONTS_DIRECTORY}/`, import.meta.url);

/** The bytes of one shipped file, read from the package. */
export function readFontFile(file: string): Uint8Array {
  return readFileSync(new URL(file, assets));
}
