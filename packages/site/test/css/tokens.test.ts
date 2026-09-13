import { describe, expect, it } from "vitest";

import type { ThemeConfig } from "../../src/css/theme-config.js";
import { paletteColours, tokensStylesheet } from "../../src/css/tokens.js";

const theme: ThemeConfig = {
  name: "Example",
  font: { display: "Instrument Serif", ui: "Instrument Sans", mono: "IBM Plex Mono" },
  radius: 4,
  light: {
    bg: "#F6F5F2",
    surface: "#FFFFFF",
    border: "#E4E1DA",
    ink: "#16181B",
    muted: "#4E5259",
    accent: "#B84820",
  },
  dark: {
    bg: "#0E0F11",
    surface: "#16181B",
    border: "#26292E",
    ink: "#E8E6E1",
    muted: "#8B9199",
    accent: "#E8703A",
  },
};

describe("tokensStylesheet", () => {
  it("writes the fonts, the radius, the spacing scale and the light palette on the root", () => {
    const css = tokensStylesheet(theme);
    expect(css).toContain(":root {\n  color-scheme: light dark;\n");
    expect(css).toContain('  --font-display: "Instrument Serif", "Instrument Sans", system-ui,');
    expect(css).toContain('  --font-ui: "Instrument Sans", system-ui,');
    expect(css).toContain('  --font-mono: "IBM Plex Mono", ui-monospace,');
    expect(css).toContain("  --radius: 4px;\n  --radius-small: 2px;\n  --radius-large: 6px;");
    expect(css).toContain("  --space-1: 0.25rem;\n  --space-2: 0.5rem;\n  --space-3: 1rem;");
    expect(css).toContain("  --space-6: 4rem;");
    expect(css).toContain(
      "  --color-bg: #F6F5F2;\n  --color-surface: #FFFFFF;\n  --color-soft: #F6F5F2;\n  --color-border: #E4E1DA;\n  --color-ink: #16181B;\n  --color-muted: #4E5259;\n  --color-label: #4E5259;\n  --color-accent: #B84820;\n  --color-highlight: #E4E1DA;\n}",
    );
  });

  it("writes the label, soft and highlight colours a theme declares, and derives them from muted, bg and border otherwise", () => {
    const css = tokensStylesheet({
      ...theme,
      light: { ...theme.light, label: "#676C74", soft: "#F7F6F3", highlight: "#FBE3D4" },
    });
    expect(css).toContain("  --color-soft: #F7F6F3;");
    expect(css).toContain("  --color-label: #676C74;");
    expect(css).toContain("  --color-highlight: #FBE3D4;");
    expect(css).toContain(
      ':root[data-mode="dark"] {\n  color-scheme: dark;\n  --color-bg: #0E0F11;\n  --color-surface: #16181B;\n  --color-soft: #0E0F11;',
    );
    expect(paletteColours(theme.dark)).toEqual({
      bg: "#0E0F11",
      surface: "#16181B",
      soft: "#0E0F11",
      border: "#26292E",
      ink: "#E8E6E1",
      muted: "#8B9199",
      label: "#8B9199",
      accent: "#E8703A",
      highlight: "#26292E",
    });
  });

  it("follows the system preference and the remembered mode by default", () => {
    const css = tokensStylesheet(theme);
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n:root:not([data-mode="light"]) {\n  --color-bg: #0E0F11;',
    );
    expect(css).toContain(
      ':root[data-mode="dark"] {\n  color-scheme: dark;\n  --color-bg: #0E0F11;\n  --color-surface: #16181B;\n  --color-soft: #0E0F11;\n  --color-border: #26292E;\n  --color-ink: #E8E6E1;\n  --color-muted: #8B9199;\n  --color-label: #8B9199;\n  --color-accent: #E8703A;\n  --color-highlight: #26292E;\n}',
    );
    expect(css).toContain(
      ':root[data-mode="light"] {\n  color-scheme: light;\n  --color-bg: #F6F5F2;',
    );
    expect(css.endsWith("}\n")).toBe(true);
  });

  it("serves the shipped families before the platform fonts, the text family for the headings too, and the default radius when the theme names none", () => {
    const { font, radius, ...bare } = theme;
    expect([font, radius].length).toBe(2);
    const css = tokensStylesheet(bare);
    const ui = `"Instrument Sans", system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif`;
    expect(css).toContain(`  --font-display: ${ui};\n  --font-ui: ${ui};`);
    expect(css).toContain(
      `  --font-mono: "IBM Plex Mono", ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;`,
    );
    expect(css).toContain("  --radius: 8px;\n  --radius-small: 4px;\n  --radius-large: 12px;");
    expect(tokensStylesheet({ ...theme, font: {} })).toContain(`  --font-ui: ${ui};`);
  });

  it("names a shipped family once when the theme declares it as its own", () => {
    const css = tokensStylesheet({
      ...theme,
      font: { ui: "Instrument Sans", mono: "IBM Plex Mono" },
    });
    expect(css).toContain('  --font-ui: "Instrument Sans", system-ui,');
    expect(css).not.toContain('"Instrument Sans", "Instrument Sans"');
    expect(css).toContain('  --font-mono: "IBM Plex Mono", ui-monospace,');
    expect(css).not.toContain('"IBM Plex Mono", "IBM Plex Mono"');
  });

  it("starts light and ignores the system preference when the default mode is light", () => {
    const css = tokensStylesheet({ ...theme, default_mode: "light" });
    expect(css).toContain(":root {\n  color-scheme: light;\n");
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).toContain(
      ':root[data-mode="dark"] {\n  color-scheme: dark;\n  --color-bg: #0E0F11;',
    );
    expect(css).not.toContain('[data-mode="light"]');
  });

  it("starts dark and keeps the light palette for the remembered mode when the default mode is dark", () => {
    const css = tokensStylesheet({ ...theme, default_mode: "dark" });
    expect(css).toContain(":root {\n  color-scheme: dark;\n");
    expect(css).toContain("  --color-bg: #0E0F11;\n  --color-surface: #16181B;");
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).toContain(
      ':root[data-mode="light"] {\n  color-scheme: light;\n  --color-bg: #F6F5F2;',
    );
    expect(css).not.toContain('[data-mode="dark"]');
  });

  it("gives the same text twice", () => {
    expect(tokensStylesheet(theme)).toBe(tokensStylesheet(theme));
  });
});
