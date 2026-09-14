import { describe, expect, it } from "vitest";

import { defaultThemeConfig } from "../../src/build/default-theme.js";
import { tokensStylesheet } from "../../src/css/tokens.js";
import { shipped } from "../accessibility/stylesheet.js";

/** A colour written as such rather than read from a token: a hex triplet, an rgb() or hsl() function, or a named colour. */
const LITERAL_COLOUR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:white|black)\b/i;

describe("L9-18 dark mode: every component reads the scheme from the tokens, so that the dark palette reaches it whole", () => {
  it("draws every colour of the shipped layers from a token, the paper of a document page apart, which stays white in both schemes", () => {
    const literal = shipped.flatMap((rule) =>
      Object.entries(rule.declarations)
        .filter(([, value]) => LITERAL_COLOUR.test(value))
        .map(([property, value]) => `${rule.selector} { ${property}: ${value} }`),
    );
    expect(literal).toEqual([".viewer-page { background: white }"]);
  });

  it("casts no shadow of its own: what floats over the page reads the shadow token, none in the dark scheme", () => {
    const shadows = shipped
      .filter((rule) => rule.declarations["box-shadow"] !== undefined)
      .map((rule) => `${rule.selector}: ${rule.declarations["box-shadow"] ?? ""}`);
    expect(shadows).toEqual([
      ".search-suggestions: var(--shadow-float)",
      ".pins-menu: var(--shadow-float)",
      ".related-type-menu: var(--shadow-float)",
      ".index-filters-menu: var(--shadow-float)",
      ".home-suggestions: none",
      '.site-drawer:not([open]) ~ .site-search-fold[open] > concordance-island[data-island="search"]: var(--shadow-float)',
      ".category-choices: var(--shadow-float)",
    ]);
    const css = tokensStylesheet(defaultThemeConfig("Concordance"));
    expect(css).toContain("  --scheme: light;\n  --color-bg: #EFEDE9;");
    expect(css).toContain(
      "  --color-highlight: #FBE3D4;\n  --shadow-float: 0 6px 18px rgb(0 0 0 / 10%);\n}",
    );
    expect(css).toContain("  --scheme: dark;\n  --color-bg: #0F1113;");
    expect(css).toContain("  --color-highlight: #4A2A1B;\n  --shadow-float: none;\n}");
  });
});
