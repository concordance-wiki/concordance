import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
import {
  accessibilityStatusLabel,
  footerLabels,
  footerOf,
  LEGAL_PAGES,
  legalLinksOf,
  legalNoteOf,
  legalNotePath,
  pageCountOf,
  profileLabelOf,
} from "../../src/build/footer.js";
import { entity, fragments, model, profile } from "./fixture.js";

function context(overrides: Partial<SiteContextInput> = {}): SiteContext {
  return siteContext({
    model: model(),
    profile,
    catalogue: loadCatalogue("en"),
    fragments,
    ...overrides,
  });
}

/** A note filed at `legal/<page>.md` in `source`. */
function legalNote(source: string, page: string) {
  return entity({
    id: `${source}/legal/${page}`,
    type: "document",
    title: page,
    source: { name: source, path: `legal/${page}.md`, line: 1 },
  });
}

describe("legalLinksOf", () => {
  it("links nothing without a legal key nor a legal note: nothing is assumed", () => {
    expect(legalLinksOf(context(), "index.html")).toEqual([]);
  });

  it("links the three pages in their order from the addresses the configuration declares, the accessibility link carrying the declared state", () => {
    const links = legalLinksOf(
      context({
        legal: {
          privacy_url: "https://forge.example/legal/privacy",
          accessibility_url: "https://forge.example/legal/accessibility",
          accessibility_status: "partially-compliant",
          mentions_url: "https://forge.example/legal/mentions",
        },
      }),
      "glossary/page/index.html",
    );
    expect(links).toEqual([
      { label: "Legal notice", href: "https://forge.example/legal/mentions" },
      {
        label: "Accessibility — partially compliant",
        href: "https://forge.example/legal/accessibility",
      },
      { label: "Personal data", href: "https://forge.example/legal/privacy" },
    ]);
  });

  it("reads the accessibility link without a state when none is declared, and words each of the three states", () => {
    const links = legalLinksOf(
      context({ legal: { accessibility_url: "https://forge.example/a11y" } }),
      "index.html",
    );
    expect(links).toEqual([{ label: "Accessibility", href: "https://forge.example/a11y" }]);
    const french = context({ catalogue: loadCatalogue("fr") });
    expect(accessibilityStatusLabel(french, "compliant")).toBe("totalement conforme");
    expect(accessibilityStatusLabel(french, "non-compliant")).toBe("non conforme");
    expect(accessibilityStatusLabel(french, "partially-compliant")).toBe("partiellement conforme");
    expect(
      legalLinksOf(
        context({
          catalogue: loadCatalogue("fr"),
          legal: {
            mentions_url: "https://forge.example/m",
            accessibility_url: "https://forge.example/a",
            accessibility_status: "compliant",
            privacy_url: "https://forge.example/p",
          },
        }),
        "index.html",
      ).map((link) => link.label),
    ).toEqual(["Mentions légales", "Accessibilité — totalement conforme", "Données personnelles"]);
  });

  it("links a note filed at legal/<page>.md in a source when the configuration gives no address, the first source by name when several carry one, relative to the page", () => {
    const withNotes = context({
      model: model({
        entities: [
          ...model().entities,
          legalNote("specs", "privacy"),
          legalNote("glossary", "privacy"),
          legalNote("specs", "mentions"),
        ],
      }),
      legal: { accessibility_url: "https://forge.example/a11y", accessibility_status: "compliant" },
    });
    expect(legalNotePath("mentions")).toBe("legal/mentions.md");
    expect(legalNoteOf(withNotes, "privacy")?.id).toBe("glossary/legal/privacy");
    expect(legalNoteOf(withNotes, "accessibility")).toBeUndefined();
    expect(legalLinksOf(withNotes, "specs/screens/mentions-panel/index.html")).toEqual([
      { label: "Legal notice", href: "../../legal/mentions/index.html" },
      { label: "Accessibility — compliant", href: "https://forge.example/a11y" },
      { label: "Personal data", href: "../../../glossary/legal/privacy/index.html" },
    ]);
    expect(LEGAL_PAGES).toEqual(["mentions", "accessibility", "privacy"]);
  });
});

describe("footerOf", () => {
  it("counts the notes as pages, names the profile with its version and words the labels in the site language with the build instant", () => {
    const site = context();
    expect(pageCountOf(site)).toBe(5);
    expect(profileLabelOf(site)).toBe("default@1");
    const { profile: name, ...unnamed } = profile;
    expect(name).toBe("default");
    expect(profileLabelOf(context({ profile: unnamed }))).toBe("default@1");
    expect(footerLabels(site)).toEqual({
      thisSite: "This site",
      published: "Published on September 12, 2026 at 12:00 PM, from",
      sources: "See the sources and their versions",
      builtWith: "Built with",
      generator: "a static site generator",
      licence: "under the GNU GPL v3 or later licence.",
      content: "The content belongs to its organisation.",
      declared: "Declared by the organisation",
      publication: "publication",
      buildAt: "Sep 12, 2026 12:00 PM",
      profile: "profile default@1",
      pages: "5 pages",
    });
    expect(footerLabels(context({ catalogue: loadCatalogue("fr") })).published).toBe(
      "Publié le 12 septembre 2026 à 12:00, depuis",
    );
  });

  it("builds the footer of a page with every href relative to it, the legal pages before the links of the theme, the text of the theme and the to-do count", () => {
    const footer = footerOf(
      context({ legal: { mentions_url: "https://forge.example/legal" } }),
      "glossary/page/index.html",
      {
        text: "Kept by its maintainers.",
        links: [{ label: "Forge", href: "https://f" }],
        credit: true,
      },
      7,
    );
    expect(footer).toEqual({
      version: "0.1.0",
      generatedAt: "2026-09-12T12:00:00.000Z",
      repositories: { count: 3, href: "../../spaces/index.html", label: "3 repositories" },
      profile: "default@1",
      pages: 5,
      links: [
        { label: "Legal notice", href: "https://forge.example/legal" },
        { label: "Forge", href: "https://f" },
      ],
      todo: { label: "To do", href: "../../todo/index.html", count: 7 },
      credit: true,
      labels: footerLabels(context()),
      text: "Kept by its maintainers.",
    });
    const bare = footerOf(context(), "index.html", { credit: false }, 0);
    expect(bare.text).toBeUndefined();
    expect(bare.links).toEqual([]);
    expect(bare.repositories?.label).toBe("3 repositories");
    expect(
      footerOf(
        context({ model: model({ entities: [], build: { ...model().build, sources: [] } }) }),
        "index.html",
        { credit: false },
        0,
      ).repositories,
    ).toEqual({ count: 0, href: "spaces/index.html", label: "0 repositories" });
  });
});
