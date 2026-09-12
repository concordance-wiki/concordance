import { describe, expect, it, vi } from "vitest";

import {
  buildDictionary,
  languagePack,
  scanDocument,
  type DictionarySource,
  type ScannedDocument,
} from "../../src/index.js";

const vocabulary = [
  "account",
  "amount",
  "annual",
  "batch",
  "branch",
  "cap",
  "contract",
  "date",
  "entry",
  "exceptional",
  "free",
  "manager",
  "member",
  "message",
  "nightly",
  "payment",
  "policy",
  "record",
  "request",
  "running",
  "scheduled",
  "screen",
  "search",
  "settlement",
  "summary",
  "table",
  "validate",
  "workshop",
  "the",
  "of",
  "on",
  "and",
  "is",
  "by",
  "at",
  "to",
];

const content = vocabulary.slice(0, 28);

/** A linear congruential generator: the corpus is the same on every run. */
function generator(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    return state;
  };
}

function pick(next: () => number): string {
  return vocabulary[next() % vocabulary.length] ?? "";
}

function phrase(next: () => number, words: number): string {
  const parts: string[] = [];
  for (let i = 0; i < words; i += 1) parts.push(pick(next));
  return parts.join(" ");
}

/** Every content word, then every ordered pair of them: distinct titles without any draw. */
function title(index: number): string {
  if (index < content.length) return content[index] ?? "";
  const pair = index - content.length;
  const first = content[Math.floor(pair / (content.length - 1))] ?? "";
  const rest = content.filter((word) => word !== first);
  return `${first} ${rest[pair % rest.length] ?? ""}`;
}

function entities(count: number): DictionarySource[] {
  const result: DictionarySource[] = [];
  for (let i = 0; i < count; i += 1) {
    result.push({
      id: `glossary/term-${String(i)}`,
      source: "glossary",
      type: "term",
      title: title(i),
      aliases: [],
      locale: "en",
    });
  }
  return result;
}

function documents(count: number, next: () => number): ScannedDocument[] {
  const result: ScannedDocument[] = [];
  for (let i = 0; i < count; i += 1) {
    const paragraphs = [];
    for (let line = 1; line <= 5; line += 1) {
      paragraphs.push({ line: line * 3, text: `${phrase(next, 40)}.`, section: "Body" });
    }
    result.push({ path: `notes/note-${String(i)}.md`, paragraphs });
  }
  return result;
}

// Instrumented runs (coverage, mutation) are several times slower than the measured scan.
vi.setConfig({ testTimeout: 60_000 });

describe("the occurrence scan on a large corpus", () => {
  it("scans a 2,000-file corpus against a 300-key dictionary in under ten seconds", () => {
    const next = generator(7);
    const pack = languagePack("en");
    const dictionary = buildDictionary({
      entities: entities(300),
      locale: "en",
      glossarySources: new Set(["glossary"]),
      stopwords: pack.stopwords,
      shortTerms: new Set(),
    });
    expect(dictionary.entries.size).toBe(300);
    const corpus = documents(2_000, next);

    const started = performance.now();
    let occurrences = 0;
    for (const document of corpus) {
      occurrences += scanDocument({
        document,
        source: "notes",
        dictionary,
        pack,
        typePrefixes: { screen: ["screen"], data_object: ["table"], batch: ["batch"] },
        scale: {
          base: 0.6,
          per_occurrence: 0.05,
          cap: 0.8,
          homonym_factor: 0.5,
          type_prefix_bonus: 0.1,
        },
      }).length;
    }
    const elapsed = performance.now() - started;

    process.stdout.write(
      `scanned ${String(corpus.length)} files, ${String(occurrences)} occurrences, in ${elapsed.toFixed(0)} ms\n`,
    );
    expect(occurrences).toBeGreaterThan(corpus.length);
    expect(elapsed).toBeLessThan(10_000);
  });
});
