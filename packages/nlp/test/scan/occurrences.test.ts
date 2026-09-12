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
  { id: "glossary/free-payment", title: "Free payment" },
  { id: "glossary/payment", title: "Payment" },
  { id: "glossary/contract", title: "Contract" },
  { id: "specs/objects/contract", title: "Contract" },
  { id: "specs/screens/free-payment-entry", title: "Free payment entry" },
  { id: "specs/api/payments", title: "Payments API", aliases: ["API payments"] },
]);

function scanEn(
  paragraphs: ScanDocumentInput["document"]["paragraphs"],
  overrides: Partial<ScanDocumentInput> = {},
): Occurrence[] {
  return scanDocument({
    document: { path: "specs/screens/free-payment-entry.md", paragraphs },
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
    const text = "Lets an account manager record a free payment on a running contract.";
    expect(
      scanEn([
        { line: 5, text },
        { line: 9, text: "Reads: contract", section: "Objects" },
      ]),
    ).toStrictEqual([
      {
        key: "free payment",
        target: { id: "glossary/free-payment", kind: "title" },
        source: "specs",
        path: "specs/screens/free-payment-entry.md",
        line: 5,
        position: 33,
        context: text,
        confidence: 0.6,
      },
      {
        key: "contract",
        target: { id: "glossary/contract", kind: "title" },
        source: "specs",
        path: "specs/screens/free-payment-entry.md",
        line: 5,
        position: 59,
        context: text,
        confidence: 0.3,
      },
      {
        key: "contract",
        target: { id: "specs/objects/contract", kind: "title" },
        source: "specs",
        path: "specs/screens/free-payment-entry.md",
        line: 5,
        position: 59,
        context: text,
        confidence: 0.3,
      },
      {
        key: "contract",
        target: { id: "glossary/contract", kind: "title" },
        source: "specs",
        path: "specs/screens/free-payment-entry.md",
        line: 9,
        position: 7,
        section: "Objects",
        context: "Reads: contract",
        confidence: 0.3,
      },
      {
        key: "contract",
        target: { id: "specs/objects/contract", kind: "title" },
        source: "specs",
        path: "specs/screens/free-payment-entry.md",
        line: 9,
        position: 7,
        section: "Objects",
        context: "Reads: contract",
        confidence: 0.3,
      },
    ]);
  });

  it("centres an 80-character context on the match, an ellipsis on each cut side", () => {
    const middle = `${"a".repeat(50)} free payment ${"b".repeat(60)}`;
    const atStart = `free payment ${"b".repeat(100)}`;
    const atEnd = `${"a".repeat(100)} free payment`;
    const exact = `${"a".repeat(33)} free payment ${"b".repeat(33)}`;
    const contexts = scanEn([
      { line: 1, text: middle },
      { line: 2, text: atStart },
      { line: 3, text: atEnd },
      { line: 4, text: exact },
    ]).map((occurrence) => [occurrence.position, occurrence.context]);
    expect(contexts).toEqual([
      [51, `…${"a".repeat(33)} free payment ${"b".repeat(33)}…`],
      [0, `free payment ${"b".repeat(67)}…`],
      [101, `…${"a".repeat(67)} free payment`],
      [34, exact],
    ]);
    expect(exact).toHaveLength(80);
  });

  it("keeps the longest expression on overlap: free payment entry beats free payment and payment", () => {
    const occurrences = scanEn([{ line: 1, text: "Open Free payment entry, then the payments." }]);
    expect(occurrences.map((occurrence) => [occurrence.key, occurrence.position])).toEqual([
      ["free payment entry", 5],
      ["payment", 34],
    ]);
  });

  it("recognises a mention on whole words, whatever the case and the plural", () => {
    const occurrences = scanEn([{ line: 1, text: "Free Payments, not contractual payments." }]);
    expect(occurrences.map((occurrence) => [occurrence.key, occurrence.target.id])).toEqual([
      ["free payment", "glossary/free-payment"],
      ["payment", "glossary/payment"],
    ]);
  });

  it("adds the type prefix bonus and fixes the expected type: screen Free payment entry", () => {
    const [occurrence] = scanEn([{ line: 1, text: "Open the screen Free payment entry." }]);
    expect(occurrence).toMatchObject({
      key: "free payment entry",
      position: 16,
      expectedType: "screen",
      confidence: 0.7,
    });
    const [table] = scanEn([{ line: 1, text: "See table Contract." }]);
    expect(table).toMatchObject({ expectedType: "data_object", confidence: 0.35 });
  });

  it("recognises a French type prefix bound by an apostrophe: l'écran Saisie de versement libre", () => {
    const fr = dictionaryOf("fr", [
      { id: "glossaire/versement-libre", title: "Versement libre" },
      { id: "glossaire/versement", title: "Versement" },
      { id: "specs/ecrans/saisie-versement-libre", title: "Saisie de versement libre" },
    ]);
    const occurrences = scanDocument({
      document: {
        path: "specs/processus/enregistrer-un-versement.md",
        paragraphs: [
          { line: 3, text: "Depuis l’écran Saisie de versement libre, le gestionnaire valide." },
        ],
      },
      source: "specs",
      dictionary: fr,
      pack: languagePack("fr"),
      typePrefixes: prefixes.fr,
      scale,
    });
    expect(occurrences).toEqual([
      {
        key: "saisie de versement libre",
        target: { id: "specs/ecrans/saisie-versement-libre", kind: "title" },
        source: "specs",
        path: "specs/processus/enregistrer-un-versement.md",
        line: 3,
        position: 15,
        context: "Depuis l’écran Saisie de versement libre, le gestionnaire valide.",
        expectedType: "screen",
        confidence: 0.7,
      },
    ]);
  });

  it("never takes a prefix word that is part of the match as a type prefix", () => {
    const occurrences = scanEn([{ line: 1, text: "Call API payments to record it." }]);
    expect(occurrences).toEqual([
      expect.objectContaining({ key: "api payment", position: 5, confidence: 0.6 }),
    ]);
    expect(occurrences[0]).not.toHaveProperty("expectedType");
  });

  it("announces no type for a prefix word listed under several types", () => {
    const typePrefixes = { api: ["service"], process: ["service"], screen: ["screen"] };
    const occurrences = scanEn([{ line: 1, text: "The service Free payment entry." }], {
      typePrefixes,
    });
    expect(occurrences).toEqual([
      expect.objectContaining({ key: "free payment entry", confidence: 0.6 }),
    ]);
    expect(occurrences[0]).not.toHaveProperty("expectedType");
  });

  it("halves the confidence of a homonym and links each of its entities, glossary first", () => {
    const occurrences = scanEn([{ line: 1, text: "A contract." }]);
    expect(occurrences.map((occurrence) => [occurrence.target.id, occurrence.confidence])).toEqual([
      ["glossary/contract", 0.3],
      ["specs/objects/contract", 0.3],
    ]);
  });

  it("sorts occurrences by line, position, target then key; a hyphenated alias matches its spaced form too", () => {
    const fr = dictionaryOf("fr", [
      { id: "glossaire/versement-libre", title: "Versement libre", aliases: ["versement-libre"] },
      { id: "glossaire/contrat", title: "Contrat" },
      { id: "annexes/contrat", title: "Contrat" },
    ]);
    const occurrences = scanDocument({
      document: {
        path: "notes.md",
        paragraphs: [
          { line: 9, text: "Le contrat porte un versement-libre." },
          { line: 3, text: "Un versement libre sur le contrat." },
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
      [3, 3, "glossaire/versement-libre", "versement libre", "title"],
      [3, 3, "glossaire/versement-libre", "versement-libre", "alias"],
      [3, 26, "annexes/contrat", "contrat", "title"],
      [3, 26, "glossaire/contrat", "contrat", "title"],
      [9, 3, "annexes/contrat", "contrat", "title"],
      [9, 3, "glossaire/contrat", "contrat", "title"],
      [9, 20, "glossaire/versement-libre", "versement libre", "title"],
      [9, 20, "glossaire/versement-libre", "versement-libre", "alias"],
    ]);
  });

  it("orders occurrences of several documents by path, line, position, target then key", () => {
    const base: Occurrence = {
      key: "contract",
      target: { id: "glossary/contract", kind: "title" },
      source: "specs",
      path: "b.md",
      line: 5,
      position: 10,
      context: "",
      confidence: 0.6,
    };
    const later = (change: Partial<Occurrence>): Occurrence => ({ ...base, ...change });
    for (const after of [
      later({ path: "c.md", line: 1, position: 0, key: "a" }),
      later({ line: 6, position: 0, key: "a" }),
      later({ position: 11, key: "a" }),
      later({ target: { id: "specs/objects/contract", kind: "alias" }, key: "a" }),
      later({ key: "contracts" }),
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
    const dictionary = dictionaryOf("en", [{ id: "glossary/member", title: "Member" }]);
    const calls = buildAutomaton.mock.calls.length;
    const input: ScanDocumentInput = {
      document: { path: "a.md", paragraphs: [{ line: 1, text: "A member." }] },
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
      { key: dictionary.entries.get("member"), words: ["member"] },
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
