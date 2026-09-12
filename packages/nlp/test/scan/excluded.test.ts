import { parseMarkdown, scannableText } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import {
  buildDictionary,
  languagePack,
  scanDocument,
  type Dictionary,
  type Occurrence,
} from "../../src/index.js";

const dictionary: Dictionary = buildDictionary({
  locale: "en",
  glossarySources: new Set(["glossary"]),
  stopwords: languagePack("en").stopwords,
  shortTerms: new Set(),
  entities: [
    {
      id: "glossary/contract",
      source: "glossary",
      type: "term",
      title: "Contract",
      aliases: ["running agreement"],
      locale: "en",
    },
    {
      id: "glossary/annual-cap",
      source: "glossary",
      type: "term",
      title: "Annual cap",
      aliases: [],
      locale: "en",
    },
  ],
});

function occurrencesOf(text: string): Occurrence[] {
  const path = "specs/screens/entry.md";
  return scanDocument({
    document: { path, paragraphs: scannableText(parseMarkdown(text, { path })) },
    source: "specs",
    dictionary,
    pack: languagePack("en"),
    typePrefixes: {},
    scale: {
      base: 0.6,
      per_occurrence: 0.05,
      cap: 0.8,
      homonym_factor: 0.5,
      type_prefix_bonus: 0.1,
    },
  });
}

describe("the scan over the scannable text of a note", () => {
  it("yields no occurrence for a term present only in a code block", () => {
    const text = [
      "---",
      "title: contract",
      "---",
      "# Entry",
      "",
      "```ts",
      "const contract = load();",
      "```",
      "",
      "    contract.save()",
      "",
      "Call `contract.save()` or see https://example.test/contract for details.",
      "",
      "[Documentation](../objects/contract.md#running-agreement)",
      "",
    ].join("\n");
    expect(occurrencesOf(text)).toEqual([]);
  });

  it("recognises a term in the visible text of a link, in a heading, a list item, a cell and a quote", () => {
    const text = [
      "# Annual cap",
      "",
      "## Objects",
      "",
      "- Reads: [running agreement](../objects/contract.md)",
      "",
      "| Field | Note |",
      "|---|---|",
      "| contract | key |",
      "",
      "> Every contract.",
      "",
    ].join("\n");
    expect(
      occurrencesOf(text).map((occurrence) => [
        occurrence.key,
        occurrence.line,
        occurrence.position,
      ]),
    ).toEqual([
      ["annual cap", 1, 0],
      ["running agreement", 5, 7],
      ["contract", 9, 0],
      ["contract", 11, 6],
    ]);
  });
});
