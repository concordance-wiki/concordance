import { describe, expect, it } from "vitest";

import type { ThemeConfig } from "../../src/css/theme-config.js";
import { tokensStylesheet } from "../../src/css/tokens.js";

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
    accent: "#C24E24",
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
    expect(css).toContain(
      "  --font-display: \"Instrument Serif\", Georgia, 'Times New Roman', serif;",
    );
    expect(css).toContain('  --font-ui: "Instrument Sans", system-ui,');
    expect(css).toContain('  --font-mono: "IBM Plex Mono", ui-monospace,');
    expect(css).toContain("  --radius: 4px;");
    expect(css).toContain("  --space-1: 0.25rem;\n  --space-2: 0.5rem;\n  --space-3: 1rem;");
    expect(css).toContain("  --space-6: 4rem;");
    expect(css).toContain(
      "  --color-bg: #F6F5F2;\n  --color-surface: #FFFFFF;\n  --color-border: #E4E1DA;\n  --color-ink: #16181B;\n  --color-muted: #4E5259;\n  --color-accent: #C24E24;\n}",
    );
  });

  it("follows the system preference and the remembered mode by default", () => {
    const css = tokensStylesheet(theme);
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n:root:not([data-mode="light"]) {\n  --color-bg: #0E0F11;',
    );
    expect(css).toContain(':root[data-mode="dark"] {\n  --color-bg: #0E0F11;');
    expect(css).not.toContain('[data-mode="light"] {');
    expect(css.endsWith("}\n")).toBe(true);
  });

  it("falls back to platform fonts and the default radius when the theme names none", () => {
    const { font, radius, ...bare } = theme;
    expect([font, radius].length).toBe(2);
    const css = tokensStylesheet(bare);
    expect(css).toContain("  --font-display: Georgia, 'Times New Roman', serif;");
    expect(css).toContain("  --font-ui: system-ui,");
    expect(css).toContain("  --font-mono: ui-monospace,");
    expect(css).toContain("  --radius: 8px;");
    expect(tokensStylesheet({ ...theme, font: {} })).toContain("  --font-mono: ui-monospace,");
  });

  it("starts light and ignores the system preference when the default mode is light", () => {
    const css = tokensStylesheet({ ...theme, default_mode: "light" });
    expect(css).toContain("  color-scheme: light;");
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).toContain(':root[data-mode="dark"] {\n  --color-bg: #0E0F11;');
  });

  it("starts dark and keeps the light palette for the remembered mode when the default mode is dark", () => {
    const css = tokensStylesheet({ ...theme, default_mode: "dark" });
    expect(css).toContain("  color-scheme: dark;\n");
    expect(css).toContain("  --color-bg: #0E0F11;\n  --color-surface: #16181B;");
    expect(css).not.toContain("prefers-color-scheme");
    expect(css).toContain(':root[data-mode="light"] {\n  --color-bg: #F6F5F2;');
    expect(css).not.toContain('[data-mode="dark"]');
  });

  it("gives the same text twice", () => {
    expect(tokensStylesheet(theme)).toBe(tokensStylesheet(theme));
  });
});
