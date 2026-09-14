import { MONO_FAMILY, TEXT_FAMILY } from "./fonts.js";
import type { ThemeConfig, ThemeMode, ThemePalette } from "./theme-config.js";

const DEFAULT_RADIUS = 8;

/** The stacks behind the families the default theme ships, then the platform fonts. */
const FALLBACKS = {
  ui: `${JSON.stringify(TEXT_FAMILY)}, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`,
  mono: `${JSON.stringify(MONO_FAMILY)}, ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace`,
} as const;

const SPACING = ["0.25rem", "0.5rem", "1rem", "1.5rem", "2.5rem", "4rem"] as const;

function fontStack(family: string | undefined, fallback: string): string {
  return family === undefined || JSON.stringify(family) === fallback.split(", ")[0]
    ? fallback
    : `${JSON.stringify(family)}, ${fallback}`;
}

/** One of the two schemes of a theme, the palette in force; `--scheme` on the root names it. */
export type ColourScheme = Exclude<ThemeMode, "system">;

/** A colour of a palette as the stylesheet names it, `--color-<name>`. */
export type PaletteColour =
  "bg" | "surface" | "soft" | "border" | "ink" | "muted" | "label" | "accent" | "highlight";

/** The nine colours of a palette, the three optional ones derived from the six required when absent. */
export function paletteColours(palette: ThemePalette): Record<PaletteColour, string> {
  return {
    bg: palette.bg,
    surface: palette.surface,
    soft: palette.soft ?? palette.bg,
    border: palette.border,
    ink: palette.ink,
    muted: palette.muted,
    label: palette.label ?? palette.muted,
    accent: palette.accent,
    highlight: palette.highlight ?? palette.border,
  };
}

/** The shadow of what floats over the page, the live results or the menu of the pinned pages; none in the dark scheme, where the hierarchy is carried by the grounds and the rules alone. */
const FLOAT_SHADOW: Readonly<Record<ColourScheme, string>> = {
  light: "0 6px 18px rgb(0 0 0 / 10%)",
  dark: "none",
};

/** The lines of one scheme: the scheme named for the mode switch to read, its nine colours, its shadow. */
function schemeLines(scheme: ColourScheme, palette: ThemePalette): string[] {
  return [
    `  --scheme: ${scheme};`,
    ...Object.entries(paletteColours(palette)).map(
      ([name, colour]) => `  --color-${name}: ${colour};`,
    ),
    `  --shadow-float: ${FLOAT_SHADOW[scheme]};`,
  ];
}

function block(selector: string, lines: string[]): string {
  return [`${selector} {`, ...lines, "}"].join("\n");
}

/** The palette of a mode forced through `data-mode`, with the matching `color-scheme` for form controls. */
function forced(mode: ColourScheme, palette: ThemePalette): string {
  return block(`:root[data-mode="${mode}"]`, [
    `  color-scheme: ${mode};`,
    ...schemeLines(mode, palette),
  ]);
}

/**
 * Custom properties of a theme: fonts, radii, spacing and the two palettes. One family serves
 * the text, headings included, unless the theme names a display family; the monospace family is
 * reserved to file paths and identifiers. The default mode decides which palette the root
 * carries; the other answers the system preference and a `data-mode` attribute on the root,
 * which the mode switch sets and remembers. Every palette block names its scheme in `--scheme`
 * and sets the shadow of what floats over the page, none in the dark scheme.
 */
export function tokensStylesheet(theme: ThemeConfig): string {
  const mode = theme.default_mode ?? "system";
  const initial: ColourScheme = mode === "dark" ? "dark" : "light";
  const ui = fontStack(theme.font?.ui, FALLBACKS.ui);
  const radius = theme.radius ?? DEFAULT_RADIUS;
  const root = block(":root", [
    `  color-scheme: ${mode === "system" ? "light dark" : mode};`,
    `  --font-display: ${theme.font?.display === undefined ? ui : fontStack(theme.font.display, ui)};`,
    `  --font-ui: ${ui};`,
    `  --font-mono: ${fontStack(theme.font?.mono, FALLBACKS.mono)};`,
    `  --radius: ${String(radius)}px;`,
    `  --radius-small: ${String(radius / 2)}px;`,
    `  --radius-large: ${String(radius * 1.5)}px;`,
    ...SPACING.map((value, index) => `  --space-${String(index + 1)}: ${value};`),
    "  --measure: 70ch;",
    ...schemeLines(initial, theme[initial]),
  ]);
  const blocks = [root];
  if (mode === "system") {
    blocks.push(
      block("@media (prefers-color-scheme: dark)", [
        block(':root:not([data-mode="light"])', schemeLines("dark", theme.dark)),
      ]),
    );
  }
  if (mode !== "light") {
    blocks.push(forced("light", theme.light));
  }
  if (mode !== "dark") {
    blocks.push(forced("dark", theme.dark));
  }
  return `${blocks.join("\n")}\n`;
}
