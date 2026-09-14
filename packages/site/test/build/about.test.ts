import type { Entity } from "@concordance-wiki/core";
import { loadCatalogue } from "@concordance-wiki/i18n";
import { describe, expect, it } from "vitest";

import {
  aboutFiguresOf,
  aboutLabels,
  aboutOf,
  aboutSourcesOf,
  DEFAULT_KEYWORD_THRESHOLD,
  natureOf,
  SHORT_COMMIT,
} from "../../src/build/about.js";
import { siteContext, type SiteContext, type SiteContextInput } from "../../src/build/context.js";
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

/** A note of `source` changed at `changed`. */
function dated(id: string, source: string, changed: string, deck = false): Entity {
  return entity({
    id,
    type: "term",
    title: id,
    source: {
      name: source,
      path: `${id.split("/").pop() ?? id}.md`,
      line: 1,
      last_modified: changed,
    },
    ...(deck ? { representations: [{ path: "deck.pptx", format: "pptx" }] } : {}),
  });
}

describe("aboutSourcesOf", () => {
  it("lists every source in the order of the home page with its nature, the commit shortened, what was kept and no date without a git history", () => {
    expect(aboutSourcesOf(context())).toEqual([
      { name: "glossary", nature: "Term", content: "2 pages", stale: false },
      {
        name: "framing",
        nature: "Document",
        content: "1 page",
        stale: false,
      },
      {
        name: "specs",
        nature: "Business rule, Screen",
        version: "0123456789abcdef0123456789abcdef01234567".slice(0, SHORT_COMMIT),
        content: "2 pages",
        stale: false,
      },
    ]);
    expect(SHORT_COMMIT).toBe(7);
  });

  it("names a source by its configured title, dates it relative to the build, counts documents when its notes mostly stand for converted files, and words a dormant one in days with the sentence naming its threshold", () => {
    const site = context({
      model: model({
        build: { ...model().build, sources: [] },
        entities: [
          dated("glossary/a", "glossary", "2026-09-10T00:00:00.000Z"),
          dated("decks/b", "decks", "2026-03-01T00:00:00.000Z", true),
          dated("decks/c", "decks", "2026-02-01T00:00:00.000Z", true),
          dated("decks/d", "decks", "2026-01-01T00:00:00.000Z"),
        ],
        links: [],
      }),
      names: { sources: { glossary: "Glossary of the tool" } },
      staleness: { warn_after_days: { decks: 90 } },
    });
    expect(natureOf(site, "glossary")).toBe("Glossary of the tool");
    expect(natureOf(site, "decks")).toBe("Term");
    expect(aboutSourcesOf(site)).toEqual([
      {
        name: "decks",
        nature: "Term",
        content: "3 documents",
        date: "2026-03-01",
        dateLabel: "195 days ago",
        stale: true,
        threshold: 90,
        staleNote:
          "exceeds the freshness threshold of 90 days, which is reported here and in the build report, never on the pages themselves.",
      },
      {
        name: "glossary",
        nature: "Glossary of the tool",
        content: "1 page",
        date: "2026-09-10",
        dateLabel: "2 days ago",
        stale: false,
      },
    ]);
  });
});

describe("aboutOf", () => {
  it("words the three figures, the build instant, the notes as pages and every entity as an indexed word, in the site language", () => {
    expect(aboutFiguresOf(context())).toEqual([
      { label: "Published on", value: "Sep 12, 2026 12:00 PM" },
      { label: "Pages", value: "5" },
      { label: "Indexed words", value: "7" },
    ]);
    expect(aboutFiguresOf(context({ catalogue: loadCatalogue("fr"), locale: "fr" }))).toEqual([
      { label: "Publié le", value: "12 sept. 2026 12:00" },
      { label: "Pages", value: "5" },
      { label: "Mots indexés", value: "7" },
    ]);
  });

  it("builds the page from the model and the configuration: the hrefs from the about page, the threshold worded, the contribution address and the pseudonymisation when the configuration says so, the markdown file rendered after", () => {
    const props = aboutOf(context());
    expect(props).toEqual({
      homeHref: "../index.html",
      generatedAt: "2026-09-12T12:00:00.000Z",
      figures: aboutFiguresOf(context()),
      sources: aboutSourcesOf(context()),
      threshold: DEFAULT_KEYWORD_THRESHOLD,
      reportHref: "../todo/index.html",
      pseudonymised: false,
      labels: aboutLabels(context(), 3),
    });
    expect(DEFAULT_KEYWORD_THRESHOLD).toBe(3);
    expect(props.labels?.notContainedText).toBe(
      "The files the configuration excludes, the documents whose conversion failed, and the words used fewer than 3 times. The",
    );
    expect(props.labels?.stale).toBe("past the freshness threshold");
    const extended = aboutOf(
      context({
        keywordThreshold: 1,
        contributeUrl: "https://forge.example/issues/new",
        pseudonymized: true,
        about: "# About\n\nA word from the maintainers.\n\n## Who\n\nUs.\n",
      }),
    );
    expect(extended.threshold).toBe(1);
    expect(extended.labels?.notContainedText).toContain("fewer than 1 time.");
    expect(extended.contributeHref).toBe("https://forge.example/issues/new");
    expect(extended.pseudonymised).toBe(true);
    expect(extended.sections).toEqual([
      { id: "section-lead", html: "<p>A word from the maintainers.</p>" },
      { id: "section-who", heading: "Who", html: "<p>Us.</p>" },
    ]);
  });

  it("words the labels in French, the French catalogue giving every sentence of the page", () => {
    const labels = aboutLabels(context({ catalogue: loadCatalogue("fr") }), 3);
    expect(labels.title).toBe("À propos de ce wiki");
    expect(labels.home).toBe("Accueil");
    expect(labels.sourcesLead).toBe("chacune avec la version exactement utilisée");
    expect(labels.notContainedText).toBe(
      "Les fichiers exclus par la configuration, les documents dont la conversion a échoué, et les mots employés moins de 3 fois. Le",
    );
    expect(labels.report).toBe("rapport de publication");
    expect(labels.reportLists).toBe("les liste.");
  });
});
