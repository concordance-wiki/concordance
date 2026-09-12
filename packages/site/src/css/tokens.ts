import type { ThemeConfig, ThemePalette } from "./theme-config.js";

const DEFAULT_RADIUS = 8;

const FALLBACKS = {
  display: "Georgia, 'Times New Roman', serif",
  ui: "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
} as const;

const SPACING = ["0.25rem", "0.5rem", "1rem", "1.5rem", "2.5rem", "4rem"] as const;

function fontStack(family: string | undefined, fallback: string): string {
  return family === undefined ? fallback : `${JSON.stringify(family)}, ${fallback}`;
}

function paletteLines(palette: ThemePalette): string[] {
  return [
    `  --color-bg: ${palette.bg};`,
    `  --color-surface: ${palette.surface};`,
    `  --color-border: ${palette.border};`,
    `  --color-ink: ${palette.ink};`,
    `  --color-muted: ${palette.muted};`,
    `  --color-accent: ${palette.accent};`,
  ];
}

function block(selector: string, lines: string[]): string {
  return [`${selector} {`, ...lines, "}"].join("\n");
}

/**
 * Custom properties of a theme: fonts, radius, spacing and the two palettes.
 * The default mode decides which palette the root carries; the other answers the system preference
 * and a `data-mode` attribute on the root, which the mode switch sets and remembers.
 */
export function tokensStylesheet(theme: ThemeConfig): string {
  const mode = theme.default_mode ?? "system";
  const initial = mode === "dark" ? theme.dark : theme.light;
  const root = block(":root", [
    `  color-scheme: ${mode === "system" ? "light dark" : mode};`,
    `  --font-display: ${fontStack(theme.font?.display, FALLBACKS.display)};`,
    `  --font-ui: ${fontStack(theme.font?.ui, FALLBACKS.ui)};`,
    `  --font-mono: ${fontStack(theme.font?.mono, FALLBACKS.mono)};`,
    `  --radius: ${String(theme.radius ?? DEFAULT_RADIUS)}px;`,
    ...SPACING.map((value, index) => `  --space-${String(index + 1)}: ${value};`),
    "  --measure: 70ch;",
    ...paletteLines(initial),
  ]);
  const blocks = [root];
  if (mode === "system") {
    blocks.push(
      block("@media (prefers-color-scheme: dark)", [
        block(':root:not([data-mode="light"])', paletteLines(theme.dark)),
      ]),
    );
  }
  if (mode === "dark") {
    blocks.push(block(':root[data-mode="light"]', paletteLines(theme.light)));
  } else {
    blocks.push(block(':root[data-mode="dark"]', paletteLines(theme.dark)));
  }
  return `${blocks.join("\n")}\n`;
}
