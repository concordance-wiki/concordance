import { describe, expect, it } from "vitest";

import {
  buildDictionary,
  HOMONYM_CHECK,
  languagePack,
  type BuildDictionaryInput,
  type DictionaryEntry,
  type DictionarySource,
} from "../../src/index.js";

type Locale = "en" | "fr";

function entity(
  locale: Locale,
  source: string,
  id: string,
  title: string,
  aliases: readonly string[] = [],
): DictionarySource {
  return { id: `${source}/${id}`, source, type: "term", title, aliases, locale };
}

function build(
  locale: Locale,
  entities: readonly DictionarySource[],
  options: Partial<Omit<BuildDictionaryInput, "entities" | "locale">> = {},
) {
  return buildDictionary({
    entities,
    locale,
    glossarySources: options.glossarySources ?? new Set(["glossary"]),
    stopwords: options.stopwords ?? languagePack(locale).stopwords,
    shortTerms: options.shortTerms ?? new Set(),
  });
}

const words = {
  en: {
    term: "Explicit link",
    termKey: "explicit link",
    plural: "explicit links",
    alias: "Authored link",
    aliasKey: "authored link",
    short: "EL",
    shortKey: "el",
    object: "Link",
    objectKey: "link",
    stopword: "The",
    stopwordPhrase: "Of the",
    other: "Entity",
    otherKey: "entity",
  },
  fr: {
    term: "Lien explicite",
    termKey: "lien explicite",
    plural: "liens explicites",
    alias: "Lien rédigé",
    aliasKey: "lien redige",
    short: "LX",
    shortKey: "lx",
    object: "Lien",
    objectKey: "lien",
    stopword: "Les",
    stopwordPhrase: "De la",
    other: "Entité",
    otherKey: "entite",
  },
} as const;

describe.each(["en", "fr"] as const)("in the %s locale", (locale) => {
  const w = words[locale];

  describe("the dictionary is built from the titles and aliases of every entity, with priority to sources declared as glossary sources", () => {
    it("keys every title and alias by its comparison form and keeps the written form", () => {
      const dictionary = build(locale, [
        entity(locale, "glossary", "term", w.term, [w.alias, w.short]),
        entity(locale, "specs", "object", w.object),
      ]);
      expect([...dictionary.entries.keys()]).toEqual([w.termKey, w.aliasKey, w.objectKey].sort());
      expect(dictionary.entries.get(w.termKey)).toEqual<DictionaryEntry>({
        key: w.termKey,
        homonym: false,
        targets: [{ id: "glossary/term", kind: "title", form: w.term, priority: 0 }],
      });
      expect(dictionary.entries.get(w.objectKey)).toEqual<DictionaryEntry>({
        key: w.objectKey,
        homonym: false,
        targets: [{ id: "specs/object", kind: "title", form: w.object, priority: 1 }],
      });
      expect(dictionary.locale).toBe(locale);
      expect(dictionary.findings).toEqual([]);
    });

    it("gives priority 0 to the entities of a glossary source and 1 to the others", () => {
      const entities = [
        entity(locale, "specs", "object", w.object),
        entity(locale, "glossary", "term", w.object),
        entity(locale, "decisions", "decision", w.object),
      ];
      const dictionary = build(locale, entities, { glossarySources: new Set(["glossary"]) });
      expect(dictionary.entries.get(w.objectKey)?.targets.map((t) => [t.id, t.priority])).toEqual([
        ["glossary/term", 0],
        ["decisions/decision", 1],
        ["specs/object", 1],
      ]);
    });

    it("orders the targets of one priority by identifier, whatever the insertion order", () => {
      const ids = ["specs/a", "specs/b", "specs/c"];
      const entities = ids.map((id) => ({
        ...entity(locale, "specs", "x", w.object),
        id,
      }));
      for (const order of [
        entities,
        [...entities].reverse(),
        [entities[1], entities[2], entities[0]],
      ]) {
        const dictionary = build(
          locale,
          order.filter((e) => e !== undefined),
        );
        expect(dictionary.entries.get(w.objectKey)?.targets.map((t) => t.id)).toEqual(ids);
      }
    });

    it("honours the set of glossary sources it is given, whatever their name", () => {
      const dictionary = build(locale, [entity(locale, "specs", "object", w.object)], {
        glossarySources: new Set(["specs"]),
      });
      expect(dictionary.entries.get(w.objectKey)?.targets[0]?.priority).toBe(0);
    });

    it("merges a plural alias and its singular title into one target", () => {
      const dictionary = build(locale, [
        entity(locale, "glossary", "term", w.term, [w.plural, w.term.toUpperCase()]),
      ]);
      expect(dictionary.entries.get(w.termKey)).toEqual<DictionaryEntry>({
        key: w.termKey,
        homonym: false,
        targets: [{ id: "glossary/term", kind: "title", form: w.term, priority: 0 }],
      });
      expect(dictionary.findings).toEqual([]);
    });

    it("records an alias as such", () => {
      const dictionary = build(locale, [entity(locale, "glossary", "term", w.term, [w.alias])]);
      expect(dictionary.entries.get(w.aliasKey)?.targets).toEqual([
        { id: "glossary/term", kind: "alias", form: w.alias, priority: 0 },
      ]);
    });

    it("ignores the entities of another locale", () => {
      const otherLocale = locale === "en" ? "fr" : "en";
      const dictionary = build(locale, [
        entity(otherLocale, "glossary", "other", w.other),
        entity(locale, "glossary", "term", w.term),
      ]);
      expect([...dictionary.entries.keys()]).toEqual([w.termKey]);
    });

    it("ignores an empty title or alias", () => {
      const dictionary = build(locale, [entity(locale, "glossary", "term", "  ", ["", w.term])], {
        shortTerms: new Set([""]),
      });
      expect([...dictionary.entries.keys()]).toEqual([w.termKey]);
    });
  });

  describe("homonyms (same normalised form, two entities) are kept and flagged; the occurrence yields a link to each, at half confidence", () => {
    const entities = [
      entity(locale, "specs", "object", w.object),
      entity(locale, "glossary", "term", w.object.toUpperCase(), [w.other]),
      entity(locale, "glossary", "other", w.other),
      entity(locale, "decisions", "decision", w.other),
    ];

    it("keeps every entity under the shared key and flags the entry", () => {
      const dictionary = build(locale, entities);
      expect(dictionary.entries.get(w.objectKey)).toEqual<DictionaryEntry>({
        key: w.objectKey,
        homonym: true,
        targets: [
          { id: "glossary/term", kind: "title", form: w.object.toUpperCase(), priority: 0 },
          { id: "specs/object", kind: "title", form: w.object, priority: 1 },
        ],
      });
      expect(dictionary.entries.get(w.otherKey)?.homonym).toBe(true);
      expect(dictionary.entries.get(w.otherKey)?.targets.map((t) => t.id)).toEqual([
        "glossary/other",
        "glossary/term",
        "decisions/decision",
      ]);
    });

    it("produces one I-TERM-HOMONYM finding per homonym form, naming the sorted entities", () => {
      const dictionary = build(locale, entities);
      expect(dictionary.findings).toEqual([
        {
          check: HOMONYM_CHECK,
          severity: "info",
          message: `"${w.otherKey}" is the title or an alias of 3 entities: decisions/decision, glossary/other, glossary/term`,
          remediation:
            "Occurrences link to each entity at half confidence. Give the entities distinct titles or aliases, or add a `## Not to be confused with` section to each note so that readers tell them apart.",
        },
        {
          check: HOMONYM_CHECK,
          severity: "info",
          message: `"${w.objectKey}" is the title or an alias of 2 entities: glossary/term, specs/object`,
          remediation:
            "Occurrences link to each entity at half confidence. Give the entities distinct titles or aliases, or add a `## Not to be confused with` section to each note so that readers tell them apart.",
        },
      ]);
      expect(HOMONYM_CHECK).toBe("I-TERM-HOMONYM");
    });

    it("does not flag an entity whose title equals one of its own aliases", () => {
      const dictionary = build(locale, [entity(locale, "glossary", "term", w.term, [w.term])]);
      expect(dictionary.entries.get(w.termKey)?.homonym).toBe(false);
      expect(dictionary.entries.get(w.termKey)?.targets).toHaveLength(1);
      expect(dictionary.findings).toEqual([]);
    });
  });

  describe("a term shorter than three characters is excluded unless it appears in a configuration allow-list", () => {
    it("drops a short title or alias by default", () => {
      const dictionary = build(locale, [
        entity(locale, "glossary", "term", w.term, [w.short]),
        entity(locale, "glossary", "short", w.short),
      ]);
      expect([...dictionary.entries.keys()]).toEqual([w.termKey]);
    });

    it("keeps a short term listed in the allow-list, compared on its normalised form", () => {
      const dictionary = build(
        locale,
        [
          entity(locale, "glossary", "term", w.term, [w.short]),
          entity(locale, "glossary", "other", w.other, ["ab"]),
        ],
        { shortTerms: new Set([w.short.toLowerCase()]) },
      );
      expect([...dictionary.entries.keys()]).toEqual([w.termKey, w.shortKey, w.otherKey].sort());
      expect(dictionary.entries.get(w.shortKey)?.targets).toEqual([
        { id: "glossary/term", kind: "alias", form: w.short, priority: 0 },
      ]);
    });

    it("keeps a term of exactly three characters", () => {
      const dictionary = build(locale, [entity(locale, "glossary", "term", "abc")]);
      expect([...dictionary.entries.keys()]).toEqual(["abc"]);
    });
  });

  describe("configured stopwords are excluded from the dictionary", () => {
    it("drops a title or alias that is a stopword of the set, whatever its case", () => {
      const dictionary = build(locale, [
        entity(locale, "glossary", "term", w.term, [w.stopword]),
        entity(locale, "glossary", "stop", w.stopword),
      ]);
      expect([...dictionary.entries.keys()]).toEqual([w.termKey]);
    });

    it("drops a phrase made only of stopwords", () => {
      const dictionary = build(locale, [
        entity(locale, "glossary", "term", w.term),
        entity(locale, "glossary", "phrase", w.stopwordPhrase),
      ]);
      expect([...dictionary.entries.keys()]).toEqual([w.termKey]);
    });

    it("keeps a phrase that holds one word which is not a stopword", () => {
      const phrase = `${w.stopwordPhrase} ${w.object}`;
      const dictionary = build(locale, [entity(locale, "glossary", "phrase", phrase)]);
      expect([...dictionary.entries.keys()]).toEqual([
        `${w.stopwordPhrase.toLowerCase()} ${w.objectKey}`,
      ]);
    });

    it("uses the set it is given: a configured multi-word stopword and a configured term", () => {
      const dictionary = build(
        locale,
        [
          entity(locale, "glossary", "term", w.term),
          entity(locale, "glossary", "object", w.object),
          entity(locale, "glossary", "stop", w.stopword),
        ],
        { stopwords: new Set([w.termKey, w.object.toUpperCase()]) },
      );
      expect([...dictionary.entries.keys()]).toEqual([w.stopword.toLowerCase()]);
    });
  });

  describe("determinism", () => {
    it("gives the same entries, in the same order, whatever the order of the entities", () => {
      const entities = [
        entity(locale, "specs", "object", w.object),
        entity(locale, "glossary", "term", w.term, [w.alias, w.object]),
        entity(locale, "glossary", "other", w.other),
        entity(locale, "decisions", "decision", w.other),
      ];
      const forward = build(locale, entities);
      const backward = build(locale, [...entities].reverse());
      expect([...backward.entries]).toEqual([...forward.entries]);
      expect(backward.findings).toEqual(forward.findings);
      expect([...forward.entries.keys()]).toEqual([...forward.entries.keys()].sort());
    });

    it("does not modify the entities it is given", () => {
      const entities = [entity(locale, "glossary", "term", w.term, [w.alias])];
      const snapshot = structuredClone(entities);
      build(locale, entities);
      expect(entities).toEqual(snapshot);
    });
  });
});
