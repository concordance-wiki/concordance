import { describe, expect, it, vi } from "vitest";

import {
  buildDictionary,
  compareOccurrences,
  languagePack,
  occurrenceConfidence,
  scanDocument,
  type Dictionary,
  type DictionarySource,
  type Occurrence,
  type OccurrenceScale,
  type ScanDocumentInput,
} from "../../src/index.js";
import * as automaton from "../../src/scan/automaton.js";

vi.mock("../../src/scan/automaton.js", async (importOriginal) => {
  const original = await importOriginal<typeof automaton>();
  return { ...original, buildAutomaton: vi.fn(original.buildAutomaton) };
});

const buildAutomaton = vi.mocked(automaton.buildAutomaton);

const scale: OccurrenceScale = {
  base: 0.6,
  per_occurrence: 0.05,
  cap: 0.8,
  homonym_factor: 0.5,
  type_prefix_bonus: 0.1,
};

const prefixes = {
  en: { screen: ["screen", "page"], api: ["api", "service"], data_object: ["table"] },
  fr: { screen: ["écran", "page"], api: ["api", "service"], data_object: ["table"] },
};

type Entity = Pick<DictionarySource, "id" | "title"> & { aliases?: string[] };

function dictionaryOf(locale: "en" | "fr", entities: Entity[]): Dictionary {
  return buildDictionary({
    locale,
    glossarySources: new Set(["glossary"]),
    stopwords: languagePack(locale).stopwords,
    shortTerms: new Set(),
    entities: entities.map((entity) => ({
      id: entity.id,
      source: entity.id.split("/")[0] ?? "",
      type: "term",
      title: entity.title,
      aliases: entity.aliases ?? [],
      locale,
    })),
  });
}

const en = dictionaryOf("en", [
  { id: "glossary/list-mention", title: "List mention" },
  { id: "glossary/mention", title: "Mention" },
  { id: "glossary/resource", title: "Resource" },
  { id: "specs/objects/resource", title: "Resource" },
  { id: "specs/screens/list-mention-panel", title: "List mention panel" },
  { id: "specs/api/mentions", title: "Mentions API", aliases: ["API mentions"] },
]);

function scanEn(
  paragraphs: ScanDocumentInput["document"]["paragraphs"],
  overrides: Partial<ScanDocumentInput> = {},
): Occurrence[] {
  return scanDocument({
    document: { path: "specs/screens/list-mention-panel.md", paragraphs },
    source: "specs",
    dictionary: en,
    pack: languagePack("en"),
    typePrefixes: prefixes.en,
    scale,
    ...overrides,
  });
}

describe("scanDocument", () => {
  it("carries the file, line, position, enclosing section and the whole short paragraph as context", () => {
    const text = "Lets a site maintainer confirm a list mention on a running resource.";
    expect(
      scanEn([
        { line: 5, text },
        { line: 9, text: "Reads: resource", section: "Objects" },
      ]),
    ).toStrictEqual([
      {
        key: "list mention",
        target: { id: "glossary/list-mention", kind: "title" },
        source: "specs",
        path: "specs/screens/list-mention-panel.md",
        line: 5,
        position: 33,
        text: "list mention",
        context: text,
        confidence: 0.6,
      },
      {
        key: "resource",
        target: { id: "glossary/resource", kind: "title" },
        source: "specs",
        path: "specs/screens/list-mention-panel.md",
        line: 5,
        position: 59,
        text: "resource",
        context: text,
        confidence: 0.3,
      },
      {
        key: "resource",
        target: { id: "specs/objects/resource", kind: "title" },
        source: "specs",
        path: "specs/screens/list-mention-panel.md",
        line: 5,
        position: 59,
        text: "resource",
        context: text,
        confidence: 0.3,
      },
      {
        key: "resource",
        target: { id: "glossary/resource", kind: "title" },
        source: "specs",
        path: "specs/screens/list-mention-panel.md",
        line: 9,
        position: 7,
        text: "resource",
        section: "Objects",
        context: "Reads: resource",
        confidence: 0.3,
      },
      {
        key: "resource",
        target: { id: "specs/objects/resource", kind: "title" },
        source: "specs",
        path: "specs/screens/list-mention-panel.md",
        line: 9,
        position: 7,
        text: "resource",
        section: "Objects",
        context: "Reads: resource",
        confidence: 0.3,
      },
    ]);
  });

  it("centres an 80-character context on the match, an ellipsis on each cut side", () => {
    const middle = `${"a".repeat(50)} list mention ${"b".repeat(60)}`;
    const atStart = `list mention ${"b".repeat(100)}`;
    const atEnd = `${"a".repeat(100)} list mention`;
    const exact = `${"a".repeat(33)} list mention ${"b".repeat(33)}`;
    const contexts = scanEn([
      { line: 1, text: middle },
      { line: 2, text: atStart },
      { line: 3, text: atEnd },
      { line: 4, text: exact },
    ]).map((occurrence) => [occurrence.position, occurrence.context]);
    expect(contexts).toEqual([
      [51, `…${"a".repeat(33)} list mention ${"b".repeat(33)}…`],
      [0, `list mention ${"b".repeat(67)}…`],
      [101, `…${"a".repeat(67)} list mention`],
      [34, exact],
    ]);
    expect(exact).toHaveLength(80);
  });

  it("quotes the inline code the paragraph leaves out in the context, never reading it, the position staying in the scanned text", () => {
    // Written: "Set `scan.resource` so that a list mention is read, not `resource`."
    const [occurrence, ...rest] = scanEn([
      {
        line: 1,
        text: "Set  so that a list mention is read, not .",
        code: [
          { at: 4, text: "scan.resource" },
          { at: 41, text: "resource" },
        ],
      },
    ]);
    expect(rest).toEqual([]);
    expect(occurrence).toMatchObject({
      key: "list mention",
      position: 15,
      text: "list mention",
      context: "Set scan.resource so that a list mention is read, not resource.",
    });
  });

  it("keeps the longest expression on overlap: list mention panel beats list mention and mention", () => {
    const occurrences = scanEn([{ line: 1, text: "Open List mention panel, then the mentions." }]);
    expect(occurrences.map((occurrence) => [occurrence.key, occurrence.position])).toEqual([
      ["list mention panel", 5],
      ["mention", 34],
    ]);
  });

  it("keeps a match that starts inside a longer match, ends after it and targets a different entity", () => {
    const dictionary = dictionaryOf("en", [
      { id: "glossary/build-log", title: "Build log" },
      { id: "specs/screens/log-summary", title: "Log summary" },
      { id: "glossary/log", title: "Log" },
    ]);
    const occurrences = scanEn([{ line: 1, text: "Read the build log summary first." }], {
      dictionary,
    });
    expect(
      occurrences.map((occurrence) => [occurrence.key, occurrence.target.id, occurrence.position]),
    ).toEqual([
      ["build log", "glossary/build-log", 9],
      ["log summary", "specs/screens/log-summary", 15],
    ]);
  });

  it("recognises a mention on whole words, whatever the case and the plural", () => {
    const occurrences = scanEn([{ line: 1, text: "List Mentions, not resourceful mentions." }]);
    expect(occurrences.map((occurrence) => [occurrence.key, occurrence.target.id])).toEqual([
      ["list mention", "glossary/list-mention"],
      ["mention", "glossary/mention"],
    ]);
  });

  it("adds the type prefix bonus and fixes the expected type: screen List mention panel", () => {
    const [occurrence] = scanEn([{ line: 1, text: "Open the screen List mention panel." }]);
    expect(occurrence).toMatchObject({
      key: "list mention panel",
      position: 16,
      expectedType: "screen",
      confidence: 0.7,
    });
    const [table] = scanEn([{ line: 1, text: "See table Resource." }]);
    expect(table).toMatchObject({ expectedType: "data_object", confidence: 0.35 });
  });

  it("recognises a French type prefix bound by an apostrophe: l'écran Page entité", () => {
    const fr = dictionaryOf("fr", [
      { id: "glossaire/lien-explicite", title: "Lien explicite" },
      { id: "glossaire/lien", title: "Lien" },
      { id: "specs/ecrans/page-entite", title: "Page entité" },
    ]);
    const occurrences = scanDocument({
      document: {
        path: "specs/processus/confirmer-un-lien.md",
        paragraphs: [{ line: 3, text: "Depuis l’écran Page entité, le mainteneur valide." }],
      },
      source: "specs",
      dictionary: fr,
      pack: languagePack("fr"),
      typePrefixes: prefixes.fr,
      scale,
    });
    expect(occurrences).toEqual([
      {
        key: "page entite",
        target: { id: "specs/ecrans/page-entite", kind: "title" },
        source: "specs",
        path: "specs/processus/confirmer-un-lien.md",
        line: 3,
        position: 15,
        text: "Page entité",
        context: "Depuis l’écran Page entité, le mainteneur valide.",
        expectedType: "screen",
        confidence: 0.7,
      },
    ]);
  });

  it("never takes a prefix word that is part of the match as a type prefix", () => {
    const occurrences = scanEn([{ line: 1, text: "Call API mentions to record it." }]);
    expect(occurrences).toEqual([
      expect.objectContaining({ key: "api mention", position: 5, confidence: 0.6 }),
    ]);
    expect(occurrences[0]).not.toHaveProperty("expectedType");
  });

  it("announces no type for a prefix word listed under several types", () => {
    const typePrefixes = { api: ["service"], process: ["service"], screen: ["screen"] };
    const occurrences = scanEn([{ line: 1, text: "The service List mention panel." }], {
      typePrefixes,
    });
    expect(occurrences).toEqual([
      expect.objectContaining({ key: "list mention panel", confidence: 0.6 }),
    ]);
    expect(occurrences[0]).not.toHaveProperty("expectedType");
  });

  it("halves the confidence of a homonym and links each of its entities, glossary first", () => {
    const occurrences = scanEn([{ line: 1, text: "A resource." }]);
    expect(occurrences.map((occurrence) => [occurrence.target.id, occurrence.confidence])).toEqual([
      ["glossary/resource", 0.3],
      ["specs/objects/resource", 0.3],
    ]);
  });

  it("sorts occurrences by line, position, target then key; a hyphenated alias matches its spaced form too", () => {
    const fr = dictionaryOf("fr", [
      { id: "glossaire/lien-explicite", title: "Lien explicite", aliases: ["lien-explicite"] },
      { id: "glossaire/entite", title: "Entité" },
      { id: "annexes/entite", title: "Entité" },
    ]);
    const occurrences = scanDocument({
      document: {
        path: "notes.md",
        paragraphs: [
          { line: 9, text: "Une entité porte un lien-explicite." },
          { line: 3, text: "Un lien explicite sur une entité." },
        ],
      },
      source: "glossaire",
      dictionary: fr,
      pack: languagePack("fr"),
      typePrefixes: {},
      scale,
    });
    expect(
      occurrences.map((occurrence) => [
        occurrence.line,
        occurrence.position,
        occurrence.target.id,
        occurrence.key,
        occurrence.target.kind,
      ]),
    ).toEqual([
      [3, 3, "glossaire/lien-explicite", "lien explicite", "title"],
      [3, 3, "glossaire/lien-explicite", "lien-explicite", "alias"],
      [3, 26, "annexes/entite", "entite", "title"],
      [3, 26, "glossaire/entite", "entite", "title"],
      [9, 4, "annexes/entite", "entite", "title"],
      [9, 4, "glossaire/entite", "entite", "title"],
      [9, 20, "glossaire/lien-explicite", "lien explicite", "title"],
      [9, 20, "glossaire/lien-explicite", "lien-explicite", "alias"],
    ]);
  });

  it("orders occurrences of several documents by path, line, position, target then key", () => {
    const base: Occurrence = {
      key: "resource",
      target: { id: "glossary/resource", kind: "title" },
      source: "specs",
      path: "b.md",
      line: 5,
      position: 10,
      text: "resource",
      context: "",
      confidence: 0.6,
    };
    const later = (change: Partial<Occurrence>): Occurrence => ({ ...base, ...change });
    for (const after of [
      later({ path: "c.md", line: 1, position: 0, key: "a" }),
      later({ line: 6, position: 0, key: "a" }),
      later({ position: 11, key: "a" }),
      later({ target: { id: "specs/objects/resource", kind: "alias" }, key: "a" }),
      later({ key: "resources" }),
    ]) {
      expect(compareOccurrences(base, after)).toBeLessThan(0);
      expect(compareOccurrences(after, base)).toBeGreaterThan(0);
    }
    expect(compareOccurrences(base, { ...base })).toBe(0);
  });

  it("gives nothing for a document without paragraphs or without any known word", () => {
    expect(scanEn([])).toEqual([]);
    expect(scanEn([{ line: 1, text: "Nothing to see here." }])).toEqual([]);
  });

  it("builds the automaton once for a dictionary, then scans every document in a single pass", () => {
    const dictionary = dictionaryOf("en", [{ id: "glossary/entity", title: "Entity" }]);
    const calls = buildAutomaton.mock.calls.length;
    const input: ScanDocumentInput = {
      document: { path: "a.md", paragraphs: [{ line: 1, text: "An entity." }] },
      source: "specs",
      dictionary,
      pack: languagePack("en"),
      typePrefixes: {},
      scale,
    };
    expect(scanDocument(input)).toHaveLength(1);
    expect(scanDocument({ ...input, document: { path: "b.md", paragraphs: [] } })).toEqual([]);
    expect(scanDocument(input)).toHaveLength(1);
    expect(buildAutomaton.mock.calls.length - calls).toBe(1);
    expect(buildAutomaton.mock.calls.at(-1)?.[0]).toEqual([
      { key: dictionary.entries.get("entity"), words: ["entity"] },
    ]);
    expect(scanDocument({ ...input, pack: languagePack("fr") })).toHaveLength(1);
    expect(buildAutomaton.mock.calls.length - calls).toBe(2);
  });
});

describe("occurrenceConfidence", () => {
  it("adds the increment per further occurrence up to the cap", () => {
    expect(occurrenceConfidence(1, scale)).toBe(0.6);
    expect(occurrenceConfidence(2, scale)).toBe(0.65);
    expect(occurrenceConfidence(3, scale)).toBe(0.7);
    expect(occurrenceConfidence(5, scale)).toBe(0.8);
    expect(occurrenceConfidence(6, scale)).toBe(0.8);
  });
});
