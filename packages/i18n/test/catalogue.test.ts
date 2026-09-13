import { readdirSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CatalogueError,
  formatMessage,
  formatText,
  loadCatalogue,
  resolveLanguage,
} from "../src/catalogue.js";
import { messageIds } from "../src/ids.js";
import { shipped } from "../src/shipped.js";

const built = new Date("2024-03-05T23:30:00Z");

describe("loadCatalogue", () => {
  it("takes every label from the per-locale message catalogue", () => {
    expect(loadCatalogue("en").messages).toEqual(shipped["en"]);
    expect(loadCatalogue("fr").messages).toEqual(shipped["fr"]);
    expect(Object.keys(loadCatalogue("fr").messages).sort()).toEqual([...messageIds]);
  });

  it("picks the shipped catalogue by language subtag and formats with the full locale", () => {
    const catalogue = loadCatalogue("fr-CA");
    expect(catalogue).toMatchObject({
      locale: "fr-CA",
      language: "fr",
      fallback: false,
      timeZone: "UTC",
    });
    expect(catalogue.messages["site.home"]).toBe("Accueil");
    expect(loadCatalogue("fr-ca").locale).toBe("fr-CA");
  });

  it("falls back to the source catalogue, formatted in its language, when the language has none", () => {
    const catalogue = loadCatalogue("de-CH");
    expect(catalogue).toMatchObject({ locale: "en", language: "en", fallback: true });
    expect(catalogue.messages["site.home"]).toBe("Home");
    expect(resolveLanguage("pt-BR")).toEqual({ language: "en", fallback: true });
    expect(resolveLanguage("fr-BE")).toEqual({ language: "fr", fallback: false });
  });

  it("rejects a malformed language tag as a configuration issue on project.locale", () => {
    let caught: unknown;
    try {
      loadCatalogue("not a tag");
    } catch (error: unknown) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CatalogueError);
    if (caught instanceof CatalogueError) {
      expect(caught.name).toBe("CatalogueError");
      expect(caught.message).toBe("project.locale: not a valid language tag");
      expect(caught.issues).toEqual([
        {
          severity: "error",
          path: "project.locale",
          message: "not a valid language tag",
          received: "not a tag",
          expected: "a BCP 47 language tag such as en or fr-CA",
        },
      ]);
    }
  });

  it("overrides any message of the catalogue's language with the labels of the theme", () => {
    const labels = {
      en: { "site.home": "Start" },
      fr: { "site.home": "Début", "entity.mentionsCount": "{count} mention(s)" },
    };
    const fr = loadCatalogue("fr-CA", { labels });
    expect(fr.messages["site.home"]).toBe("Début");
    expect(formatMessage(fr, "entity.mentionsCount", { count: 3 })).toBe("3 mention(s)");
    expect(fr.messages["site.search"]).toBe("Rechercher");
    expect(loadCatalogue("en", { labels }).messages["site.home"]).toBe("Start");
    expect(loadCatalogue("de", { labels }).messages["site.home"]).toBe("Start");
  });

  it("reports an invalid override as a configuration error under labels.<language>.<id>", () => {
    const labels = { fr: { "site.nowhere": "x", "site.home": "{oops", "todo.findings": "none" } };
    let caught: unknown;
    try {
      loadCatalogue("fr", { labels });
    } catch (error: unknown) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CatalogueError);
    if (caught instanceof CatalogueError) {
      expect(caught.issues.map((issue) => issue.path)).toEqual([
        "labels.fr.site.home",
        "labels.fr.site.nowhere",
        "labels.fr.todo.findings",
      ]);
      expect(caught.message).toBe(
        "labels.fr.site.home: invalid ICU MessageFormat syntax: EXPECT_ARGUMENT_CLOSING_BRACE; labels.fr.site.nowhere: unknown message identifier; labels.fr.todo.findings: missing variable(s) count",
      );
    }
    expect(() => loadCatalogue("en", { labels })).not.toThrow();
  });
});

describe("formatMessage", () => {
  it("resolves a message to its final string at build time", () => {
    const en = loadCatalogue("en");
    expect(formatMessage(en, "site.home")).toBe("Home");
    expect(formatMessage(en, "mentions.inSection", { section: "Rules" })).toBe("in section Rules");
    expect(formatMessage(en, "time.updatedAgo", { when: "3 days ago" })).toBe("Updated 3 days ago");
  });

  it("applies the plural rules of the catalogue's locale", () => {
    const en = loadCatalogue("en");
    const fr = loadCatalogue("fr");
    expect([0, 1, 2].map((count) => formatMessage(en, "entity.mentionsCount", { count }))).toEqual([
      "0 mentions",
      "1 mention",
      "2 mentions",
    ]);
    expect([0, 1, 2].map((count) => formatMessage(fr, "entity.mentionsCount", { count }))).toEqual([
      "0 mention",
      "1 mention",
      "2 mentions",
    ]);
    expect(formatMessage(fr, "todo.findings", { count: 21 })).toBe("21 constats");
  });

  it("formats numbers and dates inside messages with the catalogue's locale", () => {
    const en = loadCatalogue("en");
    const fr = loadCatalogue("fr");
    expect(formatMessage(en, "entity.confidence", { value: 0.75 })).toBe("Confidence: 75%");
    expect(formatMessage(fr, "entity.confidence", { value: 0.75 })).toBe(
      "Confiance\u00a0: 75\u00a0%",
    );
    expect(formatMessage(en, "mentions.atLine", { line: 1234 })).toBe("line 1,234");
    expect(formatMessage(fr, "mentions.atLine", { line: 1234 })).toBe("ligne 1 234");
    expect(formatMessage(en, "site.generatedAt", { date: built })).toBe(
      "Generated on March 5, 2024",
    );
    expect(formatMessage(fr, "site.generatedAt", { date: built })).toBe("Généré le 5 mars 2024");
  });

  it("formats dates in UTC unless the catalogue was loaded with another time zone", () => {
    const shifted = loadCatalogue("fr", { timeZone: "Pacific/Kiritimati" });
    expect(shifted.timeZone).toBe("Pacific/Kiritimati");
    expect(formatMessage(shifted, "site.generatedAt", { date: built })).toBe(
      "Généré le 6 mars 2024",
    );
  });

  it("reuses one formatter per message of a catalogue", () => {
    const en = loadCatalogue("en");
    expect(formatMessage(en, "search.results", { count: 1 })).toBe("1 result, most cited first");
    expect(formatMessage(en, "search.results", { count: 2 })).toBe("2 results, most cited first");
    expect(formatMessage(en, "search.noResult")).toBe("No result");
  });
});

describe("formatText", () => {
  it("resolves a message outside the catalogues with the locale of the catalogue", () => {
    const en = loadCatalogue("en");
    const fr = loadCatalogue("fr");
    const message = "{count, plural, one {# screen described} other {# screens described}}";
    expect(formatText(en, message, { count: 1 })).toBe("1 screen described");
    expect(formatText(en, message, { count: 1234 })).toBe("1,234 screens described");
    expect(
      formatText(fr, "{count, plural, one {# écran décrit} other {# écrans décrits}}", {
        count: 1234,
      }),
    ).toBe("1\u202f234 écrans décrits");
    expect(formatText(en, "No argument")).toBe("No argument");
  });
});

describe("browser independence", () => {
  it("never touches the DOM or the browser globals in its sources", () => {
    const directory = new URL("../src/", import.meta.url);
    for (const name of readdirSync(directory, { recursive: true, encoding: "utf8" })) {
      if (!name.endsWith(".ts")) continue;
      const text = readFileSync(new URL(name, directory), "utf8");
      expect(text, name).not.toMatch(
        /(?<![\w"'./])(window|document|navigator|localStorage)\s*[.[(]/,
      );
    }
  });
});
